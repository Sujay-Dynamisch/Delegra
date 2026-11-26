import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Agent, Project, SessionMessage, SessionSummary } from "@/lib/types";
import { bus } from "./bus";
import { store } from "./store";

/**
 * Two-way sync with Claude Code (CLI, VS Code and JetBrains extensions all share ~/.claude):
 * - Sessions: every conversation Claude Code keeps for a project folder is that project's chat history.
 *   Chats started here are Claude Code sessions too, so they show up in the extension and can be resumed there.
 * - Agents: subagents in ~/.claude/agents and <project>/.claude/agents appear as agents here.
 */
const HOME = path.join(os.homedir(), ".claude");
const PROJECTS = path.join(HOME, "projects");
/** Marker Delegra puts in every prompt it writes; used to tell its sessions apart. */
export const DELEGRA_MARK = "Team rules (always follow):";
export const CHAT_SPLIT = "Be concise. Never invent facts.\n\n";

/* ---------- sessions ---------- */

/** Claude Code names a project's session folder after its path, with every non-alphanumeric character as "-". */
function sessionDirs(projectPath: string): string[] {
  const want = path.resolve(projectPath).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  try { return fs.readdirSync(PROJECTS).filter((d) => d.toLowerCase() === want).map((d) => path.join(PROJECTS, d)); } catch { return []; }
}
const sessionFiles = (projectPath: string) =>
  sessionDirs(projectPath).flatMap((d) => { try { return fs.readdirSync(d).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(d, f)); } catch { return []; } });

