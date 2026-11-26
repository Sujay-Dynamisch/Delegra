/** Claude aliases ("haiku" | "sonnet" | "opus") or Antigravity models prefixed "agy:" (e.g. "agy:gemini-3.8-flash-low"). */
export type Model = string;
export const MODELS: Model[] = ["haiku", "sonnet", "opus"];
export type ProviderId = "claude" | "antigravity";
export type ModelInfo = { id: string; label: string; provider: ProviderId; tier: "fast" | "balanced" | "deep"; note: string };
export type ProviderStatus = { id: ProviderId; name: string; installed: boolean; version?: string; signedIn: boolean; plan?: string; granted: boolean; grantedAt?: string };
export type PermissionMode = "plan" | "default" | "acceptEdits" | "bypassPermissions";
export type Status = "queued" | "working" | "done" | "blocked";

export type Row = { id: string; createdAt?: string; updatedAt?: string };
export type Project = Row & { name: string; path: string; permissionMode: PermissionMode; branch?: string; stack?: string[] };
export type Agent = Row & { name: string; model: Model; role: string; skills: string[]; instructions: string; icon?: string; template?: string };
export type Update = { at: string; text: string; kind?: "text" | "tool" | "system" };
export type Task = Row & {
  projectId: string; title: string; prompt: string; model: Model; agentId?: string; status: Status; progress: number;
  updates: Update[]; files: string[]; output?: string; error?: string | null; tokens?: number | null; costUsd?: number | null;
  durationMs?: number | null; startedAt?: string; finishedAt?: string | null; sessionId?: string;
};

/** n8n-style workflow graph. */
export type NodeKind = "trigger" | "agent" | "condition" | "merge" | "note";
export type FlowNode = { id: string; kind: NodeKind; position: { x: number; y: number }; data: { label: string; agentId?: string; model?: Model; instruction?: string; contains?: string; write?: boolean } };
export type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null };
export type Workflow = Row & { projectId: string; name: string; description?: string; nodes: FlowNode[]; edges: FlowEdge[]; active?: boolean; schedule?: string | null };
export type NodeRun = { status: "running" | "ok" | "failed" | "skipped"; output?: string; tokens?: number | null; costUsd?: number | null; startedAt?: string; finishedAt?: string };
export type Run = Row & {
  projectId: string; workflowId: string; workflowName: string; trigger: "manual" | "schedule"; status: "running" | "ok" | "failed" | "stopped";
  startedAt: string; finishedAt?: string; nodes: Record<string, NodeRun>; tokens?: number; costUsd?: number;
};
export type Settings = { rules: string[]; claude?: { granted: boolean; grantedAt?: string; scopes: string[] } };
export type ClaudeStatus = { installed: boolean; version?: string; loggedIn: boolean; authMethod?: string; plan?: string; expiresAt?: string; granted: boolean; grantedAt?: string };
