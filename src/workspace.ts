import { writeFileSync } from "node:fs";
import type { ContributionKind, Phase, Task, Workspace, WorkspaceEntry } from "./types.ts";

const WORKSPACE_FILE = new URL("../workspace.json", import.meta.url);

export function createWorkspace(task: Task): Workspace {
  return {
    task,
    phase: "ideation",
    status: "in_progress",
    ideas: [],
    evaluations: [],
    synthesis: [],
    teacherFeedback: [],
  };
}

const LIST_FOR: Record<Exclude<ContributionKind, "none">, keyof Pick<Workspace, "ideas" | "evaluations" | "synthesis">> = {
  idea: "ideas",
  evaluation: "evaluations",
  synthesis: "synthesis",
};

/**
 * Append a contribution to the workspace. Returns the created entry, or null
 * if the contribution was empty / kind "none".
 */
export function applyContribution(
  ws: Workspace,
  author: string,
  kind: ContributionKind,
  content: string,
  turn: number,
): WorkspaceEntry | null {
  if (kind === "none" || !content.trim()) return null;
  const list = ws[LIST_FOR[kind]];
  const entry: WorkspaceEntry = {
    id: `${kind}-${list.length + 1}`,
    author,
    content: content.trim(),
    turn,
    phase: ws.phase,
  };
  list.push(entry);
  return entry;
}

export function setPhase(ws: Workspace, phase: Phase): void {
  ws.phase = phase;
}

/** Persist current state to workspace.json (the primary data output). */
export function saveWorkspace(ws: Workspace): void {
  writeFileSync(WORKSPACE_FILE, JSON.stringify(ws, null, 2) + "\n");
}

export function workspaceJson(ws: Workspace): string {
  return JSON.stringify(ws, null, 2);
}
