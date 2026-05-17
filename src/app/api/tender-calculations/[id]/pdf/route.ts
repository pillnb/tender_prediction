import { NextResponse } from "next/server";
import { formatIdr } from "@/lib/currency";
import { createStyledTenderPdf } from "@/lib/pdf";
import { getTenderCalculationById } from "@/lib/tender-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function sanitizeFilename(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function safeText(value: string | null | undefined) {
  return value && value.trim() ? value : "-";
}

function safeNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${value}${suffix}`;
}

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

function highlightedField(label: string, value: string) {
  return {
    label,
    value,
    emphasis: "highlight" as const,
  };
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const record = await getTenderCalculationById(id);

  if (!record) {
    return NextResponse.json(
      {
        error: "Tender calculation not found.",
      },
      {
        status: 404,
      }
    );
  }

  const { form, computed, status, updatedAt } = record;
  const { projectInfo } = form.directCosts;
  const summary = computed.summary;

  const pdf = await createStyledTenderPdf({
    title: safeText(projectInfo.projectName),
    subtitle: `${safeText(projectInfo.companyName)} | ${toTitleCase(projectInfo.projectCategory)} | ${safeText(projectInfo.projectLocation)}`,
    badge: status.toUpperCase(),
    generatedAt: new Date(updatedAt).toLocaleString("id-ID"),
    heroMetrics: [
      {
        label: "Total Harga Akhir",
        value: formatIdr(summary.finalRoundedPrice),
      },
      {
        label: "Subtotal Biaya Langsung",
        value: formatIdr(summary.directCosts.directCostSubtotal),
      },
      {
        label: "Nilai Profit",
        value: formatIdr(summary.profitAmount),
      },
      {
        label: "Total Personel",
        value: summary.directCosts.totalPersonnel.toLocaleString("id-ID"),
      },
    ],
    sections: [
      {
        title: "Profil Proyek",
        description: "Ringkasan identitas proyek dan parameter utama tender.",
        columns: 2,
        items: [
          { label: "Nama Proyek", value: safeText(projectInfo.projectName) },
          { label: "Nama Perusahaan", value: safeText(projectInfo.companyName) },
          { label: "Kategori Proyek", value: toTitleCase(projectInfo.projectCategory) },
          { label: "Kategori Perusahaan", value: toTitleCase(projectInfo.companyCategory) },
          { label: "Lokasi Proyek", value: safeText(projectInfo.projectLocation) },
          { label: "Tanggal Pekerjaan", value: safeText(projectInfo.workDate) },
          { label: "Durasi Pekerjaan", value: safeNumber(projectInfo.durationDays, " hari") },
          { label: "Tahap Form Saat Ini", value: safeText(form.currentStep) },
        ],
      },
      {
        title: "Rincian Biaya Tenaga Kerja",
        description: "Komposisi tenaga kerja, lookup rate, quantity, dan subtotal per peran.",
        columns: 1,
        items: computed.laborCosts.map((item, index) => ({
          label: `Tenaga Kerja ${index + 1}`,
          subtitle: toTitleCase(
            item.roleName || item.supportingRole || item.professionalSkkLevel || item.mainCategory
          ),
          fields: [
            { label: "Nama Posisi", value: safeText(item.roleName) },
            { label: "Kategori", value: safeText(item.mainCategory) },
            { label: "SKK", value: safeText(item.professionalSkkLevel) },
            {
              label: "Peran Supporting",
              value: safeText(item.supportingRole),
              emphasis: "highlight",
            },
            { label: "Pendidikan", value: safeText(item.education) },
            { label: "Pengalaman", value: safeNumber(item.experienceYears, " tahun") },
            { label: "Jumlah Personel", value: String(item.quantity) },
            { label: "Durasi", value: `${item.durationDays} hari` },
            { label: "Mode Harga", value: item.pricingMode },
            { label: "Tarif", value: formatIdr(item.resolvedUnitRate), emphasis: "highlight" },
            { label: "Subtotal", value: formatIdr(item.subtotal), emphasis: "highlight" },
          ],
        })),
      },
      {
        title: "Rincian Biaya Operasional",
        description: "Mob demob, peralatan, dan biaya supporting yang ikut dalam perhitungan.",
        columns: 1,
        items: [
          {
            label: "Komponen Operasional",
            subtitle: "Mobilisasi Personel",
            fields: [
              { label: "Qty", value: String(computed.mobilityCosts.personnelDeployment.qty) },
              { label: "Freq", value: String(computed.mobilityCosts.personnelDeployment.freq) },
              {
                label: "Tarif",
                value: formatIdr(computed.mobilityCosts.personnelDeployment.unitRate),
              },
              highlightedField(
                "Subtotal",
                formatIdr(computed.mobilityCosts.personnelDeployment.subtotal)
              ),
            ],
          },
          {
            label: "Komponen Operasional",
            subtitle: "Penanganan Peralatan",
            fields: [
              { label: "Qty", value: String(computed.mobilityCosts.equipmentHandling.qty) },
              { label: "Freq", value: String(computed.mobilityCosts.equipmentHandling.freq) },
              {
                label: "Tarif",
                value: formatIdr(computed.mobilityCosts.equipmentHandling.unitRate),
              },
              highlightedField(
                "Subtotal",
                formatIdr(computed.mobilityCosts.equipmentHandling.subtotal)
              ),
            ],
          },
          ...computed.equipmentCosts.map((item, index) => ({
            label: `Peralatan ${index + 1}`,
            subtitle: toTitleCase(item.equipmentName),
            fields: [
              { label: "Qty", value: String(item.qty) },
              { label: "Freq", value: String(item.freq) },
              { label: "Tarif", value: formatIdr(item.unitRate) },
              highlightedField("Subtotal", formatIdr(item.subtotal)),
            ],
          })),
          ...computed.supportingCosts.map((item, index) => ({
            label: `Biaya Supporting ${index + 1}`,
            subtitle: toTitleCase(item.itemName || item.key),
            fields: [
              { label: "Diikutkan", value: item.isIncluded ? "Ya" : "Tidak" },
              { label: "Qty", value: String(item.qty) },
              { label: "Freq", value: String(item.freq) },
              { label: "Mode Harga", value: item.pricingMode },
              { label: "Tarif", value: formatIdr(item.unitRate) },
              highlightedField("Subtotal", formatIdr(item.subtotal)),
            ],
          })),
        ],
      },
      {
        title: "Ringkasan Finansial",
        description: "Output rule-based calculator sebelum dan sesudah pembulatan.",
        columns: 2,
        items: [
          { label: "Subtotal Tenaga Kerja", value: formatIdr(summary.directCosts.laborSubtotal) },
          { label: "Subtotal Mobilitas", value: formatIdr(summary.directCosts.mobilitySubtotal) },
          {
            label: "Subtotal Peralatan",
            value: formatIdr(summary.directCosts.equipmentSubtotal),
          },
          {
            label: "Subtotal Supporting",
            value: formatIdr(summary.directCosts.supportingSubtotal),
          },
          {
            label: "Total Biaya Langsung",
            value: formatIdr(summary.directCosts.directCostSubtotal),
          },
          { label: "Total Personel", value: String(summary.directCosts.totalPersonnel) },
          { label: "Persentase Overhead", value: `${summary.overheadPercentage}%` },
          { label: "Nilai Overhead", value: formatIdr(summary.overheadAmount) },
          { label: "Subtotal Sebelum Profit", value: formatIdr(summary.subtotalBeforeProfit) },
          { label: "Persentase Profit", value: `${summary.profitPercentage}%` },
          { label: "Nilai Profit", value: formatIdr(summary.profitAmount) },
          { label: "Asuransi CGL", value: formatIdr(summary.cglInsuranceNominal) },
          {
            label: "Nilai Sebelum Pembulatan",
            value: formatIdr(summary.finalPriceBeforeRounding),
          },
          { label: "Nilai Akhir Setelah Pembulatan", value: formatIdr(summary.finalRoundedPrice) },
        ],
      },
    ],
  });

  const filename = `${sanitizeFilename(projectInfo.projectName || `tender-${record.id}`)}.pdf`;

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
