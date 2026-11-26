"use client";
import "@xyflow/react/dist/style.css";
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  addEdge, Background, BackgroundVariant, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow,
  type Connection, type Edge,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { ArrowLeft, Loader2, Play, Plus, Save, Search, Square, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field, StatusPill } from "@/components/app/bits";
import { AgentPicker, EffortPicker, ModelPicker } from "@/components/app/pickers";
import { KINDS, nodeTypes, type LoNode, type NodeData } from "@/components/flow/nodes";
import { api, db, dur, fmtTokens, useDoc, useList } from "@/lib/client";
import type { Agent, FlowNode, Model, Run, Workflow } from "@/lib/types";
import { cn } from "@/lib/utils";

const toFlow = (n: FlowNode): LoNode => ({ id: n.id, type: "card", position: n.position, data: { ...n.data, kind: n.kind } });
const fromFlow = (n: LoNode): FlowNode => {
  const { kind, run: _r, agentName: _a, ...data } = n.data; // eslint-disable-line @typescript-eslint/no-unused-vars
  return { id: n.id, kind, position: { x: Math.round(n.position.x), y: Math.round(n.position.y) }, data };
};
const edgeStyle = { strokeWidth: 2 };

function Editor({ id }: { id: string }) {
  const { doc: wf } = useDoc<Workflow>("workflows", id);
  const agentRows = useList<Agent>("agents", wf?.projectId).rows;
  const agents = useMemo(() => agentRows || [], [agentRows]);
  const runs = (useList<Run>("runs", wf ? wf.projectId : null).rows || []).filter((r) => r.workflowId === id);
  const run = runs[0];
  const [nodes, setNodes, onNodesChange] = useNodesState<LoNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [name, setName] = useState("");
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [paletteQ, setPaletteQ] = useState("");
  const [outputOpen, setOutputOpen] = useState(true);
  const loaded = useRef(false);
  const rf = useReactFlow();
  const { resolvedTheme } = useTheme();

  // Load once; later live updates only refresh run status, never the graph being edited.
  useEffect(() => {
    if (!wf || loaded.current) return;
    loaded.current = true;
    setName(wf.name);
    setNodes(wf.nodes.map(toFlow));
    setEdges(wf.edges.map((e) => ({ ...e, style: edgeStyle })));
  }, [wf, setNodes, setEdges]);

  // Decorate nodes with agent names and the latest run's status.
  const shown = useMemo(() => nodes.map((n) => ({
    ...n, data: { ...n.data, agentName: agents.find((a) => a.id === n.data.agentId)?.name, run: run?.nodes?.[n.id] },
  })), [nodes, agents, run]);
  const shownEdges = useMemo(() => edges.map((e) => ({ ...e, animated: run?.status === "running" && run.nodes[e.source]?.status === "ok" && run.nodes[e.target]?.status === "running" })), [edges, run]);

  const save = useCallback(async () => {
    try {
      await db.update("workflows", id, { name: name.trim() || "Untitled workflow", nodes: nodes.map(fromFlow), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })) });
      setDirty(false); toast.success("Saved");
    } catch (e) { toast.error((e as Error).message); }
  }, [id, name, nodes, edges]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [save]);

  const execute = async () => {
    if (dirty) await save();
    try { await api("/api/run", { body: { action: "workflow", id } }); setOutputOpen(true); } catch (e) { toast.error((e as Error).message); }
  };
  const onConnect = useCallback((c: Connection) => { setEdges((es) => addEdge({ ...c, id: `e${Date.now()}`, style: edgeStyle }, es)); setDirty(true); }, [setEdges]);

  const addNode = (kind: FlowNode["kind"]) => {
    const from = nodes.find((n) => n.id === selected) || [...nodes].sort((a, b) => b.position.x - a.position.x)[0];
    const nid = `${kind}-${Date.now().toString(36)}`;
    const pos = from ? { x: from.position.x + 220, y: from.position.y } : rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const data: NodeData = { kind, label: kind === "agent" ? "Agent step" : KINDS[kind].label, ...(kind === "agent" ? { model: "sonnet" as Model, instruction: "" } : {}) };
    setNodes((ns) => [...ns, { id: nid, type: "card", position: pos, data }]);
    if (from && kind !== "note" && kind !== "trigger" && from.data.kind !== "note") setEdges((es) => [...es, { id: `e${Date.now()}`, source: from.id, target: nid, sourceHandle: from.data.kind === "condition" ? "true" : undefined, style: edgeStyle }]);
    setSelected(nid); setPalette(false); setDirty(true);
  };
  const patch = (nid: string, p: Partial<NodeData>) => { setNodes((ns) => ns.map((n) => (n.id === nid ? { ...n, data: { ...n.data, ...p } } : n))); setDirty(true); };
  const remove = (nid: string) => { setNodes((ns) => ns.filter((n) => n.id !== nid)); setEdges((es) => es.filter((e) => e.source !== nid && e.target !== nid)); setSelected(null); setDirty(true); };

  if (!wf) return <div className="grid h-[calc(100dvh-57px)] place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  const sel = nodes.find((n) => n.id === selected);
  const kinds = (Object.keys(KINDS) as FlowNode["kind"][]).filter((k) => (KINDS[k].label + KINDS[k].desc).toLowerCase().includes(paletteQ.toLowerCase()));

  return (
    <div className="flex h-[calc(100dvh-57px)] flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
        <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/workflows" aria-label="Back to workflows" />}><ArrowLeft /></Button>
        <input value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} aria-label="Workflow name" className="min-w-0 rounded-md bg-transparent px-2 py-1 text-[15px] font-semibold outline-none hover:bg-muted focus:bg-muted" />
        <span className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "Saved"}</span>
        <div className="ml-auto flex items-center gap-2">
          {run && <StatusPill status={run.status} />}
          <Button variant="outline" size="sm" onClick={save} disabled={!dirty}><Save />Save</Button>
          {run?.status === "running"
            ? <Button size="sm" variant="destructive" onClick={() => api("/api/run", { body: { action: "stop", id: run.id } })}><Square />Stop</Button>
            : <Button size="sm" onClick={execute} className="bg-orange-600 text-white hover:bg-orange-600/90"><Play />Execute workflow</Button>}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={shown} edges={shownEdges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeDragStop={() => setDirty(true)} onNodesDelete={() => setDirty(true)} onEdgesDelete={() => setDirty(true)}
            onNodeClick={(_, n) => setSelected(n.id)} onPaneClick={() => setSelected(null)} fitView fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
            forceColorMode={resolvedTheme === "dark" ? "dark" : "light"} proOptions={{ hideAttribution: true }} deleteKeyCode={["Delete", "Backspace"]}
            defaultEdgeOptions={{ style: edgeStyle }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.4} />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap position="bottom-right" pannable zoomable className="!rounded-xl !border" />
            <Panel position="top-right">
              <Button size="icon" className="size-10 rounded-xl shadow-md" aria-label="Add node" onClick={() => setPalette(true)}><Plus className="size-5" /></Button>
            </Panel>
            {!nodes.length && (
              <Panel position="top-center" className="!top-1/3">
                <button onClick={() => addNode("trigger")} className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-sm text-muted-foreground hover:border-foreground/40">
                  <Plus className="size-8" />Add first step
                </button>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* node palette, like n8n's "What happens next?" */}
        {palette && (
          <aside className="absolute inset-y-0 right-0 z-10 flex w-[340px] max-w-full flex-col border-l bg-background shadow-xl">
            <div className="flex items-center justify-between border-b p-4"><h3 className="font-semibold">What happens next?</h3><Button variant="ghost" size="icon" aria-label="Close" onClick={() => setPalette(false)}><X /></Button></div>
            <div className="p-3"><label className="flex items-center gap-2 rounded-lg border px-3"><Search className="size-4 text-muted-foreground" /><input autoFocus value={paletteQ} onChange={(e) => setPaletteQ(e.target.value)} placeholder="Search nodes…" className="h-9 flex-1 bg-transparent text-sm outline-none" /></label></div>
            <div className="grid gap-1 overflow-y-auto px-2 pb-3">
              {kinds.map((k) => {
                const K = KINDS[k];
                return (
                  <button key={k} onClick={() => addNode(k)} disabled={k === "trigger" && nodes.some((n) => n.data.kind === "trigger")} className="flex items-start gap-3 rounded-xl p-3 text-left hover:bg-muted disabled:opacity-40">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", K.tint)}><K.icon className="size-5" /></span>
                    <span><span className="block text-sm font-semibold">{K.label}</span><span className="block text-xs text-muted-foreground">{K.desc}</span></span>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* node settings */}
        {sel && !palette && (
          <aside className="absolute inset-y-0 right-0 z-10 flex w-[380px] max-w-full flex-col border-l bg-background shadow-xl">
            <div className="flex items-center gap-3 border-b p-4">
              <span className={cn("grid size-9 place-items-center rounded-lg", KINDS[sel.data.kind].tint)}>{(() => { const I = KINDS[sel.data.kind].icon; return <I className="size-4" />; })()}</span>
              <h3 className="flex-1 font-semibold">{KINDS[sel.data.kind].label}</h3>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setSelected(null)}><X /></Button>
            </div>
            <div className="grid content-start gap-4 overflow-y-auto p-4">
              <Field label="Name"><Input value={sel.data.label} onChange={(e) => patch(sel.id, { label: e.target.value })} /></Field>
              {sel.data.kind === "agent" && (
                <>
                  <Field label="Agent" hint="Its role, skills and instructions go into the prompt">
                    <AgentPicker agents={agents} value={sel.data.agentId} onChange={(v) => { const a = agents.find((x) => x.id === v); patch(sel.id, { agentId: v || undefined, ...(a ? { model: a.model } : {}) }); }} />
                  </Field>
                  <Field label="Model">
                    <ModelPicker value={sel.data.model} onChange={(m) => patch(sel.id, { model: m })} />
                  </Field>
                  <Field label="Effort"><EffortPicker value={sel.data.effort} onChange={(effort) => patch(sel.id, { effort })} /></Field>
                  <Field label="Instruction" hint="The previous node's output is added as input automatically"><Textarea rows={7} value={sel.data.instruction || ""} onChange={(e) => patch(sel.id, { instruction: e.target.value })} placeholder="What this step must do and return." /></Field>
                  <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                    <span><b className="block font-medium">Can edit files</b><span className="text-xs text-muted-foreground">Off = read-only (plan mode). On = the project&apos;s access level.</span></span>
                    <Switch checked={!!sel.data.write} onCheckedChange={(v) => patch(sel.id, { write: !!v })} />
                  </label>
                </>
              )}
              {sel.data.kind === "condition" && <Field label="Input contains" hint="True branch if the input contains this text (case-insensitive)"><Input value={sel.data.contains || ""} onChange={(e) => patch(sel.id, { contains: e.target.value })} placeholder="PASS" /></Field>}
              {sel.data.kind === "note" && <Field label="Note"><Textarea rows={6} value={sel.data.instruction || ""} onChange={(e) => patch(sel.id, { instruction: e.target.value })} /></Field>}
              {run?.nodes?.[sel.id]?.output && (
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium">Last output</p>
                  <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">{run.nodes[sel.id].output}</pre>
                </div>
              )}
              <Button variant="ghost" className="justify-start text-red-600" onClick={() => remove(sel.id)}><Trash2 />Delete node</Button>
            </div>
          </aside>
        )}
      </div>

      {/* execution output */}
      {run && (
        <div className="border-t bg-background">
          <button onClick={() => setOutputOpen(!outputOpen)} className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium">
            Execution {run.status === "running" ? "in progress" : "log"} <StatusPill status={run.status} />
            <span className="text-xs font-normal text-muted-foreground">{fmtTokens(run.tokens)} tokens · {run.finishedAt ? dur(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) : "running"}</span>
            <span className="ml-auto text-xs text-muted-foreground">{outputOpen ? "Hide" : "Show"}</span>
          </button>
          {outputOpen && (
            <div className="flex max-h-48 gap-3 overflow-x-auto px-4 pb-3">
              {nodes.filter((n) => run.nodes[n.id]).map((n) => (
                <button key={n.id} onClick={() => setSelected(n.id)} className="w-64 shrink-0 rounded-xl border p-3 text-left hover:bg-muted/50">
                  <div className="mb-1 flex items-center gap-2"><span className="truncate text-sm font-semibold">{n.data.label}</span><StatusPill status={run.nodes[n.id].status} className="ml-auto" /></div>
                  <p className="line-clamp-4 font-mono text-[11px] text-muted-foreground">{run.nodes[n.id].output || "…"}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WithParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ReactFlowProvider><Editor id={id} /></ReactFlowProvider>;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<div className="grid h-[calc(100dvh-57px)] place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}><WithParams params={params} /></Suspense>;
}
