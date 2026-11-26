"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BookOpen, Bot, ChartNoAxesColumn, FolderGit2, History, House, ListChecks, MessageSquare, Moon, Plus, Settings, Sun, Workflow, Zap, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useApp } from "./project-context";
import { ConnectClaude } from "./connect-claude";

const NAV = [
  { href: "/", label: "Overview", icon: House },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/runs", label: "Executions", icon: History },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumn },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { projects, project, setProjectId, claude, providers, setConnectOpen } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const live = (providers || []).filter((p) => p.signedIn && p.granted);
  const connected = live.length > 0;
  // The workflow editor uses the full screen.
  const bare = /^\/workflows\/[^/]+$/.test(path);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 overflow-y-auto border-r bg-sidebar px-3 py-4 lg:flex">
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2">
          <div className="grid size-9 place-items-center rounded-xl bg-foreground text-background"><Layers className="size-5" /></div>
          <div className="leading-tight"><div className="font-semibold">Lean</div><div className="text-xs text-muted-foreground">Orchestrator</div></div>
        </Link>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-accent hover:text-foreground", active(href) && "bg-background text-foreground shadow-xs ring-1 ring-border")}>
            <Icon className="size-[18px]" />{label}
          </Link>
        ))}
        <div className="mt-5 border-t pt-4">
          <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">Quick actions</p>
          <div className="grid gap-2">
            <Button nativeButton={false} render={<Link href="/tasks?new=1" />} className="justify-start"><Plus />New task</Button>
            <Button nativeButton={false} render={<Link href="/chat?lean=1" />} variant="outline" className="justify-start"><Zap />/lean</Button>
            <Button nativeButton={false} render={<Link href="/workflows?new=1" />} variant="outline" className="justify-start"><Workflow />Create workflow</Button>
          </div>
        </div>
        <button onClick={() => setConnectOpen(true)} className="mt-auto flex items-center gap-3 rounded-xl border bg-background p-3 text-left text-sm transition-colors hover:bg-accent">
          <span className={cn("size-2.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{live.length ? live.map((p) => p.id === "claude" ? `Claude${claude?.plan ? " (" + claude.plan[0].toUpperCase() + claude.plan.slice(1) + ")" : ""}` : "Antigravity").join(" + ") : "AI providers"}</span>
            <span className="block text-xs text-muted-foreground">{connected ? "Connected" : "Not connected"}</span>
          </span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-7">
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map(({ href, icon: Icon, label }) => (
              <Link key={href} href={href} aria-label={label} className={cn("grid size-9 shrink-0 place-items-center rounded-lg", active(href) ? "bg-accent" : "text-muted-foreground")}><Icon className="size-[18px]" /></Link>
            ))}
          </nav>
          <h2 className="mr-auto hidden text-lg font-semibold lg:block">{NAV.find((n) => active(n.href))?.label}</h2>
          <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
            <FolderGit2 className="size-4 text-muted-foreground" />
            {projects.length ? (
              <select aria-label="Project" value={project?.id || ""} onChange={(e) => setProjectId(e.target.value)} className="max-w-44 bg-transparent font-medium outline-none">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : <Link href="/projects" className="font-medium">Add a project</Link>}
          </div>
          <button onClick={() => setConnectOpen(true)} className={cn("hidden items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium sm:inline-flex", connected ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
            <span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />{connected ? "Connected" : "Connect AI"}
          </button>
          <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </header>
        <main className={cn("min-w-0 flex-1", bare ? "" : "mx-auto w-full max-w-[1400px] px-4 py-7 md:px-7")}>{children}</main>
      </div>
      <ConnectClaude />
    </div>
  );
}
