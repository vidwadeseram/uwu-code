import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runCommand(
  cmd: string
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const port = parseInt(body.port, 10);

    if (!port || isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { success: false, message: "Invalid port number" },
        { status: 400 }
      );
    }

    // Get public IP for the URL
    const publicIp = await getPublicIp();
    const url = `http://${publicIp}:${port}`;

    // Try to open the firewall with ufw
    // This requires that Next.js process has sudo rights for ufw, or ufw is configured with NOPASSWD
    const ufwResult = await runCommand(`sudo ufw allow ${port}/tcp`);

    if (ufwResult.success) {
      return NextResponse.json({
        success: true,
        url,
        message: `Port ${port} allowed via ufw. Public URL: ${url}`,
        ufwOutput: ufwResult.stdout || ufwResult.stderr,
      });
    } else {
      // ufw failed — still return the URL, just note firewall wasn't updated
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
    console.error("[/api/expose] Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
