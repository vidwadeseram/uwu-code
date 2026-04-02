"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentStatus {
  state: "idle" | "running" | "stopped" | "error";
  current_task_id?: string | null;
  message?: string;
  updated_at?: string | null;
  pid?: number | null;
}

interface Task {
  id: string;
  title: string;
  type: "coding" | "research";
  description: string;
  workspace?: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso?: string | null) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 5)  return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

const STATE_COLOR: Record<string, string> = {
  idle:    "#00ff88",
  running: "#00d4ff",
  stopped: "#4a5568",
  error:   "#ff4444",
};

const STATE_BG: Record<string, string> = {
  idle:    "rgba(0,255,136,0.08)",
  running: "rgba(0,212,255,0.08)",
  stopped: "rgba(74,85,104,0.15)",
  error:   "rgba(255,68,68,0.08)",
};

// ── Log Viewer ────────────────────────────────────────────────────────────────

function LogViewer({ lines }: { lines: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div
      className="flex flex-col h-full overflow-auto font-mono text-xs leading-relaxed p-4"
      style={{ color: "#94a3b8" }}
    >
      {lines.length === 0 ? (
        <div className="text-center py-8" style={{ color: "#1e2d4a" }}>
          No log entries yet — agent will log activity here
        </div>
      ) : (
        lines.map((line, i) => {
          const isError = /error|fail|exception/i.test(line);
          const isSuccess = /complet|success/i.test(line);
          const isWarn = /rate.limit|reschedul|warn/i.test(line);
          const isStart = /starting|started/i.test(line);
          return (
            <div
              key={i}
              style={{
                color: isError ? "#ff4444"
                  : isSuccess ? "#00ff88"
                  : isWarn    ? "#a855f7"
                  : isStart   ? "#00d4ff"
                  : "#94a3b8",
              }}
            >
              {line}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OpenClawPage() {
  const [status, setStatus]     = useState<AgentStatus>({ state: "stopped" });
  const [logs, setLogs]         = useState<string[]>([]);
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchAll = useCallback(async () => {
    const [statusRes, logsRes, tasksRes] = await Promise.allSettled([
      fetch("/api/openclaw/status"),
      fetch("/api/openclaw/logs?lines=200"),
      fetch("/api/scheduler/tasks"),
    ]);
    if (statusRes.status === "fulfilled" && statusRes.value.ok)
      setStatus(await statusRes.value.json());
    if (logsRes.status === "fulfilled" && logsRes.value.ok)
      setLogs((await logsRes.value.json()).lines ?? []);
    if (tasksRes.status === "fulfilled" && tasksRes.value.ok)
      setTasks((await tasksRes.value.json()).tasks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 3000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const color = STATE_COLOR[status.state] ?? "#94a3b8";
  const bg    = STATE_BG[status.state]    ?? "rgba(30,45,74,0.2)";

  const currentTask = status.current_task_id
    ? tasks.find((t) => t.id === status.current_task_id)
    : null;

  const pending   = tasks.filter((t) => t.status === "pending").length;
  const running   = tasks.filter((t) => t.status === "running").length;
  const done      = tasks.filter((t) => t.status === "completed").length;
  const failed    = tasks.filter((t) => t.status === "failed").length;
  const scheduled = tasks.filter((t) => t.status === "scheduled").length;

  const recentDone = tasks
    .filter((t) => ["completed", "failed"].includes(t.status) && t.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)" }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10" />
            <path d="M12 6v6l4 2" />
            <circle cx="19" cy="5" r="3" fill="#0a0e1a" stroke="#0a0e1a" />
            <path d="M17 5l1.5 1.5L21 3.5" stroke="#00ff88" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#00ff88" }}>OpenClaw</h1>
          <p className="text-xs" style={{ color: "#4a5568" }}>Autonomous task agent · polls every 10s</p>
        </div>
      </div>

      {/* Status + Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Status card */}
        <div
          className="sm:col-span-2 card p-4 flex items-center gap-4"
          style={{ border: `1px solid ${color}30`, background: bg }}
        >
          <div className="relative flex-shrink-0">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: `${color}15`, border: `2px solid ${color}40` }}
            >
              {status.state === "running" ? (
                <span className="w-5 h-5 rounded-full pulse-dot" style={{ background: color }} />
              ) : status.state === "idle" ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              ) : status.state === "error" ? (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-lg font-bold uppercase tracking-wider" style={{ color }}>
              {status.state}
            </div>
            <div className="text-xs truncate" style={{ color: "#4a5568" }}>
              {status.pid ? `PID ${status.pid} · ` : ""}
              updated {timeAgo(status.updated_at)}
            </div>
            {status.message && (
              <div className="text-xs mt-1 truncate" style={{ color: "#94a3b8" }}>
                {status.message}
              </div>
            )}
          </div>
        </div>

        {/* Stat tiles */}
        {[
          { label: "Pending",   value: pending,   color: "#ffd700" },
          { label: "Running",   value: running,   color: "#00d4ff" },
          { label: "Scheduled", value: scheduled, color: "#a855f7" },
          { label: "Completed", value: done,      color: "#00ff88" },
          { label: "Failed",    value: failed,    color: "#ff4444" },
        ].map(({ label, value, color: c }) => (
          <div key={label} className="card p-4 flex flex-col items-center justify-center gap-1">
            <div className="text-2xl font-bold" style={{ color: c }}>{value}</div>
            <div className="text-xs" style={{ color: "#4a5568" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Current task */}
      {currentTask && (
        <div
          className="card p-4 flex items-start gap-4"
          style={{ border: "1px solid rgba(0,212,255,0.25)" }}
        >
          <div className="flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full pulse-dot block" style={{ background: "#00d4ff" }} />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00d4ff" }}>
              Currently Processing
            </div>
            <div className="font-semibold text-sm" style={{ color: "#e2e8f0" }}>{currentTask.title}</div>
            <div className="text-xs line-clamp-2" style={{ color: "#94a3b8" }}>{currentTask.description}</div>
            <div className="flex gap-3 text-xs mt-1" style={{ color: "#4a5568" }}>
              <span>type: <span style={{ color: currentTask.type === "coding" ? "#00d4ff" : "#a855f7" }}>{currentTask.type}</span></span>
              {currentTask.workspace && (
                <span className="font-mono">📁 {currentTask.workspace.split("/").slice(-2).join("/")}</span>
              )}
              {currentTask.started_at && <span>started {timeAgo(currentTask.started_at)}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Main content: log + recent tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[420px] lg:h-[480px]">
        {/* Log viewer */}
        <div
          className="lg:col-span-3 card overflow-hidden flex flex-col"
          style={{ border: "1px solid #1e2d4a" }}
        >
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
            style={{ borderColor: "#1e2d4a" }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "#00ff88" }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00ff88" }}>
                Agent Log
              </span>
            </div>
            <span className="text-xs" style={{ color: "#4a5568" }}>{logs.length} lines</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: "#1e2d4a" }}>
                Loading…
              </div>
            ) : (
              <LogViewer lines={logs} />
            )}
          </div>
        </div>

        {/* Recent tasks */}
        <div
          className="lg:col-span-2 card overflow-hidden flex flex-col"
          style={{ border: "1px solid #1e2d4a" }}
        >
          <div
            className="px-4 py-2.5 border-b flex-shrink-0"
            style={{ borderColor: "#1e2d4a" }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              Recently Finished
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            {recentDone.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs" style={{ color: "#1e2d4a" }}>
                No completed tasks yet
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "#1e2d4a" }}>
                {recentDone.map((task) => (
                  <div key={task.id} className="px-4 py-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: task.status === "completed" ? "#00ff88" : "#ff4444" }}
                      />
                      <span className="text-xs font-medium truncate" style={{ color: "#e2e8f0" }}>
                        {task.title}
                      </span>
                    </div>
                    <div className="text-xs line-clamp-1" style={{ color: "#4a5568" }}>
                      {task.description}
                    </div>
                    <div className="flex gap-2 text-xs" style={{ color: "#2e4a7a" }}>
                      <span>{task.type}</span>
                      <span>{timeAgo(task.completed_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div
        className="text-xs px-4 py-3 rounded-lg"
        style={{ background: "rgba(30,45,74,0.3)", border: "1px solid #1e2d4a", color: "#4a5568" }}
      >
        <span style={{ color: "#94a3b8" }}>openclaw</span> picks up tasks from the scheduler automatically.
        Coding tasks run <span style={{ color: "#ffd700" }}>opencode</span> or{" "}
        <span style={{ color: "#00d4ff" }}>claude code</span> in your workspace.
        Research tasks use the <span style={{ color: "#a855f7" }}>Anthropic / OpenAI API</span> directly.
        Rate-limited tasks are auto-rescheduled{" "}
        <span style={{ color: "#a855f7" }}>1 hour forward</span>.
        Manage tasks via the{" "}
        <a href="/scheduler" style={{ color: "#00d4ff", textDecoration: "underline" }}>Scheduler</a>.
      </div>
    </div>
  );
}
