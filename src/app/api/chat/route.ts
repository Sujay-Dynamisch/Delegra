import { guard, json } from "@/server/http";
import { ask } from "@/server/engine";
import type { Model } from "@/lib/types";

/** Streams newline-delimited JSON: {text} while Claude writes, then {done, ok, text, error, tokens}. Closing the request stops claude. */
export async function POST(req: Request) {
  try { guard(req); } catch { return Response.json({ error: "Forbidden" }, { status: 403 }); }
  const b = await json<{ projectId: string; prompt: string; model: Model; agentId?: string }>(req);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (o: unknown) => { try { ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* closed */ } };
      let proc: ReturnType<typeof ask>;
      try { proc = ask(b.projectId, b.prompt, b.model || "sonnet", b.agentId, (text) => send({ text })); }
      catch (e) { send({ done: true, ok: false, error: (e as Error).message }); ctrl.close(); return; }
      req.signal.addEventListener("abort", () => proc.stop());
      proc.done.then((r) => { send({ done: true, ok: r.ok, text: r.text, error: r.error, tokens: r.tokens, costUsd: r.costUsd }); try { ctrl.close(); } catch {} });
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-cache" } });
}
