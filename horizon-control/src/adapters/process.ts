import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ALLOWED_JOB_SCRIPTS, SEO_AUDIT_ALLOWLIST } from "../config.js";

const execFileAsync = promisify(execFile);

export type TypedJobSpec = {
  command: string;
  script: (typeof ALLOWED_JOB_SCRIPTS)[number];
  extraArgs?: string[];
  cwd: string;
};

function isAllowlistedArg(arg: string): boolean {
  if (arg === "--all" || arg === "--strict") return true;
  if (/^--limit=\d+$/.test(arg)) return true;
  if (arg.startsWith("https://") && SEO_AUDIT_ALLOWLIST.some((origin) => arg === origin || arg.startsWith(`${origin}/`))) {
    return true;
  }
  return false;
}

export type ProcessExec = (
  command: string,
  args: string[],
  options?: { cwd?: string; timeout?: number; windowsHide?: boolean },
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

export async function runTypedJob(
  spec: TypedJobSpec,
  execImpl: ProcessExec = execFileAsync as ProcessExec,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const normalized = spec.script.replace(/\\/g, "/");
  if (!(ALLOWED_JOB_SCRIPTS as readonly string[]).includes(normalized)) {
    throw new Error(`job_script_denied:${spec.script}`);
  }
  for (const arg of spec.extraArgs ?? []) {
    if (!isAllowlistedArg(arg)) {
      throw new Error(`job_args_denied:${arg}`);
    }
  }
  try {
    const result = await execImpl(spec.command, [path.normalize(spec.script), ...(spec.extraArgs ?? [])], {
      cwd: spec.cwd,
      timeout: 110_000,
      windowsHide: true,
    });
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
