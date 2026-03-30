export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DATA_DIR = path.join(process.cwd(), "..", "openclaw", "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface Task {
  id: string;
  title: string;
  type: "coding" | "research";
  description: string;
  workspace?: string;
  preferred_tool?: "claude" | "opencode" | "auto";
  status: "pending" | "running" | "completed" | "failed" | "scheduled";
  created_at: string;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  report?: string;
}

function loadTasks(): Task[] {
  if (!fs.existsSync(TASKS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TASKS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveTasks(tasks: Task[]) {
  ensureDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export async function GET() {
  ensureDir();
  return NextResponse.json({ tasks: loadTasks() });
}

export async function POST(req: NextRequest) {
  ensureDir();
  const body = await req.json() as Partial<Task>;
  const { title, type, description, workspace, preferred_tool } = body;

  if (!description?.trim())
    return NextResponse.json({ error: "description required" }, { status: 400 });
  if (!type || !["coding", "research"].includes(type))
    return NextResponse.json({ error: "type must be coding or research" }, { status: 400 });

  const task: Task = {
    id: randomUUID(),
    title: (title?.trim() || description.slice(0, 60)).trim(),
    type,
    description: description.trim(),
    workspace: type === "coding" ? (workspace || "/opt/workspaces") : undefined,
    preferred_tool: type === "coding" ? (preferred_tool || "auto") : undefined,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);

  return NextResponse.json({ task }, { status: 201 });
}
