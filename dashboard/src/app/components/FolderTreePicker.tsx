"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BrowseEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  hasChildren: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  hasChildren: boolean;
  children: TreeNode[] | null;
  loading: boolean;
  expanded: boolean;
}

interface FolderTreePickerProps {
  value: string;
  onSelect: (path: string) => void;
  compact?: boolean;
  placeholder?: string;
}

async function fetchEntries(dirPath?: string): Promise<BrowseEntry[]> {
  const url = dirPath ? `/api/browse?path=${encodeURIComponent(dirPath)}` : "/api/browse";
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.entries ?? []) as BrowseEntry[];
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onToggle,
  onPick,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  onToggle: (path: string) => void;
  onPick: (path: string) => void;
}) {
  const isSelected = selectedPath === node.path;
  const indent = depth * 16;

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors group w-full text-left"
        style={{
          paddingLeft: `${indent + 8}px`,
          background: isSelected ? "rgba(0,212,255,0.12)" : "transparent",
          border: isSelected ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
        }}
        onClick={() => onPick(node.path)}
        onDoubleClick={() => {
          if (node.hasChildren) onToggle(node.path);
        }}
      >
        {node.hasChildren ? (
          <i
            aria-hidden="true"
            className="w-4 h-4 flex items-center justify-center flex-shrink-0 not-italic"
            style={{ color: "#94a3b8" }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.path);
            }}
          >
            {node.loading ? (
              <span
                className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#4a5568", borderTopColor: "transparent" }}
              />
            ) : (
              <svg
                className="w-3 h-3 transition-transform"
                style={{ transform: node.expanded ? "rotate(90deg)" : "rotate(0deg)" }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </i>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        <svg
          className="w-4 h-4 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke={node.expanded ? "#00ff88" : "#ffd700"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {node.expanded ? (
            <>
              <path d="M5 19a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h4a2 2 0 0 1 2 2v1" />
              <path d="M20 13H8l-3 6h15l2-6z" />
            </>
          ) : (
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          )}
        </svg>

        <span
          className="text-xs truncate"
          style={{ color: isSelected ? "#00d4ff" : "#e2e8f0" }}
        >
          {node.name}
        </span>
      </button>

      {node.expanded && node.children && (
        <>
          {node.children.length === 0 ? (
            <div
              className="text-xs py-1"
              style={{ paddingLeft: `${indent + 28}px`, color: "#4a5568" }}
            >
              No subdirectories
            </div>
          ) : (
            node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onToggle={onToggle}
                onPick={onPick}
              />
            ))
          )}
        </>
      )}
    </>
  );
}

export default function FolderTreePicker({
  value,
  onSelect,
  compact = false,
  placeholder = "Select folder",
}: FolderTreePickerProps) {
  const [open, setOpen] = useState(false);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const entries = await fetchEntries();
      setNodes(
        entries.map((e) => ({
          name: e.name,
          path: e.path,
          hasChildren: e.hasChildren,
          children: null,
          loading: false,
          expanded: false,
        }))
      );
    } catch {
      setError("Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && nodes.length === 0 && !loading) {
      void loadRoot();
    }
  }, [open, nodes.length, loading, loadRoot]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const toggleNode = useCallback(async (targetPath: string) => {
    const findAndToggle = (list: TreeNode[]): TreeNode[] => {
      return list.map((n) => {
        if (n.path === targetPath) {
          if (n.expanded) return { ...n, expanded: false };
          if (n.children === null) return { ...n, loading: true, expanded: true };
          return { ...n, expanded: true };
        }
        if (n.children) return { ...n, children: findAndToggle(n.children) };
        return n;
      });
    };

    setNodes((prev) => findAndToggle(prev));

    const needsLoad = ((list: TreeNode[]): boolean => {
      const check = (items: TreeNode[]): boolean => {
        for (const n of items) {
          if (n.path === targetPath && n.children === null) return true;
          if (n.children && check(n.children)) return true;
        }
        return false;
      };
      return check(list);
    })(nodes);

    if (needsLoad) {
      try {
        const entries = await fetchEntries(targetPath);
        const children: TreeNode[] = entries.map((e) => ({
          name: e.name,
          path: e.path,
          hasChildren: e.hasChildren,
          children: null,
          loading: false,
          expanded: false,
        }));

        const injectChildren = (list: TreeNode[]): TreeNode[] => {
          return list.map((n) => {
            if (n.path === targetPath) return { ...n, children, loading: false };
            if (n.children) return { ...n, children: injectChildren(n.children) };
            return n;
          });
        };

        setNodes((prev) => injectChildren(prev));
      } catch {
        const clearLoading = (list: TreeNode[]): TreeNode[] => {
          return list.map((n) => {
            if (n.path === targetPath) return { ...n, loading: false, children: [] };
            if (n.children) return { ...n, children: clearLoading(n.children) };
            return n;
          });
        };
        setNodes((prev) => clearLoading(prev));
      }
    }
  }, [nodes]);

  const handlePick = useCallback(
    (path: string) => {
      onSelect(path);
      setOpen(false);
    },
    [onSelect]
  );

  const displayValue = value
    ? value.replace(/^\/opt\/workspaces\/?/, "") || "workspaces/"
    : placeholder;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors w-full ${compact ? "sm:max-w-[260px]" : "sm:max-w-[360px]"}`}
        style={{
          background: "rgba(30,45,74,0.5)",
          color: value ? "#94a3b8" : "#4a5568",
          border: open ? "1px solid rgba(0,212,255,0.4)" : "1px solid #1e2d4a",
        }}
        title={value || placeholder}
      >
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffd700"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="truncate">{displayValue}</span>
        <svg
          className="w-3 h-3 flex-shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "#4a5568" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-[min(20rem,calc(100vw-2rem))] sm:w-80 rounded-lg overflow-hidden shadow-2xl"
          style={{
            background: "#0f1629",
            border: "1px solid #1e2d4a",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: "#1e2d4a" }}
          >
            <span className="text-xs font-semibold" style={{ color: "#00d4ff" }}>
              Browse Workspaces
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ color: "#4a5568" }}
            >
              Esc
            </button>
          </div>

          <div className="py-1 max-h-72 overflow-y-auto">
            {loading && (
              <div className="text-xs px-3 py-3 text-center" style={{ color: "#4a5568" }}>
                Loading...
              </div>
            )}
            {error && (
              <div className="text-xs px-3 py-2" style={{ color: "#f87171" }}>
                {error}
              </div>
            )}
            {!loading && !error && nodes.length === 0 && (
              <div className="text-xs px-3 py-3 text-center" style={{ color: "#4a5568" }}>
                No folders found
              </div>
            )}
            {nodes.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={value}
                onToggle={toggleNode}
                onPick={handlePick}
              />
            ))}
          </div>

          {value && (
            <div
              className="px-3 py-2 border-t text-xs font-mono truncate"
              style={{ borderColor: "#1e2d4a", color: "#4a5568" }}
              title={value}
            >
              {value}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
