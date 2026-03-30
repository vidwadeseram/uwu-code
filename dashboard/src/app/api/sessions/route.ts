import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runCommand(
  cmd: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execAsync(cmd, { timeout: 8000 });
    return result;
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message ?? "",
    };
  }
}

export interface TmuxWindow {
  windowIndex: number;
  windowName: string;
  active: boolean;
  cwd: string;
  panePid: number | null;
}

export interface TmuxSession {
  name: string;
  windowCount: number;
  created: number;
  windows: TmuxWindow[];
}

export async function GET() {
  try {
    // Check if tmux is available
    const { stdout: tmuxCheck } = await runCommand("which tmux");
    if (!tmuxCheck.trim()) {
      return NextResponse.json({ sessions: [], error: "tmux not found" });
    }

    // List all sessions
    const { stdout: sessionsRaw, stderr: sessionsErr } = await runCommand(
      'tmux list-sessions -F "#{session_name}|#{session_windows}|#{session_created}" 2>&1'
    );

    // If tmux server is not running or no sessions
    if (
      sessionsErr.includes("no server running") ||
      sessionsErr.includes("error connecting") ||
      sessionsErr.includes("no sessions") ||
      !sessionsRaw.trim()
    ) {
      return NextResponse.json({ sessions: [] });
    }

    const sessionLines = sessionsRaw
      .trim()
      .split("\n")
      .filter((l) => l.trim());
    const sessions: TmuxSession[] = [];

    for (const line of sessionLines) {
      const parts = line.split("|");
      if (parts.length < 3) continue;

      const [sessionName, windowCountStr, createdStr] = parts;
      const windowCount = parseInt(windowCountStr, 10) || 0;
      const created = parseInt(createdStr, 10) || 0;

      // List windows for this session
      const { stdout: windowsRaw } = await runCommand(
        `tmux list-windows -t "${sessionName}" -F "#{window_index}|#{window_name}|#{window_active}" 2>&1`
      );

      const windows: TmuxWindow[] = [];
      const windowLines = windowsRaw
        .trim()
        .split("\n")
        .filter((l) => l.trim());

      for (const wLine of windowLines) {
        const wParts = wLine.split("|");
        if (wParts.length < 3) continue;

        const [idxStr, windowName, activeStr] = wParts;
        const windowIndex = parseInt(idxStr, 10);
        const active = activeStr.trim() === "1";

        // Get the active pane's CWD and PID
        const { stdout: paneRaw } = await runCommand(
          `tmux display-message -t "${sessionName}:${windowIndex}" -p "#{pane_current_path}|#{pane_pid}" 2>&1`
        );

        let cwd = "";
        let panePid: number | null = null;

        if (paneRaw && !paneRaw.startsWith("can't")) {
          const paneParts = paneRaw.trim().split("|");
          cwd = paneParts[0]?.trim() ?? "";
          const pidStr = paneParts[1]?.trim() ?? "";
          panePid = pidStr ? parseInt(pidStr, 10) || null : null;
        }

        windows.push({
          windowIndex,
          windowName: windowName.trim(),
          active,
          cwd,
          panePid,
        });
      }

      sessions.push({
        name: sessionName.trim(),
        windowCount,
        created,
        windows,
      });
    }

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[/api/sessions] Error:", error);
    return NextResponse.json({ sessions: [], error: "Failed to list sessions" });
  }
}
