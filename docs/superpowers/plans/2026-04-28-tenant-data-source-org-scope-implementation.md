# Tenant Data Source And Org Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tenant-level data-source binding and tenant-member org visibility controls to OpenClaw, while enriching `kingdee-analytics` with stable organization identifiers and an org directory contract that OpenClaw can consume.

**Architecture:** Keep authority split across the two codebases. `kingdee-analytics` remains the business-source layer and exposes `org_directory_current` plus stable sales/org identifiers. OpenClaw remains the authorization layer and stores platform data sources, tenant bindings, member scope mode (`none/custom/all`), and org selections in the tenant-platform SQLite database, then resolves the effective access context server-side.

**Tech Stack:** Node.js ESM, `node:sqlite`, tenant-platform sidecar routes, browser-side vanilla JS UI, Vitest, Python 3, PostgreSQL, `kingdee-analytics` object/storage pipeline

---

## File Structure

### OpenClaw files that will change

- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
- Create: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/data-source-client.mjs`
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.css`
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- Modify: `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

### OpenClaw dependency files

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

### `kingdee-analytics` files that will change

- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/base_master_data.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/sales_order.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/sales_outstock.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/sales_delivery_notice.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/storage/postgres_ddl_builder.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/storage/postgres_metadata.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/storage/postgres_store.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_registry.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_sales_order_object.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_sales_outstock_object.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_sales_delivery_notice_object.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_postgres_schema_sql.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_postgres_store.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_client.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_incremental_engine.py`
- Modify: `E:/AI/kingdee-analytics/README.md`
- Modify: `E:/AI/kingdee-analytics/docs/architecture-and-extension.zh-CN.md`

### Runtime assumptions to preserve

- OpenClaw tenant data stays in tenant-platform SQLite.
- Business data keeps living in `kingdee_analytics`; no `tenant_id` backfill into `*_current`.
- Tenant binding is one-to-one.
- Member org scope must support `none`, `custom`, and `all`.
- `platform_admin` owns data-source binding; `tenant_admin` owns member org scope; `member` has no config rights.

### Phase 0 facts already confirmed

- Business PostgreSQL database is `kingdee_analytics`, not `postgres`.
- LLM credentials exist and can be supplied through env/runtime config.
- Existing `*_current` business tables do not carry `tenant_id`.
- Existing OpenClaw workspace base is `OPENCLAW_WORKSPACE_DIR`.
- Current sales object definitions fetch `FSaleOrgId.FName` but not `FSaleOrgId`.

---

### Task 1: Add OpenClaw persistence for data sources, tenant bindings, and member scope modes

**Files:**
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/migrations/001_init.sql`
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/db.mjs`
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`

- [ ] **Step 1: Write failing SQLite persistence tests**

Add targeted cases to `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts` for:

- creating and listing `data_sources`
- enforcing one active `tenant_data_source_bindings` row per tenant
- storing `tenant_member_source_policies.scope_mode`
- storing custom org rows in `tenant_member_org_scopes`
- clearing custom scopes and resetting `scope_mode` to `none` when the tenant binding changes
- exposing `dataSourceId`, `dataSourceName`, `dataSourceType` on tenant summaries and `orgScopeMode`, `orgScopeCount` on tenant member rows

Use the same in-memory db bootstrap style already used in that file.

- [ ] **Step 2: Run the focused failing test**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "data source"
```

Expected: FAIL because the new tables, helpers, and row-shape fields do not exist yet.

- [ ] **Step 3: Implement the schema and db helpers**

Extend `001_init.sql` for fresh installs and `ensureSchemaCompatibility()` in `db.mjs` for existing databases.

Add these tables:

