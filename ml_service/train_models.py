from __future__ import annotations

from datetime import datetime
from pathlib import Path
import platform
import sys
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn import __version__ as sklearn_version
from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, GroupShuffleSplit, KFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVR

ROOT_DIR = Path(__file__).resolve().parents[1]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_service.app.core import (
    ARTIFACTS_DIR,
    FEATURE_SCHEMA_VERSION,
    MODEL_VERSION,
    NOTEBOOK_SOURCE,
    NOTEBOOK_SVR_CONFIGS,
    TARGET_NAME,
    build_training_frame,
    get_model_feature_spec,
    prepare_training_dataframe,
    save_json,
)

HOLDOUT_RATIO = 0.2
TEMPORAL_TEST_FRACTION = 0.2
MAX_CV_SPLITS = 5


def safe_r2_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) < 2:
        return float("nan")
    return float(r2_score(y_true, y_pred))


def metric_bundle(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    absolute_error = np.abs(y_true - y_pred)
    safe_true = np.where(np.abs(y_true) < 1e-9, np.nan, np.abs(y_true))
    percentage_error = np.where(np.isnan(safe_true), np.nan, absolute_error / safe_true)

    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mape": float(mean_absolute_percentage_error(y_true, y_pred)),
        "r2": safe_r2_score(y_true, y_pred),
        "median_absolute_error": float(np.median(absolute_error)),
        "within_10pct_ratio": float(np.nanmean(percentage_error <= 0.10)),
        "within_20pct_ratio": float(np.nanmean(percentage_error <= 0.20)),
        "within_30pct_ratio": float(np.nanmean(percentage_error <= 0.30)),
    }


def summarize_metric_list(metric_list: list[dict[str, float]]) -> dict[str, dict[str, float]]:
    if not metric_list:
        return {}

    summary: dict[str, dict[str, float]] = {}
    for key in metric_list[0]:
        values = np.array([item[key] for item in metric_list], dtype=float)
        summary[key] = {
            "mean": float(np.nanmean(values)),
            "std": float(np.nanstd(values)),
            "min": float(np.nanmin(values)),
            "max": float(np.nanmax(values)),
        }
    return summary


def build_preprocessor(model_key: str) -> ColumnTransformer:
    spec = get_model_feature_spec(model_key)
    return ColumnTransformer(
        transformers=[
            (
                "numeric",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                spec["numeric_features"],
            ),
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                spec["categorical_features"],
            ),
        ]
    )


def build_pipeline(model_key: str) -> Pipeline:
    config = NOTEBOOK_SVR_CONFIGS[model_key]
    estimator = SVR(
        kernel=str(config["kernel"]),
        C=float(config["C"]),
        epsilon=float(config["epsilon"]),
        gamma=config["gamma"],
    )

    return Pipeline(
        [
            ("preprocessor", build_preprocessor(model_key)),
            ("model", estimator),
        ]
    )


def build_random_holdout_indices(groups: pd.Series, row_count: int) -> tuple[np.ndarray, np.ndarray, str]:
    unique_group_count = int(groups.nunique())
    if unique_group_count >= 2:
        splitter = GroupShuffleSplit(n_splits=1, test_size=HOLDOUT_RATIO, random_state=42)
        train_idx, test_idx = next(splitter.split(np.arange(row_count), groups=groups))
        return train_idx, test_idx, "GroupShuffleSplit"

    train_idx, test_idx = train_test_split(
        np.arange(row_count),
        test_size=HOLDOUT_RATIO,
        random_state=42,
        shuffle=True,
    )
    return np.asarray(train_idx), np.asarray(test_idx), "train_test_split"


