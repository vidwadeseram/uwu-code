import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    const allSettings = await db.select().from(schema.settings);
    const settings: Record<string, string> = {};
    for (const s of allSettings) {
      settings[s.key] = s.value;
    }
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[/api/settings GET] Error:", error);
    return NextResponse.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
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
    console.error("[/api/settings PUT] Error:", error);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}