```sql
CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  connection_json TEXT NOT NULL,
  source_dbid TEXT,
  source_tenant_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tenant_data_source_bindings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  data_source_id TEXT NOT NULL,
  bound_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (data_source_id) REFERENCES data_sources(id) ON DELETE CASCADE,
  FOREIGN KEY (bound_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_member_source_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data_source_id TEXT NOT NULL,
  scope_mode TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id, data_source_id)
);

CREATE TABLE IF NOT EXISTS tenant_member_org_scopes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data_source_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  org_name_snapshot TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, user_id, data_source_id, org_id)
);
```

Add db helpers in `db.mjs` with these signatures:

```javascript
export function listDataSources(db) {}
export function upsertDataSource(db, params) {}
export function getTenantDataSourceBinding(db, tenantId) {}
export function setTenantDataSourceBinding(db, params) {}
export function getTenantMemberOrgScope(db, params) {}
export function setTenantMemberOrgScope(db, params) {}
export function resolveMemberDataAccessContext(db, params) {}
```

Rules to encode:

- `scope_mode` must be one of `none`, `custom`, `all`
- `custom` stores org rows; `all` and `none` clear org rows
- rebinding a tenant to a different data source clears `tenant_member_org_scopes` for that tenant and resets all member policies to `none`
- `listTenants()` joins current binding summary
- `listTenantMembers()` joins current binding-aware scope summary

- [ ] **Step 4: Re-run the focused test and the broader tenant-platform suite**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts
```

Expected: PASS for the new persistence coverage and no regressions in existing tenant-platform tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "Tenant: add data source and org scope persistence"
```

---

### Task 2: Add sidecar service-layer routes and source-db org lookup

**Files:**
- Create: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/data-source-client.mjs`
- Modify: `tools/openclaw-control-ui-echarts/sidecar/tenant-platform/routes.mjs`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/api-client.js`
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing route tests**

Add route-level coverage for:

- `GET /platform/data-sources`
- `POST /platform/data-sources`
- `PUT /platform/data-sources`
- `GET /platform/tenant-data-source-binding`
- `POST /platform/tenant-data-source-binding`
- `GET /tenant/admin/data-source-binding`
- `GET /tenant/admin/orgs`
- `GET /tenant/admin/member-org-scope`
- `POST /tenant/admin/member-org-scope`

Also add negative tests for:

- `tenant_data_source_unbound`
- `member_not_found`
- forbidden access by the wrong role
- empty custom scope save

- [ ] **Step 2: Run the targeted failing test**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts -t "org scope"
```

Expected: FAIL because routes and API client methods are still missing.

- [ ] **Step 3: Add the source-db org reader and wire the routes**

Because `tools/openclaw-control-ui-echarts` has no package-local manifest and the repo currently has no Postgres client dependency, add `pg` to the root `package.json`, then refresh `pnpm-lock.yaml` with `pnpm install`.

Create `data-source-client.mjs` with a narrow surface:

```javascript
import pg from "pg";

export async function listOrganizationsForDataSource(binding) {}
export async function validateOrganizationIds(binding, orgIds) {}
```

Implementation requirements:

- parse `connection_json`
- support only `source_type === "kingdee_analytics"` in v1
- query `org_directory_current`
- return rows shaped as `{ orgId, orgNumber, orgName, parentOrgId, status }`
- throw `org_directory_unavailable` for unsupported source types or query failures

Then extend `routes.mjs` to:

- let `platform_admin` manage data sources and tenant bindings
- let `tenant_admin` read the current binding, load available orgs from the bound source, read member scope, and save member scope
- reuse existing session/role checks
- return canonical error codes from the spec

Extend `runtime/tenant/api-client.js` with:

```javascript
listDataSources()
createDataSource(body)
updateDataSource(body)
getTenantDataSourceBinding(tenantId)
setTenantDataSourceBinding(body)
getCurrentTenantDataSourceBinding()
listTenantOrganizations()
getTenantMemberOrgScope(userId)
setTenantMemberOrgScope(body)
```

- [ ] **Step 4: Run dependency install, then route tests**

```bash
pnpm install
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts
```

Expected: PASS, including positive and negative API coverage.

- [ ] **Step 5: Commit**

```bash
git commit -m "Tenant: add data source routes and org lookup"
```

---

### Task 3: Add platform-admin data source management and tenant binding UI

**Files:**
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/platform-console-page.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.css`
- Modify: `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`

