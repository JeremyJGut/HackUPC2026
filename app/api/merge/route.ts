import { NextRequest, NextResponse } from "next/server";
import { mergeBranch } from "@/lib/git-backend";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sourceBranch?: string };
    const result = mergeBranch(body.sourceBranch ?? "");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo completar el merge.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
