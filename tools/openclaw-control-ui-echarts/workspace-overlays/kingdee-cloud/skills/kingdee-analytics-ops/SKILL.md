---
name: kingdee-analytics-ops
description: Use when the user needs to inspect or query the deployed Kingdee analytics PostgreSQL data, perform controlled table creation or data mutations, check the 5-minute sync timer/service and cursor freshness, call source K3Cloud WebAPI endpoints with the bundled base URL and App Secret login profile, or continue Kingdee object integration work from `kingdee-openapi` docs, including deciding API type, full-sync execution, object definition changes, registry/storage updates, and validation of tables, dictionaries, cursors, and source responses.
---

# Kingdee Analytics Ops

## Overview

Use this skill for five related jobs in the `kingdee-cloud` OpenClaw runtime:

1. Read-only querying of the deployed Kingdee analytics PostgreSQL database.
2. Controlled DDL and DML against that PostgreSQL database when the user explicitly needs inserts, updates, or table changes.
3. Sync health inspection for the 5-minute timer, service runs, and cursor freshness.
4. Direct source-side K3Cloud WebAPI calls using the bundled connection profile and `LoginByAppSecret` flow.
5. Procedural guidance plus executable host CLI entry points for full-sync execution and onboarding a new Kingdee object from `kingdee-openapi`.

The complete API markdown corpus from `kingdee-openapi.zip` is bundled inside this skill under `references/kingdee-openapi/apis`.

The live source connection profile is bundled in two forms:

- Machine-readable: `references/k3cloud-connection-profile.json`
- Human-readable: `references/k3cloud-access-profile.zh-CN.md`

## Quick Start

1. Prefer `scripts/query_analytics_db.py` for all database reads.
2. Use `scripts/manage_analytics_db.py --write-sql ...` when the user explicitly asks to insert, update, alter, create, or drop a table.
3. Use `scripts/manage_analytics_db.py --cli ...` when the user wants to run the host `kingdee_analytics.cli` workflow such as `init-db`, `sync-object`, or `sync-sales-module`.
4. When the user asks “接口地址是什么”, “登录信息是什么”, “去哪里调用”, or “直接帮我调源接口”, read `references/k3cloud-access-profile.zh-CN.md` and use `scripts/k3cloud_api.py`.
5. Start with tenant and freshness checks when the user asks what data is in the database or whether sync is current.
6. Use metadata dictionaries before writing ad hoc SQL:
   - `analytics_table_dictionary`
   - `analytics_column_dictionary`
7. Query `*_current` tables for current facts. Use `*_raw` only for audit or debug work.
8. Use `python3`, not `python`, in the OpenClaw runtime.
9. Read `references/openapi-navigation.zh-CN.md` and `references/object-onboarding-and-full-sync.zh-CN.md` before answering requests about “新增对象”, “拉全量”, “根据 openapi 接模块”, or similar tasks.
10. Keep the host-side SSH key and forced-command entry intact; the runtime cannot access the host PostgreSQL socket or host project directly.

## Runtime Context

- Agent workspace: `/home/root-ai/.openclaw/workspace-agents/kingdee-cloud`
- Runtime workspace inside OpenClaw: `/home/node/.openclaw/workspace-agents/kingdee-cloud`
- Host PostgreSQL DSN: `postgresql:///kingdee_analytics?host=/var/run/postgresql`
- Container SSH key path: `/home/node/.openclaw/ssh/kingdee-db-query-ed25519`
- Host bridge path: `/home/root-ai/.openclaw/workspace-agents/kingdee-cloud/skills/kingdee-analytics-ops/scripts/query_host_db.py`
- Host analytics Python with `psycopg`: `/home/root-ai/apps/kingdee-analytics/.venv/bin/python`
- Host analytics project path: `/home/root-ai/apps/kingdee-analytics`
- Host openapi path: `/home/root-ai/apps/kingdee-openapi`
- Bundled full API corpus path inside this skill: `references/kingdee-openapi/apis`
- Bundled source connection profile: `references/k3cloud-connection-profile.json`
- Source K3Cloud base URL: `http://116.249.36.81:8092/k3cloud/`
- Source login path: `Kingdee.BOS.WebApi.ServicesStub.AuthService.LoginByAppSecret.common.kdsvc`
- Source DBID: `6220b009309f24`
- Source username: `张微波`
- Source App ID: `233760_20eP5zGJ5mnfXeVFW/TP4d0JUgQZ0pss`
- Source App Secret: `007b0c72aea947849ca45b8e00b84be7`
- Source LCID: `2052`
- Source sales org: `100050 / 国潮信息科技（东台）有限公司`

## Workflow

### 1. Query Workflow

- If the question is about data availability or freshness, check `tenant_profile`, `sync_cursor_state`, and optionally `sync_run_log` first.
- If the question is about schema or business meaning, check the dictionary tables first.
- If the question is about service health rather than database contents, use normal shell or `systemctl` checks outside this skill.

### 2. Use The Read Query Helper

Common entry points:

```bash
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --tenant-profile --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --sync-status --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --list-tables --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --describe sales_order_current --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --table-count sales_order_current
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --sql "select bill_date, bill_no, customer_name, material_name, qty, line_amount from sales_order_current order by bill_date desc, bill_no desc limit 20" --format table
```

The container runtime cannot reach `/var/run/postgresql` or `/home/root-ai/apps` directly. The helper therefore SSHes to the host and invokes the host-side bridge with a read-only SQL payload.

Read `references/db-query-patterns.md` when the user wants canned business SQL patterns.

