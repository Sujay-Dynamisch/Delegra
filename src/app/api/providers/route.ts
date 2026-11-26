import { handle, json } from "@/server/http";
import { startLogin } from "@/server/claude";
import { providerStatus } from "@/server/providers";
import { HttpError, store } from "@/server/store";

export async function GET(req: Request) {
  return handle(req, () => providerStatus());
}

/** { provider: "claude" | "antigravity", action: "login" | "grant" | "revoke" } */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { provider, action } = await json<{ provider: string; action: string }>(req);
    if (provider !== "claude" && provider !== "antigravity") throw new HttpError(400, "Unknown provider");
    if (action === "login") {
      if (provider !== "claude") throw new HttpError(400, "Open the Antigravity app or run `agy` once in a terminal to sign in.");
      startLogin();
    } else if (action === "grant") {
      const s = (await providerStatus()).find((p) => p.id === provider)!;
      if (!s.installed || !s.signedIn) throw new HttpError(400, `Sign in to ${s.name} first.`);
      const row = { granted: true, grantedAt: new Date().toISOString() };
      if (store.get("settings", provider)) store.update("settings", provider, row); else store.insert("settings", row, provider);
    } else if (action === "revoke") {
      if (store.get("settings", provider)) store.update("settings", provider, { granted: false });
    } else throw new HttpError(400, "Unknown action");
    return providerStatus();
  });
}
