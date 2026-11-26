"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Check, Copy, FolderGit2, History, Lock, PenLine, Plus, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/components/app/project-context";
import { AgentPicker, ModelPicker } from "@/components/app/pickers";
import { DelegraMark } from "@/components/app/brand";
import { RichAnswer } from "@/components/app/rich-answer";
import { ago, api, fmtTokens, streamChat, useList } from "@/lib/client";
import type { Agent, Model, SessionMessage, SessionSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORIGIN = { delegra: "Delegra", vscode: "VS Code", jetbrains: "JetBrains", cli: "Terminal" } as const;
type Msg = { role: "user" | "assistant"; text: string; who?: string; tokens?: number };
const LEAN = "Plan this with the /lean approach: split it into the smallest checkpoints, say which model (haiku, sonnet or opus) each one needs and why, which files each touches, and how to verify it. Do not change any files.\n\nGoal: ";
const SUGGESTIONS = [
  { icon: Zap, label: "/lean plan a feature", text: "/lean " },
  { icon: FolderGit2, label: "Explain the project structure", text: "Explain how this project is structured: main folders, entry points and how data flows." },
  { icon: Lock, label: "Find security risks", text: "Look for the riskiest security issues in this project. List the top 5 with file:line." },
  { icon: PenLine, label: "Suggest tests to add", text: "Which important behavior in this project has no tests? Suggest the 5 most valuable tests to add." },
];

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
  const agents = useList<Agent>("agents", project?.id).rows || [];
  const sessions = useList<SessionSummary>("sessions", project ? project.id : null).rows;
  const [sessionId, setSessionId] = useState<string | null>(params.get("session"));
  const [showHistory, setShowHistory] = useState(false);
  const [agentId, setAgentId] = useState(params.get("agent") || "");
  const [model, setModel] = useState<Model>("default");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<AbortController | null>(null);
  const [stream, setStream] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const agent = agents.find((a) => a.id === agentId);

  // Switching project starts a new chat.
  const lastProject = useRef(project?.id);
  useEffect(() => { if (lastProject.current !== project?.id) { const was = lastProject.current; lastProject.current = project?.id; if (was) { setSessionId(null); setMsgs([]); } } }, [project?.id]);
  // The open chat is read from Claude Code's session file, so turns sent from the CLI or an IDE show up here too.
  const busyRef = useRef(false);
  useEffect(() => { busyRef.current = !!busy; }, [busy]);
  useEffect(() => {
    if (!project || !sessionId || busyRef.current) return;
    api<SessionMessage[]>(`/api/sessions/${sessionId}?project=${project.id}`)
      .then((m) => { if (!busyRef.current) setMsgs(m.map((x) => ({ role: x.role, text: x.text, who: x.role === "assistant" ? "Claude" : undefined }))); }, () => {});
  }, [project, sessionId, sessions]);
  const open = (id: string | null) => { if (busy) return; setSessionId(id); setMsgs([]); setShowHistory(false); };
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
    // Claude continues its own session (--resume), so earlier turns aren't re-sent. Antigravity has no session here, so it gets recent turns.
    const agy = (agent?.model || model).startsWith("agy:");
    if (agy && sessionId) { toast.error("Pick a Claude model to continue this conversation."); return; }
    const history = agy ? msgs.slice(-10).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`).join("\n\n") : "";
    setMsgs((m) => [...m, { role: "user", text: body }]);
    const ac = new AbortController();
    setBusy(ac); setStream("");
    let partial = "";
    try {
      const r = await streamChat({ projectId: project.id, prompt: history ? `Conversation so far:\n${history}\n\nUser: ${body}` : body, model: agent?.model || model, agentId: agentId || undefined, sessionId: sessionId || undefined }, (t) => { partial = t; setStream(t); }, ac.signal);
      setMsgs((m) => [...m, { role: "assistant", text: r.text, who: agent?.name || "Delegra", tokens: r.tokens }]);
      if (!agy && r.sessionId) setSessionId(r.sessionId);
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

  const history = (
    <aside className={cn("w-72 shrink-0 flex-col border-r", showHistory ? "fixed top-[57px] bottom-0 left-0 z-30 flex bg-background shadow-xl" : "hidden lg:flex")}>
      <div className="p-3"><Button variant="outline" className="w-full justify-start" onClick={() => open(null)}><Plus />New chat</Button></div>
      <p className="px-4 pb-1 text-xs font-medium text-muted-foreground">{project.name} history</p>
      <nav aria-label="Chat history" className="grid flex-1 content-start gap-0.5 overflow-y-auto px-2 pb-3">
        {sessions === null && <p className="px-2 py-1 text-sm text-muted-foreground">Loading…</p>}
        {sessions?.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">No conversations yet. Chats here and Claude Code sessions in this folder appear here.</p>}
        {sessions?.map((s) => (
          <button key={s.id} onClick={() => open(s.id)} className={cn("grid gap-0.5 rounded-lg px-2.5 py-2 text-left hover:bg-accent", s.id === sessionId && "bg-accent")}>
            <span className="truncate text-sm">{s.title}</span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {Date.now() - new Date(s.updatedAt).getTime() < 120000 && <span className="inline-flex items-center gap-1 font-medium text-emerald-600"><span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />Live</span>}
              {ORIGIN[s.origin]} · {ago(s.updatedAt)}
            </span>
          </button>
        ))}
      </nav>
      <p className="border-t px-4 py-2.5 text-[11px] leading-4 text-muted-foreground">Synced with Claude Code: sessions from the terminal or IDE in this folder show here, and chats here can be resumed there.</p>
    </aside>
  );

  return (
    <div className="flex h-[calc(100dvh-57px)]">
    {history}
    {showHistory && <button aria-label="Close history" className="fixed inset-x-0 top-[57px] bottom-0 z-20 bg-black/20 lg:hidden" onClick={() => setShowHistory(false)} />}
    <div className="relative flex min-w-0 flex-1 flex-col">
      <Button variant="ghost" size="sm" className="absolute top-2 left-2 z-10 lg:hidden" onClick={() => setShowHistory(true)}><History />History</Button>
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
          <div className="flex items-center justify-between border-b py-2.5 pr-4 pl-28 md:pr-6 lg:pl-6">
            <span className="flex min-w-0 items-center gap-2 text-sm"><FolderGit2 className="size-4 text-muted-foreground" /><span className="truncate font-medium">{project.name}</span><span className="text-muted-foreground">· {msgs.filter((m) => m.role === "user").length === 1 ? "1 message" : `${msgs.filter((m) => m.role === "user").length} messages`}</span></span>
            <Button variant="ghost" size="sm" onClick={() => open(null)}><Plus />New chat</Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 md:px-6">
              {msgs.map((m, i) => m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-secondary px-4 py-2.5 text-[15px] leading-7 break-words whitespace-pre-wrap text-secondary-foreground">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="group grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                  <DelegraMark className="mt-0.5 size-7" />
                  <div className="min-w-0">
                    <div className="mb-1 text-sm font-semibold">{m.who}</div>
                    <RichAnswer text={m.text} onAction={busy ? undefined : (t) => send(t)} />
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
                    {stream ? <RichAnswer text={stream} streaming /> : (
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
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {(sessions?.find((s) => s.id === sessionId)?.sizeKb || 0) > 3000
                ? "This is a long conversation: each reply re-reads all of it. Start a new chat to use fewer tokens."
                : "Read-only · agents can make mistakes, so check important answers."}
            </p>
          </div>
        </>
      )}
    </div>
    </div>
  );
}
export default function Page() { return <Suspense><ChatPage /></Suspense>; }
