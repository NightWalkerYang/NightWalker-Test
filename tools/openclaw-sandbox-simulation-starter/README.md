# OpenClaw Sandbox Simulation Starter

This directory is the code companion to `SANDBOX_SIMULATION_OPENCLAW_DEPLOYMENT.md`.

It implements the three concrete artifacts called out in that deployment document:

1. PostgreSQL monthly feature dataset design
2. LightGBM training skeleton with baseline and Croston SBA routing
3. Procurement recommendation formulas

## Directory Layout

- `sql/feature_material_monthly.sql`
  - creates the `sandbox_simulation.feature_material_monthly` materialized view described in the deployment document
- `python/sandbox_simulation/dataset.py`
  - feature query builder and strategy routing helpers
- `python/sandbox_simulation/training.py`
  - baseline forecast, Croston SBA forecast, regression metrics, LightGBM training helpers
- `python/sandbox_simulation/procurement.py`
  - procurement recommendation formulas
- `python/train_lightgbm.py`
  - CLI entrypoint
- `python/generate_sandbox_payload.py`
  - generates `Sandbox/*_sandbox.json` files that the OpenClaw `/sandbox-view/` route can render
- `python/sandbox_simulation/neo4j_projection.py`
  - optional Neo4j projection writer for the same graph payload

## Assumptions

The SQL template assumes the ODS tables proposed in `SANDBOX_SIMULATION_OPENCLAW_DEPLOYMENT.md` already exist:

- `ods_sales_outstock`
- `ods_sales_order`
- `ods_inventory`
- `ods_purchase_order`
- `ods_material_cost`
- `ods_bom`

If your actual ingestion table names differ, map them before applying the SQL.

## 1. Apply The Feature SQL

```bash
psql "postgresql://kb_local:kb_local123!@127.0.0.1:65432/postgres" -f tools/openclaw-sandbox-simulation-starter/sql/feature_material_monthly.sql
```

## 2. Install Python Dependencies

```bash
python -m pip install -r tools/openclaw-sandbox-simulation-starter/requirements.txt
```

## 3. Run The Training Starter

```bash
python tools/openclaw-sandbox-simulation-starter/python/train_lightgbm.py \
  --dsn "postgresql+psycopg://kb_local:kb_local123!@127.0.0.1:65432/postgres" \
  --tenant-id "demo-tenant" \
  --org-id "demo-org" \
  --train-end "2024-09-01" \
  --validation-end "2024-12-01" \
  --output-dir "tools/openclaw-sandbox-simulation-starter/output/demo"
```

Outputs:

- `metrics.json`
- `predictions.csv`
- `strategies.csv`
- `lightgbm_model.joblib` when the current split includes `lightgbm` strategy materials

## 4. Use The Procurement Formulas

After demand prediction, feed the forecast result into `sandbox_simulation.procurement.build_procurement_recommendation(...)`.

That follows the deployment document's rule chain:

```text
gross requirement
- available inventory / in-transit supply
= net requirement
-> scrap adjustment
-> order multiple round-up
-> estimated purchase cost
```

This starter now covers the data side of the OpenClaw sandbox flow: feature SQL, forecast starter, procurement rules, OpenClaw `Sandbox/*.json` payload generation, and optional Neo4j projection writing.

## 5. Generate The OpenClaw Sandbox Payload

```bash
python tools/openclaw-sandbox-simulation-starter/python/generate_sandbox_payload.py \
  --dsn "postgresql+psycopg://kb_local:kb_local123!@127.0.0.1:65432/postgres" \
  --tenant-id "demo-tenant" \
  --org-id "demo-org" \
  --workspace-dir "E:/some-derived-agent-workspace" \
  --sandbox-name "采购沙盒模拟" \
  --agent-name "苏博泰克财务分析助手"
```

This writes:

```text
<workspace-dir>/Sandbox/采购沙盒模拟_sandbox.json
```

The OpenClaw sandbox menu added in `tools/openclaw-control-ui-echarts` scans that directory and exposes the payload at `/sandbox-view/?token=...`.

## 6. Optional Neo4j Projection

```bash
python tools/openclaw-sandbox-simulation-starter/python/generate_sandbox_payload.py \
  --dsn "postgresql+psycopg://kb_local:kb_local123!@127.0.0.1:65432/postgres" \
  --workspace-dir "E:/some-derived-agent-workspace" \
  --neo4j-uri "bolt://127.0.0.1:7687" \
  --neo4j-username "neo4j" \
  --neo4j-password "password"
```

This keeps one JSON payload for OpenClaw G6 rendering and writes the same graph projection into Neo4j for downstream graph queries.
