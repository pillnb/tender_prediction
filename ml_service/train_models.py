from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys

import joblib
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, mean_squared_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR

ROOT_DIR = Path(__file__).resolve().parents[1]

if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from ml_service.app.core import (
    ARTIFACTS_DIR,
    MODEL_VERSION,
    TARGET_NAME,
    build_model_frame,
    prepare_training_dataframe,
    save_json,
)


def train_single_model(model_key: str, include_harga_log: bool) -> dict[str, object]:
    df = prepare_training_dataframe()
    X, y = build_model_frame(df, include_harga_log)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("svr", SVR(kernel="linear", C=1, gamma="scale")),
        ]
    )
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_test_asli = np.expm1(y_test)
    y_pred_asli = np.expm1(y_pred)

    mae = mean_absolute_error(y_test_asli, y_pred_asli)
    rmse = np.sqrt(mean_squared_error(y_test_asli, y_pred_asli))
    mape = mean_absolute_percentage_error(y_test_asli, y_pred_asli)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, ARTIFACTS_DIR / f"{model_key}_model.joblib")
    save_json(
        ARTIFACTS_DIR / f"{model_key}_feature_contract.json",
        {
            "model_key": model_key,
            "target_name": TARGET_NAME,
            "feature_columns": X.columns.tolist(),
            "uses_harga_log": include_harga_log,
            "model_version": MODEL_VERSION,
        },
    )

    return {
        "model_name": "SVR Hybrid" if include_harga_log else "SVR Project-Only",
        "model_version": MODEL_VERSION,
        "trained_at": datetime.utcnow().isoformat(),
        "target_column": TARGET_NAME,
        "feature_count": int(len(X.columns)),
        "feature_columns": X.columns.tolist(),
        "preprocessing_rules_version": "notebook-aligned-v1",
        "metrics": {
            "mae": float(mae),
            "rmse": float(rmse),
            "mape": float(mape),
        },
    }


def main() -> None:
    project_only_metadata = train_single_model("project_only", include_harga_log=False)
    hybrid_metadata = train_single_model("hybrid", include_harga_log=True)

    save_json(
        ARTIFACTS_DIR / "model_metadata.json",
        {
            "target_name": TARGET_NAME,
            "generated_at": datetime.utcnow().isoformat(),
            "models": {
                "project_only": project_only_metadata,
                "hybrid": hybrid_metadata,
            },
        },
    )
    print("Model training selesai. Artefak tersimpan di ml_service/artifacts/")


if __name__ == "__main__":
    main()
