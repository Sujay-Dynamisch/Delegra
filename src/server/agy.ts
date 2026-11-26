import "server-only";
import { spawn, execFile } from "node:child_process";
import type { PermissionMode } from "@/lib/types";
import type { ClaudeEvent, ClaudeResult } from "./claude";

/**
 * Antigravity CLI (`agy`) runner: Gemini and other models on the user's own Antigravity sign-in.
 * The prompt is sent as one NDJSON message on stdin ({"event":"user","message":{"content":…}}),
 * so it never passes through a shell command line.
 */
const WIN = process.platform === "win32";
const MODE: Record<PermissionMode, string> = { plan: "plan", default: "accept-edits", acceptEdits: "accept-edits", bypassPermissions: "auto" };

export function agyCli(args: string[], timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile("agy", args, { timeout, shell: WIN, windowsHide: true }, (err, out) => (err ? reject(err) : resolve(String(out)))),
  );
}

export function runAgy(opts: { prompt: string; cwd: string; model: string; permissionMode?: PermissionMode; onEvent?: (e: ClaudeEvent) => void }) {
  const mode = opts.permissionMode || "acceptEdits";
  const args = ["--input-format", "stream-json", "--output-format", "stream-json", "--mode", MODE[mode], "--model", opts.model, "-p="];
  if (mode === "bypassPermissions") args.push("--dangerously-skip-permissions");
  const child = spawn("agy", args, { cwd: opts.cwd, shell: WIN, windowsHide: true });
  let buf = "", stderr = "", stopped = false, sessionId: string | null = null, text = "";
  let result: Record<string, any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
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
      if (ev.event === "init") sessionId = ev.conversation_id || null;
      if (ev.event === "step_update") {
        const s = ev.step_update || {};
        if (s.step_type === "agent_response" && s.text_delta) {
          text += s.text_delta;
          if (s.state === "DONE" && text.trim()) opts.onEvent?.({ kind: "text", text: text.trim() });
        } else if (s.step_type && s.step_type !== "user_input" && s.step_type !== "agent_response" && s.state === "ACTIVE") {
          // Tool steps: report the tool and any file it names.
          const fields = JSON.stringify(s);
          const file = (fields.match(/"(?:absolute_path|file_path|target_file|path|file)":"([^"]+)"/) || [])[1]?.replace(/\\\\/g, "\\") || null;
          const name = s.tool_name || s.name || s.step_type;
          opts.onEvent?.({ kind: "tool", name, file, summary: `${name}${file ? ": " + file : ""}` });
        }
      }
      if (ev.event === "result") result = ev.result;
    }
  });
  child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
  child.stdin.end(JSON.stringify({ event: "user", message: { content: opts.prompt } }) + "\n");
  const done = new Promise<ClaudeResult>((resolve) => {
    child.on("error", (e) => resolve({ ok: false, text: "", sessionId, tokens: null, costUsd: null, durationMs: null, error: "Could not start agy: " + e.message }));
    child.on("close", (code) => {
      const ok = !stopped && !!result && result.status === "SUCCESS";
      resolve({
        ok, text: result?.response || text, sessionId: result?.conversation_id || sessionId,
        tokens: result?.usage?.total_tokens ?? null, costUsd: null,
        durationMs: result?.duration_seconds != null ? Math.round(result.duration_seconds * 1000) : null,
        error: ok ? null : stopped ? "Stopped by you" : String(result?.error || stderr.trim() || `agy exited with code ${code}`).slice(0, 500),
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
