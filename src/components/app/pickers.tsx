"use client";
import { useEffect, useState } from "react";
import {
  BookOpen, Bot, Boxes, Bug, Code2, Crosshair, Crown, Database, Eye, FlaskConical, Gauge, LayoutTemplate, ListTree, Palette, Rocket, Search, Server, Shield, Sparkles, Wand2,
} from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/client";
import { useApp } from "./project-context";
import type { Agent, Effort, ModelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ---------- models ---------- */
/** Same list the server sends; used until /api/models answers, and to label saved aliases. */
const FALLBACK: ModelInfo[] = [
  { id: "default", label: "Default (recommended)", sub: "Your plan's recommended model", provider: "claude", tier: "balanced", note: "Best for everyday, complex tasks" },
  { id: "claude-opus-5-5", label: "Opus 5.5", provider: "claude", tier: "deep", note: "For complex work and everyday tasks" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", provider: "claude", tier: "balanced", note: "Most efficient for simpler tasks" },
  { id: "claude-fable-5-2", label: "Fable 5.2", provider: "claude", tier: "deep", note: "For your toughest challenges" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", provider: "claude", tier: "fast", note: "Fastest for quick answers" },
  { id: "opus", label: "Opus (latest)", provider: "claude", tier: "deep", note: "Always the newest Opus", hidden: true },
  { id: "sonnet", label: "Sonnet (latest)", provider: "claude", tier: "balanced", note: "Always the newest Sonnet", hidden: true },
  { id: "haiku", label: "Haiku (latest)", provider: "claude", tier: "fast", note: "Always the newest Haiku", hidden: true },
];
let cache: ModelInfo[] | null = null;
export function useModels() {
  const [models, setModels] = useState<ModelInfo[]>(cache || FALLBACK);
  useEffect(() => { api<ModelInfo[]>("/api/models").then((m) => { cache = m; setModels(m); }, () => {}); }, []);
  return models;
}
export const TIER_DOT: Record<ModelInfo["tier"], string> = { fast: "bg-emerald-500", balanced: "bg-amber-500", deep: "bg-rose-500" };
export function modelInfo(id: string | undefined, models: ModelInfo[]): ModelInfo {
  const m = id || "sonnet";
  return models.find((x) => x.id === m) || FALLBACK.find((x) => x.id === m) ||
    { id: m, label: m.startsWith("agy:") ? m.slice(4) : m, provider: m.startsWith("agy:") ? "antigravity" : "claude", tier: "balanced", note: "" };
}
export function ProviderMark({ provider, className }: { provider: ModelInfo["provider"]; className?: string }) {
  return provider === "antigravity"
    ? <span className={cn("grid size-5 shrink-0 place-items-center rounded-md bg-sky-500/15 text-sky-600", className)}><Sparkles className="size-3" /></span>
    : <span className={cn("grid size-5 shrink-0 place-items-center rounded-md bg-[#d97757]/15 text-[11px] font-bold text-[#c2603f]", className)}>C</span>;
}
/** Two-line row like Claude Code's /model picker: name, then what it is for. */
function ModelRow({ m }: { m: ModelInfo }) {
  return (
    <span className="flex min-w-0 items-start gap-2.5 py-0.5">
      <ProviderMark provider={m.provider} className="mt-0.5" />
      <span className="grid min-w-0 gap-0.5">
        <span className="flex items-center gap-1.5 font-medium">{m.label}<span className={cn("size-1.5 rounded-full", TIER_DOT[m.tier])} title={m.tier} /></span>
        <span className="truncate text-xs text-muted-foreground">{m.id === "default" ? "Opus 5.5 · " : ""}{m.note}</span>
      </span>
    </span>
  );
}
export function ModelPicker({ value, onChange, disabled, className }: { value?: string; onChange: (v: string) => void; disabled?: boolean; className?: string }) {
  const models = useModels();
  const { agyInstalled } = useApp();
  const current = modelInfo(value, models);
  const visible = models.filter((m) => !m.hidden || m.id === current.id);
  const groups: [string, ModelInfo[]][] = [["Claude Code", visible.filter((m) => m.provider === "claude")], ["Antigravity", visible.filter((m) => m.provider === "antigravity")]];
  return (
    <Select value={current.id} onValueChange={(v) => v && onChange(String(v))} disabled={disabled}>
      <SelectTrigger className={cn("h-9 w-full", className)} aria-label="Model">
        <SelectValue>{() => <span className="flex min-w-0 items-center gap-2"><ProviderMark provider={current.provider} /><span className="truncate">{current.label}</span></span>}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[420px] min-w-80" alignItemWithTrigger={false}>
        {groups.filter(([, l]) => l.length).map(([g, list], i) => (
          <SelectGroup key={g}>
            {i > 0 && <SelectSeparator />}
            <SelectLabel>{g}</SelectLabel>
            {list.map((m) => <SelectItem key={m.id} value={m.id} className="py-1.5"><ModelRow m={m} /></SelectItem>)}
          </SelectGroup>
        ))}
        {!groups[1][1].length && agyInstalled && <p className="px-2 py-2 text-xs text-muted-foreground">Allow Antigravity in Settings to add Gemini models.</p>}
      </SelectContent>
    </Select>
  );
}

/** Reasoning effort, passed to the CLI as --effort. Empty = the CLI's default. */
export function EffortPicker({ value, onChange }: { value?: Effort; onChange: (v: Effort | undefined) => void }) {
  const opts: [Effort | undefined, string][] = [[undefined, "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"], ["xhigh", "X-High"], ["max", "Max"]];
  return (
    <div role="radiogroup" aria-label="Effort" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {opts.map(([v, l]) => (
        <button key={l} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground", value === v && "bg-background text-foreground shadow-xs")}>{l}</button>
      ))}
    </div>
  );
}

/* ---------- agents ---------- */
export const AGENT_ICONS: Record<string, React.ElementType> = {
  search: Search, list: ListTree, crown: Crown, boxes: Boxes, code: Code2, layout: LayoutTemplate, server: Server, database: Database, wand: Wand2,
  flask: FlaskConical, bug: Bug, eye: Eye, shield: Shield, crosshair: Crosshair, gauge: Gauge, rocket: Rocket, book: BookOpen, palette: Palette,
};
export const agentIcon = (a?: Pick<Agent, "icon"> | null) => (a?.icon && AGENT_ICONS[a.icon]) || Bot;

export function AgentPicker({ agents, value, onChange, className }: { agents: Agent[]; value?: string; onChange: (id: string) => void; className?: string }) {
  const models = useModels();
  const current = agents.find((a) => a.id === value);
  const row = (a: Agent) => {
    const Icon = agentIcon(a), m = modelInfo(a.model, models);
    return (
      <span className="flex min-w-0 items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md border bg-background"><Icon className="size-3.5" /></span>
        <span className="truncate">{a.name}</span>
        <span className="ml-auto flex items-center gap-1 pl-3 text-xs text-muted-foreground"><ProviderMark provider={m.provider} className="size-4" />{m.label.replace(/^Claude /, "")}</span>
      </span>
    );
  };
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" || v == null ? "" : String(v))}>
      <SelectTrigger className={cn("h-9 w-full", className)} aria-label="Agent">
        <SelectValue>{() => (current ? row(current) : <span className="flex items-center gap-2 text-muted-foreground"><Bot className="size-4" />No agent</span>)}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80 min-w-80" alignItemWithTrigger={false}>
        <SelectItem value="none"><span className="flex items-center gap-2 text-muted-foreground"><Bot className="size-4" />No agent</span></SelectItem>
        {agents.map((a) => <SelectItem key={a.id} value={a.id} className="py-1.5">{row(a)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
