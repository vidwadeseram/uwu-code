export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOG_FILE = path.join(process.cwd(), "..", "openclaw", "data", "agent.log");

export async function GET(req: NextRequest) {
  const n = Math.min(parseInt(new URL(req.url).searchParams.get("lines") ?? "150"), 500);
  if (!fs.existsSync(LOG_FILE)) return NextResponse.json({ lines: [] });
  try {
    const all = fs.readFileSync(LOG_FILE, "utf-8").split("\n").filter(Boolean);
    return NextResponse.json({ lines: all.slice(-n) });
  } catch {
    return NextResponse.json({ lines: [] });
  }
}
