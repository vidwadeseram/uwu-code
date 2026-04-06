"use client";

import { useEffect, useState, useCallback } from "react";

interface Script {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  content: string;
  isFavorite: boolean;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  path: string;
}

function ScriptCard({
  script,
  isRunning,
  onRun,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  script: Script;
  isRunning: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="card transition-all"
      style={{ border: "1px solid var(--input-border)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <svg
              className="w-4 h-4 transition-transform"
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                color: "var(--dim)",
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              {script.name}
            </span>
            {script.isFavorite && (
              <span style={{ color: "#ffd700" }} aria-label="Favorite">★</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{
                background: isRunning ? "rgba(0,212,255,0.1)" : "var(--hover-bg)",
                color: isRunning ? "#00d4ff" : "#4a5568",
                border: `1px solid ${isRunning ? "rgba(0,212,255,0.2)" : "var(--btn-bg)"}`,
              }}
            >
              {isRunning ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="spinner w-2.5 h-2.5 inline-block"
                    style={{ border: "1.5px solid rgba(0,212,255,0.3)", borderTopColor: "#00d4ff" }}
                  />
                </span>
              ) : `${script.runCount} runs`}
            </span>
          </div>
        </div>
        {script.description && !expanded && (
          <div className="px-4 pb-3 text-xs" style={{ color: "#64748b" }}>
            {script.description}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {script.description && (
            <div className="text-xs" style={{ color: "#64748b" }}>
              {script.description}
            </div>
          )}

          <div
            className="rounded p-3 font-mono text-xs overflow-x-auto"
            style={{ background: "var(--input-bg)", border: "1px solid var(--btn-bg)" }}
          >
            <pre style={{ color: "var(--dim)", margin: 0, whiteSpace: "pre-wrap" }}>
              {script.content}
            </pre>
          </div>

          {script.lastRunAt && (
            <div className="text-xs" style={{ color: "#4a5568" }}>
              Last run: {new Date(script.lastRunAt).toLocaleString()}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--btn-bg)" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-opacity disabled:opacity-50"
              style={{
                background: "rgba(0,255,136,0.12)",
                color: "#00ff88",
                border: "1px solid rgba(0,255,136,0.25)",
                cursor: isRunning ? "wait" : "pointer",
              }}
            >
              {isRunning ? (
                <span
                  className="spinner w-3 h-3 inline-block"
                  style={{ border: "1.5px solid rgba(0,255,136,0.3)", borderTopColor: "#00ff88" }}
                />
              ) : (
                <>
                  <span>▶</span>
                  <span>Run</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="px-3 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
              style={{ background: "var(--btn-bg)", color: "var(--dim)", border: "1px solid var(--surface)" }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className="px-3 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
              style={{
                background: script.isFavorite ? "rgba(255,215,0,0.1)" : "var(--btn-bg)",
                color: script.isFavorite ? "#ffd700" : "var(--dim)",
                border: `1px solid ${script.isFavorite ? "rgba(255,215,0,0.25)" : "var(--surface)"}`,
              }}
            >
              {script.isFavorite ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="px-3 py-1.5 rounded text-xs transition-opacity hover:opacity-80 ml-auto"
              style={{ background: "rgba(255,68,68,0.08)", color: "#ff4444", border: "1px solid rgba(255,68,68,0.2)" }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({
  script,
  onSave,
  onClose,
}: {
  script: Script;
  onSave: (script: Script) => void;
  onClose: () => void;
}) {
  const [edited, setEdited] = useState(script);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold" style={{ color: "var(--text)" }}>Edit Script</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--surface)", color: "var(--dim)", border: "1px solid var(--border)" }}
          >
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs" htmlFor="edit-name" style={{ color: "#4a5568" }}>Name</label>
            <input
              id="edit-name"
              type="text"
              value={edited.name}
              onChange={(e) => setEdited({ ...edited, name: e.target.value })}
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" htmlFor="edit-desc" style={{ color: "#4a5568" }}>Description</label>
            <input
              id="edit-desc"
              type="text"
              value={edited.description || ""}
              onChange={(e) => setEdited({ ...edited, description: e.target.value })}
              placeholder="Optional description..."
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" htmlFor="edit-content" style={{ color: "#4a5568" }}>Script Content</label>
            <textarea
              id="edit-content"
              value={edited.content}
              onChange={(e) => setEdited({ ...edited, content: e.target.value })}
              className="w-full px-3 py-2 rounded text-sm font-mono resize-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)", minHeight: "200px" }}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-sm"
            style={{ background: "var(--btn-bg)", color: "var(--dim)", border: "1px solid var(--input-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(edited)}
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function OutputModal({
  output,
  onClose,
}: {
  output: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold" style={{ color: "#00ff88" }}>Script Output</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--surface)", color: "var(--dim)", border: "1px solid var(--border)" }}
          >
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <pre
            className="text-sm font-mono whitespace-pre-wrap"
            style={{ color: "var(--text)" }}
          >
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
}

function NewScriptModal({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, description: string, content: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("#!/bin/bash\n\necho 'Hello world'");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold" style={{ color: "#00d4ff" }}>New Script</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded"
            style={{ background: "var(--surface)", color: "var(--dim)", border: "1px solid var(--border)" }}
          >
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs" htmlFor="new-name" style={{ color: "#4a5568" }}>Name *</label>
            <input
              id="new-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome script"
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" htmlFor="new-desc" style={{ color: "#4a5568" }}>Description</label>
            <input
              id="new-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this script do?"
              className="w-full px-3 py-2 rounded text-sm"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs" htmlFor="new-content" style={{ color: "#4a5568" }}>Script Content *</label>
            <textarea
              id="new-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm font-mono resize-none"
              style={{ background: "var(--input-bg)", border: "1px solid var(--input-border)", color: "var(--text)", minHeight: "200px" }}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-sm"
            style={{ background: "var(--btn-bg)", color: "var(--dim)", border: "1px solid var(--input-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (name.trim() && content.trim()) {
                onCreate(name, description, content);
              }
            }}
            disabled={!name.trim() || !content.trim()}
            className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
            style={{ background: "rgba(0,255,136,0.15)", color: "#00ff88", border: "1px solid rgba(0,255,136,0.3)" }}
          >
            Create Script
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  scriptName,
  onConfirm,
  onClose,
}: {
  scriptName: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-lg overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="font-semibold" style={{ color: "#ff4444" }}>Delete Script</span>
        </div>

        <div className="px-5 py-6">
          <p style={{ color: "var(--dim)" }}>
            Are you sure you want to delete <span style={{ color: "var(--text)" }}>"{scriptName}"</span>?
            This action cannot be undone.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-sm"
            style={{ background: "var(--btn-bg)", color: "var(--dim)", border: "1px solid var(--input-border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ background: "rgba(255,68,68,0.15)", color: "#ff4444", border: "1px solid rgba(255,68,68,0.3)" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showNewScript, setShowNewScript] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [deletingScript, setDeletingScript] = useState<Script | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const loadScripts = useCallback(async () => {
    try {
      const url = selectedProjectId
        ? `/api/scripts?projectId=${selectedProjectId}`
        : "/api/scripts";
      const res = await fetch(url);
      const data = await res.json();
      setScripts(data.scripts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
          setSelectedProjectId(data.projects[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadScripts();
    }
  }, [selectedProjectId, loadScripts]);

  const handleCreate = async (name: string, description: string, content: string) => {
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, content, projectId: selectedProjectId }),
      });
      if (res.ok) {
        setShowNewScript(false);
        loadScripts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (script: Script) => {
    try {
      await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(script),
      });
      setEditingScript(null);
      loadScripts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/scripts/${id}`, { method: "DELETE" });
      setDeletingScript(null);
      loadScripts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRun = async (script: Script) => {
    setRunning(script.id);
    setOutput(null);
    try {
      const res = await fetch(`/api/scripts/${script.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worktreeId: null }),
      });
      const data = await res.json();
      setOutput(data.output || data.error || "Script completed");
    } catch (err) {
      setOutput("Execution failed");
      console.error(err);
    } finally {
      setRunning(null);
    }
  };

  const handleToggleFavorite = async (script: Script) => {
    try {
      await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !script.isFavorite }),
      });
      loadScripts();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="skeleton w-9 h-9 rounded" />
            <div className="flex flex-col gap-2">
              <div className="skeleton h-5 w-20" />
              <div className="skeleton h-3 w-52" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="skeleton h-8 w-32 rounded" />
            <div className="skeleton h-8 w-28 rounded" />
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex items-center justify-between">
                <div className="skeleton h-4 w-40" />
                <div className="skeleton h-5 w-16 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--bg)" }}>
        <svg className="w-16 h-16 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        <div className="text-center">
          <div className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>No Projects Found</div>
          <div className="text-sm" style={{ color: "#64748b" }}>Add a project from the Dashboard to use Scripts.</div>
        </div>
      </div>
    );
  }

  const sortedScripts = [...scripts].sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return b.isFavorite ? 1 : -1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const favoriteCount = scripts.filter((s) => s.isFavorite).length;

  return (
    <div className="max-w-screen-lg mx-auto px-4 py-6 space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded flex items-center justify-center"
            style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)" }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <title>Scripts</title>
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#00d4ff" }}>Scripts</h1>
            <p className="text-xs" style={{ color: "#4a5568" }}>Run and manage shell scripts for your projects</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 rounded text-sm"
            style={{ background: "var(--btn-bg)", border: "1px solid var(--input-border)", color: "var(--text)" }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewScript(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.25)" }}
          >
            <span>+</span>
            <span>New Script</span>
          </button>
        </div>
      </div>

      {favoriteCount > 0 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "#64748b" }}>
          <span style={{ color: "#ffd700" }}>★</span>
          <span>{favoriteCount} favorite{favoriteCount !== 1 ? "s" : ""}</span>
        </div>
      )}

      {sortedScripts.length === 0 ? (
        <div
          className="card flex flex-col items-center justify-center py-16 gap-3"
          style={{ color: "#4a5568" }}
        >
          <svg className="w-12 h-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <div className="text-sm">No scripts yet</div>
          <div className="text-xs" style={{ color: "#4a5568" }}>
            Create a script to automate tasks in your project
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedScripts.map((script, i) => (
            <div key={script.id} className="slide-up" style={{ "--i": i } as React.CSSProperties}>
            <ScriptCard
              script={script}
              isRunning={running === script.id}
              onRun={() => handleRun(script)}
              onEdit={() => setEditingScript(script)}
              onDelete={() => setDeletingScript(script)}
              onToggleFavorite={() => handleToggleFavorite(script)}
            />
            </div>
          ))}
        </div>
      )}

      {showNewScript && (
        <NewScriptModal
          onCreate={handleCreate}
          onClose={() => setShowNewScript(false)}
        />
      )}

      {editingScript && (
        <EditModal
          script={editingScript}
          onSave={handleUpdate}
          onClose={() => setEditingScript(null)}
        />
      )}

      {deletingScript && (
        <DeleteConfirmModal
          scriptName={deletingScript.name}
          onConfirm={() => handleDelete(deletingScript.id)}
          onClose={() => setDeletingScript(null)}
        />
      )}

      {output && (
        <OutputModal
          output={output}
          onClose={() => setOutput(null)}
        />
      )}
    </div>
  );
}