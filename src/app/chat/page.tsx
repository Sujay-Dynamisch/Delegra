"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUp, Bot, Loader2, MessageSquare, Square, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/components/app/project-context";
import { Empty, NativeSelect, PageHeader } from "@/components/app/bits";
import { fmtTokens, streamChat, useList } from "@/lib/client";
import { MODELS, type Agent, type Model } from "@/lib/types";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string; who?: string; tokens?: number };
const LEAN = "Plan this with the /lean approach: split it into the smallest checkpoints, say which model (haiku, sonnet or opus) each one needs and why, which files each touches, and how to verify it. Do not change any files.\n\nGoal: ";

function ChatPage() {
  const params = useSearchParams();
  const { project } = useApp();
  const agents = useList<Agent>("agents").rows || [];
  const [agentId, setAgentId] = useState(params.get("agent") || "");
  const [model, setModel] = useState<Model>("sonnet");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<AbortController | null>(null);
  const [stream, setStream] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const key = project ? `lo.chat.${project.id}` : "";
  const agent = agents.find((a) => a.id === agentId);

  useEffect(() => { if (!key) return; try { setMsgs(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setMsgs([]); } }, [key]);
  useEffect(() => { if (key) try { localStorage.setItem(key, JSON.stringify(msgs.slice(-60))); } catch {} }, [key, msgs]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, stream]);
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
    try {
      const r = await streamChat({ projectId: project.id, prompt: (history ? `Conversation so far:\n${history}\n\n` : "") + `User: ${body}`, model: agent?.model || model, agentId: agentId || undefined }, setStream, ac.signal);
      setMsgs((m) => [...m, { role: "assistant", text: r.text, who: agent?.name || "Claude", tokens: r.tokens }]);
    } catch (e) {
      if ((e as Error).name === "AbortError") setMsgs((m) => [...m, { role: "assistant", text: (stream || "") + "\n\n(stopped)", who: agent?.name || "Claude" }]);
      else toast.error((e as Error).message);
    } finally { setBusy(null); setStream(""); }
  }

  if (!project) return <div className="rounded-2xl border bg-card"><Empty icon={MessageSquare} title="Pick or connect a project first." /></div>;
  return (
    <>
      <PageHeader title="Chat" sub={`Ask about ${project.name}. Answers are read-only: Claude can read the project but not change it here.`}>
        <NativeSelect aria-label="Agent" className="w-auto" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          <option value="">No agent</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </NativeSelect>
        {!agent && <NativeSelect aria-label="Model" className="w-auto" value={model} onChange={(e) => setModel(e.target.value as Model)}>{MODELS.map((m) => <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>)}</NativeSelect>}
        {!!msgs.length && <Button variant="outline" onClick={() => setMsgs([])}><Trash2 />Clear</Button>}
      </PageHeader>
      <section className="flex h-[calc(100dvh-230px)] min-h-[420px] flex-col rounded-2xl border bg-card shadow-xs">
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {!msgs.length && !busy && <Empty icon={MessageSquare} title="Plan a change, ask how something works, or start with /lean to get a cheap, staged plan." />}
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">{m.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}</div>
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap", m.role === "user" ? "bg-foreground text-background" : "border bg-background")}>
                {m.who && <div className="mb-1 text-xs font-semibold text-muted-foreground">{m.who}{m.tokens ? ` · ${fmtTokens(m.tokens)} tokens` : ""}</div>}
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-3"><div className="grid size-8 place-items-center rounded-full bg-muted"><Loader2 className="size-4 animate-spin" /></div>
              <div className="max-w-[80%] rounded-2xl border bg-background px-4 py-2.5 text-sm whitespace-pre-wrap text-muted-foreground">{stream || "Thinking…"}</div></div>
          )}
          <div ref={end} />
        </div>
        <div className="flex items-end gap-2 border-t p-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Message… (Enter to send, Shift+Enter for a new line)" className="max-h-48 min-h-12 resize-none"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {busy ? <Button size="icon" variant="outline" aria-label="Stop" onClick={() => busy.abort()}><Square /></Button>
            : <Button size="icon" aria-label="Send" onClick={() => send()} disabled={!text.trim()}><ArrowUp /></Button>}
        </div>
      </section>
    </>
  );
}
export default function Page() { return <Suspense><ChatPage /></Suspense>; }