const parse = (line: string) => { try { return JSON.parse(line); } catch { return null; } };
/** Strips IDE context and reminders Claude Code adds to user turns; a slash command reads as "/name args". */
function clean(s: string) {
  const name = s.match(/<command-name>([\s\S]*?)<\/command-name>/)?.[1].trim();
  const args = s.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1].trim();
  const rest = s.replace(/<(ide_[a-z_]+|system-reminder|command-[a-z-]+|local-command-[a-z-]+)>[\s\S]*?<\/\1>/g, "").trim();
  return rest || (name ? `${name.startsWith("/") ? name : "/" + name}${args ? " " + args : ""}` : "");
}
function userText(e: { message?: { content?: unknown }; isMeta?: boolean; isSidechain?: boolean }): string {
  if (e.isMeta || e.isSidechain) return "";
  const c = e.message?.content;
  const raw = typeof c === "string" ? c : Array.isArray(c) ? c.filter((b) => b?.type === "text").map((b) => b.text).join("\n") : "";
  const t = clean(raw);
  return t.startsWith("[Request interrupted") || t.startsWith("Caveat:") ? "" : t;
}
const assistantText = (e: { message?: { content?: unknown }; isSidechain?: boolean }) =>
  !e.isSidechain && Array.isArray(e.message?.content) ? (e.message!.content as { type: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim() : "";
/** Shows only what the person typed in a chat Delegra started. */
const stripBrief = (t: string) => { const i = t.indexOf(CHAT_SPLIT); return t.includes(DELEGRA_MARK) && i >= 0 ? t.slice(i + CHAT_SPLIT.length).replace(/^User: /, "") : t; };

function readChunk(file: string, from: number, len: number) {
  const fd = fs.openSync(file, "r");
  try { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, from); return b.subarray(0, n).toString("utf8"); } finally { fs.closeSync(fd); }
}

const g = globalThis as unknown as { __ccSum?: Map<string, { key: string; s: SessionSummary | null }> };
const sums = (g.__ccSum ??= new Map());

/** Title and origin from the head and tail of the file only; session files can be tens of MB. */
function summarize(file: string): SessionSummary | null {
  const st = fs.statSync(file), key = `v3:${st.size}:${st.mtimeMs}`;
  const hit = sums.get(file);
  if (hit?.key === key) return hit.s;
  const CH = 256 * 1024;
  const head = readChunk(file, 0, CH).split("\n");
  const tail = st.size > CH ? readChunk(file, st.size - CH, CH).split("\n").slice(1) : head;
  let first = "", entrypoint = "", branch = "";
  for (const l of head) {
    const e = parse(l);
    if (e?.type !== "user") continue;
    entrypoint ||= e.entrypoint || ""; branch ||= e.gitBranch || "";
    first = userText(e);
    if (first) break;
  }
  let title = "";
  for (const l of tail.reverse()) {
    const e = parse(l);
    if (e?.type === "custom-title" && e.customTitle) { title = e.customTitle; break; }
    if (!title && e?.type === "ai-title" && e.aiTitle) title = e.aiTitle;
    if (!title && e?.type === "summary" && e.summary) title = e.summary;
  }
  // Task and workflow runs are listed under Tasks and Executions, not in chat history.
  const run = first.includes(DELEGRA_MARK) && (first.includes("\nTask:\n") || first.includes("Workflow goal:"));
  const mine = first.includes(DELEGRA_MARK);
  const s: SessionSummary | null = !(first || title) || run ? null : {
    id: path.basename(file, ".jsonl"),
    // Claude's auto-title of a Delegra chat describes the team rules, so use the first message instead.
    title: ((mine ? stripBrief(first) : title || first) || "Untitled").replace(/\s+/g, " ").slice(0, 90),
    origin: mine ? "delegra" : entrypoint.includes("vscode") ? "vscode" : entrypoint.includes("jetbrains") ? "jetbrains" : "cli",
    updatedAt: st.mtime.toISOString(), branch: branch || undefined, sizeKb: Math.round(st.size / 1024),
  };
  sums.set(file, { key, s });
  return s;
}

export function listSessions(projectPath: string): SessionSummary[] {
  return sessionFiles(projectPath).map((f) => { try { return summarize(f); } catch { return null; } })
    .filter((s): s is SessionSummary => !!s).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/* ---------- usage: tokens, models and edited files from the project's Claude Code sessions ---------- */

type FileUsage = { v: 2; offset: number; rest: string; lastMsg: string; tokens: number; turns: Record<string, number>; byModel: Record<string, number>; days: Record<string, { replies: number; tokens: number }>; edits: { file: string; at: string }[] };
/** Local calendar day, matching the charts in the browser on this machine. */
const dayKey = (t?: string) => { const d = t ? new Date(t) : null; return d && !isNaN(+d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : ""; };
const gu = globalThis as unknown as { __ccUse?: Map<string, FileUsage> };
const uses = (gu.__ccUse ??= new Map());
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/** Reads only the bytes appended since the last call, so a 100 MB session is parsed once. */
function fileUsage(file: string): FileUsage {
  let u = uses.get(file);
  const size = fs.statSync(file).size;
  if (!u || u.v !== 2 || size < u.offset) { u = { v: 2, offset: 0, rest: "", lastMsg: "", tokens: 0, turns: {}, byModel: {}, days: {}, edits: [] }; uses.set(file, u); }
  const fd = fs.openSync(file, "r");
  try {
    const CH = 4 * 1024 * 1024;
    while (u.offset < size) {
      const b = Buffer.alloc(Math.min(CH, size - u.offset));
      const n = fs.readSync(fd, b, 0, b.length, u.offset);
      if (n <= 0) break;
      u.offset += n;
      const lines = (u.rest + b.subarray(0, n).toString("utf8")).split("\n");
      u.rest = lines.pop() || "";
      for (const l of lines) {
        if (!l.includes('"assistant"')) continue;
        const e = parse(l);
        if (e?.type !== "assistant" || e.isSidechain || !e.message) continue;
        const m = e.message, id = m.id || e.uuid;
        // One reply is logged once per content block, each with the same usage: count it once.
        if (id !== u.lastMsg && m.usage && m.model && m.model !== "<synthetic>") {
          u.lastMsg = id;
          const x = m.usage;
          const t = (x.input_tokens || 0) + (x.output_tokens || 0) + (x.cache_read_input_tokens || 0) + (x.cache_creation_input_tokens || 0);
          u.tokens += t;
          u.turns[m.model] = (u.turns[m.model] || 0) + 1;
          u.byModel[m.model] = (u.byModel[m.model] || 0) + t;
          const k = dayKey(e.timestamp);
          if (k) { const d = (u.days[k] ??= { replies: 0, tokens: 0 }); d.replies++; d.tokens += t; }
        }
        for (const c of Array.isArray(m.content) ? m.content : []) {
          const f = c?.type === "tool_use" && EDIT_TOOLS.has(c.name) && (c.input?.file_path || c.input?.notebook_path);
          if (f) { u.edits.push({ file: f, at: e.timestamp }); if (u.edits.length > 40) u.edits.shift(); }
        }
      }
    }
  } finally { fs.closeSync(fd); }
  return u;
}

export function projectUsage(projectPath: string) {
  let tokens = 0;
  const turns: Record<string, number> = {}, byModel: Record<string, number> = {}, days: Record<string, { replies: number; tokens: number }> = {}, edits: { file: string; at: string; session: string }[] = [];
  const sessions = listSessions(projectPath);
  for (const s of sessions) {
    const file = sessionFiles(projectPath).find((f) => path.basename(f, ".jsonl") === s.id);
    if (!file) continue;
    try {
      const u = fileUsage(file);
      tokens += u.tokens;
      for (const [m, n] of Object.entries(u.turns)) turns[m] = (turns[m] || 0) + n;
      for (const [m, n] of Object.entries(u.byModel)) byModel[m] = (byModel[m] || 0) + n;
      for (const [k, d] of Object.entries(u.days)) { const o = (days[k] ??= { replies: 0, tokens: 0 }); o.replies += d.replies; o.tokens += d.tokens; }
      edits.push(...u.edits.map((x) => ({ ...x, session: s.title })));
    } catch { /* unreadable file */ }
  }
  const root = path.resolve(projectPath).toLowerCase() + path.sep;
  const inside = edits.filter((x) => path.resolve(x.file).toLowerCase().startsWith(root));
  const recent = [...new Map(inside.sort((a, b) => String(b.at).localeCompare(String(a.at))).map((x) => [x.file, x] as const)).values()].slice(0, 8);
  const live = sessions.filter((s) => Date.now() - new Date(s.updatedAt).getTime() < 2 * 60 * 1000).length;
  return { tokens, turns, byModel, days, edits: recent, sessions: sessions.slice(0, 6), sessionCount: sessions.length, live };
}

export function readSession(projectPath: string, id: string): SessionMessage[] | null {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
  const file = sessionFiles(projectPath).find((f) => path.basename(f, ".jsonl") === id);
  if (!file) return null;
  const out: SessionMessage[] = [];
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    const e = parse(l);
    if (e?.type === "user") {
      const t = userText(e);
      if (t) out.push({ role: "user", text: stripBrief(t), at: e.timestamp });
    } else if (e?.type === "assistant") {
      const t = assistantText(e);
      if (!t) continue;
      const last = out[out.length - 1];
      if (last?.role === "assistant") last.text += "\n\n" + t;
      else out.push({ role: "assistant", text: t, at: e.timestamp, model: e.message?.model });
    }
  }
  return out.slice(-200);
}

/* ---------- agents ---------- */

/** Reads a Claude Code subagent file: YAML-ish frontmatter (name, description, model, tools) and the body. */
function readAgentFile(file: string): Omit<Agent, "id"> | null {
  let src: string;
  try { src = fs.readFileSync(file, "utf8"); } catch { return null; }
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) { const i = line.indexOf(":"); if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); }
  if (!fm.name) return null;
  const model = !fm.model || fm.model === "inherit" ? "default" : fm.model;
  return {
    name: fm.name, role: fm.description || "", model, instructions: m[2].trim(), icon: "bot",
    skills: fm.tools ? fm.tools.split(",").map((s) => s.trim()).filter(Boolean) : [], source: "claude-code", file,
  };
}
const slug = (f: string) => path.basename(f, ".md").replace(/[^a-zA-Z0-9_-]/g, "_");
const mdFiles = (dir: string) => { try { return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => path.join(dir, f)); } catch { return []; } };

