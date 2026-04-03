"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category: string;
}

interface CommandPaletteProps {
  commands: Command[];
}

export function useCommandPalette(commands: Command[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const execute = useCallback(
    (index: number) => {
      const cmd = filteredCommands[index];
      if (cmd) {
        cmd.action();
        close();
      }
    },
    [filteredCommands, close]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        isOpen ? close() : open();
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          execute(selectedIndex);
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [isOpen, open, close, filteredCommands.length, selectedIndex, execute]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return {
    isOpen,
    query,
    setQuery,
    selectedIndex,
    filteredCommands,
    open,
    close,
    execute,
  };
}

export function CommandPaletteDialog({ commands }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    isOpen,
    query,
    setQuery,
    selectedIndex,
    filteredCommands,
    close,
  } = useCommandPalette(commands);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    router.push(path);
    close();
  };

  const allCommands: Command[] = commands.length > 0
    ? commands
    : [
        { id: "nav-dashboard", label: "Go to Dashboard", category: "Navigation", action: () => handleNavigate("/") },
        { id: "nav-files", label: "Go to Files", category: "Navigation", action: () => handleNavigate("/files") },
        { id: "nav-git", label: "Go to Git", category: "Navigation", action: () => handleNavigate("/git") },
        { id: "nav-kanban", label: "Go to Kanban", category: "Navigation", action: () => handleNavigate("/kanban") },
        { id: "nav-scripts", label: "Go to Scripts", category: "Navigation", action: () => handleNavigate("/scripts") },
        { id: "nav-terminal", label: "Go to Terminal", category: "Navigation", action: () => handleNavigate("/terminal") },
        { id: "nav-scheduler", label: "Go to Scheduler", category: "Navigation", action: () => handleNavigate("/scheduler") },
        { id: "nav-openclaw", label: "Go to OpenClaw", category: "Navigation", action: () => handleNavigate("/openclaw") },
        { id: "nav-settings", label: "Go to Settings", category: "Navigation", action: () => handleNavigate("/settings") },
      ];

  const displayCommands = filteredCommands.length > 0 ? filteredCommands : allCommands.filter(
    (cmd) => cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = displayCommands.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" role="dialog" aria-modal="true">
      <button type="button" className="fixed inset-0 bg-black/50 cursor-default" onClick={close} aria-label="Close dialog" />
      <div
        className="relative w-full max-w-lg bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        role="document"
      >
        <div className="flex items-center px-4 border-b border-slate-700">
          <span className="text-slate-400 mr-3">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 py-4 bg-transparent text-white placeholder-slate-400 outline-none text-lg"
          />
          <span className="text-slate-500 text-sm">ESC</span>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {Object.entries(grouped).map(([category, cmds]) => (
            <div key={category}>
              <div className="px-4 py-1 text-xs font-medium text-slate-500 uppercase">{category}</div>
              {cmds.map((cmd, idx) => {
                const globalIdx = displayCommands.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => {
                      cmd.action();
                      close();
                    }}
                    className={`w-full flex items-center justify-between px-4 py-2 text-left ${
                      globalIdx === selectedIndex ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut && <span className="text-xs text-slate-500">{cmd.shortcut}</span>}
                  </button>
                );
              })}
            </div>
          ))}
          {displayCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-400">No commands found</div>
          )}
        </div>
      </div>
    </div>
  );
}