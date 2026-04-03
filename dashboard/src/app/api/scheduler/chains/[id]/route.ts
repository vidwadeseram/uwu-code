import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TASKS_FILE = path.join(process.cwd(), "..", "openclaw", "data", "tasks.json");

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function loadTasks(): Record<string, unknown>[] {
  if (!fs.existsSync(TASKS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const tasks = loadTasks() as Array<Record<string, unknown> & { id: string }>;

    const chainTasks: Record<string, unknown>[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const task = tasks.find((t) => t.id === currentId);
      if (!task) break;
      chainTasks.push(task);
      currentId = (task.chain_next_id as string | null) || null;
    }

    return NextResponse.json({ chain: chainTasks });
  } catch (error) {
    console.error("[/api/scheduler/chains/[id] GET] Error:", error);
    return NextResponse.json({ error: "Failed to fetch chain" }, { status: 500 });
  }
}
