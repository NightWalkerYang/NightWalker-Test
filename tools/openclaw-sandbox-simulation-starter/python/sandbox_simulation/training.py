from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import json
import math
from typing import Iterable

from .dataset import (
    CATEGORICAL_FEATURE_COLUMNS,
    NUMERIC_FEATURE_COLUMNS,
    TARGET_COLUMN,
    choose_forecast_strategy,
)


@dataclass(frozen=True)
class TrainingArtifacts:
    metrics_path: Path
    predictions_path: Path
    strategies_path: Path
    model_path: Path | None = None


def moving_average_forecast(values: Iterable[float], *, window_size: int = 3) -> float:
    normalized = [float(value) for value in values]
    if not normalized:
        return 0.0
    effective_window = max(1, min(int(window_size), len(normalized)))
    window = normalized[-effective_window:]
    return sum(window) / len(window)


def croston_sba_forecast(values: Iterable[float], *, alpha: float = 0.1) -> float:
    series = [max(float(value), 0.0) for value in values]
    if not series or max(series) <= 0:
        return 0.0

    demand_estimate = None
    interval_estimate = None
    interval_since_last_demand = 0

    for observation in series:
        interval_since_last_demand += 1
        if observation <= 0:
            continue
        if demand_estimate is None:
            demand_estimate = observation
            interval_estimate = float(interval_since_last_demand)
        else:
            demand_estimate = demand_estimate + alpha * (observation - demand_estimate)
            interval_estimate = interval_estimate + alpha * (
                interval_since_last_demand - interval_estimate
            )
        interval_since_last_demand = 0

    if not demand_estimate or not interval_estimate:
        return 0.0
    return max((1 - alpha / 2.0) * (demand_estimate / interval_estimate), 0.0)


def compute_regression_metrics(*, actual: Iterable[float], predicted: Iterable[float]) -> dict[str, float]:
    actual_values = [float(value) for value in actual]
    predicted_values = [float(value) for value in predicted]
    if len(actual_values) != len(predicted_values):
        raise ValueError("actual and predicted must have the same length")
    if not actual_values:
        return {
            "mae": 0.0,
            "rmse": 0.0,
            "wape": 0.0,
            "bias": 0.0,
        }

    absolute_errors = [abs(a - p) for a, p in zip(actual_values, predicted_values)]
    squared_errors = [(a - p) ** 2 for a, p in zip(actual_values, predicted_values)]
    signed_errors = [p - a for a, p in zip(actual_values, predicted_values)]
    total_actual = sum(abs(value) for value in actual_values)

    mae = sum(absolute_errors) / len(absolute_errors)
    rmse = math.sqrt(sum(squared_errors) / len(squared_errors))
    wape = (sum(absolute_errors) / total_actual) if total_actual else 0.0
    bias = sum(signed_errors) / len(signed_errors)
    return {
        "mae": round(mae, 6),
        "rmse": round(rmse, 6),
        "wape": round(wape, 6),
        "bias": round(bias, 6),
    }


def load_feature_frame(*, dsn: str, query: str):
    import pandas as pd
    from sqlalchemy import create_engine

    engine = create_engine(dsn)
    try:
        frame = pd.read_sql_query(query, engine)
    finally:
        engine.dispose()
    if "target_month" in frame.columns:
        frame["target_month"] = pd.to_datetime(frame["target_month"]).dt.normalize()
    return frame


def split_frame_by_month(frame, *, train_end: str, validation_end: str):
    import pandas as pd

    if "target_month" not in frame.columns:
        raise ValueError("frame must contain target_month")
    train_end_ts = pd.Timestamp(train_end)
    validation_end_ts = pd.Timestamp(validation_end)
    train_frame = frame.loc[frame["target_month"] <= train_end_ts].copy()
    validation_frame = frame.loc[
        (frame["target_month"] > train_end_ts)
        & (frame["target_month"] <= validation_end_ts)
    ].copy()
    test_frame = frame.loc[frame["target_month"] > validation_end_ts].copy()
    return train_frame, validation_frame, test_frame


def summarize_material_strategies(frame):
    summary = (
        frame.groupby(["tenant_id", "org_id", "material_id"], dropna=False)
        .agg(
            observation_count=("target_month", "count"),
            nonzero_observation_count=(TARGET_COLUMN, lambda values: int((values > 0).sum())),
        )
        .reset_index()
    )
    summary["strategy"] = summary.apply(
        lambda row: choose_forecast_strategy(
            observation_count=int(row["observation_count"]),
            nonzero_observation_count=int(row["nonzero_observation_count"]),
        ),
        axis=1,
    )
    return summary


