import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const db = getDb();
    const configs = await db.select().from(schema.ticketProviderConfigs);
    return NextResponse.json({ providers: configs });
  } catch (error) {
    console.error("[/api/ticket-providers GET] Error:", error);
    return NextResponse.json({ error: "Failed to get providers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, config } = body;

    if (!provider || !config) {
      return NextResponse.json({ error: "provider and config are required" }, { status: 400 });
    }

    if (!["github", "jira"].includes(provider)) {
      return NextResponse.json({ error: "provider must be github or jira" }, { status: 400 });
    }

    const db = getDb();
    const id = randomUUID();
    const now = new Date();

    await db.insert(schema.ticketProviderConfigs).values({
      id,
      provider,
      config: JSON.stringify(config),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const result = await db.select().from(schema.ticketProviderConfigs).where(eq(schema.ticketProviderConfigs.id, id)).get();
    return NextResponse.json({ provider: result }, { status: 201 });
  } catch (error) {
    console.error("[/api/ticket-providers POST] Error:", error);
    return NextResponse.json({ error: "Failed to create provider" }, { status: 500 });
  }
}
