import { Prisma } from "@prisma/client";
import { upsertCompanyDirectoryEntry } from "@/lib/company-directory";
import { prisma } from "@/lib/prisma";
import {
  calculateTenderWizardComputedState,
  createEmptyTenderFormData,
  createTenderCalculationRecord,
  getTenderCalculationMetadata,
} from "@/lib/tender";
import { validateTenderWizardForm } from "@/lib/tender-validation";
import type {
  SvrPredictionResult,
  TenderCalculationRecord,
  TenderWizardFormData,
} from "@/types/tender";

type PersistedTenderPayload = {
  form: TenderWizardFormData;
  aiBenchmark?: SvrPredictionResult | null;
};

function extractPersistedTenderPayload(payload: Prisma.JsonValue): PersistedTenderPayload {
  const candidate = payload as Record<string, unknown> | null;
  const normalizedForm = normalizeTenderForm(payload);
  const rawAiBenchmark =
    candidate && typeof candidate === "object" && "aiBenchmark" in candidate
      ? candidate.aiBenchmark
      : undefined;

  return {
    form: normalizedForm,
    aiBenchmark:
      rawAiBenchmark && typeof rawAiBenchmark === "object"
        ? (rawAiBenchmark as SvrPredictionResult)
        : undefined,
  };
}

function toPlainNumber(value: Prisma.Decimal | number) {
  return Number(value);
}