/** Subagents from ~/.claude/agents, plus each connected project's .claude/agents (only `projectId`'s when given). */
export function claudeAgents(projectId?: string | null): Agent[] {
  const out: Agent[] = [];
  for (const f of mdFiles(path.join(HOME, "agents"))) { const a = readAgentFile(f); if (a) out.push({ ...a, id: `cc-user-${slug(f)}`, scope: "user" }); }
  for (const p of store.list<Project>("projects")) {
    if (projectId && p.id !== projectId) continue;
    for (const f of mdFiles(path.join(p.path, ".claude", "agents"))) { const a = readAgentFile(f); if (a) out.push({ ...a, id: `cc-${p.id}-${slug(f)}`, scope: "project", projectId: p.id }); }
  }
  return out;
}

/** Any agent by id: a Delegra agent from the store, or a Claude Code subagent read fresh from disk. */
export function getAgent(id?: string | null): Agent | null {
  if (!id) return null;
  if (!id.startsWith("cc-")) return store.get<Agent>("agents", id);
  return claudeAgents().find((a) => a.id === id) ?? null;
}

/* ---------- change feed: poll file stats and tell open tabs to refetch ---------- */

const w = globalThis as unknown as { __ccWatch?: NodeJS.Timeout };
function signature(dirs: string[]) {
  return dirs.map((d) => { try { return fs.readdirSync(d).map((f) => { try { const s = fs.statSync(path.join(d, f)); return f + s.size + s.mtimeMs; } catch { return f; } }).join("|"); } catch { return ""; } }).join("#");
}
export function startClaudeWatch() {
  if (w.__ccWatch) return;
  let lastS = "", lastA = "";
  w.__ccWatch = setInterval(() => {
    const projects = store.list<Project>("projects");
    const s = signature(projects.flatMap((p) => sessionDirs(p.path)));
    const a = signature([path.join(HOME, "agents"), ...projects.map((p) => path.join(p.path, ".claude", "agents"))]);
    if (lastS && s !== lastS) bus.emit("change", "sessions");
    if (lastA && a !== lastA) bus.emit("change", "agents");
    lastS = s; lastA = a;
  }, 3000);
  w.__ccWatch.unref?.();
}
