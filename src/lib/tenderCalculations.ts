import type {
  DirectCostsComputedSummary,
  EquipmentCostComputed,
  EquipmentCostInput,
  FinalCalculationSummary,
  InkindoRateReference,
  LaborCostInput,
  LaborCostComputed,
  LodgingRateReference,
  MasterDataVersionInfo,
  MobilityCostComputed,
  MobilityCostInput,
  OperationalCostKey,
  ProjectInfoInput,
  SupportingCostComputed,
  SupportingCostInput,
  SvrPredictionRequestPayload,
  SvrPredictionResult,
  TenderCalculationRecord,
  TenderWizardComputedState,
  TenderWizardFormData,
} from "@/types/tender";
import {
  CALCULATION_ENGINE_VERSION,
  MASTER_DATA_REFERENCE,
  SUPPORTING_ITEM_LABELS,
  getLaborRateLookup,
  getLodgingRate,
} from "@/lib/tender-master-data";

function createId(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index + 1}`;
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isSvrPredictionResult(value: unknown): value is SvrPredictionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  return (
    "targetName" in value &&
    "payload" in value &&
    "projectOnly" in value &&
    "hybrid" in value &&
    "bestAvailable" in value &&
    "featureSnapshot" in value
  );
}

export function createEmptyProjectInfo(): ProjectInfoInput {
  return {
    projectName: "",
    projectCategory: "",
    projectLocation: "",
    companyName: "",
    companyCategory: "",
    durationDays: null,
    workDate: "",
  };
}

export function createEmptyLaborItem(index: number): LaborCostInput {
  return {
    id: createId("crew", index),
    roleName: "",
    mainCategory: "",
    professionalSkkLevel: "",
    supportingRole: "",
    quantity: null,
    durationDays: null,
    education: "",
    experienceYears: null,
    isCustomPrice: false,
    manualUnitRate: null,
    notes: null,
  };
}

export function createEmptyMobilityItem(id: string, label: string): MobilityCostInput {
  return {
    id,
    label,
    qty: null,
    freq: null,
    unitPrice: null,
    notes: null,
  };
}

export function createEmptyEquipmentItem(index: number): EquipmentCostInput {
  return {
    id: createId("equipment", index),
    equipmentName: "",
    qty: null,
    freq: null,
    unitPrice: null,
    notes: null,
  };
}

export function createEmptySupportingCost(
  key: OperationalCostKey,
  index: number
): SupportingCostInput {
  return {
    id: createId(`supporting-${key}`, index),
    key,
    itemName: SUPPORTING_ITEM_LABELS[key],
    isIncluded: false,
    qty: null,
    freq: null,
    unitPrice: null,
    isCustomPrice: key !== "lodging",
    notes: null,
  };
}

export function createEmptyTenderFormData(): TenderWizardFormData {
  return {
    currentStep: "landing",
    directCosts: {
      projectInfo: createEmptyProjectInfo(),
      laborCosts: [createEmptyLaborItem(0)],
      mobilityCosts: {
        personnelDeployment: createEmptyMobilityItem("mob-personnel", "Mob Demob Personil"),
        equipmentHandling: createEmptyMobilityItem("mob-equipment", "Equipment Handling"),
      },
      equipmentCosts: [createEmptyEquipmentItem(0)],
      supportingCosts: [
        createEmptySupportingCost("mealAllowance", 0),
        createEmptySupportingCost("lodging", 1),
        createEmptySupportingCost("reporting", 2),
        createEmptySupportingCost("permits", 3),
        createEmptySupportingCost("medicalCheckup", 4),
      ],
    },
    indirectCosts: {
      overheadPercentage: null,
    },
    profitAndCgl: {
      profitPercentage: null,
      cglInsuranceNominal: null,
      autoRoundFinalTotal: true,
      roundingIncrement: null,
    },
  };
}

export function resolveInkindoRate(
  mainCategory: LaborCostInput["mainCategory"],
  professionalSkkLevel: LaborCostInput["professionalSkkLevel"],
  supportingRole: LaborCostInput["supportingRole"],
  education: LaborCostInput["education"],
  experienceYears: number | null,
  projectLocation: string
): InkindoRateReference {
  return getLaborRateLookup(
    mainCategory,
    professionalSkkLevel,
    supportingRole,
    education,
    experienceYears,
    projectLocation
  );
}

export function resolveLodgingRate(projectLocation: string): LodgingRateReference {
  return getLodgingRate(projectLocation);
}

export function calculateLineItemSubtotal(
  qty: number | null | undefined,
  freq: number | null | undefined,
  unitPrice: number | null | undefined
) {
  return normalizeNumber(qty) * normalizeNumber(freq) * normalizeNumber(unitPrice);
}

export function calculateMobilityCost(item: MobilityCostInput): MobilityCostComputed {
  const resolvedUnitRate = normalizeNumber(item.unitPrice);
  const subtotal = calculateLineItemSubtotal(item.qty, item.freq, resolvedUnitRate);

  return {
    ...item,
    unitRate: resolvedUnitRate,
    qty: normalizeNumber(item.qty),
    freq: normalizeNumber(item.freq),
    unitPrice: resolvedUnitRate,
    subtotal,
    currency: "IDR",
    source: "manual_input",
  };
}

export function calculateEquipmentCost(item: EquipmentCostInput): EquipmentCostComputed {
  const resolvedUnitRate = normalizeNumber(item.unitPrice);
  const subtotal = calculateLineItemSubtotal(item.qty, item.freq, resolvedUnitRate);

  return {
    ...item,
    unitRate: resolvedUnitRate,
    qty: normalizeNumber(item.qty),
    freq: normalizeNumber(item.freq),
    unitPrice: resolvedUnitRate,
    subtotal,
    currency: "IDR",
    source: "manual_input",
  };
}

export function calculateLaborCost(
  item: LaborCostInput,
  projectLocation: string
): LaborCostComputed {
  const lookup = resolveInkindoRate(
    item.mainCategory,
    item.professionalSkkLevel,
    item.supportingRole,
    item.education,
    item.experienceYears,
    projectLocation
  );
  const mustUseManualRate =
    item.isCustomPrice ||
    (item.mainCategory === "tenaga-pendukung" && item.supportingRole === "lainnya");
  const resolvedUnitRate =
    mustUseManualRate && item.manualUnitRate !== null && item.manualUnitRate > 0
      ? item.manualUnitRate
      : lookup.effectiveUnitRate;
  const subtotal = calculateLineItemSubtotal(item.quantity, item.durationDays, resolvedUnitRate);

  return {
    ...item,
    quantity: normalizeNumber(item.quantity),
    durationDays: normalizeNumber(item.durationDays),
    experienceYears: normalizeNumber(item.experienceYears),
    resolvedUnitRate,
    baseRate: mustUseManualRate ? null : lookup.baseRate,
    locationIndex: mustUseManualRate ? null : lookup.locationIndex,
    pricingMode: mustUseManualRate ? "custom_manual" : "auto_standard_rate",
    lookup: mustUseManualRate
      ? {
          source: "manual_input",
          status: "resolved",
          referenceCode: null,
          referenceName: "Manual Override",
          resolvedAt: new Date().toISOString(),
          notes:
            item.mainCategory === "tenaga-pendukung" && item.supportingRole === "lainnya"
              ? "Role supporting staff 'Lainnya' wajib memakai manual input."
              : "User manually overrides the INKINDO-based rate.",
        }
      : lookup.lookup,
    subtotal,
  };
}

export function calculateSupportingCost(
  item: SupportingCostInput,
  projectLocation: string
): SupportingCostComputed {
  if (!item.isIncluded) {
    return {
      ...item,
      qty: normalizeNumber(item.qty),
      freq: normalizeNumber(item.freq),
      unitPrice: normalizeNumber(item.unitPrice),
      unitRate: 0,
      subtotal: 0,
      currency: "IDR",
      source: "manual_input",
      pricingMode:
        item.key === "lodging" && !item.isCustomPrice ? "auto_standard_rate" : "custom_manual",
      lookup: {
        source:
          item.key === "lodging" && !item.isCustomPrice
            ? "pmk_32_2025_lodging_limit"
            : "manual_input",
        status: "idle",
        referenceCode: null,
        referenceName: "Not included",
        resolvedAt: new Date().toISOString(),
        notes: `${item.itemName || SUPPORTING_ITEM_LABELS[item.key]} tidak diikutkan ke kalkulasi.`,
      },
    };
  }

  if (item.key === "lodging" && !item.isCustomPrice) {
    const lodgingReference = resolveLodgingRate(projectLocation);
    const subtotal = calculateLineItemSubtotal(
      item.qty,
      item.freq,
      lodgingReference.maxNightlyRate
    );

    return {
      ...item,
      qty: normalizeNumber(item.qty),
      freq: normalizeNumber(item.freq),
      unitPrice: lodgingReference.maxNightlyRate,
      unitRate: lodgingReference.maxNightlyRate,
      subtotal,
      currency: "IDR",
      source: "pmk_32_2025_lodging_limit",
      pricingMode: "auto_standard_rate",
      lookup: lodgingReference.lookup,
    };
  }

  const resolvedUnitRate = normalizeNumber(item.unitPrice);
  const subtotal = calculateLineItemSubtotal(item.qty, item.freq, resolvedUnitRate);

  return {
    ...item,
    qty: normalizeNumber(item.qty),
    freq: normalizeNumber(item.freq),
    unitPrice: resolvedUnitRate,
    unitRate: resolvedUnitRate,
    subtotal,
    currency: "IDR",
    source: "manual_input",
    pricingMode: "custom_manual",
    lookup: {
      source: "manual_input",
      status: "resolved",
      referenceCode: null,
      referenceName: item.key === "lodging" ? "Manual Lodging Override" : "Manual Input",
      resolvedAt: new Date().toISOString(),
      notes:
        item.key === "lodging"
          ? "User manually overrides the PMK 32/2025 lodging ceiling."
          : `${item.itemName} has no standard rate in the current rule engine.`,
    },
    isCustomPrice: true,
  };
}

function calculateDirectCostsSummary(
  laborCosts: LaborCostComputed[],
  mobilityCosts: {
    personnelDeployment: MobilityCostComputed;
    equipmentHandling: MobilityCostComputed;
  },
  equipmentCosts: EquipmentCostComputed[],
  supportingCosts: SupportingCostComputed[]
): DirectCostsComputedSummary {
  const laborSubtotal = laborCosts.reduce((total, item) => total + item.subtotal, 0);
  const mobilitySubtotal =
    mobilityCosts.personnelDeployment.subtotal + mobilityCosts.equipmentHandling.subtotal;
  const equipmentSubtotal = equipmentCosts.reduce((total, item) => total + item.subtotal, 0);
  const supportingSubtotal = supportingCosts.reduce((total, item) => total + item.subtotal, 0);
  const totalPersonnel = laborCosts.reduce(
    (total, item) => total + normalizeNumber(item.quantity),
    0
  );

  return {
    laborSubtotal,
    mobilitySubtotal,
    equipmentSubtotal,
    supportingSubtotal,
    directCostSubtotal: laborSubtotal + mobilitySubtotal + equipmentSubtotal + supportingSubtotal,
    totalPersonnel,
  };
}

function roundToIncrement(value: number, increment: number | null) {
  const safeIncrement = normalizeNumber(increment);

  if (safeIncrement <= 0) {
    return value;
  }

  return Math.round(value / safeIncrement) * safeIncrement;
}

export function createSvrPredictionPayload(
  form: TenderWizardFormData,
  finalPriceBeforeRounding: number,
  _finalRoundedPrice: number,
  _subtotalBeforeProfit: number
): SvrPredictionRequestPayload {
  return {
    projectName: form.directCosts.projectInfo.projectName,
    companyName: form.directCosts.projectInfo.companyName,
    companyCategory: form.directCosts.projectInfo.companyCategory,
    projectLocation: form.directCosts.projectInfo.projectLocation,
    projectCategory:
      form.directCosts.projectInfo.projectCategory === ""
        ? "survey"
        : form.directCosts.projectInfo.projectCategory,
    workDate: form.directCosts.projectInfo.workDate,
    ruleBasedSummary: {
      ruleBasedEstimateBeforeApproval: finalPriceBeforeRounding,
    },
    requestedModels: ["project_only", "hybrid"],
  };
}

export async function fetchSVRPrediction(
  payload: SvrPredictionRequestPayload
): Promise<SvrPredictionResult> {
  const response = await fetch("/api/ai-benchmark", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      result && typeof result === "object" && "error" in result && typeof result.error === "string"
        ? result.error
        : "AI benchmark service gagal memberikan respons yang valid.";

    throw new Error(errorMessage);
  }

  if (!isSvrPredictionResult(result)) {
    throw new Error("AI benchmark service mengembalikan payload yang tidak sesuai kontrak.");
  }

  return result;
}

export function getTenderCalculationMetadata() {
  return {
    calculationVersion: CALCULATION_ENGINE_VERSION,
    masterDataVersion: [
      MASTER_DATA_REFERENCE.laborRates.version,
      MASTER_DATA_REFERENCE.locationIndices.version,
      MASTER_DATA_REFERENCE.lodgingRates.version,
    ].join(" / "),
    references: {
      laborRates: { ...MASTER_DATA_REFERENCE.laborRates } satisfies MasterDataVersionInfo,
      locationIndices: {
        ...MASTER_DATA_REFERENCE.locationIndices,
      } satisfies MasterDataVersionInfo,
      lodgingRates: { ...MASTER_DATA_REFERENCE.lodgingRates } satisfies MasterDataVersionInfo,
    },
  };
}

export function createIdleSvrPrediction(payload: SvrPredictionRequestPayload): SvrPredictionResult {
  return {
    targetName: "harga_sebelum_approval",
    payload,
    projectOnly: {
      modelKey: "project_only",
      predictedPrice: null,
      currency: "IDR",
      modelName: "Project-Only Benchmark",
      modelVersion: null,
      status: "idle",
      validationState: "limited",
      validationSummary: "Benchmark project-only masih dalam tahap evaluasi production.",
    },
    hybrid: {
      modelKey: "hybrid",
      predictedPrice: null,
      currency: "IDR",
      modelName: "Hybrid Benchmark",
      modelVersion: null,
      status: "idle",
      validationState: "limited",
      validationSummary:
        "Benchmark hybrid sangat kuat terhadap baseline median, tetapi belum mengalahkan estimasi langsung.",
    },
    bestAvailable: null,
    modelVersions: {},
    featureSnapshot: {
      projectName: payload.projectName,
      companyCategory: payload.companyCategory || null,
      projectCategory: payload.projectCategory,
      projectLocation: payload.projectLocation,
      ruleBasedEstimateBeforeApproval: payload.ruleBasedSummary.ruleBasedEstimateBeforeApproval,
    },
  };
}

export function calculateTenderWizardComputedState(
  form: TenderWizardFormData,
  previousSvrPrediction?: SvrPredictionResult
): TenderWizardComputedState {
  const projectLocation = form.directCosts.projectInfo.projectLocation;
  const laborCosts = form.directCosts.laborCosts.map((item) =>
    calculateLaborCost(item, projectLocation)
  );
  const mobilityCosts = {
    personnelDeployment: calculateMobilityCost(form.directCosts.mobilityCosts.personnelDeployment),
    equipmentHandling: calculateMobilityCost(form.directCosts.mobilityCosts.equipmentHandling),
  };
  const equipmentCosts = form.directCosts.equipmentCosts.map(calculateEquipmentCost);
  const supportingCosts = form.directCosts.supportingCosts.map((item) =>
    calculateSupportingCost(item, projectLocation)
  );

  const directCosts = calculateDirectCostsSummary(
    laborCosts,
    mobilityCosts,
    equipmentCosts,
    supportingCosts
  );
  const overheadAmount =
    directCosts.directCostSubtotal * (normalizeNumber(form.indirectCosts.overheadPercentage) / 100);
  const subtotalBeforeProfit = directCosts.directCostSubtotal + overheadAmount;
  const profitAmount =
    subtotalBeforeProfit * (normalizeNumber(form.profitAndCgl.profitPercentage) / 100);
  const finalPriceBeforeRounding =
    subtotalBeforeProfit + profitAmount + normalizeNumber(form.profitAndCgl.cglInsuranceNominal);
  const finalRoundedPrice = form.profitAndCgl.autoRoundFinalTotal
    ? roundToIncrement(finalPriceBeforeRounding, form.profitAndCgl.roundingIncrement)
    : finalPriceBeforeRounding;

  const svrPayload = createSvrPredictionPayload(
    form,
    finalPriceBeforeRounding,
    finalRoundedPrice,
    subtotalBeforeProfit
  );
  const aiBenchmark =
    previousSvrPrediction &&
    JSON.stringify(previousSvrPrediction.payload) === JSON.stringify(svrPayload)
      ? previousSvrPrediction
      : createIdleSvrPrediction(svrPayload);

  const summary: FinalCalculationSummary = {
    directCosts,
    overheadPercentage: normalizeNumber(form.indirectCosts.overheadPercentage),
    overheadAmount,
    subtotalBeforeProfit,
    profitPercentage: normalizeNumber(form.profitAndCgl.profitPercentage),
    profitAmount,
    cglInsuranceNominal: normalizeNumber(form.profitAndCgl.cglInsuranceNominal),
    finalPriceBeforeRounding,
    finalRoundedPrice,
    roundingIncrement: normalizeNumber(form.profitAndCgl.roundingIncrement),
  };

  return {
    laborCosts,
    mobilityCosts,
    equipmentCosts,
    supportingCosts,
    summary,
    aiBenchmark,
  };
}

export function createTenderCalculationRecord(
  id: string,
  status: TenderCalculationRecord["status"],
  archivedAt: string | null,
  form: TenderWizardFormData,
  computed: TenderWizardComputedState,
  createdAt: string,
  updatedAt: string
): TenderCalculationRecord {
  return {
    id,
    status,
    archivedAt,
    createdAt,
    updatedAt,
    metadata: getTenderCalculationMetadata(),
    form,
    computed,
  };
}
