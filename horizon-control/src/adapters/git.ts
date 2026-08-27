import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitStatus = {
  path: string;
  branch: string | null;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
  head: string | null;
  error?: string;
};

export type GitAdapter = {
  status: () => Promise<GitStatus>;
};

export function createGitAdapter(options: {
  repoDir: string;
  execFileImpl?: typeof execFileAsync;
}): GitAdapter {
  const run = options.execFileImpl ?? execFileAsync;

  async function git(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
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
          dirty: false,
          ahead: null,
          behind: null,
          head: null,
          error: "repo_dir_unset",
        };
      }
      const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
      const head = await git(["rev-parse", "HEAD"]);
      const dirty = await git(["status", "--porcelain"]);
      const upstream = await git(["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]);
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
        dirty: dirty.exitCode === 0 ? dirty.stdout.trim().length > 0 : false,
        ahead,
        behind,
        head: head.exitCode === 0 ? head.stdout.trim() : null,
        error: branch.exitCode === 0 ? undefined : branch.stderr.trim(),
      };
    },
  };
}
