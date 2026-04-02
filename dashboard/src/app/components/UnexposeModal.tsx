"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  port: number;
  result: { success: boolean; message: string } | null;
  loading: boolean;
  publicIp: string;
  onClose: () => void;
  onUnexpose: () => void;
}

export default function UnexposeModal({
  port,
  result,
  loading,
  publicIp,
  onClose,
  onUnexpose,
}: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10, 14, 26, 0.85)" }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="card w-full max-w-md animate-fade-in"
        style={{
          border: "1px solid rgba(168, 85, 247, 0.35)",
          boxShadow: "0 0 40px rgba(168,85,247,0.1), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-4"
          style={{ borderBottom: "1px solid #1e2d4a" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{
                background: "rgba(168, 85, 247, 0.12)",
                border: "1px solid rgba(168, 85, 247, 0.3)",
              }}
            >
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                Stop Port Exposure
              </h3>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                port {port}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors"
            style={{ color: "#4a5568" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-4 sm:px-5 py-5 space-y-4">
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: "rgba(30, 45, 74, 0.4)", border: "1px solid #1e2d4a" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs">
              <span style={{ color: "#94a3b8" }}>Removing rule</span>
              <span className="font-mono font-semibold break-all" style={{ color: "#a855f7" }}>
                ufw delete allow {port}/tcp
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs">
              <span style={{ color: "#94a3b8" }}>Public URL</span>
              <span className="font-mono text-xs break-all" style={{ color: "#94a3b8" }}>
                http://{publicIp}:{port}
              </span>
            </div>
          </div>

          {result && (
            <div
              className="rounded-lg px-3 py-2.5 text-xs space-y-1"
              style={{
                background: result.success
                  ? "rgba(0, 255, 136, 0.07)"
                  : "rgba(255, 215, 0, 0.07)",
                border: `1px solid ${result.success ? "rgba(0, 255, 136, 0.2)" : "rgba(255, 215, 0, 0.2)"}`,
              }}
            >
              <div
                className="flex items-center gap-1.5 font-medium"
                style={{ color: result.success ? "#00ff88" : "#ffd700" }}
              >
                {result.success ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {result.success ? "Exposure removed" : "Warning"}
              </div>
              <p style={{ color: "#94a3b8" }}>{result.message}</p>
            </div>
          )}
        </div>

        <div
          className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4"
          style={{ borderTop: "1px solid #1e2d4a" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-sm transition-colors"
            style={{
              background: "rgba(30, 45, 74, 0.5)",
              border: "1px solid rgba(30, 45, 74, 0.8)",
              color: "#94a3b8",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            Close
          </button>

          {!result && (
            <button
              type="button"
              onClick={onUnexpose}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
              style={{
                background: loading
                  ? "rgba(168, 85, 247, 0.1)"
                  : "linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(255,68,68,0.15) 100%)",
                border: "1px solid rgba(168, 85, 247, 0.4)",
                color: loading ? "#4a5568" : "#e2e8f0",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-9-9" />
                  </svg>
                  Removing rule…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  Stop Exposure
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
