import "server-only";
import { HttpError } from "./store";

/** Only this machine's browser may drive the server: blocks other sites (CSRF) and DNS rebinding. */
export function guard(req: Request) {
  const host = req.headers.get("host") || "";
  const okHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const origin = req.headers.get("origin");
  const okOrigin = !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!okHost || !okOrigin) throw new HttpError(403, "Forbidden");
}
export async function handle(req: Request, fn: () => Promise<unknown> | unknown) {
  try {
    guard(req);
    const out = await fn();
    return out instanceof Response ? out : Response.json(out ?? { ok: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return Response.json({ error: (e as Error).message || "Server error" }, { status });
  }
}
export async function json<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new HttpError(400, "Invalid JSON"); }
}
