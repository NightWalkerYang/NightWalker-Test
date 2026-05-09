"""
运行时推理入口。

guarantees:
  - 任何输入都返回 list[ForecastRow]，长度 == len(material_ids)
  - 单次调用 200 物料以内 <= 5 秒
  - 不抛异常，缺失/失败统一走 baseline
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Literal

from sqlalchemy import text

from ._common.db import get_engine
from .training import croston_sba_forecast, moving_average_forecast


@dataclass
class ForecastRow:
    tenant_id: str
    org_id: str
    material_id: str
    material_name: str
    target_month: date
    p10: float
    p50: float
    p90: float
    strategy: Literal["lightgbm", "croston_sba", "baseline"]
    model_version: str

    def asdict(self) -> dict:
        return asdict(self)


def _safe_schema(schema: str) -> str:
    normalized = str(schema or "sandbox_v1").strip()
    if not normalized.replace("_", "").isalnum() or normalized[0].isdigit():
        return "sandbox_v1"
    return normalized


def _empty_history():
    import pandas as pd

    return pd.DataFrame(columns=["material_id", "target_month", "demand_qty"])


def _normalize_org_ids(org_id: str | None, org_ids: list[str] | None) -> list[str]:
    if org_ids:
        return [str(value or "").strip() for value in org_ids if str(value or "").strip()]
    normalized = str(org_id or "").strip()
    if normalized and normalized.lower() != "all":
        return [normalized]
    return []


def _load_history(
    *,
    engine,
    tenant_id: str,
    org_id: str | None,
    org_ids: list[str] | None,
    material_ids: list[str],
    schema: str,
    history_start_date: str | None,
    history_end_date: str | None,
):
    import pandas as pd

    if not material_ids:
        return _empty_history()
    normalized_org_ids = _normalize_org_ids(org_id, org_ids)
    clauses = [
        "tenant_id = :tenant_id",
        "material_id = ANY(:material_ids)",
    ]
    params: dict[str, object] = {
        "tenant_id": tenant_id,
        "material_ids": material_ids,
    }
    if normalized_org_ids:
        clauses.append("org_id = ANY(:org_ids)")
        params["org_ids"] = normalized_org_ids
    if history_start_date:
        clauses.append("target_month >= date_trunc('month', CAST(:history_start_date AS date))::date")
        params["history_start_date"] = history_start_date
    if history_end_date:
        clauses.append("target_month <= date_trunc('month', CAST(:history_end_date AS date))::date")
        params["history_end_date"] = history_end_date
    query = text(
        f"""
        SELECT material_id, target_month, SUM(demand_qty) AS demand_qty
          FROM {_safe_schema(schema)}.feature_material_monthly_demand
         WHERE {' AND '.join(clauses)}
         GROUP BY material_id, target_month
         ORDER BY material_id, target_month
        """
    )
    return pd.read_sql_query(query, engine, params=params)


def baseline_forecast(history, target_month: date) -> tuple[float, float, float]:
    if history is None or history.empty:
        return 0.0, 0.0, 0.0

    ordered = history.sort_values("target_month").copy()
    values = [max(float(value), 0.0) for value in ordered["demand_qty"].tail(6).tolist()]
    if not values:
        p50 = 0.0
    elif len(values) < 6:
        p50 = sum(values) / len(values)
    else:
        weights = [0.03, 0.07, 0.15, 0.2, 0.25, 0.3]
        p50 = sum(value * weight for value, weight in zip(values, weights))

    same_month = ordered[
        ordered["target_month"].map(lambda value: value.month) == target_month.month
    ]
    all_mean = float(ordered["demand_qty"].mean()) if not ordered.empty else 0.0
    same_month_mean = (
        float(same_month["demand_qty"].mean()) if not same_month.empty else all_mean
    )
    seasonality = same_month_mean / all_mean if all_mean > 0 else 1.0
    p50 = max(p50 * seasonality, 0.0)
    return round(p50 * 0.7, 6), round(p50, 6), round(p50 * 1.3, 6)


def _croston_or_baseline(history, target_month: date) -> tuple[float, float, float, str]:
    try:
        values = history.sort_values("target_month")["demand_qty"].tolist()
        p50 = float(croston_sba_forecast(values))
        if p50 > 0:
            return round(p50 * 0.7, 6), round(p50, 6), round(p50 * 1.3, 6), "croston_sba"
    except Exception:
        pass
    p10, p50, p90 = baseline_forecast(history, target_month)
    return p10, p50, p90, "baseline"


def _load_supplementary_features(
    *,
    engine,
    tenant_id: str,
    org_id: str | None,
    org_ids: list[str] | None,
    material_ids: list[str],
    target_month: date,
    schema: str,
) -> dict[str, dict]:
    """Batch-load price, in-transit, on-hand for all materials in one round-trip each."""
    import pandas as pd

    empty = {"last_unit_price": 0.0, "in_transit_qty": 0.0, "on_hand_qty": 0.0}
    result: dict[str, dict] = {mid: dict(empty) for mid in material_ids}
    if not material_ids or engine is None:
        return result

    safe = _safe_schema(schema)
    normalized_org_ids = _normalize_org_ids(org_id, org_ids)
    try:
        price_q = text(
            f"""
            SELECT DISTINCT ON (material_id)
                   material_id,
                   vwap_unit_price AS last_unit_price
              FROM {safe}.feature_supplier_price
             WHERE tenant_id = :tid
               AND material_id = ANY(:mids)
               AND target_month <= :tm
             ORDER BY material_id, target_month DESC
            """
        )
        price_df = pd.read_sql_query(
            price_q, engine, params={"tid": tenant_id, "mids": material_ids, "tm": str(target_month)}
        )
        for _, row in price_df.iterrows():
            result[row["material_id"]]["last_unit_price"] = float(row["last_unit_price"] or 0.0)
    except Exception:
        pass

    try:
        transit_where = [
            "tenant_id = :tid",
            "material_id = ANY(:mids)",
        ]
        transit_params: dict[str, object] = {
            "tid": tenant_id,
            "mids": material_ids,
        }
        if normalized_org_ids:
            transit_where.append("org_id = ANY(:org_ids)")
            transit_params["org_ids"] = normalized_org_ids
        transit_q = text(
            f"""
            SELECT material_id, SUM(in_transit_qty) AS in_transit_qty
              FROM {safe}.feature_material_in_transit
             WHERE {' AND '.join(transit_where)}
             GROUP BY material_id
            """
        )
        transit_df = pd.read_sql_query(transit_q, engine, params=transit_params)
        for _, row in transit_df.iterrows():
            result[row["material_id"]]["in_transit_qty"] = float(row["in_transit_qty"] or 0.0)
    except Exception:
        pass

    try:
        inventory_where = [
            "tenant_id = :tid",
            "material_id = ANY(:mids)",
        ]
        inventory_params: dict[str, object] = {
            "tid": tenant_id,
            "mids": material_ids,
        }
        if normalized_org_ids:
            inventory_where.append("org_id = ANY(:org_ids)")
            inventory_params["org_ids"] = normalized_org_ids
        inv_q = text(
            f"""
            SELECT material_id, SUM(qty) AS on_hand_qty
              FROM {safe}.feature_material_inventory_latest
             WHERE {' AND '.join(inventory_where)}
             GROUP BY material_id
            """
        )
        inv_df = pd.read_sql_query(inv_q, engine, params=inventory_params)
        for _, row in inv_df.iterrows():
            result[row["material_id"]]["on_hand_qty"] = float(row["on_hand_qty"] or 0.0)
    except Exception:
        pass

    return result


def _build_lgbm_feature_row(
    *,
    tenant_id: str,
    org_id: str,
    material_id: str,
    target_month: date,
    history,
    supplementary: dict,
):
    """Build a single-row DataFrame with all LightGBM feature columns."""
    import pandas as pd

    ordered = history.sort_values("target_month").copy()
    past_mask = ordered["target_month"] < pd.Timestamp(target_month)
    past = [max(float(v), 0.0) for v in ordered.loc[past_mask, "demand_qty"].tolist()]

    def _lag(n: int) -> float:
        return past[-n] if len(past) >= n else 0.0

    def _rolling(n: int) -> float:
        window = past[-n:] if len(past) >= n else past
        return sum(window) / len(window) if window else 0.0

    row = {
        "tenant_id": tenant_id,
        "org_id": org_id,
        "material_id": material_id,
        "month": target_month.month,
        "quarter": (target_month.month - 1) // 3 + 1,
        "strategy_hint": _route_strategy(history),
        "lag_1": _lag(1),
        "lag_3": _lag(3),
        "lag_6": _lag(6),
        "lag_12": _lag(12),
        "rolling_mean_3": _rolling(3),
        "rolling_mean_6": _rolling(6),
        "last_unit_price": supplementary.get("last_unit_price", 0.0),
        "in_transit_qty": supplementary.get("in_transit_qty", 0.0),
        "on_hand_qty": supplementary.get("on_hand_qty", 0.0),
    }
    return pd.DataFrame([row])


def _load_model(model_dir: Path | None):
    if model_dir is None:
        return None, "baseline"
    try:
        current_file = model_dir / "current.txt"
        version = current_file.read_text(encoding="utf-8").strip()
        model_path = model_dir / version / "lightgbm_model.joblib"
        if not model_path.exists():
            return None, version or "baseline"
        import joblib

        return joblib.load(model_path), version
    except Exception:
        return None, "baseline"


def _route_strategy(history) -> str:
    if history is None or history.empty:
        return "baseline"
    ordered = history.sort_values("target_month").tail(12)
    observation_count = len(ordered)
    nonzero_count = int((ordered["demand_qty"] > 0).sum())
    if observation_count >= 8 and nonzero_count >= 8:
        return "lightgbm"
    if observation_count >= 6 and observation_count - nonzero_count >= 6:
        return "croston_sba"
    return "baseline"


def _predict_one(
    *,
    tenant_id: str,
    org_id: str,
    material_id: str,
    target_month: date,
    history,
    model,
    model_version: str,
    supplementary: dict | None = None,
) -> ForecastRow:
    strategy = _route_strategy(history)
    try:
        if strategy == "lightgbm" and model is not None:
            from .dataset import CATEGORICAL_FEATURE_COLUMNS, NUMERIC_FEATURE_COLUMNS

            feature_row = _build_lgbm_feature_row(
                tenant_id=tenant_id,
                org_id=org_id,
                material_id=material_id,
                target_month=target_month,
                history=history,
                supplementary=supplementary or {},
            )
            feature_columns = CATEGORICAL_FEATURE_COLUMNS + NUMERIC_FEATURE_COLUMNS
            for col in CATEGORICAL_FEATURE_COLUMNS:
                if col in feature_row.columns:
                    feature_row[col] = feature_row[col].astype("category")
            p50 = max(float(model.predict(feature_row[feature_columns])[0]), 0.0)
            return ForecastRow(
                tenant_id=tenant_id,
                org_id=org_id,
                material_id=material_id,
                material_name="",
                target_month=target_month,
                p10=round(p50 * 0.7, 6),
                p50=round(p50, 6),
                p90=round(p50 * 1.3, 6),
                strategy="lightgbm",
                model_version=model_version,
            )
        if strategy == "croston_sba":
            p10, p50, p90, strategy = _croston_or_baseline(history, target_month)
        else:
            p10, p50, p90 = baseline_forecast(history, target_month)
            strategy = "baseline"
    except Exception:
        p10, p50, p90 = baseline_forecast(history, target_month)
        strategy = "baseline"

    return ForecastRow(
        tenant_id=tenant_id,
        org_id=org_id,
        material_id=material_id,
        material_name="",
        target_month=target_month,
        p10=p10,
        p50=p50,
        p90=p90,
        strategy=strategy,
        model_version=model_version,
    )


def predict_demand(
    *,
    tenant_id: str,
    org_id: str,
    material_ids: list[str],
    target_month: date,
    model_dir: Path | None = None,
    engine=None,
    schema: str = "sandbox_v1",
    org_ids: list[str] | None = None,
    history_start_date: str | None = None,
    history_end_date: str | None = None,
) -> list[ForecastRow]:
    normalized_material_ids = [str(material_id) for material_id in material_ids]
    try:
        resolved_engine = engine or get_engine()
        history = _load_history(
            engine=resolved_engine,
            tenant_id=tenant_id,
            org_id=org_id,
            org_ids=org_ids,
            material_ids=normalized_material_ids,
            schema=schema,
            history_start_date=history_start_date,
            history_end_date=history_end_date,
        )
    except Exception:
        history = _empty_history()

    model, model_version = _load_model(model_dir)

    supplementary_map: dict[str, dict] = {}
    if model is not None:
        try:
            supplementary_map = _load_supplementary_features(
                engine=resolved_engine,
                tenant_id=tenant_id,
                org_id=org_id,
                org_ids=org_ids,
                material_ids=normalized_material_ids,
                target_month=target_month,
                schema=schema,
            )
        except Exception:
            pass

    rows: list[ForecastRow] = []
    for material_id in normalized_material_ids:
        try:
            material_history = history.loc[history["material_id"] == material_id].copy()
        except Exception:
            material_history = _empty_history()
        rows.append(
            _predict_one(
                tenant_id=tenant_id,
                org_id=org_id,
                material_id=material_id,
                target_month=target_month,
                history=material_history,
                model=model,
                model_version=model_version,
                supplementary=supplementary_map.get(material_id, {}),
            )
        )
    return rows
