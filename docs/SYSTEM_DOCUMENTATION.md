# Dokumentasi Sistem Website Kalkulator Tender

Dokumen ini menjelaskan keseluruhan sistem `website_kalkulator`: requirement, arsitektur, backend, frontend, database, machine learning service, rumus kalkulasi, dan fitur yang tersedia.

## 1. Tujuan Sistem

`website_kalkulator` adalah sistem kalkulator harga tender berbasis web. Tujuan utamanya adalah membantu user menyusun estimasi harga penawaran proyek secara terstruktur, transparan, dan dapat disimpan.

Sistem mendukung:

- Input detail proyek.
- Input biaya langsung.
- Kalkulasi overhead, profit, CGL/insurance, dan pembulatan.
- Validasi input tender.
- Penyimpanan draft/final tender ke database.
- Arsip dan duplikasi proyek tender.
- Benchmark harga berbasis model machine learning SVR.
- Output print/PDF untuk dokumentasi tender.

## 2. System Requirement

### 2.1 Runtime

- Node.js 20 atau lebih baru.
- npm 10 atau lebih baru.
- Python 3.10 atau lebih baru.
- PostgreSQL atau layanan PostgreSQL compatible.
- Browser modern.

### 2.2 Dependency Frontend dan Backend

Dependency utama dari `package.json`:

- Next.js `16.2.4`
- React `19.2.4`
- React DOM `19.2.4`
- TypeScript `^5`
- Tailwind CSS `^4`
- Base UI React `^1.4.1`
- Lucide React `^1.8.0`
- Prisma Client `^7.8.0`
- Prisma Accelerate extension `^3.0.1`

### 2.3 Dependency ML Service

Dependency Python dari `ml_service/requirements.txt`:

- FastAPI
- Uvicorn
- pandas
- numpy
- scikit-learn
- joblib
- openpyxl

### 2.4 Environment Variable

Environment variable yang digunakan:

```env
DATABASE_URL="prisma+postgres://..."
DIRECT_URL="postgresql://..."
ML_SERVICE_URL="http://127.0.0.1:8001"
PYTHON_EXECUTABLE="python"
ML_TRAINING_DATASET_PATH="../tender_fix.xlsx"
ML_CLIENT_MAPPING_PATH="../Mapping_Client_BKI_Fix.xlsx"
```

`ML_SERVICE_URL`, `PYTHON_EXECUTABLE`, `ML_TRAINING_DATASET_PATH`, dan `ML_CLIENT_MAPPING_PATH` bersifat opsional. Jika `ML_SERVICE_URL` kosong, aplikasi memakai default `http://127.0.0.1:8001`.

## 3. Arsitektur Sistem

Sistem terdiri dari empat lapisan utama:

1. Frontend Next.js App Router
2. Backend Next.js API Routes
3. Database PostgreSQL melalui Prisma
4. ML service Python/FastAPI

Alur umum:

```text
User Browser
  -> Next.js Page / React Components
  -> src/lib/tenderCalculations.ts untuk kalkulasi client-side
  -> Next.js API Routes untuk save/load/pdf/benchmark
  -> Prisma Client
  -> PostgreSQL

Final Summary
  -> /api/ai-benchmark
  -> FastAPI ML service / fallback predict_once.py
  -> SVR benchmark result
```

## 4. Struktur Direktori

```text
src/app
```

Berisi route aplikasi dan API route. Page utama berada di `src/app/page.tsx`, halaman arsip di `src/app/archived/page.tsx`, dan endpoint backend di `src/app/api`.

```text
src/components/features/tender
```

Berisi komponen fitur kalkulator tender:

- `TenderDashboard.tsx`
- `ProjectDescription.tsx`
- `LaborCosts.tsx`
- `MobDemob.tsx`
- `EquipmentCosts.tsx`
- `OperationalCosts.tsx`
- `TaxMarginConfig.tsx`
- `EstimationSummary.tsx`
- `ArchivedTenderList.tsx`
- `PrintPageActions.tsx`
- `PrintAutoTrigger.tsx`
- `VisualContext.tsx`

```text
src/lib
```

Berisi logic domain dan helper:

- `tenderCalculations.ts`: kalkulasi tender dan payload benchmark.
- `tender-validation.ts`: validasi form tender.
- `tender-repository.ts`: operasi database.
- `tender-master-data.ts`: master data tarif, indeks lokasi, lodging, dan label opsi.
- `prisma.ts`: Prisma Client singleton.
- `pdf.ts`: generator PDF internal.
- `currency.ts`: format mata uang.
- `utils.ts`: utility umum.

```text
src/types
```

Berisi type domain tender di `tender.ts`.

```text
prisma
```

Berisi schema database, migration, dan seed demo.

```text
ml_service
```

