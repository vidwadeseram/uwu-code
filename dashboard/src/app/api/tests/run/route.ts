import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const REGRESSION_DIR = path.join(process.cwd(), "..", "regression_tests");
const RESULTS_DIR = path.join(REGRESSION_DIR, "results");

function runningFile(project: string) {
  return path.join(RESULTS_DIR, project, "running.json");
}

/** POST /api/tests/run?project=slug  — spawn test runner in background */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");

  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  const lockFile = runningFile(project);

  if (fs.existsSync(lockFile)) {
    return NextResponse.json(
      { error: "Tests already running for this project" },
      { status: 409 }
    );
  }

  // Ensure results dir exists
  const projectResultsDir = path.join(RESULTS_DIR, project);
  fs.mkdirSync(projectResultsDir, { recursive: true });

  const runId = new Date().toISOString().replace(/[:.]/g, "").replace("Z", "Z");
  fs.writeFileSync(lockFile, JSON.stringify({ run_id: runId, started_at: new Date().toISOString() }));

  const proc = spawn("uv", ["run", "test_runner.py", project], {
    cwd: REGRESSION_DIR,
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });

  proc.on("exit", () => {
    fs.rmSync(lockFile, { force: true });
  });

  proc.on("error", () => {
    fs.rmSync(lockFile, { force: true });
  });

  proc.unref();

  return NextResponse.json({ run_id: runId, status: "started" });
}

/** GET /api/tests/run?project=slug  — check if tests are currently running */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");

  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  const lockFile = runningFile(project);
  const running = fs.existsSync(lockFile);

  if (running) {
    try {
      const info = JSON.parse(fs.readFileSync(lockFile, "utf-8"));
      return NextResponse.json({ running: true, ...info });
    } catch {
      return NextResponse.json({ running: true });
    }
  }

  return NextResponse.json({ running: false });
}
