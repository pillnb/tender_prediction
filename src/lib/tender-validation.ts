import type { TenderWizardFormData, TenderWizardStep } from "@/types/tender";

export type TenderValidationSection =
  | "project-info"
  | "labor-costs"
  | "mobility-costs"
  | "equipment-costs"
  | "supporting-costs"
  | "indirect-costs"
  | "profit-cgl";

export type TenderValidationIssue = {
  step: TenderWizardStep;
  section: TenderValidationSection;
  field: string;
  message: string;
};

export type TenderStepValidation = {
  step: TenderWizardStep;
  isValid: boolean;
  issues: TenderValidationIssue[];
};

export type TenderValidationSnapshot = {
  allIssues: TenderValidationIssue[];
  steps: Record<TenderWizardStep, TenderStepValidation>;
  sectionIssueCount: Record<TenderValidationSection, number>;
};

function pushIssue(
  issues: TenderValidationIssue[],
  step: TenderWizardStep,
  section: TenderValidationSection,
  field: string,
  message: string
) {
  issues.push({
    step,
    section,
    field,
    message,
  });
}

export function validateTenderWizardForm(
  form: TenderWizardFormData,
  directCostSubtotal: number
): TenderValidationSnapshot {
  const issues: TenderValidationIssue[] = [];
  const { projectInfo, laborCosts, mobilityCosts, equipmentCosts, supportingCosts } =
    form.directCosts;
  const { indirectCosts, profitAndCgl } = form;

  if (!projectInfo.projectCategory) {
    pushIssue(
      issues,
      "direct-costs",
      "project-info",
      "projectCategory",
      "Kategori proyek wajib dipilih."
    );
  }

  if (!projectInfo.projectName.trim()) {
    pushIssue(issues, "direct-costs", "project-info", "projectName", "Nama pekerjaan wajib diisi.");
  }

  if (!projectInfo.companyName.trim()) {
    pushIssue(
      issues,
      "direct-costs",
      "project-info",
      "companyName",
      "Nama perusahaan wajib diisi."
    );
  }

  if (!projectInfo.projectLocation.trim()) {
    pushIssue(
      issues,
      "direct-costs",
      "project-info",
      "projectLocation",
      "Lokasi proyek wajib dipilih."
    );
  }

  if (projectInfo.durationDays === null || projectInfo.durationDays <= 0) {
    pushIssue(
      issues,
      "direct-costs",
      "project-info",
      "durationDays",
      "Durasi pekerjaan harus lebih dari 0 hari."
    );
  }

  if (!projectInfo.workDate) {
    pushIssue(issues, "direct-costs", "project-info", "workDate", "Tanggal pekerjaan wajib diisi.");
  }

  if (!projectInfo.companyCategory) {
    pushIssue(
      issues,
      "direct-costs",
      "project-info",
      "companyCategory",
      "Kategori perusahaan wajib dipilih."
    );
  }

  laborCosts.forEach((item, index) => {
    const prefix = `laborCosts.${index}`;

    if (!item.mainCategory) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.mainCategory`,
        `Crew ${index + 1}: kategori utama wajib dipilih.`
      );
    }

    if (!item.roleName.trim()) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.roleName`,
        `Crew ${index + 1}: posisi/komposisi crew wajib diisi.`
      );
    }

    if (item.quantity === null || item.quantity <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.quantity`,
        `Crew ${index + 1}: jumlah personil harus lebih dari 0.`
      );
    }

    if (item.durationDays === null || item.durationDays <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.durationDays`,
        `Crew ${index + 1}: durasi kerja harus lebih dari 0 hari.`
      );
    }

    if (item.mainCategory !== "tenaga-pendukung" && item.education === "") {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.education`,
        `Crew ${index + 1}: pendidikan wajib dipilih.`
      );
    }

    if (item.mainCategory !== "tenaga-pendukung" && item.experienceYears === null) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.experienceYears`,
        `Crew ${index + 1}: pengalaman wajib diisi.`
      );
    }

    if (
      item.mainCategory !== "tenaga-pendukung" &&
      item.experienceYears !== null &&
      item.experienceYears < 0
    ) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.experienceYears`,
        `Crew ${index + 1}: pengalaman tidak boleh negatif.`
      );
    }

    if (item.mainCategory === "tenaga-ahli-profesional" && item.professionalSkkLevel === "") {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.professionalSkkLevel`,
        `Crew ${index + 1}: level SKK wajib dipilih untuk tenaga ahli.`
      );
    }

    if (item.mainCategory === "tenaga-pendukung" && item.supportingRole === "") {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.supportingRole`,
        `Crew ${index + 1}: peran tenaga pendukung wajib dipilih.`
      );
    }

    if (
      (item.isCustomPrice ||
        (item.mainCategory === "tenaga-pendukung" && item.supportingRole === "lainnya")) &&
      (!item.manualUnitRate || item.manualUnitRate <= 0)
    ) {
      pushIssue(
        issues,
        "direct-costs",
        "labor-costs",
        `${prefix}.manualUnitRate`,
        `Crew ${index + 1}: custom price wajib lebih dari 0.`
      );
    }
  });

  [
    {
      key: "personnelDeployment",
      label: "Mob Demob Personil",
      value: mobilityCosts.personnelDeployment,
    },
    {
      key: "equipmentHandling",
      label: "Equipment Handling",
      value: mobilityCosts.equipmentHandling,
    },
  ].forEach((item) => {
    if (item.value.qty === null || item.value.qty <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "mobility-costs",
        `${item.key}.qty`,
        `${item.label}: qty harus lebih dari 0.`
      );
    }

    if (item.value.freq === null || item.value.freq <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "mobility-costs",
        `${item.key}.freq`,
        `${item.label}: freq harus lebih dari 0.`
      );
    }

    if (item.value.unitPrice === null || item.value.unitPrice <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "mobility-costs",
        `${item.key}.unitPrice`,
        `${item.label}: harga satuan harus lebih dari 0.`
      );
    }
  });

  equipmentCosts.forEach((item, index) => {
    const prefix = `equipmentCosts.${index}`;

    if (!item.equipmentName.trim()) {
      pushIssue(
        issues,
        "direct-costs",
        "equipment-costs",
        `${prefix}.equipmentName`,
        `Alat ${index + 1}: nama alat wajib diisi.`
      );
    }

    if (item.qty === null || item.qty <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "equipment-costs",
        `${prefix}.qty`,
        `Alat ${index + 1}: qty harus lebih dari 0.`
      );
    }

    if (item.freq === null || item.freq <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "equipment-costs",
        `${prefix}.freq`,
        `Alat ${index + 1}: frekuensi harus lebih dari 0.`
      );
    }

    if (item.unitPrice === null || item.unitPrice <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "equipment-costs",
        `${prefix}.unitPrice`,
        `Alat ${index + 1}: harga satuan harus lebih dari 0.`
      );
    }
  });

  supportingCosts.forEach((item, index) => {
    const prefix = `supportingCosts.${index}`;

    if (!item.isIncluded) {
      return;
    }

    if (!item.itemName.trim()) {
      pushIssue(
        issues,
        "direct-costs",
        "supporting-costs",
        `${prefix}.itemName`,
        `${item.key}: nama item wajib diisi.`
      );
    }

    if (item.qty === null || item.qty <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "supporting-costs",
        `${prefix}.qty`,
        `${item.itemName}: qty harus lebih dari 0.`
      );
    }

    if (item.freq === null || item.freq <= 0) {
      pushIssue(
        issues,
        "direct-costs",
        "supporting-costs",
        `${prefix}.freq`,
        `${item.itemName}: freq/durasi harus lebih dari 0.`
      );
    }

    if (
      (item.key !== "lodging" || item.isCustomPrice) &&
      (item.unitPrice === null || item.unitPrice <= 0)
    ) {
      pushIssue(
        issues,
        "direct-costs",
        "supporting-costs",
        `${prefix}.unitPrice`,
        `${item.itemName}: unit price harus lebih dari 0.`
      );
    }
  });

  if (directCostSubtotal <= 0) {
    pushIssue(
      issues,
      "indirect-costs",
      "indirect-costs",
      "directCostSubtotal",
      "Subtotal biaya langsung harus lebih dari 0 sebelum menghitung overhead."
    );
  }

  if (indirectCosts.overheadPercentage === null) {
    pushIssue(
      issues,
      "indirect-costs",
      "indirect-costs",
      "overheadPercentage",
      "Overhead percentage wajib diisi."
    );
  } else if (indirectCosts.overheadPercentage < 0) {
    pushIssue(
      issues,
      "indirect-costs",
      "indirect-costs",
      "overheadPercentage",
      "Overhead percentage tidak boleh negatif."
    );
  }

  if (profitAndCgl.profitPercentage === null) {
    pushIssue(
      issues,
      "profit-cgl",
      "profit-cgl",
      "profitPercentage",
      "Profit percentage wajib diisi."
    );
  } else if (profitAndCgl.profitPercentage < 0) {
    pushIssue(
      issues,
      "profit-cgl",
      "profit-cgl",
      "profitPercentage",
      "Profit percentage tidak boleh negatif."
    );
  }

  if (profitAndCgl.cglInsuranceNominal === null) {
    pushIssue(
      issues,
      "profit-cgl",
      "profit-cgl",
      "cglInsuranceNominal",
      "Nilai CGL / insurance wajib diisi."
    );
  } else if (profitAndCgl.cglInsuranceNominal < 0) {
    pushIssue(
      issues,
      "profit-cgl",
      "profit-cgl",
      "cglInsuranceNominal",
      "Nilai CGL / insurance tidak boleh negatif."
    );
  }

  if (profitAndCgl.autoRoundFinalTotal && profitAndCgl.roundingIncrement === null) {
    pushIssue(
      issues,
      "profit-cgl",
      "profit-cgl",
      "roundingIncrement",
      "Rounding increment wajib diisi saat auto-round aktif."
    );
  } else if (
    profitAndCgl.autoRoundFinalTotal &&
    profitAndCgl.roundingIncrement !== null &&
    profitAndCgl.roundingIncrement <= 0
  ) {
    pushIssue(
      issues,
      "profit-cgl",
      "profit-cgl",
      "roundingIncrement",
      "Rounding increment harus lebih dari 0 saat auto-round aktif."
    );
  }

  const stepList: TenderWizardStep[] = [
    "landing",
    "direct-costs",
    "indirect-costs",
    "profit-cgl",
    "final-summary",
  ];
  const sectionKeys: TenderValidationSection[] = [
    "project-info",
    "labor-costs",
    "mobility-costs",
    "equipment-costs",
    "supporting-costs",
    "indirect-costs",
    "profit-cgl",
  ];

  return {
    allIssues: issues,
    steps: Object.fromEntries(
      stepList.map((step) => {
        const stepIssues = issues.filter((item) => item.step === step);

        return [
          step,
          {
            step,
            isValid: stepIssues.length === 0,
            issues: stepIssues,
          },
        ];
      })
    ) as Record<TenderWizardStep, TenderStepValidation>,
    sectionIssueCount: Object.fromEntries(
      sectionKeys.map((section) => [
        section,
        issues.filter((item) => item.section === section).length,
      ])
    ) as Record<TenderValidationSection, number>,
  };
}