Berisi service ML FastAPI, trainer, fallback predictor, model artifacts, dan README khusus ML.

## 5. Frontend

Frontend dibangun dengan Next.js App Router dan React client components.

### 5.1 Halaman Utama

Route:

```text
/
```

Komponen utama:

```text
src/components/features/tender/TenderDashboard.tsx
```

Fungsi halaman utama:

- Menampilkan wizard kalkulasi tender.
- Mengatur state form tender.
- Menghitung hasil tender secara real-time.
- Melakukan validasi per step.
- Menyimpan draft lokal ke `localStorage`.
- Memuat draft database terbaru.
- Memuat record dari query `?recordId=...`.
- Memanggil benchmark AI saat final summary.
- Menyimpan record ke database.

### 5.2 Wizard Step

Step yang tersedia:

1. `landing`
2. `direct-costs`
3. `indirect-costs`
4. `profit-cgl`
5. `final-summary`

User tidak bisa lanjut ke step berikutnya jika step aktif belum valid.

### 5.3 Direct Costs

Direct costs terdiri dari lima section:

- Deskripsi Proyek
- Biaya Tenaga Kerja
- Mob & Demob
- Biaya Peralatan
- Material / Supporting

Setiap section memiliki validasi dan status issue.

### 5.4 Indirect Costs

Indirect costs berisi input overhead percentage. Nilai overhead dihitung dari total biaya langsung.

### 5.5 Profit & CGL

Step ini berisi:

- Profit percentage
- CGL/insurance nominal
- Auto round toggle
- Rounding increment

### 5.6 Final Summary

Final summary menampilkan:

- Rincian subtotal per komponen.
- Total biaya langsung.
- Overhead.
- Profit.
- CGL/insurance.
- Harga sebelum pembulatan.
- Harga akhir setelah pembulatan.
- Benchmark AI model `project_only` dan `hybrid`.
- Tombol save, reset, refresh prediction, print, dan PDF.

### 5.7 Halaman Arsip

Route:

```text
/archived
```

Fungsi:

- Menampilkan semua project tersimpan, termasuk draft, final, reviewed, dan archived.
- Membuka project ke workspace utama.
- Membuka print page/PDF workflow.

## 6. Backend

Backend menggunakan Next.js API Routes di `src/app/api`.

### 6.1 Tender Calculation API

```text
GET /api/tender-calculations
```

Mengambil daftar tender aktif. Secara default archived record tidak ditampilkan.

```text
GET /api/tender-calculations?includeArchived=true
```

Mengambil semua tender termasuk archived.

```text
GET /api/tender-calculations?mode=latest
```

Mengambil tender terbaru yang belum archived.

```text
POST /api/tender-calculations
```

Membuat record tender baru. Payload utama berisi `form`, `status`, dan optional `aiBenchmark`.

```text
GET /api/tender-calculations/:id
```

Mengambil detail tender berdasarkan id.

```text
PUT /api/tender-calculations/:id
```

Memperbarui record tender.

```text
DELETE /api/tender-calculations/:id
```

Melakukan soft delete dengan mengubah status menjadi `archived`.

```text
DELETE /api/tender-calculations/:id?mode=hard-delete
```

Menghapus record secara permanen dari database.

```text
POST /api/tender-calculations/:id/duplicate
```

Membuat salinan tender dengan nama proyek ditambah `(Copy)`.

```text
GET /api/tender-calculations/:id/pdf
```

Menghasilkan file PDF tender.

### 6.2 AI Benchmark API

```text
POST /api/ai-benchmark
```

Endpoint ini menerima payload benchmark dari final summary, lalu mencoba:

1. Memanggil FastAPI service di `ML_SERVICE_URL`.
2. Jika gagal, menjalankan fallback lokal `ml_service/predict_once.py`.

Jika keduanya gagal, endpoint mengembalikan error 500.

## 7. Database

Database memakai Prisma dengan provider PostgreSQL.

Model utama:

