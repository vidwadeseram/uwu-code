/**
 * OpenCode Server Manager
 *
 * Manages OpenCode server instances per workspace.
 * Replaces CLI subprocess spawning with the HTTP API exposed by `opencode serve`.
 *
 * Architecture:
 *   - One opencode server per workspace (workspace → port mapping)
 *   - Tasks create sessions within the server
 *   - Messages are sent via HTTP, responses streamed via SSE
 *   - User intervention via permission response API
 */

import { spawn, ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import http from "http";
import { readEnvKeys } from "@/app/lib/settings";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpenCodeServer {
  id: string;
  workspace: string;
  port: number;
  hostname: string;
  pid: number;
  process: ChildProcess;
  startedAt: string;
  status: "starting" | "ready" | "error" | "stopped";
}

export interface OpenCodeSession {
  id: string;
  title?: string;
  parentID?: string;
  createdAt: string;
}

export interface OpenCodeMessage {
  info: {
    id: string;
    role: "user" | "assistant";
    sessionID: string;
    createdAt: string;
    [key: string]: unknown;
  };
  parts: OpenCodePart[];
}

export interface OpenCodePart {
  id: string;
  type: "text" | "tool-invocation" | "tool-result" | "reasoning" | "source" | "step-start" | "step-finish";
  text?: string;
  name?: string;
  state?: "call" | "partial-call" | "result";
  toolCallID?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  [key: string]: unknown;
}

export interface OpenCodeSessionStatus {
  [sessionID: string]: {
    status: "idle" | "running" | "error";
    currentTool?: string;
    messageCount?: number;
    [key: string]: unknown;
  };
}

export interface OpenCodeEvent {
  type: string;
  data: unknown;
  timestamp?: string;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  sessionId: string;
  serverId: string;
  timestamp: string;
  type: "message_sent" | "message_received" | "tool_call" | "tool_result" | "permission_request" | "error" | "status_change" | "diff";
  content: string;
  metadata?: Record<string, unknown>;
}

// ── Server Registry ──────────────────────────────────────────────────────────

const servers = new Map<string, OpenCodeServer>();
const BASE_PORT = 4100;
const MAX_PORT_ATTEMPTS = 100;
const REPO_ROOT = process.cwd().replace("/dashboard", "");

let nextPort = BASE_PORT;

export async function reconnectServers(): Promise<void> {
  const hostname = "127.0.0.1";
  for (let port = BASE_PORT; port < BASE_PORT + MAX_PORT_ATTEMPTS; port++) {
    try {
      const res = await fetch(`http://${hostname}:${port}/session/status`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        const id = randomUUID();
        const server: OpenCodeServer = {
          id,
          workspace: `reconnected:${port}`,
          port,
          hostname,
          pid: 0,
          process: null as unknown as ChildProcess,
          startedAt: new Date().toISOString(),
          status: "ready",
        };
        servers.set(id, server);
        console.log(`[opencode-server] Reconnected to existing server at port ${port}`);
        nextPort = port + 1;
        connectSSE(server);
      }
    } catch {}
  }
}

function getNextPort(): number {
  const port = nextPort;
  nextPort++;
  if (nextPort > BASE_PORT + MAX_PORT_ATTEMPTS) {
    nextPort = BASE_PORT;
  }
  return port;
}

// ── Activity Log ─────────────────────────────────────────────────────────────

const activityLog = new Map<string, TaskActivity[]>();
const MAX_ACTIVITY_PER_TASK = 500;

function logActivity(taskId: string, activity: Omit<TaskActivity, "id" | "timestamp">) {
  const entry: TaskActivity = {
    ...activity,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const log = activityLog.get(taskId) || [];
  log.push(entry);
  if (log.length > MAX_ACTIVITY_PER_TASK) {
    log.splice(0, log.length - MAX_ACTIVITY_PER_TASK);
  }
  activityLog.set(taskId, log);
}

export function getActivityLog(taskId: string): TaskActivity[] {
  return activityLog.get(taskId) || [];
}

export function clearActivityLog(taskId: string) {
  activityLog.delete(taskId);
}

// ── Task → Session mapping ───────────────────────────────────────────────────

const taskSessions = new Map<string, { serverId: string; sessionId: string }>();

export function getTaskSession(taskId: string) {
  return taskSessions.get(taskId);
}

export function setTaskSession(taskId: string, serverId: string, sessionId: string) {
  taskSessions.set(taskId, { serverId, sessionId });
}

export function deleteTaskSession(taskId: string) {
  taskSessions.delete(taskId);
}

export function getAllTaskSessions(): Record<string, { serverId: string; sessionId: string }> {
  return Object.fromEntries(taskSessions.entries());
}

function findTaskBySession(serverId: string, sessionId: string): string | undefined {
  for (const [taskId, mapping] of taskSessions.entries()) {
    if (mapping.serverId === serverId && mapping.sessionId === sessionId) {
      return taskId;
    }
  }
  return undefined;
}

// ── SSE Streaming ────────────────────────────────────────────────────────────

interface SSEConnection {
  serverId: string;
  connected: boolean;
  req: http.ClientRequest | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

const sseConnections = new Map<string, SSEConnection>();

function connectSSE(server: OpenCodeServer): void {
  if (sseConnections.has(server.id)) return;

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (password) {
    const username = process.env.OPENCODE_SERVER_USERNAME || "opencode";
    headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  const conn: SSEConnection = { serverId: server.id, connected: false, req: null, reconnectTimer: null };
  sseConnections.set(server.id, conn);

  const req = http.request(
    { hostname: server.hostname, port: server.port, path: "/event", method: "GET", headers },
    (res) => {
      if (res.statusCode !== 200) {
        console.error(`[sse] Connection to ${server.id} failed: ${res.statusCode}`);
        scheduleReconnect(server);
        return;
      }

      conn.connected = true;
      console.log(`[sse] Connected to server ${server.id}`);

      let buffer = "";
      let eventType = "";
      let eventData = "";

      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData += line.slice(6);
          } else if (line === "" && (eventType || eventData)) {
            if (eventData) {
              handleSSEEvent(server.id, eventType || "message", eventData);
            }
            eventType = "";
            eventData = "";
          } else if (line.startsWith("id: ") || line.startsWith(":")) {
          }
        }
      });

      res.on("end", () => {
        conn.connected = false;
        conn.req = null;
        console.log(`[sse] Connection closed for server ${server.id}`);
        sseConnections.delete(server.id);
        scheduleReconnect(server);
      });
    },
  );

  req.on("error", (err) => {
    conn.connected = false;
    conn.req = null;
    console.error(`[sse] Error for server ${server.id}:`, (err as Error).message);
    sseConnections.delete(server.id);
    scheduleReconnect(server);
  });

  req.end();
  conn.req = req;
}

