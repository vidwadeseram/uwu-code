import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProjectPaths, getReadableProjectPaths } from "@/app/lib/tests-paths";

interface CaseResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  duration_s: number;
  skipped: boolean;
  recording?: string | null;
}

interface RunResult {
  project: string;
  run_id: string;
  started_at: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: CaseResult[];
}

interface AgentRunMeta {
  run_id: string;
  project: string;
  target: "claude" | "opencode";
  status: "running" | "completed" | "failed";
  started_at: string;
  completed_at?: string;
  exit_code?: number;
  summary?: string;
  log_file?: string;
  case_ids: string[];
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asRunResult(value: unknown, defaultProject: string, resultsDir: string): RunResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.run_id !== "string" || typeof row.started_at !== "string") return null;
  if (!Array.isArray(row.results)) return null;

  const normalizedResults = row.results
    .filter((item): item is CaseResult => !!item && typeof item === "object")
    .map((item) => ({
      ...item,
      recording:
        typeof item.recording === "string"
          ? normalizeRecordingPath(item.recording, resultsDir)
          : item.recording ?? undefined,
    }));

  return {
    project: typeof row.project === "string" && row.project.length > 0 ? row.project : defaultProject,
    run_id: row.run_id,
    started_at: row.started_at,
    total: Number(row.total ?? 0),
    passed: Number(row.passed ?? 0),
    failed: Number(row.failed ?? 0),
    skipped: Number(row.skipped ?? 0),
    results: normalizedResults,
  };
}

function asAgentRunMeta(value: unknown): AgentRunMeta | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.run_id !== "string" ||
    typeof row.project !== "string" ||
    (row.target !== "claude" && row.target !== "opencode") ||
    (row.status !== "running" && row.status !== "completed" && row.status !== "failed") ||
    typeof row.started_at !== "string"
  ) {
    return null;
  }

  return {
    run_id: row.run_id,
    project: row.project,
    target: row.target,
    status: row.status,
    started_at: row.started_at,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : undefined,
    exit_code: typeof row.exit_code === "number" ? row.exit_code : undefined,
    summary: typeof row.summary === "string" ? row.summary : undefined,
    log_file: typeof row.log_file === "string" ? row.log_file : undefined,
    case_ids: parseStringArray(row.case_ids),
  };
}

function stripAnsi(input: string): string {
  return input.replace(new RegExp("\\u001B\\[[0-9;]*[A-Za-z]", "g"), "");
}

function readLogText(meta: AgentRunMeta, resultsDir: string): string {
  if (!meta.log_file) return "";
  try {
    const abs = path.join(resultsDir, meta.log_file);
    if (!fs.existsSync(abs)) return "";
    return fs.readFileSync(abs, "utf-8");
  } catch {
    return "";
  }
}

function normalizeRecordingPath(value: string | undefined, resultsDir: string): string | undefined {
  if (!value) return undefined;
  const raw = value.trim().replace(/^`|`$/g, "");
  if (!raw) return undefined;

  const normalized = raw.replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.includes("..") || normalized.includes("\0")) return undefined;

  const resultsPrefix = resultsDir.replace(/\\/g, "/") + "/";
  if (normalized.startsWith(resultsPrefix)) {
    const rel = normalized.slice(resultsPrefix.length);
    return rel.startsWith("/") || rel.includes("..") ? undefined : rel;
  }
  if (normalized.startsWith("results/")) {
    const rel = normalized.slice("results/".length);
    return rel.startsWith("/") || rel.includes("..") ? undefined : rel;
  }

  const inPath = normalized.indexOf("/results/");
  if (inPath >= 0) {
    const rel = normalized.slice(inPath + "/results/".length);
    return rel.startsWith("/") || rel.includes("..") ? undefined : rel;
  }

  if (/^[a-zA-Z0-9_-]+\/.+\.(webm|mp4)$/i.test(normalized)) {
    return normalized;
  }

  return undefined;
}

function parseStatus(token: string): { passed: boolean; skipped: boolean } {
  const upper = token.toUpperCase();
  if (upper === "PASS" || upper === "PASSED") return { passed: true, skipped: false };
  if (upper === "SKIP" || upper === "SKIPPED") return { passed: false, skipped: true };
  return { passed: false, skipped: false };
}

