import type {
  EducationLevel,
  InkindoRateReference,
  LaborMainCategory,
  LodgingRateReference,
  OperationalCostKey,
  ProfessionalSkkLevel,
  ProjectCategory,
  SupportingStaffRole,
} from "@/types/tender";

export const CALCULATION_ENGINE_VERSION = "pt-bki-rule-engine-v1.1.0";

export const MASTER_DATA_REFERENCE = {
  laborRates: {
    key: "inkindo-biaya-personel",
    sourceName: "INKINDO Biaya Personel",
    version: "2025.1",
    effectiveDate: "2025-01-01",
    notes: "Master rate sementara yang diselaraskan untuk flow kalkulator tender PT BKI.",
  },
  locationIndices: {
    key: "inkindo-indeks-lokasi",
    sourceName: "INKINDO Indeks Lokasi",
    version: "2025.1",
    effectiveDate: "2025-01-01",
    notes: "Indeks lokasi disimpan sebagai string agar presisi desimal parseFloat tetap terjaga.",
  },
  lodgingRates: {
    key: "pmk-32-2025-lodging",
    sourceName: "PMK 32/2025 Batas Penginapan",
    version: "2025.1",
    effectiveDate: "2025-02-14",
    notes: "Batas lodging default per lokasi proyek, dapat dioverride jika mode custom dipilih.",
  },
} as const;

export const PROJECT_CATEGORY_MULTIPLIER: Record<ProjectCategory, number> = {
  pemetaan: 1.08,
  survey: 1.02,
  inspeksi: 1.15,
  assessment: 1.1,
  audit: 1.05,
  pengujian: 1.12,
  pengujian_lab: 1.18,
  monitoring: 1.06,
  supervisi: 1.09,
  konsultansi: 1.14,
  sertifikasi: 1.11,
  training: 0.94,
  labor_survey: 1.03,
};

export const LOCATION_INDEX_MAP: Record<string, string> = {
  "DKI Jakarta": "1.122",
  "Jawa Barat": "0.987",
  "Jawa Tengah": "0.952",
  "Jawa Timur": "0.975",
  Banten: "1.004",
  Bali: "1.061",
  "Kalimantan Timur": "1.188",
  "Kalimantan Utara": "1.214",
  "Papua Barat": "1.264",
  Papua: "1.287",
};

export const LODGING_RATE_MAP: Record<string, number> = {
  "DKI Jakarta": 1900000,
  "Jawa Barat": 1400000,
  "Jawa Tengah": 1250000,
  "Jawa Timur": 1350000,
  Banten: 1350000,
  Bali: 1700000,
  "Kalimantan Timur": 2100000,
  "Kalimantan Utara": 2250000,
  "Papua Barat": 2400000,
  Papua: 2500000,
};

export const PROFESSIONAL_RATE_TABLE: Record<
  ProfessionalSkkLevel,
  Partial<Record<EducationLevel, Record<string, number>>>
> = {
  "ahli-utama": {
    s1: { junior: 610000, madya: 695000, senior: 785000, principal: 880000 },
    s2: { junior: 720000, madya: 810000, senior: 915000, principal: 1030000 },
    s3: { junior: 835000, madya: 930000, senior: 1045000, principal: 1175000 },
  },
  "ahli-madya": {
    s1: { junior: 555000, madya: 635000, senior: 720000, principal: 810000 },
    s2: { junior: 660000, madya: 750000, senior: 845000, principal: 950000 },
    s3: { junior: 775000, madya: 865000, senior: 970000, principal: 1085000 },
  },
  "ahli-muda": {
    s1: { junior: 495000, madya: 575000, senior: 655000, principal: 735000 },
    s2: { junior: 605000, madya: 690000, senior: 780000, principal: 875000 },
    s3: { junior: 715000, madya: 805000, senior: 900000, principal: 1005000 },
  },
  "tanpa-skk": {
    s1: { junior: 435000, madya: 510000, senior: 590000, principal: 670000 },
    s2: { junior: 540000, madya: 620000, senior: 710000, principal: 800000 },
    s3: { junior: 655000, madya: 740000, senior: 835000, principal: 930000 },
  },
};

export const SUBPROFESSIONAL_RATE_TABLE: Partial<Record<EducationLevel, Record<string, number>>> = {
  sma: { junior: 235000, madya: 270000, senior: 305000, principal: 340000 },
  d3: { junior: 315000, madya: 360000, senior: 405000, principal: 450000 },
  s1: { junior: 390000, madya: 440000, senior: 495000, principal: 550000 },
  s2: { junior: 455000, madya: 510000, senior: 570000, principal: 630000 },
  s3: { junior: 515000, madya: 575000, senior: 640000, principal: 705000 },
};

