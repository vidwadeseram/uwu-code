import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const key = params.key;
    const db = getDb();
    const setting = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();

    if (!setting) {
      return NextResponse.json({ error: "Setting not found" }, { status: 404 });
    }

    return NextResponse.json({ key: setting.key, value: setting.value });
  } catch (error) {
    console.error("[/api/settings/[key] GET] Error:", error);
    return NextResponse.json({ error: "Failed to get setting" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const key = params.key;
    const body = await request.json();
    const { value } = body;

    if (value === undefined) {
      return NextResponse.json({ error: "value is required" }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).get();

    if (existing) {
      await db
        .update(schema.settings)
        .set({ value: String(value), updatedAt: new Date() })
        .where(eq(schema.settings.key, key));
    } else {
      await db.insert(schema.settings).values({
        key,
        value: String(value),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/settings/[key] PUT] Error:", error);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const key = params.key;
    const db = getDb();
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/settings/[key] DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete setting" }, { status: 500 });
  }
}