import "server-only";
import { spawn, execFile } from "node:child_process";
import type { ClaudeStatus, Model, PermissionMode } from "@/lib/types";
import { store } from "./store";

/**
 * Everything runs through the Claude Code CLI the user already signed in to (`claude auth login`),
 * so usage comes from their own Claude plan. This app never reads, copies or stores any token.
 * API-key variables are removed from child processes so a run never silently switches to API billing.
 */
const WIN = process.platform === "win32";
function cleanEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  return env;
}
function cli(args: string[], timeout = 15000): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile("claude", args, { env: cleanEnv(), timeout, shell: WIN, windowsHide: true }, (err, out) => (err ? reject(err) : resolve(String(out)))),
  );
}

export async function claudeStatus(): Promise<ClaudeStatus> {
  const grant = store.get<{ granted: boolean; grantedAt?: string }>("settings", "claude");
  let version: string | undefined;
  try { version = (await cli(["--version"])).trim(); } catch { return { installed: false, loggedIn: false, granted: false }; }
  try {
    const s = JSON.parse(await cli(["auth", "status"]));
    return {
      installed: true, version, loggedIn: !!s.loggedIn, authMethod: s.authMethod, plan: s.subscriptionType || s.planTier,
      expiresAt: s.loginExpiresAt, granted: !!grant?.granted, grantedAt: grant?.grantedAt,
    };
  } catch {
    return { installed: true, version, loggedIn: false, granted: !!grant?.granted };
  }
}

/** Opens Anthropic's own sign-in page in the browser (Claude Code's login flow). */
export function startLogin() {
  const child = spawn("claude", ["auth", "login"], { env: cleanEnv(), shell: WIN, windowsHide: false, detached: true, stdio: "ignore" });
  child.unref();
}

export type ClaudeEvent = { kind: "text"; text: string } | { kind: "tool"; name: string; file: string | null; summary: string };
export type ClaudeResult = { ok: boolean; text: string; sessionId: string | null; tokens: number | null; costUsd: number | null; durationMs: number | null; error: string | null };

export function runClaude(opts: { prompt: string; cwd: string; model?: Model; permissionMode?: PermissionMode; resume?: string; onEvent?: (e: ClaudeEvent) => void }) {
  if (!store.get<{ granted: boolean }>("settings", "claude")?.granted) throw new Error("Connect Claude first: Settings → Claude connection.");
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--model", opts.model || "sonnet", "--permission-mode", opts.permissionMode || "acceptEdits"];
  if (opts.resume) args.push("--resume", opts.resume);
  // shell is needed on Windows to resolve claude.cmd; the prompt goes through stdin, never the command line.
  const child = spawn("claude", args, { cwd: opts.cwd, env: cleanEnv(), shell: WIN, windowsHide: true });
  let buf = "", stderr = "", stopped = false, sessionId: string | null = null;
  let last: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  const texts: string[] = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let ev: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.session_id) sessionId = ev.session_id;
      if (ev.type === "assistant") {
        for (const c of ev.message?.content || []) {
          if (c.type === "text" && c.text?.trim()) { texts.push(c.text); opts.onEvent?.({ kind: "text", text: c.text }); }
          if (c.type === "tool_use") {
            const file = c.input?.file_path || c.input?.notebook_path || null;
            const what = file || c.input?.command || c.input?.pattern || c.input?.description || "";
            opts.onEvent?.({ kind: "tool", name: c.name, file, summary: `${c.name}${what ? ": " + String(what).slice(0, 160) : ""}` });
          }
        }
      }
      if (ev.type === "result") last = ev;
    }
  });
  child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
  child.stdin.end(opts.prompt);
  const done = new Promise<ClaudeResult>((resolve) => {
    child.on("error", (e) => resolve({ ok: false, text: "", sessionId, tokens: null, costUsd: null, durationMs: null, error: "Could not start claude: " + e.message }));
    child.on("close", (code) => {
      const u = last?.usage || {};
      const ok = !stopped && code === 0 && !!last && !last.is_error;
      resolve({
        ok, text: last?.result ?? texts.join("\n\n"), sessionId,
        tokens: last ? (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : null,
        // The CLI's own estimate; on a subscription plan it is not a charge.
        costUsd: last?.total_cost_usd ?? null, durationMs: last?.duration_ms ?? null,
        error: ok ? null : stopped ? "Stopped by you" : String(last?.result || stderr.trim() || `claude exited with code ${code}`).slice(0, 500),
      });
    });
  });
  return {
    done,
    stop() {
      stopped = true;
      if (WIN && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
      else child.kill("SIGTERM");
    },
  };
}
