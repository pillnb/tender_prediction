import { NextResponse } from "next/server";
import {
  archiveTenderCalculation,
  deleteTenderCalculation,
  getTenderCalculationById,
  normalizeTenderForm,
  updateTenderCalculation,
} from "@/lib/tender-repository";
import type { TenderCalculationApiPayload } from "@/types/tender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const record = await getTenderCalculationById(id);

  if (!record) {
    return NextResponse.json(
      {
        error: "Tender calculation not found.",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    data: record,
  });
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as TenderCalculationApiPayload;
    const form = normalizeTenderForm(body);
    const record = await updateTenderCalculation(
      id,
      form,
      body.status ?? "draft",
      body.aiBenchmark
    );

    return NextResponse.json({
      data: record,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update tender calculation.",
      },
      {
        status: 400,
      }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const hardDelete = searchParams.get("mode") === "hard-delete";

  if (hardDelete) {
    await deleteTenderCalculation(id);

    return NextResponse.json({
      ok: true,
      deleted: true,
    });
  }

  const record = await archiveTenderCalculation(id);

  return NextResponse.json({
    data: record,
  });
}
