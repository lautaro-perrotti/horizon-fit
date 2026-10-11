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
  } catch (error) {
    source.close();
    return { ok: false, reason: error instanceof Error ? error.message.slice(0, 80) : "backup_failed", at };
  }
  source.close();
  let envDest: string | undefined;
  if (options.envPath && fs.existsSync(options.envPath)) {
    envDest = path.join(options.destDir, `horizon-control.env-${at}`);
    fs.copyFileSync(options.envPath, envDest);
  }
  return { ok: true, sqlite: sqliteDest, env: envDest, at };
}

export function restoreSqlite(backupFile: string, destFile: string): void {
  fs.mkdirSync(path.dirname(path.resolve(destFile)), { recursive: true });
  fs.copyFileSync(backupFile, destFile);
}
