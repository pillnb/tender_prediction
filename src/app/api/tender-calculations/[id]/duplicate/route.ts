import { NextResponse } from "next/server";
import { duplicateTenderCalculation } from "@/lib/tender-repository";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const record = await duplicateTenderCalculation(id);

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

  return NextResponse.json(
    {
      data: record,
    },
    {
      status: 201,
    }
  );
}
