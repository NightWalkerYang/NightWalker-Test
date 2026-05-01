DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_safety_stock;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_bom_explosion;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_supplier_price;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_supplier_lead_time;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_material_inventory_latest;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_material_in_transit;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_material_monthly_inflow;
DROP MATERIALIZED VIEW IF EXISTS sandbox_v1.feature_material_monthly_demand;

CREATE MATERIALIZED VIEW sandbox_v1.feature_material_monthly_demand AS
SELECT
    tenant_id,
    org_id,
    material_id,
    date_trunc('month', biz_date)::date AS target_month,
    SUM(qty) AS demand_qty,
    COUNT(*) AS sales_event_count
FROM sandbox_v1.v_sales_outstock
WHERE biz_date IS NOT NULL
  AND qty > 0
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_feature_material_monthly_demand_uniq
    ON sandbox_v1.feature_material_monthly_demand
    (tenant_id, org_id, material_id, target_month);

CREATE MATERIALIZED VIEW sandbox_v1.feature_material_monthly_inflow AS
WITH unioned AS (
    SELECT tenant_id, org_id, material_id, biz_date, qty, src_row_key, 'receive' AS src
    FROM sandbox_v1.v_purchase_receive
    WHERE biz_date IS NOT NULL
      AND qty > 0
    UNION ALL
    SELECT tenant_id, org_id, material_id, biz_date, qty, src_row_key, 'instock' AS src
    FROM sandbox_v1.v_instock
    WHERE biz_date IS NOT NULL
      AND qty > 0
),
deduped AS (
    SELECT DISTINCT ON (src_row_key)
        tenant_id,
        org_id,
        material_id,
        biz_date,
        qty,
        src_row_key,
        src
    FROM unioned
    ORDER BY src_row_key, src
)
SELECT
    tenant_id,
    org_id,
    material_id,
    date_trunc('month', biz_date)::date AS target_month,
    SUM(qty) AS inflow_qty
FROM deduped
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_feature_material_monthly_inflow_uniq
    ON sandbox_v1.feature_material_monthly_inflow
    (tenant_id, org_id, material_id, target_month);

CREATE MATERIALIZED VIEW sandbox_v1.feature_material_in_transit AS
SELECT
    tenant_id,
    org_id,
    material_id,
    SUM(qty) AS in_transit_qty,
    MIN(expected_arrival_date) AS earliest_arrival,
    MAX(expected_arrival_date) AS latest_arrival,
    COUNT(*) AS open_po_count,
    jsonb_agg(
        jsonb_build_object(
            'supplier_id', supplier_id,
            'qty', qty,
            'expected_arrival_date', expected_arrival_date,
            'src_row_key', src_row_key
        )
        ORDER BY expected_arrival_date, src_row_key
    ) AS open_po_detail
FROM sandbox_v1.v_purchase_order
WHERE expected_arrival_date >= CURRENT_DATE
GROUP BY 1, 2, 3;

CREATE UNIQUE INDEX idx_feature_material_in_transit_uniq
    ON sandbox_v1.feature_material_in_transit
    (tenant_id, org_id, material_id);

CREATE MATERIALIZED VIEW sandbox_v1.feature_material_inventory_latest AS
WITH ranked AS (
    SELECT
        tenant_id,
        org_id,
        material_id,
        warehouse_id,
        snapshot_date,
        qty,
        src_row_key,
        ROW_NUMBER() OVER (
            PARTITION BY tenant_id, org_id, material_id, warehouse_id
            ORDER BY snapshot_date DESC, src_row_key DESC
        ) AS rn
    FROM sandbox_v1.v_inventory_snapshot
)
SELECT
    tenant_id,
    org_id,
    material_id,
    warehouse_id,
    snapshot_date,
    qty
FROM ranked
WHERE rn = 1;

CREATE UNIQUE INDEX idx_feature_material_inventory_latest_uniq
    ON sandbox_v1.feature_material_inventory_latest
    (tenant_id, org_id, material_id, warehouse_id);

CREATE MATERIALIZED VIEW sandbox_v1.feature_supplier_lead_time AS
WITH paired AS (
    SELECT
        po.tenant_id,
        po.supplier_id,
        po.material_id,
        (rcv.biz_date - po.biz_date)::numeric AS lead_days
    FROM sandbox_v1.v_purchase_order po
    JOIN sandbox_v1.v_purchase_receive rcv
      ON rcv.tenant_id = po.tenant_id
     AND rcv.material_id = po.material_id
     AND rcv.supplier_id = po.supplier_id
     AND rcv.biz_date BETWEEN po.biz_date AND po.biz_date + INTERVAL '180 days'
    WHERE po.biz_date IS NOT NULL
      AND rcv.biz_date IS NOT NULL
)
SELECT
    tenant_id,
    supplier_id,
    material_id,
    AVG(lead_days) AS avg_lead_days,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY lead_days) AS p90_lead_days,
    STDDEV(lead_days) AS std_lead_days,
    COUNT(*) AS sample_count
