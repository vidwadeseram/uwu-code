export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

async function runCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 5000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    // Try multiple services to get public IP
    let publicIp = "";
    const ipCommands = [
      "curl -s --max-time 3 ifconfig.me",
      "curl -s --max-time 3 icanhazip.com",
      "curl -s --max-time 3 api.ipify.org",
      "curl -s --max-time 3 checkip.amazonaws.com",
    ];

    for (const cmd of ipCommands) {
      publicIp = await runCommand(cmd);
      // Validate it looks like an IP address
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(publicIp.trim())) {
        publicIp = publicIp.trim();
        break;
      }
      publicIp = "";
    }

    // If curl fails (e.g. local dev), fall back to local IP
    if (!publicIp) {
      const nets = os.networkInterfaces();
      for (const iface of Object.values(nets)) {
        if (!iface) continue;
        for (const net of iface) {
          if (net.family === "IPv4" && !net.internal) {
            publicIp = net.address;
            break;
          }
        }
        if (publicIp) break;
      }
    }

    const hostname = os.hostname();
    const uptimeSeconds = os.uptime();

    // Format uptime as Xd Xh Xm
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    let uptime = "";
    if (days > 0) uptime += `${days}d `;
    if (hours > 0 || days > 0) uptime += `${hours}h `;
    uptime += `${minutes}m`;

    const loadAvgRaw = os.loadavg();
    const loadAvg = loadAvgRaw.map((v) => v.toFixed(2)).join(", ");

    // Get memory info
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Get CPU info
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model?.trim() ?? "Unknown";
    const cpuCount = cpus.length;

    // Get disk usage via df
    const dfOutput = await runCommand("df -h / 2>/dev/null | tail -1");
    let diskUsage = "N/A";
    if (dfOutput) {
      const parts = dfOutput.split(/\s+/);
      // df -h format: Filesystem Size Used Avail Use% Mounted
      if (parts.length >= 5) {
        diskUsage = `${parts[2]} / ${parts[1]} (${parts[4]})`;
      }
    }

    return NextResponse.json({
      publicIp: publicIp || "Unknown",
      hostname,
      uptime: uptime.trim(),
      loadAvg,
      memory: {
        total: Math.round(totalMem / 1024 / 1024),
        used: Math.round(usedMem / 1024 / 1024),
        free: Math.round(freeMem / 1024 / 1024),
        percent: memPercent,
      },
      cpu: {
        model: cpuModel,
        count: cpuCount,
      },
      disk: diskUsage,
      platform: os.platform(),
    });
  } catch (error) {
    console.error("[/api/system] Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve system info" },
      { status: 500 }
    );
  }
}
