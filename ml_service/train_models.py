from __future__ import annotations

from datetime import datetime
from itertools import product
from pathlib import Path
import platform
import sys
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
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
    TARGET_NAME,
    build_training_frame,
    get_model_feature_spec,
    prepare_training_dataframe,
    save_json,
)

HOLDOUT_RATIO = 0.2
MIN_CV_SPLITS = 3
MAX_CV_SPLITS = 5


def build_outlier_mask(
    model_key: str,
    X_frame: pd.DataFrame,
    y_log: pd.Series,
) -> pd.Series:
    if model_key != "hybrid" or "EstimatedPriceLog" not in X_frame.columns:
        return pd.Series(True, index=X_frame.index)

    diff = y_log - X_frame["EstimatedPriceLog"]
    q1 = diff.quantile(0.25)
    q3 = diff.quantile(0.75)
    iqr = q3 - q1

    if pd.isna(iqr) or float(iqr) == 0.0:
        return pd.Series(True, index=X_frame.index)

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    return (diff >= lower_bound) & (diff <= upper_bound)


def summarize_numeric_distribution(values: np.ndarray) -> dict[str, float]:
    numeric_values = np.asarray(values, dtype=float)
    numeric_values = numeric_values[~np.isnan(numeric_values)]

    if len(numeric_values) == 0:
        return {
            "count": 0,
            "min": float("nan"),
            "p25": float("nan"),
            "median": float("nan"),
            "mean": float("nan"),
            "p75": float("nan"),
            "max": float("nan"),
            "std": float("nan"),
        }

    return {
        "count": int(len(numeric_values)),
        "min": float(np.min(numeric_values)),
        "p25": float(np.quantile(numeric_values, 0.25)),
        "median": float(np.median(numeric_values)),
        "mean": float(np.mean(numeric_values)),
        "p75": float(np.quantile(numeric_values, 0.75)),
        "max": float(np.max(numeric_values)),
        "std": float(np.std(numeric_values)),
    }


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
            "mean": float(values.mean()),
            "std": float(values.std()),
            "min": float(values.min()),
            "max": float(values.max()),
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


def build_parameter_grid(search_space: dict[str, list[Any]]) -> list[dict[str, Any]]:
    if not search_space:
        return [{}]

    keys = list(search_space.keys())
    combinations = product(*(search_space[key] for key in keys))
    return [dict(zip(keys, values, strict=True)) for values in combinations]


def candidate_specs() -> dict[str, dict[str, Any]]:
    return {
        "linear_regression": {
            "factory": lambda _params: LinearRegression(),
            "parameter_grid": [{}],
        },
        "svr_linear": {
            "factory": lambda params: SVR(
                kernel="linear",
                C=float(params["C"]),
                epsilon=float(params["epsilon"]),
            ),
            "parameter_grid": build_parameter_grid(
                {
                    "C": [0.1, 1.0, 10.0, 100.0],
                    "epsilon": [0.01, 0.1, 0.5],
                }
            ),
        },
        "svr_rbf": {
            "factory": lambda params: SVR(
                kernel="rbf",
                C=float(params["C"]),
                gamma=params["gamma"],
                epsilon=float(params["epsilon"]),
            ),
            "parameter_grid": build_parameter_grid(
                {
                    "C": [1.0, 10.0, 100.0],
                    "gamma": ["scale", "auto"],
                    "epsilon": [0.01, 0.1, 0.5],
                }
            ),
        },
        "random_forest": {
            "factory": lambda params: RandomForestRegressor(
                n_estimators=int(params["n_estimators"]),
                max_depth=params["max_depth"],
                min_samples_leaf=int(params["min_samples_leaf"]),
                min_samples_split=int(params["min_samples_split"]),
                random_state=42,
                n_jobs=-1,
            ),
            "parameter_grid": build_parameter_grid(
                {
                    "n_estimators": [200, 400],
                    "max_depth": [None, 12],
                    "min_samples_leaf": [1, 2],
                    "min_samples_split": [2, 5],
                }
            ),
        },
    }


def build_pipeline(model_key: str, estimator: Any) -> Pipeline:
    return Pipeline(
        [
            ("preprocessor", build_preprocessor(model_key)),
            ("model", estimator),
        ]
    )


def build_time_splits(row_count: int) -> tuple[np.ndarray, np.ndarray]:
    ordered_indices = np.arange(row_count)
    holdout_size = max(1, int(np.ceil(row_count * HOLDOUT_RATIO)))
    train_end = row_count - holdout_size
    return ordered_indices[:train_end], ordered_indices[train_end:]


