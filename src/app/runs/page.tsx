"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, History, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/project-context";
import { Empty, PageHeader, StatusPill } from "@/components/app/bits";
import { api, dur, fmtTokens, useList } from "@/lib/client";
import type { Run, Workflow } from "@/lib/types";

export default function Runs() {
  const { project } = useApp();
  const runs = useList<Run>("runs", project ? project.id : null).rows || [];
  const workflows = useList<Workflow>("workflows", project ? project.id : null).rows || [];
  const [open, setOpen] = useState<string | null>(null);
  if (!project) return <div className="rounded-2xl border bg-card"><Empty icon={History} title="Pick or connect a project first." /></div>;
  return (
    <>
      <PageHeader title="Executions" sub="Every workflow run in this project, newest first. Open one to read each node's output." />
      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        {!runs.length ? <Empty icon={History} title="No executions yet. Open a workflow and click Execute." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground"><tr>{["Execution", "Workflow", "Trigger", "Nodes", "Tokens", "Duration", "Status", ""].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {runs.map((r) => {
                  const wf = workflows.find((w) => w.id === r.workflowId);
                  const ids = Object.keys(r.nodes || {});
                  return [
                    <tr key={r.id} onClick={() => setOpen(open === r.id ? null : r.id)} className="cursor-pointer border-t hover:bg-muted/40">
                      <td className="px-4 py-3"><div className="font-mono text-xs font-semibold">#{r.id.slice(0, 6).toUpperCase()}</div><div className="text-xs text-muted-foreground">{new Date(r.startedAt).toLocaleString()}</div></td>
                      <td className="px-4 py-3 font-medium">{wf ? <Link href={`/workflows/${wf.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{r.workflowName}</Link> : r.workflowName}</td>
                      <td className="px-4 py-3 capitalize">{r.trigger}</td>
                      <td className="px-4 py-3 font-mono text-xs">{ids.filter((i) => r.nodes[i].status === "ok").length} / {ids.length}</td>
                      <td className="px-4 py-3 font-mono text-xs">{fmtTokens(r.tokens)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.finishedAt ? dur(new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) : "—"}</td>
                      <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "running" ? <Button size="sm" variant="outline" onClick={() => api("/api/run", { body: { action: "stop", id: r.id } })}><Square />Stop</Button>
                          : <Button size="icon" variant="ghost" aria-label="Details" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? <ChevronUp /> : <ChevronDown />}</Button>}
                      </td>
                    </tr>,
                    open === r.id && (
                      <tr key={r.id + "-d"} className="border-t bg-muted/30"><td colSpan={8} className="grid gap-3 px-5 py-4">
                        {ids.map((nid) => {
                          const n = r.nodes[nid], label = wf?.nodes.find((x) => x.id === nid)?.data.label || nid;
                          return (
                            <details key={nid} open={n.status === "failed"} className="rounded-xl border bg-background p-3">
                              <summary className="flex cursor-pointer items-center gap-3 text-sm font-medium">{label}<StatusPill status={n.status} />{n.tokens != null && <span className="text-xs text-muted-foreground">{fmtTokens(n.tokens)} tokens</span>}</summary>
                              {n.output && <pre className="mt-2 max-h-72 overflow-auto font-mono text-xs whitespace-pre-wrap">{n.output}</pre>}
                            </details>
                          );
                        })}
                      </td></tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
