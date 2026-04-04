import path from "path";

/**
 * Sanitize a shell argument by using an allowlist approach.
 * Rejects strings containing dangerous shell metacharacters.
 */
const SHELL_META = /[`$\\!#&|;(){}\n\r]/;

export function sanitizeShellArg(input: string): string {
  if (SHELL_META.test(input)) {
    throw new Error(`Input contains dangerous characters: ${input.slice(0, 50)}`);
  }
  // Escape double quotes for safe embedding in "..."
  return input.replace(/"/g, '\\"');
}

/**
 * Validate that a git ref name (branch, tag) is safe.
 * Follows git's rules: no space, ~, ^, :, ?, *, [, \, control chars, or ".."
 */
const UNSAFE_REF = /[\s~^:?*\[\]\\]|\.{2}|@\{|\/\/|\.$|^\.|^-|\/\./;

export function validateGitRef(ref: string): string {
  if (!ref || ref.trim() === "") {
    throw new Error("Git ref cannot be empty");
  }
  if (UNSAFE_REF.test(ref)) {
    throw new Error(`Invalid git ref name: ${ref.slice(0, 50)}`);
  }
  if (ref.startsWith("-")) {
    throw new Error("Git ref cannot start with a dash");
  }
  return ref;
}

/**
 * Resolve a file path and ensure it stays within the allowed base directory.
 * Prevents path traversal attacks (../).
 */
export function safePath(basePath: string, filePath: string): string {
  const resolved = path.resolve(basePath, filePath);
  const normalizedBase = path.resolve(basePath);

  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    throw new Error("Path traversal detected");
  }

  return resolved;
}

/**
 * Validate a project name — no path separators or traversal.
 */
export function validateProjectName(name: string): string {
  if (!name || typeof name !== "string") {
    throw new Error("Project name is required");
  }
  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.startsWith(".")) {
    throw new Error("Invalid project name");
  }
  return name;
}
