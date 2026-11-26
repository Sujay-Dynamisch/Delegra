"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, Code2, MessageSquare, Pencil, Plus, Search, Brain, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Empty, Field, ModelTag, NativeSelect, PageHeader } from "@/components/app/bits";
import { db, useList } from "@/lib/client";
import { MODELS, type Agent, type Model } from "@/lib/types";

const ICON: Record<Model, React.ElementType> = { haiku: Search, sonnet: Code2, opus: Brain };
type Form = Omit<Agent, "id"> & { id?: string };
const blank = (): Form => ({ name: "", model: "sonnet", role: "", skills: [], instructions: "" });

export default function Agents() {
  const agents = useList<Agent>("agents").rows || [];
  const [form, setForm] = useState<Form | null>(null);
  const [skill, setSkill] = useState("");

  const save = async () => {
    if (!form?.name.trim()) return toast.error("Give the agent a name.");
    const { id, ...data } = form;
    try { if (id) await db.update("agents", id, data); else await db.create("agents", data); toast.success(id ? "Agent updated" : "Agent added"); setForm(null); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Agents" sub="Reusable specialists. Each has a model, a role, skills and standing instructions; tasks and workflow nodes use them in any project.">
        {!form && <Button onClick={() => setForm(blank())}><Plus />New agent</Button>}
      </PageHeader>
      {form && (
        <section className="mb-6 grid gap-4 rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="font-semibold">{form.id ? "Edit agent" : "New agent"}</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Reviewer" autoFocus /></Field>
            <Field label="Model">
              <NativeSelect value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as Model })}>
                {MODELS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}
              </NativeSelect>
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
            <Field label="Standing instructions" className="md:col-span-2"><Textarea rows={4} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Files it owns, how to answer, what to avoid." /></Field>
          </div>
          <div className="flex gap-2"><Button onClick={save}>{form.id ? "Save changes" : "Add agent"}</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </section>
      )}
      {!agents.length && !form ? (
        <div className="rounded-2xl border bg-card"><Empty icon={Bot} title="No agents yet. Add specialists like a researcher on Haiku, a builder on Sonnet and a reviewer on Opus."><Button onClick={() => setForm(blank())}><Plus />New agent</Button></Empty></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => {
            const Icon = ICON[a.model] || Bot;
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
                  <Button size="icon" variant="ghost" aria-label={`Edit ${a.name}`} className="ml-auto" onClick={() => setForm({ ...a })}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${a.name}`} onClick={() => { if (confirm(`Delete ${a.name}?`)) db.remove("agents", a.id); }}><Trash2 /></Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
