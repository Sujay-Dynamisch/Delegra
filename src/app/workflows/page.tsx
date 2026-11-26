"use client";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Play, Plus, Trash2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/project-context";
import { Empty, PageHeader, StatusPill } from "@/components/app/bits";
import { ago, api, db, useList } from "@/lib/client";
import type { Agent, Run, Workflow as Wf } from "@/lib/types";

function starter(projectId: string, agents: Agent[]): Omit<Wf, "id"> {
  const pick = (m: string) => agents.find((a) => a.model.includes(m));
  const plan = pick("haiku"), build = pick("sonnet"), review = pick("opus") || pick("sonnet");
  return {
    projectId, name: "Untitled workflow", description: "", edges: [
      { id: "e1", source: "trigger", target: "plan" }, { id: "e2", source: "plan", target: "build" }, { id: "e3", source: "build", target: "review" },
    ],
    nodes: [
      { id: "trigger", kind: "trigger", position: { x: 0, y: 120 }, data: { label: "Run manually" } },
      { id: "plan", kind: "agent", position: { x: 220, y: 120 }, data: { label: "Plan", agentId: plan?.id, model: plan?.model || "claude-haiku-5-5", instruction: "Read only what you need and write a short step-by-step plan." } },
      { id: "build", kind: "agent", position: { x: 440, y: 120 }, data: { label: "Implement", agentId: build?.id, model: build?.model || "claude-sonnet-5-5", instruction: "Implement the plan. List changed files and checks you ran.", write: true } },
      { id: "review", kind: "agent", position: { x: 660, y: 120 }, data: { label: "Review", agentId: review?.id, model: review?.model || "claude-opus-5-5", instruction: "Review the change for bugs and regressions. Reply PASS or list concrete defects." } },
    ],
  };
}

function WorkflowsPage() {
  const { project } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const workflows = useList<Wf>("workflows", project ? project.id : null).rows || [];
  const runs = useList<Run>("runs", project ? project.id : null).rows || [];
  const agents = useList<Agent>("agents", project?.id).rows;
  const made = useRef(false);

  const create = async () => {
    if (!project) return;
    const { id } = await db.create("workflows", starter(project.id, agents || []));
    router.push(`/workflows/${id}`);
  };
  useEffect(() => { if (params.get("new") && project && agents && !made.current) { made.current = true; create(); } }, [params, project, agents]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return <div className="rounded-2xl border bg-card"><Empty icon={Workflow} title="Pick or connect a project first." /></div>;
  return (
    <>
      <PageHeader title="Workflows" sub="Node graphs of agents: plan with Haiku, build with Sonnet, review with Opus. Branch with conditions and merge results.">
        <Button onClick={create}><Plus />New workflow</Button>
      </PageHeader>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        {!workflows.length ? <Empty icon={Workflow} title="No workflows in this project yet."><Button onClick={create}><Plus />New workflow</Button></Empty> : workflows.map((w) => {
          const last = runs.find((r) => r.workflowId === w.id);
          const chain = w.nodes.filter((n) => n.kind === "agent").map((n) => n.data.label).join(" → ");
          return (
            <div key={w.id} className="flex flex-wrap items-center gap-4 border-t px-5 py-4 first:border-0">
              <div className="grid size-11 place-items-center rounded-xl border"><Workflow className="size-5" /></div>
              <Link href={`/workflows/${w.id}`} className="min-w-0 flex-1">
                <div className="font-semibold hover:underline">{w.name}</div>
                <div className="truncate text-sm text-muted-foreground">{chain || "No agent nodes yet"}</div>
              </Link>
              <div className="grid justify-items-end gap-1 text-xs text-muted-foreground">
                {last ? <StatusPill status={last.status} /> : <span className="rounded-full bg-muted px-2.5 py-0.5">Never run</span>}
                Updated {ago(w.updatedAt)}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => api("/api/run", { body: { action: "workflow", id: w.id } }).then(() => toast("Workflow started"), (e) => toast.error(e.message))}><Play />Run</Button>
                <Button size="sm" nativeButton={false} render={<Link href={`/workflows/${w.id}`} />}>Open</Button>
                <Button size="icon" variant="ghost" aria-label={`Delete ${w.name}`} onClick={() => { if (confirm(`Delete ${w.name}?`)) db.remove("workflows", w.id); }}><Trash2 /></Button>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
export default function Page() { return <Suspense><WorkflowsPage /></Suspense>; }
