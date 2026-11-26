import { handle, json } from "@/server/http";
import { HttpError, store } from "@/server/store";
import { getAgent } from "@/server/claude-sync";

const ALLOWED = new Set(["projects", "agents", "tasks", "workflows", "runs", "settings"]);
type Ctx = { params: Promise<{ collection: string; id: string }> };
const readOnly = (c: string, id: string) => { if (c === "agents" && id.startsWith("cc-")) throw new HttpError(400, "This agent comes from Claude Code. Edit or delete its file in .claude/agents."); };

export async function GET(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    const { collection, id } = await ctx.params;
    if (!ALLOWED.has(collection)) throw new HttpError(404, "Unknown collection");
    if (collection === "agents" && id.startsWith("cc-")) return getAgent(id) ?? Promise.reject(new HttpError(404, "Not found"));
    return store.get(collection, id) ?? (collection === "settings" ? { id } : Promise.reject(new HttpError(404, "Not found")));
  });
}
export async function PATCH(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    const { collection, id } = await ctx.params;
    if (!ALLOWED.has(collection) || collection === "runs") throw new HttpError(404, "Unknown collection");
    readOnly(collection, id);
    const data = await json<Record<string, unknown>>(req);
    delete data.id;
    if (collection === "settings" && !store.get("settings", id)) store.insert("settings", data, id);
    else store.update(collection, id, data);
  });
}
export async function DELETE(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    const { collection, id } = await ctx.params;
    if (!ALLOWED.has(collection)) throw new HttpError(404, "Unknown collection");
    readOnly(collection, id);
    store.remove(collection, id);
    // A project takes its tasks, workflows and runs with it.
    if (collection === "projects") for (const c of ["tasks", "workflows", "runs"]) for (const r of store.list<{ projectId: string }>(c)) if (r.projectId === id) store.remove(c, r.id);
  });
}
