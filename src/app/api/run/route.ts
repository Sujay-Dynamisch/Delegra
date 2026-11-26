import { handle, json } from "@/server/http";
import { answer, runTask, runWorkflow, stop } from "@/server/engine";
import { HttpError } from "@/server/store";

/** { action: "task" | "workflow" | "stop" | "approve" | "reject", id, input?, note? } */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { action, id, input, note } = await json<{ action: string; id: string; input?: string; note?: string }>(req);
    if (!id) throw new HttpError(400, "Missing id");
    if (action === "task") { runTask(id); return { ok: true }; }
    if (action === "workflow") return { runId: runWorkflow(id, "manual", input) };
    if (action === "approve" || action === "reject") { answer(id, action === "approve", note); return { ok: true }; }
    if (action === "stop") { stop(id); return { ok: true }; }
    throw new HttpError(400, "Unknown action");
  });
}
