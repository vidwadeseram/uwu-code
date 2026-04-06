"use client";

import { useEffect, useRef, useState } from "react";
import { ExposeResult, PortInfo } from "../page";

interface Props {
  port: PortInfo;
  result: ExposeResult | null;
  loading: boolean;
  publicIp: string;
  onClose: () => void;
  onExpose: () => void;
}

export default function ExposeModal({
  port,
  result,
  loading,
  publicIp,
  onClose,
  onExpose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const previewUrl = result?.url ?? `http://${publicIp}:${port.port}`;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select + copy
      const el = document.createElement("textarea");
      el.value = previewUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      style={{ background: "rgba(10, 14, 26, 0.85)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="card w-full max-w-md animate-fade-in"
        style={{
          border: "1px solid rgba(0, 212, 255, 0.3)",
          boxShadow: "0 0 40px rgba(0, 212, 255, 0.1), 0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{
                background: "rgba(0, 212, 255, 0.1)",
                border: "1px solid rgba(0, 212, 255, 0.3)",
              }}
            >
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
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Expose Port
              </h3>
              <p className="text-xs" style={{ color: "var(--dim)" }}>
                {port.processName} — port {port.port}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "#4a5568" }}
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-5 py-5 space-y-4">
          {/* Port info */}
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: "rgba(30, 45, 74, 0.4)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs">
              <span style={{ color: "var(--dim)" }}>Port</span>
              <span className="font-mono font-semibold" style={{ color: "#00d4ff" }}>
                {port.port}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs">
              <span style={{ color: "var(--dim)" }}>Process</span>
              <span className="font-mono break-all" style={{ color: "var(--text)" }}>
                {port.processName}
                {port.pid ? ` (${port.pid})` : ""}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs">
              <span style={{ color: "var(--dim)" }}>Address</span>
              <span className="font-mono break-all" style={{ color: "var(--text)" }}>
                {port.address}
              </span>
            </div>
            {port.matchedSession && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs">
                <span style={{ color: "var(--dim)" }}>Session</span>
                <span
                  className="font-mono break-all"
                  style={{ color: "#00ff88" }}
                >
                  {port.matchedSession}
                  {port.matchedWindow ? `/${port.matchedWindow}` : ""}
                </span>
              </div>
            )}
          </div>

          {/* Public URL preview */}
          <div>
            <div className="text-xs mb-1.5 uppercase tracking-widest" style={{ color: "#4a5568" }}>
              Public URL
            </div>
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{
                background: "rgba(0, 212, 255, 0.05)",
                border: "1px solid rgba(0, 212, 255, 0.2)",
              }}
            >
              <span
                className="font-mono text-sm flex-1 truncate"
                style={{ color: "#00d4ff" }}
              >
                {previewUrl}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-all flex-shrink-0"
                style={{
                  background: copied ? "rgba(0, 255, 136, 0.15)" : "rgba(0, 212, 255, 0.1)",
                  border: `1px solid ${copied ? "rgba(0, 255, 136, 0.3)" : "rgba(0, 212, 255, 0.2)"}`,
                  color: copied ? "#00ff88" : "#00d4ff",
                }}
              >
                {copied ? (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-6 h-6 rounded transition-colors flex-shrink-0"
                style={{ color: "#4a5568" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#00d4ff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#4a5568")}
                title="Open in new tab"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>

          {/* Result message */}
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
              <div className="flex items-center gap-1.5 font-medium" style={{ color: result.success ? "#00ff88" : "#ffd700" }}>
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
                {result.success ? "Firewall rule added" : "Note"}
              </div>
              <p style={{ color: "var(--dim)" }}>{result.message}</p>
              {result.ufwOutput && (
                <pre
                  className="text-xs mt-1 p-2 rounded overflow-x-auto"
                  style={{
                    background: "rgba(0,0,0,0.3)",
                    color: "#4a5568",
                    maxHeight: 80,
                  }}
                >
                  {result.ufwOutput}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-sm transition-colors"
            style={{
              background: "rgba(30, 45, 74, 0.5)",
              border: "1px solid rgba(30, 45, 74, 0.8)",
              color: "var(--dim)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--dim)")}
          >
            Close
          </button>

          {!result && (
            <button
              type="button"
              onClick={onExpose}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all"
              style={{
                background: loading
                  ? "rgba(0, 212, 255, 0.1)"
                  : "linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,255,136,0.15) 100%)",
                border: "1px solid rgba(0, 212, 255, 0.4)",
                color: loading ? "#4a5568" : "#00d4ff",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Open Firewall (ufw allow {port.port})
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
