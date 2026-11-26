import { bus } from "@/server/bus";
import { guard } from "@/server/http";

/** Server-sent events: the name of each collection that changed, so open tabs refetch it. */
export async function GET(req: Request) {
  try { guard(req); } catch { return new Response("Forbidden", { status: 403 }); }
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (s: string) => { try { ctrl.enqueue(enc.encode(s)); } catch { cleanup(); } };
      const onChange = (c: string) => send(`data: ${c}\n\n`);
      const ping = setInterval(() => send(": ping\n\n"), 20000);
      bus.on("change", onChange);
      cleanup = () => { clearInterval(ping); bus.off("change", onChange); };
      req.signal.addEventListener("abort", cleanup);
      send(": connected\n\n");
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
