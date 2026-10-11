import { loadConfig } from "../src/config.js";
import { backupControl } from "../src/observability/backup.js";

const config = loadConfig();
const dest = process.env.HORIZON_BACKUP_DIR || config.HORIZON_BACKUP_DIR || pathFromData(config.dataDir);
const result = await backupControl({
  sqlitePath: config.sqlitePath,
  destDir: dest,
  envPath: process.env.HORIZON_ENV_FILE || "/etc/horizon-control.env",
});
console.log(JSON.stringify(result));
if (!result.ok) process.exit(1);

function pathFromData(dataDir: string): string {
  return dataDir ? `${dataDir.replace(/\/+$/, "")}/backups` : "data/backups";
}