- [ ] **Step 1: Write failing platform surface tests**

Add UI tests for:

- rendering a `数据源` column in the tenant management table
- opening a `绑定数据源` dialog from a tenant row
- showing existing binding info in that dialog
- opening a lightweight `数据源管理` modal or panel from the toolbar
- creating or updating a data source through the new modal
- warning that changing the tenant binding clears member org scopes

- [ ] **Step 2: Run the focused failing test**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/platform-surface.test.ts -t "数据源"
```

Expected: FAIL because the page does not yet render the new column, buttons, or dialogs.

- [ ] **Step 3: Implement the platform UI**

In `platform-console-page.js`:

- extend tenant rows with `dataSourceName || "未绑定"`
- add `绑定数据源` row action
- add a toolbar button `数据源管理`
- implement a compact data-source catalog modal using the same dialog/state pattern already used for tenant creation and agent allocation
- implement a binding dialog with:
  - current tenant name
  - current bound source
  - select of active data sources
  - explicit warning copy about clearing member org permissions on rebinding

In `tenant-surface.css`, add only styles directly needed by the new modal rows, summaries, and warning block. Keep the existing visual language and radius scale.

- [ ] **Step 4: Run the platform surface suite and a build**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/platform-surface.test.ts
pnpm build
```

Expected: PASS, and no build-time regressions from the added runtime UI logic.

- [ ] **Step 5: Commit**

```bash
git commit -m "Tenant: add platform data source management UI"
```

---

### Task 4: Add tenant-admin member org scope UI

**Files:**
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-console-page.js`
- Modify: `tools/openclaw-control-ui-echarts/runtime/tenant/tenant-surface.css`
- Modify: `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

- [ ] **Step 1: Write failing tenant surface tests**

Add coverage for:

- rendering an `组织范围` column in the member table
- summary text for `未绑定数据源`, `未分配`, `全部组织`, and `N 个组织`
- disabling the `选择组织范围` button when the tenant has no bound source
- opening a modal that loads orgs from `/tenant/admin/orgs`
- switching between `none`, `custom`, and `all`
- selecting multiple orgs plus `全选`
- saving a member scope and reflecting the updated summary row

- [ ] **Step 2: Run the focused failing test**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts -t "组织范围"
```

Expected: FAIL because the member table and modal do not yet include org-scope controls.

- [ ] **Step 3: Implement the tenant-admin experience**

In `tenant-console-page.js`:

- extend member rows with:
  - `orgScopeMode`
  - `orgScopeCount`
  - `boundDataSourceName`
- add `组织范围` column and `选择组织范围` button
- implement modal state that loads:
  - current tenant binding
  - current member scope
  - available orgs
- represent scope mode with three explicit options:

```javascript
const ORG_SCOPE_MODES = ["none", "custom", "all"];
```

- show org checkboxes only when `custom`
- include `全选`
- on save, call `setTenantMemberOrgScope()`

Keep the UX conservative:

- no silent defaults
- saving `custom` with zero org rows should be rejected client-side before the request
- member rows must refresh after a successful save

- [ ] **Step 4: Run the tenant surface suite and a build**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
pnpm build
```

Expected: PASS, with the new org-scope UI coexisting cleanly with existing member password, status, delete, and agent-assignment flows.

- [ ] **Step 5: Commit**

```bash
git commit -m "Tenant: add member org scope management UI"
```

---

### Task 5: Enrich `kingdee-analytics` with org IDs, org directory output, and object org registry metadata

