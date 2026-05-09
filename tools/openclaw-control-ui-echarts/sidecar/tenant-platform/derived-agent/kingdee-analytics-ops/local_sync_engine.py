#!/usr/bin/env python3
from __future__ import annotations

import atexit
import base64
import json
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit
from uuid import uuid4


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
PROFILE_PATH = SKILL_ROOT / "references" / "k3cloud-connection-profile.json"
K3CLOUD_SCRIPT = SCRIPT_DIR / "k3cloud_api.py"
BRIDGE_SCRIPT = SCRIPT_DIR / "tenant_local_pg_bridge.mjs"
DEFAULT_START = "2023-01-01"
REPORT_PAGE_LIMIT = 2000
BILL_QUERY_PAGE_LIMIT = 2000
REPORT_QUERY_FIELDS = (
    "FBillDate",
    "FBillNo",
    "FMaterialId",
    "FMaterialName",
    "FSupplierName",
    "FQty",
    "FPrice",
    "FAmount",
)
HS_PURCHASE_SCOPE_FIELDS = (
    "FACCTGRANGEID",
    "FNumber",
    "FName",
    "FACCTGORGID",
    "FACCTGORGID.FNumber",
    "FACCTGORGID.FName",
    "FACCTGSYSTEMID.FNumber",
    "FACCTPOLICYID.FNumber",
    "FDocumentStatus",
    "FForbidStatus",
)
ACCOUNT_ORG_FIELDS = (
    "FNumber",
    "FName",
    "FIsAccountOrg",
    "FDocumentStatus",
    "FForbidStatus",
)
PURCHASE_MODULE_NAMES = {"purchase", "supplier_collab", "cost"}
SERVICE_PATHS = {
    "execute_bill_query": "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc",
    "view": "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.View.common.kdsvc",
    "get_sys_report_data": "Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.GetSysReportData.common.kdsvc",
}
ACTIVE_PROFILE_PATH = PROFILE_PATH
TEMP_PROFILE_PATHS: list[Path] = []


class LocalSyncError(RuntimeError):
    pass


@dataclass
class ObjectDefinition:
    object_code: str
    module_name: str
    form_id: str
    read_method: str
    storage_profile: str
    sync_strategy: str
    field_keys: list[str]
    default_filter_string: str
    default_order_by: str


def read_json_file(file_path: Path) -> dict[str, Any]:
    return json.loads(file_path.read_text(encoding="utf-8"))


def read_stdin_json() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise LocalSyncError("local sync payload must be a JSON object")
    return payload


def build_row_key(parts: list[Any]) -> str:
    normalized_parts = [json.dumps(part, ensure_ascii=False, sort_keys=True) for part in parts]
    return "|".join(normalized_parts)


def normalize_timestamp(raw: str | None = None) -> str:
    if raw:
        return datetime.fromisoformat(raw).isoformat()
    return datetime.now().isoformat()


def ensure_supported_payload(payload: dict[str, Any]) -> list[str]:
    cli_args = payload.get("cli_args")
    if not isinstance(cli_args, list) or not cli_args:
        raise LocalSyncError("cli_args must be a non-empty list")
    if any(not isinstance(item, str) or not item.strip() for item in cli_args):
        raise LocalSyncError("cli_args entries must be non-empty strings")
    command = cli_args[0].strip()
    if command not in {"sync-sales-module", "sync-supply-chain", "sync-object"}:
        raise LocalSyncError(f"unsupported local cli command: {command}")
    return cli_args


def extract_default_start(cli_args: list[str]) -> date:
    if "--default-start" not in cli_args:
        return date.fromisoformat(DEFAULT_START)
    index = cli_args.index("--default-start")
    if index + 1 >= len(cli_args):
        raise LocalSyncError("--default-start requires a value")
    return date.fromisoformat(cli_args[index + 1])


def extract_requested_object_codes(cli_args: list[str]) -> list[str]:
    if cli_args[0] == "sync-object":
        if len(cli_args) < 2:
            raise LocalSyncError("sync-object requires the object code as the second argument")
        return [cli_args[1].strip()]
    object_codes: list[str] = []
    for index, token in enumerate(cli_args[:-1]):
        if token == "--object-code":
            object_code = cli_args[index + 1].strip()
            if object_code and object_code not in object_codes:
                object_codes.append(object_code)
    return object_codes


