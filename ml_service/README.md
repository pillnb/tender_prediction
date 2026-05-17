# ML Service

FastAPI sidecar untuk benchmark `AI Price Prediction Benchmark (SVR)`.

## Setup

```bash
pip install -r ml_service/requirements.txt
python ml_service/train_models.py
uvicorn ml_service.app.main:app --reload --port 8001
```

## Artifacts

Artefak model disimpan di `ml_service/artifacts/`:

- `project_only_model.joblib`
- `hybrid_model.joblib`
- `project_only_feature_contract.json`
- `hybrid_feature_contract.json`
- `model_metadata.json`

## Data Sources

Secara default trainer membaca:

- `../tender_fix.xlsx`
- `../Mapping_Client_BKI_Fix.xlsx`

Path ini bisa dioverride via environment variable:

- `ML_TRAINING_DATASET_PATH`
- `ML_CLIENT_MAPPING_PATH`
