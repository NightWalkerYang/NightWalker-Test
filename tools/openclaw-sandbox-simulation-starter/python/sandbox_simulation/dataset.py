from __future__ import annotations

import re


TARGET_COLUMN = "demand_qty"

CATEGORICAL_FEATURE_COLUMNS = [
    "tenant_id",
    "org_id",
    "material_id",
    "month",
    "quarter",
    "strategy_hint",
]

NUMERIC_FEATURE_COLUMNS = [
    "lag_1",
    "lag_3",
    "lag_6",
    "lag_12",
    "rolling_mean_3",
    "rolling_mean_6",
    "last_unit_price",
    "in_transit_qty",
    "on_hand_qty",
]

DATASET_COLUMNS = [
    "tenant_id",
    "org_id",
    "material_id",
    "target_month",
    "demand_qty",
    "lag_1",
    "lag_3",
    "lag_6",
    "lag_12",
    "rolling_mean_3",
    "rolling_mean_6",
    "month",
    "quarter",
    "last_unit_price",
    "in_transit_qty",
    "on_hand_qty",
    "strategy_hint",
]

_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _assert_safe_identifier(value: str) -> str:
    normalized = str(value or "").strip()
    if not normalized or not _IDENTIFIER_RE.fullmatch(normalized):
        raise ValueError(f"unsafe identifier: {value!r}")
    return normalized


def _quote_literal(value: str) -> str:
    return str(value).replace("'", "''")


def _qualified(schema: str, relation: str) -> str:
    return f"{_assert_safe_identifier(schema)}.{_assert_safe_identifier(relation)}"


