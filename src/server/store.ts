import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { bus } from "./bus";

/** One JSON file per collection in ./data, written atomically. Local, single-user. */
const DIR = path.join(process.cwd(), "data");
type Rows = Record<string, Record<string, unknown>>;
const g = globalThis as unknown as { __loCache?: Map<string, Rows> };
const cache = (g.__loCache ??= new Map());

const file = (c: string) => path.join(DIR, c.replace(/[^a-z0-9_-]/gi, "_") + ".json");
function load(c: string): Rows {
  if (!cache.has(c)) {
    let rows: Rows = {};
    try { rows = JSON.parse(fs.readFileSync(file(c), "utf8")); } catch { /* new collection */ }
    cache.set(c, rows);
  }
  return cache.get(c)!;
}
function save(c: string) {
  fs.mkdirSync(DIR, { recursive: true });
  const f = file(c);
  fs.writeFileSync(f + ".tmp", JSON.stringify(load(c), null, 1));
  fs.renameSync(f + ".tmp", f);
  bus.emit("change", c);
}

export const newId = () => crypto.randomBytes(6).toString("hex");
export const store = {
  list<T>(c: string): (T & { id: string })[] { return Object.entries(load(c)).map(([id, d]) => ({ ...(d as T), id })); },
  get<T>(c: string, id: string): (T & { id: string }) | null { const d = load(c)[id]; return d ? { ...(d as T), id } : null; },
  insert<T extends object>(c: string, data: T, id = newId()) { load(c)[id] = { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; save(c); return id; },
  update<T extends object>(c: string, id: string, data: Partial<T>) {
    const rows = load(c);
    if (!rows[id]) throw new HttpError(404, "Not found");
    rows[id] = { ...rows[id], ...data, updatedAt: new Date().toISOString() };
    save(c);
  },
  remove(c: string, id: string) { delete load(c)[id]; save(c); },
};

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
