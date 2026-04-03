import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const db = getDb();
    const scripts = projectId
      ? await db.select().from(schema.scripts).where(eq(schema.scripts.projectId, projectId))
      : await db.select().from(schema.scripts);

    return NextResponse.json({ scripts });
  } catch (error) {
    console.error("[/api/scripts GET] Error:", error);
    return NextResponse.json({ error: "Failed to get scripts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, name, description, content, isFavorite } = body;

    if (!projectId || !name || !content) {
      return NextResponse.json({ error: "projectId, name, and content are required" }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.scripts).values({
      id,
      projectId,
      name,
      description: description || null,
      content,
      isFavorite: isFavorite || false,
      runCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    const script = await db.select().from(schema.scripts).where(eq(schema.scripts.id, id)).get();
    return NextResponse.json({ script }, { status: 201 });
  } catch (error) {
    console.error("[/api/scripts POST] Error:", error);
    return NextResponse.json({ error: "Failed to create script" }, { status: 500 });
  }
}