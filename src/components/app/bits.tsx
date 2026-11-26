"use client";
import { cn } from "@/lib/utils";
import type { Model } from "@/lib/types";
import { modelInfo, ProviderMark, useModels } from "./pickers";
import { Loader2 } from "lucide-react";

const TONE: Record<string, string> = {
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  working: "bg-blue-500/10 text-blue-700 dark:text-blue-400", running: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  queued: "bg-amber-500/10 text-amber-700 dark:text-amber-400", skipped: "bg-muted text-muted-foreground", stopped: "bg-muted text-muted-foreground",
  blocked: "bg-red-500/10 text-red-700 dark:text-red-400", failed: "bg-red-500/10 text-red-700 dark:text-red-400",
};
const DOT: Record<string, string> = { done: "bg-emerald-500", ok: "bg-emerald-500", working: "bg-blue-500", running: "bg-blue-500", queued: "bg-amber-500", blocked: "bg-red-500", failed: "bg-red-500" };
const LABEL: Record<string, string> = { ok: "Completed", done: "Done", working: "Working", running: "Running", queued: "Queued", blocked: "Blocked", failed: "Failed", skipped: "Skipped", stopped: "Stopped" };

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE[status] || "bg-muted text-muted-foreground", className)}>
      {status === "working" || status === "running" ? <Loader2 className="size-3 animate-spin" /> : <span className={cn("size-1.5 rounded-full", DOT[status] || "bg-muted-foreground")} />}
      {LABEL[status] || status}
    </span>
  );
}
export const MODEL_COLOR: Record<Model, string> = { haiku: "bg-emerald-500", sonnet: "bg-amber-500", opus: "bg-rose-500" };
export const MODEL_NOTE: Record<Model, string> = { haiku: "Research, checks, simple edits", sonnet: "Features, fixes, reviews", opus: "Architecture, risky changes" };
export function ModelTag({ model }: { model?: Model }) {
  const m = modelInfo(model, useModels());
  return <span className="inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"><ProviderMark provider={m.provider} className="size-4" />{m.label.replace(/^Claude /, "")}</span>;
}
export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
export function Empty({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-muted"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="max-w-sm text-sm text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}
export function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50", props.className)} />;
}
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium", className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}
export function Stat({ icon: Icon, value, label, sub }: { icon: React.ElementType; value: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-muted"><Icon className="size-5" /></div>
      <div className="min-w-0">
        <div className="text-2xl leading-tight font-semibold tracking-tight">{value}</div>
        <div className="text-sm text-foreground/80">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}
