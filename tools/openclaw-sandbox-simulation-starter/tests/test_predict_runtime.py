from datetime import date
from pathlib import Path
import sys

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[3]
PYTHON_ROOT = REPO_ROOT / "tools" / "openclaw-sandbox-simulation-starter" / "python"
if str(PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(PYTHON_ROOT))

from sandbox_simulation.predict_runtime import ForecastRow, predict_demand


class MockEngine:
    def __init__(self, frame=None, error: Exception | None = None):
        self.frame = frame if frame is not None else pd.DataFrame()
        self.error = error


def _history_frame(history: dict[str, list[float]]):
    records = []
    for material_id, values in history.items():
        for index, value in enumerate(values, start=1):
            records.append(
                {
                    "material_id": material_id,
                    "target_month": pd.Timestamp(2025, index, 1),
                    "demand_qty": value,
                }
            )
    return pd.DataFrame.from_records(records)


def _patch_read_sql(monkeypatch):
    def fake_read_sql_query(_query, engine, params=None):
        if getattr(engine, "error", None):
            raise engine.error
        material_ids = set((params or {}).get("material_ids", []))
        if not material_ids or engine.frame.empty:
            return pd.DataFrame(columns=["material_id", "target_month", "demand_qty"])
        return engine.frame.loc[engine.frame["material_id"].isin(material_ids)].copy()

    monkeypatch.setattr(pd, "read_sql_query", fake_read_sql_query)


def test_returns_one_row_per_material(monkeypatch):
    _patch_read_sql(monkeypatch)

    rows = predict_demand(
        tenant_id="demo-tenant",
        org_id="demo-org",
        material_ids=[f"M{i:03d}" for i in range(100)],
        target_month=date(2026, 5, 1),
        engine=MockEngine(),
    )

    assert len(rows) == 100
    assert all(isinstance(row, ForecastRow) for row in rows)
    assert all(row.strategy == "baseline" for row in rows)
    assert all(row.p50 == 0 for row in rows)


def test_baseline_with_history(monkeypatch):
    _patch_read_sql(monkeypatch)

    rows = predict_demand(
        tenant_id="demo-tenant",
        org_id="demo-org",
        material_ids=["M001"],
        target_month=date(2026, 5, 1),
        engine=MockEngine(_history_frame({"M001": [100, 110, 105, 120, 115, 108]})),
    )

    assert rows[0].p50 > 0
    assert rows[0].p10 < rows[0].p50 < rows[0].p90


def test_no_exception_on_db_error(monkeypatch):
    _patch_read_sql(monkeypatch)

    rows = predict_demand(
        tenant_id="demo-tenant",
        org_id="demo-org",
        material_ids=["M001"],
        target_month=date(2026, 5, 1),
        engine=MockEngine(error=RuntimeError("db failed")),
    )

    assert len(rows) == 1
    assert rows[0].strategy == "baseline"
    assert rows[0].p50 == 0


def test_lightgbm_fallback_when_model_missing(monkeypatch, tmp_path):
    _patch_read_sql(monkeypatch)

    rows = predict_demand(
        tenant_id="demo-tenant",
        org_id="demo-org",
        material_ids=["M001"],
        target_month=date(2026, 5, 1),
        model_dir=tmp_path / "nonexistent",
        engine=MockEngine(_history_frame({"M001": [100] * 12})),
    )

    assert rows[0].strategy in ("baseline", "croston_sba")
    assert rows[0].p50 > 0
