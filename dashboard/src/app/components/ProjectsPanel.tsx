"use client";

import React, { useState } from "react";
import { ProjectsData } from "../page";

interface Props {
  data: ProjectsData | null;
  onRefresh: () => void;
}

function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffS = Math.floor(diffMs / 1000);
    if (diffS < 60) return `${diffS}s ago`;
    const diffM = Math.floor(diffS / 60);
    if (diffM < 60) return `${diffM}m ago`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  } catch {
    return "";
  }
}

function truncateUrl(url: string, max = 50): string {
  if (!url) return "";
  if (url.length <= max) return url;
  return url.slice(0, max) + "…";
}

interface CloneFormProps {
  onClose: () => void;
  onCloned: () => void;
  existingNames: string[];
}

function CloneForm({ onClose, onCloned, existingNames }: CloneFormProps) {
  const [url, setUrl] = useState("");
  const [destOption, setDestOption] = useState<string>("");
  const [customDest, setCustomDest] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleClone = async () => {
    if (!url.trim()) {
      setError("Git URL is required.");
      return;
    }
    const repoName = url.trim().replace(/\.git$/, "").split("/").pop() || "repo";
    const folderName = destOption === "__custom__" ? customDest.trim() : destOption || repoName;

    if (destOption === "__custom__" && !customDest.trim()) {
      setError("Folder name is required.");
      return;
    }
    if (destOption && destOption !== "__custom__" && existingNames.includes(destOption)) {
      setError(`Folder "${destOption}" already exists.`);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, gitUrl: url.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message || "Cloned successfully");
        setUrl("");
        setDestOption("");
        setCustomDest("");
        onCloned();
      } else {
        setError(data.message || "Clone failed.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const repoName = url ? url.replace(/\.git$/, "").split("/").pop() || "repo" : "";
  const showCustomInput = destOption === "__custom__";

  return (
    <div
      className="rounded p-3 space-y-2"
      style={{
        background: "rgba(30, 45, 74, 0.4)",
        border: "1px solid rgba(0, 212, 255, 0.2)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: "#00d4ff" }}
        >
          Clone Repository
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs"
          style={{ color: "#4a5568" }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <title>Close</title>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <input
        type="text"
        placeholder="https://github.com/user/repo.git"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full px-3 py-1.5 rounded text-xs outline-none font-mono"
        style={{
          background: "rgba(10, 14, 26, 0.8)",
          border: "1px solid rgba(30, 45, 74, 0.8)",
          color: "var(--text)",
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)")
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = "rgba(30, 45, 74, 0.8)")
        }
      />

      <div className="flex flex-col gap-2">
        <select
          value={destOption}
          onChange={(e) => setDestOption(e.target.value)}
          className="w-full px-3 py-1.5 rounded text-xs outline-none"
          style={{
            background: "rgba(10, 14, 26, 0.8)",
            border: "1px solid rgba(30, 45, 74, 0.8)",
            color: destOption ? "var(--text)" : "#64748b",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(30, 45, 74, 0.8)")
          }
        >
          <option value="">Use repo name{repoName ? ` (${repoName})` : ""}</option>
          <option value="__custom__">Custom folder name...</option>
          {existingNames.length > 0 && (
            <optgroup label="— Existing (will error) —">
              {existingNames.map((name) => (
                <option key={name} value={name} disabled>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {showCustomInput && (
          <input
            type="text"
            placeholder="my-project-name"
            value={customDest}
            onChange={(e) => setCustomDest(e.target.value)}
            className="w-full px-3 py-1.5 rounded text-xs outline-none font-mono"
            style={{
              background: "rgba(10, 14, 26, 0.8)",
              border: "1px solid rgba(0, 212, 255, 0.3)",
              color: "var(--text)",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.5)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.3)")
            }
          />
        )}

        <button
          type="button"
          onClick={handleClone}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
          style={{
            background: loading
              ? "rgba(30, 45, 74, 0.5)"
              : "rgba(0, 212, 255, 0.12)",
            border: "1px solid rgba(0, 212, 255, 0.3)",
            color: loading ? "#4a5568" : "#00d4ff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? (
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <title>Loading</title>
              <path d="M21 12a9 9 0 1 1-9-9" />
            </svg>
          ) : (
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <title>Clone repository</title>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          Clone
        </button>
      </div>

      {error && (
        <div className="text-xs px-2 py-1 rounded" style={{ background: "rgba(255, 68, 68, 0.1)", color: "#ff4444", border: "1px solid rgba(255, 68, 68, 0.2)" }}>
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs px-2 py-1 rounded" style={{ background: "rgba(0, 255, 136, 0.1)", color: "#00ff88", border: "1px solid rgba(0, 255, 136, 0.2)" }}>
          {success}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPanel({ data, onRefresh }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showCloneForm, setShowCloneForm] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoverMsg(null);
    try {
      const res = await fetch("/api/projects/discover");
      const result = await res.json();
      
      if (result.untrackedCount > 0) {
        const paths = result.untracked.map((p: { path: string }) => p.path);
        const importRes = await fetch("/api/projects/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paths }),
        });
        const importResult = await importRes.json();
        
        if (importResult.importedCount > 0) {
          setDiscoverMsg({
            type: "success",
            text: `Imported ${importResult.importedCount} repository${importResult.importedCount > 1 ? "ies" : ""}`,
          });
          onRefresh();
        } else {
          setDiscoverMsg({ type: "error", text: importResult.errors?.[0]?.error || "Import failed" });
        }
      } else {
        setDiscoverMsg({ type: "success", text: "No new repositories found" });
      }
    } catch {
      setDiscoverMsg({ type: "error", text: "Failed to discover repositories" });
    } finally {
      setDiscovering(false);
      setTimeout(() => setDiscoverMsg(null), 4000);
    }
  };

  const handleDeleteProject = async (projectPath: string, projectName: string) => {
    if (deletingPath) return;
    const ok = confirm(`Delete project "${projectName}" at ${projectPath}? This cannot be undone.`);
    if (!ok) return;
    setDeletingPath(projectPath);
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.message ?? "Failed to delete project");
        return;
      }
      onRefresh();
    } catch {
      alert("Network error while deleting project");
    } finally {
      setDeletingPath(null);
    }
  };

  const totalProjects = data?.projects?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Panel header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <svg
            className="w-4 h-4"
            style={{ color: "#ffd700" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>Projects</title>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h2
            className="text-sm font-semibold uppercase tracking-widest"
            style={{ color: "#ffd700" }}
          >
            Projects
          </h2>
          <span
            className="badge"
            style={{
              background: "rgba(255, 215, 0, 0.1)",
              color: "#ffd700",
              border: "1px solid rgba(255, 215, 0, 0.2)",
            }}
          >
            {data === null ? <span className="spinner w-2.5 h-2.5 inline-block" style={{ border: "1.5px solid rgba(255,215,0,0.3)", borderTopColor: "#ffd700" }} /> : totalProjects}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Clone button */}
          <button
            type="button"
            onClick={() => setShowCloneForm((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: showCloneForm
                ? "rgba(0, 212, 255, 0.18)"
                : "rgba(0, 212, 255, 0.08)",
              border: `1px solid ${showCloneForm ? "rgba(0, 212, 255, 0.5)" : "rgba(0, 212, 255, 0.2)"}`,
              color: "#00d4ff",
            }}
            onMouseEnter={(e) => {
              if (!showCloneForm) {
                e.currentTarget.style.background = "rgba(0, 212, 255, 0.15)";
                e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showCloneForm) {
                e.currentTarget.style.background = "rgba(0, 212, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(0, 212, 255, 0.2)";
              }
            }}
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <title>Add project</title>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Clone Project
          </button>


          <button
            type="button"
            onClick={handleDiscover}
            disabled={discovering}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: discovering
                ? "rgba(139, 92, 246, 0.1)"
                : "rgba(139, 92, 246, 0.08)",
              border: "1px solid rgba(139, 92, 246, 0.3)",
              color: discovering ? "#a78bfa" : "#8b5cf6",
              cursor: discovering ? "not-allowed" : "pointer",
            }}
            title="Scan /opt/workspaces for existing repositories"
          >
            {discovering ? (
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <title>Scanning</title>
                <path d="M21 12a9 9 0 1 1-9-9" />
              </svg>
            ) : (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <title>Discover</title>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
            Discover
          </button>

          {/* Collapse toggle */}
          <button
            type="button"
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
              <title>Toggle projects panel</title>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Clone form inline */}
      {showCloneForm && !collapsed && (
        <CloneForm
          onClose={() => setShowCloneForm(false)}
          onCloned={() => {
            setShowCloneForm(false);
            onRefresh();
          }}
          existingNames={data?.projects?.map((p) => p.name) || []}
        />
      )}

      {discoverMsg && (
        <div
          className="text-xs px-3 py-2 rounded"
          style={{
            background: discoverMsg.type === "success"
              ? "rgba(0, 255, 136, 0.1)"
              : "rgba(255, 68, 68, 0.1)",
            color: discoverMsg.type === "success" ? "#00ff88" : "#ff4444",
            border: `1px solid ${discoverMsg.type === "success" ? "rgba(0, 255, 136, 0.2)" : "rgba(255, 68, 68, 0.2)"}`,
          }}
        >
          {discoverMsg.text}
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        <>
          {data === null ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="card animate-pulse" style={{ height: 72 }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded" style={{ background: "var(--border)" }} />
                    <div className="h-4 rounded" style={{ background: "var(--border)", width: "35%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (data.projects?.length ?? 0) === 0 ? (
            <div
              className="card flex flex-col items-center justify-center py-12 gap-3"
              style={{ color: "#4a5568" }}
            >
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <title>No projects</title>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <div className="text-sm">No projects found</div>
              <div className="text-xs" style={{ color: "#2e4a7a" }}>
                Use &ldquo;Clone Project&rdquo; above to add a project
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.projects.map((proj, i) => (
                <div key={proj.path} className="slide-up" style={{ "--i": i } as React.CSSProperties}>
                  <ProjectRow
                    project={proj}
                    deleting={deletingPath === proj.path}
                    onDelete={() => handleDeleteProject(proj.path, proj.name)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProjectRow({
  project,
  deleting,
  onDelete,
}: {
  project: { name: string; path: string; lastModified: string; branch: string; remoteUrl: string };
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2.5 rounded"
      style={{
        background: "rgba(30, 45, 74, 0.3)",
        border: "1px solid rgba(30, 45, 74, 0.5)",
      }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Name + branch */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="font-mono font-semibold text-sm"
            style={{ color: "var(--text)" }}
          >
            {project.name}
          </span>
          {project.branch && (
            <span
              className="badge"
              style={{
                background: "rgba(0, 255, 136, 0.08)",
                color: "#00ff88",
                border: "1px solid rgba(0, 255, 136, 0.2)",
              }}
            >
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <title>Branch</title>
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              {project.branch}
            </span>
          )}
          {project.lastModified && (
            <span className="text-xs" style={{ color: "#4a5568" }}>
              {formatRelativeTime(project.lastModified)}
            </span>
          )}
        </div>

        {/* Remote URL */}
        {project.remoteUrl && (
          <span
            className="font-mono text-xs truncate"
            style={{ color: "var(--dim)" }}
            title={project.remoteUrl}
          >
            {truncateUrl(project.remoteUrl)}
          </span>
        )}

        {/* Path */}
        <span className="font-mono text-xs" style={{ color: "#2e4a7a" }}>
          {project.path}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:justify-end">
        {/* Open Terminal button */}
        <button
          type="button"
          onClick={() => window.open(`/terminal/?arg=${encodeURIComponent(project.path)}`, "_blank", "noopener,noreferrer")}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
          style={{
            background: "rgba(0, 255, 136, 0.08)",
            border: "1px solid rgba(0, 255, 136, 0.2)",
            color: "#00ff88",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(0, 255, 136, 0.16)";
            e.currentTarget.style.borderColor = "rgba(0, 255, 136, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(0, 255, 136, 0.08)";
            e.currentTarget.style.borderColor = "rgba(0, 255, 136, 0.2)";
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
            <title>Open terminal</title>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          Terminal
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all"
          style={{
            background: deleting ? "var(--btn-bg)" : "rgba(255,68,68,0.1)",
            border: "1px solid rgba(255,68,68,0.3)",
            color: deleting ? "#4a5568" : "#ff4444",
          }}
          title="Delete project"
        >
          {deleting ? (
            <span className="spinner w-3 h-3 inline-block" style={{ border: "1.5px solid rgba(255,68,68,0.3)", borderTopColor: "#ff4444" }} />
          ) : "Delete"}
        </button>
      </div>
    </div>
  );
}
