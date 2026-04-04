import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/app/lib/auth-token";

const LOGIN_PATH = "/login";
const PUBLIC_API_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/check",
]);

const INTERNAL_SECRET = process.env.AUTH_SECRET?.trim();

function isAgentAuthenticated(request: NextRequest): boolean {
  if (request.headers.get("x-agent-source") !== "openclaw") {
    return false;
  }
  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return false;
  }
  const agentKey = process.env.AGENT_API_KEY?.trim();
  if (!agentKey) return false;
  const token = authHeader.slice(7);
  return token === agentKey;
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  if (INTERNAL_SECRET && request.headers.get("x-internal-secret") === INTERNAL_SECRET) {
    return true;
  }
  if (isAgentAuthenticated(request)) {
    return true;
  }
  const token = request.cookies.get("uwu_session")?.value;
  const payload = await verifySessionToken(token);
  return !!payload;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(request);

  if (pathname === LOGIN_PATH) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL(LOGIN_PATH, request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
