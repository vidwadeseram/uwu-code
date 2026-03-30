export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkAuth, readEnvKeys, writeEnvKey } from "@/app/lib/settings";

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = readEnvKeys();
  // Mask values
  const masked = Object.fromEntries(
    Object.entries(keys).map(([k, v]) => [k, v ? v.slice(0, 8) + "••••••••" + v.slice(-4) : ""])
  );
  return NextResponse.json({ keys: masked });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json() as Record<string, string>;
  const allowed = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY"];
  for (const [k, v] of Object.entries(body)) {
    if (allowed.includes(k)) writeEnvKey(k, v);
  }
  return NextResponse.json({ ok: true });
}
