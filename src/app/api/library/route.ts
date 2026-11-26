import { handle, json } from "@/server/http";
import { listModels } from "@/server/providers";
import { HttpError, store } from "@/server/store";
import { TEMPLATES } from "@/lib/templates";
import type { Agent } from "@/lib/types";

/** Installs library agents. With preferCheap, fast roles go to the cheapest Antigravity model when it is connected. */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { ids, preferCheap } = await json<{ ids: string[]; preferCheap?: boolean }>(req);
    const picks = TEMPLATES.filter((t) => ids?.includes(t.id));
    if (!picks.length) throw new HttpError(400, "Pick at least one agent");
    const agy = preferCheap ? (await listModels()).filter((m) => m.provider === "antigravity") : [];
    const cheap = agy.find((m) => m.tier === "fast")?.id;
    const have = new Set(store.list<Agent>("agents").map((a) => a.template));
    const added: string[] = [];
    for (const t of picks) {
      if (have.has(t.id)) continue;
      const model = t.tier === "fast" ? cheap || "claude-haiku-5-5" : t.tier === "deep" ? "claude-opus-5-5" : "claude-sonnet-5-5";
      added.push(store.insert<Omit<Agent, "id">>("agents", { name: t.name, model, role: t.role, skills: t.skills, instructions: t.instructions, icon: t.icon, template: t.id }));
    }
    return { added: added.length, skipped: picks.length - added.length };
  });
}
