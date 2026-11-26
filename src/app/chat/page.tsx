"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Check, Copy, FolderGit2, Lock, PenLine, Square, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/project-context";
import { AgentPicker, ModelPicker } from "@/components/app/pickers";
import { DelegraMark } from "@/components/app/brand";
import { fmtTokens, streamChat, useList } from "@/lib/client";
import type { Agent, Model } from "@/lib/types";

type Msg = { role: "user" | "assistant"; text: string; who?: string; tokens?: number };
const LEAN = "Plan this with the /lean approach: split it into the smallest checkpoints, say which model (haiku, sonnet or opus) each one needs and why, which files each touches, and how to verify it. Do not change any files.\n\nGoal: ";
const SUGGESTIONS = [
  { icon: Zap, label: "/lean plan a feature", text: "/lean " },
  { icon: FolderGit2, label: "Explain the project structure", text: "Explain how this project is structured: main folders, entry points and how data flows." },
  { icon: Lock, label: "Find security risks", text: "Look for the riskiest security issues in this project. List the top 5 with file:line." },
  { icon: PenLine, label: "Suggest tests to add", text: "Which important behavior in this project has no tests? Suggest the 5 most valuable tests to add." },
];

/** Light formatting for answers: fenced code blocks, inline code and bold. */
function Answer({ text }: { text: string }) {
  const parts = text.split(/```[a-zA-Z0-9-]*\n?/);
  return (
    <div className="grid gap-3 text-[15px] leading-7">
      {parts.map((p, i) => (i % 2 === 1
        ? <pre key={i} className="overflow-x-auto rounded-xl border bg-muted/60 p-4 font-mono text-[13px] leading-6">{p.replace(/\n$/, "")}</pre>
        : p.trim() && (
          <div key={i} className="whitespace-pre-wrap">
            {p.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/).map((t, j) => t.startsWith("`") && t.endsWith("`") && t.length > 2
              ? <code key={j} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px]">{t.slice(1, -1)}</code>
              : t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <strong key={j}>{t.slice(2, -2)}</strong> : t)}
          </div>
        )))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button aria-label="Copy answer" onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function ChatPage() {
  const params = useSearchParams();
  const { project } = useApp();
  const agents = useList<Agent>("agents").rows || [];
  const [agentId, setAgentId] = useState(params.get("agent") || "");
  const [model, setModel] = useState<Model>("default");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<AbortController | null>(null);
  const [stream, setStream] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const key = project ? `lo.chat.${project.id}` : "";
  const agent = agents.find((a) => a.id === agentId);

  useEffect(() => { if (!key) return; try { setMsgs(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setMsgs([]); } }, [key]);
  useEffect(() => { if (key) try { localStorage.setItem(key, JSON.stringify(msgs.slice(-60))); } catch {} }, [key, msgs]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [msgs, stream]);
  // Grow the box with its content, up to a limit.
  useEffect(() => { const el = box.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 220) + "px"; } }, [text]);
  const started = useRef(false);
  useEffect(() => {
    const q = params.get("q");
    if (project && params.get("lean") && !started.current) { started.current = true; if (q) send(LEAN + q); else setText("/lean "); }
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(raw?: string) {
    let body = (raw ?? text).trim();
    if (!body || busy || !project) return;
    if (body.startsWith("/lean ")) body = LEAN + body.slice(6);
    setText("");
    const history = msgs.slice(-10).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n\n");
    setMsgs((m) => [...m, { role: "user", text: body }]);
    const ac = new AbortController();
    setBusy(ac); setStream("");
    let partial = "";
    try {
      const r = await streamChat({ projectId: project.id, prompt: (history ? `Conversation so far:\n${history}\n\n` : "") + `User: ${body}`, model: agent?.model || model, agentId: agentId || undefined }, (t) => { partial = t; setStream(t); }, ac.signal);
      setMsgs((m) => [...m, { role: "assistant", text: r.text, who: agent?.name || "Delegra", tokens: r.tokens }]);
    } catch (e) {
      if ((e as Error).name === "AbortError") setMsgs((m) => [...m, { role: "assistant", text: (partial || "") + "\n\n(stopped)", who: agent?.name || "Delegra" }]);
      else toast.error((e as Error).message);
    } finally { setBusy(null); setStream(""); }
  }

  if (!project) return <div className="grid h-[calc(100dvh-57px)] place-items-center p-6 text-center text-muted-foreground">Pick or connect a project first.</div>;
  const empty = !msgs.length && !busy;

  const composer = (
    <div className="rounded-[22px] border bg-card shadow-[0_2px_10px_-2px_rgba(11,11,18,0.08)] transition-shadow focus-within:border-primary/40 focus-within:shadow-[0_4px_20px_-4px_rgba(79,59,245,0.25)]">
      <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} rows={1} autoFocus aria-label="Message"
        placeholder={empty ? `How can your agents help with ${project.name}?` : "Reply…"}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        className="block max-h-[220px] min-h-[56px] w-full resize-none bg-transparent px-5 pt-4 pb-2 text-[15px] outline-none placeholder:text-muted-foreground" />
      <div className="flex items-center gap-1.5 px-3 pb-3">
        <AgentPicker agents={agents} value={agentId} onChange={setAgentId} className="h-8 w-auto max-w-56 rounded-full border-transparent bg-muted/70 hover:bg-muted" />
        <span className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex"><Lock className="size-3" />Read-only</span>
        <div className="ml-auto flex items-center gap-1.5">
          {!agent && <ModelPicker value={model} onChange={setModel} className="h-8 w-auto max-w-52 rounded-full border-transparent hover:bg-muted" />}
          {busy
            ? <Button size="icon" variant="outline" className="size-9 rounded-full" aria-label="Stop" onClick={() => busy.abort()}><Square className="fill-current" /></Button>
            : <Button size="icon" className="size-9 rounded-full" aria-label="Send" onClick={() => send()} disabled={!text.trim()}><ArrowUp /></Button>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-57px)] flex-col">
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16">
          <div className="w-full max-w-2xl">
            <div className="mb-8 flex items-center justify-center gap-3">
              <DelegraMark className="size-10" />
              <h1 className="font-brand text-[34px] leading-tight font-semibold tracking-[-0.03em] sm:text-[40px]">What should we work on?</h1>
            </div>
            {composer}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map(({ icon: Icon, label, text: t }) => (
                <button key={label} onClick={() => { setText(t); box.current?.focus(); }} className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground">
                  <Icon className="size-3.5 text-primary" />{label}
                </button>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-muted-foreground">Chat reads {project.name} but never changes it. Use Tasks or Workflows to make changes.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b px-4 py-2.5 md:px-6">
            <span className="flex min-w-0 items-center gap-2 text-sm"><FolderGit2 className="size-4 text-muted-foreground" /><span className="truncate font-medium">{project.name}</span><span className="text-muted-foreground">· {msgs.filter((m) => m.role === "user").length} messages</span></span>
            <Button variant="ghost" size="sm" onClick={() => setMsgs([])}><Trash2 />New chat</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-8 md:px-6">
              {msgs.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-secondary px-4 py-2.5 text-[15px] leading-7 whitespace-pre-wrap text-secondary-foreground">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="group grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                  <DelegraMark className="mt-0.5 size-7" />
                  <div className="min-w-0">
                    <div className="mb-1 text-sm font-semibold">{m.who}</div>
                    <Answer text={m.text} />
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <CopyButton text={m.text} />{m.tokens ? <span>{fmtTokens(m.tokens)} tokens</span> : null}
                    </div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                  <DelegraMark className="mt-0.5 size-7 animate-pulse" />
                  <div className="min-w-0">
                    <div className="mb-1 text-sm font-semibold">{agent?.name || "Delegra"}</div>
                    {stream ? <Answer text={stream} /> : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        Thinking<span className="flex gap-1">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d * 150}ms` }} />)}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div ref={end} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:px-6">
            {composer}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Read-only · agents can make mistakes, so check important answers.</p>
          </div>
        </>
      )}
    </div>
  );
}
export default function Page() { return <Suspense><ChatPage /></Suspense>; }