def run_node_bridge(access_file: str, payload: dict[str, Any]) -> dict[str, Any]:
    result = subprocess.run(
        ["node", str(BRIDGE_SCRIPT), access_file],
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or "tenant_local_pg_bridge_failed"
        raise LocalSyncError(error)
    try:
        parsed = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise LocalSyncError(f"invalid bridge output: {result.stdout}") from exc
    if isinstance(parsed, dict) and parsed.get("error"):
        raise LocalSyncError(str(parsed["error"]))
    return parsed


def run_local_query(access_file: str, sql: str, max_rows: int = 2000) -> dict[str, Any]:
    payload = {
        "mode": "query",
        "sql_b64": base64.b64encode(sql.encode("utf-8")).decode("ascii"),
        "max_rows": max_rows,
    }
    return run_node_bridge(access_file, payload)


def run_local_exec(access_file: str, plan: dict[str, Any]) -> dict[str, Any]:
    payload = {
        "mode": "execute_sync_plan",
        "plan": plan,
    }
    return run_node_bridge(access_file, payload)


def cleanup_temp_profiles() -> None:
    for path in TEMP_PROFILE_PATHS:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            continue


atexit.register(cleanup_temp_profiles)


def normalize_source_profile_row(access_file: str) -> dict[str, Any] | None:
    try:
        result = run_local_query(
            access_file,
            (
                "select tenant_code, source_dbid, request_url, login_request_body_json "
                "from source_request_profile "
                "order by updated_at desc "
                "limit 1"
            ),
            max_rows=1,
        )
    except Exception:
        return None
    rows = result.get("rows")
    if not isinstance(rows, list) or not rows:
        return None
    row = rows[0]
    return row if isinstance(row, dict) else None


def build_runtime_profile_payload(row: dict[str, Any]) -> dict[str, Any] | None:
    request_url = str(row.get("request_url") or "").strip()
    login_payload = row.get("login_request_body_json")
    if not request_url or not isinstance(login_payload, dict):
        return None
    marker = "Kingdee.BOS.WebApi.ServicesStub."
    marker_index = request_url.find(marker)
    if marker_index > 0:
        request_base = request_url[:marker_index]
        if not request_base.endswith("/"):
            request_base += "/"
        login_path = request_url[marker_index:]
    else:
        parsed = urlsplit(request_url)
        path = parsed.path
        path_index = path.find(marker)
        if path_index < 0:
            return None
        base_path = path[:path_index]
        if not base_path.endswith("/"):
            base_path += "/"
        request_base = f"{parsed.scheme}://{parsed.netloc}{base_path}"
        login_path = path[path_index:]
    parameters = login_payload.get("parameters")
    parameter_list = parameters if isinstance(parameters, list) else []
    return {
        "profile_name": "tenant-bound-runtime",
        "source": "tenant-bound source_request_profile",
        "auth_method": "LoginByAppSecret",
        "base_url": request_base,
        "login_path": login_path,
        "login_payload": login_payload,
        "tenant": {
            "dbid": str(row.get("source_dbid") or (parameter_list[0] if parameter_list else "")).strip(),
            "username": str(parameter_list[1] if len(parameter_list) > 1 else "").strip(),
            "lcid": parameter_list[4] if len(parameter_list) > 4 else None,
        },
        "application": {
            "app_id": str(parameter_list[2] if len(parameter_list) > 2 else "").strip(),
            "app_secret": str(parameter_list[3] if len(parameter_list) > 3 else "").strip(),
        },
        "service_paths": SERVICE_PATHS,
    }


def prepare_runtime_profile(access_file: str) -> None:
    global ACTIVE_PROFILE_PATH
    row = normalize_source_profile_row(access_file)
    if row is None:
        ACTIVE_PROFILE_PATH = PROFILE_PATH
        return
    payload = build_runtime_profile_payload(row)
    if payload is None:
        ACTIVE_PROFILE_PATH = PROFILE_PATH
        return
    temp_file = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        suffix=".json",
        prefix="openclaw-k3cloud-profile-",
        delete=False,
    )
    with temp_file:
        json.dump(payload, temp_file, ensure_ascii=False, indent=2)
    temp_path = Path(temp_file.name)
    TEMP_PROFILE_PATHS.append(temp_path)
    ACTIVE_PROFILE_PATH = temp_path


