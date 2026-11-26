import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { handle, json } from "@/server/http";
import { HttpError, store } from "@/server/store";
import type { Project } from "@/lib/types";

const ALLOWED = new Set(["projects", "agents", "tasks", "workflows", "runs", "settings"]);
const check = (c: string) => { if (!ALLOWED.has(c)) throw new HttpError(404, "Unknown collection"); };

export async function GET(req: Request, ctx: { params: Promise<{ collection: string }> }) {
  return handle(req, async () => {
    const { collection } = await ctx.params;
    check(collection);
    const project = new URL(req.url).searchParams.get("project");
    const rows = store.list<{ projectId?: string; createdAt?: string }>(collection);
    return (project ? rows.filter((r) => r.projectId === project) : rows).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ collection: string }> }) {
  return handle(req, async () => {
    const { collection } = await ctx.params;
    check(collection);
    if (collection === "runs") throw new HttpError(400, "Runs are created by running a workflow");
    const data = await json<Record<string, unknown>>(req);
    if (collection === "projects") return { id: store.insert("projects", inspectProject(data as Partial<Project>)) };
    return { id: store.insert(collection, data) };
  });
}

/** Validates a project folder and detects its git branch and stack. */
function inspectProject(p: Partial<Project>): Omit<Project, "id"> {
  const dir = String(p.path || "").trim();
  if (!path.isAbsolute(dir) || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new HttpError(400, "Use the full path of an existing folder.");
  let branch: string | undefined;
  try { branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { /* not a git repo */ }
  const has = (f: string) => fs.existsSync(path.join(dir, f));
  const stack = [
    has("package.json") && "Node", has("tsconfig.json") && "TypeScript", has("next.config.ts") || has("next.config.js") || has("next.config.mjs") ? "Next.js" : "",
    has("pyproject.toml") || has("requirements.txt") ? "Python" : "", has("go.mod") && "Go", has("Cargo.toml") && "Rust",
    has("android") && "Android", has("ios") && "iOS", has("supabase") && "Supabase", has("CLAUDE.md") && "CLAUDE.md",
  ].filter(Boolean) as string[];
  return { name: String(p.name || path.basename(dir)).slice(0, 80), path: dir, permissionMode: p.permissionMode || "acceptEdits", branch, stack };
}
