#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import sys
import textwrap
from pathlib import Path

from _bridge_client import (
    DEFAULT_DB_DSN,
    DEFAULT_HOST,
    DEFAULT_SSH_KEY,
    DEFAULT_TIMEOUT,
    DEFAULT_USER,
    run_bridge_request,
)


DEFAULT_MAX_ROWS = 2000
SAFE_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Query the deployed Kingdee analytics PostgreSQL database from the kingdee-cloud OpenClaw runtime.",
    )
    parser.add_argument("--host", default=os.environ.get("KINGDEE_DB_SSH_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("KINGDEE_DB_SSH_USER", DEFAULT_USER))
    parser.add_argument("--db-dsn", default=os.environ.get("KINGDEE_DB_PG_DSN", DEFAULT_DB_DSN))
    parser.add_argument("--ssh-key", default=os.environ.get("KINGDEE_DB_SSH_KEY", DEFAULT_SSH_KEY))
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    parser.add_argument("--max-rows", type=int, default=DEFAULT_MAX_ROWS)
    parser.add_argument(
        "--format",
        choices=("pretty-json", "json", "table", "csv"),
        default="pretty-json",
    )
    parser.add_argument("--sql")
    parser.add_argument("--sql-file")
    parser.add_argument("--list-tables", action="store_true")
    parser.add_argument("--describe")
    parser.add_argument("--table-count")
    parser.add_argument("--tenant-profile", action="store_true")
    parser.add_argument("--sync-status", action="store_true")
    return parser


def quote_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def validate_identifier(name: str) -> str:
    if not SAFE_IDENTIFIER.fullmatch(name):
        raise ValueError(f"unsafe identifier: {name!r}")
    return name


def read_sql_from_args(args: argparse.Namespace) -> str:
    options = [
        bool(args.sql),
        bool(args.sql_file),
        args.list_tables,
        bool(args.describe),
        bool(args.table_count),
        args.tenant_profile,
        args.sync_status,
    ]
    if sum(bool(item) for item in options) != 1:
        raise ValueError(
            "choose exactly one of --sql, --sql-file, --list-tables, --describe, "
            "--table-count, --tenant-profile, or --sync-status",
        )

    if args.sql:
        return args.sql
    if args.sql_file:
        return Path(args.sql_file).read_text(encoding="utf-8")
    if args.list_tables:
        return textwrap.dedent(
            """
            select
              relation_name,
              relation_kind,
              object_code,
              storage_role,
              business_grain,
              description
            from analytics_table_dictionary
            order by relation_name
            """
        ).strip()
    if args.describe:
        table_name = quote_literal(args.describe)
        return textwrap.dedent(
            f"""
            select
              column_name,
              logical_name,
              business_type,
              source_field_key,
              is_query_key,
              description,
              query_guidance
            from analytics_column_dictionary
            where relation_name = {table_name}
            order by column_name
            """
        ).strip()
    if args.table_count:
        table_name = validate_identifier(args.table_count)
        return f"select count(*) as row_count from {table_name}"
    if args.tenant_profile:
        return textwrap.dedent(
            """
            select
              tenant_code,
              source_dbid,
              base_url,
              sale_org_id,
              sale_org_number,
              sale_org_name,
              updated_at
            from tenant_profile
            order by updated_at desc
            """
        ).strip()
    return textwrap.dedent(
        """
        select
          source_name,
          cursor_name,
          cursor_value,
          last_batch_id,
          updated_at
        from sync_cursor_state
        order by updated_at desc
        """
    ).strip()


def normalize_sql(sql: str) -> str:
    text = sql.strip()
    if not text:
        raise ValueError("sql is empty")
    if ";" in text.rstrip(";"):
        raise ValueError("multiple SQL statements are not allowed")

    lowered = text.lstrip().lower()
    if not lowered.startswith(("select", "with", "explain")):
        raise ValueError("only read-only select/with/explain queries are allowed")
    return text.rstrip(";")


def format_table(columns: list[str], rows: list[dict[str, object]]) -> str:
    if not columns:
        return "(no columns)"
    if not rows:
        return "(0 rows)"

    rendered_rows = [
        ["" if row.get(column) is None else str(row.get(column)) for column in columns]
        for row in rows
    ]
    widths = [len(column) for column in columns]
    for rendered in rendered_rows:
        for index, value in enumerate(rendered):
            widths[index] = min(max(widths[index], len(value)), 80)

    def clip(value: str, width: int) -> str:
        if len(value) <= width:
            return value
        return value[: width - 3] + "..."

    header = " | ".join(
        clip(column, widths[index]).ljust(widths[index]) for index, column in enumerate(columns)
    )
    divider = "-+-".join("-" * width for width in widths)
    lines = [header, divider]
    for rendered in rendered_rows:
        lines.append(
            " | ".join(
                clip(value, widths[index]).ljust(widths[index])
                for index, value in enumerate(rendered)
            )
        )
    return "\n".join(lines)


def emit_output(payload: dict[str, object], output_format: str) -> None:
    columns = payload.get("columns", [])
    rows = payload.get("rows", [])

    if output_format == "json":
        print(json.dumps(payload, ensure_ascii=False))
        return
    if output_format == "pretty-json":
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    if output_format == "csv":
        writer = csv.DictWriter(sys.stdout, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
        return

    print(format_table(columns, rows))
    if payload.get("truncated"):
        print(f"\n[truncated after {payload.get('row_count')} rows]")


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    sql = normalize_sql(read_sql_from_args(args))
    payload = {
        "mode": "query",
        "sql_b64": base64.b64encode(sql.encode("utf-8")).decode("ascii"),
        "dsn": args.db_dsn,
        "max_rows": args.max_rows,
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
        print(f"query failed: {exc}", file=sys.stderr)
        return 1

    emit_output(response, args.format)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
