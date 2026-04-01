import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { allowedWorkspaceRoots } from "@/app/lib/discoverer";

export const dynamic = "force-dynamic";

const DASHBOARD_REPO_ROOT = path.join(process.cwd(), "..");

interface CommitRequest {
  files?: string[];
  message?: string;
}

interface GitRunResult {
  stdout: string;
  stderr: string;
  code: number;
}

interface TargetFile {
  abs: string;
  rel: string;
}

function normalizeRepoPath(input: string): string {
  return path.resolve(input).replace(/\\/g, "/").replace(/\/+$/, "");
}

function allowedGitRoots(): string[] {
  return Array.from(
    new Set([
      normalizeRepoPath(DASHBOARD_REPO_ROOT),
      ...allowedWorkspaceRoots().map((root) => normalizeRepoPath(root)),
    ])
  );
}

function isUnderAnyAllowedRoot(candidate: string): boolean {
  const normalized = normalizeRepoPath(candidate);
  return allowedGitRoots().some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

function runGit(cwd: string, args: string[]): Promise<GitRunResult> {
  return new Promise((resolve) => {
    execFile("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      let code = 0;
      if (error) {
        const rawCode = (error as NodeJS.ErrnoException).code;
        if (typeof rawCode === "number") {
          code = rawCode;
        } else if (typeof rawCode === "string") {
          const parsedCode = Number(rawCode);
          code = Number.isFinite(parsedCode) ? parsedCode : 1;
        } else {
          code = 1;
        }
      }
      resolve({
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        code,
      });
    });
  });
}

async function discoverGitRoot(absPath: string): Promise<string | null> {
  const probePath = (() => {
    try {
      if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
        return absPath;
      }
    } catch {}
    return path.dirname(absPath);
  })();

  const rootResult = await runGit(probePath, ["rev-parse", "--show-toplevel"]);
  if (rootResult.code !== 0) return null;
  const root = normalizeRepoPath(rootResult.stdout.trim());
  if (!root) return null;
  if (!isUnderAnyAllowedRoot(root)) return null;
  return root;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = (body ?? {}) as CommitRequest;
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    return NextResponse.json({ error: "files[] required" }, { status: 400 });
  }

  const message = (parsed.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Commit message required" }, { status: 400 });
  }

  const byRepo = new Map<string, TargetFile[]>();

  for (const rawFile of parsed.files) {
    const trimmed = typeof rawFile === "string" ? rawFile.trim() : "";
    if (!trimmed) continue;
    const abs = path.resolve(trimmed);
    if (!isUnderAnyAllowedRoot(abs)) continue;

    const repoRoot = await discoverGitRoot(abs);
    if (!repoRoot) continue;

    const rel = path.relative(repoRoot, abs).replace(/\\/g, "/");
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;

    const group = byRepo.get(repoRoot) ?? [];
    if (!group.some((entry) => entry.rel === rel)) {
      group.push({ abs, rel });
      byRepo.set(repoRoot, group);
    }
  }

  if (byRepo.size === 0) {
    return NextResponse.json({ error: "No valid files under allowed git repositories" }, { status: 400 });
  }

  const commits: Array<{ repoRoot: string; commit: string; summary: string; files: string[] }> = [];
  const committedFiles: string[] = [];

  for (const [repoRoot, targets] of Array.from(byRepo.entries())) {
    const relTargets = targets.map((t) => t.rel);
    const addResult = await runGit(repoRoot, ["add", "--", ...relTargets]);
    if (addResult.code !== 0) {
      return NextResponse.json(
        { error: `git add failed in ${repoRoot}: ${addResult.stderr || addResult.stdout || "unknown error"}` },
        { status: 500 }
      );
    }

    const stagedResult = await runGit(repoRoot, ["diff", "--cached", "--name-only", "--", ...relTargets]);
    const stagedFiles = stagedResult.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (stagedFiles.length === 0) {
      continue;
    }

    const commitResult = await runGit(repoRoot, ["commit", "-m", message]);
    if (commitResult.code !== 0) {
      return NextResponse.json(
        { error: `git commit failed in ${repoRoot}: ${commitResult.stderr || commitResult.stdout || "unknown error"}` },
        { status: 500 }
      );
    }

    const headResult = await runGit(repoRoot, ["rev-parse", "--short", "HEAD"]);
    const hash = headResult.stdout.trim();
    const absoluteFiles = stagedFiles.map((rel) => path.join(repoRoot, rel).replace(/\\/g, "/"));

    commits.push({
      repoRoot,
      commit: hash,
      summary: commitResult.stdout.trim(),
      files: absoluteFiles,
    });
    committedFiles.push(...absoluteFiles);
  }

  if (commits.length === 0) {
    return NextResponse.json({ error: "No staged changes to commit" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    commit: commits.length === 1 ? commits[0].commit : `${commits.length} commits`,
    summary: commits.map((entry) => `[${entry.repoRoot}] ${entry.summary}`).join("\n\n"),
    files: committedFiles,
    commits,
  });
}
