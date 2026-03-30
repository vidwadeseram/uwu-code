import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const REGRESSION_DIR = path.join(process.cwd(), "..", "regression_tests");
const RESULTS_DIR = path.join(REGRESSION_DIR, "results");

/** GET /api/tests/results?project=slug&limit=10
 *  Returns the most recent run results for a project, newest first. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project = searchParams.get("project");
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);

  if (!project || !/^[a-zA-Z0-9_-]+$/.test(project)) {
    return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
  }

  const projectResultsDir = path.join(RESULTS_DIR, project);

  if (!fs.existsSync(projectResultsDir)) {
    return NextResponse.json({ results: [] });
  }

  const files = fs
    .readdirSync(projectResultsDir)
    .filter((f) => f.endsWith(".json") && f !== "running.json")
    .sort()
    .reverse()
    .slice(0, limit);

  const results = [];
  for (const file of files) {
    try {
      const content = JSON.parse(
        fs.readFileSync(path.join(projectResultsDir, file), "utf-8")
      );
      results.push(content);
    } catch {
      // skip corrupt files
    }
  }

  return NextResponse.json({ results });
}
