import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const AUDIT_FILE = path.join(process.cwd(), "..", "openclaw", "data", "audit.log");

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    if (!fs.existsSync(AUDIT_FILE)) {
      return NextResponse.json({ logs: [] });
    }

    const content = fs.readFileSync(AUDIT_FILE, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const entries = lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({ logs: entries.reverse() });
  } catch (error) {
    console.error("[/api/scheduler/audit GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
