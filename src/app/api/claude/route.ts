import { handle, json } from "@/server/http";
import { claudeStatus, startLogin } from "@/server/claude";
import { store } from "@/server/store";

const SCOPES = ["Run Claude Code in the project folders you connect", "Read and edit files in those folders", "Use your Claude plan's usage for agent runs"];

export async function GET(req: Request) {
  return handle(req, () => claudeStatus());
}

/** { action: "login" | "grant" | "revoke" } */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { action } = await json<{ action: string }>(req);
    if (action === "login") startLogin();
    else if (action === "grant") {
      const s = await claudeStatus();
      if (!s.loggedIn) return Response.json({ error: "Sign in to Claude first." }, { status: 400 });
      const row = { granted: true, grantedAt: new Date().toISOString(), scopes: SCOPES };
      if (store.get("settings", "claude")) store.update("settings", "claude", row); else store.insert("settings", row, "claude");
    } else if (action === "revoke") {
      if (store.get("settings", "claude")) store.update("settings", "claude", { granted: false });
    }
    return claudeStatus();
  });
}
