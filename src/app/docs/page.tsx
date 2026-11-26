"use client";
import { useEffect, useMemo, useState } from "react";
import { Info, Search, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS, type Block } from "./content";

const text = (b: Block) => Object.values(b).flat(2).join(" ").toLowerCase();

function Render({ b }: { b: Block }) {
  if ("h" in b) return <h3 className="mt-2 text-base font-semibold">{b.h}</h3>;
  if ("p" in b) return <p className="leading-7 text-foreground/85">{b.p}</p>;
  if ("list" in b) return <ul className="grid list-disc gap-1.5 pl-5 leading-7 text-foreground/85 marker:text-muted-foreground">{b.list.map((x) => <li key={x}>{x}</li>)}</ul>;
  if ("steps" in b) return (
    <ol className="grid gap-2.5">
      {b.steps.map((x, i) => (
        <li key={x} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 leading-7">
          <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">{i + 1}</span>
          <span className="text-foreground/85">{x}</span>
        </li>
      ))}
    </ol>
  );
  if ("code" in b) return <pre className="overflow-x-auto rounded-xl border bg-muted/50 p-4 font-mono text-[13px] leading-6">{b.code}</pre>;
  if ("note" in b) return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-6", b.tone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-sky-500/25 bg-sky-500/5")}>
      {b.tone === "warn" ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" /> : <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />}
      <span>{b.note}</span>
    </div>
  );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>{b.table.head.map((h) => <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{b.table.rows.map((r) => <tr key={r.join()} className="border-t align-top">{r.map((c, i) => <td key={i} className={cn("px-4 py-2.5", i === 0 && "font-medium")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function Docs() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(SECTIONS[0].id);
  const shown = useMemo(() => (q.trim() ? SECTIONS.filter((s) => (s.title + " " + s.blocks.map(text).join(" ")).toLowerCase().includes(q.toLowerCase())) : SECTIONS), [q]);
  const groups = [...new Set(shown.map((s) => s.group))];

  // Highlight the section in view.
  useEffect(() => {
    const io = new IntersectionObserver((es) => { const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); }, { rootMargin: "-80px 0px -70% 0px" });
    shown.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [shown]);

  return (
    <div className="grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-120px)] lg:self-start lg:overflow-y-auto">
        <label className="mb-4 flex items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs…" aria-label="Search docs" className="h-9 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <nav aria-label="Contents" className="grid gap-4">
          {groups.map((g) => (
            <div key={g}>
              <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground">{g}</p>
              {shown.filter((s) => s.group === g).map((s) => (
                <a key={s.id} href={`#${s.id}`} className={cn("block rounded-md px-2 py-1 text-sm text-foreground/70 hover:bg-accent hover:text-foreground", active === s.id && "bg-accent font-medium text-foreground")}>{s.title}</a>
              ))}
            </div>
          ))}
          {!shown.length && <p className="px-2 text-sm text-muted-foreground">Nothing matches “{q}”.</p>}
        </nav>
      </aside>
      <article className="max-w-3xl">
        <header className="mb-10">
          <h1 className="text-[32px] leading-tight font-semibold tracking-tight">Lean Orchestrator documentation</h1>
          <p className="mt-2 text-muted-foreground">Everything you need to set up, connect your AI plans, and run agents and workflows in your projects.</p>
        </header>
        {groups.map((g) => (
          <div key={g} className="mb-12">
            <p className="mb-6 border-b pb-2 text-sm font-semibold text-muted-foreground">{g}</p>
            {shown.filter((s) => s.group === g).map((s) => (
              <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
                <h2 className="mb-4 text-xl font-semibold tracking-tight">{s.title}</h2>
                <div className="grid gap-4">{s.blocks.map((b, i) => <Render key={i} b={b} />)}</div>
              </section>
            ))}
          </div>
        ))}
      </article>
    </div>
  );
}