function safeDate(value: string) {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function assertValidTenderForm(form: TenderWizardFormData) {
  const computed = calculateTenderWizardComputedState(form);
  const validation = validateTenderWizardForm(
    form,
    computed.summary.directCosts.directCostSubtotal
  );

  if (validation.allIssues.length > 0) {
    throw new Error(validation.allIssues[0]?.message ?? "Tender form validation failed.");
  }

  return computed;
}

function mapTenderRecord(record: {
  id: string;
  status: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  calculationPayload: Prisma.JsonValue;
  directCostTotal: Prisma.Decimal;
  overheadAmount: Prisma.Decimal;
  subtotalBeforeProfit: Prisma.Decimal;
  profitAmount: Prisma.Decimal;
  finalTotal: Prisma.Decimal;
}) {
  const payload = extractPersistedTenderPayload(record.calculationPayload);
  const computed = calculateTenderWizardComputedState(
    payload.form,
    payload.aiBenchmark ?? undefined
  );

  const normalizedComputed = {
    ...computed,
    summary: {
      ...computed.summary,
      directCosts: {
        ...computed.summary.directCosts,
        directCostSubtotal: toPlainNumber(record.directCostTotal),
      },
      overheadAmount: toPlainNumber(record.overheadAmount),
      subtotalBeforeProfit: toPlainNumber(record.subtotalBeforeProfit),
      profitAmount: toPlainNumber(record.profitAmount),
      finalRoundedPrice: toPlainNumber(record.finalTotal),
      finalPriceBeforeRounding:
        computed.summary.finalPriceBeforeRounding -
        computed.summary.finalRoundedPrice +
        toPlainNumber(record.finalTotal),
    },
  };

  return createTenderCalculationRecord(
    record.id,
    record.status as TenderCalculationRecord["status"],
    record.archivedAt?.toISOString() ?? null,
    payload.form,
    normalizedComputed,
    record.createdAt.toISOString(),
    record.updatedAt.toISOString()
  ) satisfies TenderCalculationRecord;
}

export async function listTenderCalculations(options?: { includeArchived?: boolean }) {
  const records = await prisma.tenderCalculation.findMany({
    where: options?.includeArchived ? undefined : { archivedAt: null },
    orderBy: {
      updatedAt: "desc",
    },
    take: 20,
  });

  return records.map(mapTenderRecord);
}

export async function getTenderCalculationById(id: string) {
  const record = await prisma.tenderCalculation.findUnique({
    where: { id },
  });

  return record ? mapTenderRecord(record) : null;
}

export async function getLatestTenderCalculation() {
  const record = await prisma.tenderCalculation.findFirst({
    where: {
      archivedAt: null,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return record ? mapTenderRecord(record) : null;
}

function buildPersistedTenderData(
  form: TenderWizardFormData,
  status: TenderCalculationRecord["status"],
  computed: ReturnType<typeof calculateTenderWizardComputedState>,
  aiBenchmark?: SvrPredictionResult | null
) {
  const metadata = getTenderCalculationMetadata();

  return {
    status,
    calculationVersion: metadata.calculationVersion,
    masterDataVersion: metadata.masterDataVersion,
    projectName: form.directCosts.projectInfo.projectName || "",
    projectCategory: form.directCosts.projectInfo.projectCategory || "",
    projectLocation: form.directCosts.projectInfo.projectLocation || "",
    companyName: form.directCosts.projectInfo.companyName || "",
    companyCategory: form.directCosts.projectInfo.companyCategory || "",
    durationDays: form.directCosts.projectInfo.durationDays ?? 0,
    workDate: safeDate(form.directCosts.projectInfo.workDate),
    overheadRate: new Prisma.Decimal(form.indirectCosts.overheadPercentage ?? 0),
    overheadFixedCost: new Prisma.Decimal(0),
    profitMargin: new Prisma.Decimal(form.profitAndCgl.profitPercentage ?? 0),
    insuranceCost: new Prisma.Decimal(form.profitAndCgl.cglInsuranceNominal ?? 0),
    autoRoundFinalTotal: form.profitAndCgl.autoRoundFinalTotal,
    directCostTotal: new Prisma.Decimal(computed.summary.directCosts.directCostSubtotal),
    overheadAmount: new Prisma.Decimal(computed.summary.overheadAmount),
    subtotalBeforeProfit: new Prisma.Decimal(computed.summary.subtotalBeforeProfit),
    profitAmount: new Prisma.Decimal(computed.summary.profitAmount),
    finalTotal: new Prisma.Decimal(computed.summary.finalRoundedPrice),
    calculationPayload: {
      form,
      metadata,
      aiBenchmark: aiBenchmark ?? computed.aiBenchmark,
    } as Prisma.InputJsonValue,
  };
}

export async function saveTenderCalculation(
  form: TenderWizardFormData,
  status: TenderCalculationRecord["status"] = "draft",
  aiBenchmark?: SvrPredictionResult | null
) {
  const computed = assertValidTenderForm(form);
  const companyName = form.directCosts.projectInfo.companyName.trim();
  const companyCategory = form.directCosts.projectInfo.companyCategory;

  if (companyName && companyCategory) {
    await upsertCompanyDirectoryEntry(companyName, companyCategory, "tender_form");
  }

  const record = await prisma.tenderCalculation.create({
    data: buildPersistedTenderData(form, status, computed, aiBenchmark),
  });

  return mapTenderRecord(record);
}

export async function updateTenderCalculation(
  id: string,
  form: TenderWizardFormData,
  status: TenderCalculationRecord["status"] = "draft",
  aiBenchmark?: SvrPredictionResult | null
) {
  const computed = assertValidTenderForm(form);
  const companyName = form.directCosts.projectInfo.companyName.trim();
  const companyCategory = form.directCosts.projectInfo.companyCategory;

  if (companyName && companyCategory) {
    await upsertCompanyDirectoryEntry(companyName, companyCategory, "tender_form");
  }

  const record = await prisma.tenderCalculation.update({
    where: { id },
    data: {
      ...buildPersistedTenderData(form, status, computed, aiBenchmark),
      archivedAt: null,
    },
  });

  return mapTenderRecord(record);
}

export async function archiveTenderCalculation(id: string) {
  const record = await prisma.tenderCalculation.update({
    where: { id },
    data: {
      status: "archived",
      archivedAt: new Date(),
    },
  });

  return mapTenderRecord(record);
}

export async function deleteTenderCalculation(id: string) {
  await prisma.tenderCalculation.delete({
    where: { id },
  });
}

export async function duplicateTenderCalculation(id: string) {
  const existing = await getTenderCalculationById(id);

  if (!existing) {
    return null;
  }

  const duplicatedForm = normalizeTenderForm(existing.form);

  duplicatedForm.currentStep = "direct-costs";
  duplicatedForm.directCosts.projectInfo.projectName = `${existing.form.directCosts.projectInfo.projectName} (Copy)`;

  return saveTenderCalculation(duplicatedForm, "draft");
}

export function normalizeTenderForm(payload: unknown): TenderWizardFormData {
  const fallback = createEmptyTenderFormData();

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const directPayload =
    "form" in payload && payload.form && typeof payload.form === "object"
      ? (payload.form as Partial<TenderWizardFormData>)
      : (payload as Partial<TenderWizardFormData>);

  return {
    currentStep: directPayload.currentStep ?? fallback.currentStep,
    directCosts: {
      projectInfo: {
        ...fallback.directCosts.projectInfo,
        ...directPayload.directCosts?.projectInfo,
      },
      laborCosts:
        Array.isArray(directPayload.directCosts?.laborCosts) &&
        directPayload.directCosts.laborCosts.length > 0
          ? directPayload.directCosts.laborCosts.map((item, index) => ({
              id: item.id || `crew-${index + 1}`,
              roleName: item.roleName || "",
              mainCategory: item.mainCategory || "",
              professionalSkkLevel: item.professionalSkkLevel || "",
              supportingRole: item.supportingRole || "",
              quantity:
                item.quantity === null || item.quantity === undefined
                  ? null
                  : Number(item.quantity),
              durationDays:
                item.durationDays === null || item.durationDays === undefined
                  ? null
                  : Number(item.durationDays),
              education: item.education || "",
              experienceYears:
                item.experienceYears === null || item.experienceYears === undefined
                  ? null
                  : Number(item.experienceYears),
              isCustomPrice: Boolean(item.isCustomPrice),
              manualUnitRate:
                item.manualUnitRate === null || item.manualUnitRate === undefined
                  ? null
                  : Number(item.manualUnitRate),
              notes: item.notes ?? null,
            }))
          : fallback.directCosts.laborCosts,
      mobilityCosts: {
        personnelDeployment: {
          ...fallback.directCosts.mobilityCosts.personnelDeployment,
          ...directPayload.directCosts?.mobilityCosts?.personnelDeployment,
        },
        equipmentHandling: {
          ...fallback.directCosts.mobilityCosts.equipmentHandling,
          ...directPayload.directCosts?.mobilityCosts?.equipmentHandling,
        },
      },
      equipmentCosts:
        Array.isArray(directPayload.directCosts?.equipmentCosts) &&
        directPayload.directCosts.equipmentCosts.length > 0
          ? directPayload.directCosts.equipmentCosts.map((item, index) => ({
              id: item.id || `equipment-${index + 1}`,
              equipmentName: item.equipmentName || "",
              qty: item.qty === null || item.qty === undefined ? null : Number(item.qty),
              freq: item.freq === null || item.freq === undefined ? null : Number(item.freq),
              unitPrice:
                item.unitPrice === null || item.unitPrice === undefined
                  ? null
                  : Number(item.unitPrice),
              notes: item.notes ?? null,
            }))
          : fallback.directCosts.equipmentCosts,
      supportingCosts:
        Array.isArray(directPayload.directCosts?.supportingCosts) &&
        directPayload.directCosts.supportingCosts.length > 0
          ? directPayload.directCosts.supportingCosts.map((item, index) => ({
              id: item.id || `supporting-${index + 1}`,
              key: item.key || "mealAllowance",
              itemName: item.itemName || "",
              isIncluded: Boolean(item.isIncluded),
              qty: item.qty === null || item.qty === undefined ? null : Number(item.qty),
              freq: item.freq === null || item.freq === undefined ? null : Number(item.freq),
              unitPrice:
                item.unitPrice === null || item.unitPrice === undefined
                  ? null
                  : Number(item.unitPrice),
              isCustomPrice: Boolean(item.isCustomPrice),
              notes: item.notes ?? null,
            }))
          : fallback.directCosts.supportingCosts,
    },
    indirectCosts: {
      ...fallback.indirectCosts,
      ...directPayload.indirectCosts,
      overheadPercentage:
        directPayload.indirectCosts?.overheadPercentage === null ||
        directPayload.indirectCosts?.overheadPercentage === undefined
          ? fallback.indirectCosts.overheadPercentage
          : Number(directPayload.indirectCosts.overheadPercentage),
    },
    profitAndCgl: {
      ...fallback.profitAndCgl,
      ...directPayload.profitAndCgl,
      profitPercentage:
        directPayload.profitAndCgl?.profitPercentage === null ||
        directPayload.profitAndCgl?.profitPercentage === undefined
          ? fallback.profitAndCgl.profitPercentage
          : Number(directPayload.profitAndCgl.profitPercentage),
      cglInsuranceNominal:
        directPayload.profitAndCgl?.cglInsuranceNominal === null ||
        directPayload.profitAndCgl?.cglInsuranceNominal === undefined
          ? fallback.profitAndCgl.cglInsuranceNominal
          : Number(directPayload.profitAndCgl.cglInsuranceNominal),
      roundingIncrement:
        directPayload.profitAndCgl?.roundingIncrement === null ||
        directPayload.profitAndCgl?.roundingIncrement === undefined
          ? fallback.profitAndCgl.roundingIncrement
          : Number(directPayload.profitAndCgl.roundingIncrement),
    },
  };
}
