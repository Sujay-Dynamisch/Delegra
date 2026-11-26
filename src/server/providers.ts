import "server-only";
import type { ModelInfo, PermissionMode, ProviderId, ProviderStatus } from "@/lib/types";
import { claudeStatus, runClaude, type ClaudeEvent } from "./claude";
import { agyCli, runAgy } from "./agy";
import { store } from "./store";

/** Claude Code accepts these aliases; they track the latest model of each family on the user's plan. */
const CLAUDE_MODELS: ModelInfo[] = [
  { id: "haiku", label: "Claude Haiku", provider: "claude", tier: "fast", note: "Research, checks, simple edits" },
  { id: "sonnet", label: "Claude Sonnet", provider: "claude", tier: "balanced", note: "Features, fixes, reviews" },
  { id: "opus", label: "Claude Opus", provider: "claude", tier: "deep", note: "Architecture, risky changes, final review" },
];
export const providerOf = (model: string): ProviderId => (model.startsWith("agy:") ? "antigravity" : "claude");

const g = globalThis as unknown as { __loAgyModels?: { at: number; list: ModelInfo[] } };
function tierOf(id: string): ModelInfo["tier"] {
  if (/flash.*low|low$|oss/.test(id)) return "fast";
  if (/xhigh|opus|hydrogen-high/.test(id)) return "deep";
  return "balanced";
}
/** Models the signed-in Antigravity account offers (`agy models`), cached for 10 minutes. */
export async function agyModels(): Promise<ModelInfo[]> {
  if (g.__loAgyModels && Date.now() - g.__loAgyModels.at < 600_000) return g.__loAgyModels.list;
  try {
    const out = await agyCli(["models"], 45000);
    const list = out.split(/\r?\n/).map((l) => l.split("\t")).filter((p) => p.length >= 2 && p[0].trim()).map(([id, label]) => ({
      id: "agy:" + id.trim(), label: label.trim(), provider: "antigravity" as const, tier: tierOf(id), note: "Antigravity",
    }));
    g.__loAgyModels = { at: Date.now(), list };
    return list;
  } catch { return []; }
}
export async function listModels(): Promise<ModelInfo[]> {
  const agy = store.get<{ granted: boolean }>("settings", "antigravity")?.granted ? await agyModels() : [];
  return [...CLAUDE_MODELS, ...agy];
}

export async function providerStatus(): Promise<ProviderStatus[]> {
  const c = await claudeStatus();
  const a = store.get<{ granted: boolean; grantedAt?: string }>("settings", "antigravity");
  let version: string | undefined, models: ModelInfo[] = [];
  try { version = (await agyCli(["--version"], 15000)).trim(); } catch { /* not installed */ }
  if (version) models = await agyModels();
  return [
    { id: "claude", name: "Claude Code", installed: c.installed, version: c.version, signedIn: c.loggedIn, plan: c.plan, granted: c.granted, grantedAt: c.grantedAt },
    // `agy models` only answers when the CLI is signed in, so it doubles as the sign-in check.
    { id: "antigravity", name: "Antigravity", installed: !!version, version, signedIn: models.length > 0, plan: models.length ? `${models.length} models` : undefined, granted: !!a?.granted, grantedAt: a?.grantedAt },
  ];
}

/** Runs one agent step on whichever provider owns the model. */
export function runAgent(opts: { prompt: string; cwd: string; model: string; permissionMode?: PermissionMode; onEvent?: (e: ClaudeEvent) => void }) {
  if (providerOf(opts.model) === "antigravity") {
    if (!store.get<{ granted: boolean }>("settings", "antigravity")?.granted) throw new Error("Connect Antigravity first: Settings → Connections.");
    return runAgy({ ...opts, model: opts.model.slice(4) });
  }
  return runClaude({ ...opts, model: opts.model as never });
}
