import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CompanyCategory } from "@/types/tender";
const companyPrisma = prisma as unknown as PrismaClient;

export type CompanyDirectorySuggestion = {
  companyName: string;
  companyCategory: CompanyCategory;
  source: string;
};

function normalizeCompanyName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

async function searchTenderCalculationCompanies(query: string) {
  const trimmed = query.trim();
  const normalized = normalizeCompanyName(trimmed);
  const rows = await companyPrisma.tenderCalculation.findMany({
    where: {
      companyName: {
        contains: trimmed,
        mode: "insensitive",
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
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

  if (!trimmed) {
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
          companyName: {
            contains: trimmed,
            mode: "insensitive",
          },
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

    return {
      suggestions: suggestions as CompanyDirectorySuggestion[],
      exactMatch: (exactMatch as CompanyDirectorySuggestion | null) ?? null,
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
