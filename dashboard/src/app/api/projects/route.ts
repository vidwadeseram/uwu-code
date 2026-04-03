import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

const PROJECTS_ROOT = "/opt/workspaces";
const DEFAULT_BULK_OWNER = process.env.GITHUB_OWNER ?? "";
const GITHUB_API_BASE = "https://api.github.com";

async function runCommand(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 8000 });
    return stdout.trim();
  } catch {
    return "";
  }
}

function isWithinProjectsRoot(candidate: string): boolean {
  const normalizedRoot = path.resolve(PROJECTS_ROOT);
  const normalizedCandidate = path.resolve(candidate);
  if (normalizedCandidate === normalizedRoot) return false;
  return normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
}

async function getGitBranch(dir: string): Promise<string> {
  return runCommand(`git -C "${dir}" branch --show-current`);
}

async function getGitRemote(dir: string): Promise<string> {
  return runCommand(`git -C "${dir}" remote get-url origin`);
}

function getLastModified(dir: string): string {
  try {
    const stat = fs.statSync(dir);
    return stat.mtime.toISOString();
  } catch {
    return "";
  }
}

interface ProjectInfo {
  name: string;
  path: string;
  lastModified: string;
  branch: string;
  remoteUrl: string;
}

interface ProjectGroup {
  name: string;
  path: string;
  projects: ProjectInfo[];
}

function deriveRepoName(url: string): string {
  // Strip trailing .git and get the last path segment
  const clean = url.replace(/\.git$/, "");
  const parts = clean.split("/");
  return parts[parts.length - 1] || "repo";
}

function sanitizeRemoteUrl(remoteUrl: string): string {
  if (!remoteUrl) return "";

  try {
    const parsed = new URL(remoteUrl);
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return remoteUrl.replace(/^(https?:\/\/)([^@/]+)@/i, "$1");
  }
}

interface GitHubRepo {
  name: string;
  clone_url: string;
  archived: boolean;
  disabled: boolean;
}

async function fetchGitHubRepos(owner: string): Promise<GitHubRepo[]> {
  const endpoints = [
    `${GITHUB_API_BASE}/orgs/${owner}/repos?per_page=100&type=all&sort=updated`,
    `${GITHUB_API_BASE}/users/${owner}/repos?per_page=100&type=owner&sort=updated`,
  ];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "uwu-code",
  };

  const githubToken = process.env.GITHUB_TOKEN?.trim();
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, { headers, cache: "no-store" });
    if (res.status === 404) {
      continue;
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GitHub API ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    if (!Array.isArray(json)) {
      throw new Error("Unexpected GitHub API response format");
    }

    return json
      .filter((repo): repo is GitHubRepo => {
        return (
          typeof repo?.name === "string" &&
          typeof repo?.clone_url === "string" &&
          typeof repo?.archived === "boolean" &&
          typeof repo?.disabled === "boolean"
        );
      })
      .filter((repo) => !repo.archived && !repo.disabled);
  }

  throw new Error(`GitHub owner not found: ${owner}`);
}

