"use client";
import { BadgeCheck, ChartNoAxesColumn, Clock, Coins, Play } from "lucide-react";
import { useApp } from "@/components/app/project-context";
import { Empty, PageHeader, Stat } from "@/components/app/bits";
import { modelInfo, useModels } from "@/components/app/pickers";
import { dur, fmtTokens, useList } from "@/lib/client";
import type { Run, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const PALETTE = ["#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#64748b"];

export default function Analytics() {
  const { project } = useApp();
  const models = useModels();
  const tasks = useList<Task>("tasks", project ? project.id : null).rows || [];
  const runs = useList<Run>("runs", project ? project.id : null).rows || [];
  if (!project) return <div className="rounded-2xl border bg-card"><Empty icon={ChartNoAxesColumn} title="Pick or connect a project first." /></div>;

  const byModel = [...new Set(tasks.map((t) => t.model || "sonnet"))].map((m, i) => ({ m, color: PALETTE[i % PALETTE.length], label: modelInfo(m, models).label, v: tasks.filter((t) => (t.model || "sonnet") === m).reduce((a, t) => a + (t.tokens || 0), 0) }));
  const total = byModel.reduce((a, x) => a + x.v, 0);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6 + i); return d; });
  const perDay = days.map((d) => [...tasks.map((t) => t.startedAt), ...runs.map((r) => r.startedAt)].filter((s) => s && new Date(s) >= d && new Date(s).getTime() < d.getTime() + 864e5).length);
  const finished = [...tasks.filter((t) => t.status === "done" || t.status === "blocked"), ...runs.filter((r) => r.status !== "running")];
  const okCount = tasks.filter((t) => t.status === "done").length + runs.filter((r) => r.status === "ok").length;
  const timed = tasks.filter((t) => t.durationMs);

  // Donut and line chart as plain SVG.
  const R = 62, C = 2 * Math.PI * R;
  const arcs = byModel.filter((b) => b.v).map((b, i, all) => ({ ...b, len: (b.v / total) * C, off: all.slice(0, i).reduce((a, x) => a + (x.v / total) * C, 0) }));
  const W = 560, H = 220, P = 32, max = Math.max(4, ...perDay);
  const x = (i: number) => P + ((W - P * 2) * i) / 6, y = (v: number) => H - P - ((H - P * 2) * v) / max;
  const pts = perDay.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <>
      <PageHeader title="Analytics" sub="Token use, success rate and activity in this project, from what Claude Code reports for each run." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Coins} value={fmtTokens(total + runs.reduce((a, r) => a + (r.tokens || 0), 0))} label="Total tokens" sub="Tasks and workflow runs" />
        <Stat icon={Play} value={perDay.reduce((a, b) => a + b, 0)} label="Runs, last 7 days" />
        <Stat icon={Clock} value={dur(timed.length ? timed.reduce((a, t) => a + (t.durationMs || 0), 0) / timed.length : null)} label="Avg. task time" />
        <Stat icon={BadgeCheck} value={finished.length ? Math.round((okCount / finished.length) * 100) + "%" : "—"} label="Success rate" sub={`${finished.length} finished`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="mb-4 font-semibold">Token usage by model</h3>
          {!total ? <p className="text-sm text-muted-foreground">No finished tasks yet.</p> : (
            <div className="flex flex-wrap items-center gap-8">
              <svg width="160" height="160" viewBox="0 0 160 160" role="img" aria-label={byModel.map((b) => `${b.m} ${b.v}`).join(", ")}>
                {arcs.map((b) => <circle key={b.m} cx="80" cy="80" r={R} fill="none" stroke={b.color} strokeWidth="22" strokeDasharray={`${b.len} ${C - b.len}`} strokeDashoffset={-b.off} transform="rotate(-90 80 80)" />)}
                <text x="80" y="78" textAnchor="middle" className="fill-foreground text-xl font-semibold">{fmtTokens(total)}</text>
                <text x="80" y="98" textAnchor="middle" className="fill-muted-foreground text-xs">tokens</text>
              </svg>
              <div className="grid min-w-40 gap-3">
                {byModel.map((b) => <div key={b.m} className="flex items-center gap-3 text-sm"><span className="size-2.5 rounded-full" style={{ background: b.color }} /><span>{b.label}</span><b className="ml-auto">{Math.round((b.v / total) * 100)}%</b></div>)}
              </div>
            </div>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="mb-2 font-semibold">Activity</h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Runs per day: ${perDay.join(", ")}`}>
            {[0, max / 2, max].map((t) => <g key={t}><line x1={P} x2={W - P} y1={y(t)} y2={y(t)} className="stroke-border" /><text x={P - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{Math.round(t)}</text></g>)}
            <polygon points={`${x(0)},${y(0)} ${pts} ${x(6)},${y(0)}`} fill="#10b981" opacity="0.1" />
            <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" />
            {perDay.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="4" className="fill-card" stroke="#10b981" strokeWidth="2"><title>{v} runs</title></circle>)}
            {days.map((d, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">{d.toLocaleDateString([], { month: "short", day: "numeric" })}</text>)}
          </svg>
        </section>
      </div>
    </>
  );
}
