"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Bot, Check, GitBranch, Hand, Loader2, Merge, MousePointerClick, Pause, StickyNote, X } from "lucide-react";
import type { FlowNode, NodeRun } from "@/lib/types";
import { cn } from "@/lib/utils";

export type NodeData = FlowNode["data"] & { kind: FlowNode["kind"]; run?: NodeRun; agentName?: string };
export type LoNode = Node<NodeData>;

export const KINDS = {
  trigger: { label: "Manual trigger", icon: MousePointerClick, tint: "text-orange-600 bg-orange-500/10", desc: "Starts the workflow when you click Execute" },
  agent: { label: "Claude agent", icon: Bot, tint: "text-violet-600 bg-violet-500/10", desc: "Runs one Claude Code step with an agent and model" },
  condition: { label: "If", icon: GitBranch, tint: "text-sky-600 bg-sky-500/10", desc: "Routes on whether the input contains some text" },
  approval: { label: "Ask me (approval)", icon: Hand, tint: "text-rose-600 bg-rose-500/10", desc: "Pauses the run until you approve or reject; your note goes to the next steps" },
  merge: { label: "Merge", icon: Merge, tint: "text-emerald-600 bg-emerald-500/10", desc: "Waits for its inputs and joins their outputs" },
  note: { label: "Sticky note", icon: StickyNote, tint: "text-amber-600 bg-amber-500/10", desc: "A note on the canvas; never runs" },
} as const;


function RunBadge({ run }: { run?: NodeRun }) {
  if (!run) return null;
  const cls = { ok: "bg-emerald-500", failed: "bg-red-500", running: "bg-blue-500", waiting: "bg-amber-500", skipped: "bg-muted-foreground" }[run.status];
  return (
    <span className={cn("absolute -top-2 -right-2 z-10 grid size-5 place-items-center rounded-full text-white shadow ring-2 ring-background", cls)}>
      {run.status === "ok" ? <Check className="size-3" strokeWidth={3} /> : run.status === "failed" ? <X className="size-3" strokeWidth={3} /> : run.status === "running" ? <Loader2 className="size-3 animate-spin" /> : run.status === "waiting" ? <Pause className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}
const handle = "!size-3 !border-2 !border-background !bg-muted-foreground/70 hover:!bg-foreground";

/** n8n-style square node: big icon tile, title and subtitle underneath. */
export function FlowCard({ data, selected }: NodeProps<LoNode>) {
  const k = KINDS[data.kind];
  const Icon = k.icon;
  const running = data.run?.status === "running";
  if (data.kind === "note") {
    return (
      <div className={cn("w-56 rounded-xl border border-amber-300/60 bg-amber-100/80 p-3 text-sm text-amber-950 shadow-sm dark:bg-amber-400/15 dark:text-amber-100", selected && "ring-2 ring-amber-500")}>
        <div className="mb-1 font-semibold">{data.label}</div>
        <p className="text-xs whitespace-pre-wrap opacity-80">{data.instruction || "Double-click to write a note."}</p>
      </div>
    );
  }
  return (
    <div className="flex w-[108px] flex-col items-center gap-2">
      <div className={cn(
        "relative grid size-[88px] place-items-center border-2 bg-card shadow-sm transition-shadow",
        data.kind === "trigger" ? "rounded-l-[44px] rounded-r-2xl" : "rounded-2xl",
        selected ? "border-foreground shadow-md" : "border-border hover:border-foreground/40",
        running && "border-blue-500 shadow-[0_0_0_6px_rgba(59,130,246,0.15)]",
        data.run?.status === "ok" && !selected && "border-emerald-500/70",
        data.run?.status === "failed" && "border-red-500",
        data.run?.status === "waiting" && "border-amber-500 shadow-[0_0_0_6px_rgba(245,158,11,0.18)]",
      )}>
        <RunBadge run={data.run} />
        {data.kind !== "trigger" && <Handle type="target" position={Position.Left} className={handle} />}
        <span className={cn("grid size-12 place-items-center rounded-xl", k.tint)}><Icon className="size-6" /></span>
        {data.kind === "agent" && <span className={cn("absolute right-2 bottom-2 size-2.5 rounded-full ring-2 ring-card", String(data.model).startsWith("agy:") ? "bg-sky-500" : (/haiku/.test(String(data.model)) ? "bg-emerald-500" : /opus|fable/.test(String(data.model)) ? "bg-rose-500" : "bg-amber-500"))} title={data.model} />}
        {data.kind === "condition" ? (
          <>
            <Handle type="source" id="true" position={Position.Right} style={{ top: "32%" }} className={cn(handle, "!bg-emerald-500")} />
            <Handle type="source" id="false" position={Position.Right} style={{ top: "68%" }} className={cn(handle, "!bg-red-500")} />
            <span className="absolute top-[22%] -right-9 text-[10px] font-medium text-emerald-600">true</span>
            <span className="absolute top-[58%] -right-9 text-[10px] font-medium text-red-600">false</span>
          </>
        ) : <Handle type="source" position={Position.Right} className={handle} />}
      </div>
      <div className="w-[140px] text-center leading-tight">
        <div className="truncate text-[13px] font-semibold">{data.label}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {data.kind === "agent" ? `${data.agentName || "No agent"} · ${String(data.model || "sonnet").replace(/^agy:/, "").replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2")}` : data.kind === "condition" ? `contains “${data.contains || "…"}”` : k.label}
        </div>
      </div>
    </div>
  );
}
export const nodeTypes = { card: FlowCard };
