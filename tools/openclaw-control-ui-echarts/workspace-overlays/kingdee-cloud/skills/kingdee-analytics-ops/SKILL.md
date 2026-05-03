---
name: kingdee-analytics-ops
description: Use when the kingdee-cloud Agent needs to read or write the tenant-bound Kingdee analytics PostgreSQL database, create or alter tables, check sync freshness, call K3Cloud source APIs with the bundled LoginByAppSecret profile, onboard a new Kingdee object from the bundled openapi corpus, or activate tenant-side 5-minute incremental sync after an initial pull.
---

# Kingdee Analytics Ops

## Core Rule

This skill is tenant-aware.

Always prefer the tenant-bound runtime files under `references/`:

- `references/tenant-analytics-connection.json`
- `references/k3cloud-connection-profile.json`

If `tenant-analytics-connection.json` exists, it is the current tenant's source of truth for:

- which PostgreSQL database to read and write
- which host bridge to call
- which tenant the data belongs to
- which data source binding is active

Do not assume the global default `kingdee_analytics` database is correct.

## What This Skill Can Do

Use this skill for six jobs:

1. Query the tenant-bound analytics PostgreSQL database.
2. Create tables, alter tables, insert rows, update rows, or delete rows when the user explicitly asks for database writes.
3. Inspect whether data is fresh and whether 5-minute sync is still running.
4. Call K3Cloud source APIs directly with the bundled App Secret login profile.
5. Add a new Kingdee object by reading the bundled `kingdee-openapi` corpus and then using the host analytics CLI.
6. After a successful initial data pull, activate 5-minute incremental sync for that object on the platform side.

## Runtime Files

- Tenant analytics bridge config: `references/tenant-analytics-connection.json`
- K3Cloud login profile: `references/k3cloud-connection-profile.json`
- Human-readable K3Cloud notes: `references/k3cloud-access-profile.zh-CN.md`
- SQL usage patterns: `references/db-query-patterns.md`
- OpenAPI navigation: `references/openapi-navigation.zh-CN.md`
- Object onboarding SOP: `references/object-onboarding-and-full-sync.zh-CN.md`

## Default Workflow

When the user asks for a business module such as sales, supply chain, purchase, receivables, inventory, or similar:

1. Query the database first.
2. If the required tables or data already exist, answer from the database and do not pull from source again.
3. If the data does not exist, identify the required object or objects from the openapi references.
4. Run the host analytics CLI to initialize schema or pull the needed object.
5. Verify the new tables and rows in PostgreSQL.
6. Activate 5-minute incremental sync for the object.
7. Reply to the user only after database verification is complete.

Do not skip the database-first check.

## Read Database

Use:

```bash
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --tenant-profile --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --sync-status --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --list-tables --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --describe sales_order_current --format table
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --sql "select * from sales_order_current order by bill_date desc limit 20" --format table
```

Use dictionary tables before writing ad hoc SQL:

- `analytics_table_dictionary`
- `analytics_column_dictionary`

Prefer `*_current` tables for business answers.

## Write Database

Use:

```bash
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "create table if not exists demo_table(id bigint primary key, note text)"
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "insert into demo_table(id, note) values (1, 'hello')"
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "update demo_table set note = 'updated' where id = 1"
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --write-sql "drop table if exists demo_table" --allow-destructive
```

Rules:

- Only write when the user explicitly requested add, modify, delete, rebuild, truncate, or create-table behavior.
- Keep one SQL statement at a time.
- Verify with `query_analytics_db.py` after every write.

## Pull Data From Source

Use the host analytics CLI bridge:

```bash
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli init-db
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli sync-object --object-code sales_outstock --default-start 2023-01-01
python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli sync-sales-module --default-start 2023-01-01 --object-code sales_order
```

Use this when:

- the database does not have the requested module yet
- the user asked to rebuild or re-pull all data
- a new object must be onboarded

## Activate 5-Minute Incremental Sync

After the first successful pull of an object, activate incremental sync:

```bash
python3 skills/kingdee-analytics-ops/scripts/activate_sync_schedule.py --object-code sales_order --module-name sales
python3 skills/kingdee-analytics-ops/scripts/activate_sync_schedule.py --object-code pur_purchaseorder --module-name supply_chain
```

This does not replace the initial pull.

The correct sequence is:

1. initial pull
2. verify rows exist
3. activate schedule

## Check Sync Health

Check both database freshness and platform schedule state:

```bash
python3 skills/kingdee-analytics-ops/scripts/query_analytics_db.py --sync-status --format table
```

And, when needed, query the sidecar schedule table through the platform database if the user asks specifically about platform scheduling behavior.

Remember:

- 5-minute sync is platform sidecar behavior
- object incremental pull and cleanup/delete-log style work can be part of the same scheduled cycle, depending on the backend implementation

## Call K3Cloud APIs Directly

Use:

```bash
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --show-profile
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --login-only
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --service execute-bill-query --data-file /tmp/query.json
python3 skills/kingdee-analytics-ops/scripts/k3cloud_api.py --service view --form-id SAL_SaleOrder --data '{"Number":"XSKD000001"}'
```

When the user asks “接口地址”, “登录方式”, “去哪里调用”, or “直接帮我调源接口”, read:

- `references/k3cloud-access-profile.zh-CN.md`
- `references/k3cloud-connection-profile.json`

Do not answer with only object names or only openapi paths. Include the actual base URL and login method when relevant.

## Add A New Kingdee Object

When the user asks to add a new module or object:

1. Read `references/openapi-navigation.zh-CN.md`.
2. Read `references/object-onboarding-and-full-sync.zh-CN.md`.
3. Search the bundled openapi references for the target object.
4. Decide whether the source-side retrieval path should use `ExecuteBillQuery`, `View`, or `GetSysReportData`.
5. Add or adjust the host analytics object definition and registry path.
6. Run `init-db` or `sync-object`.
7. Verify PostgreSQL tables, dictionary rows, cursors, and sample data.
8. Activate 5-minute incremental sync if the object should stay fresh.

## Hard Rules

1. Query first, pull second.
2. Never assume missing business data means connection failure. Check tables first.
3. Never answer “已经同步” unless the database query proves it.
4. Never answer “接口我知道” without including the actual address and login mode if the user asked for source calling details.
5. After any rebuild or full clear, verify schema and row counts before replying.
6. Prefer tenant-bound runtime config over hardcoded global defaults whenever `tenant-analytics-connection.json` exists.