def evaluate_baselines(y_train_raw: np.ndarray, y_test_raw: np.ndarray) -> dict[str, dict[str, float]]:
    median_prediction = np.repeat(np.median(y_train_raw), len(y_test_raw))
    mean_prediction = np.repeat(np.mean(y_train_raw), len(y_test_raw))

    return {
        "median": metric_bundle(y_test_raw, median_prediction),
        "mean": metric_bundle(y_test_raw, mean_prediction),
        "rule_based": {
            "mae": float("nan"),
            "rmse": float("nan"),
            "mape": float("nan"),
            "r2": float("nan"),
            "median_absolute_error": float("nan"),
            "within_10pct_ratio": float("nan"),
            "within_20pct_ratio": float("nan"),
            "within_30pct_ratio": float("nan"),
        },
    }


def evaluate_direct_estimate_baseline(
    model_key: str,
    X_holdout: pd.DataFrame,
    y_holdout_raw: np.ndarray,
) -> dict[str, float]:
    if model_key != "hybrid" or "EstimatedPriceLog" not in X_holdout.columns:
        return {
            "mae": float("nan"),
            "rmse": float("nan"),
            "mape": float("nan"),
            "r2": float("nan"),
            "median_absolute_error": float("nan"),
            "within_10pct_ratio": float("nan"),
            "within_20pct_ratio": float("nan"),
            "within_30pct_ratio": float("nan"),
        }

    direct_estimate_raw = np.expm1(X_holdout["EstimatedPriceLog"].to_numpy(dtype=float))
    return metric_bundle(y_holdout_raw, direct_estimate_raw)


