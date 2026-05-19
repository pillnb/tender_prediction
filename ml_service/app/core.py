from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"
MODULE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_FILENAME = "tender_fix.xlsx"
DEFAULT_CLIENT_MAPPING_FILENAME = "Mapping_Client_BKI_Fix.xlsx"
MODEL_VERSION = "ml-benchmark-validation-v3"
TARGET_NAME = "harga_sebelum_approval"
FEATURE_SCHEMA_VERSION = "runtime-feature-schema-v3"

MODEL_DISPLAY_NAMES = {
    "project_only": "Project-Only Benchmark",
    "hybrid": "Hybrid Benchmark",
}

MODEL_FEATURE_SPECS: dict[str, dict[str, Any]] = {
    "project_only": {
        "display_name": MODEL_DISPLAY_NAMES["project_only"],
        "numeric_features": ["Year", "Quarter", "Month"],
        "categorical_features": ["Type of Client", "Type of Project"],
        "runtime_feature_keys": ["Year", "Quarter", "Month", "Type of Client", "Type of Project"],
        "feature_semantics": {
            "Year": "Tahun dari Tgl. Penawaran / workDate",
            "Quarter": "Kuartal dari Tgl. Penawaran / workDate",
            "Month": "Bulan dari Tgl. Penawaran / workDate",
            "Type of Client": "Kategori client hasil mapping perusahaan / companyCategory",
            "Type of Project": "Kategori proyek hasil klasifikasi pekerjaan / projectCategory",
        },
        "trainable_from_historical_data": True,
        "validation_state": "limited",
    },
    "hybrid": {
        "display_name": MODEL_DISPLAY_NAMES["hybrid"],
        "numeric_features": [
            "Year",
            "Quarter",
            "Month",
            "EstimatedPriceLog",
        ],
        "categorical_features": ["Type of Client", "Type of Project"],
        "runtime_feature_keys": [
            "Year",
            "Quarter",
            "Month",
            "Type of Client",
            "Type of Project",
            "EstimatedPriceLog",
        ],
        "feature_semantics": {
            "Year": "Tahun dari Tgl. Penawaran / workDate",
            "Quarter": "Kuartal dari Tgl. Penawaran / workDate",
            "Month": "Bulan dari Tgl. Penawaran / workDate",
            "Type of Client": "Kategori client hasil mapping perusahaan / companyCategory",
            "Type of Project": "Kategori proyek hasil klasifikasi pekerjaan / projectCategory",
            "EstimatedPriceLog": "log1p dari kolom Harga historis, disejajarkan dengan log1p(ruleBasedEstimateBeforeApproval) saat runtime",
        },
        "trainable_from_historical_data": True,
        "validation_state": "limited",
    },
}

COMPANY_CATEGORY_TO_CLIENT_TYPE = {
    "migas": "MIGAS",
    "minerba": "MINERBA",
    "ebtke": "EBTKE",
    "kelistrikan": "KELISTRIKAN",
    "nakertrans": "NAKERTRANS",
    "dephub": "DEPHUB",
    "perindustrian": "PERINDUSTRIAN",
    "bki": "BKI",
    "lain-lain": "LAIN LAIN",
}

PROJECT_CATEGORY_TO_TYPE = {
    "pemetaan": "Pemetaan",
    "survey": "Survey/Identifikasi/Inventarisasi",
    "inspeksi": "Inspeksi",
    "assessment": "Assessment",
    "audit": "Audit",
    "pengujian": "Pengujian",
    "pengujian_lab": "Pengujian Laboratorium",
    "monitoring": "Monitoring",
    "supervisi": "Supervisi",
    "konsultansi": "Konsultansi",
    "sertifikasi": "Sertifikasi",
    "training": "Training",
    "labor_survey": "Labor Survey",
}

PROJECT_CATEGORY_RULES = {
    "Pengujian Laboratorium": ["laboratorium", "lab test", "uji lab", "analysis lab"],
    "Labor Survey": ["labor survey", "pengerahan tenaga", "supply personil"],
    "Survey/Identifikasi/Inventarisasi": [
        "survey",
        "identifikasi",
        "inventarisasi",
        "pendataan",
        "mapping",
    ],
    "Pemetaan": ["pemetaan", "bathymetry", "topografi", "gis"],
    "Inspeksi": [
        "inspeksi",
        "inspection",
        "pemeriksaan",
        "ndt",
        "underwater",
        "annual",
        "tanki",
        "tank",
        "vessel",
        "ut",
        "crane",
        "lifting",
        "gear",
        "wire",
        "hoist",
        "kapal",
        "marine",
        "tug",
        "cst",
    ],
    "Sertifikasi": [
        "sertifikasi",
        "certification",
        "re-sertifikasi",
        "sertifikat",
        "migas",
        "riksa uji",
        "plo",
        "coi",
        "certificate",
        "slo",
        "slf",
    ],
    "Pengujian": [
        "pengujian",
        "testing",
        "commissioning",
        "load test",
        "test",
        "kalibrasi",
        "calibration",
        "tera",
        "bollard",
        "pull",
        "fuel",
        "consumption",
        "fct",
        "psv",
    ],
    "Assessment": ["assessment", "kajian", "studi kelayakan", "evaluasi teknis"],
    "Audit": ["audit", "verifikasi", "penelaahan", "rla"],
    "Monitoring": ["monitoring", "pemantauan", "pengawasan berkala"],
    "Supervisi": ["supervisi", "supervision", "pengawasan konstruksi"],
    "Konsultansi": ["konsultansi", "consultancy", "advisory", "jasa konsultansi"],
    "Training": ["training", "pelatihan", "workshop", "sosialisasi"],
}


