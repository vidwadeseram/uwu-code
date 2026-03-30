export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { checkAuth, readSettings, writeSettings, hashPassword, generateToken } from "@/app/lib/settings";

export async function POST(req: NextRequest) {
  const settings = readSettings();
  // Must be authenticated OR auth not yet configured (first-time setup)
  if (settings.username && !checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username, password, currentPassword } = await req.json() as {
    username: string;
    password: string;
    currentPassword?: string;
  };

  // If credentials already exist, require current password
  if (settings.username && currentPassword !== undefined) {
    if (hashPassword(currentPassword) !== settings.password_hash) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }
  }

  if (!username?.trim()) return NextResponse.json({ error: "Username required" }, { status: 400 });
  if (!password || password.length < 6) return NextResponse.json({ error: "Password must be ≥ 6 chars" }, { status: 400 });

  writeSettings({
    username: username.trim(),
    password_hash: hashPassword(password),
    session_token: generateToken(), // invalidate all existing sessions
  });

  // Clear cookie so user must re-login
  const res = NextResponse.json({ ok: true, mustRelogin: true });
  res.cookies.delete("uwu_session");
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  writeSettings({ username: "", password_hash: "", session_token: "" });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("uwu_session");
  return res;
}