function scheduleReconnect(server: OpenCodeServer): void {
  const existing = sseConnections.get(server.id);
  if (existing?.reconnectTimer) clearTimeout(existing.reconnectTimer);

  if (server.status !== "ready") return;

  const timer = setTimeout(() => {
    const s = servers.get(server.id);
    if (s && s.status === "ready") {
      console.log(`[sse] Reconnecting to server ${server.id}`);
      connectSSE(s);
    }
  }, 5000);

  if (existing) existing.reconnectTimer = timer;
}

function handleSSEEvent(serverId: string, eventType: string, rawData: string): void {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawData);
  } catch {
    return;
  }

  const props = (data.properties || data) as Record<string, unknown>;
  const sessionId = extractSessionId(props);
  if (!sessionId) return;

  const taskId = findTaskBySession(serverId, sessionId);
  if (!taskId) return;

  const dedupeKey = `${eventType}:${(data.id as string) || ""}:${sessionId}`;
  const log = activityLog.get(taskId) || [];
  if (log.some((a) => a.metadata?.dedupeKey === dedupeKey)) return;

  const activityBase = { taskId, sessionId, serverId };

  if (eventType === "message.updated") {
    const info = (props.info || props) as Record<string, unknown>;
    const role = info.role as string;
    const parts = info.parts as OpenCodePart[] | undefined;
    if (parts) {
      for (const part of parts) {
        const partKey = `${dedupeKey}:${part.id}`;
        if (log.some((a) => a.metadata?.dedupeKey === partKey)) continue;

        if (part.type === "text" && part.text && role === "assistant") {
          logActivity(taskId, {
            ...activityBase,
            type: "message_received",
            content: part.text.slice(0, 500),
            metadata: { dedupeKey: partKey, partId: part.id },
          });
        } else if (part.type === "tool-invocation" && part.state === "call") {
          logActivity(taskId, {
            ...activityBase,
            type: "tool_call",
            content: `${part.name || "tool"}(${formatArgs(part.args as Record<string, unknown>)})`,
            metadata: { dedupeKey: partKey, partId: part.id, toolName: part.name },
          });
        } else if (part.type === "tool-result") {
          logActivity(taskId, {
            ...activityBase,
            type: "tool_result",
            content: formatResult(part.result),
            metadata: { dedupeKey: partKey, partId: part.id },
          });
        }
      }
    }
  } else if (eventType === "message.part.updated") {
    const part = (props.part || props) as OpenCodePart;
    const partKey = `${dedupeKey}:${part.id}`;
    if (!log.some((a) => a.metadata?.dedupeKey === partKey)) {
      if (part.type === "text" && part.text) {
        const existing = log.find((a) => a.metadata?.partId === part.id && a.type === "message_received");
        if (existing) {
          existing.content = part.text.slice(0, 500);
        } else {
          logActivity(taskId, {
            ...activityBase,
            type: "message_received",
            content: part.text.slice(0, 500),
            metadata: { dedupeKey: partKey, partId: part.id },
          });
        }
      }
    }
  } else if (eventType === "session.idle") {
    logActivity(taskId, {
      ...activityBase,
      type: "status_change",
      content: "Session idle",
      metadata: { dedupeKey },
    });
  } else if (eventType === "session.error") {
    logActivity(taskId, {
      ...activityBase,
      type: "error",
      content: (props.error as string) || "Session error",
      metadata: { dedupeKey },
    });
  } else if (eventType === "session.updated") {
    const info = props.info as Record<string, unknown> | undefined;
    if (info?.title) {
      logActivity(taskId, {
        ...activityBase,
        type: "status_change",
        content: `Session: ${info.title}`,
        metadata: { dedupeKey },
      });
    }
  } else if (eventType === "file.edited") {
    logActivity(taskId, {
      ...activityBase,
      type: "diff",
      content: `Edited: ${props.file || "unknown file"}`,
      metadata: { dedupeKey, file: props.file },
    });
  } else if (eventType === "permission.updated") {
    logActivity(taskId, {
      ...activityBase,
      type: "permission_request",
      content: (props.title as string) || "Permission requested",
      metadata: { dedupeKey },
    });
  }
}

