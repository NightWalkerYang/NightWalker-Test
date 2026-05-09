CREATE SCHEMA IF NOT EXISTS sandbox_simulation;

DROP MATERIALIZED VIEW IF EXISTS sandbox_simulation.feature_material_monthly;

CREATE MATERIALIZED VIEW sandbox_simulation.feature_material_monthly AS
WITH monthly_demand AS (
  SELECT
    s.tenant_id,
    s.org_id,
    s.material_id,
    date_trunc('month', s.biz_date)::date AS stat_month,
    SUM(COALESCE(s.qty, 0))::numeric(18, 4) AS demand_qty
  FROM ods_sales_outstock s
  GROUP BY 1, 2, 3, 4
),
monthly_sales_order AS (
  SELECT
    so.tenant_id,
    so.org_id,
    so.material_id,
    date_trunc('month', so.delivery_date)::date AS stat_month,
    SUM(COALESCE(so.unshipped_qty, 0))::numeric(18, 4) AS sales_order_open_qty_30d
  FROM ods_sales_order so
  GROUP BY 1, 2, 3, 4
),
inventory_snapshot AS (
  SELECT DISTINCT ON (i.tenant_id, i.org_id, i.material_id, date_trunc('month', i.snapshot_date)::date)
    i.tenant_id,
    i.org_id,
    i.material_id,
    date_trunc('month', i.snapshot_date)::date AS stat_month,
    COALESCE(i.on_hand_qty, 0)::numeric(18, 4) AS inventory_on_hand_qty,
    COALESCE(i.available_qty, 0)::numeric(18, 4) AS inventory_available_qty
  FROM ods_inventory i
  ORDER BY
    i.tenant_id,
    i.org_id,
    i.material_id,
    date_trunc('month', i.snapshot_date)::date,
    i.snapshot_date DESC
),
purchase_open AS (
  SELECT
    po.tenant_id,
    po.org_id,
    po.material_id,
    date_trunc('month', po.order_date)::date AS stat_month,
    SUM(COALESCE(po.open_qty, 0))::numeric(18, 4) AS purchase_in_transit_qty,
    SUM(
      CASE
        WHEN po.expected_arrival_date <= (date_trunc('month', po.order_date) + INTERVAL '30 days')
          THEN COALESCE(po.open_qty, 0)
        ELSE 0
      END
    )::numeric(18, 4) AS purchase_due_next_30d_qty,
    AVG(
      GREATEST(
        EXTRACT(DAY FROM (po.expected_arrival_date::timestamp - po.order_date::timestamp)),
        0
      )
    )::numeric(18, 4) AS purchase_lead_time_avg_days_90d,
    AVG(COALESCE(po.unit_price, 0))::numeric(18, 4) AS purchase_unit_cost_avg_90d
  FROM ods_purchase_order po
  GROUP BY 1, 2, 3, 4
),
material_cost_latest AS (
  SELECT DISTINCT ON (mc.tenant_id, mc.org_id, mc.material_id, date_trunc('month', mc.effective_date)::date)
    mc.tenant_id,
    mc.org_id,
    mc.material_id,
    date_trunc('month', mc.effective_date)::date AS stat_month,
    COALESCE(mc.unit_cost, 0)::numeric(18, 4) AS material_unit_cost
  FROM ods_material_cost mc
  ORDER BY
    mc.tenant_id,
    mc.org_id,
    mc.material_id,
    date_trunc('month', mc.effective_date)::date,
    mc.effective_date DESC
),
bom_summary AS (
  SELECT
    b.tenant_id,
    b.org_id,
    b.parent_material_id AS material_id,
    COUNT(DISTINCT b.component_material_id)::integer AS bom_component_count,
    SUM(COALESCE(b.component_qty, 0))::numeric(18, 4) AS bom_total_component_qty
  FROM ods_bom b
  WHERE COALESCE(b.is_active, TRUE)
  GROUP BY 1, 2, 3
),
feature_base AS (
  SELECT
    md.tenant_id,
    md.org_id,
    md.material_id,
    md.stat_month,
    EXTRACT(MONTH FROM md.stat_month)::integer AS month_num,
    EXTRACT(QUARTER FROM md.stat_month)::integer AS quarter_num,
    COALESCE(LAG(md.demand_qty, 1) OVER w, 0)::numeric(18, 4) AS demand_qty_m1,
    COALESCE(LAG(md.demand_qty, 2) OVER w, 0)::numeric(18, 4) AS demand_qty_m2,
    COALESCE(LAG(md.demand_qty, 3) OVER w, 0)::numeric(18, 4) AS demand_qty_m3,
    COALESCE(AVG(md.demand_qty) OVER w3, 0)::numeric(18, 4) AS demand_qty_avg_3m,
    COALESCE(AVG(md.demand_qty) OVER w6, 0)::numeric(18, 4) AS demand_qty_avg_6m,
    COALESCE(LAG(md.demand_qty, 12) OVER w, 0)::numeric(18, 4) AS demand_qty_same_month_last_year,
    COALESCE(so.sales_order_open_qty_30d, 0)::numeric(18, 4) AS sales_order_open_qty_30d,
    COALESCE(inv.inventory_on_hand_qty, 0)::numeric(18, 4) AS inventory_on_hand_qty,
    COALESCE(inv.inventory_available_qty, 0)::numeric(18, 4) AS inventory_available_qty,
    COALESCE(po.purchase_in_transit_qty, 0)::numeric(18, 4) AS purchase_in_transit_qty,
    COALESCE(po.purchase_due_next_30d_qty, 0)::numeric(18, 4) AS purchase_due_next_30d_qty,
    COALESCE(po.purchase_lead_time_avg_days_90d, 0)::numeric(18, 4) AS purchase_lead_time_avg_days_90d,
    COALESCE(po.purchase_unit_cost_avg_90d, 0)::numeric(18, 4) AS purchase_unit_cost_avg_90d,
    COALESCE(mc.material_unit_cost, 0)::numeric(18, 4) AS material_unit_cost,
    COALESCE(bs.bom_component_count, 0)::integer AS bom_component_count,
    COALESCE(bs.bom_total_component_qty, 0)::numeric(18, 4) AS bom_total_component_qty,
    COALESCE(LEAD(md.demand_qty, 1) OVER w, 0)::numeric(18, 4) AS target_next_month_qty
  FROM monthly_demand md
  LEFT JOIN monthly_sales_order so
    ON so.tenant_id = md.tenant_id
   AND so.org_id = md.org_id
   AND so.material_id = md.material_id
   AND so.stat_month = md.stat_month
  LEFT JOIN inventory_snapshot inv
    ON inv.tenant_id = md.tenant_id
   AND inv.org_id = md.org_id
   AND inv.material_id = md.material_id
   AND inv.stat_month = md.stat_month
  LEFT JOIN purchase_open po
    ON po.tenant_id = md.tenant_id
   AND po.org_id = md.org_id
   AND po.material_id = md.material_id
   AND po.stat_month = md.stat_month
  LEFT JOIN material_cost_latest mc
    ON mc.tenant_id = md.tenant_id
   AND mc.org_id = md.org_id
   AND mc.material_id = md.material_id
   AND mc.stat_month = md.stat_month
  LEFT JOIN bom_summary bs
    ON bs.tenant_id = md.tenant_id
   AND bs.org_id = md.org_id
   AND bs.material_id = md.material_id
  WINDOW
    w AS (
      PARTITION BY md.tenant_id, md.org_id, md.material_id
      ORDER BY md.stat_month
    ),
    w3 AS (
      PARTITION BY md.tenant_id, md.org_id, md.material_id
      ORDER BY md.stat_month
      ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
    ),
    w6 AS (
      PARTITION BY md.tenant_id, md.org_id, md.material_id
      ORDER BY md.stat_month
      ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
    )
)
SELECT *
FROM feature_base
WHERE target_next_month_qty IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feature_material_monthly_key
  ON sandbox_simulation.feature_material_monthly (tenant_id, org_id, material_id, stat_month);

CREATE INDEX IF NOT EXISTS idx_feature_material_monthly_target
  ON sandbox_simulation.feature_material_monthly (stat_month, target_next_month_qty);
