import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: Context) {
  try {
    const { id } = await ctx.params;
    const db = getDb();

    const provider = await db.select().from(schema.ticketProviderConfigs).where(eq(schema.ticketProviderConfigs.id, id)).get();

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const config = JSON.parse(provider.config as string);

    if (provider.provider === "github") {
      return await importFromGitHub(db, config, id);
    } else if (provider.provider === "jira") {
      return NextResponse.json({ error: "Jira import not yet implemented" }, { status: 501 });
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    console.error("[/api/ticket-providers/[id]/import POST] Error:", error);
    return NextResponse.json({ error: "Failed to import tickets" }, { status: 500 });
  }
}

async function importFromGitHub(db: ReturnType<typeof import("@/lib/db").getDb>, config: Record<string, string>, providerId: string) {
  const { repo, token } = config;

  if (!repo) {
    return NextResponse.json({ error: "GitHub repo is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=50`, {
    headers,
  });

  if (!response.ok) {
    return NextResponse.json({ error: `GitHub API error: ${response.status}` }, { status: response.status });
  }

  const issues = await response.json() as Array<{
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: Array<{ name: string }>;
    created_at: string;
    updated_at: string;
  }>;

  let imported = 0;
  let updated = 0;

  for (const issue of issues) {
    const existingTicket = await db
      .select()
      .from(schema.kanbanTickets)
      .where(eq(schema.kanbanTickets.sourceId, `github-${issue.id}`))
      .get();

    const priority = issue.labels.some((l) => l.name.toLowerCase().includes("urgent"))
      ? "urgent"
      : issue.labels.some((l) => l.name.toLowerCase().includes("high"))
        ? "high"
        : issue.labels.some((l) => l.name.toLowerCase().includes("low"))
          ? "low"
          : "medium";

    const column = issue.state === "open" ? "todo" : "done";

    if (existingTicket) {
      await db
        .update(schema.kanbanTickets)
        .set({
          title: issue.title,
          description: issue.body || null,
          column,
          updatedAt: new Date(),
        })
        .where(eq(schema.kanbanTickets.id, existingTicket.id));
      updated++;
    } else {
      const now = new Date();
      await db.insert(schema.kanbanTickets).values({
        id: randomUUID(),
        title: issue.title,
        description: issue.body || null,
        column,
        position: 0,
        priority,
        assignee: null,
        labels: issue.labels.map((l) => l.name).join(","),
        dueDate: null,
        sourceId: `github-${issue.id}`,
        sourceProvider: providerId,
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }
  }

  return NextResponse.json({
    success: true,
    imported,
    updated,
    total: issues.length,
  });
}
