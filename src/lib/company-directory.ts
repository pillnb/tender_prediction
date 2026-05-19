import path from "node:path";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CompanyCategory } from "@/types/tender";
import * as XLSX from "xlsx";

const COMPANY_MAPPING_FILE = path.join(process.cwd(), "Mapping_Client_BKI_Fix.xlsx");
const companyPrisma = prisma as unknown as PrismaClient;

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
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapClientTypeToCategory(value: unknown): CompanyCategory | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  return CLIENT_TYPE_TO_CATEGORY[normalized] ?? null;
}

function loadCompanyRowsFromWorkbook() {
  if (!existsSync(COMPANY_MAPPING_FILE)) {
    return [];
  }

  const workbook = XLSX.readFile(COMPANY_MAPPING_FILE);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  return rows
    .map((row) => {
      const companyName = String(row.Perusahaan ?? "").trim();
      const companyCategory = mapClientTypeToCategory(row["Type of Client"]);

      if (!companyName || !companyCategory) {
        return null;
      }

      return {
        companyName,
        normalizedName: normalizeCompanyName(companyName),
        companyCategory,
        source: "mapping_client_bki_fix",
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
}

export async function ensureCompanyDirectorySeeded() {
  const existingCount = await companyPrisma.companyDirectory.count();

  if (existingCount > 0) {
    return;
  }

  const rows = loadCompanyRowsFromWorkbook();

  if (rows.length === 0) {
    return;
  }

  await companyPrisma.companyDirectory.createMany({
    data: rows,
    skipDuplicates: true,
  });
}

export async function searchCompanyDirectory(query: string) {
  await ensureCompanyDirectorySeeded();

  const trimmed = query.trim();

  if (!trimmed) {
    return {
      suggestions: [] as CompanyDirectorySuggestion[],
      exactMatch: null as CompanyDirectorySuggestion | null,
    };
  }

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

  return companyPrisma.companyDirectory.upsert({
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
}
