import { execSync } from "child_process";
import { existsSync, statSync, realpathSync } from "fs";
import { resolve, relative } from "path";

const MAX_SESSIONS = 10;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ALLOWED_BASE_PATHS = ["/opt/workspaces"];

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

export function validateAndSanitizePath(cwd: string | undefined): string {
  if (!cwd) {
    return "/opt/workspaces";
  }

  try {
    const resolvedPath = resolve(cwd);
    
    // Security: Canonicalize path to resolve symlinks
    const realPath = existsSync(resolvedPath) ? realpathSync(resolvedPath) : resolvedPath;
    
    // Security: Only allow paths under whitelisted directories
    const isAllowed = ALLOWED_BASE_PATHS.some(allowedBase => {
      const relativePath = relative(allowedBase, realPath);
      // Path is allowed if it's inside the base directory (not starting with .. or /)
      return !relativePath.startsWith('..') && !relativePath.startsWith('/') && relativePath !== '';
    });
    
    if (!isAllowed) {
      console.warn(`[Terminal] Path validation failed: ${cwd} (real: ${realPath}) not within allowed directories, falling back to default`);
      return "/opt/workspaces";
    }
    
    // Security: Ensure path exists AND is a directory (following symlinks)
    if (!existsSync(realPath)) {
      console.warn(`[Terminal] Resolved path does not exist: ${realPath}, falling back to default`);
      return "/opt/workspaces";
    }
    
    const stats = statSync(realPath);
    if (!stats.isDirectory()) {
      console.warn(`[Terminal] Resolved path is not a directory: ${realPath}, falling back to default`);
      return "/opt/workspaces";
    }
    
    return realPath;
  } catch (error) {
    console.error(`[Terminal] Path validation error for ${cwd}:`, error);
    return "/opt/workspaces";
  }
}

export function createTmuxSession(id: string, cwd?: string): TerminalSession {
  const tmuxSession = `uwu-${id.slice(0, 8)}`;
  const workingDir = validateAndSanitizePath(cwd);
  
  runCommand(`tmux new-session -d -s "${tmuxSession}" -c "${workingDir}" 2>/dev/null || true`);
  
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

export function stopSessionCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export { MAX_SESSIONS };