def call_k3cloud(*, service: str, data: dict[str, Any], form_id: str | None = None, timeout: int = 120) -> Any:
    command = [
        sys.executable,
        str(K3CLOUD_SCRIPT),
        "--profile",
        str(ACTIVE_PROFILE_PATH),
        "--service",
        service,
        "--data",
        json.dumps(data, ensure_ascii=False),
        "--format",
        "json",
        "--timeout",
        str(timeout),
    ]
    if form_id:
        command.extend(["--form-id", form_id])
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if result.returncode != 0:
        error = result.stderr.strip() or result.stdout.strip() or "k3cloud_api_failed"
        raise LocalSyncError(error)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise LocalSyncError(f"invalid k3cloud output: {result.stdout}") from exc


def fetch_bill_rows(
    *,
    form_id: str,
    field_keys: list[str],
    filter_string: str,
    order_by: str,
    limit: int = BILL_QUERY_PAGE_LIMIT,
) -> list[list[Any]]:
    rows: list[list[Any]] = []
    start_row = 0
    while True:
        payload = {
            "FormId": form_id,
            "FieldKeys": ",".join(field_keys),
            "FilterString": filter_string,
            "OrderString": order_by,
            "TopRowCount": 0,
            "StartRow": start_row,
            "Limit": limit,
            "SubSystemId": "",
        }
        result = call_k3cloud(service="execute-bill-query", data=payload)
        if not isinstance(result, list):
            raise LocalSyncError(f"unexpected ExecuteBillQuery result for {form_id}")
        if not result:
            break
        rows.extend(result)
        if len(result) < limit:
            break
        start_row += limit
    return rows


def fetch_view(form_id: str, source_object_id: str) -> Any:
    result = call_k3cloud(
        service="view",
        form_id=form_id,
        data={"CreateOrgId": 0, "Number": "", "Id": source_object_id, "IsSortBySeq": "true"},
    )
    if isinstance(result, dict):
        document = result.get("Result", {}).get("Result")
        if document is not None:
            return document
    return result


def parse_report_rows(response: Any, form_id: str) -> list[list[Any]]:
    if not isinstance(response, dict):
        raise LocalSyncError(f"{form_id} report response must be an object")
    result = response.get("Result")
    if not isinstance(result, dict):
        raise LocalSyncError(f"{form_id} report response is missing Result")
    response_status = result.get("ResponseStatus")
    if isinstance(response_status, dict) and response_status.get("IsSuccess") is False:
        errors = response_status.get("Errors") or []
        messages = [
            str(item.get("Message") or "").strip()
            for item in errors
            if isinstance(item, dict) and str(item.get("Message") or "").strip()
        ]
        raise LocalSyncError("; ".join(messages) or json.dumps(response, ensure_ascii=False))
    rows = result.get("Rows") or []
    if not isinstance(rows, list):
        raise LocalSyncError(f"{form_id} report rows must be a list")
    return rows


def is_truthy_flag(value: object) -> bool:
    if isinstance(value, bool):
        return value
    normalized = str(value or "").strip().lower()
    return normalized in {"1", "true", "t", "yes", "y"}


def is_active_status(document_status: object, forbid_status: object) -> bool:
    normalized_document_status = str(document_status or "").strip().upper()
    normalized_forbid_status = str(forbid_status or "").strip().upper()
    return normalized_document_status in {"", "C"} and normalized_forbid_status in {"", "A"}


def resolve_hs_purchase_scopes() -> list[dict[str, str]]:
    scope_rows = fetch_bill_rows(
        form_id="HS_ACCTGRANGE",
        field_keys=list(HS_PURCHASE_SCOPE_FIELDS),
        filter_string="",
        order_by="FACCTGORGID asc,FACCTGRANGEID asc",
    )
    org_rows = fetch_bill_rows(
        form_id="ORG_Organizations",
        field_keys=list(ACCOUNT_ORG_FIELDS),
        filter_string="",
        order_by="FNumber asc",
    )
    account_org_numbers = {
        str(row[0] or "").strip()
        for row in org_rows
        if len(row) >= 5 and is_truthy_flag(row[2]) and is_active_status(row[3], row[4])
    }
    primary: dict[str, dict[str, str]] = {}
    fallback: dict[str, dict[str, str]] = {}
    for row in scope_rows:
        if len(row) < len(HS_PURCHASE_SCOPE_FIELDS):
            continue
        if not is_active_status(row[8], row[9]):
            continue
        acct_org_number = str(row[4] or "").strip()
        acct_system_number = str(row[6] or "").strip()
        acct_policy_number = str(row[7] or "").strip()
        if not acct_org_number or not acct_system_number or not acct_policy_number:
            continue
        payload = {
            "acct_org_number": acct_org_number,
            "acct_org_name": str(row[5] or "").strip(),
            "acct_system_number": acct_system_number,
            "acct_policy_number": acct_policy_number,
        }
        fallback.setdefault(acct_org_number, payload)
        if acct_org_number in account_org_numbers:
            primary.setdefault(acct_org_number, payload)
    resolved = primary or fallback
    return [resolved[key] for key in sorted(resolved)]


