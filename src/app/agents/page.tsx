"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, Check, Library, Loader2, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Empty, Field, ModelTag, PageHeader } from "@/components/app/bits";
import { AGENT_ICONS, agentIcon, ModelPicker, TIER_DOT, useModels } from "@/components/app/pickers";
import { api, db, useList } from "@/lib/client";
import { GROUPS, TEMPLATES } from "@/lib/templates";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

type Form = Omit<Agent, "id"> & { id?: string };
const blank = (): Form => ({ name: "", model: "sonnet", role: "", skills: [], instructions: "", icon: "code" });
const TIER_MODEL = { fast: "Haiku / Gemini Flash", balanced: "Sonnet", deep: "Opus" };

export default function Agents() {
  const agents = useList<Agent>("agents").rows || [];
  const models = useModels();
  const hasAgy = models.some((m) => m.provider === "antigravity");
  const [form, setForm] = useState<Form | null>(null);
  const [skill, setSkill] = useState("");
  const [library, setLibrary] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [cheap, setCheap] = useState(true);
  const [busy, setBusy] = useState(false);
  const installed = new Set(agents.map((a) => a.template).filter(Boolean));

  const save = async () => {
    if (!form?.name.trim()) return toast.error("Give the agent a name.");
    const { id, ...data } = form;
    try { if (id) await db.update("agents", id, data); else await db.create("agents", data); toast.success(id ? "Agent updated" : "Agent added"); setForm(null); }
    catch (e) { toast.error((e as Error).message); }
  };
  const install = async () => {
    setBusy(true);
    try {
      const r = await api<{ added: number }>("/api/library", { body: { ids: picked, preferCheap: cheap && hasAgy } });
      toast.success(`Added ${r.added} agent${r.added === 1 ? "" : "s"}`); setLibrary(false); setPicked([]);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Agents" sub="Reusable specialists. Each has a model, a role, skills and standing instructions; tasks and workflow nodes use them in any project.">
        <Button variant="outline" onClick={() => setLibrary(true)}><Library />Agent library</Button>
        {!form && <Button onClick={() => setForm(blank())}><Plus />New agent</Button>}
      </PageHeader>

      {form && (
        <section className="mb-6 grid gap-4 rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="font-semibold">{form.id ? "Edit agent" : "New agent"}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reviewer" autoFocus /></Field>
            <Field label="Model" hint="Cheaper models for simple roles save tokens"><ModelPicker value={form.model} onChange={(model) => setForm({ ...form, model })} /></Field>
            <Field label="Icon" className="md:col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(AGENT_ICONS).map(([k, I]) => (
                  <button key={k} type="button" aria-label={k} onClick={() => setForm({ ...form, icon: k })} className={cn("grid size-9 place-items-center rounded-lg border", form.icon === k ? "border-foreground bg-accent" : "hover:bg-muted")}><I className="size-4" /></button>
                ))}
              </div>
            </Field>
            <Field label="Role" className="md:col-span-2"><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Reviews changes for bugs and regressions" /></Field>
            <Field label="Skills" hint="Press Enter to add" className="md:col-span-2">
              <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="React, FastAPI, code review…"
                onKeyDown={(e) => { if (e.key === "Enter" && skill.trim()) { e.preventDefault(); if (!form.skills.includes(skill.trim())) setForm({ ...form, skills: [...form.skills, skill.trim()] }); setSkill(""); } }} />
            </Field>
            {!!form.skills.length && (
              <div className="flex flex-wrap gap-1.5 md:col-span-2">
                {form.skills.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">{s}<button aria-label={`Remove ${s}`} onClick={() => setForm({ ...form, skills: form.skills.filter((x) => x !== s) })}><X className="size-3" /></button></span>)}
              </div>
            )}
            <Field label="Standing instructions" hint="Sent with every call, so keep them short" className="md:col-span-2"><Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Files it owns, how to answer, what to avoid." /></Field>
          </div>
          <div className="flex gap-2"><Button onClick={save}>{form.id ? "Save changes" : "Add agent"}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </section>
      )}

      {!agents.length && !form ? (
        <div className="rounded-2xl border bg-card">
          <Empty icon={Bot} title="No agents yet. Start from the library: researchers, tech leads, testers, reviewers and more, each on the cheapest model that fits.">
            <div className="flex gap-2"><Button onClick={() => setLibrary(true)}><Library />Open agent library</Button><Button variant="outline" onClick={() => setForm(blank())}><Plus />Blank agent</Button></div>
          </Empty>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const Icon = agentIcon(a);
            return (
              <article key={a.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl border"><Icon className="size-5" /></div>
                  <h3 className="min-w-0 flex-1 truncate font-semibold">{a.name}</h3>
                  <span className="rounded-md border px-2 py-0.5"><ModelTag model={a.model} /></span>
                </div>
                {a.role && <p className="text-sm text-muted-foreground">{a.role}</p>}
                {!!a.skills?.length && <div className="flex flex-wrap gap-1.5">{a.skills.map((s) => <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s}</span>)}</div>}
                <div className="mt-auto flex gap-1 pt-2">
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/chat?agent=${a.id}`} />}><MessageSquare />Chat</Button>
                  <Button size="icon" variant="ghost" aria-label={`Edit ${a.name}`} className="ml-auto" onClick={() => { setForm({ ...a }); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${a.name}`} onClick={() => { if (confirm(`Delete ${a.name}?`)) db.remove("agents", a.id); }}><Trash2 /></Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={library} onOpenChange={setLibrary}>
        <DialogContent className="flex max-h-[88dvh] flex-col gap-0 p-0 sm:max-w-4xl">
          <div className="border-b p-5">
            <DialogTitle className="text-lg">Agent library</DialogTitle>
            <DialogDescription>Pick the specialists for your team. Each comes with short, token-lean instructions and a model matched to the job.</DialogDescription>
          </div>
          <div className="grid flex-1 gap-6 overflow-y-auto p-5">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="mb-2 text-sm font-semibold">{g}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {TEMPLATES.filter((t) => t.group === g).map((t) => {
                    const I = AGENT_ICONS[t.icon] || Bot, have = installed.has(t.id), on = picked.includes(t.id);
                    return (
                      <button key={t.id} disabled={have} onClick={() => setPicked(on ? picked.filter((x) => x !== t.id) : [...picked, t.id])}
                        className={cn("relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors", on ? "border-foreground bg-accent" : "hover:bg-muted/60", have && "opacity-50")}>
                        <span className="flex items-center gap-2">
                          <span className="grid size-8 place-items-center rounded-lg border bg-background"><I className="size-4" /></span>
                          <span className="font-semibold">{t.name}</span>
                          <span className={cn("ml-auto grid size-5 place-items-center rounded-full border", on && "border-foreground bg-foreground text-background")}>{(on || have) && <Check className="size-3" />}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{t.role}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn("size-1.5 rounded-full", TIER_DOT[t.tier])} />{have ? "Already added" : TIER_MODEL[t.tier]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t p-4">
            <label className={cn("flex items-center gap-2 text-sm", !hasAgy && "opacity-60")}>
              <Switch checked={cheap && hasAgy} disabled={!hasAgy} onCheckedChange={(v) => setCheap(!!v)} />
              Run fast roles on Gemini Flash (Antigravity) to save Claude usage
            </label>
            {!hasAgy && <span className="text-xs text-muted-foreground">Connect Antigravity in Settings first.</span>}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => setPicked(TEMPLATES.filter((t) => !installed.has(t.id)).map((t) => t.id))}>Select all</Button>
              <Button disabled={!picked.length || busy} onClick={install}>{busy && <Loader2 className="animate-spin" />}Add {picked.length || ""} agent{picked.length === 1 ? "" : "s"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