def train_lightgbm_regressor(train_frame, validation_frame):
    import lightgbm as lgb

    feature_columns = CATEGORICAL_FEATURE_COLUMNS + NUMERIC_FEATURE_COLUMNS
    x_train = train_frame[feature_columns].copy()
    x_validation = validation_frame[feature_columns].copy()
    for column in CATEGORICAL_FEATURE_COLUMNS:
        if column in x_train.columns:
            x_train[column] = x_train[column].astype("category")
        if column in x_validation.columns:
            x_validation[column] = x_validation[column].astype("category")
    regressor = lgb.LGBMRegressor(
        objective="regression",
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=31,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    regressor.fit(
        x_train,
        train_frame[TARGET_COLUMN],
        eval_set=[(x_validation, validation_frame[TARGET_COLUMN])]
        if not validation_frame.empty
        else None,
        eval_metric="l1",
    )
    return regressor


def generate_strategy_predictions(frame, strategies, *, lightgbm_model=None):
    import pandas as pd

    latest_by_material = (
        frame.sort_values(["tenant_id", "org_id", "material_id", "target_month"])
        .groupby(["tenant_id", "org_id", "material_id"], as_index=False)
        .tail(1)
        .copy()
    )
    latest_by_material = latest_by_material.merge(
        strategies[["tenant_id", "org_id", "material_id", "strategy"]],
        on=["tenant_id", "org_id", "material_id"],
        how="left",
    )

    records = []
    feature_columns = CATEGORICAL_FEATURE_COLUMNS + NUMERIC_FEATURE_COLUMNS
    for row in latest_by_material.itertuples(index=False):
        history = (
            frame.loc[
                (frame["tenant_id"] == row.tenant_id)
                & (frame["org_id"] == row.org_id)
                & (frame["material_id"] == row.material_id)
            ]
            .sort_values("target_month")[TARGET_COLUMN]
            .tolist()
        )
        strategy = row.strategy or "baseline"
        if strategy == "croston_sba":
            forecast_qty = croston_sba_forecast(history)
        elif strategy == "lightgbm" and lightgbm_model is not None:
            row_frame = pd.DataFrame([{column: getattr(row, column) for column in feature_columns}])
            for column in CATEGORICAL_FEATURE_COLUMNS:
                if column in row_frame.columns:
                    row_frame[column] = row_frame[column].astype("category")
            forecast_qty = float(lightgbm_model.predict(row_frame)[0])
        else:
            forecast_qty = moving_average_forecast(history, window_size=3)
            strategy = "baseline"

        records.append(
            {
                "tenant_id": row.tenant_id,
                "org_id": row.org_id,
                "material_id": row.material_id,
                "strategy": strategy,
                "target_month": row.target_month,
                "predicted_next_month_qty": round(float(max(forecast_qty, 0.0)), 6),
            }
        )

    return pd.DataFrame.from_records(records)


def write_training_outputs(
    *,
    output_dir: Path,
    metrics: dict[str, float],
    predictions_frame,
    strategies_frame,
    lightgbm_model=None,
) -> TrainingArtifacts:
    output_dir.mkdir(parents=True, exist_ok=True)
    metrics_path = output_dir / "metrics.json"
    predictions_path = output_dir / "predictions.csv"
    strategies_path = output_dir / "strategies.csv"
    metrics_path.write_text(json.dumps(metrics, indent=2, ensure_ascii=True), encoding="utf-8")
    predictions_frame.to_csv(predictions_path, index=False)
    strategies_frame.to_csv(strategies_path, index=False)

    model_path = None
    if lightgbm_model is not None:
        import joblib

        model_path = output_dir / "lightgbm_model.joblib"
        joblib.dump(lightgbm_model, model_path)
    return TrainingArtifacts(
        metrics_path=metrics_path,
        predictions_path=predictions_path,
        strategies_path=strategies_path,
        model_path=model_path,
    )


def build_metrics_payload(
    *,
    tenant_id: str,
    org_id: str,
    model_version: str,
    strategies_frame,
    validation_mape: dict[str, float | None],
    rmse: dict[str, float | None],
) -> dict:
    distribution = strategies_frame["strategy"].value_counts().to_dict()
    return {
        "tenant_id": tenant_id,
        "org_id": org_id,
        "model_version": model_version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "strategy_distribution": {
            "lightgbm": int(distribution.get("lightgbm", 0)),
            "croston_sba": int(distribution.get("croston_sba", 0)),
            "baseline": int(distribution.get("baseline", 0)),
        },
        "validation_mape": validation_mape,
        "rmse": rmse,
    }


def create_model_version() -> str:
    return datetime.now().strftime("%Y%m%d%H%M")
