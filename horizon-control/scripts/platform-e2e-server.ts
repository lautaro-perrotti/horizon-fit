import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.PLATFORM_DEV='1'; process.env.PLATFORM_PORT='8792'; process.env.PLATFORM_PUBLIC_URL='http://127.0.0.1:8792';
process.env.PLATFORM_DATA_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'horizon-platform-e2e-'));
await import('../src/platform/main.js');
