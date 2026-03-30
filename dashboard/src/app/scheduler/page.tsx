"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
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

interface WorkspaceOption {
  name: string;
  path: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const STATUS_COLOR: Record<string, string> = {
  pending:   "#ffd700",
  running:   "#00d4ff",
  completed: "#00ff88",
  failed:    "#ff4444",
  scheduled: "#a855f7",
};

const STATUS_BG: Record<string, string> = {
  pending:   "rgba(255,215,0,0.1)",
  running:   "rgba(0,212,255,0.1)",
  completed: "rgba(0,255,136,0.1)",
  failed:    "rgba(255,68,68,0.1)",
  scheduled: "rgba(168,85,247,0.1)",
};

// ── Report Modal ──────────────────────────────────────────────────────────────

function ReportModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-lg overflow-hidden"
        style={{ background: "#0f1629", border: "1px solid #1e2d4a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "#1e2d4a" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wider flex-shrink-0"
              style={{
                background: STATUS_BG[task.status],
                color: STATUS_COLOR[task.status],
                border: `1px solid ${STATUS_COLOR[task.status]}40`,
              }}
            >
              {task.status}
            </span>
            <span className="font-semibold text-sm truncate" style={{ color: "#e2e8f0" }}>
              {task.title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded ml-3 flex-shrink-0"
            style={{ background: "rgba(30,45,74,0.6)", color: "#94a3b8", border: "1px solid #1e2d4a" }}
          >
            ✕ Close
          </button>
        </div>

        {/* Meta */}
        <div
          className="flex flex-wrap gap-4 px-5 py-3 text-xs border-b flex-shrink-0"
          style={{ borderColor: "#1e2d4a", color: "#94a3b8" }}
        >
          <span>Type: <span style={{ color: task.type === "coding" ? "#00d4ff" : "#a855f7" }}>{task.type}</span></span>
          {task.workspace && <span>Workspace: <span style={{ color: "#e2e8f0" }} className="font-mono">{task.workspace}</span></span>}
          {task.preferred_tool && <span>Tool: <span style={{ color: "#ffd700" }}>{task.preferred_tool}</span></span>}
          <span>Created: {fmtDate(task.created_at)}</span>
          {task.started_at && <span>Started: {fmtDate(task.started_at)}</span>}
          {task.completed_at && <span>Completed: {fmtDate(task.completed_at)}</span>}
        </div>

        {/* Task description */}
        <div className="px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "#1e2d4a" }}>
          <div className="text-xs mb-1" style={{ color: "#4a5568" }}>Task</div>
          <div className="text-sm" style={{ color: "#94a3b8" }}>{task.description}</div>
        </div>

        {/* Report */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {task.report ? (
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap font-mono"
              style={{ color: "#e2e8f0" }}
            >
              {task.report}
            </pre>
          ) : (
            <div className="text-sm text-center py-12" style={{ color: "#4a5568" }}>
              No report yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onDelete,
  onViewReport,
  onRequeue,
}: {
  task: Task;
  onDelete: () => void;
  onViewReport: () => void;
  onRequeue: () => void;
}) {
  const color = STATUS_COLOR[task.status] ?? "#94a3b8";
  const bg    = STATUS_BG[task.status]    ?? "rgba(30,45,74,0.2)";
  const isActive = ["pending", "running", "scheduled"].includes(task.status);

  return (
    <div
      className="card p-4 flex flex-col gap-2 transition-colors"
      style={{ border: `1px solid ${color}30` }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Animated dot for running */}
          {task.status === "running" ? (
            <span className="w-2 h-2 rounded-full pulse-dot flex-shrink-0" style={{ background: color }} />
          ) : (
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          )}
          <span className="font-semibold text-sm truncate" style={{ color: "#e2e8f0" }}>
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Status badge */}
          <span
            className="text-xs px-2 py-0.5 rounded font-medium uppercase tracking-wider"
            style={{ background: bg, color, border: `1px solid ${color}40` }}
          >
            {task.status}
          </span>
          {/* Type badge */}
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: task.type === "coding" ? "rgba(0,212,255,0.1)" : "rgba(168,85,247,0.1)",
              color: task.type === "coding" ? "#00d4ff" : "#a855f7",
              border: `1px solid ${task.type === "coding" ? "rgba(0,212,255,0.2)" : "rgba(168,85,247,0.2)"}`,
            }}
          >
            {task.type}
          </span>
        </div>
      </div>

      {/* Description preview */}
      <div className="text-xs leading-relaxed line-clamp-2" style={{ color: "#94a3b8" }}>
        {task.description}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#4a5568" }}>
        {task.workspace && (
          <span className="font-mono truncate max-w-48" style={{ color: "#94a3b8" }}>
            📁 {task.workspace.split("/").slice(-2).join("/")}
          </span>
        )}
        {task.preferred_tool && task.preferred_tool !== "auto" && (
          <span style={{ color: "#ffd700" }}>{task.preferred_tool}</span>
        )}
        <span>{timeAgo(task.created_at)}</span>
        {task.status === "scheduled" && task.scheduled_at && (
          <span style={{ color: "#a855f7" }}>runs at {fmtDate(task.scheduled_at)}</span>
        )}
        {task.started_at && !task.completed_at && (
          <span style={{ color: "#00d4ff" }}>started {timeAgo(task.started_at)}</span>
        )}
        {task.completed_at && task.started_at && (
          <span>
            took{" "}
            {Math.round(
              (new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()) / 1000
            )}s
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-1">
        {!isActive && (
          <button
            onClick={onViewReport}
            className="text-xs px-2.5 py-1 rounded transition-opacity hover:opacity-80"
            style={{
              background: "rgba(0,212,255,0.1)",
              color: "#00d4ff",
              border: "1px solid rgba(0,212,255,0.25)",
            }}
          >
            View Report
          </button>
        )}
        {(task.status === "failed" || task.status === "scheduled") && (
          <button
            onClick={onRequeue}
            className="text-xs px-2.5 py-1 rounded transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,215,0,0.08)",
              color: "#ffd700",
              border: "1px solid rgba(255,215,0,0.2)",
            }}
          >
            Requeue
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs px-2.5 py-1 rounded transition-opacity hover:opacity-80 ml-auto"
          style={{
            background: "rgba(255,68,68,0.08)",
            color: "#ff4444",
            border: "1px solid rgba(255,68,68,0.2)",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── New Task Form ─────────────────────────────────────────────────────────────

const INPUT = {
  background: "rgba(10,14,26,0.8)",
  border: "1px solid rgba(30,45,74,0.8)",
  color: "#e2e8f0",
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "0.8rem",
  outline: "none",
  width: "100%",
};

const SELECT = { ...INPUT };

function NewTaskForm({
  workspaces,
  onCreated,
  onCancel,
}: {
  workspaces: WorkspaceOption[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<"coding" | "research">("research");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workspace, setWorkspace] = useState(workspaces[0]?.path ?? "/opt/workspaces");
  const [tool, setTool] = useState<"auto" | "claude" | "opencode">("auto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!description.trim()) { setError("Description is required"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/scheduler/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          type,
          description: description.trim(),
          workspace: type === "coding" ? workspace : undefined,
          preferred_tool: type === "coding" ? tool : undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="card p-5 flex flex-col gap-4"
      style={{ border: "1px solid rgba(0,255,136,0.2)" }}
    >
      <div className="text-sm font-semibold" style={{ color: "#00ff88" }}>New Task</div>

      {/* Type */}
      <div className="flex gap-2">
        {(["research", "coding"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className="flex-1 py-2 rounded text-sm font-medium transition-all"
            style={{
              background: type === t
                ? (t === "coding" ? "rgba(0,212,255,0.15)" : "rgba(168,85,247,0.15)")
                : "rgba(30,45,74,0.3)",
              color: type === t ? (t === "coding" ? "#00d4ff" : "#a855f7") : "#4a5568",
              border: `1px solid ${type === t ? (t === "coding" ? "rgba(0,212,255,0.4)" : "rgba(168,85,247,0.4)") : "rgba(30,45,74,0.5)"}`,
            }}
          >
            {t === "coding" ? "💻 Coding" : "🔬 Research"}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "#4a5568" }}>Title (optional)</label>
        <input
          style={INPUT}
          placeholder="Short label…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Workspace + Tool (coding only) */}
      {type === "coding" && (
        <div className="flex gap-3">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs" style={{ color: "#4a5568" }}>Workspace</label>
            <select
              style={SELECT}
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              {workspaces.length === 0 && (
                <option value="/opt/workspaces">/opt/workspaces</option>
              )}
              {workspaces.map((w) => (
                <option key={w.path} value={w.path}>{w.name} ({w.path})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs" style={{ color: "#4a5568" }}>Tool</label>
            <select
              style={{ ...SELECT, width: "120px" }}
              value={tool}
              onChange={(e) => setTool(e.target.value as "auto" | "claude" | "opencode")}
            >
              <option value="auto">Auto</option>
              <option value="claude">Claude Code</option>
              <option value="opencode">OpenCode</option>
            </select>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className="text-xs" style={{ color: "#4a5568" }}>
          {type === "coding" ? "What should be done?" : "Research question / prompt"}
        </label>
        <textarea
          style={{ ...INPUT, minHeight: "100px", resize: "vertical" }}
          placeholder={
            type === "coding"
              ? "Describe the coding task in detail. openclaw will use opencode or claude code to complete it."
              : "Ask a question, request research, or describe what you need to know."
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {error && (
        <div className="text-xs px-3 py-2 rounded" style={{ background: "rgba(255,68,68,0.1)", color: "#ff4444", border: "1px solid rgba(255,68,68,0.2)" }}>
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={loading}
          className="flex-1 py-2 rounded text-sm font-semibold transition-opacity"
          style={{
            background: loading ? "rgba(30,45,74,0.5)" : "rgba(0,255,136,0.15)",
            color: loading ? "#4a5568" : "#00ff88",
            border: "1px solid rgba(0,255,136,0.3)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating…" : "Queue Task"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded text-sm transition-opacity hover:opacity-70"
          style={{ background: "rgba(30,45,74,0.4)", color: "#94a3b8", border: "1px solid rgba(30,45,74,0.7)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulerPage() {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"active" | "completed">("active");
  const [showForm, setShowForm]   = useState(false);
  const [report, setReport]       = useState<Task | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduler/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = await res.json();
      const opts: WorkspaceOption[] = [];
      for (const group of data.groups ?? []) {
        for (const proj of group.projects ?? []) {
          opts.push({ name: `${group.name}/${proj.name}`, path: proj.path });
        }
        if (group.projects?.length === 1 && group.projects[0].path === group.path) {
          // group itself is a single project, already added
        }
      }
      if (opts.length === 0) opts.push({ name: "workspaces", path: "/opt/workspaces" });
      setWorkspaces(opts);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchWorkspaces();
    timerRef.current = setInterval(fetchTasks, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchTasks, fetchWorkspaces]);

  async function deleteTask(id: string) {
    await fetch(`/api/scheduler/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  }

  async function requeueTask(id: string) {
    await fetch(`/api/scheduler/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending", scheduled_at: undefined, started_at: undefined }),
    });
    fetchTasks();
  }

  const active    = tasks.filter((t) => ["pending", "running", "scheduled"].includes(t.status));
  const completed = tasks.filter((t) => ["completed", "failed"].includes(t.status));

  const pending  = active.filter((t) => t.status === "pending").length;
  const running  = active.filter((t) => t.status === "running").length;
  const sched    = active.filter((t) => t.status === "scheduled").length;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded flex items-center justify-center"
            style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <line x1="8" y1="14" x2="8" y2="14" />
              <line x1="12" y1="14" x2="12" y2="14" />
              <line x1="16" y1="14" x2="16" y2="14" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#ffd700" }}>Scheduler</h1>
            <p className="text-xs" style={{ color: "#4a5568" }}>Tasks queued for openclaw</p>
          </div>
        </div>

        {/* Stats + new button */}
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            {running > 0 && (
              <span className="px-2 py-1 rounded" style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.2)" }}>
                {running} running
              </span>
            )}
            {pending > 0 && (
              <span className="px-2 py-1 rounded" style={{ background: "rgba(255,215,0,0.1)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.2)" }}>
                {pending} pending
              </span>
            )}
            {sched > 0 && (
              <span className="px-2 py-1 rounded" style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>
                {sched} scheduled
              </span>
            )}
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all"
            style={{
              background: showForm ? "rgba(30,45,74,0.5)" : "rgba(0,255,136,0.12)",
              color: showForm ? "#94a3b8" : "#00ff88",
              border: `1px solid ${showForm ? "rgba(30,45,74,0.7)" : "rgba(0,255,136,0.3)"}`,
            }}
          >
            {showForm ? "✕ Cancel" : "+ New Task"}
          </button>
        </div>
      </div>

      {/* New task form */}
      {showForm && (
        <NewTaskForm
          workspaces={workspaces}
          onCreated={() => { setShowForm(false); fetchTasks(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "#1e2d4a" }}>
        {(["active", "completed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium transition-colors relative"
            style={{
              color: tab === t ? "#e2e8f0" : "#4a5568",
              borderBottom: tab === t ? "2px solid #ffd700" : "2px solid transparent",
            }}
          >
            {t === "active" ? `Active (${active.length})` : `Completed (${completed.length})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse" style={{ height: 100 }} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(tab === "active" ? active : completed).length === 0 ? (
            <div
              className="card flex flex-col items-center justify-center py-16 gap-3"
              style={{ color: "#4a5568" }}
            >
              <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <div className="text-sm">
                {tab === "active" ? "No active tasks — create one above" : "No completed tasks yet"}
              </div>
            </div>
          ) : (
            (tab === "active" ? active : completed)
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDelete={() => deleteTask(task.id)}
                  onViewReport={() => setReport(task)}
                  onRequeue={() => requeueTask(task.id)}
                />
              ))
          )}
        </div>
      )}

      {/* Report modal */}
      {report && <ReportModal task={report} onClose={() => setReport(null)} />}
    </div>
  );
}
