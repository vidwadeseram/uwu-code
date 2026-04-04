import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { execSync } from "child_process";

const LANGUAGE_SERVERS: Record<string, { command: string; argsTemplate: string }> = {
  typescript: { command: "typescript-language-server", argsTemplate: "--stdio" },
  python: { command: "pylsp", argsTemplate: "" },
  rust: { command: "rust-analyzer", argsTemplate: "" },
  go: { command: "gopls", argsTemplate: "" },
  ruby: { command: "solargraph", argsTemplate: "stdio" },
  java: { command: "jdtls", argsTemplate: "" },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ worktreeId: string }> }
) {
  try {
    const { worktreeId } = await params;
    const db = getDb();
    const servers = await db
      .select()
      .from(schema.lspServers)
      .where(eq(schema.lspServers.worktreeId, worktreeId));

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("[/api/lsp/[worktreeId] GET] Error:", error);
    return NextResponse.json({ error: "Failed to get LSP servers" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ worktreeId: string }> }
) {
  try {
    const { worktreeId } = await params;
    const body = await request.json();
    const { language, command, args } = body;

    if (!language) {
      return NextResponse.json({ error: "language is required" }, { status: 400 });
    }

    const db = getDb();

    const worktree = await db
      .select()
      .from(schema.worktrees)
      .where(eq(schema.worktrees.id, worktreeId))
      .get();

    if (!worktree) {
      return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
    }

    const serverConfig = LANGUAGE_SERVERS[language] || {
      command: command || language + "-language-server",
      argsTemplate: "--stdio",
    };

    const id = randomUUID();
    const now = new Date();

    const freePort = await findFreePort();

    await db.insert(schema.lspServers).values({
      id,
      worktreeId,
      language,
      command: command || serverConfig.command,
      args: args || serverConfig.argsTemplate,
      port: freePort,
      status: "stopped",
      createdAt: now,
      updatedAt: now,
    });

    const server = await db
      .select()
      .from(schema.lspServers)
      .where(eq(schema.lspServers.id, id))
      .get();

    return NextResponse.json({ server }, { status: 201 });
  } catch (error) {
    console.error("[/api/lsp/[worktreeId] POST] Error:", error);
    return NextResponse.json({ error: "Failed to create LSP server" }, { status: 500 });
  }
}

async function findFreePort(): Promise<number> {
  const start = 9000 + Math.floor(Math.random() * 1000);
  for (let port = start; port < start + 100; port++) {
    try {
      execSync(`lsof -i:${port} -t > /dev/null 2>&1 || echo "free"`, { encoding: "utf-8" });
      const result = execSync(`lsof -i:${port} -t 2>/dev/null || echo ""`, { encoding: "utf-8" }).trim();
      if (!result) {
        return port;
      }
    } catch {
      return port;
    }
  }
  return start;
}