def fetch_hs_purchase_rows(start_date: date, end_date: date) -> list[list[Any]]:
    rows: list[list[Any]] = []
    source_row_number = 0
    for scope in resolve_hs_purchase_scopes():
        start_row = 0
        while True:
            report_payload = {
                "FieldKeys": ",".join(REPORT_QUERY_FIELDS),
                "SchemeId": "",
                "StartRow": start_row,
                "Limit": REPORT_PAGE_LIMIT,
                "IsVerifyBaseDataField": True,
                "FilterString": [],
                "Model": {
                    "FYear": str(start_date.year),
                    "FENDYEAR": str(end_date.year),
                    "FSrcBillTypeId": [{"FID": ""}],
                    "FPeriod": str(start_date.month),
                    "FEndPeriod": str(end_date.month),
                    "FSupplier": {"FNUMBER": ""},
                    "FStartMATERIALID": {"FNumber": ""},
                    "FEndBuyDeptId": {"FNUMBER": ""},
                    "FEndBuyer": {"FNUMBER": ""},
                    "FENDMATERIALID": {"FNumber": ""},
                    "FEndSupplier": {"FNUMBER": ""},
                    "FACCTGSYSTEMID": {"FNUMBER": scope["acct_system_number"]},
                    "FACCTGORGID": {"FNUMBER": scope["acct_org_number"]},
                    "FACCTGPOLICYID": {"FNUMBER": scope["acct_policy_number"]},
                    "FSUPPLIERTYPE": "",
                    "FRdPeriod": "",
                    "FRdDate": "",
                    "FRadioGroup": "1",
                    "FEndDate": end_date.isoformat(),
                    "FStartDate": start_date.isoformat(),
                    "FBuyer": {"FNUMBER": ""},
                    "FBuyDeptId": {"FNUMBER": ""},
                    "FEXPENID": {"FNUMBER": ""},
                    "FENDEXPENID": {"FNUMBER": ""},
                    "FCHXEXPENSE": False,
                },
            }
            report_result = call_k3cloud(
                service="get-sys-report-data",
                form_id="HS_PURCHASE",
                data=report_payload,
            )
            report_rows = parse_report_rows(report_result, "HS_PURCHASE")
            if not report_rows:
                break
            for row in report_rows:
                if len(row) != len(REPORT_QUERY_FIELDS):
                    raise LocalSyncError("HS_PURCHASE report field count mismatch")
                bill_date = parse_hs_bill_date(row[0])
                report_period = bill_date.strftime("%Y-%m")
                source_row_number += 1
                rows.append(
                    [
                        f"{scope['acct_org_number']}:{report_period}:{source_row_number}",
                        scope["acct_org_number"],
                        scope["acct_org_name"],
                        report_period,
                        bill_date.year,
                        bill_date.month,
                        *row,
                    ]
                )
            if len(report_rows) < REPORT_PAGE_LIMIT:
                break
            start_row += REPORT_PAGE_LIMIT
    return rows


