"use client";

import { useState } from "react";
import { PortInfo } from "../page";

interface Props {
  ports: PortInfo[];
  loading: boolean;
  publicIp: string;
  onExpose: (port: PortInfo) => void;
  defaultCollapsed?: boolean;
}

const WELL_KNOWN: Record<number, string> = {
  21: "FTP",
  22: "SSH",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  443: "HTTPS",
  3000: "Dev Server",
  3306: "MySQL",
  5432: "PostgreSQL",
  5672: "RabbitMQ",
  6379: "Redis",
  7681: "ttyd",
  8000: "Dev Server",
  8080: "HTTP Alt",
  8443: "HTTPS Alt",
  9200: "Elasticsearch",
  27017: "MongoDB",
};

function getPortTag(port: number): string | null {
  return WELL_KNOWN[port] ?? null;
}

function PortBadge({ port }: { port: number }) {
  const tag = getPortTag(port);
  if (!tag) return null;
  return (
    <span
      className="badge ml-1"
      style={{
        background: "rgba(255, 215, 0, 0.08)",
        color: "#ffd700",
        border: "1px solid rgba(255, 215, 0, 0.2)",
        fontSize: "0.6rem",
      }}
    >
      {tag}
    </span>
  );
}

type SortKey = "port" | "processName" | "matchedSession";
type SortDir = "asc" | "desc";

export default function PortsPanel({
  ports,
  loading,
  publicIp,
  onExpose,
  defaultCollapsed = false,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("port");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterText, setFilterText] = useState("");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = ports.filter((p) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      String(p.port).includes(q) ||
      p.processName.toLowerCase().includes(q) ||
      (p.matchedSession ?? "").toLowerCase().includes(q) ||
      (p.matchedWindow ?? "").toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "port") cmp = a.port - b.port;
    else if (sortKey === "processName")
      cmp = a.processName.localeCompare(b.processName);
    else if (sortKey === "matchedSession")
      cmp = (a.matchedSession ?? "").localeCompare(b.matchedSession ?? "");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortIndicator = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) {
      return (
        <svg className="w-3 h-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      );
    }
    return (
      <svg
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ color: "#00d4ff" }}
      >
        {sortDir === "asc" ? (
          <path d="M12 19V5M5 12l7-7 7 7" />
        ) : (
          <path d="M12 5v14M19 12l-7 7-7-7" />
        )}
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            style={{ color: "#00d4ff" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#00d4ff" }}>
            Listening Ports
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="badge"
            style={{
              background: "rgba(0, 212, 255, 0.1)",
              color: "#00d4ff",
              border: "1px solid rgba(0, 212, 255, 0.2)",
            }}
          >
            {loading ? "…" : sorted.length}
          </span>
          {/* Filter input — only shown when expanded */}
          {!collapsed && (
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3"
                style={{ color: "#4a5568" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Filter..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-7 pr-3 py-1 rounded text-xs outline-none transition-colors w-28 focus:w-40"
                style={{
                  background: "rgba(30, 45, 74, 0.5)",
                  border: "1px solid rgba(30, 45, 74, 0.8)",
                  color: "#e2e8f0",
                  transitionProperty: "width",
                  transitionDuration: "200ms",
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "rgba(30, 45, 74, 0.8)")
                }
              />
            </div>
          )}
          {/* Collapse / expand toggle */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center justify-center w-6 h-6 rounded transition-colors"
            style={{
              background: "rgba(30, 45, 74, 0.4)",
              border: "1px solid rgba(30, 45, 74, 0.8)",
              color: "#4a5568",
            }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table — hidden when collapsed */}
      {!collapsed && <div className="card overflow-hidden">
        {loading ? (
          <div className="animate-pulse p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-4 rounded w-12" style={{ background: "#1e2d4a" }} />
                <div className="h-4 rounded w-20" style={{ background: "#1e2d4a" }} />
                <div className="h-4 rounded w-10" style={{ background: "#1e2d4a" }} />
                <div className="h-4 rounded flex-1" style={{ background: "#1e2d4a" }} />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3"
            style={{ color: "#4a5568" }}
          >
            <svg
              className="w-10 h-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div className="text-sm">
              {filterText ? "No ports match your filter" : "No listening ports found"}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort("port")}
                      style={{ color: sortKey === "port" ? "#00d4ff" : undefined }}
                    >
                      Port <SortIndicator k="port" />
                    </button>
                  </th>
                  <th>
                    <button
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort("processName")}
                      style={{ color: sortKey === "processName" ? "#00d4ff" : undefined }}
                    >
                      Process <SortIndicator k="processName" />
                    </button>
                  </th>
                  <th>PID</th>
                  <th>
                    <button
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                      onClick={() => handleSort("matchedSession")}
                      style={{ color: sortKey === "matchedSession" ? "#00d4ff" : undefined }}
                    >
                      Session <SortIndicator k="matchedSession" />
                    </button>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <PortRow
                    key={p.port}
                    port={p}
                    publicIp={publicIp}
                    onExpose={onExpose}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  );
}

function PortRow({
  port,
  publicIp,
  onExpose,
}: {
  port: PortInfo;
  publicIp: string;
  onExpose: (p: PortInfo) => void;
}) {
  const isSystemPort = port.port < 1024;

  return (
    <tr>
      {/* Port */}
      <td>
        <div className="flex items-center flex-wrap gap-1">
          <span
            className="font-mono font-semibold"
            style={{ color: isSystemPort ? "#ffd700" : "#00d4ff" }}
          >
            {port.port}
          </span>
          <PortBadge port={port.port} />
        </div>
      </td>

      {/* Process */}
      <td>
        <div className="flex items-center gap-1.5">
          <svg
            className="w-3 h-3 flex-shrink-0"
            style={{ color: "#4a5568" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          </svg>
          <span
            className="font-mono text-xs"
            style={{ color: "#e2e8f0" }}
          >
            {port.processName}
          </span>
        </div>
      </td>

      {/* PID */}
      <td>
        <span
          className="font-mono text-xs"
          style={{ color: "#94a3b8" }}
        >
          {port.pid ?? "—"}
        </span>
      </td>

      {/* Session match */}
      <td>
        {port.matchedSession ? (
          <div className="flex flex-col gap-0.5">
            <span
              className="badge"
              style={{
                background: "rgba(0, 255, 136, 0.1)",
                color: "#00ff88",
                border: "1px solid rgba(0, 255, 136, 0.2)",
              }}
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              </svg>
              {port.matchedSession}
            </span>
            {port.matchedWindow && (
              <span
                className="text-xs"
                style={{ color: "#94a3b8" }}
              >
                /{port.matchedWindow}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs" style={{ color: "#2e4a7a" }}>
            —
          </span>
        )}
      </td>

      {/* Action */}
      <td>
        <button
          onClick={() => onExpose(port)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
          style={{
            background: "rgba(0, 212, 255, 0.08)",
            border: "1px solid rgba(0, 212, 255, 0.2)",
            color: "#00d4ff",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0, 212, 255, 0.18)";
            e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0, 212, 255, 0.08)";
            e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.2)";
          }}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Expose
        </button>
      </td>
    </tr>
  );
}
