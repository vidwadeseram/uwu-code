export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TASKS_FILE = path.join(process.cwd(), "..", "openclaw", "data", "tasks.json");

function load(): object[] {
  if (!fs.existsSync(TASKS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8")); }
  catch { return []; }
}

function save(tasks: object[]) {
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const tasks = load() as Array<{ id: string }>;
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  tasks[idx] = { ...tasks[idx], ...(await req.json()) };
  save(tasks);
  return NextResponse.json({ task: tasks[idx] });
}

export async function DELETE(_req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const tasks = load() as Array<{ id: string }>;
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [removed] = tasks.splice(idx, 1);
  save(tasks);
  return NextResponse.json({ task: removed });
}
