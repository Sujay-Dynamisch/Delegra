import "server-only";
import type { Agent, FlowNode, Project, Run, Settings, Task, Update, Workflow } from "@/lib/types";
import { runAgent } from "./providers";
import { HttpError, store } from "./store";
import { CHAT_SPLIT, DELEGRA_MARK, getAgent } from "./claude-sync";

export const DEFAULT_RULES = [
  "Work only inside your assigned files or module; never edit another agent's files.",
  'Never invent facts, file paths, APIs or results. If you do not know, say "UNKNOWN" and name what you need.',
  "Read only the files you need, only the lines you need. No repository-wide dumps.",
  "Answer in the shortest form that is complete: bullets, changed files, checks run, blockers.",
  "Do not claim a test, build or deploy succeeded unless you ran it and saw it pass.",
  "Ask before anything destructive, external or irreversible (deploys, deletes, messages to people).",
];
const rules = () => (store.get<Settings>("settings", "rules")?.rules || DEFAULT_RULES).map((r, i) => `${i + 1}. ${r}`).join("\n");
function brief(agent: Agent | null) {
  return [
    agent ? `You are "${agent.name}".${agent.role ? " Role: " + agent.role + "." : ""}` : "You are an engineer on this project.",
    agent?.skills?.length ? `Skills: ${agent.skills.join(", ")}.` : "",
    agent?.instructions ? `Standing instructions:\n${agent.instructions}` : "",
    `${DELEGRA_MARK}\n${rules()}`,
  ].filter(Boolean).join("\n\n");
}
const now = () => new Date().toISOString();
const g = globalThis as unknown as { __loLive?: Map<string, { stop(): void }> };
const live = (g.__loLive ??= new Map());

/* ---------- tasks ---------- */
export function runTask(id: string) {
  const task = store.get<Task>("tasks", id);
  if (!task) throw new HttpError(404, "Task not found");
  const project = store.get<Project>("projects", task.projectId);
  if (!project) throw new HttpError(400, "The task's project no longer exists");
  if (live.has(id)) throw new HttpError(409, "Task is already running");
  const agent = getAgent(task.agentId);
  const updates: Update[] = [{ at: now(), text: `Started on ${task.model}`, kind: "system" }];
  const files = new Set(task.files || []);
  let tools = 0;
  const patch = (p: Partial<Task>) => store.update<Task>("tasks", id, p);
  const proc = runAgent({
    prompt: `${brief(agent)}\n\nTask:\n${task.prompt}`, cwd: project.path, model: task.model, effort: task.effort || agent?.effort, permissionMode: project.permissionMode,
    onEvent: (e) => {
      if (e.kind === "text") updates.push({ at: now(), text: e.text.slice(0, 300), kind: "text" });
      else { tools++; updates.push({ at: now(), text: e.summary, kind: "tool" }); if (e.file) files.add(e.file); }
      patch({ progress: Math.min(90, 5 + tools * 6), updates: updates.slice(-40), files: [...files].slice(-60) });
    },
  });
  live.set(id, proc);
  patch({ status: "working", progress: 5, startedAt: now(), finishedAt: null, error: null, updates });
  proc.done.then((r) => {
    live.delete(id);
    patch({
      status: r.ok ? "done" : "blocked", progress: r.ok ? 100 : Math.min(90, 5 + tools * 6), finishedAt: now(), output: r.text.slice(0, 30000),
      error: r.error, sessionId: r.sessionId ?? undefined, tokens: r.tokens, costUsd: r.costUsd, durationMs: r.durationMs,
      updates: [...updates, { at: now(), text: r.ok ? "Finished" : "Stopped: " + r.error, kind: "system" as const }].slice(-40),
    });
  });
}
export function stop(id: string) {
  const p = live.get(id);
  if (!p) throw new HttpError(404, "Not running");
  p.stop();
}