export const SUPPORTING_ROLE_RATE_TABLE: Record<SupportingStaffRole, number | null> = {
  "pemrogram-basis-data": 455000,
  "pemrogram-perangkat-lunak": 440000,
  "desain-grafis": 360000,
  "operator-basis-data": 280000,
  "pemelihara-sistem": 345000,
  "teknisi-jaringan-teknologi-informasi": 330000,
  "administrator-web": 350000,
  "operator-cad-cam": 295000,
  "operator-sig": 320000,
  "teknisi-perangkat-keras": 310000,
  fasilitator: 285000,
  inspektur: 340000,
  surveyor: 300000,
  "manajer-kantor": 355000,
  "manajer-kantor-lapangan-administrator": 325000,
  "sekretaris-dwibahasa": 290000,
  sekretaris: 245000,
  "operator-komputer": 230000,
  pengemudi: 210000,
  kurir: 180000,
  satpam: 175000,
  "pesuruh-kantor": 160000,
  lainnya: null,
};

export const PROFESSIONAL_SKK_LABELS: Record<ProfessionalSkkLevel, string> = {
  "ahli-utama": "Ahli Utama",
  "ahli-madya": "Ahli Madya",
  "ahli-muda": "Ahli Muda",
  "tanpa-skk": "Tanpa SKK",
};

export const LABOR_CATEGORY_LABELS: Record<LaborMainCategory, string> = {
  "tenaga-ahli-profesional": "Tenaga Ahli (Profesional)",
  "teknisi-analis-subprofesional": "Teknisi/Analis (Sub Profesional)",
  "tenaga-pendukung": "Tenaga Pendukung (Supporting Staff)",
};

export const SUPPORTING_ROLE_LABELS: Record<SupportingStaffRole, string> = {
  "pemrogram-basis-data": "Pemrogram Basis Data",
  "pemrogram-perangkat-lunak": "Pemrogram Perangkat Lunak",
  "desain-grafis": "Desain Grafis",
  "operator-basis-data": "Operator Basis Data",
  "pemelihara-sistem": "Pemelihara Sistem",
  "teknisi-jaringan-teknologi-informasi": "Teknisi Jaringan Teknologi Informasi",
  "administrator-web": "Administrator Web",
  "operator-cad-cam": "Operator CAD/CAM",
  "operator-sig": "Operator SIG",
  "teknisi-perangkat-keras": "Teknisi Perangkat Keras",
  fasilitator: "Fasilitator",
  inspektur: "Inspektur",
  surveyor: "Surveyor",
  "manajer-kantor": "Manajer Kantor",
  "manajer-kantor-lapangan-administrator": "Manajer Kantor Lapangan/Adminstrator",
  "sekretaris-dwibahasa": "Sekretaris Dwibahasa",
  sekretaris: "Sekretaris",
  "operator-komputer": "Operator Komputer",
  pengemudi: "Pengemudi",
  kurir: "Kurir",
  satpam: "Satpam",
  "pesuruh-kantor": "Pesuruh Kantor",
  lainnya: "Lainnya",
};

export const SUPPORTING_ITEM_LABELS: Record<OperationalCostKey, string> = {
  mealAllowance: "Meal Allowance",
  lodging: "Penginapan",
  reporting: "Reporting",
  permits: "Permit",
  medicalCheckup: "MCU",
  other: "Biaya Lainnya",
};

export const LABOR_MAIN_CATEGORY_OPTIONS = Object.entries(LABOR_CATEGORY_LABELS).map(
  ([value, label]) => ({
    value: value as LaborMainCategory,
    label,
  })
);

export const PROFESSIONAL_SKK_OPTIONS = Object.entries(PROFESSIONAL_SKK_LABELS).map(
  ([value, label]) => ({
    value: value as ProfessionalSkkLevel,
    label,
  })
);

export const SUPPORTING_ROLE_OPTIONS = Object.entries(SUPPORTING_ROLE_LABELS).map(
  ([value, label]) => ({
    value: value as SupportingStaffRole,
    label,
  })
);

export const EDUCATION_OPTIONS: EducationLevel[] = ["sma", "d3", "s1", "s2", "s3", "lainnya"];
export const PROFESSIONAL_EDUCATION_OPTIONS: EducationLevel[] = ["s1", "s2", "s3"];

