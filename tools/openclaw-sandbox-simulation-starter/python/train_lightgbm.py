from __future__ import annotations

import argparse
from pathlib import Path

from sandbox_simulation.dataset import (
    CATEGORICAL_FEATURE_COLUMNS,
    NUMERIC_FEATURE_COLUMNS,
    TARGET_COLUMN,
    build_feature_query,
)
from sandbox_simulation.training import (
    build_metrics_payload,
    compute_regression_metrics,
    create_model_version,
    generate_strategy_predictions,
    load_feature_frame,
    split_frame_by_month,
    summarize_material_strategies,
    train_lightgbm_regressor,
    write_training_outputs,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train the sandbox simulation demand forecasting starter described in SANDBOX_SIMULATION_OPENCLAW_DEPLOYMENT.md."
    )
    parser.add_argument("--dsn", required=True, help="PostgreSQL SQLAlchemy DSN")
    parser.add_argument("--schema", default="sandbox_v1", help="Sandbox schema name")
    parser.add_argument("--tenant-id", help="Optional tenant filter")
    parser.add_argument("--org-id", help="Optional organization filter")
    parser.add_argument("--min-stat-month", help="Optional lower stat_month filter, YYYY-MM-DD")
    parser.add_argument("--max-stat-month", help="Optional upper stat_month filter, YYYY-MM-DD")
    parser.add_argument("--train-end", required=True, help="Last month included in the training split, YYYY-MM-DD")
    parser.add_argument(
        "--validation-end",
        required=True,
        help="Last month included in the validation split, YYYY-MM-DD",
    )
    parser.add_argument(
        "--output-dir",
        default="tools/openclaw-sandbox-simulation-starter/output",
        help="Directory where metrics, predictions, and model artifacts will be written",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    query = build_feature_query(
        schema=args.schema,
        tenant_id=args.tenant_id,
        org_id=args.org_id,
        min_stat_month=args.min_stat_month,
        max_stat_month=args.max_stat_month,
    )
    frame = load_feature_frame(dsn=args.dsn, query=query)
    if frame.empty:
        raise SystemExit("No training rows returned from feature table")

    train_frame, validation_frame, test_frame = split_frame_by_month(
        frame,
        train_end=args.train_end,
        validation_end=args.validation_end,
    )
    if train_frame.empty:
        raise SystemExit("Training split is empty")

    strategies = summarize_material_strategies(train_frame)
    lightgbm_materials = strategies.loc[strategies["strategy"] == "lightgbm", "material_id"].tolist()
    model_version = create_model_version()

    model = None
    lightgbm_metrics = {
        "mae": 0.0,
        "rmse": 0.0,
        "wape": 0.0,
        "bias": 0.0,
    }
    if lightgbm_materials:
        lightgbm_train = train_frame.loc[train_frame["material_id"].isin(lightgbm_materials)].copy()
        lightgbm_validation = validation_frame.loc[
            validation_frame["material_id"].isin(lightgbm_materials)
        ].copy()
        if not lightgbm_validation.empty:
            model = train_lightgbm_regressor(lightgbm_train, lightgbm_validation)
            feature_columns = CATEGORICAL_FEATURE_COLUMNS + NUMERIC_FEATURE_COLUMNS
            validation_predictions = model.predict(lightgbm_validation[feature_columns])
            lightgbm_metrics = compute_regression_metrics(
                actual=lightgbm_validation[TARGET_COLUMN].tolist(),
                predicted=validation_predictions.tolist(),
            )

    prediction_source = test_frame if not test_frame.empty else frame
    predictions = generate_strategy_predictions(
        prediction_source,
        strategies,
        lightgbm_model=model,
    )
    metrics = build_metrics_payload(
        tenant_id=args.tenant_id or "all",
        org_id=args.org_id or "all",
        model_version=model_version,
        strategies_frame=strategies,
        validation_mape={
            "lightgbm": lightgbm_metrics["wape"] if model is not None else None,
            "croston_sba": None,
            "baseline": None,
        },
        rmse={
            "lightgbm": lightgbm_metrics["rmse"] if model is not None else None,
            "croston_sba": None,
            "baseline": None,
        },
    )
    output_root = Path(args.output_dir)
    tenant_dir = output_root / "models" / (args.tenant_id or "all") / "demand_monthly"
    version_dir = tenant_dir / model_version
    artifacts = write_training_outputs(
        output_dir=version_dir,
        metrics=metrics,
        predictions_frame=predictions,
        strategies_frame=strategies,
        lightgbm_model=model,
    )
    tenant_dir.mkdir(parents=True, exist_ok=True)
    (tenant_dir / "current.txt").write_text(model_version, encoding="utf-8")

    print("Training completed")
    print(f"metrics: {artifacts.metrics_path}")
    print(f"predictions: {artifacts.predictions_path}")
    print(f"strategies: {artifacts.strategies_path}")
    if artifacts.model_path:
        print(f"model: {artifacts.model_path}")
    else:
        print("model: skipped (no lightgbm-routed materials in current split)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