FROM paired
GROUP BY 1, 2, 3
HAVING COUNT(*) >= 1;

CREATE UNIQUE INDEX idx_feature_supplier_lead_time_uniq
    ON sandbox_v1.feature_supplier_lead_time
    (tenant_id, supplier_id, material_id);

CREATE MATERIALIZED VIEW sandbox_v1.feature_supplier_price AS
SELECT
    tenant_id,
    supplier_id,
    material_id,
    date_trunc('month', biz_date)::date AS target_month,
    SUM(qty * unit_price) / NULLIF(SUM(qty), 0) AS vwap_unit_price,
    SUM(qty) AS total_qty,
    COUNT(*) AS po_count
FROM sandbox_v1.v_purchase_order
WHERE qty > 0
  AND unit_price IS NOT NULL
  AND unit_price > 0
  AND biz_date IS NOT NULL
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_feature_supplier_price_uniq
    ON sandbox_v1.feature_supplier_price
    (tenant_id, supplier_id, material_id, target_month);

CREATE MATERIALIZED VIEW sandbox_v1.feature_bom_explosion AS
WITH RECURSIVE explode AS (
    SELECT
        b.tenant_id,
        b.parent_material_id AS root_material_id,
        b.parent_material_id AS current_material_id,
        b.parent_material_id AS leaf_material_id,
        1.0::numeric AS cum_qty_per,
        0.0::numeric AS cum_scrap_rate,
        1 AS depth,
        ARRAY[b.parent_material_id] AS path
    FROM (
        SELECT DISTINCT tenant_id, parent_material_id
        FROM sandbox_v1.v_bom
    ) b

    UNION ALL

    SELECT
        e.tenant_id,
        e.root_material_id,
        bom.child_material_id AS current_material_id,
        bom.child_material_id AS leaf_material_id,
        e.cum_qty_per * bom.qty_per AS cum_qty_per,
        1 - (1 - e.cum_scrap_rate) * (1 - bom.scrap_rate) AS cum_scrap_rate,
        e.depth + 1 AS depth,
        e.path || bom.child_material_id AS path
    FROM explode e
    JOIN sandbox_v1.v_bom bom
      ON bom.tenant_id = e.tenant_id
     AND bom.parent_material_id = e.current_material_id
     AND bom.valid_from <= CURRENT_DATE
     AND bom.valid_to >= CURRENT_DATE
    WHERE e.depth < 8
      AND NOT (bom.child_material_id = ANY(e.path))
)
SELECT DISTINCT
    tenant_id,
    root_material_id,
    leaf_material_id,
    cum_qty_per,
    cum_scrap_rate,
    depth,
    path,
    md5(path::text) AS path_hash
FROM explode
WHERE depth > 1;

CREATE UNIQUE INDEX idx_feature_bom_explosion_uniq
    ON sandbox_v1.feature_bom_explosion
    (tenant_id, root_material_id, leaf_material_id, path_hash);

CREATE MATERIALIZED VIEW sandbox_v1.feature_safety_stock AS
WITH from_alert AS (
    SELECT
        NULL::text AS tenant_id,
        NULL::text AS org_id,
        NULL::text AS material_id,
        NULL::text AS warehouse_id,
        NULL::numeric AS max_qty,
        NULL::numeric AS min_qty,
        NULL::numeric AS safety_qty,
        'alert_table'::text AS source
    FROM public.bd_stockalert_current
    WHERE 1 = 0
),
from_demand_std AS (
    SELECT
        f.tenant_id,
        f.org_id,
        f.material_id,
        inv.warehouse_id,
        NULL::numeric AS max_qty,
        NULL::numeric AS min_qty,
        COALESCE(STDDEV(f.demand_qty), 0) * 1.65 AS safety_qty,
        'demand_std'::text AS source
    FROM sandbox_v1.feature_material_monthly_demand f
    JOIN sandbox_v1.feature_material_inventory_latest inv
      USING (tenant_id, org_id, material_id)
    WHERE f.target_month >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY 1, 2, 3, 4
)
SELECT *
FROM from_alert
UNION ALL
SELECT fd.*
FROM from_demand_std fd
LEFT JOIN from_alert fa
  ON fa.tenant_id = fd.tenant_id
 AND fa.org_id = fd.org_id
 AND fa.material_id = fd.material_id
 AND fa.warehouse_id = fd.warehouse_id
WHERE fa.tenant_id IS NULL;

CREATE UNIQUE INDEX idx_feature_safety_stock_uniq
    ON sandbox_v1.feature_safety_stock
    (tenant_id, org_id, material_id, warehouse_id);