function extractSessionId(data: Record<string, unknown>): string | undefined {
  return (
    (data.sessionID as string) ||
    (data.sessionId as string) ||
    (data.session_id as string) ||
    ((data.info as Record<string, string>)?.sessionID) ||
    ((data.info as Record<string, string>)?.id) ||
    undefined
  );
}

// ── Server lifecycle ─────────────────────────────────────────────────────────

export async function getOrCreateServer(workspace: string): Promise<OpenCodeServer> {
  // Reuse existing server for this workspace
  for (const [, server] of servers) {
    if (server.workspace === workspace && server.status !== "stopped" && server.status !== "error") {
      return server;
    }
  }
  return startServer(workspace);
}

export async function startServer(workspace: string): Promise<OpenCodeServer> {
  const existing = getServerForWorkspace(workspace);
  if (existing && existing.status === "ready") return existing;

  const id = randomUUID();
  const port = getNextPort();
  const hostname = "127.0.0.1";

  const proc = spawn(
    "opencode",
    ["serve", "--port", String(port), "--hostname", hostname, "--cors", "http://localhost:3000"],
    {
      cwd: workspace,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...readEnvKeys(),
        TERM: "dumb",
      },
    }
  );
  proc.unref();

  const server: OpenCodeServer = {
    id,
    workspace,
    port,
    hostname,
    pid: proc.pid!,
    process: proc,
    startedAt: new Date().toISOString(),
    status: "starting",
  };

  servers.set(id, server);

  proc.on("error", (err) => {
    console.error(`[opencode-server] Server ${id} error:`, err);
    server.status = "error";
  });

  proc.on("exit", (code) => {
    console.log(`[opencode-server] Server ${id} exited with code ${code}`);
    server.status = "stopped";
  });

  // Capture stderr for debugging
  proc.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.error(`[opencode-server:${id}] ${msg}`);
  });

  // Wait for server to be ready
  const ready = await waitForReady(hostname, port, 30_000);
  if (!ready) {
    server.status = "error";
    throw new Error(`OpenCode server failed to start on port ${port} for workspace ${workspace}`);
  }

  server.status = "ready";
  console.log(`[opencode-server] Server ${id} ready at http://${hostname}:${port} (workspace: ${workspace})`);
  connectSSE(server);
  return server;
}

