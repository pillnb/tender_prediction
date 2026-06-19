# Dokumentasi Sistem Website Kalkulator Tender

## Tujuan

Sistem ini membantu user menyusun estimasi harga tender secara terstruktur, menyimpan record tender, dan membandingkan hasil rule-based calculator dengan benchmark machine learning.

## Arsitektur

1. Frontend Next.js App Router
2. Backend Next.js API Routes
3. PostgreSQL via Prisma
4. FastAPI ML service

Alur benchmark:

```text
UI Final Summary
  -> POST /api/ai-benchmark
  -> FastAPI /predict-benchmark
  -> response benchmark + validation state
```

## Kalkulasi Rule-Based

```text
subtotal item = qty x freq x harga satuan
direct cost = labor + mobility + equipment + supporting
overhead = overheadPercentage x direct cost
subtotal before profit = direct cost + overhead
profit = profitPercentage x subtotal before profit
final before rounding = subtotal before profit + profit + CGL
final rounded price = pembulatan(final before rounding)
```

## Machine Learning Service

Folder `ml_service` berisi:

- `app/main.py`
- `app/core.py`
- `train_models.py`
- `predict_once.py`
- `artifacts/*`

### Target

Target formal model adalah `Harga Sebelum Approval`.

### Family Model

- `project_only`
  - Feature: `Year`, `Quarter`, `Month`, `Type of Client`, `Type of Project`
  - Status saat ini: `limited`

- `hybrid`
  - Feature: `TenderPriceLog`, `Year`, `Quarter`, `Month`, `Type of Client`, `Type of Project`
  - `TenderPriceLog` berasal dari `log1p(Harga)` pada data historis
  - Saat runtime, feature ini disejajarkan dengan `log1p(ruleBasedEstimateBeforeApproval)`
  - Status saat ini: `limited`

### Validasi yang Dilakukan

Pipeline `ml_service/train_models.py` sekarang melakukan:

- load dataset extractor notebook dari `ml_service/resources/training_dataset.xlsx`
- load `client_alias_mapping.xlsx` dan `client_type_mapping.xlsx`
- bentuk `Type of Client` dan `Type of Project` sesuai notebook revisi
- latih dua artifact runtime dengan hyperparameter SVR tetap dari notebook terbaru
- simpan random holdout, group-aware cross-validation, dan temporal holdout ke artifact evaluasi

### Hyperparameter Runtime

- `project_only`: `SVR(kernel="linear", C=1, epsilon=0.1, gamma="scale")`
- `hybrid`: `SVR(kernel="linear", C=100, epsilon=0.1, gamma="scale")`

### Hasil Penting Saat Ini

- Eksperimen awal notebook memilih `SVR` sebagai model terbaik.
- Artifact runtime sekarang dipin langsung ke konfigurasi SVR notebook terbaru untuk dua skenario: tanpa tender price dan dengan tender price.
- Mapping perusahaan di runtime mengikuti alias mapping dan `client_type_mapping.xlsx`, bukan fallback `companyCategory`.
- Model benchmark tetap diberi status `limited` agar jelas bahwa rule-based calculator masih menjadi sumber harga utama.

## Artefak Evaluasi

Artifact yang dihasilkan:

- `ml_service/artifacts/dataset_audit.json`
- `ml_service/artifacts/evaluation_report.json`
- `ml_service/artifacts/model_metadata.json`
- `ml_service/artifacts/project_only_feature_contract.json`
- `ml_service/artifacts/hybrid_feature_contract.json`

## Integrasi Frontend

Frontend tetap mengirim payload lengkap benchmark dari `src/lib/tenderCalculations.ts`. ML service sendiri yang memetakan payload itu ke feature contract model runtime.

UI final summary sekarang juga menampilkan:

- nama model `project_only` dan `hybrid`
- validation state masing-masing model
- validation summary masing-masing model
- variance tiap model terhadap hasil rule-based

## Quality Check

Sebelum deploy:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
python ml_service/train_models.py
```
