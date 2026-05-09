#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path

from _bridge_client import (
    DEFAULT_DB_DSN,
    DEFAULT_HOST,
    DEFAULT_SSH_KEY,
    DEFAULT_TIMEOUT,
    DEFAULT_USER,
    run_bridge_request,
)


DEFAULT_PROJECT_ROOT = "/home/root-ai/apps/kingdee-analytics"
DEFAULT_CATALOG_ROOT = "/home/root-ai/apps/kingdee-openapi/references/apis/供应链/销售管理"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Perform controlled writes or sync CLI operations against the deployed Kingdee analytics runtime.",
    )
    parser.add_argument("--host", default=os.environ.get("KINGDEE_DB_SSH_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("KINGDEE_DB_SSH_USER", DEFAULT_USER))
    parser.add_argument("--db-dsn", default=os.environ.get("KINGDEE_DB_PG_DSN", DEFAULT_DB_DSN))
    parser.add_argument("--ssh-key", default=os.environ.get("KINGDEE_DB_SSH_KEY", DEFAULT_SSH_KEY))
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument(
        "--format",
        choices=("pretty-json", "json", "text"),
        default="pretty-json",
    )

    operation = parser.add_mutually_exclusive_group(required=True)
    operation.add_argument("--write-sql")
    operation.add_argument("--write-sql-file")
    operation.add_argument(
        "--cli",
        choices=("init-db", "sync-object", "sync-sales-module", "sync-supply-chain"),
    )

    parser.add_argument("--allow-destructive", action="store_true")
    parser.add_argument("--project-root", default=DEFAULT_PROJECT_ROOT)
    parser.add_argument("--catalog-root", default=DEFAULT_CATALOG_ROOT)
    parser.add_argument("--default-start", default="2023-01-01")
    parser.add_argument(
        "--object-code",
        dest="object_codes",
        action="append",
        default=None,
        help="repeatable object-code selector for sync-object, sync-sales-module, or sync-supply-chain",
    )
    return parser


def normalize_write_sql(sql: str) -> str:
    text = sql.strip()
    if not text:
        raise ValueError("sql is empty")
    if ";" in text.rstrip(";"):
        raise ValueError("multiple SQL statements are not allowed")
    return text.rstrip(";")


def read_write_sql(args: argparse.Namespace) -> str | None:
    if args.write_sql:
        return normalize_write_sql(args.write_sql)
    if args.write_sql_file:
        return normalize_write_sql(Path(args.write_sql_file).read_text(encoding="utf-8"))
    return None


def build_cli_args(args: argparse.Namespace) -> list[str]:
    cli_command = args.cli
    if cli_command == "init-db":
        return ["init-db"]
    if cli_command == "sync-object":
        object_codes = args.object_codes or []
        if len(object_codes) != 1:
            raise ValueError("--object-code is required for --cli sync-object")
        return ["sync-object", object_codes[0], "--default-start", args.default_start]
    if cli_command in {"sync-sales-module", "sync-supply-chain"}:
        cli_args = [cli_command, "--default-start", args.default_start]
        for object_code in args.object_codes or []:
            cli_args.extend(["--object-code", object_code])
        if args.catalog_root:
            cli_args.extend(["--catalog-root", args.catalog_root])
        return cli_args
    raise ValueError(f"unsupported cli command: {cli_command}")


def emit_output(payload: dict[str, object], output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(payload, ensure_ascii=False))
        return
    if output_format == "pretty-json":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    stdout_text = payload.get("stdout_text")
    if isinstance(stdout_text, str) and stdout_text.strip():
        print(stdout_text.strip())
        return
    print(json.dumps(payload, ensure_ascii=False, indent=2))


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.cli:
        payload = {
            "mode": "cli",
            "cli_args": build_cli_args(args),
            "project_root": args.project_root,
        }
    else:
        sql = read_write_sql(args)
        payload = {
            "mode": "write_sql",
            "sql_b64": base64.b64encode(str(sql).encode("utf-8")).decode("ascii"),
            "dsn": args.db_dsn,
            "allow_destructive": args.allow_destructive,
        }

    try:
        response = run_bridge_request(
            host=args.host,
            user=args.user,
            ssh_key=args.ssh_key,
            payload=payload,
            timeout=args.timeout,
        )
    except Exception as exc:
        print(f"manage operation failed: {exc}", file=sys.stderr)
        return 1

    emit_output(response, args.format)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