function getExperienceBand(experienceYears: number | null) {
  const years = Number(experienceYears ?? 0);

  if (years >= 16) {
    return "principal";
  }

  if (years >= 9) {
    return "senior";
  }

  if (years >= 5) {
    return "madya";
  }

  return "junior";
}

export function getLocationIndex(projectLocation: string) {
  const rawIndex = LOCATION_INDEX_MAP[projectLocation] ?? "1.000";

  return {
    projectLocation,
    locationIndex: Number.parseFloat(rawIndex),
    lookup: {
      source: "inkindo_standard_rate" as const,
      status: projectLocation ? ("resolved" as const) : ("fallback" as const),
      referenceCode: MASTER_DATA_REFERENCE.locationIndices.key,
      referenceName: `${MASTER_DATA_REFERENCE.locationIndices.sourceName} ${MASTER_DATA_REFERENCE.locationIndices.version}`,
      resolvedAt: new Date().toISOString(),
      notes: `Resolved location remuneration index for ${projectLocation || "unspecified location"}.`,
    },
  };
}

export function getLodgingRate(projectLocation: string): LodgingRateReference {
  const maxNightlyRate = LODGING_RATE_MAP[projectLocation] ?? 1250000;

  return {
    projectLocation,
    maxNightlyRate,
    sourceRegulation: "PMK 32/2025",
    lookup: {
      source: "pmk_32_2025_lodging_limit",
      status: projectLocation ? "resolved" : "fallback",
      referenceCode: MASTER_DATA_REFERENCE.lodgingRates.key,
      referenceName: `${MASTER_DATA_REFERENCE.lodgingRates.sourceName} ${MASTER_DATA_REFERENCE.lodgingRates.version}`,
      resolvedAt: new Date().toISOString(),
      notes: `Resolved default lodging ceiling for ${projectLocation || "unspecified location"}.`,
    },
  };
}

export function getLaborRateLookup(
  mainCategory: LaborMainCategory | "",
  professionalSkkLevel: ProfessionalSkkLevel | "",
  supportingRole: SupportingStaffRole | "",
  education: EducationLevel | "",
  experienceYears: number | null,
  projectLocation: string
): InkindoRateReference {
  const normalizedEducation = education || "lainnya";
  const experienceBand = getExperienceBand(experienceYears);
  const { locationIndex } = getLocationIndex(projectLocation);
  let baseRate = 0;
  let roleLabel = "";

  if (mainCategory === "tenaga-ahli-profesional") {
    const skkLevel = professionalSkkLevel || "tanpa-skk";
    const professionalRates = PROFESSIONAL_RATE_TABLE[skkLevel];
    const educationRates = professionalRates[normalizedEducation] ?? professionalRates.s1;

    baseRate = educationRates?.[experienceBand] ?? 0;
    roleLabel = PROFESSIONAL_SKK_LABELS[skkLevel];
  } else if (mainCategory === "teknisi-analis-subprofesional") {
    const educationRates =
      SUBPROFESSIONAL_RATE_TABLE[normalizedEducation] ?? SUBPROFESSIONAL_RATE_TABLE.sma;

    baseRate = educationRates?.[experienceBand] ?? 0;
    roleLabel = LABOR_CATEGORY_LABELS["teknisi-analis-subprofesional"];
  } else if (mainCategory === "tenaga-pendukung") {
    const resolvedSupportingRole = supportingRole || "lainnya";

    baseRate = SUPPORTING_ROLE_RATE_TABLE[resolvedSupportingRole] ?? 0;
    roleLabel = supportingRole
      ? SUPPORTING_ROLE_LABELS[resolvedSupportingRole]
      : LABOR_CATEGORY_LABELS["tenaga-pendukung"];
  }

  return {
    education: normalizedEducation,
    experienceYears: Number(experienceYears ?? 0),
    roleLabel,
    baseRate,
    locationIndex,
    effectiveUnitRate: baseRate * locationIndex,
    sourceRegulation: "INKINDO",
    lookup: {
      source: "inkindo_standard_rate",
      status: baseRate > 0 ? "resolved" : "fallback",
      referenceCode: MASTER_DATA_REFERENCE.laborRates.key,
      referenceName: `${MASTER_DATA_REFERENCE.laborRates.sourceName} ${MASTER_DATA_REFERENCE.laborRates.version}`,
      resolvedAt: new Date().toISOString(),
      notes:
        baseRate > 0
          ? `Resolved ${roleLabel || "labor"} using ${normalizedEducation.toUpperCase()} / ${experienceBand} band.`
          : "Tarif dasar tidak ditemukan. Gunakan custom price untuk override manual.",
    },
  };
}
