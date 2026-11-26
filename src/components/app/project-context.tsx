"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, useList } from "@/lib/client";
import type { ClaudeStatus, Project, ProviderStatus } from "@/lib/types";

type Ctx = {
  projects: Project[]; project: Project | null; setProjectId: (id: string) => void;
  claude: ClaudeStatus | null; refreshClaude: () => Promise<void>; connectOpen: boolean; setConnectOpen: (o: boolean) => void;
  providers: ProviderStatus[] | null;
};
const C = createContext<Ctx | null>(null);
export const useApp = () => useContext(C)!;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { rows } = useList<Project>("projects");
  const [id, setId] = useState<string>("");
  const [claude, setClaude] = useState<ClaudeStatus | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  useEffect(() => { try { setId(localStorage.getItem("lo.project") || ""); } catch {} }, []);
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  // One refresh updates both: the Claude status (used to gate runs) and every provider card.
  const refreshClaude = async () => {
    try { setClaude(await api<ClaudeStatus>("/api/claude")); } catch { setClaude({ installed: false, loggedIn: false, granted: false }); }
    try { setProviders(await api<ProviderStatus[]>("/api/providers")); } catch { setProviders([]); }
  };
  useEffect(() => { refreshClaude(); }, []);
  const projects = useMemo(() => rows || [], [rows]);
  const project = projects.find((p) => p.id === id) || projects[0] || null;
  const value: Ctx = {
    projects, project, claude, refreshClaude, connectOpen, setConnectOpen, providers,
    setProjectId: (v) => { setId(v); try { localStorage.setItem("lo.project", v); } catch {} },
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
