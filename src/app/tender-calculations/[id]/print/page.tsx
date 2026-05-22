import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PrintAutoTrigger } from "@/components/features/tender/PrintAutoTrigger";
import { PrintPageActions } from "@/components/features/tender/PrintPageActions";
import { formatIdr } from "@/lib/currency";
import { getTenderCalculationById } from "@/lib/tender-repository";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toTitleCase(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return "-";
  }

  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatStepLabel(step: string) {
  switch (step) {
    case "landing":
      return "Landing";
    case "direct-costs":
      return "Biaya Langsung";
    case "indirect-costs":
      return "Biaya Tidak Langsung";
    case "profit-cgl":
      return "Profit dan CGL";
    case "final-summary":
      return "Ringkasan Akhir";
    default:
      return step;
  }
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-black/5 py-2 sm:grid-cols-[220px_1fr] print:flex print:items-start print:justify-between print:gap-6 print:border-zinc-200 print:py-1">
      <div className="text-on-surface-variant text-xs font-semibold tracking-[0.08em] uppercase print:shrink-0 print:text-[11px] print:text-zinc-500">
        {label}
      </div>
      <div className="text-on-surface text-sm print:text-right print:text-[12px] print:font-medium print:text-zinc-900">
        {value}
      </div>
    </div>
  );
}

