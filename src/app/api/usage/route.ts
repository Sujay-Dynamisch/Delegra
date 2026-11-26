import { handle } from "@/server/http";
import { HttpError, store } from "@/server/store";
import { projectUsage } from "@/server/claude-sync";
import type { Project } from "@/lib/types";

/** Claude Code activity in the project folder: tokens, models used, recent sessions and edited files. */
export async function GET(req: Request) {
  return handle(req, () => {
    const p = store.get<Project>("projects", new URL(req.url).searchParams.get("project") || "");
    if (!p) throw new HttpError(400, "Pick a project first");
    return projectUsage(p.path);
  });
}
