import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const provider = await db.select().from(schema.ticketProviderConfigs).where(eq(schema.ticketProviderConfigs.id, id)).get();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (error) {
    console.error("[/api/ticket-providers/[id] GET] Error:", error);
    return NextResponse.json({ error: "Failed to get provider" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const { config, isActive } = body;

    const db = getDb();
    const existing = await db.select().from(schema.ticketProviderConfigs).where(eq(schema.ticketProviderConfigs.id, id)).get();

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (config !== undefined) updates.config = JSON.stringify(config);
    if (isActive !== undefined) updates.isActive = isActive;

    await db.update(schema.ticketProviderConfigs).set(updates).where(eq(schema.ticketProviderConfigs.id, id));

    const result = await db.select().from(schema.ticketProviderConfigs).where(eq(schema.ticketProviderConfigs.id, id)).get();
    return NextResponse.json({ provider: result });
  } catch (error) {
    console.error("[/api/ticket-providers/[id] PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update provider" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    await db.delete(schema.ticketProviderConfigs).where(eq(schema.ticketProviderConfigs.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/ticket-providers/[id] DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete provider" }, { status: 500 });
  }
}
