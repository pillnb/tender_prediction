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
  Menggunakan feature proyek saja. Saat ini status validasinya masih `limited`.
- `hybrid`
  Menggunakan feature proyek plus estimasi harga runtime yang disejajarkan dengan kolom historis `Harga`. Saat ini status validasinya `limited`.

Poin penting:

- Notebook awal membuktikan bahwa `SVR` adalah model terbaik pada eksperimen awal.
- Implementasi production-grade sekarang tetap mempertahankan premis notebook: `Harga` historis dipakai sebagai estimasi, lalu disejajarkan dengan `ruleBasedEstimateBeforeApproval` saat runtime.
- Setelah evaluasi ulang dengan time-based holdout yang tetap dibatasi ke 3 model utama, kandidat terbaik untuk artifact `hybrid` saat ini adalah `Linear Regression`.
- Meski begitu, `hybrid` belum mengalahkan baseline estimasi langsung, sehingga nilai ilmiahnya lebih kuat sebagai benchmark/analisis residual daripada pengganti estimasi utama.

## Artefak Validasi ML

Artefak evaluasi tersimpan di `ml_service/artifacts/`:

- `dataset_audit.json`
- `evaluation_report.json`
- `model_metadata.json`
- `project_only_feature_contract.json`
- `hybrid_feature_contract.json`

Dokumentasi teknis lebih lengkap tersedia di [docs/SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md).