def evaluate_candidate(
    model_key: str,
    candidate_name: str,
    estimator_factory: Callable[[dict[str, Any]], Any],
    parameter_grid: list[dict[str, Any]],
    X_train: pd.DataFrame,
    y_train_log: pd.Series,
    y_train_raw: np.ndarray,
    X_holdout: pd.DataFrame,
    y_holdout_raw: np.ndarray,
) -> dict[str, Any]:
    split_count = max(MIN_CV_SPLITS, min(MAX_CV_SPLITS, len(X_train) // 80))
    time_series_split = TimeSeriesSplit(n_splits=split_count)
    parameter_trials: list[dict[str, Any]] = []

    for params in parameter_grid:
        cv_metrics: list[dict[str, float]] = []

        for fold_train_idx, fold_test_idx in time_series_split.split(X_train):
            X_fold_train = X_train.iloc[fold_train_idx]
            X_fold_test = X_train.iloc[fold_test_idx]
            y_fold_train_log = y_train_log.iloc[fold_train_idx]
            y_fold_test_raw = y_train_raw[fold_test_idx]
            fold_mask = build_outlier_mask(model_key, X_fold_train, y_fold_train_log)

            pipeline = build_pipeline(model_key, estimator_factory(params))
            pipeline.fit(X_fold_train.loc[fold_mask], y_fold_train_log.loc[fold_mask])
            fold_pred_raw = np.expm1(pipeline.predict(X_fold_test))
            cv_metrics.append(metric_bundle(y_fold_test_raw, fold_pred_raw))

        summary = summarize_metric_list(cv_metrics)
        parameter_trials.append(
            {
                "params": params,
                "cross_validation": {
                    "split_strategy": "time_series_split",
                    "split_count": split_count,
                    "fold_metrics": cv_metrics,
                    "summary": summary,
                },
                "ranking_score_mae": summary["mae"]["mean"],
            }
        )

    best_trial = min(
        parameter_trials,
        key=lambda item: (
            item["ranking_score_mae"],
            item["cross_validation"]["summary"]["rmse"]["mean"],
        ),
    )

    train_mask = build_outlier_mask(model_key, X_train, y_train_log)
    final_pipeline = build_pipeline(model_key, estimator_factory(best_trial["params"]))
    final_pipeline.fit(X_train.loc[train_mask], y_train_log.loc[train_mask])
    holdout_pred_raw = np.expm1(final_pipeline.predict(X_holdout))

    return {
        "candidate_name": candidate_name,
        "best_params": best_trial["params"],
        "tested_parameter_count": len(parameter_grid),
        "training_rows_after_outlier_filter": int(train_mask.sum()),
        "training_rows_before_outlier_filter": int(len(X_train)),
        "parameter_trials": parameter_trials,
        "cross_validation": best_trial["cross_validation"],
        "holdout_metrics": metric_bundle(y_holdout_raw, holdout_pred_raw),
    }


def choose_best_candidate(results: list[dict[str, Any]]) -> dict[str, Any]:
    return min(
        results,
        key=lambda item: (
            item["holdout_metrics"]["mae"],
            item["holdout_metrics"]["rmse"],
        ),
    )


def determine_validation_state(
    model_key: str,
    model_metrics: dict[str, float],
    baseline_metrics: dict[str, dict[str, float]],
) -> tuple[str, str]:
    median_mae = baseline_metrics["median"]["mae"]
    beats_baseline = model_metrics["mae"] < median_mae
    baseline_improvement = (median_mae - model_metrics["mae"]) / median_mae if median_mae else 0.0
    direct_estimate_metrics = baseline_metrics.get("direct_estimate")
    direct_estimate_available = bool(
        direct_estimate_metrics and not np.isnan(float(direct_estimate_metrics["mae"]))
    )
    beats_direct_estimate = (
        direct_estimate_available
        and model_metrics["mae"] < float(direct_estimate_metrics["mae"])
    )

    if (
        model_key == "hybrid"
        and direct_estimate_available
        and not beats_direct_estimate
        and beats_baseline
    ):
        return (
            "limited",
            "Model mengungguli baseline median, tetapi belum mengalahkan baseline estimasi langsung.",
        )

    if beats_baseline and model_metrics["r2"] > 0 and baseline_improvement >= 0.1:
        return (
            "production_ready",
            "Model mengungguli baseline median dengan margin sehat pada holdout berbasis waktu.",
        )

    if beats_baseline:
        return (
            "limited",
            "Model sedikit mengungguli baseline median, tetapi kualitas holdout belum cukup kuat untuk klaim production-ready.",
        )

    return (
        "blocked",
        "Model tidak mengungguli baseline median pada holdout berbasis waktu.",
    )


def build_holdout_residual_analysis(
    model_key: str,
    X_holdout: pd.DataFrame,
    y_holdout_raw: np.ndarray,
    holdout_predictions: np.ndarray,
) -> dict[str, Any]:
    model_residuals = y_holdout_raw - holdout_predictions
    analysis: dict[str, Any] = {
        "model_residuals": summarize_numeric_distribution(model_residuals),
        "absolute_model_residuals": summarize_numeric_distribution(np.abs(model_residuals)),
    }

    if model_key == "hybrid" and "EstimatedPriceLog" in X_holdout.columns:
        direct_estimate_raw = np.expm1(X_holdout["EstimatedPriceLog"].to_numpy(dtype=float))
        estimate_residuals = y_holdout_raw - direct_estimate_raw
        direct_estimate_metrics = metric_bundle(y_holdout_raw, direct_estimate_raw)
        model_metrics = metric_bundle(y_holdout_raw, holdout_predictions)
        analysis["direct_estimate_metrics"] = direct_estimate_metrics
        analysis["estimate_residuals"] = summarize_numeric_distribution(estimate_residuals)
        analysis["absolute_estimate_residuals"] = summarize_numeric_distribution(
            np.abs(estimate_residuals)
        )
        analysis["model_vs_direct_estimate"] = {
            "mae_delta": float(direct_estimate_metrics["mae"] - model_metrics["mae"]),
            "rmse_delta": float(direct_estimate_metrics["rmse"] - model_metrics["rmse"]),
            "mape_delta": float(direct_estimate_metrics["mape"] - model_metrics["mape"]),
        }

    return analysis


def build_price_band_labels(values: pd.Series) -> pd.Series:
    q1 = values.quantile(0.33)
    q2 = values.quantile(0.66)

    def label(value: float) -> str:
        if value <= q1:
            return "low"
        if value <= q2:
            return "mid"
        return "high"

    return values.astype(float).apply(label)


def segmented_metrics(
    segment_values: pd.Series,
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> dict[str, Any]:
    metrics_by_segment: dict[str, Any] = {}

    for segment in sorted(segment_values.astype(str).unique()):
        mask = segment_values.astype(str) == segment
        if mask.sum() == 0:
            continue
        metrics_by_segment[segment] = {
            "count": int(mask.sum()),
            "metrics": metric_bundle(y_true[mask.to_numpy()], y_pred[mask.to_numpy()]),
        }

    return metrics_by_segment


def train_model_family(
    model_key: str,
    training_df: pd.DataFrame,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], Pipeline | None]:
    spec = get_model_feature_spec(model_key)
    try:
        X, y_log = build_training_frame(training_df, model_key)
    except ValueError as error:
        contract = {
            "model_key": model_key,
            "display_name": spec["display_name"],
            "model_version": MODEL_VERSION,
            "schema_version": FEATURE_SCHEMA_VERSION,
            "runtime_feature_keys": spec["runtime_feature_keys"],
            "numeric_features": spec["numeric_features"],
            "categorical_features": spec["categorical_features"],
            "feature_semantics": spec.get("feature_semantics", {}),
            "runtime_enabled": False,
            "validation_state": "blocked",
            "validation_summary": str(error),
            "chosen_model_family": None,
            "holdout_metrics": None,
        }
        metadata = {
            "display_name": spec["display_name"],
            "model_version": MODEL_VERSION,
            "trained_at": None,
            "target_column": TARGET_NAME,
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "validation_state": "blocked",
            "validation_summary": str(error),
            "chosen_model_family": None,
            "runtime_enabled": False,
        }
        return metadata, contract, {"model_key": model_key, "blocked_reason": str(error)}, None

    ordered_df = training_df.sort_values("Tgl. Penawaran").reset_index(drop=True)
    X, y_log = build_training_frame(ordered_df, model_key)
    y_raw = ordered_df["Harga Sebelum Approval"].to_numpy(dtype=float)

    train_idx, holdout_idx = build_time_splits(len(ordered_df))
    X_train = X.iloc[train_idx]
    X_holdout = X.iloc[holdout_idx]
    y_train_log = y_log.iloc[train_idx]
    y_train_raw = y_raw[train_idx]
    y_holdout_raw = y_raw[holdout_idx]

    baselines = evaluate_baselines(y_train_raw, y_holdout_raw)
    baselines["direct_estimate"] = evaluate_direct_estimate_baseline(
        model_key,
        X_holdout,
        y_holdout_raw,
    )

    candidate_results = [
        evaluate_candidate(
            model_key=model_key,
            candidate_name=candidate_name,
            estimator_factory=candidate_spec["factory"],
            parameter_grid=candidate_spec["parameter_grid"],
            X_train=X_train,
            y_train_log=y_train_log,
            y_train_raw=y_train_raw,
            X_holdout=X_holdout,
            y_holdout_raw=y_holdout_raw,
        )
        for candidate_name, candidate_spec in candidate_specs().items()
    ]

    best_candidate = choose_best_candidate(candidate_results)
    validation_state, validation_summary = determine_validation_state(
        model_key,
        best_candidate["holdout_metrics"],
        baselines,
    )

    full_training_mask = build_outlier_mask(model_key, X, y_log)

    final_pipeline = build_pipeline(
        model_key,
        candidate_specs()[best_candidate["candidate_name"]]["factory"](best_candidate["best_params"]),
    )
    final_pipeline.fit(X.loc[full_training_mask], y_log.loc[full_training_mask])
    holdout_pipeline = build_pipeline(
        model_key,
        candidate_specs()[best_candidate["candidate_name"]]["factory"](best_candidate["best_params"]),
    )
    holdout_train_mask = build_outlier_mask(model_key, X_train, y_train_log)
    holdout_pipeline.fit(X_train.loc[holdout_train_mask], y_train_log.loc[holdout_train_mask])
    holdout_predictions = np.expm1(holdout_pipeline.predict(X_holdout))
    holdout_residual_analysis = build_holdout_residual_analysis(
        model_key,
        X_holdout,
        y_holdout_raw,
        holdout_predictions,
    )

    segmented_holdout_metrics = {
        "project_type": segmented_metrics(
            ordered_df.iloc[holdout_idx]["Type of Project"],
            y_holdout_raw,
            holdout_predictions,
        ),
        "client_type": segmented_metrics(
            ordered_df.iloc[holdout_idx]["Type of Client"],
            y_holdout_raw,
            holdout_predictions,
        ),
        "price_band": segmented_metrics(
            build_price_band_labels(ordered_df.iloc[holdout_idx]["Harga Sebelum Approval"]),
            y_holdout_raw,
            holdout_predictions,
        ),
        "year": segmented_metrics(
            ordered_df.iloc[holdout_idx]["Year"].astype(str),
            y_holdout_raw,
            holdout_predictions,
        ),
        "quarter": segmented_metrics(
            ordered_df.iloc[holdout_idx]["Quarter"].astype(str),
            y_holdout_raw,
            holdout_predictions,
        ),
    }

    contract = {
        "model_key": model_key,
        "display_name": spec["display_name"],
        "model_version": MODEL_VERSION,
        "schema_version": FEATURE_SCHEMA_VERSION,
        "runtime_feature_keys": spec["runtime_feature_keys"],
        "numeric_features": spec["numeric_features"],
        "categorical_features": spec["categorical_features"],
        "feature_semantics": spec.get("feature_semantics", {}),
        "runtime_enabled": validation_state != "blocked",
        "validation_state": validation_state,
        "validation_summary": validation_summary,
        "chosen_model_family": best_candidate["candidate_name"],
        "holdout_metrics": best_candidate["holdout_metrics"],
    }

    metadata = {
        "display_name": spec["display_name"],
        "model_version": MODEL_VERSION,
        "trained_at": datetime.utcnow().isoformat(),
        "target_column": TARGET_NAME,
        "feature_schema_version": FEATURE_SCHEMA_VERSION,
        "feature_count": int(len(spec["runtime_feature_keys"])),
        "runtime_enabled": validation_state != "blocked",
        "validation_state": validation_state,
        "validation_summary": validation_summary,
        "chosen_model_family": best_candidate["candidate_name"],
        "holdout_metrics": best_candidate["holdout_metrics"],
        "baseline_metrics": baselines,
        "holdout_residual_analysis": holdout_residual_analysis,
        "segmented_holdout_metrics": segmented_holdout_metrics,
        "training_rows": int(len(X_train)),
        "training_rows_after_outlier_filter": int(holdout_train_mask.sum()),
        "holdout_rows": int(len(X_holdout)),
        "final_training_rows": int(len(X)),
        "final_training_rows_after_outlier_filter": int(full_training_mask.sum()),
    }

    evaluation_report = {
        "model_key": model_key,
        "split_policy": {
            "primary_strategy": "time_holdout",
            "holdout_ratio": HOLDOUT_RATIO,
            "cv_strategy": "time_series_split",
        },
        "outlier_policy": {
            "enabled": model_key == "hybrid",
            "method": "iqr_on_target_minus_estimated_price_log" if model_key == "hybrid" else None,
        },
        "baselines": baselines,
        "candidate_results": candidate_results,
        "chosen_candidate": best_candidate["candidate_name"],
        "chosen_candidate_params": best_candidate["best_params"],
        "holdout_residual_analysis": holdout_residual_analysis,
    }

    return metadata, contract, evaluation_report, final_pipeline


def persist_model_outputs(
    model_key: str,
    metadata: dict[str, Any],
    contract: dict[str, Any],
    pipeline: Pipeline | None,
) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    save_json(ARTIFACTS_DIR / f"{model_key}_feature_contract.json", contract)

    model_path = ARTIFACTS_DIR / f"{model_key}_model.joblib"
    if pipeline is None:
        if model_path.exists():
            model_path.unlink()
        return

    joblib.dump(pipeline, model_path)


def main() -> None:
    training_df, dataset_audit = prepare_training_dataframe(include_audit=True)

    metadata_by_model: dict[str, Any] = {}
    evaluation_report: dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat(),
        "model_version": MODEL_VERSION,
        "target_name": TARGET_NAME,
        "dataset_audit": dataset_audit,
        "models": {},
    }

    for model_key in ["project_only", "hybrid"]:
        metadata, contract, model_evaluation_report, pipeline = train_model_family(model_key, training_df)
        metadata_by_model[model_key] = metadata
        evaluation_report["models"][model_key] = model_evaluation_report
        persist_model_outputs(model_key, metadata, contract, pipeline)

    save_json(ARTIFACTS_DIR / "dataset_audit.json", dataset_audit)
    save_json(ARTIFACTS_DIR / "evaluation_report.json", evaluation_report)
    save_json(
        ARTIFACTS_DIR / "model_metadata.json",
        {
            "target_name": TARGET_NAME,
            "generated_at": datetime.utcnow().isoformat(),
            "model_version": MODEL_VERSION,
            "dataset_audit_version": dataset_audit["dataset_version"],
            "training_environment": {
                "python_version": platform.python_version(),
                "numpy_version": np.__version__,
                "pandas_version": pd.__version__,
                "scikit_learn_version": sys.modules["sklearn"].__version__,
                "joblib_version": joblib.__version__,
            },
            "models": metadata_by_model,
        },
    )
    print("Model training, audit, dan evaluasi selesai. Artefak tersimpan di ml_service/artifacts/")


if __name__ == "__main__":
    main()
