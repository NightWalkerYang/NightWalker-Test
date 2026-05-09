---
name: kingdee-analytics-ops
description: Use when the user needs to inspect or query tenant-bound Kingdee analytics PostgreSQL data, run controlled local full-sync execution for registered purchase or supply-chain objects, perform controlled table writes, or call K3Cloud source APIs through the bundled LoginByAppSecret profile.
---

# Kingdee Analytics Ops

## Quick Start

1. Prefer `scripts/query_analytics_db.py` for read queries.
2. Use `scripts/manage_analytics_db.py --write-sql ...` only when the user explicitly asks to write analytics tables.
3. For derived tenant member workspaces with `tenant-data-access.json`, `scripts/manage_analytics_db.py --cli ...` now has a 本地 fallback and should prefer the bound tenant data source over the old SSH host bridge.
4. For procurement or supplier collaboration full sync, prefer:
   - `python3 skills/kingdee-analytics-ops/scripts/manage_analytics_db.py --cli sync-supply-chain --default-start 2023-01-01 --object-code pur_purchaseorder`
   - If the existing workflow still emits `sync-sales-module` together with采购/协同 object codes, keep running it; the local fallback will normalize that legacy call shape.
5. Use `scripts/k3cloud_api.py` for direct source-side `ExecuteBillQuery`, `View`, and `GetSysReportData`.

## Local Fallback Rules

- When `_bridge_client.py` detects a derived tenant workspace and a readable `tenant-data-access.json`, read-only SQL and controlled write SQL use the bound tenant PostgreSQL connection directly.
- For `--cli` local full sync, the runtime now prefers `scripts/local_sync_engine.py` instead of requiring `/home/node/.openclaw/ssh/kingdee-db-query-ed25519`.
- The local sync path is intentionally narrow: it currently supports the real procurement/supplier object shapes already present in `sync_object_registry`, especially:
  - `bill_query + document_json_v1 + full_replace`
  - `report_query + generic_rows_v1 + full_replace` (`hs_purchase`)
- If an object falls outside these shapes, stop and surface the actual unsupported profile instead of silently degrading to a fake success.

## Runtime Context

- Tenant-bound runtime access file: `.../agents/<derivedAgentId>/agent/tenant-data-access.json`
- Local PG bridge helper: `scripts/tenant_local_pg_bridge.mjs`
- Local procurement full-sync engine: `scripts/local_sync_engine.py`
- Source profile: `references/k3cloud-connection-profile.json`

## Validation

- After a local sync run, verify at least one of:
  - `sync_run_log`
  - `sync_state`
  - `object_publish_state`
  - target `*_current` table row count or latest `sync_batch_id`
- Do not treat “page opened” as success. The sync must actually write the tenant-bound analytics database.
