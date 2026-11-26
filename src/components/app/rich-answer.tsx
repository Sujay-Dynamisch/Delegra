"use client";
import { Fragment, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, Copy, FileText, Info, Search, Star, Plus, Sparkles, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ---------------- inline: `code`, **bold**, *italic*, [links](url), bare URLs ---------------- */

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\s][^*\n]*\*|\[[^\]\n]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((t, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{t}</Fragment>;
        if (t.startsWith("`")) return <code key={i} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.86em]">{t.slice(1, -1)}</code>;
        if (t.startsWith("**") || t.startsWith("__")) return <strong key={i} className="font-semibold">{t.slice(2, -2)}</strong>;
        if (t.startsWith("*")) return <em key={i}>{t.slice(1, -1)}</em>;
        const link = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        const href = safeUrl(link ? link[2] : t);
        const label = link ? link[1] : t;
        return href ? <a key={i} href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">{label}</a> : <Fragment key={i}>{label}</Fragment>;
      })}
    </>
  );
}

/* ---------------- blocks ---------------- */

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono">{lang || "code"}</span>
        <button aria-label="Copy code" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-background hover:text-foreground"
          onClick={() => navigator.clipboard.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
          {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{done ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">{code}</pre>
    </div>
  );
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isSep = (line?: string) => !!line && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

function Table({ head, rows, align }: { head: string[]; rows: string[][]; align: string[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50"><tr>{head.map((h, i) => <th key={i} className="px-3.5 py-2 text-left font-semibold whitespace-nowrap" style={{ textAlign: align[i] as never }}><Inline text={h} /></th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t align-top even:bg-muted/20">{head.map((_, j) => <td key={j} className="px-3.5 py-2" style={{ textAlign: align[j] as never }}><Inline text={r[j] ?? ""} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

type Item = { depth: number; ordered: boolean; text: string; task?: boolean; done?: boolean };
function List({ items }: { items: Item[] }) {
  const ordered = items[0]?.ordered;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("grid gap-1.5 pl-5", ordered ? "list-decimal marker:font-medium marker:text-muted-foreground" : "list-disc marker:text-primary/70")}>
      {items.map((it, i) => (
        <li key={i} style={{ marginLeft: it.depth * 18 }} className={cn("pl-1", it.task && "list-none -ml-5")}>
          {it.task ? <span className="inline-flex gap-2"><span className={cn("mt-1 grid size-4 shrink-0 place-items-center rounded border", it.done && "border-primary bg-primary text-primary-foreground")}>{it.done && <Check className="size-3" />}</span><span className={cn(it.done && "text-muted-foreground line-through")}><Inline text={it.text} /></span></span> : <Inline text={it.text} />}
        </li>
      ))}
    </Tag>
  );
}

/** Markdown for agent answers: headings, lists, task lists, tables, quotes, rules, code, and A2UI views. */
export function RichAnswer({ text, onAction, streaming }: { text: string; onAction?: (message: string) => void; streaming?: boolean }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  const push = (n: ReactNode) => out.push(<Fragment key={out.length}>{n}</Fragment>);
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      const lang = fence[1].toLowerCase(), body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) body.push(lines[i++]);
      const closed = i < lines.length;
      i++;
      if (lang === "a2ui") push(closed ? <A2UISurface source={body.join("\n")} onAction={onAction} /> : <div className="animate-pulse rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Building view…</div>);
      else push(<CodeBlock code={body.join("\n")} lang={lang} />);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      push(<div role="heading" aria-level={lvl} className={cn("font-semibold tracking-tight", lvl === 1 ? "mt-2 text-xl" : lvl === 2 ? "mt-2 text-lg" : "mt-1 text-base")}><Inline text={h[2]} /></div>);
      i++; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { push(<hr className="my-1" />); i++; continue; }
    if (line.trim().startsWith("|") && isSep(lines[i + 1])) {
      const head = cells(line), align = cells(lines[i + 1]).map((c) => (c.endsWith(":") ? (c.startsWith(":") ? "center" : "right") : "left"));
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      push(<Table head={head} rows={rows} align={align} />);
      continue;
    }
    if (/^\s*>/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ""));
      push(<blockquote className="border-l-2 border-primary/50 pl-4 text-foreground/80"><RichAnswer text={q.join("\n")} onAction={onAction} /></blockquote>);
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const items: Item[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)!;
        const task = m[3].match(/^\[([ xX])\]\s+(.*)$/);
        items.push({ depth: Math.floor(m[1].replace(/\t/g, "  ").length / 2), ordered: /\d/.test(m[2]), text: task ? task[2] : m[3], task: !!task, done: task ? task[1] !== " " : undefined });
        i++;
        // Lazy continuation lines belong to the item above.
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) items[items.length - 1].text += " " + lines[i++].trim();
      }
      push(<List items={items} />);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,6}\s|>|([-*+]|\d+[.)])\s+)/.test(lines[i]) && !(lines[i].trim().startsWith("|") && isSep(lines[i + 1]))) para.push(lines[i++]);
    if (!para.length) { push(<p><Inline text={lines[i++]} /></p>); continue; }
    push(<p className="whitespace-pre-wrap"><Inline text={para.join("\n")} /></p>);
  }
  return <div className={cn("grid gap-3 text-[15px] leading-7 break-words [&>*]:min-w-0", streaming && "[&>*:last-child]:after:ml-0.5 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-4 [&>*:last-child]:after:w-1.5 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:bg-primary [&>*:last-child]:after:align-middle [&>*:last-child]:after:content-['']")}>{out}</div>;
}