/* ---------- approvals: a run waits at an approval node until you answer ---------- */
const ga = globalThis as unknown as { __loApprove?: Map<string, (a: { ok: boolean; note?: string }) => void> };
const approvals = (ga.__loApprove ??= new Map());
export function answer(runId: string, ok: boolean, note?: string) {
  const resolve = approvals.get(runId);
  if (!resolve) throw new HttpError(404, "This run isn't waiting for approval");
  approvals.delete(runId);
  resolve({ ok, note: note?.trim().slice(0, 4000) || undefined });
}

/* ---------- workflows: n8n-style graph, run in topological order ---------- */
export function runWorkflow(id: string, trigger: Run["trigger"] = "manual", input?: string) {
  const wf = store.get<Workflow>("workflows", id);
  if (!wf) throw new HttpError(404, "Workflow not found");
  const project = store.get<Project>("projects", wf.projectId);
  if (!project) throw new HttpError(400, "The workflow's project no longer exists");
  if (!wf.nodes.some((n) => n.kind === "trigger")) throw new HttpError(400, "Add a trigger node first");
  input = input?.trim().slice(0, 8000) || undefined;
  if (wf.askInput && !input) throw new HttpError(400, wf.askInput);
  const goal = [wf.description || wf.name, input && `This run: ${input}`].filter(Boolean).join("\n\n");
  const runId = store.insert<Omit<Run, "id">>("runs", { projectId: wf.projectId, workflowId: id, workflowName: wf.name, trigger, status: "running", startedAt: now(), nodes: {}, tokens: 0, costUsd: 0, input });
  const nodes: Run["nodes"] = {};
  let stopped = false, current: { stop(): void } | null = null;
  live.set(runId, { stop() { stopped = true; current?.stop(); approvals.get(runId)?.({ ok: false }); approvals.delete(runId); } });
  const save = (p: Partial<Run>) => store.update<Run>("runs", runId, { nodes: { ...nodes }, ...p });
  const incoming = (n: FlowNode) => wf.edges.filter((e) => e.target === n.id);
  const outputs: Record<string, string> = {};

  (async () => {
    let tokens = 0, cost = 0, failed = false;
    const pending = new Set(wf.nodes.filter((n) => n.kind !== "note").map((n) => n.id));
    while (pending.size && !stopped) {
      // Next ready node: all its parents are finished.
      const ready = wf.nodes.find((n) => pending.has(n.id) && incoming(n).every((e) => nodes[e.source] && nodes[e.source].status !== "running"));
      if (!ready) break;
      pending.delete(ready.id);
      const parents = incoming(ready);
      // A branch is live if some parent succeeded and (for a condition) chose this handle.
      const reachable = ready.kind === "trigger" || parents.some((e) => {
        const p = nodes[e.source];
        if (p?.status !== "ok") return false;
        const src = wf.nodes.find((n) => n.id === e.source);
        return src?.kind !== "condition" || (e.sourceHandle || "true") === p.output;
      });
      if (!reachable) { nodes[ready.id] = { status: "skipped" }; save({}); continue; }
      const input = parents.map((e) => outputs[e.source]).filter(Boolean).join("\n\n---\n\n");
      nodes[ready.id] = { status: "running", startedAt: now() };
      save({});
      if (ready.kind === "trigger") { outputs[ready.id] = goal; nodes[ready.id] = { status: "ok", output: "Started", finishedAt: now() }; save({}); continue; }
      if (ready.kind === "merge") { outputs[ready.id] = input; nodes[ready.id] = { status: "ok", output: input.slice(0, 4000), finishedAt: now() }; save({}); continue; }
      if (ready.kind === "approval") {
        // Show what is being approved, then wait for the person.
        nodes[ready.id] = { status: "waiting", output: input.slice(0, 20000), startedAt: nodes[ready.id].startedAt };
        save({});
        const a = await new Promise<{ ok: boolean; note?: string }>((resolve) => approvals.set(runId, resolve));
        if (!a.ok || stopped) { nodes[ready.id] = { ...nodes[ready.id], status: "failed", output: a.note ? `Rejected: ${a.note}` : "Rejected", finishedAt: now() }; stopped = true; break; }
        outputs[ready.id] = input + (a.note ? `\n\n---\n\nInstructions from the person who approved this step (follow them):\n${a.note}` : "");
        nodes[ready.id] = { ...nodes[ready.id], status: "ok", output: a.note ? `Approved: ${a.note}` : "Approved", finishedAt: now() };
        save({}); continue;
      }
      if (ready.kind === "condition") {
        const hit = input.toLowerCase().includes(String(ready.data.contains || "").toLowerCase());
        outputs[ready.id] = input;
        nodes[ready.id] = { status: "ok", output: hit ? "true" : "false", finishedAt: now() };
        save({}); continue;
      }
      const agent = getAgent(ready.data.agentId);
      const prompt = `${brief(agent)}\n\nWorkflow goal: ${goal}\n` +
        (input ? `\nInput from the previous step:\n${input.slice(0, 6000)}\n` : "") +
        `\nYour step:\n${ready.data.instruction || ready.data.label}\n\nReply in the shortest complete form. If you lack information, say UNKNOWN and what you need.`;
      try {
        // Read-only steps with allowed tools run in "default" mode: edits are refused (no one can approve them), the listed tools are allowed.
        const proc = runAgent({ prompt, cwd: project.path, model: ready.data.model || agent?.model || "sonnet", effort: ready.data.effort || agent?.effort,
          permissionMode: ready.data.write ? project.permissionMode : ready.data.tools?.length ? "default" : "plan", tools: ready.data.tools });
        current = proc;
        const r = await proc.done;
        tokens += r.tokens || 0; cost += r.costUsd || 0;
        outputs[ready.id] = r.text;
        nodes[ready.id] = { status: r.ok ? "ok" : "failed", output: (r.ok ? r.text : r.error || "").slice(0, 20000), tokens: r.tokens, costUsd: r.costUsd, startedAt: nodes[ready.id].startedAt, finishedAt: now() };
        if (!r.ok) { failed = true; break; }
      } catch (e) {
        nodes[ready.id] = { status: "failed", output: (e as Error).message, finishedAt: now() };
        failed = true; break;
      }
      save({ tokens, costUsd: cost });
    }
    live.delete(runId);
    save({ status: stopped ? "stopped" : failed ? "failed" : "ok", finishedAt: now(), tokens, costUsd: cost });
  })();
  return runId;
}

