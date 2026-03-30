"use client";

import { useState } from "react";
import { PortInfo, TmuxSession, TmuxWindow } from "../page";

interface Props {
  sessions: TmuxSession[];
  ports: PortInfo[];
  loading: boolean;
  onExpose: (port: PortInfo) => void;
}

function formatAge(created: number): string {
  if (!created) return "";
  const ageMs = Date.now() - created * 1000;
  const ageS = Math.floor(ageMs / 1000);
  if (ageS < 60) return `${ageS}s`;
  const ageM = Math.floor(ageS / 60);
  if (ageM < 60) return `${ageM}m`;
  const ageH = Math.floor(ageM / 60);
  if (ageH < 24) return `${ageH}h`;
  const ageD = Math.floor(ageH / 24);
  return `${ageD}d`;
}

function truncateCwd(cwd: string, maxLen = 40): string {
  if (!cwd) return "";
  if (cwd.length <= maxLen) return cwd;
  // Keep last part of path
  const parts = cwd.split("/");
  let result = "…/" + parts[parts.length - 1];
  for (let i = parts.length - 2; i > 0; i--) {
    const candidate = "…/" + parts.slice(i).join("/");
    if (candidate.length <= maxLen) result = candidate;
    else break;
  }
  return result;
}

function getPortsForSession(
  ports: PortInfo[],
  sessionName: string
): PortInfo[] {
  return ports.filter((p) => p.matchedSession === sessionName);
}

function getPortsForWindow(
  ports: PortInfo[],
  sessionName: string,
  windowName: string
): PortInfo[] {
  return ports.filter(
    (p) => p.matchedSession === sessionName && p.matchedWindow === windowName
  );
}