function TableSection({
  title,
  subtitle,
  headers,
  rows,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="glass-card print-card overflow-hidden rounded-[1.5rem] print:rounded-none print:border print:border-zinc-200 print:bg-white print:shadow-none">
      <div className="border-b border-black/5 px-6 py-5 print:px-0 print:py-3">
        <div className="text-on-surface text-lg font-bold">{title}</div>
        {subtitle ? <div className="text-on-surface-variant mt-1 text-sm">{subtitle}</div> : null}
      </div>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="print-table min-w-full text-sm">
          <thead className="bg-surface-container-low">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="text-on-surface-variant px-4 py-3 text-left text-xs font-semibold tracking-[0.08em] uppercase print:px-0 print:py-2"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`} className="border-t border-black/5">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${rowIndex}-${cellIndex}`}
                      className="px-4 py-3 align-top print:px-0 print:py-2"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-t border-black/5">
                <td
                  colSpan={headers.length}
                  className="text-on-surface-variant px-4 py-4 text-center text-sm"
                >
                  Belum ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function TenderPrintPage({ params }: PageProps) {
  const { id } = await params;
  const record = await getTenderCalculationById(id);

  if (!record) {
    notFound();
  }

  const { form, computed, status, updatedAt } = record;
  const { projectInfo } = form.directCosts;
  const summary = computed.summary;

  return (
    <div className="print-root bg-background min-h-screen">
      <Suspense fallback={null}>
        <PrintAutoTrigger />
      </Suspense>
      <PrintPageActions />

      <main className="mx-auto max-w-6xl px-6 pb-12 print:px-0 print:pb-0">
        <div className="print-document print-sheet space-y-8">
          <section className="print-hero glass-card-strong rounded-[2rem] px-8 py-8 print:rounded-none print:border print:border-zinc-300 print:bg-white print:px-0 print:py-0 print:shadow-none">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                  Print Tender Document
                </div>
                <h1 className="text-on-surface text-3xl font-bold tracking-tight">
                  {projectInfo.projectName || "Untitled Project"}
                </h1>
                <div className="text-on-surface-variant text-sm">
                  {projectInfo.companyName || "Perusahaan belum diisi"} ·{" "}
                  {toTitleCase(projectInfo.projectCategory)} ·{" "}
                  {projectInfo.projectLocation || "Lokasi belum diisi"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 print:w-full print:grid-cols-2">
                <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 print:rounded-none print:border-zinc-200 print:px-3 print:py-3">
                  <div className="text-on-surface-variant text-xs uppercase">Status</div>
                  <div className="text-on-surface mt-2 text-lg font-bold">
                    {toTitleCase(status)}
                  </div>
                </div>
                <div className="rounded-2xl border border-black/5 bg-white px-4 py-4 print:rounded-none print:border-zinc-200 print:px-3 print:py-3">
                  <div className="text-on-surface-variant text-xs uppercase">Terakhir Disimpan</div>
                  <div className="text-on-surface mt-2 text-sm font-semibold">
                    {new Date(updatedAt).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="print-step glass-card rounded-[2rem] p-8 print:rounded-none print:border print:border-zinc-200 print:bg-white print:shadow-none">
            <div className="mb-6">
              <div className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                Step 1
              </div>
              <h2 className="text-on-surface mt-1 text-2xl font-bold">Biaya Langsung</h2>
            </div>

            <div className="space-y-6">
              <section className="print-card glass-card rounded-[1.5rem] p-6 print:rounded-none print:border print:border-zinc-200 print:bg-white print:shadow-none">
                <div className="text-on-surface mb-5 text-lg font-bold">Deskripsi Proyek</div>
                <div className="grid gap-4">
                  <DataRow label="Nama Proyek" value={projectInfo.projectName || "-"} />
                  <DataRow
                    label="Kategori Proyek"
                    value={toTitleCase(projectInfo.projectCategory)}
                  />
                  <DataRow label="Lokasi Proyek" value={projectInfo.projectLocation || "-"} />
                  <DataRow label="Nama Perusahaan" value={projectInfo.companyName || "-"} />
                  <DataRow
                    label="Kategori Perusahaan"
                    value={toTitleCase(projectInfo.companyCategory)}
                  />
                  <DataRow
                    label="Durasi Pekerjaan"
                    value={
                      projectInfo.durationDays
                        ? `${projectInfo.durationDays.toLocaleString("id-ID")} hari`
                        : "-"
                    }
                  />
                  <DataRow label="Tanggal Pekerjaan" value={projectInfo.workDate || "-"} />
                </div>
              </section>

              <TableSection
                title="Biaya Tenaga Kerja"
                headers={[
                  "Posisi",
                  "Kategori",
                  "Pendidikan",
                  "Pengalaman",
                  "Qty",
                  "Durasi",
                  "Mode Harga",
                  "Tarif",
                  "Subtotal",
                ]}
                rows={computed.laborCosts.map((item) => [
                  toTitleCase(
                    item.roleName || item.supportingRole || item.professionalSkkLevel || "-"
                  ),
                  toTitleCase(item.mainCategory),
                  toTitleCase(item.education),
                  `${item.experienceYears} tahun`,
                  String(item.quantity),
                  `${item.durationDays} hari`,
                  item.pricingMode,
                  formatIdr(item.resolvedUnitRate),
                  formatIdr(item.subtotal),
                ])}
              />

              <TableSection
                title="Mob & Demob"
                headers={["Komponen", "Qty", "Freq", "Tarif", "Subtotal"]}
                rows={[
                  [
                    "Mobilisasi Personel",
                    String(computed.mobilityCosts.personnelDeployment.qty),
                    String(computed.mobilityCosts.personnelDeployment.freq),
                    formatIdr(computed.mobilityCosts.personnelDeployment.unitRate),
                    formatIdr(computed.mobilityCosts.personnelDeployment.subtotal),
                  ],
                  [
                    "Equipment Handling",
                    String(computed.mobilityCosts.equipmentHandling.qty),
                    String(computed.mobilityCosts.equipmentHandling.freq),
                    formatIdr(computed.mobilityCosts.equipmentHandling.unitRate),
                    formatIdr(computed.mobilityCosts.equipmentHandling.subtotal),
                  ],
                ]}
              />

              <TableSection
                title="Biaya Peralatan"
                headers={["Nama Alat", "Qty", "Freq", "Tarif", "Subtotal"]}
                rows={computed.equipmentCosts.map((item) => [
                  toTitleCase(item.equipmentName),
                  String(item.qty),
                  String(item.freq),
                  formatIdr(item.unitRate),
                  formatIdr(item.subtotal),
                ])}
              />

              <TableSection
                title="Biaya Material / Supporting"
                headers={["Item", "Diikutkan", "Qty", "Freq", "Mode Harga", "Tarif", "Subtotal"]}
                rows={computed.supportingCosts.map((item) => [
                  toTitleCase(item.itemName || item.key),
                  item.isIncluded ? "Ya" : "Tidak",
                  String(item.qty),
                  String(item.freq),
                  item.pricingMode,
                  formatIdr(item.unitRate),
                  formatIdr(item.subtotal),
                ])}
              />
            </div>
          </section>

          <section className="print-step glass-card rounded-[2rem] p-8 print:rounded-none print:border print:border-zinc-200 print:bg-white print:shadow-none">
            <div className="mb-6">
              <div className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                Step 2
              </div>
              <h2 className="text-on-surface mt-1 text-2xl font-bold">Biaya Tidak Langsung</h2>
            </div>

            <div className="grid gap-4">
              <DataRow
                label="Subtotal Biaya Langsung"
                value={formatIdr(summary.directCosts.directCostSubtotal)}
              />
              <DataRow
                label="Persentase Overhead"
                value={`${summary.overheadPercentage.toLocaleString("id-ID")}%`}
              />
              <DataRow label="Nilai Overhead" value={formatIdr(summary.overheadAmount)} />
              <DataRow
                label="Subtotal Sebelum Profit"
                value={formatIdr(summary.subtotalBeforeProfit)}
              />
            </div>
          </section>

          <section className="print-step glass-card rounded-[2rem] p-8 print:rounded-none print:border print:border-zinc-200 print:bg-white print:shadow-none">
            <div className="mb-6">
              <div className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                Step 3
              </div>
              <h2 className="text-on-surface mt-1 text-2xl font-bold">Profit & CGL</h2>
            </div>

            <div className="grid gap-4">
              <DataRow
                label="Persentase Profit"
                value={`${summary.profitPercentage.toLocaleString("id-ID")}%`}
              />
              <DataRow label="Nilai Profit" value={formatIdr(summary.profitAmount)} />
              <DataRow label="Asuransi / CGL" value={formatIdr(summary.cglInsuranceNominal)} />
              <DataRow
                label="Nilai Sebelum Pembulatan"
                value={formatIdr(summary.finalPriceBeforeRounding)}
              />
              <DataRow
                label="Kelipatan Pembulatan"
                value={
                  form.profitAndCgl.autoRoundFinalTotal
                    ? `${form.profitAndCgl.roundingIncrement ?? 0}`
                    : "Tanpa pembulatan otomatis"
                }
              />
            </div>
          </section>

          <section className="print-step glass-card rounded-[2rem] p-8 print:rounded-none print:border print:border-zinc-200 print:bg-white print:shadow-none">
            <div className="mb-6">
              <div className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
                Step 4
              </div>
              <h2 className="text-on-surface mt-1 text-2xl font-bold">Ringkasan Akhir</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 print:gap-3">
              <div className="rounded-[1.5rem] border border-black/5 bg-white p-5 print:rounded-none print:border-zinc-200 print:p-4">
                <div className="text-on-surface-variant text-xs uppercase">
                  Subtotal Direct Cost
                </div>
                <div className="text-on-surface mt-2 text-2xl font-bold">
                  {formatIdr(summary.directCosts.directCostSubtotal)}
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-black/5 bg-white p-5 print:rounded-none print:border-zinc-200 print:p-4">
                <div className="text-on-surface-variant text-xs uppercase">Total Harga Akhir</div>
                <div className="text-primary mt-2 text-2xl font-bold">
                  {formatIdr(summary.finalRoundedPrice)}
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <DataRow
                label="Subtotal Tenaga Kerja"
                value={formatIdr(summary.directCosts.laborSubtotal)}
              />
              <DataRow
                label="Subtotal Mobilitas"
                value={formatIdr(summary.directCosts.mobilitySubtotal)}
              />
              <DataRow
                label="Subtotal Peralatan"
                value={formatIdr(summary.directCosts.equipmentSubtotal)}
              />
              <DataRow
                label="Subtotal Supporting"
                value={formatIdr(summary.directCosts.supportingSubtotal)}
              />
              <DataRow
                label="Total Personel"
                value={summary.directCosts.totalPersonnel.toLocaleString("id-ID")}
              />
              <DataRow label="Tahap Terakhir Form" value={formatStepLabel(form.currentStep)} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
