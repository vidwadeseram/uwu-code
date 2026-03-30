export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkAuth, readSettings } from "@/app/lib/settings";

export async function GET(req: NextRequest) {
  const settings = readSettings();
  const authEnabled = !!settings.username;
  const ok = checkAuth(req);
  if (!ok) return NextResponse.json({ ok: false, authEnabled }, { status: 401 });
  return NextResponse.json({ ok: true, authEnabled, username: settings.username });
}
