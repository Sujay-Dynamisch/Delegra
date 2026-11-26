import { handle, json } from "@/server/http";
import { runTask, runWorkflow, stop } from "@/server/engine";
import { HttpError } from "@/server/store";

/** { action: "task" | "workflow" | "stop", id } */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { action, id } = await json<{ action: string; id: string }>(req);
    if (!id) throw new HttpError(400, "Missing id");
    if (action === "task") { runTask(id); return { ok: true }; }
    if (action === "workflow") return { runId: runWorkflow(id) };
    if (action === "stop") { stop(id); return { ok: true }; }
    throw new HttpError(400, "Unknown action");
  });
}
