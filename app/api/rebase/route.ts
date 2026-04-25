import { NextRequest, NextResponse } from "next/server";
import { rebaseOnto } from "@/lib/git-backend";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { onto?: string };
    const result = rebaseOnto(body.onto ?? "");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar el rebase.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
