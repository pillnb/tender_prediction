export type CurrencyAmount = number;

export type ISODateString = string;

export type TenderWizardStep =
  | "landing"
  | "direct-costs"
  | "indirect-costs"
  | "profit-cgl"
  | "final-summary";

export type ProjectCategory =
  | "pemetaan"
  | "survey"
  | "inspeksi"
  | "assessment"
  | "audit"
  | "pengujian"
  | "pengujian_lab"
  | "monitoring"
  | "supervisi"
  | "konsultansi"
  | "sertifikasi"
  | "training"
  | "labor_survey";

export type CompanyCategory =
  | "migas"
  | "minerba"
  | "ebtke"
  | "kelistrikan"
  | "nakertrans"
  | "dephub"
  | "perindustrian"
  | "bki"
  | "lain-lain";

export type EducationLevel = "sma" | "d3" | "s1" | "s2" | "s3" | "lainnya";

export type LaborMainCategory =
  | "tenaga-ahli-profesional"
  | "teknisi-analis-subprofesional"
  | "tenaga-pendukung";

export type ProfessionalSkkLevel = "ahli-utama" | "ahli-madya" | "ahli-muda" | "tanpa-skk";

export type SupportingStaffRole =
  | "pemrogram-basis-data"
  | "pemrogram-perangkat-lunak"
  | "desain-grafis"
  | "operator-basis-data"
  | "pemelihara-sistem"
  | "teknisi-jaringan-teknologi-informasi"
  | "administrator-web"
  | "operator-cad-cam"
  | "operator-sig"
  | "teknisi-perangkat-keras"
  | "fasilitator"
  | "inspektur"
  | "surveyor"
  | "manajer-kantor"
  | "manajer-kantor-lapangan-administrator"
  | "sekretaris-dwibahasa"
  | "sekretaris"
  | "operator-komputer"
  | "pengemudi"
  | "kurir"
  | "satpam"
  | "pesuruh-kantor"
  | "lainnya";

export type TenderCurrencyCode = "IDR";
export type TenderRecordStatus = "draft" | "reviewed" | "final" | "archived";

export type PricingMode = "auto_standard_rate" | "custom_manual";

export type RateSource =
  | "inkindo_standard_rate"
  | "pmk_32_2025_lodging_limit"
  | "manual_input"
  | "derived_calculation";

export type OperationalCostKey =
  | "mealAllowance"
  | "lodging"
  | "reporting"
  | "permits"
  | "medicalCheckup"
  | "other";

export type RuleLookupStatus = "idle" | "loading" | "resolved" | "fallback" | "error";

export type SvrPredictionStatus = "idle" | "loading" | "success" | "error";
export type BenchmarkModelKey = "project_only" | "hybrid";

export type RuleLookupAudit = {
  source: RateSource;
  status: RuleLookupStatus;
  referenceCode?: string | null;
  referenceName?: string | null;
  resolvedAt?: string | null;
  notes?: string | null;
};

export type PricingBreakdown = {
  unitRate: CurrencyAmount;
  qty: number;
  freq: number;
  subtotal: CurrencyAmount;
  currency: TenderCurrencyCode;
  source: RateSource;
};

export type ProjectInfoInput = {
  projectName: string;
  projectCategory: ProjectCategory | "";
  projectLocation: string;
  companyName: string;
  companyCategory: CompanyCategory | "";
  durationDays: number | null;
  workDate: ISODateString;
};

export type LaborRateLookupInput = {
  mainCategory: LaborMainCategory | "";
  professionalSkkLevel: ProfessionalSkkLevel | "";
  supportingRole: SupportingStaffRole | "";
  education: EducationLevel | "";
  experienceYears: number | null;
  projectLocation: string;
};

export type LaborRateLookupResult = {
  baseRate: CurrencyAmount;
  locationIndex: number;
  effectiveUnitRate: CurrencyAmount;
  source: "inkindo_standard_rate";
  roleLabel: string;
  lookup: RuleLookupAudit;
};

export type LaborCostInput = {
  id: string;
  roleName: string;
  mainCategory: LaborMainCategory | "";
  professionalSkkLevel: ProfessionalSkkLevel | "";
  supportingRole: SupportingStaffRole | "";
  quantity: number | null;
  durationDays: number | null;
  education: EducationLevel | "";
  experienceYears: number | null;
  isCustomPrice: boolean;
  manualUnitRate: CurrencyAmount | null;
  notes?: string | null;
};

export type LaborCostComputed = LaborCostInput & {
  resolvedUnitRate: CurrencyAmount;
  baseRate: CurrencyAmount | null;
  locationIndex: number | null;
  pricingMode: PricingMode;
  lookup: RuleLookupAudit;
  subtotal: CurrencyAmount;
};

export type MobilityCostInput = {
  id: string;
  label: string;
  qty: number | null;
  freq: number | null;
  unitPrice: CurrencyAmount | null;
  notes?: string | null;
};

export type MobilityCostComputed = MobilityCostInput &
  PricingBreakdown & {
    id: string;
    label: string;
  };

export type EquipmentCostInput = {
  id: string;
  equipmentName: string;
  qty: number | null;
  freq: number | null;
  unitPrice: CurrencyAmount | null;
  notes?: string | null;
};

export type EquipmentCostComputed = EquipmentCostInput &
  PricingBreakdown & {
    id: string;
  };

export type SupportingCostInput = {
  id: string;
  key: OperationalCostKey;
  itemName: string;
  isIncluded: boolean;
  qty: number | null;
  freq: number | null;
  unitPrice: CurrencyAmount | null;
  isCustomPrice: boolean;
  notes?: string | null;
};

export type LodgingCostInput = Omit<SupportingCostInput, "key" | "itemName" | "isCustomPrice"> & {
  key: "lodging";
  itemName: "Penginapan";
  isCustomPrice: false;
};

