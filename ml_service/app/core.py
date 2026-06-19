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
SERVICE_ROOT = Path(__file__).resolve().parents[1]
MODULE_ROOT = Path(__file__).resolve().parents[2]
RESOURCES_DIR = SERVICE_ROOT / "resources"

DEFAULT_DATASET_FILENAME = "training_dataset.xlsx"
DEFAULT_ALIAS_MAPPING_FILENAME = "client_alias_mapping.xlsx"
DEFAULT_CLIENT_TYPE_MAPPING_FILENAME = "client_type_mapping.xlsx"

LEGACY_DATASET_FILENAMES = ["dataset_batch2.xlsx", "bki_tender_training_2023_2025.xlsx"]
MODEL_VERSION = "svr-notebook-aligned-v1"
TARGET_NAME = "harga_sebelum_approval"
FEATURE_SCHEMA_VERSION = "runtime-feature-schema-v4"
TRAINING_CUTOFF_DATE = pd.Timestamp("2026-01-01")
NOTEBOOK_SOURCE = "revisi_price_prediction_using_extracted_data.ipynb"

NOTEBOOK_SVR_CONFIGS: dict[str, dict[str, Any]] = {
    "project_only": {
        "kernel": "linear",
        "C": 1.0,
        "epsilon": 0.1,
        "gamma": "scale",
        "scenario_id": "without_tender_price",
        "scenario_label": "ML Tanpa Tender Price",
    },
    "hybrid": {
        "kernel": "linear",
        "C": 100.0,
        "epsilon": 0.1,
        "gamma": "scale",
        "scenario_id": "with_tender_price",
        "scenario_label": "ML Dengan Tender Price",
    },
}

MODEL_DISPLAY_NAMES = {
    "project_only": "SVR Project-Only Benchmark",
    "hybrid": "SVR Hybrid Benchmark",
}

MODEL_FEATURE_SPECS: dict[str, dict[str, Any]] = {
    "project_only": {
        "display_name": MODEL_DISPLAY_NAMES["project_only"],
        "numeric_features": ["Year", "Quarter", "Month"],
        "categorical_features": ["Type of Client", "Type of Project"],
        "runtime_feature_keys": ["Year", "Quarter", "Month", "Type of Client", "Type of Project"],
        "feature_semantics": {
            "Year": "Tahun dari offer_date_final atau workDate runtime.",
            "Quarter": "Kuartal dari offer_date_final atau workDate runtime.",
            "Month": "Bulan dari offer_date_final atau workDate runtime.",
            "Type of Client": "Type of Client dari alias mapping dan client_type_mapping notebook.",
            "Type of Project": "Type of Project hasil PROJECT_RULES notebook dari projectName.",
        },
        "scenario_id": "without_tender_price",
    },
    "hybrid": {
        "display_name": MODEL_DISPLAY_NAMES["hybrid"],
        "numeric_features": ["TenderPriceLog", "Year", "Quarter", "Month"],
        "categorical_features": ["Type of Client", "Type of Project"],
        "runtime_feature_keys": [
            "TenderPriceLog",
            "Year",
            "Quarter",
            "Month",
            "Type of Client",
            "Type of Project",
        ],
        "feature_semantics": {
            "TenderPriceLog": "log1p(Harga) historis yang disejajarkan dengan log1p(ruleBasedEstimateBeforeApproval) saat runtime.",
            "Year": "Tahun dari offer_date_final atau workDate runtime.",
            "Quarter": "Kuartal dari offer_date_final atau workDate runtime.",
            "Month": "Bulan dari offer_date_final atau workDate runtime.",
            "Type of Client": "Type of Client dari alias mapping dan client_type_mapping notebook.",
            "Type of Project": "Type of Project hasil PROJECT_RULES notebook dari projectName.",
        },
        "scenario_id": "with_tender_price",
    },
}

ALLOWED_CLIENT_TYPES = {
    "MIGAS",
    "MINERBA",
    "EBTKE",
    "KELISTRIKAN",
    "NAKERTRANS",
    "DEPHUB",
    "PERINDUSTRIAN",
    "BKI",
    "LAIN-LAIN",
}