### 3. Use The Controlled Write Helper

When the user explicitly needs to change analytics tables, use the dedicated write helper instead of the read helper.

Common entry points:

```bash
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "create table if not exists agent_demo_write_test(id bigint primary key, note text, updated_at timestamptz default now())"
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "insert into agent_demo_write_test(id, note) values (1, 'hello')"
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "update agent_demo_write_test set note = 'updated' where id = 1"
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "drop table if exists agent_demo_write_test" --allow-destructive
```

Rules:

- Only use this path when the user explicitly asked for a write action.
- Keep write SQL to one statement at a time.
- Prefer idempotent DDL such as `if not exists` or `if exists`.
- For deletes, truncates, or drops, require explicit user intent and pass `--allow-destructive`.
- After a write, verify with `query_analytics_db.py` rather than assuming success.

### 4. Use The Host CLI Bridge

The host `kingdee_analytics` project exists at `/home/root-ai/apps/kingdee-analytics`, but the container cannot execute it directly. Use the bridge helper when the user wants the actual sync engine or schema bootstrap path.

Common entry points:

```bash
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli init-db
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli sync-object --object-code sales_outstock --default-start 2023-01-01
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli sync-sales-module --default-start 2023-01-01
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli sync-sales-module --default-start 2023-01-01 --object-code sales_order --object-code sales_outstock
```

Use this path when:

- the user wants AI to create analytics tables through the engineered `init-db` path
- the user wants a real object sync instead of manual SQL
- the user wants to onboard or rerun a specific Kingdee object using the existing host project

### 5. Source K3Cloud API Workflow

- Read `references/k3cloud-access-profile.zh-CN.md` before answering any question about source API addresses, login data, or raw request shapes.
- Use `scripts/k3cloud_api.py` instead of hand-building login and cookie handling.
- The bundled profile already tells the runtime where to call, how to log in, and which common service stub paths to use.
- Start with `--show-profile` or `--login-only` when validating the source connection.
- Use `--service execute-bill-query` for `ExecuteBillQuery`.
- Use `--service view --form-id ...` for `View`.
- Use `--service get-sys-report-data --form-id ...` for `GetSysReportData`.
- Use `--path ...` only when the target API is outside the three common dynamic form flows.

Common entry points:

```bash
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --show-profile
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --login-only
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --service execute-bill-query --data-file /tmp/sale-order-query.json
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --service view --form-id SAL_SaleOrder --data '{"Number":"XSKD000001"}'
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --service get-sys-report-data --form-id SAL_SaleOrderRpt --data-file /tmp/report-request.json
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --path Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.Save.common.kdsvc --data-file /tmp/save-payload.json
```

If the user explicitly asks for manual HTTP examples, use the raw request templates in `references/k3cloud-access-profile.zh-CN.md`.

### 6. Sync Health Workflow

- Check `kingdee-analytics-sync.timer` and `kingdee-analytics-sync.service` on the host when the user asks whether the 5-minute sync is healthy.
- Correlate timer state, service result, `sync_cursor_state`, and `sync_run_log` before concluding the sync is fresh or stale.
- Treat `service inactive after run` as normal for this `oneshot` service.
- Remember that incremental object sync and delete-log sync run in the same scheduled cycle.

### 7. Object Onboarding And Full-Sync Workflow

- Read `references/openapi-navigation.zh-CN.md` first, then read `references/object-onboarding-and-full-sync.zh-CN.md`.
- Use `references/k3cloud-access-profile.zh-CN.md` when you need to confirm source endpoint, login mode, or raw source-side request examples while implementing a new object.
- The bundled corpus is large. Do not bulk-read it. Search the relevant module subtree and open only the markdown files needed for the target object.
- For supply-chain sales objects, start from the subtree displayed as `供应链` then `销售管理`. If literal Chinese path matching fails in the runtime, list directories under `references/kingdee-openapi/apis` first and then search by `formId`, object name, or `operation`.
- If the object is already registered in `kingdee_analytics/registry.py` and has an object file, prefer the host CLI bridge with `init-db`, `sync-sales-module`, or `sync-object`.
- If the object is not registered, use the reference to:
  - inspect `kingdee-openapi` front matter
  - choose `ExecuteBillQuery`, `GetSysReportData`, or `View`
  - define fields, ordering, sync strategy, primary key, modify time, and delete basis
  - add object definition, registry entry, and storage dictionary support
  - validate row counts, dictionary tables, and sync cursors

### 8. Interpretation Rules

- `tenant_profile` tells you which tenant and sales org the database represents.
- `analytics_table_dictionary` tells you which tables and views are meant for analysis.
- `analytics_column_dictionary` tells you column meaning and recommended query keys.
- `*_current` tables are the primary source for current business facts.
- `*_raw` tables are for audit, replay, and low-level debug.
- `sync_cursor_state` shows whether incremental sync is moving.
- `sync_run_log` is useful when you need run history and error details.
- The source-side login mode in this deployment is `LoginByAppSecret`, not password-based `ValidateUser`.

## References

- For source access, login payloads, service stub paths, and manual HTTP examples, read `references/k3cloud-access-profile.zh-CN.md`.
- For machine-readable source connection data, read `references/k3cloud-connection-profile.json`.
- For canned SQL patterns, read `references/db-query-patterns.md`.
- For locating and searching the bundled full API corpus, read `references/openapi-navigation.zh-CN.md`.
- For full sync and new-object integration SOP, read `references/object-onboarding-and-full-sync.zh-CN.md`.
- The full vendored API corpus is under `references/kingdee-openapi/apis`.
