"use client";
import { useState } from "react";
import { Check, Hand, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RichAnswer } from "@/components/app/rich-answer";
import { api } from "@/lib/client";
import type { Run } from "@/lib/types";

/** Shown while a workflow run waits at an approval node: the work so far, an optional note, Approve / Reject. */
export function ApprovalPanel({ run, label }: { run: Run; label: (nodeId: string) => string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const nid = Object.keys(run.nodes || {}).find((k) => run.nodes[k].status === "waiting");
  if (!nid) return null;
  const send = async (action: "approve" | "reject") => {
    setBusy(true);
    try { await api("/api/run", { body: { action, id: run.id, note } }); toast(action === "approve" ? "Approved: the workflow continues" : "Rejected: the workflow stopped"); setNote(""); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="grid gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <Hand className="size-4 text-amber-600" />
        <h3 className="font-semibold">Waiting for you: {label(nid)}</h3>
      </div>
      <p className="text-sm text-muted-foreground">Read the result below. Approve to continue, or reject to stop the run. A note is passed to the next agents, for example “only fix C1 and C3”.</p>
      {run.nodes[nid].output && <div className="max-h-96 overflow-y-auto rounded-xl border bg-background p-4"><RichAnswer text={run.nodes[nid].output!} /></div>}
      <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for the next steps…" />
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => send("approve")}><Check />Approve and continue</Button>
        <Button disabled={busy} variant="outline" onClick={() => send("reject")}><X />Reject and stop</Button>
      </div>
    </section>
  );
}