PROJECT_RULES: list[tuple[str, list[str]]] = [
    (
        "TRAINING",
        [
            "training",
            "pelatihan",
            "workshop",
            "bimtek",
            "sosialisasi",
            "awareness",
            "awarness",
            "integreted management",
            "integrated management",
            "management system",
        ],
    ),
    (
        "KONSULTANSI",
        [
            "konsultansi",
            "consulting",
            "consultancy",
            "pendampingan",
            "advisory",
            "jasa konsultasi",
        ],
    ),
    (
        "SUPERVISI",
        [
            "supervisi",
            "supervision",
            "pengawasan",
            "monitoring",
            "manajemen proyek",
            "project management",
        ],
    ),
    (
        "ENGINEERING",
        [
            "engineering",
            "design",
            "desain",
            "detail engineering",
            "ded",
            "perencanaan",
            "instalasi",
            "installation",
            "gambar",
            "drawing",
            "revisi gambar",
            "gambar teknik",
            "technical drawing",
            "as built drawing",
            "arrangement drawing",
            "general arrangement",
            "layout",
            "mooring analysis",
            "mooring",
            "safety plan",
            "perhitungan",
            "calculation",
            "stability",
            "stabilitas",
            "re engineering",
            "re-engineering",
            "re engeenering",
            "kalkulasi",
            "trim list",
            "pembuatan trim list",
            "repair",
            "required repair",
            "perbaikan",
            "material substitusi",
            "substitusi material",
        ],
    ),
    (
        "ASSESSMENT",
        [
            "assessment",
            "assesment",
            "audit",
            "kajian",
            "studi",
            "study",
            "verifikasi",
            "verification",
            "review",
            "evaluasi",
            "rla",
            "remaining life assessment",
            "condition assessment",
            "fitness for service",
            "ffs",
            "risk assessment",
            "hazop",
            "hazid",
        ],
    ),
    (
        "SERTIFIKASI",
        [
            "sertifikasi",
            "certification",
            "certificate",
            "sertifikat",
            "cert",
            "coi",
            "coc",
            "coa",
            "slo",
            "skpp",
            "socpf",
            "approval",
            "resertifikasi",
            "re sertifikasi",
            "re-sertifikasi",
            "perpanjangan",
            "endorse",
            "endorsement",
            "hubla",
            "disnaker",
            "statutory",
            "class",
            "classification",
            "klasifikasi",
            "ijin",
            "izin",
            "perizinan",
            "ijin lingkungan",
            "izin lingkungan",
            "ijin titik koordinat",
            "izin titik koordinat",
            "plo",
            "persetujuan layak operasi",
            "layak operasi",
        ],
    ),
    (
        "PENGUJIAN",
        [
            "pengujian",
            "uji",
            "testing",
            "test",
            "tester",
            "pengetesan",
            "pengetesan ulang",
            "hydrotest",
            "hydro test",
            "hydrostatic",
            "pressure test",
            "leak test",
            "load test",
            "loadtest",
            "uji beban",
            "proof load",
            "function test",
            "functional test",
            "load function",
            "load & function",
            "kalibrasi",
            "kalibrasu",
            "calibration",
            "tera",
            "laboratorium",
            "lab",
            "commissioning",
            "radiografi",
            "radiography",
            "xray",
            "x-ray",
            "ut",
            "utm",
            "ultrasonic",
            "mpi",
            "magnetic particle",
            "dpi",
            "dye penetrant",
            "ndt",
            "fct",
            "fuel consumption",
            "fuel oil consumption",
            "foc",
            "wire rope test",
            "wire rope tester",
            "lifting test",
            "cargo handling test",
            "main engine",
            "genset",
            "generator set",
            "pengukuran",
            "analisa lingkungan",
            "lingkungan kerja",
            "hygene",
            "hygiene",
            "grounding",
            "earthing",
            "lightning protection",
            "lightning rod",
            "arrestor",
            "pressure gauge",
            "presure gauge",
            "pressure indicator",
            "presure indicator",
            "gage",
            "gauge",
            "flowmeter",
            "flow meter",
            "water flowmeter",
            "fat",
            "factory acceptance test",
            "switchgear",
            "lv switchgear",
            "panel switchgear",
            "main switch board",
            "msb",
            "trafo",
            "konsumsi bbm",
        ],
    ),
    (
        "SEWA/PERALATAN",
        [
            "sewa",
            "rental",
            "penyewaan",
            "hire",
            "water bag",
            "alat",
            "equipment",
            "peralatan",
            "tools",
            "operator",
            "pengadaan",
            "pengadaan material",
            "material",
            "spare",
            "spare part",
            "aksesoris",
            "air dryer",
            "jack pallet",
            "pallet",
            "shelving rack",
            "rack",
            "rubber hose",
            "rubber house",
            "hose",
            "swamp excavator",
            "excavator",
            "xcmg",
            "top loader",
            "corner casting",
            "curing tyre",
        ],
    ),
    (
        "INSPEKSI",
        [
            "inspeksi",
            "inspection",
            "pemeriksaan",
            "survey",
            "survei",
            "visual",
            "annual",
            "intermediate",
            "renewal",
            "special survey",
            "condition survey",
            "underwater",
            "diving",
            "rov",
            "3rd party",
            "third party",
            "third-party",
            "jasa marine",
            "marine",
            "jasa maritim",
            "kapal",
            "vessel",
            "tugboat",
            "tug boat",
            "tongkang",
            "barge",
            "psv",
            "ahts",
            "sea truck",
            "offshore",
            "crane",
            "boiler",
            "pressure vessel",
            "bejana tekan",
            "separator",
            "tangki",
            "pipeline",
            "pipa",
            "struktur",
            "hull",
            "manifold",
            "bop",
            "prv",
            "lifting gear",
            "lifting equipment",
            "lifting appliance",
            "loose gear",
            "lifting",
            "alat angkat",
            "alat bantu angkat",
            "rigging",
            "sling",
            "hook",
            "chain block",
            "padeye",
            "pad eye",
            "shackle",
            "scan",
            "scanning",
            "3d scan",
            "laser scan",
            "bushing",
            "desalter",
            "heat exchanger",
            "exchanger",
            "surface condenser",
            "surface condensor",
            "condenser",
            "condensor",
            "inpeksi",
            "inspect",
            "inspektur",
            "qc inspektur",
            "tank",
            "tanki",
            "bulk tank",
            "bulktank",
            "silo",
            "fuel tank",
            "cargo tank",
            "bbm tank",
            "main tank",
            "maintank",
            "pump",
            "pompa",
            "valve",
            "safety valve",
            "pressure safety valve",
            "psv",
            "prv",
            "trv",
            "strainer",
            "wire rope",
            "tow wire",
            "wire rope clamp",
            "shackel",
            "a frame",
            "swl",
            "bollard",
            "anchor winch",
            "tugger winch",
            "winch",
            "crown block",
            "forklift",
            "portal gantry",
            "gantry",
            "lct",
            "docking",
            "propeller",
            "steering gear",
            "rig",
            "ccu",
            "spudcan",
        ],
    ),
]