**Files:**
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/base_master_data.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/sales_order.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/sales_outstock.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/objects/sales_delivery_notice.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/storage/postgres_ddl_builder.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/storage/postgres_metadata.py`
- Modify: `E:/AI/kingdee-analytics/kingdee_analytics/storage/postgres_store.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_registry.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_sales_order_object.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_sales_outstock_object.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_sales_delivery_notice_object.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_postgres_schema_sql.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_postgres_store.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_client.py`
- Modify: `E:/AI/kingdee-analytics/tests/test_incremental_engine.py`

- [ ] **Step 1: Write failing `kingdee-analytics` tests**

Add assertions for:

- `org_organizations` definition including a stable source org identifier field
- sales object definitions including both `FSaleOrgId` and `FSaleOrgId.FName`
- `sales_line_v1` DDL containing `sale_org_id` and `sale_org_number`
- generated schema including a queryable `org_directory_current`
- metadata docs mentioning the new org columns
- object registry metadata exposing object-to-org-field mappings

- [ ] **Step 2: Run the targeted failing Python tests**

```bash
cd E:/AI/kingdee-analytics
python -m pytest tests/test_registry.py tests/test_sales_order_object.py tests/test_sales_outstock_object.py tests/test_sales_delivery_notice_object.py tests/test_postgres_schema_sql.py tests/test_postgres_store.py tests/test_client.py tests/test_incremental_engine.py -q
```

Expected: FAIL because the source field keys, DDL, and metadata do not yet include org IDs or the org directory relation.

- [ ] **Step 3: Implement the source and storage changes**

Apply these object-definition changes:

- `org_organizations` must include `FID` so the org directory has a stable source ID
- `sales_order`, `sales_outstock`, and `sales_delivery_notice` must include:
  - `FSaleOrgId`
  - `FSaleOrgId.FNumber`
  - `FSaleOrgId.FName`

Update the sales row normalizers to emit:

```python
{
    "sale_org_id": ...,
    "sale_org_number": ...,
    "sale_org_name": ...,
}
```

Update the sales-line DDL and metadata so both `*_raw` and `*_current` carry these columns.

Add two schema-level outputs in the Postgres builder/store layer:

- `org_directory_current`
  - derived from `org_organizations_current.document_json`
  - columns: `org_id`, `org_number`, `org_name`, `parent_org_id`, `status`, `source_dbid`, `updated_at`
- `object_org_scope_registry`
  - one row per business object with its effective org field name
  - at minimum seed rows for the sales objects covered in this task and the existing procurement/inventory/BOM objects used by OpenClaw

- [ ] **Step 4: Re-run the targeted Python tests**

```bash
cd E:/AI/kingdee-analytics
python -m pytest tests/test_registry.py tests/test_sales_order_object.py tests/test_sales_outstock_object.py tests/test_sales_delivery_notice_object.py tests/test_postgres_schema_sql.py tests/test_postgres_store.py tests/test_client.py tests/test_incremental_engine.py -q
```

Expected: PASS for the object definitions, DDL generation, and metadata changes.

- [ ] **Step 5: Commit**

```bash
git commit -m "Kingdee: add org directory and sales org identifiers"
```

---

### Task 6: Update cross-repo docs and run the data refresh verification

**Files:**
- Modify: `E:/AI/kingdee-analytics/README.md`
- Modify: `E:/AI/kingdee-analytics/docs/architecture-and-extension.zh-CN.md`

- [ ] **Step 1: Write failing doc assertions or checklist notes**

If the sibling repo has no doc test for this surface, add a short checklist comment in the plan branch notes and use manual review. The docs must explain:

- `org_directory_current`
- `object_org_scope_registry`
- `sale_org_id` and `sale_org_number`
- why `sale_org_*` are metadata and not tenant authorization boundaries

- [ ] **Step 2: Update the docs**

Document the new contract in both the top-level README and architecture doc so future maintainers can understand:

- what OpenClaw consumes
- what `kingdee-analytics` guarantees
- why `tenant_id` is still absent from business tables

- [ ] **Step 3: Rebuild or validate schema output and perform manual DB verification**

Use env placeholders rather than checked-in secrets:

```bash
cd E:/AI/kingdee-analytics
python -m pytest tests/test_postgres_schema_sql.py tests/test_postgres_store.py -q
psql "$KINGDEE_ANALYTICS_DSN" -c "select org_id, org_number, org_name from org_directory_current order by org_id limit 10;"
psql "$KINGDEE_ANALYTICS_DSN" -c "select count(distinct sale_org_name), count(distinct sale_org_id) from sales_order_current;"
```

Expected:

- schema tests PASS
- `org_directory_current` returns rows
- `sales_order_current` now has non-null `sale_org_id` values after the re-sync

- [ ] **Step 4: Execute the sales re-sync and verify breadth**

Run the existing sync entrypoint for the three sales objects against real credentials, then verify:

```bash
psql "$KINGDEE_ANALYTICS_DSN" -c "select sale_org_id, sale_org_name, count(*) from sales_order_current group by 1,2 order by count(*) desc limit 20;"
```

Expected: not just a single `sale_org_name` bucket, unless the upstream source itself still only exposes one organization.

- [ ] **Step 5: Commit**

```bash
git commit -m "Kingdee: document org scope contract and verify sales resync"
```

---

### Task 7: Run OpenClaw integration verification against the bound source-db contract

**Files:**
- Test: `test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/platform-surface.test.ts`
- Test: `test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts`

- [ ] **Step 1: Run the combined OpenClaw automated gate**

```bash
pnpm test -- test/tools/openclaw-control-ui-echarts/tenant-platform.test.ts test/tools/openclaw-control-ui-echarts/platform-surface.test.ts test/tools/openclaw-control-ui-echarts/tenant-surface.test.ts
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Run a manual tenant flow**

