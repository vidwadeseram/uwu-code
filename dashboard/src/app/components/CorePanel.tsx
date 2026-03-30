"use client";

import { useState } from "react";
import { CoreData } from "../page";

interface Props {
  data: CoreData | null;
  defaultCollapsed?: boolean;
  children?: React.ReactNode;
}

function StatusDot({ active, status }: { active: boolean; status: string }) {
  const color =
    active
      ? "#00ff88"
      : status === "unknown" || status === ""
      ? "#ffd700"
      : "#ff4444";
  return (
    <span
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{
        background: color,
        boxShadow: active ? `0 0 6px ${color}` : "none",
      }}
    />
  );
}

export default function CorePanel({
  data,
  defaultCollapsed = false,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className="card overflow-hidden"
      style={{ borderLeft: "3px solid #00ff88" }}
    >
      {/* Panel header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
        onClick={() => setCollapsed((v) => !v)}
      >
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
          <h2
            className="text-sm font-semibold uppercase tracking-widest"
            style={{ color: "#00ff88" }}
          >
            Core
          </h2>
          {data && (
            <span
              className="badge"
              style={{
                background: "rgba(0, 255, 136, 0.1)",
                color: "#00ff88",
                border: "1px solid rgba(0, 255, 136, 0.2)",
              }}
            >
              {data.services.filter((s) => s.active).length}/
              {data.services.length} active
            </span>
          )}
        </div>
        <svg
          className="w-4 h-4 transition-transform"
          style={{
            color: "#4a5568",
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
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
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {data === null ? (
            /* Loading skeleton */
            <div className="animate-pulse space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded"
                    style={{ background: "#1e2d4a" }}
                  />
                ))}
              </div>
              <div className="h-24 rounded" style={{ background: "#1e2d4a" }} />
            </div>
          ) : (
            <>
              {/* System Services */}
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#4a5568" }}
                >
                  System Services
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {data.services.map((svc) => (
                    <div
                      key={svc.name}
                      className="flex items-center gap-2.5 px-3 py-2 rounded"
                      style={{
                        background: svc.active
                          ? "rgba(0, 255, 136, 0.05)"
                          : "rgba(30, 45, 74, 0.4)",
                        border: `1px solid ${
                          svc.active
                            ? "rgba(0, 255, 136, 0.15)"
                            : "rgba(30, 45, 74, 0.6)"
                        }`,
                      }}
                    >
                      <StatusDot active={svc.active} status={svc.status} />
                      <span
                        className="font-mono text-xs font-medium flex-1 truncate"
                        style={{ color: svc.active ? "#e2e8f0" : "#94a3b8" }}
                      >
                        {svc.name}
                      </span>
                      <span
                        className="text-xs"
                        style={{
                          color: svc.active
                            ? "#00ff88"
                            : svc.status === "unknown" || svc.status === ""
                            ? "#ffd700"
                            : "#ff4444",
                        }}
                      >
                        {svc.status || "unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Docker Containers */}
              <div>
                <h3
                  className="text-xs font-semibold uppercase tracking-widest mb-2"
                  style={{ color: "#4a5568" }}
                >
                  Docker Containers
                  <span
                    className="badge ml-2"
                    style={{
                      background: "rgba(0, 212, 255, 0.1)",
                      color: "#00d4ff",
                      border: "1px solid rgba(0, 212, 255, 0.2)",
                      verticalAlign: "middle",
                    }}
                  >
                    {data.containers.length}
                  </span>
                </h3>
                {data.containers.length === 0 ? (
                  <div
                    className="text-xs py-4 text-center"
                    style={{ color: "#4a5568" }}
                  >
                    No running containers
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded" style={{ border: "1px solid rgba(30, 45, 74, 0.8)" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Ports</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.containers.map((c, idx) => (
                          <tr key={idx}>
                            <td>
                              <span
                                className="font-mono text-xs font-medium"
                                style={{ color: "#00d4ff" }}
                              >
                                {c.name}
                              </span>
                            </td>
                            <td>
                              <span
                                className="text-xs"
                                style={{ color: "#00ff88" }}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td>
                              <span
                                className="font-mono text-xs"
                                style={{ color: "#94a3b8" }}
                                title={c.ports}
                              >
                                {c.ports
                                  ? c.ports.length > 50
                                    ? c.ports.slice(0, 50) + "…"
                                    : c.ports
                                  : "—"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {children && (
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: "#4a5568" }}
                  >
                    Server
                  </h3>
                  {children}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
