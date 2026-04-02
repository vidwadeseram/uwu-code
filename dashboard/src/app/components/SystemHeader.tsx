"use client";

import { SystemData } from "../page";

interface Props {
  data: SystemData | null;
  loading: boolean;
  lastRefresh: Date | null;
  refreshing: boolean;
  onRefresh: () => void;
}

function StatCard({
  label,
  value,
  sub,
  accentColor = "#00d4ff",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="card card-hover flex items-start gap-3 p-4"
      style={{ flex: "1 1 150px" }}
    >
      <div
        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
        style={{
          background: `rgba(${accentColor === "#00ff88" ? "0,255,136" : accentColor === "#ffd700" ? "255,215,0" : accentColor === "#ff4444" ? "255,68,68" : "0,212,255"}, 0.1)`,
          border: `1px solid ${accentColor}30`,
        }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#4a5568" }}>
          {label}
        </div>
        <div className="text-sm font-semibold truncate" style={{ color: accentColor }}>
          {value}
        </div>
        {sub && (
          <div className="text-xs truncate mt-0.5" style={{ color: "#94a3b8" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function MemoryBar({ percent }: { percent: number }) {
  const color =
    percent > 90 ? "#ff4444" : percent > 70 ? "#ffd700" : "#00ff88";
  return (
    <div className="w-full rounded-full h-1.5 mt-1" style={{ background: "#1e2d4a" }}>
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${percent}%`, background: color }}
      />
    </div>
  );
}

export default function SystemHeader({
  data,
  loading,
  lastRefresh,
  refreshing,
  onRefresh,
}: Props) {
  const skeletonClass = "animate-pulse rounded" as const;
  const skeletonStyle = { background: "#1e2d4a" };

  const formatRefresh = (d: Date) => {
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      {/* Top bar: hostname + refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full pulse-dot"
              style={{ background: "#00ff88" }}
            />
            <span className="text-sm font-semibold" style={{ color: "#00ff88" }}>
              {loading ? (
                <span
                  className={skeletonClass}
                  style={{ ...skeletonStyle, display: "inline-block", width: 100, height: 14 }}
                />
              ) : (
                data?.hostname ?? "—"
              )}
            </span>
          </div>
          {data?.publicIp && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: "rgba(0, 212, 255, 0.1)",
                border: "1px solid rgba(0, 212, 255, 0.2)",
                color: "#00d4ff",
              }}
            >
              {data.publicIp}
            </span>
          )}
          {data?.platform && (
            <span className="text-xs hidden sm:inline" style={{ color: "#4a5568" }}>
              {data.platform}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
          {lastRefresh && (
            <span className="text-xs hidden sm:block" style={{ color: "#4a5568" }}>
              Updated {formatRefresh(lastRefresh)}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all min-h-[38px]"
            style={{
              background: refreshing
                ? "rgba(30, 45, 74, 0.5)"
                : "rgba(0, 212, 255, 0.1)",
              border: "1px solid rgba(0, 212, 255, 0.2)",
              color: refreshing ? "#4a5568" : "#00d4ff",
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="flex flex-wrap gap-3">
        {/* Uptime */}
        <StatCard
          label="Uptime"
          value={loading ? "—" : data?.uptime ?? "—"}
          accentColor="#00ff88"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />

        {/* Load Avg */}
        <StatCard
          label="Load Avg"
          value={loading ? "—" : data?.loadAvg ?? "—"}
          sub="1m, 5m, 15m"
          accentColor="#00d4ff"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
        />

        {/* CPU */}
        <StatCard
          label="CPU"
          value={loading ? "—" : `${data?.cpu.count ?? "?"} cores`}
          sub={data?.cpu.model ? data.cpu.model.slice(0, 30) + (data.cpu.model.length > 30 ? "…" : "") : undefined}
          accentColor="#ffd700"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <rect x="9" y="9" width="6" height="6" />
              <line x1="9" y1="1" x2="9" y2="4" />
              <line x1="15" y1="1" x2="15" y2="4" />
              <line x1="9" y1="20" x2="9" y2="23" />
              <line x1="15" y1="20" x2="15" y2="23" />
              <line x1="20" y1="9" x2="23" y2="9" />
              <line x1="20" y1="14" x2="23" y2="14" />
              <line x1="1" y1="9" x2="4" y2="9" />
              <line x1="1" y1="14" x2="4" y2="14" />
            </svg>
          }
        />

        {/* Memory */}
        <div
          className="card card-hover flex items-start gap-3 p-4"
          style={{ flex: "1 1 180px" }}
        >
          <div
            className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(255, 68, 68, 0.1)",
              border: "1px solid rgba(255, 68, 68, 0.3)",
            }}
          >
            <svg className="w-4 h-4" style={{ color: "#ff4444" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "#4a5568" }}>
              Memory
            </div>
            {loading ? (
              <div className={skeletonClass} style={{ ...skeletonStyle, height: 14, width: 80 }} />
            ) : data?.memory ? (
              <>
                <div className="text-sm font-semibold" style={{ color: data.memory.percent > 90 ? "#ff4444" : data.memory.percent > 70 ? "#ffd700" : "#00ff88" }}>
                  {data.memory.percent}% used
                </div>
                <MemoryBar percent={data.memory.percent} />
                <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>
                  {data.memory.used} / {data.memory.total} MB
                </div>
              </>
            ) : (
              <div className="text-sm" style={{ color: "#4a5568" }}>—</div>
            )}
          </div>
        </div>

        {/* Disk */}
        <StatCard
          label="Disk (root)"
          value={loading ? "—" : data?.disk ?? "—"}
          accentColor="#00d4ff"
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