function parseCaseResultsFromAgentText(meta: AgentRunMeta, resultsDir: string): CaseResult[] {
  const chunks = [meta.summary ?? "", readLogText(meta, resultsDir)].filter((value) => value.length > 0);
  if (chunks.length === 0) return [];

  const source = stripAnsi(chunks.join("\n")).slice(-50000);
  const linePattern = /-\s*`?([a-zA-Z0-9_-]+)`?\s*:\s*(PASS|PASSED|FAIL|FAILED|SKIP|SKIPPED)(?:\.\s*Recording:\s*`?([^`\n]+)`?)?/gi;
  const byCase = new Map<string, CaseResult>();
  let match = linePattern.exec(source);
  while (match !== null) {
    const caseId = match[1];
    const status = parseStatus(match[2]);
    const recording = normalizeRecordingPath(match[3], resultsDir);

    byCase.set(caseId, {
      id: `${meta.run_id}-${caseId}-report`,
      label: caseId,
      passed: status.passed,
      skipped: status.skipped,
      detail: "Recovered from agent final report because save_results output was missing.",
      duration_s: 0,
      recording,
    });

    match = linePattern.exec(source);
  }

  return Array.from(byCase.values());
}

function summarizeFailure(rawSummary: string | undefined): string {
  if (!rawSummary) return "";

  const cleanedLines = stripAnsi(rawSummary)
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (cleanedLines.length === 0) return "";

  const interesting = cleanedLines.filter((line) => {
    const lowered = line.toLowerCase();
    return (
      lowered.includes("error") ||
      lowered.includes("failed") ||
      lowered.includes("exception") ||
      lowered.includes("traceback") ||
      lowered.includes("context window") ||
      lowered.includes("permission denied")
    );
  });

  const source = interesting.length > 0 ? interesting : cleanedLines;
  return source.slice(-3).join("\n").slice(0, 1000);
}

function listVideoFilesRecursive(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (ext === ".webm" || ext === ".mp4") {
        files.push(abs);
      }
    }
  }

  return files.sort();
}

function toRecordingCaseResults(meta: AgentRunMeta, detail: string, resultsDir: string): CaseResult[] {
  const roots = [
    path.join(resultsDir, meta.project, "recordings", "manual", meta.run_id),
    path.join(resultsDir, meta.project, "agent_runs", "manual", meta.run_id),
  ];

  const seen = new Set<string>();
  const cases: CaseResult[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    for (const abs of listVideoFilesRecursive(root)) {
      const rel = path.relative(resultsDir, abs);
      if (rel.startsWith("..")) continue;

      const relPosix = rel.split(path.sep).join("/");
      if (seen.has(relPosix)) continue;
      seen.add(relPosix);

      const caseId = path.basename(path.dirname(abs));
      cases.push({
        id: `${meta.run_id}-${caseId}-${cases.length + 1}`,
        label: caseId,
        passed: false,
        detail,
        duration_s: 0,
        skipped: true,
        recording: relPosix,
      });
    }
  }

  return cases;
}

function toCasePlaceholderResults(meta: AgentRunMeta, detail: string): CaseResult[] {
  if (meta.case_ids.length === 0) return [];
  return meta.case_ids.map((caseId, index) => ({
    id: `${meta.run_id}-${caseId}-${index + 1}`,
    label: caseId,
    passed: false,
    detail,
    duration_s: 0,
    skipped: true,
  }));
}

function toFallbackRun(meta: AgentRunMeta, resultsDir: string): RunResult {
  const failed = meta.status === "failed";
  const failureSummary = failed ? summarizeFailure(meta.summary) : "";
  const failureDetail =
    failed && failureSummary.length > 0
      ? `Agent process failed before structured results were saved.\n${failureSummary}`
      : failed
      ? `Agent process failed${typeof meta.exit_code === "number" ? ` (exit ${meta.exit_code})` : ""}. Structured case-level results were not persisted.`
      : `${meta.target} agent run completed, but structured case-level results were not persisted via save_results.`;

  const recordingDetail =
    failed
      ? "Recording captured, but the run ended before structured save_results output was written."
      : "Recording captured, but structured pass/fail assertions were not written via save_results.";

  const placeholderDetail =
    failed
      ? "Case was selected, but no structured result or recording was found before the run failed."
      : "Case was selected, but no structured result or recording was found for this run.";

  const recordingCases = toRecordingCaseResults(meta, recordingDetail, resultsDir);
  const reportCases = parseCaseResultsFromAgentText(meta, resultsDir);

  if (reportCases.length > 0) {
    const recordingByCase = new Map<string, string>();
    for (const recordingCase of recordingCases) {
      if (recordingCase.recording) {
        recordingByCase.set(recordingCase.label, recordingCase.recording);
      }
    }

    const mergedByCase = new Map<string, CaseResult>();
    for (const reportCase of reportCases) {
      const recoveredRecording = recordingByCase.get(reportCase.label);
      mergedByCase.set(reportCase.label, {
        ...reportCase,
        recording: reportCase.recording ?? recoveredRecording,
      });
      recordingByCase.delete(reportCase.label);
    }

    recordingByCase.forEach((recording, caseId) => {
      mergedByCase.set(caseId, {
        id: `${meta.run_id}-${caseId}-recording`,
        label: caseId,
        passed: false,
        skipped: true,
        detail: recordingDetail,
        duration_s: 0,
        recording,
      });
    });

    const cases = Array.from(mergedByCase.values());
    const passedCount = cases.filter((c) => c.passed).length;
    const skippedCount = cases.filter((c) => c.skipped).length;
    const failedCount = cases.length - passedCount - skippedCount;

    const finalCases =
      failed && failedCount === 0
        ? [
            {
              id: `${meta.run_id}-agent-summary`,
              label: `${meta.target} agent run`,
              passed: false,
              detail: failureDetail,
              duration_s: 0,
              skipped: false,
            },
            ...cases,
          ]
        : cases;

    return {
      project: meta.project,
      run_id: meta.run_id,
      started_at: meta.started_at,
      total: finalCases.length,
      passed: passedCount,
      failed: finalCases.length - passedCount - finalCases.filter((c) => c.skipped).length,
      skipped: finalCases.filter((c) => c.skipped).length,
      results: finalCases,
    };
  }

  const placeholderCases = recordingCases.length === 0 ? toCasePlaceholderResults(meta, placeholderDetail) : [];
  const recoveredCases = recordingCases.length > 0 ? recordingCases : placeholderCases;

  if (recoveredCases.length > 0) {
    const summaryRows: CaseResult[] = failed
      ? [
          {
            id: `${meta.run_id}-agent-summary`,
            label: `${meta.target} agent run`,
            passed: false,
            detail: failureDetail,
            duration_s: 0,
            skipped: false,
          },
        ]
      : [];

    const merged = [...summaryRows, ...recoveredCases];
    return {
      project: meta.project,
      run_id: meta.run_id,
      started_at: meta.started_at,
      total: merged.length,
      passed: 0,
      failed: failed ? 1 : 0,
      skipped: recoveredCases.length,
      results: merged,
    };
  }

  return {
    project: meta.project,
    run_id: meta.run_id,
    started_at: meta.started_at,
    total: 1,
    passed: 0,
    failed: failed ? 1 : 0,
    skipped: failed ? 0 : 1,
    results: [
      {
        id: `${meta.run_id}-agent-summary`,
        label: `${meta.target} agent run`,
        passed: false,
        detail: failureDetail,
        duration_s: 0,
        skipped: !failed,
      },
    ],
  };
}

function sortByStartedAtDesc(a: RunResult, b: RunResult): number {
  return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
}

function pushRunIfNew(results: RunResult[], runIds: Set<string>, run: RunResult) {
  if (runIds.has(run.run_id)) return;
  results.push(run);
  runIds.add(run.run_id);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);

  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  const projectPaths = getReadableProjectPaths(project);
  const projectResultsDir = projectPaths.projectResultsDir;
  if (!fs.existsSync(projectResultsDir)) {
    return NextResponse.json({ results: [] });
  }

  const files = fs
    .readdirSync(projectResultsDir)
    .filter((f) => f.endsWith(".json") && f !== "running.json")
    .sort()
    .reverse();

  const results: RunResult[] = [];
  const runIds = new Set<string>();

  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(projectResultsDir, file), "utf-8"));
      const parsed = asRunResult(content, project, projectPaths.resultsDir);
      if (!parsed) continue;
      pushRunIfNew(results, runIds, parsed);
    } catch {
    }
  }

  const agentRunsDir = path.join(projectResultsDir, "agent_runs");
  if (fs.existsSync(agentRunsDir)) {
    const agentFiles = fs
      .readdirSync(agentRunsDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of agentFiles) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(agentRunsDir, file), "utf-8"));

        const parsedRun = asRunResult(content, project, projectPaths.resultsDir);
        if (parsedRun) {
          parsedRun.results = parsedRun.results.map((item) => ({
            ...item,
            recording: typeof item.recording === "string" ? normalizeRecordingPath(item.recording, projectPaths.resultsDir) : item.recording,
          }));
          pushRunIfNew(results, runIds, parsedRun);
          continue;
        }

        const parsedMeta = asAgentRunMeta(content);
        if (!parsedMeta || parsedMeta.status === "running") continue;
        pushRunIfNew(results, runIds, toFallbackRun(parsedMeta, projectPaths.resultsDir));
      } catch {
      }
    }
  }

  results.sort(sortByStartedAtDesc);
  return NextResponse.json({ results: results.slice(0, limit) });
}
