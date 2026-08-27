import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitExec = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number; windowsHide?: boolean },
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

const READ_ONLY_GIT = new Set([
  "rev-parse",
  "status",
  "rev-list",
  "remote",
  "diff",
  "log",
]);

export type GitStatus = {
  path: string;
  branch: string | null;
  head: string | null;
  dirty: boolean;
  dirty_files: string[];
  dirty_summary: { changed: number; shown: number };
  ahead: number | null;
  behind: number | null;
  remote: string | null;
  fetched: boolean;
  error?: string;
};

export type GitAdapter = {
  status: () => Promise<GitStatus>;
};

export function createGitAdapter(options: {
  repoDir: string;
  allowFetch?: boolean;
  execFileImpl?: GitExec;
}): GitAdapter {
  const run = options.execFileImpl ?? (execFileAsync as GitExec);

  async function git(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const verb = args[0] ?? "";
    if (verb === "fetch" && !options.allowFetch) {
      return { stdout: "", stderr: "fetch_disabled", exitCode: 1 };
    }
    if (verb !== "fetch" && !READ_ONLY_GIT.has(verb)) {
      return { stdout: "", stderr: `git_verb_denied:${verb}`, exitCode: 1 };
    }
    try {
      const result = await run("git", args, {
        cwd: options.repoDir,
        timeout: 10_000,
        windowsHide: true,
      });
      return { stdout: result.stdout.toString(), stderr: result.stderr.toString(), exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: String(err.stdout ?? ""),
        stderr: String(err.stderr ?? err.message ?? "git_failed"),
        exitCode: typeof err.code === "number" ? err.code : 1,
      };
    }
  }

  return {
    async status() {
      if (!options.repoDir) {
        return {
          path: "",
          branch: null,
          head: null,
          dirty: false,
          dirty_files: [],
          dirty_summary: { changed: 0, shown: 0 },
          ahead: null,
          behind: null,
          remote: null,
          fetched: false,
          error: "repo_path_unset",
        };
      }
      let fetched = false;
      if (options.allowFetch) {
        const fetchResult = await git(["fetch", "--quiet"]);
        fetched = fetchResult.exitCode === 0;
      }
      const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
      const head = await git(["rev-parse", "HEAD"]);
      const dirty = await git(["status", "--porcelain"]);
      const remote = await git(["remote"]);
      const upstream = await git(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
      const files = dirty.exitCode === 0
        ? dirty.stdout.split("\n").filter((line) => line.length > 0).map((line) => line.slice(3).trim()).filter(Boolean)
        : [];
      const shown = files.slice(0, 20);
      let ahead: number | null = null;
      let behind: number | null = null;
      if (upstream.exitCode === 0) {
        const [left, right] = upstream.stdout.trim().split(/\s+/);
        behind = Number(left) || 0;
        ahead = Number(right) || 0;
      }
      return {
        path: options.repoDir,
        branch: branch.exitCode === 0 ? branch.stdout.trim() : null,
        head: head.exitCode === 0 ? head.stdout.trim() : null,
        dirty: files.length > 0,
        dirty_files: shown,
        dirty_summary: { changed: files.length, shown: shown.length },
        ahead,
        behind,
        remote: remote.exitCode === 0 ? remote.stdout.trim().split(/\s+/)[0] ?? null : null,
        fetched,
        error: branch.exitCode === 0 ? undefined : branch.stderr.trim(),
      };
    },
  };
}
