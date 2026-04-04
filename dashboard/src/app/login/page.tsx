"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
    // If already authed or auth disabled, go to dashboard
    fetch("/api/auth/check").then(async (res) => {
      if (res.ok) router.replace(nextPath);
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const nextPath = new URLSearchParams(window.location.search).get("next") || "/";
        router.replace(nextPath);
      } else {
        const d = await res.json();
        setError(d.error ?? "Invalid credentials");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0e1a" }}>
        <span
          className="spinner w-8 h-8"
          style={{ border: "2px solid rgba(0,255,136,0.15)", borderTopColor: "#00ff88" }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#0a0e1a" }}>
      <div className="w-full max-w-sm flex flex-col gap-6 fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)" }}
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <title>Login</title>
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: "#00ff88" }}>
              VPS<span style={{ color: "#00d4ff" }}>DEV</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: "#4a5568" }}>Sign in to continue</div>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={submit}
          className="flex flex-col gap-4 p-6 rounded-xl"
          style={{ background: "#0f1629", border: "1px solid #1e2d4a" }}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-xs" htmlFor="username" style={{ color: "#4a5568" }}>Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "rgba(10,14,26,0.8)",
                border: "1px solid rgba(30,45,74,0.8)",
                color: "#e2e8f0",
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs" htmlFor="password" style={{ color: "#4a5568" }}>Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: "rgba(10,14,26,0.8)",
                border: "1px solid rgba(30,45,74,0.8)",
                color: "#e2e8f0",
              }}
            />
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded" style={{ background: "rgba(255,68,68,0.1)", color: "#ff4444", border: "1px solid rgba(255,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              background: loading ? "rgba(30,45,74,0.5)" : "rgba(0,255,136,0.15)",
              color: loading ? "#4a5568" : "#00ff88",
              border: "1px solid rgba(0,255,136,0.3)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="spinner w-4 h-4 inline-block" style={{ border: "2px solid rgba(0,255,136,0.2)", borderTopColor: "#00ff88" }} />
              </span>
            ) : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
