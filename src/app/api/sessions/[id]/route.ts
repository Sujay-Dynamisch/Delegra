import { handle } from "@/server/http";
import { HttpError, store } from "@/server/store";
import { readSession } from "@/server/claude-sync";
import type { Project } from "@/lib/types";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(req, async () => {
    const { id } = await ctx.params;
    const p = store.get<Project>("projects", new URL(req.url).searchParams.get("project") || "");
    if (!p) throw new HttpError(400, "Pick a project first");
    const msgs = readSession(p.path, id);
    if (!msgs) throw new HttpError(404, "Conversation not found");
    return msgs;
  });
}