```prisma
model TenderCalculation {
  id                    String   @id @default(cuid())
  status                String   @default("draft")
  projectName           String
  projectCategory       String
  projectLocation       String
  companyName           String
  companyCategory       String
  durationDays          Int
  workDate              DateTime
  calculationVersion    String   @default("pt-bki-rule-engine-v1.1.0")
  masterDataVersion     String   @default("2025.1 / 2025.1 / 2025.1")
  overheadRate          Decimal  @db.Decimal(5, 2)
  overheadFixedCost     Decimal  @default(0) @db.Decimal(18, 2)
  profitMargin          Decimal  @db.Decimal(5, 2)
  insuranceCost         Decimal  @db.Decimal(18, 2)
  autoRoundFinalTotal   Boolean  @default(true)
  directCostTotal       Decimal  @db.Decimal(18, 2)
  overheadAmount        Decimal  @db.Decimal(18, 2)
  subtotalBeforeProfit  Decimal  @db.Decimal(18, 2)
  profitAmount          Decimal  @db.Decimal(18, 2)
  finalTotal            Decimal  @db.Decimal(18, 2)
  calculationPayload    Json
  archivedAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

### 7.1 Payload JSON

`calculationPayload` menyimpan:

- `form`: input lengkap user.
- `metadata`: versi rule engine dan master data.
- `aiBenchmark`: hasil benchmark AI jika tersedia.

### 7.2 Index

Index tersedia untuk:

- `status`
- `projectName`
- `companyName`
- `archivedAt`
- `createdAt`

## 8. Logic Kalkulasi

Logic utama berada di:

```text
src/lib/tenderCalculations.ts
```

### 8.1 Rumus Line Item

```text
subtotal = qty x freq x unitPrice
```

Untuk tenaga kerja:

```text
subtotal tenaga kerja = jumlah personel x durasi hari x tarif harian
```

### 8.2 Biaya Langsung

```text
laborSubtotal = jumlah seluruh subtotal tenaga kerja
mobilitySubtotal = mob demob personil + equipment handling
equipmentSubtotal = jumlah seluruh subtotal alat
supportingSubtotal = jumlah seluruh subtotal supporting cost
directCostSubtotal = laborSubtotal + mobilitySubtotal + equipmentSubtotal + supportingSubtotal
```

### 8.3 Overhead

```text
overheadAmount = directCostSubtotal x overheadPercentage / 100
subtotalBeforeProfit = directCostSubtotal + overheadAmount
```

### 8.4 Profit, CGL, dan Pembulatan

```text
profitAmount = subtotalBeforeProfit x profitPercentage / 100
finalPriceBeforeRounding = subtotalBeforeProfit + profitAmount + cglInsuranceNominal
finalRoundedPrice = round(finalPriceBeforeRounding / roundingIncrement) x roundingIncrement
```

Jika `autoRoundFinalTotal` tidak aktif, `finalRoundedPrice` sama dengan `finalPriceBeforeRounding`.

## 9. Master Data dan Referensi Tarif

Master data berada di:

```text
src/lib/tender-master-data.ts
```

Versi rule engine:

```text
pt-bki-rule-engine-v1.1.0
```

Referensi master data:

- INKINDO Biaya Personel `2025.1`
- INKINDO Indeks Lokasi `2025.1`
- PMK 32/2025 Batas Penginapan `2025.1`

### 9.1 Tarif Tenaga Kerja

Sistem mendukung kategori:

- Tenaga Ahli Profesional
- Teknisi/Analis Sub Profesional
- Tenaga Pendukung

Tarif tenaga kerja dipengaruhi oleh:

- Kategori utama.
- Level SKK untuk tenaga ahli.
- Pendidikan.
- Pengalaman.
- Role supporting staff.
- Indeks lokasi proyek.

Supporting staff dengan role `lainnya` wajib memakai manual input.

### 9.2 Indeks Lokasi

Lokasi yang tersedia:

- DKI Jakarta
- Jawa Barat
- Jawa Tengah
- Jawa Timur
- Banten
- Bali
- Kalimantan Timur
- Kalimantan Utara
- Papua Barat
- Papua

Jika lokasi tidak ditemukan, fallback index adalah `1.000`.

### 9.3 Penginapan

Penginapan memakai batas lodging per lokasi dari referensi PMK 32/2025. User tetap harus mengisi `qty` dan `freq` agar subtotal bisa dihitung.

## 10. Validasi

Validasi berada di:

```text
src/lib/tender-validation.ts
```

Validasi utama:

- Project category, project name, company name, location, company category, durasi, dan work date wajib diisi.
- Setiap labor item wajib memiliki role, kategori, jumlah personel, durasi, dan field pendukung sesuai kategorinya.
- Custom labor price wajib lebih dari 0 jika manual override aktif.
- Mob/demob wajib memiliki qty, freq, dan unit price lebih dari 0.
- Equipment wajib memiliki nama alat, qty, freq, dan unit price.
- Supporting cost yang diikutkan wajib memiliki nama item, qty, freq, dan unit price jika manual.
- Direct cost subtotal harus lebih dari 0 sebelum overhead.
- Overhead dan profit tidak boleh negatif.
- CGL/insurance wajib diisi dan tidak boleh negatif.
- Rounding increment wajib lebih dari 0 saat auto-round aktif.

## 11. Machine Learning Service

ML service berada di folder:

```text
ml_service
```

### 11.1 Komponen

- `app/main.py`: FastAPI application.
- `app/core.py`: prediction core.
- `predict_once.py`: fallback predictor untuk satu request.
- `train_models.py`: training pipeline.
- `artifacts/project_only_model.joblib`: model SVR project-only.
- `artifacts/hybrid_model.joblib`: model SVR hybrid.
- `artifacts/*feature_contract.json`: kontrak feature.
- `artifacts/model_metadata.json`: metadata model.

### 11.2 Model Benchmark

Sistem menggunakan dua model:

- `project_only`: prediksi berdasarkan informasi proyek.
- `hybrid`: prediksi berdasarkan informasi proyek dan summary rule-based.

Target prediksi:

```text
harga_sebelum_approval
```

### 11.3 Menjalankan ML Service

```bash
pip install -r ml_service/requirements.txt
npm run ml:serve
```

Default port:

```text
8001
```

### 11.4 Training Model

```bash
npm run ml:train
```

Default data source:

- `../tender_fix.xlsx`
- `../Mapping_Client_BKI_Fix.xlsx`

## 12. PDF dan Print

Sistem menyediakan dua jalur output:

- Print page di route `src/app/tender-calculations/[id]/print/page.tsx`.
- PDF file melalui endpoint `GET /api/tender-calculations/:id/pdf`.

PDF dibuat oleh helper internal `src/lib/pdf.ts`, tanpa library PDF eksternal. Isi PDF meliputi:

- Profil proyek.
- Rincian biaya tenaga kerja.
- Rincian biaya operasional.
- Ringkasan finansial.
- Total harga akhir.

## 13. Fitur Lengkap

### 13.1 Project Workspace

- Mulai project baru.
- Lanjutkan draft terakhir dari database.
- Recovery draft lokal dari browser.
- Buka project berdasarkan `recordId`.
- Reset draft.

### 13.2 Project Description

- Nama pekerjaan.
- Kategori proyek.
- Lokasi proyek.
- Nama perusahaan.
- Kategori perusahaan.
- Durasi pekerjaan.
- Tanggal pekerjaan.

### 13.3 Labor Costs

- Tambah/hapus crew.
- Input role name.
- Pilih kategori tenaga kerja.
- Pilih level SKK untuk tenaga ahli.
- Pilih pendidikan.
- Input pengalaman.
- Pilih role supporting staff.
- Input jumlah personel.
- Input durasi kerja.
- Tarif otomatis dari master data.
- Manual override rate.
- Audit lookup sumber tarif.
- Subtotal per crew.

### 13.4 Mob & Demob

- Mob demob personil.
- Equipment handling.
- Qty.
- Freq.
- Unit price.
- Subtotal otomatis.

### 13.5 Equipment Costs

- Tambah/hapus alat.
- Nama alat.
- Qty.
- Frekuensi.
- Harga satuan.
- Subtotal otomatis.

### 13.6 Operational / Supporting Costs

- Meal Allowance.
- Penginapan.
- Reporting.
- Permit.
- MCU.
- Biaya lainnya.
- Toggle included/not included.
- Qty dan freq wajib untuk item yang diikutkan.
- Unit price manual untuk item manual.
- Lodging rate otomatis berdasarkan lokasi.

### 13.7 Tax, Margin, CGL

- Input overhead percentage.
- Input profit percentage.
- Input CGL/insurance nominal.
- Auto-round final total.
- Rounding increment.

### 13.8 Summary dan Benchmark

- Total personel.
- Labor subtotal.
- Mobility subtotal.
- Equipment subtotal.
- Supporting subtotal.
- Direct cost subtotal.
- Overhead amount.
- Subtotal before profit.
- Profit amount.
- CGL/insurance.
- Final before rounding.
- Final rounded price.
- AI benchmark result.
- Variance benchmark terhadap rule-based calculation.

### 13.9 Persistence dan Arsip

- Save draft.
- Save final.
- Update existing record.
- List project.
- Open saved project.
- Duplicate project.
- Archive project.
- Hard delete project.

### 13.10 Output

- Print page.
- Auto print trigger via query.
- Download PDF.

## 14. Development Workflow

### 14.1 Development Server

```bash
npm run dev
```

### 14.2 Build Production

```bash
npm run build
npm run start
```

### 14.3 Lint dan Format

```bash
npm run lint
npm run format:check
```

Untuk auto-fix:

```bash
npm run lint:fix
npm run format
```

### 14.4 Database

```bash
npx prisma generate
npx prisma migrate dev
npm run db:seed
```

## 15. Catatan Maintenance

- Business formula sebaiknya tetap berada di `src/lib/tenderCalculations.ts`.
- Validasi form sebaiknya tetap berada di `src/lib/tender-validation.ts`.
- UI component jangan menyimpan rumus bisnis yang kompleks.
- Jika menambah cost driver baru, update type di `src/types/tender.ts`, form default, kalkulasi, validasi, summary, PDF, dan persistence payload.
- Jika mengubah formula, update README dan dokumen ini.
- Jangan menyimpan credential production di repository.
