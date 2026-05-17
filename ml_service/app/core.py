from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATASET_PATH = PROJECT_ROOT / "tender_fix.xlsx"
DEFAULT_CLIENT_MAPPING_PATH = PROJECT_ROOT / "Mapping_Client_BKI_Fix.xlsx"
MODEL_VERSION = "svr-benchmark-v1"
TARGET_NAME = "harga_sebelum_approval"

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
    feature_columns: list[str]
    metadata: dict[str, Any]


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
    mapping_path = path or DEFAULT_CLIENT_MAPPING_PATH
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


def prepare_training_dataframe(
    dataset_path: Path | None = None,
    client_mapping_path: Path | None = None,
) -> pd.DataFrame:
    data_path = dataset_path or DEFAULT_DATASET_PATH
    df = pd.read_excel(data_path).copy()

    df = df.drop(columns=["No. Penawaran", "Contact Person", "No. Tlp.", "Email"], errors="ignore")
    df = df.dropna(subset=["Perusahaan", "Harga", "Harga Sebelum Approval", "Pekerjaan"])

    for col in ["Harga", "Harga Sebelum Approval"]:
        if col in df.columns:
            df[col] = df[col].apply(clean_harga_final)

    df = df.dropna(subset=["Harga", "Harga Sebelum Approval"])

    df["Tgl. Penawaran"] = pd.to_datetime(df["Tgl. Penawaran"], errors="coerce")
    df = df.dropna(subset=["Tgl. Penawaran"])
    df["Year"] = df["Tgl. Penawaran"].dt.year.astype(int)
    df["Quarter"] = df["Tgl. Penawaran"].dt.quarter.astype(int)
    df["Month"] = df["Tgl. Penawaran"].dt.month.astype(int)

    client_dict = load_client_mapping(client_mapping_path)
    df["Type of Client"] = df["Perusahaan"].apply(
        lambda value: infer_client_type(value, None, client_dict)
    )
    df["Type of Project"] = df["Pekerjaan"].apply(lambda value: classify_project(value, None))

    df["Harga_log"] = np.log1p(df["Harga"])
    df["Harga Sebelum Approval_log"] = np.log1p(df["Harga Sebelum Approval"])

    return df


def build_model_frame(df: pd.DataFrame, include_harga_log: bool) -> tuple[pd.DataFrame, pd.Series]:
    feature_columns = ["Year", "Quarter", "Month", "Type of Client", "Type of Project"]

    if include_harga_log:
        feature_columns.append("Harga_log")

    feature_frame = df[feature_columns].copy()
    encoded = pd.get_dummies(
        feature_frame,
        columns=["Type of Client", "Type of Project"],
        drop_first=False,
        dtype=int,
    )

    target = df["Harga Sebelum Approval_log"].copy()
    return encoded, target


def create_inference_frame(payload: dict[str, Any], include_harga_log: bool) -> pd.DataFrame:
    work_date = pd.to_datetime(payload["workDate"], errors="coerce")

    if pd.isna(work_date):
        raise ValueError("workDate is invalid and cannot be converted to datetime.")

    feature_row = {
        "Year": int(work_date.year),
        "Quarter": int(work_date.quarter),
        "Month": int(work_date.month),
        "Type of Client": payload["typeOfClient"],
        "Type of Project": payload["typeOfProject"],
    }

    if include_harga_log:
        estimate = payload["ruleBasedEstimateBeforeApproval"]
        if estimate is None or float(estimate) <= 0:
            raise ValueError(
                "Hybrid model membutuhkan rule-based estimate before approval yang valid."
            )
        feature_row["Harga_log"] = float(np.log1p(float(estimate)))

    return pd.DataFrame([feature_row])


def align_features(frame: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    encoded = pd.get_dummies(
        frame,
        columns=["Type of Client", "Type of Project"],
        drop_first=False,
        dtype=int,
    )
    return encoded.reindex(columns=feature_columns, fill_value=0)


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_model_artifacts(model_key: str) -> ModelArtifacts:
    model_path = ARTIFACTS_DIR / f"{model_key}_model.joblib"
    contract_path = ARTIFACTS_DIR / f"{model_key}_feature_contract.json"
    metadata_path = ARTIFACTS_DIR / "model_metadata.json"

    if not model_path.exists() or not contract_path.exists() or not metadata_path.exists():
        raise FileNotFoundError(
            "Model artifacts belum tersedia. Jalankan 'python ml_service/train_models.py' terlebih dahulu."
        )

    model = joblib.load(model_path)
    contract = load_json(contract_path)
    metadata = load_json(metadata_path)

    return ModelArtifacts(
        model=model,
        feature_columns=contract["feature_columns"],
        metadata=metadata["models"][model_key],
    )
