"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, FileText, ListChecks, Loader2, Play, Plus, RotateCw, Search, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/components/app/project-context";
import { Empty, Field, ModelTag, PageHeader, StatusPill } from "@/components/app/bits";
import { AgentPicker, EffortPicker, ModelPicker } from "@/components/app/pickers";
import { ago, api, db, dur, fmtTokens, useList } from "@/lib/client";
import type { Agent, Effort, Model, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [["all", "All"], ["working", "Working"], ["queued", "Queued"], ["blocked", "Blocked"], ["done", "Completed"]] as const;

function TasksPage() {
  const params = useSearchParams();
  const { project } = useApp();
  const { rows } = useList<Task>("tasks", project ? project.id : null);
  const agents = useList<Agent>("agents").rows || [];
  const tasks = useMemo(() => rows || [], [rows]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const [form, setForm] = useState<{ title: string; prompt: string; model: Model; agentId: string; effort?: Effort } | null>(params.get("new") ? { title: "", prompt: "", model: "default", agentId: "" } : null);
  useEffect(() => { if (params.get("new")) setForm({ title: "", prompt: "", model: "default", agentId: "" }); }, [params]);

  if (!project) return <div className="rounded-2xl border bg-card"><Empty icon={ListChecks} title="Pick or connect a project first." /></div>;
  const count = (f: string) => (f === "all" ? tasks.length : tasks.filter((t) => t.status === f).length);
  const list = tasks.filter((t) => (filter === "all" || t.status === filter) && (!q || (t.title + " " + t.prompt).toLowerCase().includes(q.toLowerCase())));

  const act = async (action: "task" | "stop", id: string) => {
    try { await api("/api/run", { body: { action, id } }); toast(action === "task" ? "Agent started" : "Stopping…"); } catch (e) { toast.error((e as Error).message); }
  };
  const save = async (run: boolean) => {
    if (!form?.title.trim() || !form.prompt.trim()) return toast.error("Give the task a title and instructions.");
    const agent = agents.find((a) => a.id === form.agentId);
    const { id } = await db.create("tasks", { ...form, model: agent?.model || form.model, agentId: form.agentId || undefined, projectId: project.id, status: "queued", progress: 0, updates: [], files: [] });
    setForm(null);
    if (run) await act("task", id); else toast.success("Task queued");
  };

  return (
    <>
      <PageHeader title="Tasks" sub="Each task is one AI agent (Claude Code or Antigravity) working in this project.">
        {!form && <Button onClick={() => setForm({ title: "", prompt: "", model: "default", agentId: "" })}><Plus />New task</Button>}
      </PageHeader>
      {form && (
        <section className="mb-6 grid gap-4 rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="font-semibold">New task</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fix the login crash" autoFocus /></Field>
            <Field label="Agent" hint="Brings its role, skills and instructions">
              <AgentPicker agents={agents} value={form.agentId} onChange={(agentId) => setForm({ ...form, agentId })} />
            </Field>
            <Field label="Model">
              <ModelPicker value={agents.find((a) => a.id === form.agentId)?.model || form.model} disabled={!!form.agentId} onChange={(model) => setForm({ ...form, model })} />
            </Field>
            <Field label="Effort" hint="Higher effort thinks longer and uses more tokens" className="md:col-span-3"><EffortPicker value={form.effort} onChange={(effort) => setForm({ ...form, effort })} /></Field>
            <Field label="Instructions" className="md:col-span-3"><Textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} rows={4} placeholder="What the agent should do, which files it owns, and how to check it worked." /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(true)}><Play />Create and run</Button>
            <Button variant="outline" onClick={() => save(false)}>Add to queue</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map(([f, l]) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground", filter === f && "bg-card text-foreground shadow-xs ring-1 ring-border")}>{l} ({count(f)})</button>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <div className="border-b p-3"><label className="flex items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="h-9 flex-1 bg-transparent text-sm outline-none" /></label></div>
        {!list.length ? <Empty icon={ListChecks} title={tasks.length ? "No tasks match." : "No tasks yet. Create one and an agent starts working in this project."} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>{["Task", "Model", "Progress", "Status", "Tokens", "Updated", ""].map((h) => <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <Row key={t.id} t={t} open={open === t.id} toggle={() => setOpen(open === t.id ? null : t.id)} act={act} agent={agents.find((a) => a.id === t.agentId)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Row({ t, open, toggle, act, agent }: { t: Task; open: boolean; toggle: () => void; act: (a: "task" | "stop", id: string) => void; agent?: Agent }) {
  return (
    <>
      <tr onClick={toggle} className="cursor-pointer border-t hover:bg-muted/40">
        <td className="px-4 py-3"><div className="font-medium">{t.title}</div><div className="max-w-md truncate text-xs text-muted-foreground">{agent ? agent.name + " · " : ""}{t.prompt}</div></td>
        <td className="px-4 py-3"><ModelTag model={t.model} /></td>
        <td className="min-w-36 px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", t.status === "blocked" ? "bg-red-500" : t.status === "done" ? "bg-emerald-500" : "bg-foreground")} style={{ width: t.progress + "%" }} /></div><span className="font-mono text-xs">{t.progress}%</span></div></td>
        <td className="px-4 py-3"><StatusPill status={t.status} /></td>
        <td className="px-4 py-3 font-mono text-xs">{fmtTokens(t.tokens)}</td>
        <td className="px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">{ago(t.updatedAt)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-1">
            {t.status === "working"
              ? <Button size="sm" variant="outline" onClick={() => act("stop", t.id)}><Square />Stop</Button>
              : <Button size="sm" variant="outline" onClick={() => act("task", t.id)}>{t.status === "queued" ? <><Play />Run</> : <><RotateCw />Re-run</>}</Button>}
            <Button size="icon" variant="ghost" aria-label="Details" onClick={toggle}>{open ? <ChevronUp /> : <ChevronDown />}</Button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-t bg-muted/30">
          <td colSpan={7} className="px-5 py-4">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Activity</p>
                <ol className="grid max-h-72 gap-1.5 overflow-y-auto font-mono text-xs">
                  {(t.updates || []).slice().reverse().map((u, i) => (
                    <li key={i} className="flex gap-3"><time className="shrink-0 text-muted-foreground">{new Date(u.at).toLocaleTimeString([], { hour12: false })}</time><span className={cn(u.kind === "tool" && "text-blue-600 dark:text-blue-400")}>{u.text}</span></li>
                  ))}
                  {!t.updates?.length && <li className="text-muted-foreground">Not started.</li>}
                </ol>
                {t.status === "working" && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Working…</p>}
              </div>
              <div className="grid content-start gap-3">
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>Duration <b className="text-foreground">{dur(t.durationMs)}</b></span>
                  <span>Tokens <b className="text-foreground">{fmtTokens(t.tokens)}</b></span>
                  {t.costUsd != null && <span title="Claude Code's estimate. On a subscription plan this is not a charge.">Est. value <b className="text-foreground">${t.costUsd.toFixed(3)}</b></span>}
                </div>
                {t.error && <p className="rounded-lg bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-400">{t.error}</p>}
                {t.output && <pre className="max-h-72 overflow-auto rounded-lg border bg-background p-3 font-mono text-xs whitespace-pre-wrap">{t.output}</pre>}
                {!!t.files?.length && <div className="flex flex-wrap gap-1.5">{t.files.map((f) => <span key={f} title={f} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs"><FileText className="size-3" />{f.split(/[\\/]/).pop()}</span>)}</div>}
                <div><Button size="sm" variant="ghost" className="text-red-600" onClick={() => { if (confirm("Delete this task?")) db.remove("tasks", t.id); }}><Trash2 />Delete task</Button></div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Page() { return <Suspense><TasksPage /></Suspense>; }