export type ManualSupportingCostInput = Omit<SupportingCostInput, "key" | "isCustomPrice"> & {
  key: Exclude<OperationalCostKey, "lodging">;
  isCustomPrice: true;
};

export type SupportingCostComputed = SupportingCostInput &
  PricingBreakdown & {
    pricingMode: PricingMode;
    lookup: RuleLookupAudit;
  };

export type DirectCostsStepInput = {
  projectInfo: ProjectInfoInput;
  laborCosts: LaborCostInput[];
  mobilityCosts: {
    personnelDeployment: MobilityCostInput;
    equipmentHandling: MobilityCostInput;
  };
  equipmentCosts: EquipmentCostInput[];
  supportingCosts: SupportingCostInput[];
};

export type IndirectCostsStepInput = {
  overheadPercentage: number | null;
};

export type ProfitAndCglStepInput = {
  profitPercentage: number | null;
  cglInsuranceNominal: CurrencyAmount | null;
  autoRoundFinalTotal: boolean;
  roundingIncrement: number | null;
};

export type RuleBasedBenchmarkInput = {
  totalPersonnel: number;
  directCostSubtotal: CurrencyAmount;
  subtotalBeforeProfit: CurrencyAmount;
  finalPriceBeforeRounding: CurrencyAmount;
  finalRoundedPrice: CurrencyAmount;
  ruleBasedEstimateBeforeApproval: CurrencyAmount;
};

export type SvrPredictionRequestPayload = {
  projectName: string;
  companyName: string;
  companyCategory: CompanyCategory | "";
  projectLocation: string;
  projectCategory: ProjectCategory;
  workDate: ISODateString;
  totalDurationDays: number;
  ruleBasedSummary: RuleBasedBenchmarkInput;
  requestedModels: BenchmarkModelKey[];
};

export type SvrSinglePredictionResult = {
  modelKey: BenchmarkModelKey;
  predictedPrice: CurrencyAmount | null;
  currency: TenderCurrencyCode;
  modelName: string;
  modelVersion?: string | null;
  status: SvrPredictionStatus;
  requestedAt?: string | null;
  respondedAt?: string | null;
  errorMessage?: string | null;
};

export type SvrPredictionResult = {
  targetName: "harga_sebelum_approval";
  payload: SvrPredictionRequestPayload;
  projectOnly: SvrSinglePredictionResult;
  hybrid: SvrSinglePredictionResult;
  bestAvailable: BenchmarkModelKey | null;
  modelVersions: Partial<Record<BenchmarkModelKey, string>>;
  featureSnapshot: Record<string, string | number | null>;
  requestedAt?: string | null;
  respondedAt?: string | null;
  errors?: Partial<Record<BenchmarkModelKey, string>>;
};

export type DirectCostsComputedSummary = {
  laborSubtotal: CurrencyAmount;
  mobilitySubtotal: CurrencyAmount;
  equipmentSubtotal: CurrencyAmount;
  supportingSubtotal: CurrencyAmount;
  directCostSubtotal: CurrencyAmount;
  totalPersonnel: number;
};

export type FinalCalculationSummary = {
  directCosts: DirectCostsComputedSummary;
  overheadPercentage: number;
  overheadAmount: CurrencyAmount;
  subtotalBeforeProfit: CurrencyAmount;
  profitPercentage: number;
  profitAmount: CurrencyAmount;
  cglInsuranceNominal: CurrencyAmount;
  finalPriceBeforeRounding: CurrencyAmount;
  finalRoundedPrice: CurrencyAmount;
  roundingIncrement: number;
};

export type TenderWizardFormData = {
  currentStep: TenderWizardStep;
  directCosts: DirectCostsStepInput;
  indirectCosts: IndirectCostsStepInput;
  profitAndCgl: ProfitAndCglStepInput;
};

export type TenderWizardComputedState = {
  laborCosts: LaborCostComputed[];
  mobilityCosts: {
    personnelDeployment: MobilityCostComputed;
    equipmentHandling: MobilityCostComputed;
  };
  equipmentCosts: EquipmentCostComputed[];
  supportingCosts: SupportingCostComputed[];
  summary: FinalCalculationSummary;
  aiBenchmark: SvrPredictionResult;
};

export type MasterDataVersionInfo = {
  key: string;
  sourceName: string;
  version: string;
  effectiveDate: string;
  notes?: string | null;
};

export type TenderCalculationMetadata = {
  calculationVersion: string;
  masterDataVersion: string;
  references: {
    laborRates: MasterDataVersionInfo;
    locationIndices: MasterDataVersionInfo;
    lodgingRates: MasterDataVersionInfo;
  };
};

export type TenderCalculationRecord = {
  id: string;
  status: TenderRecordStatus;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: TenderCalculationMetadata;
  form: TenderWizardFormData;
  computed: TenderWizardComputedState;
};

export type TenderCalculationApiPayload = {
  form: TenderWizardFormData;
  status?: TenderRecordStatus;
  aiBenchmark?: SvrPredictionResult | null;
};

export type TenderCalculationApiResponse = {
  data: TenderCalculationRecord;
};

export type TenderCalculationListResponse = {
  data: TenderCalculationRecord[];
};

export type LodgingRateReference = {
  projectLocation: string;
  maxNightlyRate: CurrencyAmount;
  sourceRegulation: "PMK 32/2025";
  lookup: RuleLookupAudit;
};

export type InkindoRateReference = {
  education: EducationLevel;
  experienceYears: number;
  roleLabel: string;
  baseRate: CurrencyAmount;
  locationIndex: number;
  effectiveUnitRate: CurrencyAmount;
  sourceRegulation: "INKINDO";
  lookup: RuleLookupAudit;
};
