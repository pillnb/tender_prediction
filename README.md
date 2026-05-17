# Website Kalkulator Tender

Website Kalkulator Tender adalah aplikasi web untuk membantu proses estimasi harga penawaran proyek. Sistem ini menghitung biaya langsung, overhead, profit, CGL/insurance, pembulatan harga akhir, menyimpan draft/final tender, serta menyediakan benchmark prediksi harga berbasis model machine learning SVR.

Dokumentasi teknis lengkap tersedia di [docs/SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md).

## Ringkasan Sistem

- Frontend: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, komponen UI berbasis Base UI/shadcn style, dan ikon Lucide.
- Backend: Next.js API Routes sebagai server-side endpoint untuk kalkulasi tender, arsip, duplikasi, PDF, dan koneksi benchmark AI.
- Database: PostgreSQL melalui Prisma ORM dan Prisma Accelerate.
- ML Service: FastAPI sidecar untuk prediksi benchmark SVR, dengan fallback eksekusi Python lokal dari Next.js.
- Output utama: harga akhir tender dalam IDR, rincian biaya per komponen, audit sumber tarif, arsip proyek, print page, dan file PDF.

## System Requirement

Minimum environment yang disarankan:

- Node.js 20 atau lebih baru.
- npm 10 atau lebih baru.
- Python 3.10 atau lebih baru untuk ML service.
- PostgreSQL atau Prisma Accelerate/Supabase PostgreSQL.
- Sistem operasi Windows, macOS, atau Linux.
- Browser modern seperti Chrome, Edge, Firefox, atau Safari.

Dependency utama:

- `next` 16.2.4
- `react` 19.2.4
- `@prisma/client` 7.8.0
- `typescript` 5
- `fastapi`, `uvicorn`, `pandas`, `numpy`, `scikit-learn`, `joblib`, `openpyxl` untuk service ML

## Instalasi

1. Install dependency Node.js:

```bash
npm install
```

2. Siapkan environment variable di `.env`:

```env
DATABASE_URL="prisma+postgres://..."
DIRECT_URL="postgresql://..."
ML_SERVICE_URL="http://127.0.0.1:8001"
PYTHON_EXECUTABLE="python"
```

`DATABASE_URL` dipakai Prisma Client/Accelerate. `DIRECT_URL` dipakai Prisma untuk migrasi langsung ke PostgreSQL. `ML_SERVICE_URL` opsional karena default-nya `http://127.0.0.1:8001`.

3. Generate Prisma Client jika diperlukan:

```bash
npx prisma generate
```

4. Jalankan database migration:

```bash
npx prisma migrate dev
```

5. Seed data demo opsional:

```bash
npm run db:seed
```

## Menjalankan Aplikasi

Jalankan frontend dan backend Next.js:

```bash
npm run dev
```

Buka aplikasi di:

```text
http://localhost:3000
```

Jalankan ML service FastAPI di terminal lain:

```bash
pip install -r ml_service/requirements.txt
npm run ml:serve
```

Jika ML service tidak berjalan, endpoint benchmark AI akan mencoba fallback lokal melalui `ml_service/predict_once.py`.

## Script Tersedia

- `npm run dev`: menjalankan Next.js development server.
- `npm run build`: build production.
- `npm run start`: menjalankan hasil build production.
- `npm run lint`: menjalankan ESLint.
- `npm run lint:fix`: menjalankan ESLint dengan auto-fix.
- `npm run format`: format seluruh file dengan Prettier.
- `npm run format:check`: cek format Prettier.
- `npm run db:seed`: membuat data tender demo.
- `npm run ml:train`: melatih ulang model SVR.
- `npm run ml:serve`: menjalankan FastAPI ML service pada port 8001.

## Fitur Utama

