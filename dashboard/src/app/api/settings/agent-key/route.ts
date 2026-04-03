import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { readSettings, writeSettings } from "@/app/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = readSettings();
  if (!settings.agent_api_key) {
    settings.agent_api_key = crypto.randomBytes(32).toString("hex");
    writeSettings(settings);
  }
  return NextResponse.json({ agent_api_key: settings.agent_api_key });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { agent_api_key } = body;
  if (typeof agent_api_key !== "string" || !agent_api_key.trim()) {
    return NextResponse.json({ error: "Invalid agent_api_key" }, { status: 400 });
  }
  const settings = readSettings();
  settings.agent_api_key = agent_api_key.trim();
  writeSettings(settings);
  return NextResponse.json({ ok: true });
}
