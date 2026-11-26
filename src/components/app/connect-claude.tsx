"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FolderGit2, Layers, Loader2, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/lib/client";
import type { ProviderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProviderMark } from "./pickers";
import { useApp } from "./project-context";

const SCOPES = [
  { icon: FolderGit2, text: "Run agents in the project folders you connect" },
  { icon: Terminal, text: "Read and edit files there, as each project's access level allows" },
  { icon: Sparkles, text: "Use your own plan's usage for agent runs" },
];
const INSTALL: Record<string, string> = { claude: "npm install -g @anthropic-ai/claude-code", antigravity: "Install Antigravity, then run `agy` once to sign in" };

/** One row per provider: install → sign in → allow. Sign-in happens in the provider's own app or page. */
export function ProviderList() {
  const { providers, refreshClaude } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(refreshClaude, 3000);
    return () => clearInterval(t);
  }, [waiting, refreshClaude]);
  useEffect(() => { if (providers?.find((p) => p.id === "claude")?.signedIn) setWaiting(false); }, [providers]);

  const act = async (p: ProviderStatus, action: "login" | "grant" | "revoke") => {
    setBusy(p.id + action);
    try {
      await api("/api/providers", { body: { provider: p.id, action } });
      if (action === "login") { setWaiting(true); toast("Finish signing in on the page that just opened."); }
      if (action === "grant") toast.success(`${p.name} connected`);
      if (action === "revoke") toast(`${p.name} disconnected`);
      await refreshClaude();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  if (!providers) return <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="grid gap-3">
      {providers.map((p) => {
        const state = !p.installed ? "install" : !p.signedIn ? "login" : !p.granted ? "grant" : "on";
        return (
          <div key={p.id} className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3", state === "on" && "border-emerald-500/40 bg-emerald-500/5")}>
            <ProviderMark provider={p.id} className="size-9 rounded-lg text-base" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">{p.name}{p.plan && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize">{p.plan}</span>}</div>
              <div className="text-xs text-muted-foreground">
                {state === "install" ? INSTALL[p.id] : state === "login" ? (p.id === "claude" ? "Installed, not signed in" : "Installed. Open Antigravity or run `agy` once to sign in.") : state === "grant" ? "Signed in. Allow this app to run it." : `Connected${p.grantedAt ? " " + new Date(p.grantedAt).toLocaleDateString() : ""}`}
              </div>
            </div>
            {state === "login" && p.id === "claude" && <Button size="sm" disabled={!!busy} onClick={() => act(p, "login")}>{waiting ? <><Loader2 className="animate-spin" />Waiting…</> : <><ExternalLink />Sign in</>}</Button>}
            {state === "grant" && <Button size="sm" disabled={!!busy} onClick={() => act(p, "grant")}>{busy === p.id + "grant" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Allow</Button>}
            {state === "on" && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(p, "revoke")}>Disconnect</Button>}
            {(state === "install" || (state === "login" && p.id !== "claude")) && <Button size="sm" variant="outline" onClick={refreshClaude}>Check again</Button>}
          </div>
        );
      })}
    </div>
  );
}

/** Consent screen, styled like an OAuth grant. */
export function ConnectClaude() {
  const { connectOpen, setConnectOpen } = useApp();
  return (
    <Dialog open={connectOpen} onOpenChange={(o) => setConnectOpen(o)}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="flex items-center justify-center gap-3 border-b bg-muted/40 px-6 py-6">
          <div className="grid size-12 place-items-center rounded-2xl bg-foreground text-background shadow-sm"><Layers className="size-6" /></div>
          <div className="h-px w-8 border-t border-dashed border-muted-foreground/50" />
          <ProviderMark provider="claude" className="size-11 rounded-2xl text-lg" />
          <ProviderMark provider="antigravity" className="size-11 rounded-2xl [&_svg]:size-5" />
        </div>
        <div className="grid gap-5 px-6 py-6">
          <div className="text-center">
            <DialogTitle className="text-lg">Connect your AI plans</DialogTitle>
            <DialogDescription className="mt-1">Lean Orchestrator runs agents through the CLIs signed in on this computer. Connect one or both; cheap steps can go to Gemini, hard ones to Claude.</DialogDescription>
          </div>
          <ul className="grid gap-2.5 text-sm">
            {SCOPES.map(({ icon: Icon, text }) => <li key={text} className="flex items-start gap-3"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{text}</li>)}
          </ul>
          <ProviderList />
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            This app never reads or stores your credentials: each CLI uses its own login. API-key variables are removed from agent processes, so nothing is billed to an API account.
          </div>
          <Button variant="outline" onClick={() => setConnectOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
