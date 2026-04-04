import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const db = getDb();
    const connection = await db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, params.id))
      .get();

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const sourceWorktree = await db
      .select()
      .from(schema.worktrees)
      .where(eq(schema.worktrees.id, connection.sourceWorktreeId))
      .get();
    const targetWorktree = await db
      .select()
      .from(schema.worktrees)
      .where(eq(schema.worktrees.id, connection.targetWorktreeId))
      .get();

    return NextResponse.json({
      connection: {
        ...connection,
        sourceWorktree,
        targetWorktree,
      },
    });
  } catch (error) {
    console.error("[/api/connections/[id] GET] Error:", error);
    return NextResponse.json({ error: "Failed to get connection" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const body = await request.json();
    const { notes, type } = body;

    const db = getDb();
    const existing = await db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, params.id))
      .get();

    if (!existing) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (notes !== undefined) updates.notes = notes;
    if (type !== undefined) updates.type = type;

    await db
      .update(schema.connections)
      .set(updates)
      .where(eq(schema.connections.id, params.id));

    const connection = await db
      .select()
      .from(schema.connections)
      .where(eq(schema.connections.id, params.id))
      .get();

    return NextResponse.json({ connection });
  } catch (error) {
    console.error("[/api/connections/[id] PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update connection" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const db = getDb();
    await db
      .delete(schema.connections)
      .where(eq(schema.connections.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/connections/[id] DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}