def parse_hs_bill_date(raw_value: object) -> date:
    normalized = str(raw_value or "").strip()
    if not normalized:
        raise LocalSyncError("HS_PURCHASE row is missing FBillDate")
    for fmt in ("%Y/%m/%d", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(normalized, fmt).date()
        except ValueError:
            continue
    raise LocalSyncError(f"unsupported HS_PURCHASE FBillDate value: {normalized}")


def parse_registry_row(row: dict[str, Any]) -> ObjectDefinition:
    field_keys = row.get("field_keys_json")
    if not isinstance(field_keys, list) or not field_keys:
        raise LocalSyncError(f"invalid field_keys_json for {row.get('object_code')}")
    return ObjectDefinition(
        object_code=str(row.get("object_code") or "").strip(),
        module_name=str(row.get("module_name") or "").strip(),
        form_id=str(row.get("form_id") or "").strip(),
        read_method=str(row.get("read_method") or "").strip(),
        storage_profile=str(row.get("storage_profile") or "").strip(),
        sync_strategy=str(row.get("sync_strategy") or "").strip(),
        field_keys=[str(item) for item in field_keys],
        default_filter_string=str(row.get("default_filter_string") or "").strip(),
        default_order_by=str(row.get("default_order_by") or "").strip(),
    )


def load_object_definitions(access_file: str, requested_object_codes: list[str], command_name: str) -> list[ObjectDefinition]:
    if requested_object_codes:
        object_code_sql = ", ".join("'" + code.replace("'", "''") + "'" for code in requested_object_codes)
        sql = (
            "select object_code, module_name, form_id, read_method, storage_profile, sync_strategy, "
            "default_filter_string, field_keys_json, default_order_by "
            "from sync_object_registry "
            f"where object_code in ({object_code_sql}) "
            "order by object_code"
        )
    else:
        module_sql = ", ".join("'" + item + "'" for item in sorted(PURCHASE_MODULE_NAMES))
        sql = (
            "select object_code, module_name, form_id, read_method, storage_profile, sync_strategy, "
            "default_filter_string, field_keys_json, default_order_by "
            "from sync_object_registry "
            f"where module_name in ({module_sql}) "
            "order by object_code"
        )
        if command_name == "sync-object":
            raise LocalSyncError("sync-object requires explicit object-code selection")
    result = run_local_query(access_file, sql, max_rows=500)
    rows = result.get("rows")
    if not isinstance(rows, list):
        raise LocalSyncError("invalid registry query result")
    definitions = [parse_registry_row(row) for row in rows if isinstance(row, dict)]
    if requested_object_codes:
        found_codes = {item.object_code for item in definitions}
        missing = [code for code in requested_object_codes if code not in found_codes]
        if missing:
            raise LocalSyncError(f"object definitions not found: {', '.join(missing)}")
    return definitions


def should_sync_definition(definition: ObjectDefinition) -> bool:
    if definition.storage_profile not in {"document_json_v1", "generic_rows_v1"}:
        return False
    if definition.sync_strategy != "full_replace":
        return False
    if definition.read_method == "bill_query" and definition.storage_profile == "document_json_v1":
        return True
    if definition.read_method == "report_query" and definition.storage_profile == "generic_rows_v1":
        return True
    return False


def build_bill_query_filter(definition: ObjectDefinition, start_date: date, today: date) -> str:
    if definition.default_filter_string:
        return definition.default_filter_string
    end_date = today + timedelta(days=1)
    if "FDate" in definition.field_keys:
        return f"FDate>='{start_date.isoformat()}' and FDate<'{end_date.isoformat()}'"
    if "FBillDate" in definition.field_keys:
        return f"FBillDate>='{start_date.isoformat()}' and FBillDate<'{end_date.isoformat()}'"
    return ""


def fetch_definition_rows(definition: ObjectDefinition, start_date: date, today: date) -> list[list[Any]]:
    if definition.read_method == "report_query" and definition.object_code == "hs_purchase":
        return fetch_hs_purchase_rows(start_date, today)
    if definition.read_method != "bill_query":
        raise LocalSyncError(f"unsupported read_method for local sync: {definition.object_code}:{definition.read_method}")
    return fetch_bill_rows(
        form_id=definition.form_id,
        field_keys=definition.field_keys,
        filter_string=build_bill_query_filter(definition, start_date, today),
        order_by=definition.default_order_by,
    )


def normalize_document_records(definition: ObjectDefinition, rows: list[list[Any]], batch_id: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        if len(row) != len(definition.field_keys):
            raise LocalSyncError(
                f"document row field count mismatch for {definition.object_code}: expected {len(definition.field_keys)}, got {len(row)}"
            )
        source_object_id = str(row[0] or "").strip()
        if not source_object_id:
            raise LocalSyncError(f"document row is missing source object id for {definition.object_code}")
        if len(definition.field_keys) > 1:
            document_json = dict(zip(definition.field_keys, row, strict=True))
            row_key = build_row_key(row)
        else:
            document_json = fetch_view(definition.form_id, source_object_id)
            row_key = source_object_id
        records.append(
            {
                "row_key": row_key,
                "source_row_number": index,
                "source_object_id": source_object_id,
                "document_json": document_json,
                "sync_batch_id": batch_id,
            }
        )
    return records


def normalize_generic_records(definition: ObjectDefinition, rows: list[list[Any]], batch_id: str) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        if len(row) != len(definition.field_keys):
            raise LocalSyncError(
                f"generic row field count mismatch for {definition.object_code}: expected {len(definition.field_keys)}, got {len(row)}"
            )
        records.append(
            {
                "row_key": build_row_key(row),
                "source_row_number": index,
                "row_json": dict(zip(definition.field_keys, row, strict=True)),
                "sync_batch_id": batch_id,
            }
        )
    return records


def normalize_records(definition: ObjectDefinition, rows: list[list[Any]], batch_id: str) -> list[dict[str, Any]]:
    if definition.storage_profile == "document_json_v1":
        return normalize_document_records(definition, rows, batch_id)
    if definition.storage_profile == "generic_rows_v1":
        return normalize_generic_records(definition, rows, batch_id)
    raise LocalSyncError(f"unsupported storage_profile for local sync: {definition.storage_profile}")


def build_sync_plan(definition: ObjectDefinition, records: list[dict[str, Any]], *, batch_id: str, start_date: date, end_date: date) -> dict[str, Any]:
    return {
        "object_code": definition.object_code,
        "storage_profile": definition.storage_profile,
        "records": records,
        "batch_id": batch_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "run_status": "success",
        "run_id": batch_id,
        "started_at": normalize_timestamp(),
        "ended_at": normalize_timestamp(),
        "snapshot_file": f"tenant-local-sync://{definition.object_code}/{batch_id}.json",
    }


def run_definition_sync(access_file: str, definition: ObjectDefinition, default_start: date) -> dict[str, Any]:
    if not should_sync_definition(definition):
        raise LocalSyncError(
            f"unsupported local sync object profile: {definition.object_code} "
            f"({definition.read_method}, {definition.storage_profile}, {definition.sync_strategy})"
        )
    started_at = datetime.now()
    batch_id = started_at.strftime("%Y%m%d%H%M%S") + "_" + uuid4().hex[:8]
    today = date.today()
    rows = fetch_definition_rows(definition, default_start, today)
    records = normalize_records(definition, rows, batch_id)
    ended_at = datetime.now()
    plan = build_sync_plan(
        definition,
        records,
        batch_id=batch_id,
        start_date=default_start,
        end_date=today,
    )
    plan["started_at"] = started_at.isoformat()
    plan["ended_at"] = ended_at.isoformat()
    bridge_response = run_local_exec(access_file, plan)
    return {
        "object_code": definition.object_code,
        "batch_id": batch_id,
        "row_count": len(records),
        "start_date": default_start.isoformat(),
        "end_date": today.isoformat(),
        "bridge": bridge_response,
    }


def resolve_access_file() -> str:
    value = str(sys.argv[1] if len(sys.argv) > 1 else "").strip()
    if not value:
        raise LocalSyncError("tenant data access file is required")
    return value


def main() -> int:
    access_file = resolve_access_file()
    payload = read_stdin_json()
    cli_args = ensure_supported_payload(payload)
    command_name = cli_args[0]
    default_start = extract_default_start(cli_args)
    requested_object_codes = extract_requested_object_codes(cli_args)
    definitions = load_object_definitions(access_file, requested_object_codes, command_name)
    if not definitions:
        raise LocalSyncError("no local sync object definitions resolved")

    prepare_runtime_profile(access_file)
    results = [run_definition_sync(access_file, definition, default_start) for definition in definitions]

    stdout_json = {
        "status": "ok",
        "mode": "cli",
        "command": command_name,
        "object_count": len(results),
        "total_row_count": sum(int(item["row_count"]) for item in results),
        "results": results,
    }
    response = {
        "mode": "cli",
        "status": "ok",
        "command": [command_name, *cli_args[1:]],
        "stdout_text": json.dumps(stdout_json, ensure_ascii=False),
        "stdout_json": stdout_json,
        "stderr_text": "",
        "project_root": "tenant-local-sync",
    }
    print(json.dumps(response, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except LocalSyncError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