@dataclass
class ModelArtifacts:
    model: Any
    contract: dict[str, Any]
    metadata: dict[str, Any]


def get_model_feature_spec(model_key: str) -> dict[str, Any]:
    if model_key not in MODEL_FEATURE_SPECS:
        raise KeyError(f"Unknown model key '{model_key}'.")

    return MODEL_FEATURE_SPECS[model_key]


def resolve_project_file(filename: str, env_var_name: str) -> Path:
    configured_path = os.getenv(env_var_name)
    candidate_paths: list[Path] = []

    if configured_path:
        configured = Path(configured_path)
        candidate_paths.append(configured if configured.is_absolute() else Path.cwd() / configured)

    candidate_paths.extend(
        [
            Path.cwd() / filename,
            MODULE_ROOT / filename,
            MODULE_ROOT.parent / filename,
            ARTIFACTS_DIR.parent / filename,
        ]
    )

    seen_paths: set[Path] = set()
    unique_candidates: list[Path] = []

    for candidate in candidate_paths:
        resolved = candidate.resolve()
        if resolved in seen_paths:
            continue
        seen_paths.add(resolved)
        unique_candidates.append(resolved)

    for candidate in unique_candidates:
        if candidate.exists():
            return candidate

    attempted_paths = ", ".join(str(path) for path in unique_candidates)
    raise FileNotFoundError(
        f"File '{filename}' tidak ditemukan. Path yang dicoba: {attempted_paths}"
    )


def sha256_for_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean_harga_final(nilai: Any) -> float | np.nan:
    if pd.isna(nilai):
        return np.nan

    teks = str(nilai).strip()

    try:
        return float(teks)
    except ValueError:
        pass

    teks = teks.replace("Rp", "").replace("IDR", "").strip()

    if re.search(r",\d{1,2}$", teks) and not re.search(r"\.", teks):
        teks = teks.replace(".", "")
        teks = teks.replace(",", ".")
    else:
        teks = teks.replace(".", "").replace(",", "")

    try:
        return float(teks)
    except ValueError:
        return np.nan


def classify_project(text: str | None, project_category: str | None = None) -> str:
    text_clean = (text or "").lower()

    for category, keywords in PROJECT_CATEGORY_RULES.items():
        if any(keyword in text_clean for keyword in keywords):
            return category

    if project_category:
        return PROJECT_CATEGORY_TO_TYPE.get(project_category, "LAIN-LAIN")

    return "LAIN-LAIN"


def load_client_mapping(path: Path | None = None) -> dict[str, str]:
    mapping_path = path or resolve_project_file(
        DEFAULT_CLIENT_MAPPING_FILENAME,
        "ML_CLIENT_MAPPING_PATH",
    )
    df = pd.read_excel(mapping_path)

    if "Perusahaan" not in df.columns or "Type of Client" not in df.columns:
        raise ValueError("Client mapping file must contain 'Perusahaan' and 'Type of Client'.")

    return dict(zip(df["Perusahaan"].astype(str).str.lower(), df["Type of Client"].astype(str)))


def infer_client_type(
    company_name: str | None,
    company_category: str | None,
    master_client_dict: dict[str, str],
) -> str:
    nama_clean = (company_name or "").strip().lower()

    if nama_clean in master_client_dict:
        return master_client_dict[nama_clean]

    for keyword, client_type in master_client_dict.items():
        if keyword and keyword in nama_clean:
            return client_type

    if company_category:
        return COMPANY_CATEGORY_TO_CLIENT_TYPE.get(company_category, "LAIN LAIN")

    return "LAIN LAIN"


