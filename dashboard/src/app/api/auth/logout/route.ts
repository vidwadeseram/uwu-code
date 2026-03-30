export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { readSettings, writeSettings, generateToken } from "@/app/lib/settings";

export async function POST(_req: NextRequest) {
  const settings = readSettings();
  // Invalidate existing sessions by rotating the token
  writeSettings({ ...settings, session_token: generateToken() });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("uwu_session");
  return res;
}
