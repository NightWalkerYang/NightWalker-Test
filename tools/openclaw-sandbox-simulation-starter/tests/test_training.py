from pathlib import Path
import sys


REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "tools" / "openclaw-sandbox-simulation-starter" / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation.training import (
    build_metrics_payload,
    compute_regression_metrics,
    croston_sba_forecast,
    moving_average_forecast,
    split_frame_by_month,
)


def test_moving_average_forecast_returns_window_mean():
    assert moving_average_forecast([10, 20, 30], window_size=3) == 20


def test_croston_sba_forecast_returns_positive_value_for_intermittent_series():
    forecast = croston_sba_forecast([0, 0, 10, 0, 0, 20], alpha=0.1)
    assert forecast > 0


def test_compute_regression_metrics_returns_expected_mae_and_wape():
    metrics = compute_regression_metrics(actual=[100, 120], predicted=[90, 110])
    assert metrics["mae"] == 10.0
    assert round(metrics["wape"], 4) == 0.0909


def test_split_frame_by_month_uses_target_month():
    import pandas as pd

    frame = pd.DataFrame(
        {
            "target_month": pd.to_datetime(
                ["2026-01-01", "2026-02-01", "2026-03-01"]
            ),
            "demand_qty": [1, 2, 3],
        }
    )

    train, validation, test = split_frame_by_month(
        frame,
        train_end="2026-01-01",
        validation_end="2026-02-01",
    )

    assert len(train) == 1
    assert len(validation) == 1
    assert len(test) == 1


def test_build_metrics_payload_contains_p1_contract():
    import pandas as pd

    metrics = build_metrics_payload(
        tenant_id="demo-tenant",
        org_id="demo-org",
        model_version="202605010101",
        strategies_frame=pd.DataFrame(
            {"strategy": ["lightgbm", "croston_sba", "baseline", "baseline"]}
        ),
        validation_mape={"lightgbm": 0.27, "croston_sba": None, "baseline": 0.42},
        rmse={"lightgbm": 1.2, "croston_sba": None, "baseline": 2.3},
    )

    assert metrics["tenant_id"] == "demo-tenant"
    assert metrics["org_id"] == "demo-org"
    assert metrics["model_version"] == "202605010101"
    assert metrics["strategy_distribution"] == {
        "lightgbm": 1,
        "croston_sba": 1,
        "baseline": 2,
    }
    assert metrics["validation_mape"]["lightgbm"] == 0.27
    assert metrics["rmse"]["baseline"] == 2.3