- Wizard kalkulasi tender bertahap: direct costs, indirect costs, profit & CGL, final summary.
- Deskripsi proyek: nama pekerjaan, kategori proyek, lokasi, perusahaan, kategori perusahaan, durasi, dan tanggal pekerjaan.
- Biaya tenaga kerja: kategori tenaga ahli, teknisi/analis, supporting staff, pendidikan, pengalaman, SKK, jumlah personel, durasi, tarif otomatis INKINDO, dan manual override.
- Mob & Demob: mobilisasi personel dan equipment handling dengan `qty x freq x harga`.
- Biaya peralatan: daftar alat dinamis dengan qty, frekuensi, harga satuan, dan subtotal.
- Material/supporting cost: meal allowance, penginapan, reporting, permit, MCU, dan biaya lain.
- Tarif penginapan otomatis berdasarkan referensi PMK 32/2025 per lokasi.
- Overhead berdasarkan persentase dari total biaya langsung.
- Profit berdasarkan persentase dari subtotal sebelum profit.
- CGL/insurance sebagai nominal biaya yang masuk ke total akhir.
- Pembulatan harga akhir berdasarkan increment yang ditentukan.
- Validasi form per step dan per section.
- Auto-save draft lokal di browser dengan `localStorage`.
- Simpan draft/final tender ke database.
- Load draft terakhir dan buka record dari arsip.
- Arsip, hard delete, dan duplikasi tender.
- Benchmark AI dengan dua model SVR: `project_only` dan `hybrid`.
- Print page dan download PDF tender.

## Struktur Folder

```text
website_kalkulator/
├─ src/
│  ├─ app/                         # Page dan API routes Next.js
│  ├─ components/
│  │  ├─ features/tender/           # UI fitur kalkulator tender
│  │  ├─ layout/                    # Navigasi dan layout
│  │  └─ ui/                        # Komponen UI reusable
│  ├─ lib/                          # Kalkulasi, repository, Prisma, PDF, utilitas
│  └─ types/                        # TypeScript domain tender
├─ prisma/                          # Schema, migration, seed
├─ ml_service/                      # FastAPI, trainer, predictor, model artifacts
├─ public/                          # Static assets
└─ docs/                            # Dokumentasi sistem
```

## Backend dan API

Endpoint backend berada di `src/app/api`.

- `GET /api/tender-calculations`: mengambil daftar tender aktif.
- `GET /api/tender-calculations?includeArchived=true`: mengambil semua tender termasuk archived.
- `GET /api/tender-calculations?mode=latest`: mengambil draft/latest tender terbaru.
- `POST /api/tender-calculations`: menyimpan tender baru.
- `GET /api/tender-calculations/:id`: mengambil detail tender.
- `PUT /api/tender-calculations/:id`: memperbarui tender.
- `DELETE /api/tender-calculations/:id`: soft delete ke status archived.
- `DELETE /api/tender-calculations/:id?mode=hard-delete`: hapus permanen.
- `POST /api/tender-calculations/:id/duplicate`: membuat salinan tender.
- `GET /api/tender-calculations/:id/pdf`: download PDF tender.
- `POST /api/ai-benchmark`: menjalankan benchmark prediksi harga AI.

## Rumus Kalkulasi

Rumus utama sistem:

```text
subtotal item = qty x freq/durasi x harga satuan
total biaya langsung = tenaga kerja + mob/demob + peralatan + supporting
overhead = overheadPercentage x total biaya langsung
subtotal sebelum profit = total biaya langsung + overhead
profit = profitPercentage x subtotal sebelum profit
harga sebelum pembulatan = subtotal sebelum profit + profit + CGL/insurance
harga akhir = pembulatan(harga sebelum pembulatan, roundingIncrement)
```

## Database

Model utama adalah `TenderCalculation` di `prisma/schema.prisma`. Data yang disimpan mencakup identitas proyek, status record, versi rule engine, versi master data, parameter overhead/profit/CGL, ringkasan nominal, payload form lengkap, payload benchmark AI, timestamp, dan status arsip.

Status record yang digunakan:

- `draft`
- `reviewed`
- `final`
- `archived`

## Machine Learning Service

Folder `ml_service` berisi:

- `app/main.py`: FastAPI endpoint.
- `app/core.py`: logic prediksi dan feature contract.
- `predict_once.py`: fallback prediksi sekali jalan dari stdin/stdout.
- `train_models.py`: training model.
- `artifacts/`: model dan metadata hasil training.

Training default membaca dataset dari:

- `../tender_fix.xlsx`
- `../Mapping_Client_BKI_Fix.xlsx`

Path dataset bisa dioverride:

```env
ML_TRAINING_DATASET_PATH="..."
ML_CLIENT_MAPPING_PATH="..."
```

## Validasi dan Quality Check

Sebelum commit atau deploy, jalankan:

```bash
npm run lint
npm run format:check
npm run build
```

Untuk ML service, pastikan dependency Python terinstall dan endpoint `/predict-benchmark` dapat merespons payload dari `/api/ai-benchmark`.

## Catatan Keamanan

Jangan commit credential database atau API key production ke repository. Simpan nilai sensitif di `.env` lokal atau secret manager deployment.
