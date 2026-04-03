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

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showNewScript, setShowNewScript] = useState(false);
  const [newScript, setNewScript] = useState({ name: "", description: "", content: "" });
  const [editingScript, setEditingScript] = useState<Script | null>(null);
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
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadScripts();
    }
  }, [selectedProjectId, loadScripts]);

  const handleCreate = async () => {
    if (!newScript.name.trim() || !newScript.content.trim() || !selectedProjectId) return;
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newScript, projectId: selectedProjectId }),
      });
      if (res.ok) {
        setNewScript({ name: "", description: "", content: "" });
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
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <h1 className="text-lg font-semibold">Saved Scripts</h1>
        <div className="flex items-center gap-4">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewScript(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            + New Script
          </button>
        </div>
      </div>

      {showNewScript && (
        <div className="p-4 bg-slate-800 border-b border-slate-700 space-y-3">
          <input
            type="text"
            value={newScript.name}
            onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
            placeholder="Script name..."
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm"
          />
          <input
            type="text"
            value={newScript.description}
            onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
            placeholder="Description (optional)..."
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm"
          />
          <textarea
            value={newScript.content}
            onChange={(e) => setNewScript({ ...newScript, content: e.target.value })}
            placeholder="#!/bin/bash&#10;echo 'Hello world'"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-mono resize-none"
            rows={5}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewScript(false)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 p-4 overflow-y-auto border-r border-slate-700">
          <div className="space-y-2">
            {scripts.map((script) => (
              <div
                key={script.id}
                className="bg-slate-800 rounded p-4 hover:bg-slate-700 transition-colors"
              >
                {editingScript?.id === script.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingScript.name}
                      onChange={(e) => setEditingScript({ ...editingScript, name: e.target.value })}
                      className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-sm"
                    />
                    <textarea
                      value={editingScript.content}
                      onChange={(e) => setEditingScript({ ...editingScript, content: e.target.value })}
                      className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-sm font-mono resize-none"
                      rows={5}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(editingScript)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingScript(null)}
                        className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{script.name}</span>
                          {script.isFavorite && <span className="text-yellow-400">★</span>}
                        </div>
                        {script.description && (
                          <div className="text-sm text-slate-400 mt-1">{script.description}</div>
                        )}
                        <div className="text-xs text-slate-500 mt-2">
                          Run count: {script.runCount}
                          {script.lastRunAt && (
                            <> · Last run: {new Date(script.lastRunAt).toLocaleDateString()}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
                      <button
                        type="button"
                        onClick={() => handleRun(script)}
                        disabled={running === script.id}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs disabled:opacity-50"
                      >
                        {running === script.id ? "Running..." : "Run"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingScript(script)}
                        className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(script)}
                        className="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
                      >
                        {script.isFavorite ? "★" : "☆"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(script.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {scripts.length === 0 && (
              <div className="text-center text-slate-400 py-8">
                No scripts yet. Create one to get started!
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Output</h3>
          <pre className="bg-slate-800 rounded p-4 text-sm font-mono text-slate-300 whitespace-pre-wrap">
            {output || "Run a script to see output here..."}
          </pre>
        </div>
      </div>
    </div>
  );
}