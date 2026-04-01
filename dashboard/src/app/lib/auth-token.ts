const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret) return secret;
  throw new Error("AUTH_SECRET is required");
}

function toBase64Url(input: Uint8Array): string {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const base = Buffer.from(input, "base64url");
    return new Uint8Array(base);
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

async function signValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

interface SessionPayload {
  username: string;
  exp: number;
}

export async function createSessionToken(username: string): Promise<string> {
  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadRaw = JSON.stringify(payload);
  const payloadEncoded = toBase64Url(new TextEncoder().encode(payloadRaw));
  const signature = await signValue(payloadEncoded);
  return `${payloadEncoded}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = await signValue(payloadEncoded);
  } catch {
    return null;
  }
  if (!constantTimeEqual(signature, expectedSignature)) return null;

  const payloadBytes = fromBase64Url(payloadEncoded);
  if (!payloadBytes) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    if (typeof payload.username !== "string" || payload.username.trim().length === 0) return null;
    if (typeof payload.exp !== "number") return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