def summarize_numeric_series(values: pd.Series) -> dict[str, float | None]:
    numeric = values.dropna()
    if numeric.dtype == object:
        numeric = numeric.apply(clean_harga_final)
    numeric = numeric.dropna().astype(float)

    if numeric.empty:
        return {
            "count": 0,
            "min": None,
            "p25": None,
            "median": None,
            "mean": None,
            "p75": None,
            "max": None,
        }

    return {
        "count": int(len(numeric)),
        "min": float(numeric.min()),
        "p25": float(numeric.quantile(0.25)),
        "median": float(numeric.median()),
        "mean": float(numeric.mean()),
        "p75": float(numeric.quantile(0.75)),
        "max": float(numeric.max()),
    }


def build_dataset_audit(
    raw_df: pd.DataFrame,
    required_filtered_df: pd.DataFrame,
    numeric_filtered_df: pd.DataFrame,
    final_df: pd.DataFrame,
    dataset_path: Path,
    mapping_path: Path,
) -> dict[str, Any]:
    target_delta = (
        final_df["Harga Sebelum Approval"].astype(float) - final_df["Harga"].astype(float)
    ).abs()
    exact_same_ratio = float((target_delta == 0).mean()) if len(final_df) > 0 else 0.0
    within_one_percent_ratio = (
        float(
            (
                target_delta
                <= final_df["Harga Sebelum Approval"].astype(float).abs().replace(0, np.nan) * 0.01
            ).fillna(False).mean()
        )
        if len(final_df) > 0
        else 0.0
    )
    duplicate_mask = final_df.duplicated(
        subset=["Perusahaan", "Pekerjaan", "Tgl. Penawaran", "Harga Sebelum Approval"],
        keep=False,
    )
    q1 = final_df["Harga Sebelum Approval"].quantile(0.25)
    q3 = final_df["Harga Sebelum Approval"].quantile(0.75)
    iqr = q3 - q1
    outlier_threshold = q3 + 1.5 * iqr
    outlier_count = int((final_df["Harga Sebelum Approval"] > outlier_threshold).sum())

    return {
        "dataset_version": sha256_for_file(dataset_path),
        "client_mapping_version": sha256_for_file(mapping_path),
        "dataset_path": str(dataset_path),
        "client_mapping_path": str(mapping_path),
        "raw_rows": int(len(raw_df)),
        "required_field_rows": int(len(required_filtered_df)),
        "numeric_clean_rows": int(len(numeric_filtered_df)),
        "final_rows": int(len(final_df)),
        "kept_ratio": float(len(final_df) / len(raw_df)) if len(raw_df) > 0 else 0.0,
        "drop_summary": {
            "missing_required_fields": int(len(raw_df) - len(required_filtered_df)),
            "invalid_numeric_target": int(len(required_filtered_df) - len(numeric_filtered_df)),
            "invalid_offer_date": int(len(numeric_filtered_df) - len(final_df)),
        },
        "target_distribution": {
            "before_cleaning": summarize_numeric_series(required_filtered_df["Harga Sebelum Approval"]),
            "after_cleaning": summarize_numeric_series(final_df["Harga Sebelum Approval"]),
        },
        "label_quality": {
            "duplicate_candidate_rows": int(duplicate_mask.sum()),
            "invalid_offer_date_rows": int(len(numeric_filtered_df) - len(final_df)),
            "outlier_threshold": float(outlier_threshold) if pd.notna(outlier_threshold) else None,
            "outlier_count": outlier_count,
        },
        "leakage_audit": {
            "exact_same_price_count": int((target_delta == 0).sum()),
            "exact_same_price_ratio": exact_same_ratio,
            "within_one_percent_ratio": within_one_percent_ratio,
            "target_delta_summary": summarize_numeric_series(target_delta),
        },
    }