async function cloneOwnerRepos(owner: string) {
  const repos = await fetchGitHubRepos(owner);

  if (!fs.existsSync(PROJECTS_ROOT)) {
    fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
  }

  const ownerDir = path.join(PROJECTS_ROOT, owner);
  if (!fs.existsSync(ownerDir)) {
    fs.mkdirSync(ownerDir, { recursive: true });
  }

  const existingLocalRepos = fs
    .readdirSync(ownerDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  if (repos.length === 0 && existingLocalRepos.length > 0) {
    return {
      owner,
      total: existingLocalRepos.length,
      cloned: [],
      skipped: existingLocalRepos,
      failed: [] as { name: string; message: string }[],
      rootPath: ownerDir,
    };
  }

  const cloned: string[] = [];
  const skipped: string[] = [];
  const failed: { name: string; message: string }[] = [];

  for (const repo of repos) {
    const destination = path.join(ownerDir, repo.name);
    if (fs.existsSync(destination)) {
      skipped.push(repo.name);
      continue;
    }

    try {
      await execAsync(`git clone --depth=1 "${repo.clone_url}" "${destination}"`, {
        timeout: 120000,
      });
      cloned.push(repo.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Clone failed";
      failed.push({ name: repo.name, message });
    }
  }

  return {
    owner,
    total: repos.length,
    cloned,
    skipped,
    failed,
    rootPath: ownerDir,
  };
}

export async function GET() {
  try {
    if (!fs.existsSync(PROJECTS_ROOT)) {
      return NextResponse.json({ groups: [] });
    }

    const topLevel = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true });
    const groups: ProjectGroup[] = [];

    for (const entry of topLevel) {
      if (!entry.isDirectory()) continue;
      const groupPath = path.join(PROJECTS_ROOT, entry.name);

      // Check if the group directory itself is a git repo
      const groupBranch = await getGitBranch(groupPath);
      const groupRemote = await getGitRemote(groupPath);

      if (groupBranch || groupRemote) {
        // The top-level dir is itself a project
        const project: ProjectInfo = {
          name: entry.name,
          path: groupPath,
          lastModified: getLastModified(groupPath),
          branch: groupBranch,
          remoteUrl: sanitizeRemoteUrl(groupRemote),
        };
        groups.push({
          name: entry.name,
          path: groupPath,
          projects: [project],
        });
        continue;
      }

      // Scan one level deeper for sub-projects
      let subEntries: fs.Dirent[] = [];
      try {
        subEntries = fs.readdirSync(groupPath, { withFileTypes: true });
      } catch {
        continue;
      }

      const projects: ProjectInfo[] = [];
      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue;
        const subPath = path.join(groupPath, sub.name);
        const [branch, remoteUrl] = await Promise.all([
          getGitBranch(subPath),
          getGitRemote(subPath),
        ]);
        projects.push({
          name: sub.name,
          path: subPath,
          lastModified: getLastModified(subPath),
          branch,
          remoteUrl: sanitizeRemoteUrl(remoteUrl),
        });
      }

      if (projects.length > 0) {
        groups.push({
          name: entry.name,
          path: groupPath,
          projects,
        });
      }
    }

    return NextResponse.json({ groups });
  } catch (error) {
    console.error("[/api/projects GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to scan projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url,
      dest,
      action,
      owner,
    } = body as {
      url?: string;
      dest?: string;
      action?: string;
      owner?: string;
    };

    if (action === "clone_all_owner") {
      const requestedOwner = (owner?.trim() || DEFAULT_BULK_OWNER).toLowerCase();

      if (!/^[a-z0-9-]+$/.test(requestedOwner)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid owner name",
          },
          { status: 400 }
        );
      }

      const result = await cloneOwnerRepos(requestedOwner);

      if (result.total === 0) {
        return NextResponse.json(
          {
            success: false,
            owner: result.owner,
            message: `No repositories found for ${result.owner}. If repos are private, set GITHUB_TOKEN on the server.`,
            path: result.rootPath,
            total: 0,
            cloned: [],
            skipped: [],
            failed: [],
          },
          { status: 404 }
        );
      }

      const summary = `${result.cloned.length} cloned, ${result.skipped.length} skipped, ${result.failed.length} failed`;

      return NextResponse.json({
        success: result.failed.length === 0,
        partialSuccess: result.failed.length > 0 && result.cloned.length > 0,
        owner: result.owner,
        message: `Clone all completed: ${summary}`,
        path: result.rootPath,
        total: result.total,
        cloned: result.cloned,
        skipped: result.skipped,
        failed: result.failed,
      });
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, message: "url is required" },
        { status: 400 }
      );
    }

    // Derive destination folder name
    const repoName = dest?.trim() || deriveRepoName(url);

    // Basic safety: no path traversal, only allow safe chars
    if (!/^[a-zA-Z0-9_.\-]+$/.test(repoName)) {
      return NextResponse.json(
        { success: false, message: "Invalid destination name" },
        { status: 400 }
      );
    }

    const destPath = path.join(PROJECTS_ROOT, repoName);

    // Ensure PROJECTS_ROOT exists
    if (!fs.existsSync(PROJECTS_ROOT)) {
      fs.mkdirSync(PROJECTS_ROOT, { recursive: true });
    }

    if (fs.existsSync(destPath)) {
      return NextResponse.json(
        {
          success: false,
          message: `Destination already exists: ${destPath}`,
          path: destPath,
        },
        { status: 409 }
      );
    }

    const { stdout, stderr } = await execAsync(
      `git clone --depth=1 "${url}" "${destPath}"`,
      { timeout: 60000 }
    );

    return NextResponse.json({
      success: true,
      message: `Cloned to ${destPath}. ${(stdout + stderr).trim()}`.trim(),
      path: destPath,
    });
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Clone failed";
    console.error("[/api/projects POST] Error:", msg);
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectPath } = body as { projectPath?: string };
    if (!projectPath || typeof projectPath !== "string") {
      return NextResponse.json({ success: false, message: "projectPath is required" }, { status: 400 });
    }

    const resolved = path.resolve(projectPath);
    if (!isWithinProjectsRoot(resolved)) {
      return NextResponse.json({ success: false, message: "Invalid project path" }, { status: 400 });
    }

    if (!fs.existsSync(resolved)) {
      return NextResponse.json({ success: false, message: "Project path does not exist" }, { status: 404 });
    }

    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json({ success: false, message: "Project path must be a directory" }, { status: 400 });
    }

    fs.rmSync(resolved, { recursive: true, force: false });
    return NextResponse.json({ success: true, path: resolved });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Delete failed";
    console.error("[/api/projects DELETE] Error:", msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
