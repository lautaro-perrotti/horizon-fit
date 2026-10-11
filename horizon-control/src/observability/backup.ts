import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export type BackupResult = {
  ok: boolean;
  reason?: string;
  sqlite?: string;
  env?: string;
  at: string;
};

export async function backupControl(options: { sqlitePath: string; destDir: string; envPath?: string }): Promise<BackupResult> {
  const at = new Date().toISOString().replace(/[:.]/g, "-");
  if (!options.sqlitePath || options.sqlitePath === ":memory:") {
    return { ok: false, reason: "sqlite_memory_not_backed_up", at };
  }
  fs.mkdirSync(options.destDir, { recursive: true });
  const sqliteDest = path.join(options.destDir, `horizon-control-${at}.sqlite`);
  const source = new Database(options.sqlitePath, { readonly: true, fileMustExist: true });
  try {
    await source.backup(sqliteDest);
    fs.chmodSync(sqliteDest, 0o600);
  } catch (error) {
    source.close();
    return { ok: false, reason: error instanceof Error ? error.message.slice(0, 80) : "backup_failed", at };
  }
  source.close();
  let envDest: string | undefined;
  if (options.envPath && fs.existsSync(options.envPath)) {
    envDest = path.join(options.destDir, `horizon-control.env-${at}`);
    fs.copyFileSync(options.envPath, envDest);
    fs.chmodSync(envDest, 0o600);
  }
  pruneBackups(options.destDir);
  return { ok: true, sqlite: sqliteDest, env: envDest, at };
}

export function pruneBackups(destDir: string, keep = 8): number {
  if (!fs.existsSync(destDir)) return 0;
  const sqlites = fs
    .readdirSync(destDir)
    .filter((name) => /^horizon-control-.+\.sqlite$/.test(name))
    .map((name) => {
      const file = path.join(destDir, name);
      return { name, file, mtime: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  let removed = 0;
  for (const row of sqlites.slice(keep)) {
    fs.unlinkSync(row.file);
    const stamp = row.name.replace(/^horizon-control-/, "").replace(/\.sqlite$/, "");
    const envFile = path.join(destDir, `horizon-control.env-${stamp}`);
    if (fs.existsSync(envFile)) fs.unlinkSync(envFile);
    removed += 1;
  }
  return removed;
}

export function restoreSqlite(backupFile: string, destFile: string): void {
  fs.mkdirSync(path.dirname(path.resolve(destFile)), { recursive: true });
  fs.copyFileSync(backupFile, destFile);
}
