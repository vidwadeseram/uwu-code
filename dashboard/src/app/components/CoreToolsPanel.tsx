"use client";

import { useState, useMemo } from "react";
import { PortInfo } from "../page";

interface Props {
  ports: PortInfo[];
  loading: boolean;
}

type SortKey = "port" | "processName" | "matchedSession";
type SortDir = "asc" | "desc";

const WELL_KNOWN: Record<number, string> = {
  21: "FTP", 22: "SSH", 25: "SMTP", 53: "DNS", 80: "HTTP",
  443: "HTTPS", 3000: "Dev", 3306: "MySQL", 5432: "PostgreSQL",
  6379: "Redis", 7681: "ttyd", 8080: "HTTP Alt", 8443: "HTTPS Alt",
  9200: "Elasticsearch", 27017: "MongoDB",
};

function PortBadge({ port }: { port: number }) {
  const tag = WELL_KNOWN[port];
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

export default function CoreToolsPanel({
  ports,
  loading,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("port");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    if (!filterText) return ports;
    const q = filterText.toLowerCase();
    return ports.filter(
      (p) =>
        String(p.port).includes(q) ||
        p.processName.toLowerCase().includes(q) ||
        (p.matchedSession ?? "").toLowerCase().includes(q),
    );
  }, [ports, filterText]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "port") cmp = a.port - b.port;
      else if (sortKey === "processName") cmp = a.processName.localeCompare(b.processName);
      else cmp = (a.matchedSession ?? "").localeCompare(b.matchedSession ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const SortIndicator = ({ k }: { k: SortKey }) => (
    <svg className="w-3 h-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );


  return (
    <div
      className="card overflow-hidden"
      style={{ borderLeft: "3px solid #a855f7" }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            style={{ color: "#a855f7" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "#a855f7" }}>
            Core Tools
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 transition-transform"
            style={{
              color: "#4a5568",
              transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#4a5568" }}>
                Listening Ports
              </h3>
              <div className="relative w-full sm:w-auto">
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
                  placeholder="Filter…"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="pl-7 pr-3 py-1 rounded text-xs outline-none"
                  style={{
                    background: "rgba(30, 45, 74, 0.5)",
                    border: "1px solid rgba(30, 45, 74, 0.8)",
                    color: "var(--text)",
                    width: "100%",
                    maxWidth: "160px",
                    transitionProperty: "width",
                    transitionDuration: "200ms",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(168, 85, 247, 0.4)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(30, 45, 74, 0.8)")}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded" style={{ border: "1px solid rgba(30, 45, 74, 0.8)" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                        onClick={() => handleSort("port")}
                        style={{ color: sortKey === "port" ? "#a855f7" : undefined }}
                      >
                        Port <SortIndicator k="port" />
                      </button>
                    </th>
                    <th>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                        onClick={() => handleSort("processName")}
                        style={{ color: sortKey === "processName" ? "#a855f7" : undefined }}
                      >
                        Process <SortIndicator k="processName" />
                      </button>
                    </th>
                    <th className="hidden sm:table-cell">PID</th>
                    <th className="hidden md:table-cell">
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                        onClick={() => handleSort("matchedSession")}
                        style={{ color: sortKey === "matchedSession" ? "#a855f7" : undefined }}
                      >
                        Session <SortIndicator k="matchedSession" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.port}>
                      <td>
                        <div className="flex items-center gap-1">
                          <span
                            className="font-mono font-semibold text-sm"
                            style={{ color: p.port < 1024 ? "#ffd700" : "#00d4ff" }}
                          >
                            {p.port}
                          </span>
                          <PortBadge port={p.port} />
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs" style={{ color: "var(--text)" }}>
                          {p.processName}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="font-mono text-xs" style={{ color: "var(--dim)" }}>
                          {p.pid ?? "—"}
                        </span>
                      </td>
                      <td className="hidden md:table-cell">
                        {p.matchedSession ? (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(0, 255, 136, 0.1)",
                              color: "#00ff88",
                              border: "1px solid rgba(0, 255, 136, 0.2)",
                            }}
                          >
                            {p.matchedSession}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#2e4a7a" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
