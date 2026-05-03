#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REFERENCES_DIR = SCRIPT_DIR.parent / "references"
DEFAULT_PROFILE_PATH = REFERENCES_DIR / "tenant-analytics-connection.json"


def load_profile() -> dict[str, object]:
    if not DEFAULT_PROFILE_PATH.exists():
        return {}
    try:
        payload = json.loads(DEFAULT_PROFILE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Register or refresh a tenant-side 5-minute incremental sync schedule.",
    )
    parser.add_argument("--object-code", required=True)
    parser.add_argument("--module-name", default="sales")
    parser.add_argument("--interval-minutes", type=int, default=5)
    parser.add_argument("--default-start", default="2023-01-01")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    profile = load_profile()
    tenant_id = str(profile.get("tenantId") or "").strip()
    data_source_id = str(profile.get("dataSourceId") or "").strip()
    tenant_platform_db_path = str(
        profile.get("tenantPlatformDbPath")
        or os.environ.get("OPENCLAW_TENANT_PLATFORM_DB_PATH")
        or "/home/root-ai/.openclaw/tenant-platform/tenant-platform.sqlite"
    ).strip()
    bridge_host = str(profile.get("bridgeHost") or os.environ.get("KINGDEE_DB_SSH_HOST") or "10.20.30.31").strip()
    bridge_user = str(profile.get("bridgeUser") or os.environ.get("KINGDEE_DB_SSH_USER") or "root-ai").strip()
    ssh_key = str(profile.get("sshKeyPath") or os.environ.get("KINGDEE_DB_SSH_KEY") or "/home/node/.openclaw/ssh/kingdee-db-query-ed25519").strip()
    timeout = int(profile.get("timeoutSeconds") or os.environ.get("KINGDEE_DB_TIMEOUT") or 120)
    workspace_dir = str(SCRIPT_DIR.parent.parent.parent).strip()

    if not tenant_id or not data_source_id:
      print("tenant-analytics-connection.json 缺少 tenantId 或 dataSourceId", file=sys.stderr)
      return 1

    sql = (
        "insert into tenant_sync_schedules "
        "(id, tenant_id, data_source_id, object_code, module_name, derived_workspace_dir, status, interval_minutes, default_start, activated_by_user_id, created_at, updated_at) "
        "values "
        f"('sync_sched_' || replace(lower(hex(randomblob(16))), '-', ''), '{tenant_id}', '{data_source_id}', '{args.object_code}', '{args.module_name}', '{workspace_dir}', 'active', {max(1, args.interval_minutes)}, '{args.default_start}', null, datetime('now'), datetime('now')) "
        "on conflict(tenant_id, data_source_id, object_code) do update set "
        f"module_name=excluded.module_name, derived_workspace_dir=excluded.derived_workspace_dir, status='active', interval_minutes={max(1, args.interval_minutes)}, default_start='{args.default_start}', updated_at=datetime('now')"
    )

    payload = {
        "mode": "tenant_platform_sqlite_write",
        "sql_b64": base64.b64encode(sql.encode("utf-8")).decode("ascii"),
        "db_path": tenant_platform_db_path,
        "allow_destructive": False,
    }

    command = [
        "ssh",
        "-i",
        ssh_key,
        "-T",
        "-o",
        "BatchMode=yes",
        "-o",
        "IdentitiesOnly=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=10",
        f"{bridge_user}@{bridge_host}",
        "python3 /home/root-ai/.openclaw/workspace-agents/kingdee-cloud/skills/kingdee-analytics-ops/scripts/query_host_db.py --stdin-json",
    ]
    result = subprocess.run(
        command,
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or result.stdout.strip() or "activate sync schedule failed", file=sys.stderr)
        return 1
    print(result.stdout.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
