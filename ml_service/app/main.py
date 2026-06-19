from __future__ import annotations

from datetime import datetime
import sys
from typing import Any, Literal

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .core import (
    MODEL_DISPLAY_NAMES,
    MODEL_VERSION,
    TARGET_NAME,
    build_runtime_feature_payload,
    classify_project,
    create_inference_frame,
    infer_client_type,
    load_alias_mapping,
    load_client_type_mapping,
    load_model_artifacts,
    load_model_contract,
)


class RuleBasedSummaryPayload(BaseModel):
    ruleBasedEstimateBeforeApproval: float = Field(ge=0)


class PredictBenchmarkPayload(BaseModel):
    projectName: str
    companyName: str
    companyCategory: str | None = None
    projectLocation: str
    projectCategory: str
    workDate: str
    ruleBasedSummary: RuleBasedSummaryPayload
    requestedModels: list[Literal["project_only", "hybrid"]]


app = FastAPI(title="PT BKI Tender Price Benchmark Service", version=MODEL_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pt-bki-svr-benchmark"}


@app.post("/predict-benchmark")
def predict_benchmark(payload: PredictBenchmarkPayload) -> dict[str, Any]:
    requested_at = datetime.utcnow().isoformat()

    try:
        alias_mapping = load_alias_mapping()
        client_type_mapping = load_client_type_mapping()
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Gagal memuat resource mapping ML: {error}") from error

    type_of_project = classify_project(payload.projectName, payload.projectCategory)
    type_of_client, standardized_company_name = infer_client_type(
        payload.companyName,
        payload.companyCategory,
        alias_mapping,
        client_type_mapping,
    )
    runtime_features = build_runtime_feature_payload(payload, type_of_client, type_of_project)

    response: dict[str, Any] = {
        "targetName": TARGET_NAME,
        "payload": payload.model_dump(),
        "requestedAt": requested_at,
        "respondedAt": datetime.utcnow().isoformat(),
        "projectOnly": {
            "modelKey": "project_only",
            "predictedPrice": None,
            "currency": "IDR",
            "modelName": MODEL_DISPLAY_NAMES["project_only"],
            "modelVersion": None,
            "status": "idle",
            "validationState": "limited",
            "validationSummary": "Model benchmark project-only menunggu eksekusi runtime.",
        },
        "hybrid": {
            "modelKey": "hybrid",
            "predictedPrice": None,
            "currency": "IDR",
            "modelName": MODEL_DISPLAY_NAMES["hybrid"],
            "modelVersion": None,
            "status": "idle",
            "validationState": "limited",
            "validationSummary": "Model benchmark hybrid menunggu eksekusi runtime.",
        },
        "bestAvailable": None,
        "modelVersions": {},
        "featureSnapshot": {
            "projectName": payload.projectName,
            "companyName": payload.companyName,
            "companyCategory": payload.companyCategory,
            "standardizedCompanyName": standardized_company_name,
            "typeOfClient": type_of_client,
            "projectCategory": payload.projectCategory,
            "typeOfProject": type_of_project,
            "projectLocation": payload.projectLocation,
            "workDate": payload.workDate,
            "ruleBasedEstimateBeforeApproval": payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval,
        },
        "errors": {},
    }

    for model_key in payload.requestedModels:
        target_field = "hybrid" if model_key == "hybrid" else "projectOnly"
        contract: dict[str, Any] | None = None

        try:
            contract = load_model_contract(model_key)
            artifacts = load_model_artifacts(model_key)
            inference_frame = create_inference_frame(runtime_features, artifacts.contract)
            prediction = artifacts.model.predict(inference_frame)[0]
            prediction_price = float(np.expm1(prediction))

            print(
                f"[ml-benchmark] model={model_key} family={artifacts.contract.get('chosen_model_family')} "
                f"validation={artifacts.contract.get('validation_state')} version={artifacts.metadata.get('model_version')}",
                file=sys.stderr,
            )

            response[target_field] = {
                "modelKey": model_key,
                "predictedPrice": round(prediction_price),
                "currency": "IDR",
                "modelName": contract.get("display_name", MODEL_DISPLAY_NAMES[model_key]),
                "modelVersion": artifacts.metadata.get("model_version"),
                "status": "success",
                "validationState": contract.get("validation_state"),
                "validationSummary": contract.get("validation_summary"),
                "requestedAt": requested_at,
                "respondedAt": datetime.utcnow().isoformat(),
                "errorMessage": None,
            }
            response["modelVersions"][model_key] = artifacts.metadata.get("model_version")
        except Exception as error:
            print(f"[ml-benchmark] model={model_key} status=error reason={error}", file=sys.stderr)
            response[target_field] = {
                "modelKey": model_key,
                "predictedPrice": None,
                "currency": "IDR",
                "modelName": (
                    contract.get("display_name", MODEL_DISPLAY_NAMES[model_key])
                    if contract
                    else MODEL_DISPLAY_NAMES[model_key]
                ),
                "modelVersion": contract.get("model_version") if contract else None,
                "status": "error",
                "validationState": contract.get("validation_state") if contract else "blocked",
                "validationSummary": contract.get("validation_summary") if contract else str(error),
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
