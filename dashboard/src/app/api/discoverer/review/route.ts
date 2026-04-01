import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { allowedWorkspaceRoots } from "@/app/lib/discoverer";

export const dynamic = "force-dynamic";

const DASHBOARD_REPO_ROOT = path.join(process.cwd(), "..");
const MAX_DIFF_CHARS = 120_000;

interface ReviewRequest {
  files?: string[];
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

function normalizeGitPath(filePath: string): string {
  return filePath.replace(/^"|"$/g, "").replace(/\\/g, "/");
}

function classifyStatus(status: string): string {
  if (!status) return "clean";
  if (status === "??") return "untracked";
  if (status.includes("R")) return "renamed";
  if (status.includes("A")) return "added";
  if (status.includes("D")) return "deleted";
  if (status.includes("M")) return "modified";
  return "staged";
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

function parsePorcelainStatus(output: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of output.split("\n")) {
    if (!line.trim() || line.length < 4) continue;
    const rawStatus = line.slice(0, 2);
    let rawPath = line.slice(3).trim();
    if (rawPath.includes(" -> ")) {
      rawPath = rawPath.split(" -> ").at(-1) ?? rawPath;
    }
    map.set(normalizeGitPath(rawPath), rawStatus.trim() || rawStatus);
  }
  return map;
}

function clampDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]`;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = (body ?? {}) as ReviewRequest;
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    return NextResponse.json({ error: "files[] required" }, { status: 400 });
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

  const files: Array<{ path: string; relPath: string; repoRoot: string; status: string; diff: string }> = [];

  const reviewPromises: Array<Promise<void>> = [];

  byRepo.forEach((targets, repoRoot) => {
    reviewPromises.push((async () => {
      const relTargets = targets.map((target) => target.rel);
      const statusResult = await runGit(repoRoot, ["status", "--porcelain", "--", ...relTargets]);
      const statusMap = parsePorcelainStatus(statusResult.stdout);

      for (const target of targets) {
        const statusRaw = statusMap.get(target.rel) ?? "";
        const status = fs.existsSync(target.abs) ? classifyStatus(statusRaw) : "missing";

        let diff = "";
        if (status === "untracked" && fs.existsSync(target.abs)) {
          const untrackedDiff = await runGit(repoRoot, ["diff", "--no-index", "--", "/dev/null", target.rel]);
          diff = untrackedDiff.stdout || untrackedDiff.stderr;
        } else if (status !== "clean" && status !== "missing") {
          const staged = await runGit(repoRoot, ["diff", "--cached", "--", target.rel]);
          const unstaged = await runGit(repoRoot, ["diff", "--", target.rel]);
          diff = [staged.stdout, unstaged.stdout].filter((part) => part.trim().length > 0).join("\n");
        }

        files.push({
          path: target.abs.replace(/\\/g, "/"),
          relPath: target.rel,
          repoRoot,
          status,
          diff: clampDiff(diff),
        });
      }
    })());
  });

  await Promise.all(reviewPromises);
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const repoRoots = Array.from(byRepo.keys()).sort();

  return NextResponse.json({
    repoRoot: repoRoots.length === 1 ? repoRoots[0] : "multiple",
    repoRoots,
    hasChanges: files.some((file) => !["clean", "missing"].includes(file.status)),
    files,
  });
}
