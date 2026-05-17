from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .core import (
    MODEL_VERSION,
    TARGET_NAME,
    classify_project,
    create_inference_frame,
    infer_client_type,
    load_client_mapping,
    load_model_artifacts,
    align_features,
)


class RuleBasedSummaryPayload(BaseModel):
    totalPersonnel: int = Field(ge=0)
    directCostSubtotal: float = Field(ge=0)
    subtotalBeforeProfit: float = Field(ge=0)
    finalPriceBeforeRounding: float = Field(ge=0)
    finalRoundedPrice: float = Field(ge=0)
    ruleBasedEstimateBeforeApproval: float = Field(ge=0)


class PredictBenchmarkPayload(BaseModel):
    projectName: str
    companyName: str
    companyCategory: str | None = None
    projectLocation: str
    projectCategory: str
    workDate: str
    totalDurationDays: int = Field(ge=0)
    ruleBasedSummary: RuleBasedSummaryPayload
    requestedModels: list[Literal["project_only", "hybrid"]]


app = FastAPI(title="PT BKI SVR Benchmark Service", version=MODEL_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pt-bki-svr-benchmark"}


@app.post("/predict-benchmark")
def predict_benchmark(payload: PredictBenchmarkPayload) -> dict[str, Any]:
    requested_at = datetime.utcnow().isoformat()

    try:
        client_mapping = load_client_mapping()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Gagal memuat client mapping: {error}") from error

    type_of_project = classify_project(payload.projectName, payload.projectCategory)
    type_of_client = infer_client_type(
        payload.companyName,
        payload.companyCategory,
        client_mapping,
    )

    feature_snapshot = {
        "projectName": payload.projectName,
        "companyName": payload.companyName,
        "companyCategory": payload.companyCategory,
        "typeOfClient": type_of_client,
        "projectCategory": payload.projectCategory,
        "typeOfProject": type_of_project,
        "projectLocation": payload.projectLocation,
        "workDate": payload.workDate,
        "totalDurationDays": payload.totalDurationDays,
        "totalPersonnel": payload.ruleBasedSummary.totalPersonnel,
        "ruleBasedEstimateBeforeApproval": payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval,
    }

    response: dict[str, Any] = {
        "targetName": TARGET_NAME,
        "payload": payload.model_dump(),
        "requestedAt": requested_at,
        "respondedAt": datetime.utcnow().isoformat(),
        "projectOnly": {
          "modelKey": "project_only",
          "predictedPrice": None,
          "currency": "IDR",
          "modelName": "SVR Project-Only",
          "modelVersion": None,
          "status": "idle",
        },
        "hybrid": {
          "modelKey": "hybrid",
          "predictedPrice": None,
          "currency": "IDR",
          "modelName": "SVR Hybrid",
          "modelVersion": None,
          "status": "idle",
        },
        "bestAvailable": None,
        "modelVersions": {},
        "featureSnapshot": feature_snapshot,
        "errors": {},
    }

    model_payload = {
        "workDate": payload.workDate,
        "typeOfClient": type_of_client,
        "typeOfProject": type_of_project,
        "ruleBasedEstimateBeforeApproval": payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval,
    }

    for model_key in payload.requestedModels:
        include_harga_log = model_key == "hybrid"
        model_name = "SVR Hybrid" if include_harga_log else "SVR Project-Only"
        target_field = "hybrid" if include_harga_log else "projectOnly"

        try:
            artifacts = load_model_artifacts(model_key)
            inference_frame = create_inference_frame(model_payload, include_harga_log)
            aligned_frame = align_features(inference_frame, artifacts.feature_columns)
            prediction = artifacts.model.predict(aligned_frame)[0]
            prediction_price = float(np.expm1(prediction))

            response[target_field] = {
                "modelKey": model_key,
                "predictedPrice": round(prediction_price),
                "currency": "IDR",
                "modelName": model_name,
                "modelVersion": artifacts.metadata.get("model_version"),
                "status": "success",
                "requestedAt": requested_at,
                "respondedAt": datetime.utcnow().isoformat(),
                "errorMessage": None,
            }
            response["modelVersions"][model_key] = artifacts.metadata.get("model_version")
        except Exception as error:
            response[target_field] = {
                "modelKey": model_key,
                "predictedPrice": None,
                "currency": "IDR",
                "modelName": model_name,
                "modelVersion": None,
                "status": "error",
                "requestedAt": requested_at,
                "respondedAt": datetime.utcnow().isoformat(),
                "errorMessage": str(error),
            }
            response["errors"][model_key] = str(error)

    if response["hybrid"]["status"] == "success":
        response["bestAvailable"] = "hybrid"
    elif response["projectOnly"]["status"] == "success":
        response["bestAvailable"] = "project_only"

    return response
