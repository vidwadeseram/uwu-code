export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STATUS_FILE = path.join(process.cwd(), "..", "openclaw", "data", "status.json");

export async function GET() {
  if (!fs.existsSync(STATUS_FILE))
    return NextResponse.json({ state: "stopped", message: "Agent not running", updated_at: null, pid: null, current_task_id: null });
  try {
    return NextResponse.json(JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8")));
  } catch {
    return NextResponse.json({ state: "error", message: "Could not read status" });
  }
}