Validate this sequence in a local tenant-platform session:

1. platform admin creates or edits a data source
2. platform admin binds that data source to a tenant
3. tenant admin opens member management
4. tenant admin opens `选择组织范围`
5. orgs load from the bound `kingdee_analytics` source
6. tenant admin saves `none`, `custom`, and `all` in turn
7. the member-row summary updates correctly each time

- [ ] **Step 3: Run a direct API smoke test**

```bash
curl -H "Authorization: Bearer <platform-token>" "http://127.0.0.1:<sidecar-port>/platform/data-sources"
curl -H "Authorization: Bearer <tenant-admin-token>" "http://127.0.0.1:<sidecar-port>/tenant/admin/data-source-binding"
curl -H "Authorization: Bearer <tenant-admin-token>" "http://127.0.0.1:<sidecar-port>/tenant/admin/orgs"
```

Expected:

- platform route returns source rows
- tenant route returns exactly one binding
- org route returns the org directory for that bound source

- [ ] **Step 4: Commit**

```bash
git commit -m "Tenant: verify data source binding and org scope flows"
```

---

## Self-Review

### Spec coverage

- Tenant-level data-source catalog and binding: Task 1, Task 2, Task 3
- Member-level `none/custom/all` org scope: Task 1, Task 2, Task 4
- Server-side access-context resolution: Task 1 and Task 2
- `kingdee-analytics` org directory and sales org enrichment: Task 5 and Task 6
- Documentation for maintainers: Task 6
- End-to-end verification: Task 7

No spec section is left without an owning task.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every task has exact file lists and concrete verification commands.

### Type and naming consistency

- OpenClaw persistence uses `scope_mode` everywhere.
- Transport payloads use `dataSourceId`, `scopeMode`, and `orgIds`.
- `kingdee-analytics` new sales fields are consistently named `sale_org_id`, `sale_org_number`, and `sale_org_name`.

---

## Execution Handoff

User direction is already fixed to **Subagent-Driven**. Execute this plan with `superpowers:subagent-driven-development`, dispatching one fresh subagent per task slice and reviewing after each slice before moving forward.