function WindowRow({
  window,
  sessionName,
  ports,
  onExpose,
}: {
  window: TmuxWindow;
  sessionName: string;
  ports: PortInfo[];
  onExpose: (port: PortInfo) => void;
}) {
  const [exposePort, setExposePort] = useState("");
  const [showExposeInput, setShowExposeInput] = useState(false);
  const matchedPorts = getPortsForWindow(ports, sessionName, window.windowName);

  function handleManualExpose() {
    const p = parseInt(exposePort, 10);
    if (!p) return;
    onExpose({ port: p, processName: window.windowName, pid: window.panePid ?? 0, matchedSession: sessionName, matchedWindow: window.windowName } as PortInfo);
    setShowExposeInput(false);
    setExposePort("");
  }

  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5 rounded transition-colors"
      style={{
        background: window.active
          ? "rgba(0, 255, 136, 0.05)"
          : "rgba(30, 45, 74, 0.2)",
        border: `1px solid ${window.active ? "rgba(0, 255, 136, 0.15)" : "rgba(30, 45, 74, 0.4)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Window index */}
          <span
            className="text-xs w-5 h-5 flex items-center justify-center rounded flex-shrink-0"
            style={{
              background: window.active
                ? "rgba(0, 255, 136, 0.2)"
                : "rgba(30, 45, 74, 0.6)",
              color: window.active ? "#00ff88" : "#94a3b8",
              fontSize: "0.65rem",
              fontWeight: 700,
            }}
          >
            {window.windowIndex}
          </span>

          {/* Window name */}
          <span
            className="text-sm font-medium truncate"
            style={{ color: window.active ? "#e2e8f0" : "#94a3b8" }}
          >
            {window.windowName}
          </span>

          {/* Active badge */}
          {window.active && (
            <span
              className="badge flex-shrink-0"
              style={{
                background: "rgba(0, 255, 136, 0.1)",
                color: "#00ff88",
                border: "1px solid rgba(0, 255, 136, 0.2)",
              }}
            >
              <span
                className="w-1 h-1 rounded-full pulse-dot"
                style={{ background: "#00ff88" }}
              />
              active
            </span>
          )}
        </div>

        {/* PID */}
        {window.panePid && (
          <span className="text-xs flex-shrink-0" style={{ color: "#4a5568" }}>
            pid:{window.panePid}
          </span>
        )}
      </div>

      {/* CWD */}
      {window.cwd && (
        <div
          className="flex items-center gap-1.5 text-xs"
          style={{ color: "#94a3b8" }}
          title={window.cwd}
        >
          <svg
            className="w-3 h-3 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#4a5568" }}
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span className="font-mono truncate">{truncateCwd(window.cwd)}</span>
        </div>
      )}

      {/* Matched ports + expose buttons */}
      <div className="flex flex-wrap items-center gap-1 mt-0.5">
        {matchedPorts.map((p) => (
          <div key={p.port} className="flex items-center gap-0.5">
            <span
              className="badge"
              style={{
                background: "rgba(0, 212, 255, 0.1)",
                color: "#00d4ff",
                border: "1px solid rgba(0, 212, 255, 0.25)",
              }}
            >
              :{p.port}
            </span>
            <button
              onClick={() => onExpose(p)}
              className="badge transition-colors hover:opacity-80"
              style={{
                background: "rgba(168, 85, 247, 0.1)",
                color: "#a855f7",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                cursor: "pointer",
              }}
              title={`Expose port ${p.port} publicly`}
            >
              Expose
            </button>
          </div>
        ))}

        {/* Manual expose for any port */}
        {!showExposeInput ? (
          <button
            onClick={() => setShowExposeInput(true)}
            className="badge transition-colors hover:opacity-80"
            style={{
              background: "rgba(30, 45, 74, 0.5)",
              color: "#94a3b8",
              border: "1px solid rgba(30, 45, 74, 0.8)",
              cursor: "pointer",
            }}
          >
            + Expose port…
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              type="number"
              value={exposePort}
              onChange={(e) => setExposePort(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleManualExpose(); if (e.key === "Escape") setShowExposeInput(false); }}
              placeholder="port"
              className="px-1.5 py-0.5 rounded text-xs outline-none w-20 font-mono"
              style={{ background: "rgba(10,14,26,0.8)", border: "1px solid rgba(168,85,247,0.4)", color: "#e2e8f0" }}
            />
            <button
              onClick={handleManualExpose}
              className="badge"
              style={{ background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", cursor: "pointer" }}
            >
              Go
            </button>
            <button
              onClick={() => setShowExposeInput(false)}
              className="badge"
              style={{ background: "rgba(30,45,74,0.5)", color: "#94a3b8", border: "1px solid rgba(30,45,74,0.8)", cursor: "pointer" }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  session,
  ports,
  defaultExpanded,
  onExpose,
}: {
  session: TmuxSession;
  ports: PortInfo[];
  defaultExpanded: boolean;
  onExpose: (port: PortInfo) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const sessionPorts = getPortsForSession(ports, session.name);
  const age = formatAge(session.created);

  return (
    <div
      className="card card-hover overflow-hidden"
      style={{
        border: sessionPorts.length > 0 ? "1px solid rgba(0, 212, 255, 0.25)" : undefined,
      }}
    >
      {/* Session header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Collapse indicator */}
          <svg
            className="w-3.5 h-3.5 flex-shrink-0 transition-transform"
            style={{
              color: "#4a5568",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>

          {/* Session icon */}
          <div
            className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(0, 255, 136, 0.1)",
              border: "1px solid rgba(0, 255, 136, 0.2)",
            }}
          >
            <svg
              className="w-3.5 h-3.5"
              style={{ color: "#00ff88" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>

          {/* Session name */}
          <span
            className="font-semibold text-sm truncate"
            style={{ color: "#e2e8f0" }}
          >
            {session.name}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Port count badge */}
          {sessionPorts.length > 0 && (
            <span
              className="badge"
              style={{
                background: "rgba(0, 212, 255, 0.1)",
                color: "#00d4ff",
                border: "1px solid rgba(0, 212, 255, 0.25)",
              }}
            >
              <svg
                className="w-2.5 h-2.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {sessionPorts.length} port{sessionPorts.length !== 1 ? "s" : ""}
            </span>
          )}

          {/* Window count */}
          <span
            className="badge"
            style={{
              background: "rgba(30, 45, 74, 0.6)",
              color: "#94a3b8",
              border: "1px solid rgba(30, 45, 74, 0.8)",
            }}
          >
            {session.windowCount} win
          </span>

          {/* Age */}
          {age && (
            <span className="text-xs" style={{ color: "#4a5568" }}>
              {age}
            </span>
          )}
        </div>
      </button>

      {/* Windows list */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {session.windows.length === 0 ? (
            <div className="text-xs px-2 py-2" style={{ color: "#4a5568" }}>
              No windows
            </div>
          ) : (
            session.windows.map((w) => (
              <WindowRow
                key={w.windowIndex}
                window={w}
                sessionName={session.name}
                ports={ports}
                onExpose={onExpose}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function SessionsPanel({ sessions, ports, loading }: Props) {
  return (
    <div className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            style={{ color: "#00ff88" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#00ff88" }}>
            Tmux Sessions
          </h2>
        </div>
        <span
          className="badge"
          style={{
            background: "rgba(0, 255, 136, 0.1)",
            color: "#00ff88",
            border: "1px solid rgba(0, 255, 136, 0.2)",
          }}
        >
          {loading ? "…" : sessions.length}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="card animate-pulse"
              style={{ height: 64 }}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div
                  className="w-7 h-7 rounded"
                  style={{ background: "#1e2d4a" }}
                />
                <div
                  className="h-4 rounded"
                  style={{ background: "#1e2d4a", width: "40%" }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div
          className="card flex flex-col items-center justify-center py-12 gap-3"
          style={{ color: "#4a5568" }}
        >
          <svg
            className="w-10 h-10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <div className="text-sm">No tmux sessions found</div>
          <div className="text-xs" style={{ color: "#2e4a7a" }}>
            Start a session with{" "}
            <code
              className="px-1.5 py-0.5 rounded"
              style={{ background: "#1e2d4a", color: "#00ff88" }}
            >
              tmux new -s mysession
            </code>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <SessionCard
              key={session.name}
              session={session}
              ports={ports}
              defaultExpanded={i === 0}
              onExpose={onExpose}
            />
          ))}
        </div>
      )}
    </div>
  );
}