/** Lets chat answers include rich views; rendered by components/app/rich-answer.tsx. */
const A2UI_HINT = "Format answers in Markdown (headings, lists, tables). When a visual summary helps (status, metrics, comparisons, choices), you may add ONE ```a2ui block: A2UI v0.8 JSONL with a surfaceUpdate {surfaceId, components:[{id, component:{Text|Card|Row|Column|List|Divider|Icon|Button|Tabs}}]} line, then a beginRendering {surfaceId, root} line. Text: {text:{literalString}, usageHint:h1-h5|caption|body}. Card: {child}. Row/Column/List: {children:{explicitList:[ids]}}. Button: {child, primary, action:{name}}; clicking sends the action name back as the user's next message.";

/* ---------- chat, read-only: a Claude Code session, so it syncs with the CLI and IDE extensions ---------- */
export function ask(projectId: string, prompt: string, model: Task["model"], agentId?: string, onText?: (t: string) => void, resume?: string) {
  const project = store.get<Project>("projects", projectId);
  if (!project) throw new HttpError(400, "Pick a project first");
  if (resume && model.startsWith("agy:")) throw new HttpError(400, "Pick a Claude model to continue a Claude Code conversation.");
  const agent = getAgent(agentId);
  let text = "";
  return runAgent({
    // A resumed session already has the brief, so only the new message is sent.
    prompt: resume ? prompt : `${brief(agent)}\n\n${A2UI_HINT}\n\n${CHAT_SPLIT}${prompt}`, resume, cwd: project.path, model, permissionMode: "plan",
    onEvent: (e) => { if (e.kind === "text") { text += (text ? "\n\n" : "") + e.text; onText?.(text); } },
  });
}
