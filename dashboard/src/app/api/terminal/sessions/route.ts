import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  sessions,
  createTmuxSession,
  startSessionCleanup,
  updateSessionActivity,
  MAX_SESSIONS,
} from "@/lib/terminal-sessions";

startSessionCleanup();

export async function GET() {
  const sessionList = Array.from(sessions.values()).map((s) => ({
    id: s.id,
    tmuxSession: s.tmuxSession,
    createdAt: s.createdAt,
    lastActivity: s.lastActivity,
  }));
  return NextResponse.json({ sessions: sessionList });
}

export async function POST(request: NextRequest) {
  if (sessions.size >= MAX_SESSIONS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SESSIONS} concurrent sessions allowed` },
      { status: 429 }
    );
  }

  let cwd: string | undefined;
  try {
    const body = await request.json();
    cwd = body.cwd;
  } catch {
    cwd = undefined;
  }

  const id = randomUUID();
  const session = createTmuxSession(id, cwd);
  sessions.set(id, session);

  return NextResponse.json({
    id,
    tmuxSession: session.tmuxSession,
  });
}

export async function PATCH(_request: NextRequest) {
  const body = await _request.json();
  const { id } = body as { id?: string };
  
  if (id && sessions.has(id)) {
    updateSessionActivity(id);
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ error: "Session not found" }, { status: 404 });
}
