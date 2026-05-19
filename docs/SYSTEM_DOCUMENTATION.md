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
  - Feature: `Year`, `Quarter`, `Month`, `Type of Client`, `Type of Project`, `EstimatedPriceLog`
  - `EstimatedPriceLog` berasal dari `log1p(Harga)` pada data historis
  - Saat runtime, feature ini disejajarkan dengan `log1p(ruleBasedEstimateBeforeApproval)`
  - Status saat ini: `limited`

### Validasi yang Dilakukan

Pipeline `ml_service/train_models.py` sekarang melakukan:

- audit cleaning dataset
- audit leakage `Harga` vs `Harga Sebelum Approval`
- benchmark 3 model utama
- time-series cross-validation
- time-based final holdout
- segment metrics per project type, client type, price band, year, dan quarter

### Candidate Model

Model yang dibandingkan:

- Linear Regression
- SVR
- Random Forest

### Hasil Penting Saat Ini

- Eksperimen awal notebook memilih `SVR` sebagai model terbaik.
- Setelah pipeline direvisi agar selaras dengan runtime website dan dievaluasi ulang dengan protokol yang lebih ketat, artifact `hybrid` terbaik saat ini dipilih dari `Linear Regression`.
- Namun, evaluasi residual terbaru menunjukkan `hybrid` belum mengalahkan baseline estimasi langsung, sehingga model lebih tepat diposisikan sebagai benchmark analitis daripada pengganti estimator utama.
- Ini tidak membatalkan notebook awal, tetapi menunjukkan bahwa model terbaik bisa berubah ketika kontrak feature dan metodologi evaluasi diperketat.

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

- nama model
- validation state
- validation summary
- variance terhadap hasil rule-based

## Quality Check

Sebelum deploy:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
python ml_service/train_models.py
```
