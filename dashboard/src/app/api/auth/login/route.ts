export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { readSettings, writeSettings, hashPassword, generateToken } from "@/app/lib/settings";
import { createSessionToken } from "@/app/lib/auth-token";

const AUTH_SECRET_FILE = "/etc/uwu-code/auth_secret";

function ensureAuthSecret() {
  if (process.env.AUTH_SECRET?.trim()) return;
  try {
    const fileSecret = fs.readFileSync(AUTH_SECRET_FILE, "utf-8").trim();
    if (fileSecret) process.env.AUTH_SECRET = fileSecret;
  } catch {}
}

export async function POST(req: NextRequest) {
  let payload: { username?: string; password?: string };
  try {
    payload = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { username, password } = payload;
  const settings = readSettings();

  const userTrimmed = (username ?? "").trim();
  if (!userTrimmed || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  try {
    ensureAuthSecret();

    if (!settings.username) {
      const serverSessionToken = generateToken();
      const cookieToken = await createSessionToken(userTrimmed);
      writeSettings({
        ...settings,
        username: userTrimmed,
        password_hash: hashPassword(password),
        session_token: serverSessionToken,
      });

      const res = NextResponse.json({ ok: true, initialized: true });
      res.cookies.set("uwu_session", cookieToken, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
      });
      return res;
    }

    if (userTrimmed !== settings.username || hashPassword(password) !== settings.password_hash) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const serverSessionToken = generateToken();
    const cookieToken = await createSessionToken(settings.username);
    writeSettings({ ...settings, session_token: serverSessionToken });

    const res = NextResponse.json({ ok: true });
    res.cookies.set("uwu_session", cookieToken, {
      httpOnly: true,
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed due to server configuration" }, { status: 500 });
  }
}
