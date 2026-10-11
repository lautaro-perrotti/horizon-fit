import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { initialDocument, documentSchema, applyOperations, type StoreDocument, type DesignOperation, type themes } from "./document.js";
export class PlatformError extends Error { constructor(public status: number, message: string) { super(message); } }
export type Store = { id: string; slug: string; name: string; revision: number; published: number | null; owner: string; created: number };
export class PlatformRepository {
  constructor(public db: Database.Database) {
    db.pragma("foreign_keys = ON"); db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS platform_stores(id TEXT PRIMARY KEY,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,owner TEXT NOT NULL,revision INTEGER NOT NULL,published INTEGER,created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS platform_revisions(store_id TEXT NOT NULL REFERENCES platform_stores(id),revision INTEGER NOT NULL,document TEXT NOT NULL,actor TEXT NOT NULL,label TEXT NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(store_id,revision));
      CREATE TABLE IF NOT EXISTS platform_members(store_id TEXT NOT NULL REFERENCES platform_stores(id),subject TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(store_id,subject));
      CREATE TABLE IF NOT EXISTS platform_events(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS platform_tasks(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,actor TEXT NOT NULL,status TEXT NOT NULL,usage TEXT NOT NULL,result TEXT,created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS platform_imports(id TEXT PRIMARY KEY,store_id TEXT NOT NULL,rows TEXT NOT NULL,status TEXT NOT NULL,result TEXT,created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS platform_settings(store_id TEXT PRIMARY KEY REFERENCES platform_stores(id),settings TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS platform_artifacts(store_id TEXT NOT NULL REFERENCES platform_stores(id),revision INTEGER NOT NULL,document TEXT NOT NULL,PRIMARY KEY(store_id,revision));
    `);
  }
  list(subject: string): Store[] { return this.db.prepare("SELECT s.* FROM platform_stores s JOIN platform_members m ON s.id=m.store_id WHERE m.subject=? ORDER BY created DESC").all(subject) as Store[]; }
  access(storeId: string, subject: string, write = false): Store {
    const row = this.db.prepare("SELECT s.*,m.role FROM platform_stores s JOIN platform_members m ON s.id=m.store_id WHERE s.id=? AND m.subject=?").get(storeId, subject) as (Store & { role: string }) | undefined;
    if (!row || (write && !["owner", "editor"].includes(row.role))) throw new PlatformError(403, "No tenés acceso a esta tienda");
    return row;
  }
  create(subject: string, name: string, slug: string, theme: keyof typeof themes): Store {
    return this.db.transaction(() => {
      if ((this.db.prepare("SELECT COUNT(*) as n FROM platform_stores").get() as { n: number }).n >= 10) throw new PlatformError(409, "El piloto admite hasta diez tiendas");
      if (this.db.prepare("SELECT id FROM platform_stores WHERE slug=?").get(slug)) throw new PlatformError(409, "Ese nombre de tienda ya está ocupado");
      const id = randomUUID(), now = Date.now();
      this.db.prepare("INSERT INTO platform_stores VALUES(?,?,?,?,1,NULL,?)").run(id, slug, name, subject, now);
      this.db.prepare("INSERT INTO platform_members VALUES(?,?,?)").run(id, subject, "owner");
      this.db.prepare("INSERT INTO platform_revisions VALUES(?,1,?,?,?,?)").run(id, JSON.stringify(initialDocument(name, theme)), subject, "Tienda creada", now);
      return this.access(id, subject);
    })();
  }
  document(storeId: string, revision?: number): { revision: number; document: StoreDocument } {
    const row = this.db.prepare(revision === undefined ? "SELECT r.* FROM platform_revisions r JOIN platform_stores s ON s.id=r.store_id AND s.revision=r.revision WHERE s.id=?" : "SELECT * FROM platform_revisions WHERE store_id=? AND revision=?").get(...(revision === undefined ? [storeId] : [storeId, revision])) as { revision: number; document: string } | undefined;
    if (!row) throw new PlatformError(404, "Versión no encontrada");
    return { revision: row.revision, document: documentSchema.parse(JSON.parse(row.document)) };
  }
  save(storeId: string, subject: string, expected: number, doc: StoreDocument, label: string) {
    return this.db.transaction(() => {
      const store = this.access(storeId, subject, true); if (store.revision !== expected) throw new PlatformError(409, "Hay cambios nuevos. Recargá el borrador antes de editar.");
      const parsed = documentSchema.parse(doc), next = expected + 1;
      this.db.prepare("INSERT INTO platform_revisions VALUES(?,?,?,?,?,?)").run(storeId, next, JSON.stringify(parsed), subject, label, Date.now());
      this.db.prepare("UPDATE platform_stores SET revision=?,name=? WHERE id=?").run(next, parsed.brand.name, storeId);
      this.event(storeId, subject, "draft.save", { revision: next, label }); return { revision: next, document: parsed };
    })();
  }
  patch(storeId: string, subject: string, expected: number, ops: DesignOperation[], label = "Edición") {
    this.access(storeId, subject, true); const current = this.document(storeId);
    if (current.revision !== expected) throw new PlatformError(409, "Borrador desactualizado");
    return this.save(storeId, subject, expected, applyOperations(current.document, ops), label);
  }
  history(storeId: string) { return this.db.prepare("SELECT revision,actor,label,created FROM platform_revisions WHERE store_id=? ORDER BY revision DESC LIMIT 50").all(storeId); }
  publish(storeId: string, subject: string, expected: number) {
    return this.db.transaction(() => {
      const store = this.access(storeId, subject, true); if (store.revision !== expected) throw new PlatformError(409, "El borrador cambió antes de publicar");
      this.document(storeId, expected);
      this.db.prepare("UPDATE platform_stores SET published=? WHERE id=?").run(expected, storeId);
      this.event(storeId, subject, "design.publish", { revision: expected }); return { published: expected };
    })();
  }
  publicStore(slug: string) { return this.db.prepare("SELECT * FROM platform_stores WHERE slug=? AND published IS NOT NULL").get(slug) as Store | undefined; }
  settings(storeId: string): Record<string, string> { const row = this.db.prepare("SELECT settings FROM platform_settings WHERE store_id=?").get(storeId) as { settings: string } | undefined; return row ? JSON.parse(row.settings) : {}; }
  setSettings(storeId: string, subject: string, settings: Record<string, string>) { const store = this.access(storeId, subject, true); if (store.owner !== subject) throw new PlatformError(403, "Solo el propietario puede configurar conexiones"); this.db.prepare("INSERT INTO platform_settings VALUES(?,?) ON CONFLICT(store_id) DO UPDATE SET settings=excluded.settings").run(storeId, JSON.stringify(settings)); this.event(storeId, subject, "settings.update", { fields: Object.keys(settings) }); }
  event(storeId: string, actor: string, action: string, detail: unknown) { this.db.prepare("INSERT INTO platform_events VALUES(?,?,?,?,?,?)").run(randomUUID(), storeId, actor, action, JSON.stringify(detail), Date.now()); }
  task(storeId: string, actor: string) { const id = randomUUID(); this.db.prepare("INSERT INTO platform_tasks VALUES(?,?,?,'running','{}',NULL,?)").run(id, storeId, actor, Date.now()); return id; }
  finishTask(id: string, status: string, usage: unknown, result: unknown) { this.db.prepare("UPDATE platform_tasks SET status=?,usage=?,result=? WHERE id=?").run(status, JSON.stringify(usage), JSON.stringify(result), id); }
  usage(storeId: string) { return this.db.prepare("SELECT id,status,usage,created FROM platform_tasks WHERE store_id=? ORDER BY created DESC LIMIT 30").all(storeId).map((r: any) => ({ ...r, usage: JSON.parse(r.usage) })); }
}