def build_feature_query(
    *,
    schema: str = "sandbox_v1",
    tenant_id: str | None = None,
    org_id: str | None = None,
    train_end: str | None = None,
    validation_end: str | None = None,
    min_stat_month: str | None = None,
    max_stat_month: str | None = None,
    table_name: str | None = None,
) -> str:
    """Build the sandbox_v1 monthly demand training query.

    `table_name`, `min_stat_month`, and `max_stat_month` remain accepted for
    compatibility with the original starter CLI/tests, but P-1 routes the query
    through `schema.feature_material_monthly_demand`.
    """
    _ = table_name
    lower_month = min_stat_month
    upper_month = max_stat_month or validation_end
    if train_end and not lower_month:
        lower_month = None

    demand_mv = _qualified(schema, "feature_material_monthly_demand")
    price_mv = _qualified(schema, "feature_supplier_price")
    transit_mv = _qualified(schema, "feature_material_in_transit")
    inventory_mv = _qualified(schema, "feature_material_inventory_latest")
    lead_time_mv = _qualified(schema, "feature_supplier_lead_time")

    clauses = ["d.target_month IS NOT NULL"]
    if tenant_id:
        clauses.append(f"d.tenant_id = '{_quote_literal(tenant_id)}'")
    if org_id:
        clauses.append(f"d.org_id = '{_quote_literal(org_id)}'")
    if lower_month:
        clauses.append(f"d.target_month >= DATE '{_quote_literal(lower_month)}'")
    if upper_month:
        clauses.append(f"d.target_month <= DATE '{_quote_literal(upper_month)}'")

    where_clause = "\n      AND ".join(clauses)
    return f"""
WITH demand AS (
    SELECT
        d.tenant_id,
        d.org_id,
        d.material_id,
        d.target_month,
        d.demand_qty::numeric AS demand_qty,
        LAG(d.demand_qty, 1) OVER material_month AS lag_1,
        LAG(d.demand_qty, 3) OVER material_month AS lag_3,
        LAG(d.demand_qty, 6) OVER material_month AS lag_6,
        LAG(d.demand_qty, 12) OVER material_month AS lag_12,
        AVG(d.demand_qty) OVER (
            PARTITION BY d.tenant_id, d.org_id, d.material_id
            ORDER BY d.target_month
            ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
        ) AS rolling_mean_3,
        AVG(d.demand_qty) OVER (
            PARTITION BY d.tenant_id, d.org_id, d.material_id
            ORDER BY d.target_month
            ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING
        ) AS rolling_mean_6,
        COUNT(*) OVER (
            PARTITION BY d.tenant_id, d.org_id, d.material_id
            ORDER BY d.target_month
            ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
        ) AS observation_count_12,
        SUM(CASE WHEN d.demand_qty > 0 THEN 1 ELSE 0 END) OVER (
            PARTITION BY d.tenant_id, d.org_id, d.material_id
            ORDER BY d.target_month
            ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
        ) AS nonzero_count_12
    FROM {demand_mv} d
    WHERE {where_clause}
    WINDOW material_month AS (
        PARTITION BY d.tenant_id, d.org_id, d.material_id
        ORDER BY d.target_month
    )
),
price AS (
    SELECT
        tenant_id,
        material_id,
        target_month,
        AVG(vwap_unit_price) AS last_unit_price
    FROM {price_mv}
    GROUP BY 1, 2, 3
),
inventory AS (
    SELECT
        tenant_id,
        org_id,
        material_id,
        SUM(qty) AS on_hand_qty
    FROM {inventory_mv}
    GROUP BY 1, 2, 3
),
lead_time AS (
    SELECT
        tenant_id,
        material_id,
        AVG(avg_lead_days) AS avg_lead_days
    FROM {lead_time_mv}
    GROUP BY 1, 2
)
SELECT
    demand.tenant_id,
    demand.org_id,
    demand.material_id,
    demand.target_month,
    demand.demand_qty,
    COALESCE(demand.lag_1, 0)::numeric AS lag_1,
    COALESCE(demand.lag_3, 0)::numeric AS lag_3,
    COALESCE(demand.lag_6, 0)::numeric AS lag_6,
    COALESCE(demand.lag_12, 0)::numeric AS lag_12,
    COALESCE(demand.rolling_mean_3, 0)::numeric AS rolling_mean_3,
    COALESCE(demand.rolling_mean_6, 0)::numeric AS rolling_mean_6,
    EXTRACT(MONTH FROM demand.target_month)::int AS month,
    EXTRACT(QUARTER FROM demand.target_month)::int AS quarter,
    COALESCE((
        SELECT p.last_unit_price
        FROM price p
        WHERE p.tenant_id = demand.tenant_id
          AND p.material_id = demand.material_id
          AND p.target_month <= demand.target_month
        ORDER BY p.target_month DESC
        LIMIT 1
    ), 0)::numeric AS last_unit_price,
    COALESCE(transit.in_transit_qty, 0)::numeric AS in_transit_qty,
    COALESCE(inventory.on_hand_qty, 0)::numeric AS on_hand_qty,
    CASE
        WHEN demand.observation_count_12 < 6 THEN 'baseline'
        WHEN demand.observation_count_12 - demand.nonzero_count_12 >= 6 THEN 'croston_sba'
        WHEN demand.nonzero_count_12 >= 8 THEN 'lightgbm'
        ELSE 'baseline'
    END AS strategy_hint
FROM demand
LEFT JOIN {transit_mv} transit
  ON transit.tenant_id = demand.tenant_id
 AND transit.org_id = demand.org_id
 AND transit.material_id = demand.material_id
LEFT JOIN inventory
  ON inventory.tenant_id = demand.tenant_id
 AND inventory.org_id = demand.org_id
 AND inventory.material_id = demand.material_id
LEFT JOIN lead_time
  ON lead_time.tenant_id = demand.tenant_id
 AND lead_time.material_id = demand.material_id
ORDER BY demand.tenant_id, demand.org_id, demand.material_id, demand.target_month
""".strip()


def load_training_dataset(
    engine,
    *,
    tenant_id: str,
    org_id: str,
    train_end: str,
    validation_end: str,
    schema: str = "sandbox_v1",
):
    import pandas as pd

    query = build_feature_query(
        schema=schema,
        tenant_id=tenant_id,
        org_id=org_id,
        train_end=train_end,
        validation_end=validation_end,
    )
    frame = pd.read_sql_query(query, engine)
    if "target_month" in frame.columns:
        frame["target_month"] = pd.to_datetime(frame["target_month"]).dt.normalize()
    for column in DATASET_COLUMNS:
        if column not in frame.columns:
            frame[column] = 0
    return frame[DATASET_COLUMNS].copy()


def choose_forecast_strategy(*, observation_count: int, nonzero_observation_count: int) -> str:
    normalized_observation_count = max(int(observation_count), 0)
    normalized_nonzero_count = max(int(nonzero_observation_count), 0)
    zero_count = max(normalized_observation_count - normalized_nonzero_count, 0)
    if normalized_observation_count < 6:
        return "baseline"
    if zero_count >= 6:
        return "croston_sba"
    if normalized_nonzero_count >= 8:
        return "lightgbm"
    return "baseline"
