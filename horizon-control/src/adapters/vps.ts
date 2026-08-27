import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DOCKER_CONTAINERS } from "../config.js";

const execFileAsync = promisify(execFile);

export type ContainerHealth = {
  name: string;
  present: boolean;
  running: boolean | null;
  status?: string;
};

export type TypedJobSpec = {
  command: string;
  args: string[];
  cwd: string;
};

export type VpsAdapter = {
  inspectContainers: () => Promise<ContainerHealth[]>;
  probeHttp: (url: string) => Promise<{ url: string; ok: boolean; status: number | null }>;
  compareGit: () => Promise<{
    head: string | null;
    originMain: string | null;
    inSync: boolean | null;
    error?: string;
  }>;
  typedJob: (spec: TypedJobSpec) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

export function createVpsAdapter(options: {
  repoDir: string;
  spaUrl: string;
  wpUrl: string;
  execFileImpl?: typeof execFileAsync;
  fetchImpl?: typeof fetch;
}): VpsAdapter {
  const run = options.execFileImpl ?? execFileAsync;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function tryExec(command: string, args: string[], cwd?: string) {
    try {
      const result = await run(command, args, { cwd, timeout: 15_000, windowsHide: true });
      return { stdout: result.stdout.toString(), stderr: result.stderr.toString(), exitCode: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: String(err.stdout ?? ""),
        stderr: String(err.stderr ?? err.message ?? "exec_failed"),
        exitCode: typeof err.code === "number" ? err.code : 1,
      };
    }
  }

  return {
    async inspectContainers() {
      const result: ContainerHealth[] = [];
      for (const name of DOCKER_CONTAINERS) {
        const inspect = await tryExec("docker", ["inspect", "-f", "{{.State.Running}} {{.State.Status}}", name]);
        if (inspect.exitCode !== 0) {
          result.push({ name, present: false, running: null, status: inspect.stderr.trim() || "absent" });
          continue;
        }
        const [running, ...rest] = inspect.stdout.trim().split(" ");
        result.push({
          name,
          present: true,
          running: running === "true",
          status: rest.join(" ") || running,
        });
      }
      return result;
    },
    async probeHttp(url) {
      try {
        const response = await fetchImpl(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(4000) });
        return { url, ok: response.status < 500, status: response.status };
      } catch {
        return { url, ok: false, status: null };
      }
    },
    async compareGit() {
      if (!options.repoDir) {
        return { head: null, originMain: null, inSync: null, error: "repo_dir_unset" };
      }
      const head = await tryExec("git", ["rev-parse", "HEAD"], options.repoDir);
      const origin = await tryExec("git", ["rev-parse", "origin/main"], options.repoDir);
      if (head.exitCode !== 0 || origin.exitCode !== 0) {
        return {
          head: head.exitCode === 0 ? head.stdout.trim() : null,
          originMain: origin.exitCode === 0 ? origin.stdout.trim() : null,
          inSync: null,
          error: (head.stderr || origin.stderr).trim() || "git_unavailable",
        };
      }
      return {
        head: head.stdout.trim(),
        originMain: origin.stdout.trim(),
        inSync: head.stdout.trim() === origin.stdout.trim(),
      };
    },
    async typedJob(spec) {
      if (!spec.command || !Array.isArray(spec.args)) {
        throw new Error("invalid_job_spec");
      }
      const result = await tryExec(spec.command, spec.args, spec.cwd);
      return result;
    },
  };
}
