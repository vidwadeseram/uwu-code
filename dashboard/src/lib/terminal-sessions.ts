import { spawn, execSync } from "child_process";
import { randomUUID } from "crypto";

const MAX_SESSIONS = 10;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export interface TerminalSession {
  id: string;
  tmuxSession: string;
  createdAt: number;
  lastActivity: number;
}

export const sessions = new Map<string, TerminalSession>();

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

function killTmuxSession(sessionName: string) {
  runCommand(`tmux kill-session -t "${sessionName}" 2>/dev/null || true`);
}

export function createTmuxSession(id: string): TerminalSession {
  const tmuxSession = `uwu-${id.slice(0, 8)}`;
  
  runCommand(`tmux new-session -d -s "${tmuxSession}" -c /opt/workspaces 2>/dev/null || true`);
  
  return {
    id,
    tmuxSession,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
}

export function cleanupIdleSessions() {
  const now = Date.now();
  const toDelete: string[] = [];
  sessions.forEach((session, id) => {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS) {
      toDelete.push(id);
    }
  });
  toDelete.forEach((id) => {
    const session = sessions.get(id);
    if (session) {
      killTmuxSession(session.tmuxSession);
      sessions.delete(id);
    }
  });
}

export function killSession(session: TerminalSession) {
  killTmuxSession(session.tmuxSession);
}

export function updateSessionActivity(id: string) {
  const session = sessions.get(id);
  if (session) {
    session.lastActivity = Date.now();
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

export function startSessionCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(cleanupIdleSessions, 60 * 1000);
}

export { MAX_SESSIONS };