@dataclass
class ModelArtifacts:
    model: Any
    contract: dict[str, Any]
    metadata: dict[str, Any]


def get_model_feature_spec(model_key: str) -> dict[str, Any]:
    if model_key not in MODEL_FEATURE_SPECS:
        raise KeyError(f"Unknown model key '{model_key}'.")
    return MODEL_FEATURE_SPECS[model_key]


def resolve_resource_file(
    filename: str,
    env_var_name: str,
    legacy_filenames: list[str] | None = None,
) -> Path:
    configured_path = os.getenv(env_var_name)
    candidate_paths: list[Path] = []

    if configured_path:
        configured = Path(configured_path)
        candidate_paths.append(configured if configured.is_absolute() else Path.cwd() / configured)

    resource_names = [filename, *(legacy_filenames or [])]
    for resource_name in resource_names:
        candidate_paths.extend(
            [
                RESOURCES_DIR / resource_name,
                Path.cwd() / resource_name,
                MODULE_ROOT / resource_name,
                MODULE_ROOT.parent / resource_name,
                SERVICE_ROOT / resource_name,
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


def resolve_dataset_path(path: Path | None = None) -> Path:
    if path is not None:
        return path
    return resolve_resource_file(
        DEFAULT_DATASET_FILENAME,
        "ML_TRAINING_DATASET_PATH",
        legacy_filenames=LEGACY_DATASET_FILENAMES,
    )


def resolve_alias_mapping_path(path: Path | None = None) -> Path:
    if path is not None:
        return path
    return resolve_resource_file(
        DEFAULT_ALIAS_MAPPING_FILENAME,
        "ML_CLIENT_ALIAS_MAPPING_PATH",
        legacy_filenames=["client_alias_mapping.xlsx"],
    )


def resolve_client_type_mapping_path(path: Path | None = None) -> Path:
    if path is not None:
        return path
    return resolve_resource_file(
        DEFAULT_CLIENT_TYPE_MAPPING_FILENAME,
        "ML_CLIENT_TYPE_MAPPING_PATH",
        legacy_filenames=["client_type_mapping.xlsx"],
    )


def sha256_for_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize_space(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    text = re.sub(r"[\r\n\t]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def clean_project_text(text: Any) -> str:
    normalized = normalize_space(text).lower()
    normalized = re.sub(r"[^a-z0-9\s/\-&]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def clean_client_name_basic(text: Any) -> str:
    normalized = normalize_space(text).lower()
    normalized = normalized.replace("&", " dan ")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\bpersero\b", " ", normalized)
    normalized = re.sub(r"\btbk\b", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def standardized_title(text: Any) -> str:
    normalized = clean_client_name_basic(text)
    if not normalized:
        return ""

    uppercase_tokens = {"pt", "cv", "bki", "pln", "pgn", "skk", "bp", "phm", "phe", "kkks", "esdm"}
    converted = [word.upper() if word in uppercase_tokens else word.capitalize() for word in normalized.split()]
    return " ".join(converted)


def keyword_in_text(text: str, pattern: str) -> bool:
    return re.search(re.escape(pattern.lower()), text) is not None


def classify_project(text: str | None, _project_category: str | None = None) -> str:
    text_clean = clean_project_text(text)
    if not text_clean:
        return "LAIN-LAIN"

    for label, patterns in PROJECT_RULES:
        for pattern in patterns:
            if keyword_in_text(text_clean, pattern):
                return label

    return "LAIN-LAIN"


def clean_price_value(value: Any) -> float | np.nan:
    if pd.isna(value):
        return np.nan

    if isinstance(value, (int, float, np.integer, np.floating)):
        numeric = float(value)
        return numeric if np.isfinite(numeric) else np.nan

    text = str(value).strip()
    if not text:
        return np.nan

    try:
        return float(text)
    except ValueError:
        pass

    text = text.replace("Rp", "").replace("IDR", "").replace("rupiah", "").strip()

    if re.search(r",\d{1,2}$", text) and not re.search(r"\.", text):
        text = text.replace(".", "")
        text = text.replace(",", ".")
    else:
        text = text.replace(".", "").replace(",", "")

    try:
        return float(text)
    except ValueError:
        return np.nan


def normalize_identifier_text(value: Any) -> str:
    text = normalize_space(value).lower()
    text = re.sub(r"\brev(?:isi)?[-\s]?\d+\b", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_offer_no(value: Any) -> str:
    text = normalize_space(value).upper()
    text = re.sub(r"\bREV(?:ISI)?[-\s]?\d+\b", "", text)
    text = re.sub(r"\(.*?REV.*?\)", "", text)
    text = re.sub(r"[^A-Z0-9/.-]+", "", text)
    if text in {"", "NAN", "NONE", "-", "--", "MOU"}:
        return ""
    return text


def first_non_empty_text(*values: Any) -> str:
    for value in values:
        if value is None:
            continue
        try:
            if pd.isna(value):
                continue
        except Exception:
            pass
        text = normalize_space(value)
        if text and text.upper() not in {"NAN", "NONE", "<NA>"}:
            return text
    return ""


def build_tender_group_id(row: pd.Series) -> str:
    offer_no_norm = normalize_offer_no(row.get("offer_no"))
    client_value = first_non_empty_text(row.get("client_name_clean"), row.get("client_name"))
    project_value = first_non_empty_text(row.get("project_name_clean"), row.get("project_name"))
    client_norm = normalize_identifier_text(client_value)
    project_norm = normalize_identifier_text(project_value)
    offer_date = pd.to_datetime(row.get("offer_date_final"), errors="coerce")
    date_token = offer_date.strftime("%Y-%m") if pd.notna(offer_date) else "unknown-date"

    if offer_no_norm and client_norm:
        return f"OFFER::{offer_no_norm}::{client_norm}"
    if offer_no_norm:
        return f"OFFER::{offer_no_norm}"
    return f"FALLBACK::{client_norm or 'unknown-client'}::{project_norm or 'unknown-project'}::{date_token}"


def load_alias_mapping(path: Path | None = None) -> dict[str, str]:
    mapping_path = resolve_alias_mapping_path(path)
    mapping = pd.read_excel(mapping_path)
    mapping.columns = [str(column).strip() for column in mapping.columns]

    rename: dict[str, str] = {}
    for column in mapping.columns:
        lowered = column.lower().strip()
        if lowered in {"client_name", "client_name_raw", "perusahaan", "nama perusahaan mentah"}:
            rename[column] = "client_name_raw"
        elif lowered in {"client_name_clean", "client_name_clean_basic", "nama perusahaan clean", "nama clean"}:
            rename[column] = "client_name_clean"
        elif lowered in {"client_name_standardized", "standardized", "nama perusahaan standar", "perusahaan standar"}:
            rename[column] = "client_name_standardized"

    mapping = mapping.rename(columns=rename)

    if "client_name_clean" not in mapping.columns:
        if "client_name_raw" not in mapping.columns:
            raise ValueError(
                "Alias mapping harus memiliki kolom client_name_clean/client_name_clean_basic atau client_name_raw."
            )
        mapping["client_name_clean"] = mapping["client_name_raw"].apply(clean_client_name_basic)

    if "client_name_standardized" not in mapping.columns:
        raise ValueError("Alias mapping harus memiliki kolom client_name_standardized.")

    mapping = mapping.dropna(subset=["client_name_clean", "client_name_standardized"]).copy()
    mapping["client_name_clean"] = mapping["client_name_clean"].apply(clean_client_name_basic)
    mapping["client_name_standardized"] = mapping["client_name_standardized"].astype(str).str.strip()
    mapping = mapping[mapping["client_name_clean"] != ""]
    mapping = mapping[mapping["client_name_standardized"] != ""]
    mapping = mapping.drop_duplicates(subset=["client_name_clean"], keep="first")

    return dict(
        zip(
            mapping["client_name_clean"].tolist(),
            mapping["client_name_standardized"].tolist(),
            strict=True,
        )
    )


def load_client_type_mapping(path: Path | None = None) -> dict[str, str]:
    mapping_path = resolve_client_type_mapping_path(path)
    mapping = pd.read_excel(mapping_path)
    mapping.columns = [str(column).strip() for column in mapping.columns]

    rename: dict[str, str] = {}
    for column in mapping.columns:
        lowered = column.lower().strip()
        if lowered in {"client_name_standardized", "standardized", "nama perusahaan standar", "perusahaan standar"}:
            rename[column] = "client_name_standardized"
        elif lowered in {"type_of_client", "type of client", "tipe klien", "kategori klien"}:
            rename[column] = "type_of_client"

    mapping = mapping.rename(columns=rename)
    required_columns = {"client_name_standardized", "type_of_client"}
    missing_columns = required_columns.difference(mapping.columns)
    if missing_columns:
        raise ValueError(
            f"Client type mapping belum memiliki kolom wajib: {sorted(missing_columns)}"
        )

    mapping = mapping.dropna(subset=["client_name_standardized", "type_of_client"]).copy()
    mapping["client_name_standardized"] = mapping["client_name_standardized"].astype(str).str.strip()
    mapping["type_of_client"] = mapping["type_of_client"].astype(str).str.strip().str.upper()

    invalid_rows = mapping[~mapping["type_of_client"].isin(ALLOWED_CLIENT_TYPES)]
    if len(invalid_rows) > 0:
        raise ValueError(
            "Terdapat type_of_client di luar kategori resmi. "
            f"Nilai tidak valid: {sorted(invalid_rows['type_of_client'].unique().tolist())}"
        )

    mapping = mapping.drop_duplicates(subset=["client_name_standardized"], keep="first")
    return dict(
        zip(
            mapping["client_name_standardized"].tolist(),
            mapping["type_of_client"].tolist(),
            strict=True,
        )
    )


def infer_client_type(
    company_name: str | None,
    _company_category: str | None,
    alias_mapping: dict[str, str],
    client_type_mapping: dict[str, str],
) -> tuple[str, str | None]:
    cleaned_name = clean_client_name_basic(company_name)
    if not cleaned_name:
        return "LAIN-LAIN", None

    standardized_name = alias_mapping.get(cleaned_name) or standardized_title(cleaned_name)
    client_type = client_type_mapping.get(standardized_name, "LAIN-LAIN")
    return client_type, standardized_name


def summarize_numeric_series(values: pd.Series) -> dict[str, float | None]:
    numeric = values.dropna().astype(float)
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
    final_df: pd.DataFrame,
    dataset_path: Path,
    alias_mapping_path: Path,
    client_type_mapping_path: Path,
) -> dict[str, Any]:
    drop_count = int(len(raw_df) - len(final_df))
    ratio_series = final_df["PriceRatio"]
    target_delta = (final_df["WinnerPrice"] - final_df["TenderPrice"]).abs()

    return {
        "dataset_version": sha256_for_file(dataset_path),
        "dataset_path": str(dataset_path),
        "alias_mapping_version": sha256_for_file(alias_mapping_path),
        "alias_mapping_path": str(alias_mapping_path),
        "client_type_mapping_version": sha256_for_file(client_type_mapping_path),
        "client_type_mapping_path": str(client_type_mapping_path),
        "training_cutoff_date": TRAINING_CUTOFF_DATE.date().isoformat(),
        "raw_rows": int(len(raw_df)),
        "final_rows": int(len(final_df)),
        "dropped_rows": drop_count,
        "kept_ratio": float(len(final_df) / len(raw_df)) if len(raw_df) > 0 else 0.0,
        "target_distribution": summarize_numeric_series(final_df["WinnerPrice"]),
        "tender_price_distribution": summarize_numeric_series(final_df["TenderPrice"]),
        "price_ratio_distribution": summarize_numeric_series(ratio_series),
        "target_delta_distribution": summarize_numeric_series(target_delta),
        "client_type_distribution": {
            key: int(value)
            for key, value in final_df["Type of Client"].value_counts(dropna=False).to_dict().items()
        },
        "project_type_distribution": {
            key: int(value)
            for key, value in final_df["Type of Project"].value_counts(dropna=False).to_dict().items()
        },
    }


def prepare_training_dataframe(
    dataset_path: Path | None = None,
    alias_mapping_path: Path | None = None,
    client_type_mapping_path: Path | None = None,
    include_audit: bool = False,
) -> pd.DataFrame | tuple[pd.DataFrame, dict[str, Any]]:
    resolved_dataset_path = resolve_dataset_path(dataset_path)
    resolved_alias_mapping_path = resolve_alias_mapping_path(alias_mapping_path)
    resolved_client_type_mapping_path = resolve_client_type_mapping_path(client_type_mapping_path)

    raw_df = pd.read_excel(resolved_dataset_path).copy()
    raw_df.columns = [str(column).strip() for column in raw_df.columns]

    df = raw_df.copy()
    df["client_name"] = df.get("client_name", pd.Series(index=df.index, dtype="object"))
    df["project_name"] = df.get("project_name", pd.Series(index=df.index, dtype="object"))
    df["offer_no"] = df.get("offer_no", pd.Series(index=df.index, dtype="object"))
    df["offer_date_final"] = pd.to_datetime(df.get("offer_date_final"), errors="coerce")
    df["tender_price"] = df.get("tender_price", pd.Series(index=df.index, dtype="float64")).apply(clean_price_value)
    df["winner_price"] = df.get("winner_price", pd.Series(index=df.index, dtype="float64")).apply(clean_price_value)

    df["project_name_clean"] = df["project_name"].apply(clean_project_text)
    df["client_name_clean"] = df["client_name"].apply(clean_client_name_basic)
    df["year"] = df["offer_date_final"].dt.year
    df["quarter"] = df["offer_date_final"].dt.quarter
    df["month"] = df["offer_date_final"].dt.month
    df["price_ratio"] = df["winner_price"] / df["tender_price"]
    df.loc[~np.isfinite(df["price_ratio"]), "price_ratio"] = np.nan

    alias_mapping = load_alias_mapping(resolved_alias_mapping_path)
    client_type_mapping = load_client_type_mapping(resolved_client_type_mapping_path)

    client_results = df["client_name"].apply(
        lambda value: infer_client_type(value, None, alias_mapping, client_type_mapping)
    )
    df["client_name_standardized"] = client_results.apply(lambda value: value[1])
    df["type_of_client"] = client_results.apply(lambda value: value[0])
    df["type_of_project"] = df["project_name_clean"].apply(classify_project)
    df["offer_no_normalized"] = df["offer_no"].apply(normalize_offer_no)
    df["tender_group_id"] = df.apply(build_tender_group_id, axis=1)

    final_df = df.dropna(
        subset=[
            "offer_date_final",
            "tender_price",
            "winner_price",
            "year",
            "quarter",
            "month",
            "project_name_clean",
        ]
    ).copy()
    final_df = final_df[
        (final_df["offer_date_final"] < TRAINING_CUTOFF_DATE)
        & (final_df["tender_price"] > 0)
        & (final_df["winner_price"] > 0)
        & final_df["price_ratio"].between(0.1, 10, inclusive="both")
    ].copy()

    final_df["TenderPrice"] = final_df["tender_price"].astype(float)
    final_df["WinnerPrice"] = final_df["winner_price"].astype(float)
    final_df["TenderPriceLog"] = np.log1p(final_df["TenderPrice"])
    final_df["WinnerPriceLog"] = np.log1p(final_df["WinnerPrice"])
    final_df["Year"] = final_df["year"].astype(int)
    final_df["Quarter"] = final_df["quarter"].astype(int)
    final_df["Month"] = final_df["month"].astype(int)
    final_df["Type of Client"] = final_df["type_of_client"].fillna("LAIN-LAIN").astype(str).str.upper().str.strip()
    final_df["Type of Project"] = final_df["type_of_project"].fillna("LAIN-LAIN").astype(str).str.upper().str.strip()
    final_df["PriceRatio"] = final_df["price_ratio"].astype(float)

    if not include_audit:
        return final_df

    audit = build_dataset_audit(
        raw_df=raw_df,
        final_df=final_df,
        dataset_path=resolved_dataset_path,
        alias_mapping_path=resolved_alias_mapping_path,
        client_type_mapping_path=resolved_client_type_mapping_path,
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
    target = df["WinnerPriceLog"].copy()
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
        "TenderPriceLog": float(np.log1p(float(payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval))),
        "Year": int(work_date.year),
        "Quarter": int(work_date.quarter),
        "Month": int(work_date.month),
        "Type of Client": type_of_client,
        "Type of Project": type_of_project,
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
    ordered_payload = {key: runtime_features[key] for key in contract.get("runtime_feature_keys", [])}
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