def build_cv_iterator(groups: pd.Series, row_count: int) -> tuple[Any, str, int]:
    unique_group_count = int(groups.nunique())
    if unique_group_count >= 2:
        split_count = max(2, min(MAX_CV_SPLITS, unique_group_count))
        return GroupKFold(n_splits=split_count), "GroupKFold", split_count

    split_count = max(2, min(MAX_CV_SPLITS, max(2, row_count // 10)))
    return KFold(n_splits=split_count, shuffle=True, random_state=42), "KFold", split_count


def build_cross_validation_report(
    model_key: str,
    pipeline: Pipeline,
    X: pd.DataFrame,
    y_log: pd.Series,
    y_raw: np.ndarray,
    groups: pd.Series,
) -> dict[str, Any]:
    iterator, strategy, split_count = build_cv_iterator(groups, len(X))
    fold_metrics: list[dict[str, Any]] = []

    split_iterable = iterator.split(X, groups=groups) if strategy == "GroupKFold" else iterator.split(X)

    for fold_number, (train_idx, valid_idx) in enumerate(split_iterable, start=1):
        model = clone(pipeline)
        model.fit(X.iloc[train_idx], y_log.iloc[train_idx])
        predictions = np.expm1(model.predict(X.iloc[valid_idx]))
        fold_metrics.append(
            {
                "fold": fold_number,
                "n_train": int(len(train_idx)),
                "n_valid": int(len(valid_idx)),
                "metrics": metric_bundle(y_raw[valid_idx], predictions),
            }
        )

    return {
        "strategy": strategy,
        "split_count": split_count,
        "fold_metrics": fold_metrics,
        "summary": summarize_metric_list([item["metrics"] for item in fold_metrics]),
    }


def build_temporal_holdout_report(
    model_key: str,
    ordered_df: pd.DataFrame,
) -> dict[str, Any] | None:
    if len(ordered_df) < 10:
        return None

    cut_position = int(len(ordered_df) * (1 - TEMPORAL_TEST_FRACTION))
    if cut_position <= 0 or cut_position >= len(ordered_df):
        return None

    temporal_train = ordered_df.iloc[:cut_position].copy()
    temporal_test = ordered_df.iloc[cut_position:].copy()

    X_train, y_train_log = build_training_frame(temporal_train, model_key)
    X_test, _ = build_training_frame(temporal_test, model_key)
    y_test_raw = temporal_test["WinnerPrice"].to_numpy(dtype=float)

    model = build_pipeline(model_key)
    model.fit(X_train, y_train_log)
    predictions = np.expm1(model.predict(X_test))
    baseline_predictions = temporal_test["TenderPrice"].to_numpy(dtype=float)

    return {
        "train_rows": int(len(temporal_train)),
        "test_rows": int(len(temporal_test)),
        "train_period": {
            "start": temporal_train["offer_date_final"].min().date().isoformat(),
            "end": temporal_train["offer_date_final"].max().date().isoformat(),
        },
        "test_period": {
            "start": temporal_test["offer_date_final"].min().date().isoformat(),
            "end": temporal_test["offer_date_final"].max().date().isoformat(),
        },
        "metrics": metric_bundle(y_test_raw, predictions),
        "baseline_tender_price_metrics": metric_bundle(y_test_raw, baseline_predictions),
    }


def determine_validation_summary(model_key: str, model_metrics: dict[str, float], baseline_metrics: dict[str, float]) -> str:
    if model_key == "hybrid":
        if baseline_metrics["mae"] <= model_metrics["mae"]:
            return (
                "Model SVR hybrid telah disejajarkan ke notebook terbaru, tetapi baseline tender price masih lebih baik sehingga model diposisikan sebagai benchmark."
            )
        return (
            "Model SVR hybrid telah disejajarkan ke notebook terbaru dan tetap diposisikan sebagai benchmark terbatas."
        )

    return (
        "Model SVR project-only disimpan untuk membandingkan skenario tanpa tender price, tetapi validasinya tetap terbatas untuk benchmark."
    )


def train_model_family(
    model_key: str,
    training_df: pd.DataFrame,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], Pipeline]:
    spec = get_model_feature_spec(model_key)
    scenario_config = NOTEBOOK_SVR_CONFIGS[model_key]

    X, y_log = build_training_frame(training_df, model_key)
    y_raw = training_df["WinnerPrice"].to_numpy(dtype=float)
    groups = training_df["tender_group_id"].fillna("").astype(str)

    train_idx, test_idx, split_strategy = build_random_holdout_indices(groups, len(training_df))
    train_groups = groups.iloc[train_idx]

    pipeline = build_pipeline(model_key)
    pipeline.fit(X.iloc[train_idx], y_log.iloc[train_idx])

    random_holdout_predictions = np.expm1(pipeline.predict(X.iloc[test_idx]))
    random_holdout_metrics = metric_bundle(y_raw[test_idx], random_holdout_predictions)
    baseline_predictions = training_df.iloc[test_idx]["TenderPrice"].to_numpy(dtype=float)
    baseline_metrics = metric_bundle(y_raw[test_idx], baseline_predictions)

    cv_report = build_cross_validation_report(
        model_key=model_key,
        pipeline=pipeline,
        X=X.iloc[train_idx].reset_index(drop=True),
        y_log=y_log.iloc[train_idx].reset_index(drop=True),
        y_raw=y_raw[train_idx],
        groups=train_groups.reset_index(drop=True),
    )

    ordered_df = training_df.sort_values("offer_date_final").reset_index(drop=True)
    temporal_report = build_temporal_holdout_report(model_key, ordered_df)
    validation_summary = determine_validation_summary(model_key, random_holdout_metrics, baseline_metrics)

    final_pipeline = build_pipeline(model_key)
    final_pipeline.fit(X, y_log)

    contract = {
        "model_key": model_key,
        "display_name": spec["display_name"],
        "model_version": MODEL_VERSION,
        "schema_version": FEATURE_SCHEMA_VERSION,
        "runtime_feature_keys": spec["runtime_feature_keys"],
        "numeric_features": spec["numeric_features"],
        "categorical_features": spec["categorical_features"],
        "feature_semantics": spec.get("feature_semantics", {}),
        "runtime_enabled": True,
        "validation_state": "limited",
        "validation_summary": validation_summary,
        "chosen_model_family": "svr_linear",
        "holdout_metrics": random_holdout_metrics,
        "scenario_id": scenario_config["scenario_id"],
        "scenario_label": scenario_config["scenario_label"],
        "hyperparameters": {
            "kernel": scenario_config["kernel"],
            "C": scenario_config["C"],
            "epsilon": scenario_config["epsilon"],
            "gamma": scenario_config["gamma"],
        },
        "source_notebook": NOTEBOOK_SOURCE,
    }

    metadata = {
        "display_name": spec["display_name"],
        "model_version": MODEL_VERSION,
        "trained_at": datetime.utcnow().isoformat(),
        "target_column": TARGET_NAME,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_count": int(len(spec["runtime_feature_keys"])),
        "runtime_enabled": True,
        "validation_state": "limited",
        "validation_summary": validation_summary,
        "chosen_model_family": "svr_linear",
        "scenario_id": scenario_config["scenario_id"],
        "scenario_label": scenario_config["scenario_label"],
        "hyperparameters": contract["hyperparameters"],
        "holdout_metrics": random_holdout_metrics,
        "baseline_tender_price_metrics": baseline_metrics,
        "cross_validation": cv_report,
        "temporal_holdout": temporal_report,
        "training_rows": int(len(training_df)),
        "random_holdout_rows": int(len(test_idx)),
        "random_holdout_split_strategy": split_strategy,
        "source_notebook": NOTEBOOK_SOURCE,
    }

    evaluation_report = {
        "model_key": model_key,
        "scenario_id": scenario_config["scenario_id"],
        "scenario_label": scenario_config["scenario_label"],
        "fixed_model_family": "svr_linear",
        "fixed_hyperparameters": contract["hyperparameters"],
        "random_holdout": {
            "split_strategy": split_strategy,
            "train_rows": int(len(train_idx)),
            "test_rows": int(len(test_idx)),
            "metrics": random_holdout_metrics,
            "baseline_tender_price_metrics": baseline_metrics,
        },
        "cross_validation": cv_report,
        "temporal_holdout": temporal_report,
        "source_notebook": NOTEBOOK_SOURCE,
    }

    return metadata, contract, evaluation_report, final_pipeline


def persist_model_outputs(
    model_key: str,
    contract: dict[str, Any],
    pipeline: Pipeline,
) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    save_json(ARTIFACTS_DIR / f"{model_key}_feature_contract.json", contract)
    joblib.dump(pipeline, ARTIFACTS_DIR / f"{model_key}_model.joblib")


def main() -> None:
    training_df, dataset_audit = prepare_training_dataframe(include_audit=True)

    metadata_by_model: dict[str, Any] = {}
    evaluation_report: dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat(),
        "model_version": MODEL_VERSION,
        "target_name": TARGET_NAME,
        "source_notebook": NOTEBOOK_SOURCE,
        "dataset_audit": dataset_audit,
        "models": {},
    }

    for model_key in ["project_only", "hybrid"]:
        metadata, contract, model_evaluation_report, pipeline = train_model_family(model_key, training_df)
        metadata_by_model[model_key] = metadata
        evaluation_report["models"][model_key] = model_evaluation_report
        persist_model_outputs(model_key, contract, pipeline)

    save_json(ARTIFACTS_DIR / "dataset_audit.json", dataset_audit)
    save_json(ARTIFACTS_DIR / "evaluation_report.json", evaluation_report)
    save_json(
        ARTIFACTS_DIR / "model_metadata.json",
        {
            "target_name": TARGET_NAME,
            "generated_at": datetime.utcnow().isoformat(),
            "model_version": MODEL_VERSION,
            "source_notebook": NOTEBOOK_SOURCE,
            "dataset_audit_version": dataset_audit["dataset_version"],
            "training_environment": {
                "python_version": platform.python_version(),
                "numpy_version": np.__version__,
                "pandas_version": pd.__version__,
                "scikit_learn_version": sklearn_version,
                "joblib_version": joblib.__version__,
            },
            "models": metadata_by_model,
        },
    )
    print("Notebook-aligned SVR artifacts berhasil digenerasi di ml_service/artifacts/")


if __name__ == "__main__":
    main()
