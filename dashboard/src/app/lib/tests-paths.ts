import fs from "fs";
import path from "path";

const DEFAULT_REGRESSION_DIR = path.join(process.cwd(), "..", "regression_tests");
const DEFAULT_TEST_CASES_DIR = path.join(DEFAULT_REGRESSION_DIR, "test_cases");
const PROJECT_LOCATIONS_FILE = path.join(DEFAULT_TEST_CASES_DIR, ".project_locations.json");

type ProjectLocationIndex = Record<string, string>;

export interface ProjectPaths {
  regressionDir: string;
  testCasesDir: string;
  resultsDir: string;
  configFile: string;
  envFile: string;
  projectResultsDir: string;
  agentRunsDir: string;
  workspacePath?: string;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function ensureDefaults() {
  ensureDir(DEFAULT_REGRESSION_DIR);
  ensureDir(DEFAULT_TEST_CASES_DIR);
  ensureDir(path.join(DEFAULT_REGRESSION_DIR, "results"));
}

function loadIndex(): ProjectLocationIndex {
  ensureDefaults();
  if (!fs.existsSync(PROJECT_LOCATIONS_FILE)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(PROJECT_LOCATIONS_FILE, "utf-8")) as unknown;
    if (!raw || typeof raw !== "object") return {};
    const next: ProjectLocationIndex = {};
    for (const [project, workspace] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof project !== "string" || typeof workspace !== "string") continue;
      if (!/^[a-zA-Z0-9_-]+$/.test(project)) continue;
      next[project] = workspace;
    }
    return next;
  } catch {
    return {};
  }
}

function saveIndex(index: ProjectLocationIndex) {
  ensureDefaults();
  fs.writeFileSync(PROJECT_LOCATIONS_FILE, JSON.stringify(index, null, 2));
}

function workspaceRegressionDir(workspacePath: string): string {
  return path.join(workspacePath, ".uwu-code-tests");
}

export function setProjectWorkspace(project: string, workspacePath?: string) {
  const index = loadIndex();
  if (workspacePath && workspacePath.trim()) {
    index[project] = workspacePath;
  } else {
    delete index[project];
  }
  saveIndex(index);
}

export function getProjectWorkspace(project: string): string | undefined {
  const index = loadIndex();
  const value = index[project];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export function listKnownProjects(): string[] {
  ensureDefaults();
  const defaults = fs
    .readdirSync(DEFAULT_TEST_CASES_DIR)
    .filter((f) => /^[a-zA-Z0-9_-]+\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""));

  const indexProjects = Object.keys(loadIndex());
  const all = new Set<string>([...defaults, ...indexProjects]);
  return Array.from(all).sort((a, b) => a.localeCompare(b));
}

export function getProjectPaths(project: string): ProjectPaths {
  ensureDefaults();

  const workspacePath = getProjectWorkspace(project);
  const regressionDir = workspacePath ? workspaceRegressionDir(workspacePath) : DEFAULT_REGRESSION_DIR;
  const testCasesDir = path.join(regressionDir, "test_cases");
  const resultsDir = path.join(regressionDir, "results");

  ensureDir(testCasesDir);
  ensureDir(resultsDir);

  const configFile = path.join(testCasesDir, `${project}.json`);
  const envFile = path.join(testCasesDir, `${project}.env.json`);
  const projectResultsDir = path.join(resultsDir, project);
  const agentRunsDir = path.join(projectResultsDir, "agent_runs");

  return {
    regressionDir,
    testCasesDir,
    resultsDir,
    configFile,
    envFile,
    projectResultsDir,
    agentRunsDir,
    workspacePath,
  };
}

export function getReadableProjectPaths(project: string): ProjectPaths {
  const preferred = getProjectPaths(project);
  if (fs.existsSync(preferred.configFile) || fs.existsSync(preferred.envFile) || fs.existsSync(preferred.projectResultsDir)) {
    return preferred;
  }
  return getDefaultPaths(project);
}

export function getDefaultPaths(project: string): ProjectPaths {
  const regressionDir = DEFAULT_REGRESSION_DIR;
  const testCasesDir = path.join(regressionDir, "test_cases");
  const resultsDir = path.join(regressionDir, "results");
  return {
    regressionDir,
    testCasesDir,
    resultsDir,
    configFile: path.join(testCasesDir, `${project}.json`),
    envFile: path.join(testCasesDir, `${project}.env.json`),
    projectResultsDir: path.join(resultsDir, project),
    agentRunsDir: path.join(resultsDir, project, "agent_runs"),
  };
}
