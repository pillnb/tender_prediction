import { NextResponse } from "next/server";
import {
  getLatestTenderCalculation,
  listTenderCalculations,
  normalizeTenderForm,
  saveTenderCalculation,
} from "@/lib/tender-repository";
import type { TenderCalculationApiPayload } from "@/types/tender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const includeArchived = searchParams.get("includeArchived") === "true";

  if (mode === "latest") {
    const latest = await getLatestTenderCalculation();

    return NextResponse.json({
      data: latest,
    });
  }

  const records = await listTenderCalculations({
    includeArchived,
  });

  return NextResponse.json({
    data: records,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TenderCalculationApiPayload;
    const form = normalizeTenderForm(body);
    const record = await saveTenderCalculation(form, body.status ?? "draft", body.aiBenchmark);

    return NextResponse.json(
      {
        data: record,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to save tender calculation.",
      },
      {
        status: 400,
      }
    );
  }
}
