"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, FolderGit2, Loader2, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "@/lib/client";
import type { ClaudeStatus } from "@/lib/types";
import { useApp } from "./project-context";

const SCOPES = [
  { icon: FolderGit2, text: "Run Claude Code in the project folders you connect" },
  { icon: Terminal, text: "Read and edit files in those folders, as each project's permission mode allows" },
  { icon: Sparkles, text: "Use your Claude plan's usage for agent runs" },
];

/** Consent screen, styled like an OAuth grant. Sign-in itself happens on Anthropic's page via `claude auth login`. */
export function ConnectClaude() {
  const { claude, refreshClaude, connectOpen, setConnectOpen } = useApp();
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  // While the person signs in on Anthropic's page, poll until the CLI reports a login.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => { await refreshClaude(); }, 2500);
    return () => clearInterval(t);
  }, [waiting, refreshClaude]);
  useEffect(() => { if (claude?.loggedIn) setWaiting(false); }, [claude?.loggedIn]);

  const act = async (action: "login" | "grant" | "revoke") => {
    setBusy(true);
    try {
      await api<ClaudeStatus>("/api/claude", { body: { action } });
      if (action === "login") { setWaiting(true); toast("Finish signing in on the Anthropic page that just opened."); }
      if (action === "grant") { toast.success("Claude connected"); setConnectOpen(false); }
      await refreshClaude();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const step = !claude ? "checking" : !claude.installed ? "install" : !claude.loggedIn ? "login" : "grant";
  return (
    <Dialog open={connectOpen} onOpenChange={(o) => setConnectOpen(o)}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex items-center justify-center gap-3 border-b bg-muted/40 px-6 py-7">
          <div className="grid size-12 place-items-center rounded-2xl bg-foreground text-background shadow-sm"><Sparkles className="size-6" /></div>
          <div className="h-px w-8 border-t border-dashed border-muted-foreground/50" />
          <div className="grid size-12 place-items-center rounded-2xl bg-[#d97757]/15 text-[#c2603f] ring-1 ring-[#d97757]/30"><span className="text-lg font-bold">C</span></div>
        </div>
        <div className="grid gap-5 px-6 py-6">
          <div className="text-center">
            <DialogTitle className="text-lg">Connect your Claude plan</DialogTitle>
            <DialogDescription className="mt-1">
              {step === "grant" ? <>Signed in with Claude Code{claude?.plan ? <> · <b className="capitalize text-foreground">{claude.plan}</b> plan</> : null}. Lean Orchestrator wants to:</>
                : step === "login" ? "Sign in to Claude on Anthropic's page. Your password and tokens never pass through this app."
                : step === "install" ? "Claude Code isn't installed on this computer yet."
                : "Checking Claude Code on this computer…"}
            </DialogDescription>
          </div>

          {step === "grant" && (
            <ul className="grid gap-3 rounded-xl border p-4">
              {SCOPES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{text}</li>
              ))}
            </ul>
          )}
          {step === "install" && (
            <div className="rounded-xl border bg-muted/40 p-4 text-sm">
              Install it, then sign in once: <code className="mt-2 block rounded-md bg-background px-2 py-1.5 font-mono text-xs">npm install -g @anthropic-ai/claude-code</code>
            </div>
          )}
          {step === "checking" && <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}

          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            Runs go through the Claude Code CLI on this computer with your own login. This app never reads or stores your Claude credentials, and removes API keys from agent processes so nothing is billed to an API account. You can disconnect any time in Settings.
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConnectOpen(false)}>Cancel</Button>
            {step === "grant" && <Button className="flex-1" disabled={busy} onClick={() => act("grant")}>{busy ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Allow</Button>}
            {step === "login" && (
              <Button className="flex-1" disabled={busy} onClick={() => act("login")}>
                {waiting ? <><Loader2 className="animate-spin" />Waiting for sign-in…</> : <><ExternalLink />Sign in with Claude</>}
              </Button>
            )}
            {step === "install" && <Button className="flex-1" onClick={() => refreshClaude()}>Check again</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
