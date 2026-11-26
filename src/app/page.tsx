"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Coins, FileText, FolderGit2, Layers, ListChecks, Workflow, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/project-context";
import { Empty, ModelTag, PageHeader, Stat, StatusPill } from "@/components/app/bits";
import { modelInfo, ProviderMark, TIER_DOT, useModels } from "@/components/app/pickers";
import { ago, dur, fmtTokens, useList } from "@/lib/client";
import type { Run, Task, Workflow as Wf } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Overview() {
  const { project, providers, setConnectOpen } = useApp();
  const models = useModels();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const tasks = useList<Task>("tasks", project ? project.id : null).rows || [];
  const runs = useList<Run>("runs", project ? project.id : null).rows || [];
  const workflows = useList<Wf>("workflows", project ? project.id : null).rows || [];

  if (!project) return (
    <div className="rounded-2xl border bg-card"><Empty icon={FolderGit2} title="Connect a project folder to start orchestrating agents in it."><Button nativeButton={false} render={<Link href="/projects" />}>Add a project</Button></Empty></div>
  );

  const n = (s: Task["status"]) => tasks.filter((t) => t.status === s).length;
  const tokens = tasks.reduce((a, t) => a + (t.tokens || 0), 0) + runs.reduce((a, r) => a + (r.tokens || 0), 0);
  const timed = tasks.filter((t) => t.durationMs);
  const avg = timed.length ? timed.reduce((a, t) => a + (t.durationMs || 0), 0) / timed.length : null;
  const run = runs.find((r) => r.status === "running") || runs[0];
  const wf = run ? workflows.find((w) => w.id === run.workflowId) : workflows[0];
  const steps = (wf?.nodes || []).filter((x) => x.kind === "agent");
  const doneSteps = run ? steps.filter((s) => run.nodes[s.id]?.status === "ok").length : 0;
  const pct = steps.length ? Math.round((doneSteps / steps.length) * 100) : 0;
  const log = tasks.flatMap((t) => (t.updates || []).map((u) => ({ ...u, who: t.title, model: t.model }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
  const queue = tasks.filter((t) => t.status === "queued" || t.status === "blocked");
  const files = [...new Map(tasks.flatMap((t) => (t.files || []).map((f) => [f, { f, at: t.updatedAt, by: t.title }] as const))).values()].slice(0, 6);
  const lean = () => { if (goal.trim()) router.push(`/chat?lean=1&q=${encodeURIComponent(goal.trim())}`); };

  return (
    <>
      <PageHeader title="Lean orchestration" sub={`Multi-agent work in ${project.name}, routed to the cheapest model that can do each step.`} />
      {providers && !providers.some((p) => p.signedIn && p.granted) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <span>Connect Claude Code or Antigravity so agents can run in this project.</span>
          <Button size="sm" onClick={() => setConnectOpen(true)}>Connect AI</Button>
        </div>
      )}
      <form className="mb-6 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); lean(); }}>
        <label className="flex flex-1 items-center gap-3 rounded-xl border bg-card px-4 shadow-xs focus-within:ring-3 focus-within:ring-ring/40">
          <Zap className="size-4 text-muted-foreground" />
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="What do you want to build, fix, or analyze?" className="h-12 flex-1 bg-transparent outline-none" />
        </label>
        <Button type="submit" size="lg" className="h-12 px-6">Run /lean</Button>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Layers} value={n("working")} label="Active agents" sub={`of ${tasks.length} tasks`} />
        <Stat icon={CheckCircle2} value={n("done")} label="Tasks completed" sub={n("blocked") ? `${n("blocked")} blocked` : "Nothing blocked"} />
        <Stat icon={Coins} value={fmtTokens(tokens)} label="Tokens used" sub="Reported by Claude Code" />
        <Stat icon={Clock} value={dur(avg)} label="Avg. task time" sub={timed.length ? `${timed.length} finished tasks` : "No finished tasks"} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border bg-card shadow-xs">
          <div className="flex items-center gap-2 px-5 pt-5"><Workflow className="size-4" /><h3 className="font-semibold">{run ? "Active workflow" : "Workflows"}</h3>{run && <StatusPill status={run.status} className="ml-auto" />}</div>
          <div className="px-5 pb-5">
            {!wf ? <Empty icon={Workflow} title="No workflows yet. Chain agents into a graph and run it."><Button nativeButton={false} render={<Link href="/workflows?new=1" />}>Create workflow</Button></Empty> : (
              <>
                <p className="mt-3 text-[17px] font-semibold">{wf.name}</p>
                <p className="text-sm text-muted-foreground">{steps.length} agent steps · {run ? `started ${ago(run.startedAt)}` : "not run yet"}</p>
                <div className="my-4 flex items-stretch gap-2 overflow-x-auto pb-1">
                  {steps.map((s, i) => {
                    const st = run?.nodes[s.id]?.status;
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        {i > 0 && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
                        <div className={cn("flex min-w-40 items-center gap-3 rounded-xl border px-3 py-2.5", st === "running" && "border-blue-500 ring-3 ring-blue-500/15")}>
                          <ProviderMark provider={modelInfo(s.data.model, models).provider} className="size-4" />
                          <div className="min-w-0"><div className="truncate text-sm font-semibold">{s.data.label}</div><div className="text-xs text-muted-foreground">{modelInfo(s.data.model, models).label}</div></div>
                          {st && <StatusPill status={st} className="ml-auto px-1.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4"><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-all" style={{ width: pct + "%" }} /></div><b className="w-10 text-right text-sm">{pct}%</b></div>
              </>
            )}
            <div className="mt-5 border-t pt-3">
              <p className="mb-2 text-sm font-medium">Live log</p>
              {log.length ? (
                <div className="max-h-56 overflow-y-auto font-mono text-xs leading-6">
                  {log.map((l, i) => (
                    <div key={i} className="grid grid-cols-[64px_10px_minmax(0,1fr)] items-baseline gap-2">
                      <time className="text-muted-foreground">{new Date(l.at).toLocaleTimeString([], { hour12: false })}</time>
                      <span className={cn("size-1.5 rounded-full", l.kind === "tool" ? "bg-blue-500" : l.kind === "system" ? "bg-muted-foreground" : "bg-emerald-500")} />
                      <span className="truncate"><span className="text-muted-foreground">[{l.who} · {l.model}] </span>{l.text}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Agents post here as they work.</p>}
            </div>
          </div>
        </section>

        <div className="grid min-w-0 content-start gap-6">
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Model router</h3><span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">Auto (lean)</span></div>
            {[...new Set(["haiku", "sonnet", "opus", ...tasks.map((t) => t.model || "sonnet")])].map((id) => {
              const m = modelInfo(id, models), c = tasks.filter((t) => (t.model || "sonnet") === id).length;
              return (
                <div key={id} className="flex items-center gap-3 border-t py-3 first-of-type:border-0">
                  <ProviderMark provider={m.provider} />
                  <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-sm font-semibold">{m.label}<span className={cn("size-1.5 rounded-full", TIER_DOT[m.tier])} /></div><div className="text-xs text-muted-foreground">{m.note}</div></div>
                  <b className="text-sm">{tasks.length ? Math.round((c / tasks.length) * 100) : 0}%</b>
                </div>
              );
            })}
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-xs">
            <h3 className="mb-2 font-semibold">Task queue ({queue.length})</h3>
            {queue.length ? queue.slice(0, 5).map((t) => (
              <Link key={t.id} href={`/tasks?open=${t.id}`} className="flex items-center gap-3 border-t py-2.5 text-sm first-of-type:border-0 hover:underline">
                <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span><StatusPill status={t.status} />
              </Link>
            )) : <p className="text-sm text-muted-foreground">Queue is empty.</p>}
          </section>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 font-semibold"><ListChecks className="size-4" />Recent tasks</h3><Link href="/tasks" className="text-sm font-medium hover:underline">View all</Link></div>
          {tasks.filter((t) => t.status === "done").slice(0, 5).map((t) => (
            <div key={t.id} className="grid grid-cols-[18px_minmax(0,1fr)_auto_auto_auto] items-center gap-3 border-t py-2.5 text-sm first-of-type:border-0">
              <CheckCircle2 className="size-4 text-emerald-600" /><span className="truncate font-medium">{t.title}</span>
              <span className="text-muted-foreground">{dur(t.durationMs)}</span><span className="text-muted-foreground">{fmtTokens(t.tokens)} tokens</span><ModelTag model={t.model} />
            </div>
          ))}
          {!n("done") && <p className="text-sm text-muted-foreground">No finished tasks yet.</p>}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="mb-2 flex items-center gap-2 font-semibold"><FileText className="size-4" />Files changed</h3>
          {files.length ? files.map((x) => (
            <div key={x.f} className="flex items-center gap-3 border-t py-2.5 text-sm first-of-type:border-0">
              <FileText className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate font-medium" title={x.f}>{x.f.split(/[\\/]/).pop()}</span>
              <span className="truncate text-muted-foreground">{x.by}</span><span className="text-muted-foreground">{ago(x.at)}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Agents list the files they change here.</p>}
        </section>
      </div>
    </>
  );
}
