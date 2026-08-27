import path from "node:path";

export class PathTraversalError extends Error {
  readonly status = 400;
  readonly code = "path_traversal";
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}

function hasTraversalSegment(value: string): boolean {
  const decoded = safeDecode(value);
  const normalized = decoded.replace(/\\/g, "/");
  return normalized.split("/").some((segment) => segment === "..");
}

function safeDecode(value: string): string {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}

export function looksLikePathTraversal(value: string): boolean {
  if (!value) return false;
  if (value.includes("\0")) return true;
  return hasTraversalSegment(value);
}

/** Join a constant filename under root; reject if the result escapes root. */
export function safeJoin(root: string, name: string): string {
  if (!name || name.includes("\0") || /[\\/]/.test(name) || name === ".." || name.includes("..")) {
    throw new PathTraversalError(`path_traversal:${name}`);
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, name);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
  if (candidate !== resolvedRoot && !candidate.startsWith(prefix)) {
    throw new PathTraversalError(`path_traversal:${name}`);
  }
  return candidate;
}
