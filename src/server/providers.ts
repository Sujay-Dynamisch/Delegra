import "server-only";
import type { Effort, ModelInfo, PermissionMode, ProviderId, ProviderStatus } from "@/lib/types";
import { claudeStatus, runClaude, type ClaudeEvent } from "./claude";
import { agyCli, runAgy } from "./agy";
import { store } from "./store";

/** Claude Code models, as in its own /model picker. Full names pin a version; aliases (hidden) track the latest. */
export const CLAUDE_MODELS: ModelInfo[] = [
  { id: "default", label: "Default (recommended)", sub: "Your plan's recommended model", provider: "claude", tier: "balanced", note: "Best for everyday, complex tasks" },
  { id: "claude-opus-5-5", label: "Opus 5.5", provider: "claude", tier: "deep", note: "For complex work and everyday tasks" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", provider: "claude", tier: "balanced", note: "Most efficient for simpler tasks" },
  { id: "claude-fable-5-2", label: "Fable 5.2", provider: "claude", tier: "deep", note: "For your toughest challenges" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", provider: "claude", tier: "fast", note: "Fastest for quick answers" },
  { id: "opus", label: "Opus (latest)", provider: "claude", tier: "deep", note: "Always the newest Opus", hidden: true },
  { id: "sonnet", label: "Sonnet (latest)", provider: "claude", tier: "balanced", note: "Always the newest Sonnet", hidden: true },
  { id: "haiku", label: "Haiku (latest)", provider: "claude", tier: "fast", note: "Always the newest Haiku", hidden: true },
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
export function runAgent(opts: { prompt: string; cwd: string; model: string; effort?: Effort; permissionMode?: PermissionMode; resume?: string; onEvent?: (e: ClaudeEvent) => void }) {
  if (providerOf(opts.model) === "antigravity") {
    if (!store.get<{ granted: boolean }>("settings", "antigravity")?.granted) throw new Error("Connect Antigravity first: Settings → Connections.");
    return runAgy({ ...opts, model: opts.model.slice(4) });
  }
  return runClaude({ ...opts, model: opts.model as never });
}
