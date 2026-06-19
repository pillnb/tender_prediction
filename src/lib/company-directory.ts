import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CompanyCategory } from "@/types/tender";
import * as XLSX from "xlsx";
const companyPrisma = prisma as unknown as PrismaClient;
const CLIENT_TYPE_MAPPING_FILE = path.join(
  process.cwd(),
  "ml_service",
  "resources",
  "client_type_mapping.xlsx"
);

const CLIENT_TYPE_TO_CATEGORY: Record<string, CompanyCategory> = {
  MIGAS: "migas",
  MINERBA: "minerba",
  EBTKE: "ebtke",
  KELISTRIKAN: "kelistrikan",
  NAKERTRANS: "nakertrans",
  DEPHUB: "dephub",
  PERINDUSTRIAN: "perindustrian",
  BKI: "bki",
  "LAIN LAIN": "lain-lain",
  "LAIN-LAIN": "lain-lain",
  LAINNYA: "lain-lain",
};

export type CompanyDirectorySuggestion = {
  companyName: string;
  companyCategory: CompanyCategory;
  source: string;
};

function normalizeCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

function mapClientTypeToCategory(value: unknown): CompanyCategory | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  return CLIENT_TYPE_TO_CATEGORY[normalized] ?? null;
}

export function loadCompanyDirectoryWorkbookRows() {
  const workbook = XLSX.readFile(CLIENT_TYPE_MAPPING_FILE);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  const deduped = new Map<
    string,
    {
      companyName: string;
      normalizedName: string;
      companyCategory: CompanyCategory;
      source: string;
    }
  >();

  for (const row of rows) {
    const companyName = String(row.client_name_standardized ?? "").trim();
    const companyCategory = mapClientTypeToCategory(row.type_of_client);

    if (!companyName || !companyCategory) {
      continue;
    }

    const normalizedName = normalizeCompanyName(companyName);

    if (!deduped.has(normalizedName)) {
      deduped.set(normalizedName, {
        companyName,
        normalizedName,
        companyCategory,
        source: "client_type_mapping",
      });
    }
  }

  return Array.from(deduped.values());
}

function buildCompanySearchClauses(query: string) {
  const tokens = normalizeCompanyName(query)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  return tokens.map((token) => ({
    companyName: {
      contains: token,
      mode: "insensitive" as const,
    },
  }));
}

async function searchTenderCalculationCompanies(query: string) {
  const trimmed = query.trim();
  const normalized = normalizeCompanyName(trimmed);
  const tokenClauses = buildCompanySearchClauses(trimmed);

  if (tokenClauses.length === 0) {
    return {
      suggestions: [] as CompanyDirectorySuggestion[],
      exactMatch: null as CompanyDirectorySuggestion | null,
    };
  }

  const rows = await companyPrisma.tenderCalculation.findMany({
    where: {
      AND: tokenClauses,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 50,
    select: {
      companyName: true,
      companyCategory: true,
    },
  });

  const deduped = new Map<string, CompanyDirectorySuggestion>();

  for (const row of rows) {
    const companyName = row.companyName.trim();
    const companyCategory = row.companyCategory as CompanyCategory;

    if (!companyName || !companyCategory) {
      continue;
    }

    const key = normalizeCompanyName(companyName);

    if (!deduped.has(key)) {
      deduped.set(key, {
        companyName,
        companyCategory,
        source: "tender_calculation",
      });
    }
  }

  const suggestions = Array.from(deduped.values()).slice(0, 8);
  const exactMatch = suggestions.find(
    (suggestion) => normalizeCompanyName(suggestion.companyName) === normalized
  );

  return {
    suggestions,
    exactMatch: exactMatch ?? null,
  };
}

export async function searchCompanyDirectory(query: string) {
  const trimmed = query.trim();
  const tokenClauses = buildCompanySearchClauses(trimmed);

  if (!trimmed || tokenClauses.length === 0) {
    return {
      suggestions: [] as CompanyDirectorySuggestion[],
      exactMatch: null as CompanyDirectorySuggestion | null,
    };
  }

  try {
    const normalized = normalizeCompanyName(trimmed);
    const [suggestions, exactMatch] = await Promise.all([
      companyPrisma.companyDirectory.findMany({
        where: {
          AND: tokenClauses,
        },
        orderBy: [{ companyName: "asc" }],
        take: 8,
        select: {
          companyName: true,
          companyCategory: true,
          source: true,
        },
      }),
      companyPrisma.companyDirectory.findUnique({
        where: {
          normalizedName: normalized,
        },
        select: {
          companyName: true,
          companyCategory: true,
          source: true,
        },
      }),
    ]);
    const fallbackResult =
      suggestions.length > 0 || exactMatch
        ? null
        : await searchTenderCalculationCompanies(trimmed);

    return {
      suggestions:
        suggestions.length > 0
          ? (suggestions as CompanyDirectorySuggestion[])
          : fallbackResult?.suggestions ?? [],
      exactMatch:
        (exactMatch as CompanyDirectorySuggestion | null) ?? fallbackResult?.exactMatch ?? null,
    };
  } catch {
    return searchTenderCalculationCompanies(trimmed);
  }
}

export async function upsertCompanyDirectoryEntry(
  companyName: string,
  companyCategory: CompanyCategory,
  source = "manual_input"
) {
  const trimmedName = companyName.trim();

  if (!trimmedName) {
    return null;
  }

  try {
    return await companyPrisma.companyDirectory.upsert({
      where: {
        normalizedName: normalizeCompanyName(trimmedName),
      },
      update: {
        companyName: trimmedName,
        companyCategory,
        source,
      },
      create: {
        companyName: trimmedName,
        normalizedName: normalizeCompanyName(trimmedName),
        companyCategory,
        source,
      },
    });
  } catch {
    return null;
  }
}
