import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { execSync } from "child_process";
import fs from "fs";

function runCommand(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const { id } = params;
    const body = await request.json();
    const { isActive } = body as { isActive?: boolean };

    const db = getDb();
    const worktree = await db.select().from(schema.worktrees).where(eq(schema.worktrees.id, id)).get();

    if (!worktree) {
      return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (isActive !== undefined) updates.isActive = isActive;

    await db.update(schema.worktrees).set(updates).where(eq(schema.worktrees.id, id));

    const updated = await db.select().from(schema.worktrees).where(eq(schema.worktrees.id, id)).get();

    return NextResponse.json({ success: true, worktree: updated });
  } catch (error) {
    console.error("[/api/worktrees/[id] PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update worktree" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const archiveOnly = searchParams.get("archive") === "true";

    const db = getDb();
    const worktree = await db.select().from(schema.worktrees).where(eq(schema.worktrees.id, id)).get();

    if (!worktree) {
      return NextResponse.json({ error: "Worktree not found" }, { status: 404 });
    }

    if (fs.existsSync(worktree.path)) {
      if (archiveOnly) {
        runCommand(`git -C "${worktree.path}" worktree remove --force "${worktree.path}" 2>/dev/null || true`);
      } else {
        fs.rmSync(worktree.path, { recursive: true, force: true });
      }
    }

    await db.delete(schema.worktrees).where(eq(schema.worktrees.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/worktrees/[id] DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete worktree" }, { status: 500 });
  }
}
