import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runCommand(
  cmd: string,
): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 10000 });
    return { stdout: stdout.trim(), stderr: stderr.trim(), success: true };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    return {
      stdout: error.stdout?.trim() ?? "",
      stderr: error.stderr?.trim() ?? error.message ?? "",
      success: false,
    };
  }
}

async function getPublicIp(): Promise<string> {
  const cmds = [
    "curl -s --max-time 3 ifconfig.me",
    "curl -s --max-time 3 icanhazip.com",
    "curl -s --max-time 3 api.ipify.org",
  ];
  for (const cmd of cmds) {
    const { stdout } = await runCommand(cmd);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(stdout.trim())) {
      return stdout.trim();
    }
  }
  return "YOUR_VPS_IP";
}

async function getUfwStatus(): Promise<string[]> {
  const statusCheck = await runCommand("sudo ufw status 2>/dev/null");
  const isActive = statusCheck.stdout.toLowerCase().includes("status: active");

  if (isActive) {
    const { stdout } = await runCommand(
      "sudo ufw status | awk '/ALLOW/ && /tcp/ { for (i=1; i<=NF; i++) if ($i ~ /\\/tcp/) { gsub(/\\/tcp/, \"\", $i); if ($i ~ /^[0-9]+$/) print $i; } }' | sort -u"
    );
    return stdout
      .split("\n")
      .map((l) => l.trim().split("/")[0])
      .filter((l) => /^\d+$/.test(l));
  }

  const { stdout } = await runCommand(
    "sudo iptables -L INPUT -n --line-numbers 2>/dev/null | grep 'ACCEPT.*tcp.*dpt:' | grep -oP 'dpt:\\K[0-9]+' | sort -un"
  );
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+$/.test(l));
}

// GET /api/expose — list currently exposed ports
export async function GET() {
  try {
    const publicIp = await getPublicIp();
    const exposedPorts = await getUfwStatus();
    return NextResponse.json({
      publicIp,
      ports: exposedPorts.map((p) => ({ port: parseInt(p, 10), url: `http://${publicIp}:${p}` })),
    });
  } catch (error) {
    console.error("[/api/expose GET] Error:", error);
    return NextResponse.json({ publicIp: "YOUR_VPS_IP", ports: [] });
  }
}

// POST /api/expose — expose a port (ufw allow)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const port = parseInt(body.port, 10);

    if (!port || isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { success: false, message: "Invalid port number" },
        { status: 400 },
      );
    }

    const publicIp = await getPublicIp();
    const url = `http://${publicIp}:${port}`;

    const statusCheck = await runCommand("sudo ufw status 2>/dev/null");
    const ufwActive = statusCheck.stdout.toLowerCase().includes("status: active");

    if (!ufwActive) {
      await runCommand("echo y | sudo ufw enable 2>/dev/null");
    }

    const ufwResult = await runCommand(`sudo ufw allow ${port}/tcp`);

    if (ufwResult.success) {
      return NextResponse.json({
        success: true,
        url,
        message: `Port ${port} allowed via ufw. Public URL: ${url}`,
        ufwOutput: ufwResult.stdout || ufwResult.stderr,
      });
    } else {
      const isUfwMissing =
        ufwResult.stderr.includes("command not found") ||
        ufwResult.stderr.includes("not found");

      return NextResponse.json({
        success: false,
        url,
        message: isUfwMissing
          ? `ufw not available. Port ${port} may still be accessible at: ${url}`
          : `Firewall rule failed (${ufwResult.stderr}). Port may still be accessible at: ${url}`,
        ufwOutput: ufwResult.stderr,
      });
    }
  } catch (error) {
    console.error("[/api/expose POST] Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/expose — stop exposing a port (ufw delete allow)
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const port = parseInt(body.port, 10);

    if (!port || isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { success: false, message: "Invalid port number" },
        { status: 400 },
      );
    }

    const publicIp = await getPublicIp();
    const url = `http://${publicIp}:${port}`;

    const ufwResult = await runCommand(`sudo ufw --force delete allow ${port}/tcp`);

    if (ufwResult.success) {
      return NextResponse.json({
        success: true,
        url,
        message: `Port ${port} exposure removed from firewall.`,
        ufwOutput: ufwResult.stdout || ufwResult.stderr,
      });
    } else {
      return NextResponse.json({
        success: false,
        url,
        message: `Failed to remove firewall rule: ${ufwResult.stderr}`,
        ufwOutput: ufwResult.stderr,
      });
    }
  } catch (error) {
    console.error("[/api/expose DELETE] Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
