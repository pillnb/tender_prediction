import { NextResponse } from "next/server";
import {
  searchCompanyDirectory,
  upsertCompanyDirectoryEntry,
} from "@/lib/company-directory";
import type { CompanyCategory } from "@/types/tender";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const result = await searchCompanyDirectory(query);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to search company directory.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      companyName?: string;
      companyCategory?: CompanyCategory;
      source?: string;
    };

    if (!body.companyName?.trim()) {
      return NextResponse.json({ error: "companyName is required." }, { status: 400 });
    }

    if (!body.companyCategory) {
      return NextResponse.json({ error: "companyCategory is required." }, { status: 400 });
    }

    const company = await upsertCompanyDirectoryEntry(
      body.companyName,
      body.companyCategory,
      body.source ?? "manual_input"
    );

    return NextResponse.json({ data: company }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save company directory entry.",
      },
      { status: 400 }
    );
  }
}
