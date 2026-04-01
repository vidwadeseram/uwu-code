import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { resolveWorkspacePath } from "@/app/lib/discoverer";
import { getDefaultPaths, getProjectPaths, getReadableProjectPaths, listKnownProjects, setProjectWorkspace } from "@/app/lib/tests-paths";

function ensureTestCasesDir() {
  const defaultPaths = getDefaultPaths("__bootstrap__");
  if (!fs.existsSync(defaultPaths.testCasesDir)) {
    fs.mkdirSync(defaultPaths.testCasesDir, { recursive: true });
  }
}

/** GET /api/tests/cases                 → list of available project slugs
 *  GET /api/tests/cases?project=slug   → full test config for that project */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");

  ensureTestCasesDir();

  if (!project) {
    return NextResponse.json({ projects: listKnownProjects() });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  const paths = getReadableProjectPaths(project);
  const file = paths.configFile;
  const exists = fs.existsSync(file);
  if (!exists) {
    return NextResponse.json(
      {
        project,
        description: "",
        test_cases: [],
        workflows: [],
        exists: false,
      }
    );
  }

  try {
    const content = JSON.parse(fs.readFileSync(file, "utf-8"));
    return NextResponse.json({ ...content, exists: true });
  } catch {
    return NextResponse.json({ error: "Failed to read test cases" }, { status: 500 });
  }
}

/** PUT /api/tests/cases?project=slug  — save full test config (body = JSON) */
export async function PUT(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");
  const createMode = searchParams.get("create") === "1";

  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  ensureTestCasesDir();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid config payload" }, { status: 400 });
  }

  const asRecord = body as Record<string, unknown>;
  const providedWorkspace = typeof asRecord.workspace_path === "string" ? asRecord.workspace_path : "";
  let resolvedWorkspace = "";
  if (providedWorkspace) {
    const resolved = resolveWorkspacePath(providedWorkspace);
    if (!resolved) {
      return NextResponse.json(
        { error: "workspace_path must be an accessible path under allowed workspace roots" },
        { status: 400 }
      );
    }
    asRecord.workspace_path = resolved;
    resolvedWorkspace = resolved;
  }

  if (resolvedWorkspace) {
    setProjectWorkspace(project, resolvedWorkspace);
  }

  const paths = getProjectPaths(project);
  const file = paths.configFile;

  if (createMode && fs.existsSync(file)) {
    try {
      const existing = JSON.parse(fs.readFileSync(file, "utf-8")) as {
        test_cases?: unknown;
        workflows?: unknown;
      };
      const compatible = Array.isArray(existing.test_cases) && Array.isArray(existing.workflows);
      if (compatible) {
        return NextResponse.json({
          success: true,
          existed: true,
          reused: true,
          message: "Existing compatible tests project found; reusing without overwrite",
        });
      }
      return NextResponse.json(
        { error: "Existing project file is incompatible and was not overwritten" },
        { status: 409 }
      );
    } catch {
      return NextResponse.json(
        { error: "Existing project file could not be parsed and was not overwritten" },
        { status: 409 }
      );
    }
  }

  fs.writeFileSync(file, JSON.stringify(asRecord, null, 2));

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");

  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  ensureTestCasesDir();

  const paths = getProjectPaths(project);
  const defaults = getDefaultPaths(project);
  const configFile = paths.configFile;
  const envFile = paths.envFile;
  const resultsDir = paths.projectResultsDir;

  const removed: string[] = [];
  const maybeRemove = (target: string, kind: "file" | "dir") => {
    if (!fs.existsSync(target)) return;
    if (kind === "file") fs.unlinkSync(target);
    else fs.rmSync(target, { recursive: true, force: true });
    removed.push(target);
  };

  maybeRemove(configFile, "file");
  maybeRemove(envFile, "file");
  maybeRemove(resultsDir, "dir");

  if (defaults.configFile !== configFile) {
    maybeRemove(defaults.configFile, "file");
    maybeRemove(defaults.envFile, "file");
    maybeRemove(defaults.projectResultsDir, "dir");
  }

  setProjectWorkspace(project, undefined);

  return NextResponse.json({ success: true, removed });
}
