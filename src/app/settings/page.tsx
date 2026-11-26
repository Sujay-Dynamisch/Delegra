"use client";
import { useEffect, useState } from "react";
import { Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/bits";
import { ProviderList } from "@/components/app/connect-claude";
import { db, useDoc } from "@/lib/client";
import { cn } from "@/lib/utils";

const DEFAULTS = [
  "Work only inside your assigned files or module; never edit another agent's files.",
  'Never invent facts, file paths, APIs or results. If you do not know, say "UNKNOWN" and name what you need.',
  "Read only the files you need, only the lines you need. No repository-wide dumps.",
  "Answer in the shortest form that is complete: bullets, changed files, checks run, blockers.",
  "Do not claim a test, build or deploy succeeded unless you ran it and saw it pass.",
  "Ask before anything destructive, external or irreversible (deploys, deletes, messages to people).",
];

export default function Settings() {
  const { doc } = useDoc<{ rules?: string[] }>("settings", "rules");
  const [rules, setRules] = useState<string[]>(DEFAULTS);
  const [add, setAdd] = useState("");
  useEffect(() => { if (doc?.rules) setRules(doc.rules); }, [doc]);
  const save = (list: string[]) => db.update("settings", "rules", { rules: list.map((s) => s.trim()).filter(Boolean).slice(0, 30) }).then(() => toast.success("Rules saved"), (e) => toast.error(e.message));

  return (
    <>
      <PageHeader title="Settings" sub="Your AI connections and the rules every agent follows." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className="grid content-start gap-4 rounded-2xl border bg-card p-5 shadow-xs">
          <div><h3 className="font-semibold">Connections</h3><p className="text-sm text-muted-foreground">Agents run through these CLIs on this computer, with their own logins.</p></div>
          <ProviderList />
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" />This app never reads or stores your credentials. API-key variables are removed from agent processes.</div>
        </section>

        <section className="grid content-start gap-3 rounded-2xl border bg-card p-5 shadow-xs">
          <div><h3 className="font-semibold">Rules &amp; guardrails</h3><p className="text-sm text-muted-foreground">Added to every task, workflow node and chat, so agents stay in their lane, don&apos;t guess and keep answers short. Each rule costs tokens on every call.</p></div>
          <div>
            {rules.map((r, i) => (
              <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 border-t py-1.5 first:border-0">
                <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <input value={r} onChange={(e) => setRules(rules.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Rule ${i + 1}`} className={cn("rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none hover:border-border focus:border-ring")} />
                <Button variant="ghost" size="icon" aria-label={`Remove rule ${i + 1}`} onClick={() => { const l = rules.filter((_, j) => j !== i); setRules(l); save(l); }}><X /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2"><Input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add a rule" onKeyDown={(e) => { if (e.key === "Enter" && add.trim()) { const l = [...rules, add.trim()]; setRules(l); setAdd(""); save(l); } }} />
            <Button variant="outline" disabled={!add.trim()} onClick={() => { const l = [...rules, add.trim()]; setRules(l); setAdd(""); save(l); }}><Plus />Add</Button></div>
          <div className="flex gap-2"><Button onClick={() => save(rules)}>Save rules</Button><Button variant="ghost" onClick={() => { setRules(DEFAULTS); save(DEFAULTS); }}>Restore defaults</Button></div>
        </section>
      </div>
    </>
  );
}