export async function stopServer(serverId: string): Promise<void> {
  const server = servers.get(serverId);
  if (!server) return;
  const conn = sseConnections.get(serverId);
  if (conn) {
    conn.req?.destroy();
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
    sseConnections.delete(serverId);
  }
  try { server.process.kill("SIGTERM"); } catch { /* already dead */ }
  server.status = "stopped";
  servers.delete(serverId);
}

export function getServer(serverId: string): OpenCodeServer | undefined {
  return servers.get(serverId);
}

export function getAllServers(): OpenCodeServer[] {
  return Array.from(servers.values());
}

export function getServerForWorkspace(workspace: string): OpenCodeServer | undefined {
  for (const [, server] of servers) {
    if (server.workspace === workspace && server.status === "ready") {
      return server;
    }
    if (server.workspace.startsWith("reconnected:") && server.status === "ready") {
      return server;
    }
  }
  return undefined;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function waitForReady(hostname: string, port: number, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://${hostname}:${port}/global/health`);
      if (res.ok) return true;
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function serverFetch<T>(server: OpenCodeServer, path: string, init?: RequestInit): Promise<T> {
  const url = `http://${server.hostname}:${server.port}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init?.headers as Record<string, string> || {}),
  };

  // Add auth if configured
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (password) {
    const username = process.env.OPENCODE_SERVER_USERNAME || "opencode";
    headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode server error ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Session API ──────────────────────────────────────────────────────────────

export async function createSession(server: OpenCodeServer, title?: string): Promise<OpenCodeSession> {
  return serverFetch<OpenCodeSession>(server, "/session", {
    method: "POST",
    body: JSON.stringify({ title: title || "Task session" }),
  });
}

export async function listSessions(server: OpenCodeServer): Promise<OpenCodeSession[]> {
  return serverFetch<OpenCodeSession[]>(server, "/session");
}

export async function getSessionStatus(server: OpenCodeServer): Promise<OpenCodeSessionStatus> {
  return serverFetch<OpenCodeSessionStatus>(server, "/session/status");
}

export async function abortSession(server: OpenCodeServer, sessionId: string): Promise<boolean> {
  await serverFetch<void>(server, `/session/${sessionId}/abort`, {
    method: "POST",
  });
  return true;
}

export async function deleteSession(server: OpenCodeServer, sessionId: string): Promise<boolean> {
  await serverFetch<void>(server, `/session/${sessionId}`, {
    method: "DELETE",
  });
  return true;
}

// ── Message API ──────────────────────────────────────────────────────────────

export async function sendMessage(
  server: OpenCodeServer,
  sessionId: string,
  message: string,
  options?: { agent?: string; model?: string }
): Promise<unknown> {
  return serverFetch(server, `/session/${sessionId}/message`, {
    method: "POST",
    body: JSON.stringify({
      ...getModelProvider(),
      parts: [{ type: "text", text: message }],
    }),
  });
}

export async function sendMessageAsync(
  server: OpenCodeServer,
  sessionId: string,
  message: string,
  options?: { agent?: string; model?: string }
): Promise<void> {
  const url = `http://${server.hostname}:${server.port}/session/${sessionId}/message`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const password = process.env.OPENCODE_SERVER_PASSWORD;
  if (password) {
    const username = process.env.OPENCODE_SERVER_USERNAME || "opencode";
    headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }

  const body = JSON.stringify({
    ...getModelProvider(),
    parts: [{ type: "text", text: message }],
  });

  fetch(url, { method: "POST", headers, body }).catch((err) => {
    console.error(`[opencode-server] Async message failed:`, (err as Error).message);
  });
}

export async function getMessages(
  server: OpenCodeServer,
  sessionId: string,
  limit?: number
): Promise<OpenCodeMessage[]> {
  const query = limit ? `?limit=${limit}` : "";
  return serverFetch<OpenCodeMessage[]>(server, `/session/${sessionId}/message${query}`);
}

export async function getSessionDiff(
  server: OpenCodeServer,
  sessionId: string,
  messageID?: string
): Promise<unknown[]> {
  const query = messageID ? `?messageID=${messageID}` : "";
  return serverFetch<unknown[]>(server, `/session/${sessionId}/diff${query}`);
}

function getModelProvider(): { modelID: string; providerID: string } {
  const keys = readEnvKeys();
  if (keys.OPENROUTER_API_KEY) {
    return { modelID: "anthropic/claude-sonnet-4", providerID: "openrouter" };
  }
  if (keys.ANTHROPIC_API_KEY) {
    return { modelID: "claude-sonnet-4-20250514", providerID: "anthropic" };
  }
  if (keys.OPENAI_API_KEY) {
    return { modelID: "gpt-4o", providerID: "openai" };
  }
  return { modelID: "anthropic/claude-sonnet-4", providerID: "openrouter" };
}

// ── Permission API (user intervention) ───────────────────────────────────────

export async function respondToPermission(
  server: OpenCodeServer,
  sessionId: string,
  permissionId: string,
  response: "allow" | "deny",
  remember?: boolean
): Promise<boolean> {
  return serverFetch<boolean>(server, `/session/${sessionId}/permissions/${permissionId}`, {
    method: "POST",
    body: JSON.stringify({ response, remember }),
  });
}

// ── High-level task execution ────────────────────────────────────────────────

export interface RunTaskOptions {
  taskId: string;
  title: string;
  description: string;
  workspace: string;
  type: "coding" | "research";
  preferredTool?: "opencode" | "auto";
}

export async function runTaskViaServer(opts: RunTaskOptions): Promise<{
  serverId: string;
  sessionId: string;
}> {
  const server = await getOrCreateServer(opts.workspace);
  const session = await createSession(server, opts.title);

  // Track the mapping
  setTaskSession(opts.taskId, server.id, session.id);
  logActivity(opts.taskId, {
    taskId: opts.taskId,
    sessionId: session.id,
    serverId: server.id,
    type: "status_change",
    content: "Session created, sending task prompt",
  });

  // Build the prompt based on task type
  const prompt = buildTaskPrompt(opts);

  // Send message asynchronously (don't wait for completion)
  await sendMessageAsync(server, session.id, prompt);

  logActivity(opts.taskId, {
    taskId: opts.taskId,
    sessionId: session.id,
    serverId: server.id,
    type: "message_sent",
    content: prompt.slice(0, 200),
    metadata: { fullPrompt: prompt },
  });

  return { serverId: server.id, sessionId: session.id };
}

function buildTaskPrompt(opts: RunTaskOptions): string {
  const ws = opts.workspace || "/opt/workspaces";

  if (opts.type === "coding") {
    return (
      `Execute this scheduled coding task: ${opts.title}\n\n` +
      `Description: ${opts.description}\n` +
      `Target workspace: ${ws}\n\n` +
      `Use your tools (Bash, Edit, Write, etc.) to complete this task fully in the target workspace.\n\n` +
      `When done, call scheduler_update_task MCP tool: task_id="${opts.taskId}", ` +
      `status="completed" or "failed", report=<summary>, ` +
      `completed_at=<ISO timestamp>, last_run_at=<ISO timestamp>, last_run_status="completed" or "failed".`
    );
  }

  return (
    `You are executing scheduled research task "${opts.title}".\n\n` +
    `Task: ${opts.description}\n\n` +
    `Research and answer this thoroughly. Use WebSearch or WebFetch if helpful.\n\n` +
    `When done, call scheduler_update_task MCP tool: task_id="${opts.taskId}", ` +
    `status="completed" or "failed", report=<findings>, ` +
    `completed_at=<ISO timestamp>, last_run_at=<ISO timestamp>, last_run_status="completed" or "failed".`
  );
}

// ── Activity polling (for dashboard) ─────────────────────────────────────────

export interface TaskStatus {
  serverId: string;
  sessionId: string;
  sessionStatus: "idle" | "running" | "error";
  messageCount: number;
  lastActivity: string;
  activity: TaskActivity[];
  currentTool?: string;
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus | null> {
  const mapping = taskSessions.get(taskId);
  if (!mapping) return null;

  const server = servers.get(mapping.serverId);
  if (!server || server.status !== "ready") {
    return {
      ...mapping,
      sessionStatus: "error",
      messageCount: 0,
      lastActivity: "",
      activity: getActivityLog(taskId),
    };
  }

  try {
    const statuses = await getSessionStatus(server);
    const sessionStatus = statuses[mapping.sessionId];
    const messages = await getMessages(server, mapping.sessionId, 20);

    const polledActivity: TaskActivity[] = [];
    const existingLog = getActivityLog(taskId);
    const loggedPartIds = new Set(existingLog.filter((a) => a.metadata?.partId).map((a) => a.metadata?.partId));

    for (const msg of messages) {
      for (const part of msg.parts || []) {
        if (loggedPartIds.has(part.id)) continue;
        if (part.type === "tool-invocation" && part.state === "call") {
          polledActivity.push({
            id: randomUUID(), taskId, sessionId: mapping.sessionId, serverId: mapping.serverId,
            timestamp: msg.info.createdAt || new Date().toISOString(),
            type: "tool_call",
            content: `${part.name || "tool"}(${formatArgs(part.args as Record<string, unknown>)})`,
            metadata: { partId: part.id, messageId: msg.info.id },
          });
        } else if (part.type === "tool-result") {
          polledActivity.push({
            id: randomUUID(), taskId, sessionId: mapping.sessionId, serverId: mapping.serverId,
            timestamp: msg.info.createdAt || new Date().toISOString(),
            type: "tool_result",
            content: formatResult(part.result),
            metadata: { partId: part.id, messageId: msg.info.id },
          });
        } else if (part.type === "text" && part.text && msg.info.role === "assistant") {
          polledActivity.push({
            id: randomUUID(), taskId, sessionId: mapping.sessionId, serverId: mapping.serverId,
            timestamp: msg.info.createdAt || new Date().toISOString(),
            type: "message_received",
            content: part.text.slice(0, 300),
            metadata: { partId: part.id, messageId: msg.info.id },
          });
        }
      }
    }

    if (polledActivity.length > 0) {
      const log = activityLog.get(taskId) || [];
      log.push(...polledActivity);
      activityLog.set(taskId, log);
    }

    return {
      ...mapping,
      sessionStatus: sessionStatus?.status || (messages.length > 0 ? "idle" : "idle"),
      messageCount: messages.length,
      lastActivity: new Date().toISOString(),
      activity: getActivityLog(taskId),
      currentTool: sessionStatus?.currentTool,
    };
  } catch (err) {
    return {
      ...mapping,
      sessionStatus: "error",
      messageCount: 0,
      lastActivity: "",
      activity: getActivityLog(taskId),
    };
  }
}

// ── User intervention ────────────────────────────────────────────────────────

export async function sendUserMessage(taskId: string, message: string): Promise<boolean> {
  const mapping = taskSessions.get(taskId);
  if (!mapping) throw new Error("No session found for task");

  const server = servers.get(mapping.serverId);
  if (!server || server.status !== "ready") throw new Error("Server not available");

  logActivity(taskId, {
    taskId,
    sessionId: mapping.sessionId,
    serverId: mapping.serverId,
    type: "message_sent",
    content: `[User intervention] ${message}`,
  });

  await sendMessageAsync(server, mapping.sessionId, message);
  return true;
}

export async function abortTask(taskId: string): Promise<boolean> {
  const mapping = taskSessions.get(taskId);
  if (!mapping) throw new Error("No session found for task");

  const server = servers.get(mapping.serverId);
  if (!server || server.status !== "ready") throw new Error("Server not available");

  logActivity(taskId, {
    taskId,
    sessionId: mapping.sessionId,
    serverId: mapping.serverId,
    type: "status_change",
    content: "Task aborted by user",
  });

  return abortSession(server, mapping.sessionId);
}

export async function getTaskDiff(taskId: string): Promise<unknown[]> {
  const mapping = taskSessions.get(taskId);
  if (!mapping) return [];

  const server = servers.get(mapping.serverId);
  if (!server || server.status !== "ready") return [];

  return getSessionDiff(server, mapping.sessionId);
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatArgs(args?: Record<string, unknown>): string {
  if (!args) return "";
  try {
    const str = JSON.stringify(args);
    return str.length > 100 ? str.slice(0, 100) + "..." : str;
  } catch {
    return String(args);
  }
}

function formatResult(result: unknown): string {
  if (!result) return "";
  try {
    const str = typeof result === "string" ? result : JSON.stringify(result);
    return str.length > 200 ? str.slice(0, 200) + "..." : str;
  } catch {
    return String(result);
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

export function cleanup() {
  for (const [, conn] of sseConnections) {
    conn.req?.destroy();
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer);
  }
  sseConnections.clear();
  for (const [id, server] of servers) {
    try {
      server.process.kill("SIGTERM");
    } catch {
      // Already dead
    }
    servers.delete(id);
  }
  activityLog.clear();
  taskSessions.clear();
}

process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
