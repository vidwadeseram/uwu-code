import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

async function runCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    return stdout;
  } catch (err: unknown) {
    const error = err as { stdout?: string };
    return error.stdout ?? "";
  }
}

export interface PortInfo {
  port: number;
  address: string;
  pid: number | null;
  processName: string;
  protocol: string;
}

/**
 * Parse `ss -tlnp` output.
 *
 * Example line:
 * LISTEN  0  128  0.0.0.0:22  0.0.0.0:*  users:(("sshd",pid=1234,fd=3))
 * LISTEN  0  128  [::]:80     [::]:*      users:(("nginx",pid=999,fd=6))
 */
function parseSsOutput(raw: string): PortInfo[] {
  const ports: PortInfo[] = [];
  const seen = new Set<number>();

  const lines = raw.split("\n");
  for (const line of lines) {
    // Skip header and empty lines
    if (!line.trim() || line.startsWith("Netid") || line.startsWith("State")) {
      continue;
    }

    const cols = line.trim().split(/\s+/);
    // cols: [State, RecvQ, SendQ, LocalAddress:Port, PeerAddress:Port, ...users]
    if (cols.length < 4) continue;

    const state = cols[0];
    if (state !== "LISTEN") continue;

    const localAddr = cols[3];
    if (!localAddr) continue;

    // Extract port — last segment after last colon
    const colonIdx = localAddr.lastIndexOf(":");
    if (colonIdx === -1) continue;
    const portStr = localAddr.slice(colonIdx + 1);
    const port = parseInt(portStr, 10);
    if (isNaN(port) || port <= 0) continue;

    // Deduplicate by port
    if (seen.has(port)) continue;
    seen.add(port);

    const address = localAddr.slice(0, colonIdx) || "0.0.0.0";

    // Parse users:(("processName",pid=NNN,fd=N))
    // The users column may be the 5th or later (after peer addr)
    const usersStr = cols.slice(4).join(" ");
    let pid: number | null = null;
    let processName = "unknown";

    const usersMatch = usersStr.match(/users:\(\((.+?)\)\)/);
    if (usersMatch) {
      const inner = usersMatch[1];
      // Inner looks like: "sshd",pid=1234,fd=3  or multiple: "sshd",pid=1234,fd=3),("sshd",pid=1235,fd=3
      // Take the first entry
      const procMatch = inner.match(/"([^"]+)",pid=(\d+)/);
      if (procMatch) {
        processName = procMatch[1];
        pid = parseInt(procMatch[2], 10);
      }
    }

    ports.push({ port, address, pid, processName, protocol: "tcp" });
  }

  return ports.sort((a, b) => a.port - b.port);
}

/**
 * Try to get the CWD of a process via /proc/<pid>/cwd (Linux only).
 */
function getProcessCwd(pid: number): string {
  try {
    return fs.readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return "";
  }
}

/**
 * Walk up the /proc/<pid>/status parent chain to collect ancestor PIDs.
 */
function getAncestorPids(pid: number, maxDepth = 10): number[] {
  const ancestors: number[] = [];
  let current = pid;
  for (let i = 0; i < maxDepth; i++) {
    try {
      const status = fs.readFileSync(`/proc/${current}/status`, "utf8");
      const ppidMatch = status.match(/^PPid:\s*(\d+)/m);
      if (!ppidMatch) break;
      const ppid = parseInt(ppidMatch[1], 10);
      if (!ppid || ppid <= 1) break;
      ancestors.push(ppid);
      current = ppid;
    } catch {
      break;
    }
  }
  return ancestors;
}

export async function GET() {
  try {
    // Primary: ss -tlnp
    const ssOutput = await runCommand("ss -tlnp 2>/dev/null");
    let ports: PortInfo[] = [];

    if (ssOutput.trim()) {
      ports = parseSsOutput(ssOutput);
    } else {
      // Fallback: netstat -tlnp (older systems)
      const netstatOutput = await runCommand(
        "netstat -tlnp 2>/dev/null || netstat -tln 2>/dev/null"
      );
      if (netstatOutput.trim()) {
        // Parse netstat output (similar format but slightly different)
        const lines = netstatOutput.split("\n");
        const seen = new Set<number>();
        for (const line of lines) {
          if (!line.startsWith("tcp")) continue;
          const cols = line.trim().split(/\s+/);
          if (cols.length < 4) continue;
          const localAddr = cols[3];
          const colonIdx = localAddr.lastIndexOf(":");
          if (colonIdx === -1) continue;
          const portStr = localAddr.slice(colonIdx + 1);
          const port = parseInt(portStr, 10);
          if (isNaN(port) || port <= 0 || seen.has(port)) continue;
          seen.add(port);
          const address = localAddr.slice(0, colonIdx) || "0.0.0.0";
          let pid: number | null = null;
          let processName = "unknown";
          if (cols[6]) {
            const m = cols[6].match(/(\d+)\/(.*)/);
            if (m) {
              pid = parseInt(m[1], 10);
              processName = m[2] ?? "unknown";
            }
          }
          ports.push({ port, address, pid, processName, protocol: "tcp" });
        }
        ports.sort((a, b) => a.port - b.port);
      }
    }

    // Enrich with CWD info for each port's process (Linux /proc)
    const enriched = ports.map((p) => {
      let cwd = "";
      let ancestorPids: number[] = [];
      if (p.pid) {
        cwd = getProcessCwd(p.pid);
        ancestorPids = getAncestorPids(p.pid);
      }
      return { ...p, cwd, ancestorPids };
    });

    return NextResponse.json({ ports: enriched });
  } catch (error) {
    console.error("[/api/ports] Error:", error);
    return NextResponse.json({ ports: [], error: "Failed to list ports" });
  }
}