/* ---------------- A2UI v0.8 (standard catalog subset) ---------------- */

type Bound = { literalString?: string; literalNumber?: number; literalBoolean?: boolean; path?: string };
type Comp = Record<string, Record<string, unknown>>;
type Children = { explicitList?: string[]; template?: { componentId: string; dataBinding: string } };
type DataEntry = { key: string; valueString?: string; valueNumber?: number; valueBoolean?: boolean; valueMap?: DataEntry[] };

const ICONS: Record<string, LucideIcon> = { check: CheckCircle2, check_circle: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info, star: Star, add: Plus, search: Search, description: FileText };

/** Parses A2UI messages (JSONL, a JSON array, or one object) into components, data and a root id. */
function parseA2UI(src: string) {
  const msgs: Record<string, Record<string, unknown>>[] = [];
  const t = src.trim();
  try { const j = JSON.parse(t); msgs.push(...(Array.isArray(j) ? j : [j])); } catch {
    for (const l of t.split("\n")) { if (l.trim()) msgs.push(JSON.parse(l)); }
  }
  const comps = new Map<string, Comp>();
  const data: Record<string, unknown> = {};
  let root = "";
  const toObj = (entries: DataEntry[]): Record<string, unknown> => Object.fromEntries(entries.map((e) => [e.key, e.valueMap ? toObj(e.valueMap) : e.valueString ?? e.valueNumber ?? e.valueBoolean]));
  for (const m of msgs) {
    const su = m.surfaceUpdate as { components?: { id: string; component: Comp }[] } | undefined;
    su?.components?.forEach((c) => comps.set(c.id, c.component));
    const dm = m.dataModelUpdate as { path?: string; contents?: DataEntry[] } | undefined;
    if (dm?.contents) {
      const obj = toObj(dm.contents);
      if (dm.path && dm.path !== "/") data[dm.path.replace(/^\//, "")] = obj; else Object.assign(data, obj);
    }
    const br = m.beginRendering as { root?: string } | undefined;
    if (br?.root) root = br.root;
  }
  return { comps, data, root: root || (comps.has("root") ? "root" : comps.keys().next().value || "") };
}

function A2UISurface({ source, onAction }: { source: string; onAction?: (message: string) => void }) {
  let parsed: ReturnType<typeof parseA2UI>;
  try { parsed = parseA2UI(source); } catch { return <CodeBlock code={source} lang="a2ui" />; }
  const { comps, data, root } = parsed;
  const get = (path: string, scope: Record<string, unknown>) => path.replace(/^\//, "").split("/").filter(Boolean).reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), scope);
  const val = (b: Bound | string | undefined, scope: Record<string, unknown>): string => {
    if (b == null) return "";
    if (typeof b === "string") return b;
    if (b.path) { const v = get(b.path, scope) ?? get(b.path, data); return v == null ? "" : String(v); }
    return String(b.literalString ?? b.literalNumber ?? b.literalBoolean ?? "");
  };

  const render = (id: string, scope: Record<string, unknown>, depth: number, key?: string | number): ReactNode => {
    const c = comps.get(id);
    if (!c || depth > 24) return null;
    const [type, p] = Object.entries(c)[0] || [];
    const kids = (ch: unknown, cls: string, grow?: boolean) => {
      const list = ch as Children | undefined;
      if (list?.template) {
        const items = get(list.template.dataBinding, scope) ?? get(list.template.dataBinding, data);
        const arr = Array.isArray(items) ? items : items && typeof items === "object" ? Object.values(items) : [];
        return <div className={cls}>{arr.map((it, n) => <div key={n} className={cn("min-w-0", grow && "flex-1")}>{render(list.template!.componentId, { ...scope, ...(it as object) }, depth + 1)}</div>)}</div>;
      }
      return <div className={cls}>{(list?.explicitList || []).map((k, n) => <div key={k + n} className={cn("min-w-0", grow && !comps.get(k)?.Button && "flex-1 basis-40")}>{render(k, scope, depth + 1)}</div>)}</div>;
    };
    const justify = (d?: unknown) => ({ center: "justify-center", end: "justify-end", spaceBetween: "justify-between", spaceAround: "justify-around", spaceEvenly: "justify-evenly" } as Record<string, string>)[String(d)] || "";
    const items = (a?: unknown) => ({ center: "items-center", end: "items-end", start: "items-start", stretch: "items-stretch" } as Record<string, string>)[String(a)] || "";
    switch (type) {
      case "Text": {
        const hint = String(p.usageHint || "body");
        const cls = { h1: "text-2xl font-semibold tracking-tight", h2: "text-xl font-semibold tracking-tight", h3: "text-lg font-semibold", h4: "text-base font-semibold", h5: "text-sm font-semibold", caption: "text-xs text-muted-foreground", body: "text-sm leading-6" }[hint] || "text-sm";
        return <div key={key} className={cls}><Inline text={val(p.text as Bound, scope)} /></div>;
      }
      case "Card": return <div key={key} className="rounded-xl border bg-card p-4 shadow-xs">{render(String(p.child), scope, depth + 1)}</div>;
      case "Row": return <Fragment key={key}>{kids(p.children, cn("flex flex-wrap gap-3", justify(p.distribution), items(p.alignment)), true)}</Fragment>;
      case "Column": return <Fragment key={key}>{kids(p.children, cn("flex flex-col gap-2", justify(p.distribution), items(p.alignment)))}</Fragment>;
      case "List": return <Fragment key={key}>{kids(p.children, p.direction === "horizontal" ? "flex gap-3 overflow-x-auto pb-1" : "grid gap-2")}</Fragment>;
      case "Divider": return <hr key={key} className={p.axis === "vertical" ? "h-full w-px border-0 bg-border" : ""} />;
      case "Icon": { const I = ICONS[val(p.name as Bound, scope)] || Sparkles; return <I key={key} className="size-4 text-primary" />; }
      case "Image": {
        const url = safeUrl(val(p.url as Bound, scope));
        return url ? <img key={key} src={url} alt={val(p.altText as Bound, scope)} className={cn("rounded-lg object-cover", p.usageHint === "icon" || p.usageHint === "avatar" ? "size-10 rounded-full" : "max-h-72 w-full")} /> : null;
      }
      case "Button": {
        const a = (p.action || {}) as { name?: string; context?: { key: string; value: Bound }[] };
        const ctx = (a.context || []).map((x) => `${x.key}: ${val(x.value, scope)}`).join(", ");
        return (
          <Button key={key} size="sm" variant={p.primary ? "default" : "outline"} disabled={!onAction}
            onClick={() => onAction?.(ctx ? `${a.name}: ${ctx}` : String(a.name || "Continue"))}>
            {render(String(p.child), scope, depth + 1)}
          </Button>
        );
      }
      case "Tabs": {
        const tabs = (p.tabItems || []) as { title: Bound; child: string }[];
        return <TabsView key={key} tabs={tabs.map((t) => ({ title: val(t.title, scope), body: render(t.child, scope, depth + 1) }))} />;
      }
      default: return null;
    }
  };
  const view = render(root, data, 0);
  // A Card root is framed already; anything else gets a light frame so it reads as one view.
  return view ? <div className={cn("grid gap-3 [&_button>div]:text-inherit", !comps.get(root)?.Card && "rounded-2xl border bg-muted/20 p-3")}>{view}</div> : <CodeBlock code={source} lang="a2ui" />;
}

function TabsView({ tabs }: { tabs: { title: string; body: ReactNode }[] }) {
  const [on, setOn] = useState(0);
  return (
    <div className="grid gap-3">
      <div role="tablist" className="flex gap-1 border-b">{tabs.map((t, i) => <button key={i} role="tab" aria-selected={on === i} onClick={() => setOn(i)} className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", on === i ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>{t.title}</button>)}</div>
      <div role="tabpanel">{tabs[on]?.body}</div>
    </div>
  );
}

