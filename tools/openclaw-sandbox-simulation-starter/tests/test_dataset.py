from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "tools" / "openclaw-sandbox-simulation-starter" / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation.dataset import (
    DATASET_COLUMNS,
    build_feature_query,
    choose_forecast_strategy,
)


def test_build_feature_query_adds_tenant_and_org_filters():
    query = build_feature_query(
        schema="sandbox_v1",
        tenant_id="tenant-a",
        org_id="org-1",
        train_end="2025-09-01",
        validation_end="2025-12-01",
    )

    assert "sandbox_v1.feature_material_monthly_demand" in query
    assert "sandbox_v1.feature_supplier_lead_time" in query
    assert "sandbox_v1.feature_supplier_price" in query
    assert "sandbox_v1.feature_material_in_transit" in query
    assert "sandbox_v1.feature_material_inventory_latest" in query
    assert "d.tenant_id = 'tenant-a'" in query
    assert "d.org_id = 'org-1'" in query
    assert "d.target_month <= DATE '2025-12-01'" in query


def test_dataset_columns_match_p1_contract():
    assert DATASET_COLUMNS == [
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


def test_choose_forecast_strategy_routes_sparse_series_to_croston():
    assert (
        choose_forecast_strategy(observation_count=12, nonzero_observation_count=4)
        == "croston_sba"
    )


def test_choose_forecast_strategy_routes_short_history_to_baseline():
    assert choose_forecast_strategy(observation_count=4, nonzero_observation_count=4) == "baseline"


def test_choose_forecast_strategy_routes_dense_series_to_lightgbm():
    assert (
        choose_forecast_strategy(observation_count=12, nonzero_observation_count=8)
        == "lightgbm"
    )
