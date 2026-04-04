"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { FileTree, FileNode } from "@/components/file-explorer/FileTree";
import { DiffViewer } from "@/components/file-explorer/DiffViewer";

const MonacoEditor = dynamic(() => import("@/components/file-explorer/MonacoEditor"), { ssr: false });

interface Project {
  id: string;
  name: string;
  path: string;
}

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_MAX_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 280;
const MOBILE_BREAKPOINT = 768;

export default function FilesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [diffMode, setDiffMode] = useState<"inline" | "side-by-side">("inline");
  const [error, setError] = useState<string | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isDragging = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("fileExplorerSidebarWidth");
    if (saved) {
      const width = parseInt(saved, 10);
      if (width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        setSidebarWidth(width);
      }
    }
  }, []);

  const saveSidebarWidth = useCallback((width: number) => {
    localStorage.setItem("fileExplorerSidebarWidth", String(width));
    setSidebarWidth(width);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, e.clientX));
      saveSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [saveSidebarWidth]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    setProjectsLoading(true);
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects);
          setSelectedProjectId(data.projects[0].id);
        } else {
          setProjects([]);
          setSelectedProjectId("");
        }
      })
      .catch((e) => {
        console.error(e);
        setProjects([]);
        setSelectedProjectId("");
      })
      .finally(() => setProjectsLoading(false));
  }, []);

  const loadTree = useCallback(async (projectId: string) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/tree?projectId=${projectId}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setTree([]);
      } else {
        setTree(data.tree || []);
      }
    } catch (err) {
      setError("Failed to load file tree");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFile = useCallback(async (projectId: string, path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/content?projectId=${projectId}&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setFileContent("");
        setOriginalContent("");
      } else {
        setFileContent(data.content || "");
        setOriginalContent(data.content || "");
      }
    } catch (err) {
      setError("Failed to load file");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDiff = useCallback(async (projectId: string, path: string) => {
    try {
      const res = await fetch(`/api/files/diff?projectId=${projectId}&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setDiff(data.diff || "");
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadTree(selectedProjectId);
    }
  }, [selectedProjectId, loadTree]);

  const handleSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      loadFile(selectedProjectId, path);
      loadDiff(selectedProjectId, path);
      setShowDiff(false);
      if (isMobile) {
        setSidebarOpen(false);
      }
    },
    [selectedProjectId, loadFile, loadDiff, isMobile]
  );

  const handleSave = async () => {
    if (!selectedProjectId || !selectedPath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/files/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          path: selectedPath,
          content: fileContent,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOriginalContent(fileContent);
        loadTree(selectedProjectId);
      }
    } catch (err) {
      setError("Failed to save file");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = fileContent !== originalContent;

  return (
    <div className="h-screen flex flex-col fade-in" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <div className="flex items-center gap-4 px-4 py-3" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 rounded"
          style={{ background: "rgba(30,45,74,.5)" }}
          aria-label={sidebarOpen ? "Close file tree" : "Open file tree"}
        >
          <svg viewBox="0 0 24 24" fill="none" style={{ width: 20, height: 20 }} aria-hidden="true">
            {sidebarOpen ? (
              <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
        <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>File Explorer</h1>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="px-3 py-1.5 rounded text-sm"
          style={{ background: "rgba(30,45,74,.5)", borderColor: "var(--border)" }}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded text-sm flex-1 max-w-xs hidden md:block"
          style={{ background: "rgba(30,45,74,.5)", borderColor: "var(--border)" }}
        />
        {selectedPath && (
          <>
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="px-3 py-1.5 rounded text-sm"
              style={{ background: "rgba(30,45,74,.5)", borderColor: "var(--border)" }}
            >
              {showDiff ? "Hide Diff" : "Show Diff"}
            </button>
            {showDiff && (
              <button
                type="button"
                onClick={() => setDiffMode(diffMode === "inline" ? "side-by-side" : "inline")}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: "rgba(30,45,74,.5)", borderColor: "var(--border)" }}
              >
                {diffMode === "inline" ? "Side by Side" : "Inline"}
              </button>
            )}
            {hasChanges && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded text-sm disabled:opacity-50"
                style={{ background: "rgba(0,255,136,.2)", color: "var(--green)", border: "1px solid var(--green)" }}
              >
                {saving ? (
                  <span className="spinner w-3 h-3 inline-block" style={{ border: "1.5px solid rgba(0,255,136,0.3)", borderTopColor: "#00ff88" }} />
                ) : "Save"}
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="px-4 py-2" style={{ background: "rgba(255,0,0,.15)", color: "var(--red)" }}>
          {error}
        </div>
      )}

      {projects.length === 0 && !projectsLoading ? (
        <div style={{ display: "grid", placeItems: "center", flex: 1 }}>
          <span style={{ color: "var(--dim)" }}>No projects found. Add a project from the Dashboard.</span>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {isMobile && sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSidebarOpen(false)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
              aria-label="Close sidebar"
            />
          )}

          <div
            className="flex-none h-full flex flex-col border-r overflow-hidden"
            style={{
              width: isMobile ? (sidebarOpen ? "280px" : "0") : `${sidebarWidth}px`,
              borderColor: "var(--border)",
              transition: isMobile ? "width 0.2s ease" : "none",
              flexShrink: 0,
            }}
          >
            {!isMobile && (
              <div
                onMouseDown={startDrag}
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-cyan-500/50 active:bg-cyan-500/70 z-10"
                style={{ background: "var(--border)" }}
                role="slider"
                aria-label="Resize sidebar"
                aria-valuemin={SIDEBAR_MIN_WIDTH}
                aria-valuemax={SIDEBAR_MAX_WIDTH}
                aria-valuenow={sidebarWidth}
                tabIndex={0}
              />
            )}
            <div className="flex-1 overflow-auto p-2">
              {loading && tree.length === 0 ? (
                <div className="flex flex-col gap-2 p-2">
                  {[70, 55, 80, 45, 65, 60].map((w, i) => (
                    <div key={`skeleton-${i}`} className="skeleton h-3" style={{ width: `${w}%`, animationDelay: `${i * 0.07}s` }} />
                  ))}
                </div>
              ) : tree.length === 0 ? (
                <div style={{ color: "var(--dim)" }}>No files found</div>
              ) : (
                <FileTree nodes={tree} selectedPath={selectedPath} onSelect={handleSelect} filter={filter} />
              )}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div
              className="overflow-hidden border-r"
              style={{
                width: showDiff ? (isMobile ? "50%" : "33.333%") : "0",
                borderColor: "var(--border)",
                transition: "width 0.2s ease",
                display: showDiff ? "block" : "none",
                flexShrink: 0,
              }}
            >
              <DiffViewer oldContent={originalContent} newContent={fileContent} mode={diffMode} />
            </div>

            <div className="flex-1 overflow-hidden">
              {selectedPath ? (
                <div className="h-full flex flex-col">
                  <div className="px-4 py-2" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", color: "var(--dim)" }}>
                    {selectedPath}
                  </div>
                  <div className="flex-1">
                    <MonacoEditor value={fileContent} onChange={(val) => setFileContent(val || "")} path={selectedPath} />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center" style={{ color: "var(--dim)" }}>
                  Select a file to edit
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
