"use client";
import { useState } from "react";
import { Check, FolderGit2, GitBranch, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/components/app/project-context";
import { Empty, Field, NativeSelect, PageHeader } from "@/components/app/bits";
import { ago, db } from "@/lib/client";
import type { PermissionMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODES: { v: PermissionMode; label: string; hint: string }[] = [
  { v: "plan", label: "Read only (plan)", hint: "Agents can read and plan but not edit files or run commands." },
  { v: "acceptEdits", label: "Edit files", hint: "Agents can edit files; other tools follow your Claude Code settings." },
  { v: "bypassPermissions", label: "Full access", hint: "Agents run any tool without asking. Use only in a sandbox." },
];

export default function Projects() {
  const { projects, project, setProjectId } = useApp();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", path: "", permissionMode: "acceptEdits" as PermissionMode });
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const { id } = await db.create("projects", form);
      setProjectId(id); setOpen(false); setForm({ name: "", path: "", permissionMode: "acceptEdits" });
      toast.success("Project connected");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Projects" sub="Connect any folder on this computer. Agents run inside it with the access you choose.">
        {!open && <Button onClick={() => setOpen(true)}><Plus />Connect project</Button>}
      </PageHeader>
      {open && (
        <section className="mb-6 grid gap-4 rounded-2xl border bg-card p-5 shadow-xs">
          <h3 className="font-semibold">Connect a project</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Folder path" hint="Full path, for example E:\Projects\my-app" className="md:col-span-2">
              <Input value={form.path} onChange={(e) => setForm({ ...form, path: e.target.value })} placeholder="E:\Projects\my-app" className="font-mono" autoFocus />
            </Field>
            <Field label="Name" hint="Defaults to the folder name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="my-app" /></Field>
            <Field label="Agent access" hint={MODES.find((m) => m.v === form.permissionMode)?.hint}>
              <NativeSelect value={form.permissionMode} onChange={(e) => setForm({ ...form, permissionMode: e.target.value as PermissionMode })}>
                {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex gap-2">
            <Button disabled={!form.path.trim() || busy} onClick={add}>{busy && <Loader2 className="animate-spin" />}Connect</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </section>
      )}
      {!projects.length && !open ? (
        <div className="rounded-2xl border bg-card"><Empty icon={FolderGit2} title="No projects yet. Connect a folder to start."><Button onClick={() => setOpen(true)}><Plus />Connect project</Button></Empty></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <article key={p.id} className={cn("flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs", project?.id === p.id && "ring-2 ring-foreground")}>
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border"><FolderGit2 className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <p className="truncate font-mono text-xs text-muted-foreground" title={p.path}>{p.path}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {p.branch && <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"><GitBranch className="size-3" />{p.branch}</span>}
                {(p.stack || []).map((s) => <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s}</span>)}
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <NativeSelect aria-label="Agent access" className="h-8 w-auto text-xs" value={p.permissionMode} onChange={(e) => db.update("projects", p.id, { permissionMode: e.target.value }).catch((er) => toast.error(er.message))}>
                  {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                </NativeSelect>
                <span className="text-xs text-muted-foreground">Added {ago(p.createdAt)}</span>
              </div>
              <div className="mt-auto flex gap-2">
                <Button variant={project?.id === p.id ? "secondary" : "default"} size="sm" className="flex-1" onClick={() => setProjectId(p.id)}>
                  {project?.id === p.id ? <><Check />Current project</> : "Switch to this project"}
                </Button>
                <Button variant="ghost" size="icon" aria-label={`Disconnect ${p.name}`} onClick={() => { if (confirm(`Disconnect ${p.name}? Its tasks, workflows and executions are removed from this app. Files in the folder are not touched.`)) db.remove("projects", p.id).then(() => toast("Project disconnected")); }}>
                  <Trash2 />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
