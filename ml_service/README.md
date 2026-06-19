# ML Service

FastAPI sidecar untuk benchmark harga tender.

## Setup

```bash
pip install -r ml_service/requirements.txt
python ml_service/train_models.py
uvicorn ml_service.app.main:app --reload --port 8001
```

## Resource Canonical

Trainer runtime sekarang memakai file kanonik di `ml_service/resources/`:

- `training_dataset.xlsx`
- `client_alias_mapping.xlsx`
- `client_type_mapping.xlsx`

## Prinsip Modeling

- Target: `Harga Sebelum Approval`
- `project_only`: feature proyek saja
- `hybrid`: feature proyek + estimasi harga runtime

Kontrak feature runtime diselaraskan ke notebook `revisi_price_prediction_using_extracted_data.ipynb`:

- `project_only`: `Year`, `Quarter`, `Month`, `Type of Client`, `Type of Project`
- `hybrid`: `TenderPriceLog`, `Year`, `Quarter`, `Month`, `Type of Client`, `Type of Project`

Pada family `hybrid`, `TenderPriceLog` berasal dari `log1p(Harga)` pada data historis. Di runtime website, padanannya adalah `log1p(ruleBasedEstimateBeforeApproval)`.

## Evaluasi

Trainer:

- membaca dataset extractor notebook,
- menerapkan alias mapping dan client type mapping,
- membangun classifier `Type of Project` sesuai `PROJECT_RULES` notebook,
- mem-pin artifact runtime ke hyperparameter SVR notebook terbaru,
- menyimpan random holdout, group-aware cross-validation, dan temporal holdout ke metadata.

Status validasi runtime tetap `limited`, karena benchmark ini disimpan sebagai pembanding ML, bukan estimator harga utama.

## Artifact

- `dataset_audit.json`
- `evaluation_report.json`
- `model_metadata.json`
- `project_only_feature_contract.json`
- `hybrid_feature_contract.json`
