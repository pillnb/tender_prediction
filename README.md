# Website Kalkulator Tender

Website Kalkulator Tender adalah aplikasi web untuk menghitung harga tender berbasis rule engine, menyimpan draft/final tender, dan menyediakan benchmark machine learning sebagai pembanding eksperimental.

## Ringkasan

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4.
- Backend: API routes Next.js untuk persistence, PDF, archive, duplicate, dan bridge ke ML service.
- Database: PostgreSQL melalui Prisma.
- ML Service: FastAPI sidecar untuk benchmark harga tender dengan evaluasi 3 model yang reproducible.

## Menjalankan Project

```bash
npm install
npx prisma generate
npm run dev
```

Untuk ML service:

```bash
pip install -r ml_service/requirements.txt
npm run ml:train
npm run ml:serve
```

## Environment Variable

```env
DATABASE_URL="prisma+postgres://..."
DIRECT_URL="postgresql://..."
ML_SERVICE_URL="http://127.0.0.1:8001"
PYTHON_EXECUTABLE="python"
```

Di production, `ML_SERVICE_URL` wajib diisi jika benchmark ML ingin aktif.

## Script Penting

- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run ml:train`
- `npm run ml:serve`
- `npm run api:live-test`

## Status Model ML Saat Ini

Family benchmark yang tersedia:

- `project_only`
  Menggunakan feature proyek notebook tanpa tender price. Artifact runtime dipin ke SVR notebook terbaru dan status validasinya `limited`.
- `hybrid`
  Menggunakan feature proyek plus `TenderPriceLog`, yaitu `log1p(Harga)` historis yang disejajarkan dengan `log1p(ruleBasedEstimateBeforeApproval)` saat runtime. Status validasinya `limited`.

Poin penting:

- `ml_service` sekarang disejajarkan ke notebook `revisi_price_prediction_using_extracted_data.ipynb`.
- Trainer memakai resource kanonik di `ml_service/resources/`: dataset extractor, alias mapping, dan client type mapping.
- Runtime `Type of Client` mengikuti alias mapping + `client_type_mapping.xlsx`, bukan fallback `companyCategory`.
- Runtime `Type of Project` dihitung dari `projectName` memakai `PROJECT_RULES` notebook.
- Benchmark ini tetap diposisikan sebagai pembanding ML, bukan pengganti rule-based estimator utama.

## Artefak Validasi ML

Artefak evaluasi tersimpan di `ml_service/artifacts/`:

- `dataset_audit.json`
- `evaluation_report.json`
- `model_metadata.json`
- `project_only_feature_contract.json`
- `hybrid_feature_contract.json`

Dokumentasi teknis lebih lengkap tersedia di [docs/SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md).
