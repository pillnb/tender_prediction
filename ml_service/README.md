# ML Service

FastAPI sidecar untuk benchmark harga tender.

## Setup

```bash
pip install -r ml_service/requirements.txt
python ml_service/train_models.py
uvicorn ml_service.app.main:app --reload --port 8001
```

## Prinsip Modeling

- Target: `Harga Sebelum Approval`
- `project_only`: feature proyek saja
- `hybrid`: feature proyek + estimasi harga runtime

Pada family `hybrid`, kolom historis `Harga` diperlakukan sebagai estimasi awal. Di runtime website, padanan semantiknya adalah `ruleBasedEstimateBeforeApproval`. Keduanya disejajarkan melalui transformasi `log1p`.

## Evaluasi

Trainer:

- membersihkan data,
- membangun dataset audit,
- membandingkan 3 model utama,
- memakai time-based holdout,
- menghasilkan metadata dan feature contract untuk runtime.

Notebook awal menunjukkan `SVR` sebagai model terbaik pada eksperimen awal. Artifact runtime sekarang tetap dipilih dari benchmark production-grade terbaru, tetapi pembandingnya tetap dibatasi ke 3 model utama: Linear Regression, Random Forest, dan SVR.

Artifact evaluasi terbaru juga menyimpan residual analysis dan baseline `direct_estimate`, sehingga kita bisa mengukur apakah model benar-benar memberi nilai tambah di atas estimasi awal.

## Artifact

- `dataset_audit.json`
- `evaluation_report.json`
- `model_metadata.json`
- `project_only_feature_contract.json`
- `hybrid_feature_contract.json`