def prepare_training_dataframe(
    dataset_path: Path | None = None,
    client_mapping_path: Path | None = None,
    include_audit: bool = False,
) -> pd.DataFrame | tuple[pd.DataFrame, dict[str, Any]]:
    resolved_dataset_path = dataset_path or resolve_project_file(
        DEFAULT_DATASET_FILENAME,
        "ML_TRAINING_DATASET_PATH",
    )
    resolved_mapping_path = client_mapping_path or resolve_project_file(
        DEFAULT_CLIENT_MAPPING_FILENAME,
        "ML_CLIENT_MAPPING_PATH",
    )

    raw_df = pd.read_excel(resolved_dataset_path).copy()
    required_filtered_df = raw_df.drop(
        columns=["No. Penawaran", "Contact Person", "No. Tlp.", "Email"],
        errors="ignore",
    )
    required_filtered_df = required_filtered_df.dropna(
        subset=["Perusahaan", "Harga", "Harga Sebelum Approval", "Pekerjaan"]
    ).copy()

    numeric_filtered_df = required_filtered_df.copy()
    for column in ["Harga", "Harga Sebelum Approval"]:
        if column in numeric_filtered_df.columns:
            numeric_filtered_df[column] = numeric_filtered_df[column].apply(clean_harga_final)

    numeric_filtered_df = numeric_filtered_df.dropna(
        subset=["Harga", "Harga Sebelum Approval"]
    ).copy()

    final_df = numeric_filtered_df.copy()
    final_df["Tgl. Penawaran"] = pd.to_datetime(final_df["Tgl. Penawaran"], errors="coerce")
    final_df = final_df.dropna(subset=["Tgl. Penawaran"]).copy()
    final_df["Year"] = final_df["Tgl. Penawaran"].dt.year.astype(int)
    final_df["Quarter"] = final_df["Tgl. Penawaran"].dt.quarter.astype(int)
    final_df["Month"] = final_df["Tgl. Penawaran"].dt.month.astype(int)

    client_dict = load_client_mapping(resolved_mapping_path)
    final_df["Type of Client"] = final_df["Perusahaan"].apply(
        lambda value: infer_client_type(value, None, client_dict)
    )
    final_df["Type of Project"] = final_df["Pekerjaan"].apply(lambda value: classify_project(value, None))
    final_df["EstimatedPrice"] = final_df["Harga"].astype(float)
    final_df["EstimatedPriceLog"] = np.log1p(final_df["EstimatedPrice"])
    final_df["Harga Sebelum Approval_log"] = np.log1p(final_df["Harga Sebelum Approval"])

    if not include_audit:
        return final_df

    audit = build_dataset_audit(
        raw_df=raw_df,
        required_filtered_df=required_filtered_df,
        numeric_filtered_df=numeric_filtered_df,
        final_df=final_df,
        dataset_path=resolved_dataset_path,
        mapping_path=resolved_mapping_path,
    )
    return final_df, audit


def build_training_frame(df: pd.DataFrame, model_key: str) -> tuple[pd.DataFrame, pd.Series]:
    spec = get_model_feature_spec(model_key)
    feature_keys = spec["runtime_feature_keys"]
    missing_columns = [column for column in feature_keys if column not in df.columns]

    if missing_columns:
        raise ValueError(
            f"Model '{model_key}' tidak dapat ditrain karena feature historis berikut tidak tersedia: {missing_columns}"
        )

    feature_frame = df[feature_keys].copy()
    target = df["Harga Sebelum Approval_log"].copy()
    return feature_frame, target


def build_runtime_feature_payload(
    payload: Any,
    type_of_client: str,
    type_of_project: str,
) -> dict[str, Any]:
    work_date = pd.to_datetime(payload.workDate, errors="coerce")

    if pd.isna(work_date):
        raise ValueError("workDate is invalid and cannot be converted to datetime.")

    return {
        "Year": int(work_date.year),
        "Quarter": int(work_date.quarter),
        "Month": int(work_date.month),
        "Type of Client": type_of_client,
        "Type of Project": type_of_project,
        "EstimatedPriceLog": float(
            np.log1p(float(payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval))
        ),
        "RuleBasedEstimateBeforeApproval": float(
            payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval
        ),
    }


def load_model_contract(model_key: str) -> dict[str, Any]:
    contract_path = ARTIFACTS_DIR / f"{model_key}_feature_contract.json"

    if not contract_path.exists():
        raise FileNotFoundError(f"Model contract untuk '{model_key}' tidak ditemukan.")

    return load_json(contract_path)


def validate_feature_contract(
    runtime_features: dict[str, Any],
    contract: dict[str, Any],
) -> None:
    required_keys = contract.get("runtime_feature_keys", [])
    missing_keys = [key for key in required_keys if key not in runtime_features]

    if missing_keys:
        raise ValueError(
            f"Runtime payload tidak memenuhi kontrak feature untuk model '{contract.get('model_key')}': {missing_keys}"
        )


def create_inference_frame(
    runtime_features: dict[str, Any],
    contract: dict[str, Any],
) -> pd.DataFrame:
    validate_feature_contract(runtime_features, contract)
    ordered_payload = {
        key: runtime_features[key]
        for key in contract.get("runtime_feature_keys", [])
    }
    return pd.DataFrame([ordered_payload])


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_model_artifacts(model_key: str) -> ModelArtifacts:
    contract = load_model_contract(model_key)
    metadata_path = ARTIFACTS_DIR / "model_metadata.json"

    if not metadata_path.exists():
        raise FileNotFoundError("Model metadata belum tersedia.")

    metadata = load_json(metadata_path)["models"][model_key]

    if not contract.get("runtime_enabled", False):
        raise ValueError(contract.get("validation_summary") or "Model ini belum valid untuk runtime.")

    model_path = ARTIFACTS_DIR / f"{model_key}_model.joblib"
    if not model_path.exists():
        raise FileNotFoundError(f"Artifact model untuk '{model_key}' tidak ditemukan.")

    model = joblib.load(model_path)
    return ModelArtifacts(model=model, contract=contract, metadata=metadata)
