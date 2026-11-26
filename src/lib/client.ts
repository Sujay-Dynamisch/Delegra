"use client";
import { useCallback, useEffect, useState } from "react";

/* One EventSource per tab; hooks refetch when their collection changes. */
type Listener = (collection: string) => void;
const listeners = new Set<Listener>();
let es: EventSource | null = null;
function subscribe(fn: Listener) {
  if (!es && typeof window !== "undefined") {
    es = new EventSource("/api/events");
    es.onmessage = (e) => listeners.forEach((l) => l(e.data));
  }
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(path, { method: init?.method || (init?.body ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: init?.body ? JSON.stringify(init.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
export const db = {
  create: (c: string, data: object) => api<{ id: string }>(`/api/${c}`, { body: data }),
  update: (c: string, id: string, data: object) => api(`/api/${c}/${id}`, { method: "PATCH", body: data }),
  remove: (c: string, id: string) => api(`/api/${c}/${id}`, { method: "DELETE" }),
};

export function useList<T>(collection: string, project?: string | null) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/${collection}${project ? `?project=${encodeURIComponent(project)}` : ""}`;
  const load = useCallback(() => api<T[]>(url).then((r) => { setRows(r); setError(null); }, (e) => setError(e.message)), [url]);
  useEffect(() => {
    if (project === null) { setRows([]); return; }
    load();
    return subscribe((c) => { if (c === collection) load(); });
  }, [collection, project, load]);
  return { rows, error, loading: rows === null && !error, reload: load };
}

export function useDoc<T>(collection: string, id: string | null) {
  const [doc, setDoc] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { if (id) api<T>(`/api/${collection}/${id}`).then(setDoc, (e) => setError(e.message)); }, [collection, id]);
  useEffect(() => { load(); return subscribe((c) => { if (c === collection) load(); }); }, [collection, load]);
  return { doc, error, reload: load };
}

/** Streams a read-only answer from Claude in the selected project. */
export async function streamChat(body: { projectId: string; prompt: string; model: string; agentId?: string }, onText: (t: string) => void, signal?: AbortSignal) {
  const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || "No answer");
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = "", last: { ok: boolean; text: string; error?: string; tokens?: number } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      if (m.done) last = m; else onText(m.text);
    }
  }
  if (!last?.ok) throw new Error(last?.error || "No answer");
  return last;
}

export const ago = (t?: string | null) => {
  if (!t) return "—";
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
export const dur = (ms?: number | null) => { if (ms == null || !(ms >= 0)) return "—"; const s = Math.round(ms / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; };
export const fmtTokens = (n?: number | null) => (n == null ? "—" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(n));
