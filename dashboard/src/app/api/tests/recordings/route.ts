import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getReadableProjectPaths } from "@/app/lib/tests-paths";

const RESULTS_DIR = path.join(process.cwd(), "..", "regression_tests", "results");

function resolveRecordingPath(file: string): string {
  const project = file.split("/")[0] ?? "";
  if (/^[a-zA-Z0-9_-]+$/.test(project)) {
    const projectPath = path.join(getReadableProjectPaths(project).resultsDir, file);
    if (fs.existsSync(projectPath)) return projectPath;
  }
  return path.join(RESULTS_DIR, file);
}

/**
 * GET /api/tests/recordings?file=slug/recordings/run_id/case_id/video.webm
 * Serves a recording video file.
 */
export async function GET(req: NextRequest) {
  const rawFile = new URL(req.url).searchParams.get("file");
  const file = rawFile?.startsWith("results/") ? rawFile.slice("results/".length) : rawFile;

  // Validate: only allow paths within RESULTS_DIR, no traversal
  if (!file || file.includes("..") || !file.match(/^[a-zA-Z0-9_\-/]+\.(webm|mp4)$/)) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  const filePath = resolveRecordingPath(file);

  const project = file.split("/")[0] ?? "";
  const projectRoot = /^[a-zA-Z0-9_-]+$/.test(project) ? getReadableProjectPaths(project).resultsDir : RESULTS_DIR;
  const allowedRoots = [RESULTS_DIR, projectRoot]
    .map((root) => path.resolve(root));
  const resolvedFilePath = path.resolve(filePath);
  if (!allowedRoots.some((root) => resolvedFilePath.startsWith(root + path.sep) || resolvedFilePath === root)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".mp4" ? "video/mp4" : "video/webm";

  const stream = fs.createReadStream(filePath);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
    },
  });
}
