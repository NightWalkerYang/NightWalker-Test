#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
from pathlib import Path

import psycopg


SAFE_QUERY_SQL_START = ("select", "with", "explain")
SAFE_WRITE_SQL_START = ("insert", "update", "delete", "create", "alter", "drop")
DESTRUCTIVE_SQL_START = ("delete", "drop")
DISALLOWED_SCHEMA_TOKENS = (
    "information_schema.",
    "pg_catalog.",
    "pg_toast.",
    "pg_temp.",
    "pg_toast_temp.",
)
DEFAULT_PROJECT_ROOT = Path("/home/root-ai/apps/kingdee-analytics")
ALLOWED_CLI_COMMANDS = {"init-db", "sync-object", "sync-sales-module"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Host-side bridge for read queries, controlled writes, and host CLI actions.",
    )
    parser.add_argument("--stdin-json", action="store_true")
    parser.add_argument("sql_b64", nargs="?")
    parser.add_argument("--dsn")
    parser.add_argument("--max-rows", type=int, default=2000)
    return parser.parse_args()


def normalize_single_statement(sql: str) -> str:
    text = sql.strip()
    if not text:
        raise ValueError("sql is empty")
    if ";" in text.rstrip(";"):
        raise ValueError("multiple SQL statements are not allowed")
    return text.rstrip(";")


def decode_sql(sql_b64: str) -> str:
    return base64.b64decode(sql_b64.encode("ascii")).decode("utf-8")


def load_request(args: argparse.Namespace) -> dict[str, object]:
    if args.stdin_json:
        payload = json.load(sys.stdin)
        if not isinstance(payload, dict):
            raise ValueError("stdin payload must be a JSON object")
        payload.setdefault("mode", "query")
        payload.setdefault("max_rows", 2000)
        return payload
    if not args.sql_b64 or not args.dsn:
        raise ValueError("pass --stdin-json or provide sql_b64 and --dsn")
    return {
        "mode": "query",
        "sql_b64": args.sql_b64,
        "dsn": args.dsn,
        "max_rows": args.max_rows,
    }


def ensure_no_system_schema(sql: str) -> None:
    lowered = sql.lower()
    for token in DISALLOWED_SCHEMA_TOKENS:
        if token in lowered:
            raise ValueError(f"writes against system schema are not allowed: {token}")


def normalize_query_sql(sql: str) -> str:
    text = normalize_single_statement(sql)
    if not text.lstrip().lower().startswith(SAFE_QUERY_SQL_START):
        raise ValueError("only read-only select/with/explain queries are allowed")
    return text


def normalize_write_sql(sql: str, *, allow_destructive: bool) -> str:
    text = normalize_single_statement(sql)
    lowered = text.lstrip().lower()
    if not lowered.startswith(SAFE_WRITE_SQL_START):
        raise ValueError("only insert/update/delete/create/alter/drop statements are allowed")
    ensure_no_system_schema(text)
    if lowered.startswith(DESTRUCTIVE_SQL_START) and not allow_destructive:
        raise ValueError("delete/drop requires allow_destructive=true")
    return text


def run_query(sql_b64: str, dsn: str, max_rows: int) -> dict[str, object]:
    sql = normalize_query_sql(decode_sql(sql_b64))

    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute("SET default_transaction_read_only = on")
        conn.execute("SET statement_timeout = '120s'")
        with conn.cursor() as cur:
            cur.execute(sql)
            if cur.description is None:
                return {"columns": [], "rows": [], "row_count": 0, "truncated": False}

            columns = [item.name for item in cur.description]
            rows: list[dict[str, object]] = []
            truncated = False
            while True:
                batch = cur.fetchmany(200)
                if not batch:
                    break
                for row in batch:
                    rows.append(dict(zip(columns, row)))
                    if len(rows) >= max_rows:
                        truncated = True
                        break
                if truncated:
                    break

    return {
        "mode": "query",
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
    }


def run_write_sql(sql_b64: str, dsn: str, *, allow_destructive: bool) -> dict[str, object]:
    sql = normalize_write_sql(decode_sql(sql_b64), allow_destructive=allow_destructive)

    with psycopg.connect(dsn, autocommit=True) as conn:
        conn.execute("SET default_transaction_read_only = off")
        conn.execute("SET statement_timeout = '120s'")
        conn.execute("SET lock_timeout = '15s'")
        with conn.cursor() as cur:
            cur.execute(sql)
            status_message = cur.statusmessage
            rowcount = cur.rowcount
        raw_notices = getattr(conn, "notices", ())
        notices = [str(notice).strip() for notice in raw_notices]

    return {
        "mode": "write_sql",
        "status": "ok",
        "status_message": status_message,
        "row_count": rowcount,
        "notices": [notice for notice in notices if notice],
    }


def build_cli_command(payload: dict[str, object]) -> tuple[list[str], Path]:
    cli_args = payload.get("cli_args")
    if not isinstance(cli_args, list) or not cli_args:
        raise ValueError("cli_args must be a non-empty list")
    if any(not isinstance(item, str) or not item.strip() for item in cli_args):
        raise ValueError("cli_args entries must be non-empty strings")

    cli_command = cli_args[0]
    if cli_command not in ALLOWED_CLI_COMMANDS:
        raise ValueError(f"unsupported cli command: {cli_command}")

    project_root = Path(str(payload.get("project_root") or DEFAULT_PROJECT_ROOT))
    if not project_root.exists():
        raise ValueError(f"project root does not exist: {project_root}")

    command = [
        sys.executable,
        "-m",
        "kingdee_analytics.cli",
        "--project-root",
        str(project_root),
        *cli_args,
    ]
    return command, project_root


def run_cli(payload: dict[str, object]) -> dict[str, object]:
    command, project_root = build_cli_command(payload)
    result = subprocess.run(
        command,
        cwd=project_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    stdout_text = result.stdout.strip()
    stderr_text = result.stderr.strip()
    parsed_stdout: object | None = None
    if stdout_text:
        try:
            parsed_stdout = json.loads(stdout_text)
        except json.JSONDecodeError:
            parsed_stdout = None
    if result.returncode != 0:
        raise RuntimeError(
            stderr_text or stdout_text or f"host cli failed with exit code {result.returncode}"
        )
    return {
        "mode": "cli",
        "status": "ok",
        "command": command,
        "stdout_text": stdout_text,
        "stdout_json": parsed_stdout,
        "stderr_text": stderr_text,
        "project_root": str(project_root),
    }


def main() -> int:
    args = parse_args()
    try:
        payload = load_request(args)
        mode = str(payload.get("mode") or "query")
        if mode == "query":
            response = run_query(
                str(payload["sql_b64"]),
                str(payload["dsn"]),
                int(payload.get("max_rows", 2000)),
            )
        elif mode == "write_sql":
            response = run_write_sql(
                str(payload["sql_b64"]),
                str(payload["dsn"]),
                allow_destructive=bool(payload.get("allow_destructive")),
            )
        elif mode == "cli":
            response = run_cli(payload)
        else:
            raise ValueError(f"unsupported bridge mode: {mode}")
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1

    print(json.dumps(response, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
