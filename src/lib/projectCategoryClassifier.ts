import type { ProjectCategory } from "@/types/tender";

const PROJECT_CATEGORY_RULES: Array<{
  value: ProjectCategory;
  keywords: string[];
}> = [
  {
    value: "pengujian_lab",
    keywords: ["laboratorium", "lab test", "uji lab", "analysis lab"],
  },
  {
    value: "labor_survey",
    keywords: ["labor survey", "pengerahan tenaga", "supply personil"],
  },
  {
    value: "survey",
    keywords: ["survey", "identifikasi", "inventarisasi", "pendataan", "mapping"],
  },
  {
    value: "pemetaan",
    keywords: ["pemetaan", "bathymetry", "topografi", "gis"],
  },
  {
    value: "inspeksi",
    keywords: [
      "inspeksi",
      "inspection",
      "pemeriksaan",
      "ndt",
      "underwater",
      "annual",
      "tanki",
      "tank",
      "vessel",
      "ut",
      "crane",
      "lifting",
      "gear",
      "wire",
      "hoist",
      "kapal",
      "marine",
      "tug",
      "cst",
    ],
  },
  {
    value: "sertifikasi",
    keywords: [
      "sertifikasi",
      "certification",
      "re-sertifikasi",
      "sertifikat",
      "migas",
      "riksa uji",
      "plo",
      "coi",
      "certificate",
      "slo",
      "slf",
    ],
  },
  {
    value: "pengujian",
    keywords: [
      "pengujian",
      "testing",
      "commissioning",
      "load test",
      "test",
      "kalibrasi",
      "calibration",
      "tera",
      "bollard",
      "pull",
      "fuel",
      "consumption",
      "fct",
      "psv",
    ],
  },
  {
    value: "assessment",
    keywords: ["assessment", "kajian", "studi kelayakan", "evaluasi teknis"],
  },
  {
    value: "audit",
    keywords: ["audit", "verifikasi", "penelaahan", "rla"],
  },
  {
    value: "monitoring",
    keywords: ["monitoring", "pemantauan", "pengawasan berkala"],
  },
  {
    value: "supervisi",
    keywords: ["supervisi", "supervision", "pengawasan konstruksi"],
  },
  {
    value: "konsultansi",
    keywords: ["konsultansi", "consultancy", "advisory", "jasa konsultansi"],
  },
  {
    value: "training",
    keywords: ["training", "pelatihan", "workshop", "sosialisasi"],
  },
];

export function inferProjectCategoryFromName(
  projectName: string | null | undefined
): ProjectCategory | "" {
  const text = (projectName ?? "").trim().toLowerCase();

  if (!text) {
    return "";
  }

  for (const rule of PROJECT_CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.value;
    }
  }

  return "";
}
