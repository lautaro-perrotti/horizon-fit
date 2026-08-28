import type { Server } from "node:http";

export type ShutdownHooks = {
  server: Server;
  stopWorker: () => void;
  stopBackground: () => void;
  closeDb: () => void;
  log?: (message: string) => void;
  exit?: (code: number) => void;
  drainMs?: number;
  forceMs?: number;
};

export function createShutdownController(hooks: ShutdownHooks): {
  shutdown: (signal: string) => Promise<void>;
  closing: () => boolean;
} {
  let closing = false;
  const drainMs = hooks.drainMs ?? 5_000;
  const forceMs = hooks.forceMs ?? 10_000;
  const exit = hooks.exit ?? ((code: number) => process.exit(code));
  const log = hooks.log ?? ((message: string) => console.log(message));

  async function shutdown(signal: string) {
    if (closing) return;
    closing = true;
    log(`horizon-control shutting down (${signal})`);
    const force = setTimeout(() => exit(1), forceMs);
    force.unref?.();
    hooks.stopWorker();
    hooks.stopBackground();
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        hooks.server.closeAllConnections?.();
        resolve();
      }, drainMs);
      hooks.server.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });
    try {
      hooks.closeDb();
    } catch {
      /* already closed */
    }
    clearTimeout(force);
    exit(0);
  }

  return {
    shutdown,
    closing: () => closing,
  };
}

export function installProcessShutdown(hooks: ShutdownHooks): ReturnType<typeof createShutdownController> {
  const controller = createShutdownController(hooks);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void controller.shutdown(signal);
    });
  }
  return controller;
}
