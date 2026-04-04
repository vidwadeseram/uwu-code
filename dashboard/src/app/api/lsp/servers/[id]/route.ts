import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

type Context = { params: Promise<{ id: string }> };

const LSP_PROCESSES: Record<string, ReturnType<typeof spawn>> = {};

export async function GET(
  request: NextRequest,
  ctx: Context
) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const server = await db
      .select()
      .from(schema.lspServers)
      .where(eq(schema.lspServers.id, id))
      .get();

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    return NextResponse.json({ server });
  } catch (error) {
    console.error("[/api/lsp/servers/[id] GET] Error:", error);
    return NextResponse.json({ error: "Failed to get server" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: Context
) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const { action } = body;

    const db = getDb();
    const server = await db
      .select()
      .from(schema.lspServers)
      .where(eq(schema.lspServers.id, id))
      .get();

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (action === "start") {
      if (LSP_PROCESSES[id]) {
        return NextResponse.json({ server, message: "Server already running" });
      }

      const worktree = await db
        .select()
        .from(schema.worktrees)
        .where(eq(schema.worktrees.id, server.worktreeId))
        .get();

      if (!worktree) {
        return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
      }

      const args = server.args ? server.args.split(" ") : [];
      const proc = spawn(server.command, args, {
        cwd: worktree.path,
        stdio: ["pipe", "pipe", "pipe"],
      });

      LSP_PROCESSES[id] = proc;

      proc.on("error", (err) => {
        console.error(`LSP server ${id} error:`, err);
        delete LSP_PROCESSES[id];
        db.update(schema.lspServers)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(schema.lspServers.id, id))
          .run();
      });

      proc.on("exit", (code) => {
        console.log(`LSP server ${id} exited with code ${code}`);
        delete LSP_PROCESSES[id];
        db.update(schema.lspServers)
          .set({ status: "stopped", updatedAt: new Date() })
          .where(eq(schema.lspServers.id, id))
          .run();
      });

      const logFile = path.join(process.cwd(), "..", "openclaw", "data", `lsp-${id}.log`);
      proc.stdout?.on("data", (data) => {
        fs.appendFileSync(logFile, `[stdout] ${data.toString()}`);
      });
      proc.stderr?.on("data", (data) => {
        fs.appendFileSync(logFile, `[stderr] ${data.toString()}`);
      });

      await db.update(schema.lspServers)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(schema.lspServers.id, id));

      const updated = await db.select().from(schema.lspServers).where(eq(schema.lspServers.id, id)).get();
      return NextResponse.json({ server: updated });
    }

    if (action === "stop") {
      const proc = LSP_PROCESSES[id];
      if (proc) {
        proc.kill();
        delete LSP_PROCESSES[id];
      }
      await db.update(schema.lspServers)
        .set({ status: "stopped", updatedAt: new Date() })
        .where(eq(schema.lspServers.id, id));

      const updated = await db.select().from(schema.lspServers).where(eq(schema.lspServers.id, id)).get();
      return NextResponse.json({ server: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[/api/lsp/servers/[id] PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to manage server" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: Context
) {
  try {
    const { id } = await ctx.params;

    const proc = LSP_PROCESSES[id];
    if (proc) {
      proc.kill();
      delete LSP_PROCESSES[id];
    }

    const db = getDb();
    await db.delete(schema.lspServers).where(eq(schema.lspServers.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/lsp/servers/[id] DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete server" }, { status: 500 });
  }
}
