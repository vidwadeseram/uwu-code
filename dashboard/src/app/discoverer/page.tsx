"use client";

import { useEffect, useMemo, useState } from "react";

interface ProjectInfo {
  name: string;
  path: string;
  lastModified: string;
  branch: string;
  remoteUrl: string;
}

interface ProjectGroup {
  name: string;
  path: string;
  projects: ProjectInfo[];
}

interface ProjectsData {
  groups: ProjectGroup[];
}

interface DiscovererCase {
  id: string;
  label: string;
  task: string;
  enabled: boolean;
  depends_on?: string | null;
  skip_dependents_on_fail?: boolean;
}

interface DiscovererWorkflow {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  case_ids: string[];
}

interface DiscovererResponse {
  project: string;
  workspacePath: string;
  testConfig: {
    project: string;
    description: string;
    test_cases: DiscovererCase[];
    workflows: DiscovererWorkflow[];
  };
  agentDocs: string;
  context: {
    workspaceName: string;
    fileCount: number;
    stackHints: string[];
    runScripts: string[];
    routeHints: string[];
  };
  persisted: {
    tests: boolean;
    docs: boolean;
    testCasesFile?: string;
    knowledgeFile?: string;
  };
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function DiscovererPage() {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspacePath, setWorkspacePath] = useState("");
  const [project, setProject] = useState("");
  const [persistTests, setPersistTests] = useState(true);
  const [persistDocs, setPersistDocs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DiscovererResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = (await res.json()) as ProjectsData;
        const discovered = Array.from(
          new Set((data.groups ?? []).flatMap((group) => (group.projects ?? []).map((p) => p.path)).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b));
        if (!mounted) return;
        setWorkspaces(discovered);
        if (discovered.length > 0) {
          setWorkspacePath(discovered[0]);
          setProject((prev) => prev || toSlug(discovered[0].split("/").filter(Boolean).at(-1) ?? ""));
        }
      } catch {
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!workspacePath) return;
    const inferred = toSlug(workspacePath.split("/").filter(Boolean).at(-1) ?? "");
    if (!inferred) return;
    setProject((prev) => prev || inferred);
  }, [workspacePath]);

  const canRun = workspacePath.trim().length > 0 && project.trim().length > 0 && !loading;

  const testCaseCount = useMemo(() => result?.testConfig.test_cases.length ?? 0, [result]);

  async function runDiscoverer() {
    if (!canRun) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/discoverer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspacePath,
          project,
          persistTests,
          persistDocs,
        }),
      });
      const data = (await res.json()) as DiscovererResponse | { error?: string };
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Discoverer failed");
        return;
      }
      setResult(data as DiscovererResponse);
    } catch {
      setError("Network error while running Discoverer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>Discoverer</h1>
          <p className="text-xs" style={{ color: "#4a5568" }}>
            Analyze a workspace, generate test cases for the Tests page, and generate OpenClaw knowledge docs.
          </p>
        </div>
      </div>

      <div className="card p-4 space-y-4" style={{ background: "rgba(30,45,74,0.35)", border: "1px solid #1e2d4a", borderRadius: 12 }}>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="discoverer-workspace" className="text-xs" style={{ color: "#94a3b8" }}>Workspace path</label>
            {workspaces.length > 0 ? (
              <select
                id="discoverer-workspace"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #1e2d4a" }}
              >
                {workspaces.map((ws) => (
                  <option key={ws} value={ws}>{ws}</option>
                ))}
              </select>
            ) : (
              <input
                id="discoverer-workspace"
                value={workspacePath}
                onChange={(e) => setWorkspacePath(e.target.value)}
                placeholder="/opt/workspaces/your-project"
                className="w-full px-3 py-2 rounded text-sm"
                style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #1e2d4a" }}
              />
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="discoverer-project" className="text-xs" style={{ color: "#94a3b8" }}>Test project slug</label>
            <input
              id="discoverer-project"
              value={project}
              onChange={(e) => setProject(toSlug(e.target.value))}
              placeholder="my-project"
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #1e2d4a" }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs flex items-center gap-2" style={{ color: "#94a3b8" }}>
            <input type="checkbox" checked={persistTests} onChange={(e) => setPersistTests(e.target.checked)} />
            Save generated tests to regression_tests/test_cases
          </label>
          <label className="text-xs flex items-center gap-2" style={{ color: "#94a3b8" }}>
            <input type="checkbox" checked={persistDocs} onChange={(e) => setPersistDocs(e.target.checked)} />
            Save generated docs to openclaw/data/knowledge
          </label>
        </div>

        <button
          type="button"
          onClick={runDiscoverer}
          disabled={!canRun}
          className="px-4 py-2 rounded text-sm font-semibold"
          style={{
            background: canRun ? "linear-gradient(135deg,#00ff88,#00d4ff)" : "rgba(30,45,74,0.5)",
            color: canRun ? "#0a0e1a" : "#4a5568",
          }}
        >
          {loading ? "Discovering..." : "Run Discoverer"}
        </button>

        {error && (
          <div className="text-xs px-3 py-2 rounded" style={{ color: "#f87171", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="card p-3" style={{ background: "rgba(30,45,74,0.35)", border: "1px solid #1e2d4a", borderRadius: 10 }}>
              <div className="text-xs" style={{ color: "#4a5568" }}>Project</div>
              <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{result.project}</div>
            </div>
            <div className="card p-3" style={{ background: "rgba(30,45,74,0.35)", border: "1px solid #1e2d4a", borderRadius: 10 }}>
              <div className="text-xs" style={{ color: "#4a5568" }}>Scanned files</div>
              <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{result.context.fileCount}</div>
            </div>
            <div className="card p-3" style={{ background: "rgba(30,45,74,0.35)", border: "1px solid #1e2d4a", borderRadius: 10 }}>
              <div className="text-xs" style={{ color: "#4a5568" }}>Generated test cases</div>
              <div className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{testCaseCount}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-3 space-y-2" style={{ background: "rgba(30,45,74,0.35)", border: "1px solid #1e2d4a", borderRadius: 10 }}>
              <div className="text-xs font-semibold" style={{ color: "#00d4ff" }}>Generated test config</div>
              <pre className="text-xs overflow-auto rounded p-3" style={{ background: "#0f172a", color: "#e2e8f0", maxHeight: 420 }}>
                {JSON.stringify(result.testConfig, null, 2)}
              </pre>
            </div>

            <div className="card p-3 space-y-2" style={{ background: "rgba(30,45,74,0.35)", border: "1px solid #1e2d4a", borderRadius: 10 }}>
              <div className="text-xs font-semibold" style={{ color: "#00ff88" }}>Generated agent docs</div>
              <pre className="text-xs overflow-auto rounded p-3 whitespace-pre-wrap" style={{ background: "#0f172a", color: "#e2e8f0", maxHeight: 420 }}>
                {result.agentDocs}
              </pre>
            </div>
          </div>

          <div className="text-xs" style={{ color: "#94a3b8" }}>
            {result.persisted.testCasesFile && <div>Saved tests: {result.persisted.testCasesFile}</div>}
            {result.persisted.knowledgeFile && <div>Saved docs: {result.persisted.knowledgeFile}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
