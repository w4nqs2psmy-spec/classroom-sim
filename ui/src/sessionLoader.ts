import type { ListName, Phase, TurnView, WorkspaceEntryView } from "./data";

// Mirrors src/logger.ts's LogEntry on the Stage 1 side. Kept as a plain type
// here (not imported across the package boundary) since the UI only ever
// sees this shape serialized through the read-only dev endpoint in
// vite.config.ts.
export interface LogEntry {
  type: "turn" | "task_assigned" | "phase_transition" | "teacher_evaluation" | "session_end";
  timestamp: string;
  turn: number;
  phase: Phase | null;
  speaker: string;
  said: string;
  reasoning: string | null;
  workspaceChanged: boolean;
  workspaceDelta: unknown;
  model: string | null;
  costUSD: number | null;
}

export interface SessionSummary {
  file: string;
  size: number;
  mtime: string;
  isComplete: boolean;
}

// The one showcase log shipped as a STATIC file (ui/public/sessions/) for
// deployments without the dev-only /api/sessions middleware (e.g. GitHub
// Pages). Lives here, not Controls.tsx, so this module can reference it
// without a circular import (Controls already imports SessionSummary from here).
export const CURATED_SESSION = "session-2026-07-03T07-19-57-243Z.jsonl";

const STATIC_FALLBACK: SessionSummary[] = [
  { file: CURATED_SESSION, size: 0, mtime: "", isComplete: true },
];

export async function listSessions(): Promise<SessionSummary[]> {
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch {
    // No dev middleware on a static host (e.g. GitHub Pages) — fall back to
    // the one curated log shipped as a static file under public/sessions/.
    return STATIC_FALLBACK;
  }
}

interface RawSession {
  entries: LogEntry[];
  isComplete: boolean;
}

/** Mirrors the dev middleware's JSONL parsing (vite.config.ts) for the
 *  static fallback: one JSON object per line; only the LAST line may be
 *  malformed (a session still being written). */
function parseJsonl(raw: string): RawSession {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const entries: LogEntry[] = [];
  let isComplete = false;
  for (let i = 0; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i]) as LogEntry;
      entries.push(entry);
      if (entry.type === "session_end") isComplete = true;
    } catch {
      if (i !== lines.length - 1) throw new Error(`malformed log line ${i}`);
    }
  }
  return { entries, isComplete };
}

async function fetchSession(file: string): Promise<RawSession> {
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(file)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch {
    // Static host fallback: only the curated log is shipped as a file.
    if (file !== CURATED_SESSION) throw new Error(`Session ${file} is not available in this deployment`);
    const res = await fetch(`sessions/${file}`);
    if (!res.ok) throw new Error(`Failed to load static session ${file}: ${res.status}`);
    return parseJsonl(await res.text());
  }
}

// Every phase only ever accepts one matching workspace-contribution kind
// (see PHASE_GUIDANCE in src/prompts.ts and LIST_FOR in src/workspace.ts on
// the Stage 1 side), so a log line's own `phase` field is a reliable,
// self-contained way to recover which list a delta belongs to — no need to
// cross-reference workspace.json, which only ever holds the *latest*
// session's state and would silently break for any older log file.
// Partial, not total: `Phase` also covers the jigsaw task's luku/opetus/
// synteesi, but real Stage 1 logs (the only thing this file ever parses)
// never contain those — jigsaw sessions use a separate, unrelated logger.
const LIST_FOR_PHASE: Partial<Record<Phase, ListName>> = {
  ideation: "ideas",
  evaluation: "evaluations",
  synthesis: "synthesis",
};

interface WorkspaceEntryRaw {
  id: string;
  author: string;
  content: string;
}

function isWorkspaceEntryShape(x: unknown): x is WorkspaceEntryRaw {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as WorkspaceEntryRaw).id === "string" &&
    typeof (x as WorkspaceEntryRaw).author === "string" &&
    typeof (x as WorkspaceEntryRaw).content === "string"
  );
}

/** Maps one real Stage 1 log line to the UI's TurnView shape. */
export function logEntryToTurnView(entry: LogEntry): TurnView {
  if (!entry.phase) {
    throw new Error(`sessionLoader: log entry of type "${entry.type}" has no phase — schema drift from Stage 1's logger.ts.`);
  }

  let workspaceEntry: WorkspaceEntryView | undefined;
  if (entry.workspaceChanged && isWorkspaceEntryShape(entry.workspaceDelta)) {
    workspaceEntry = {
      list: LIST_FOR_PHASE[entry.phase]!,
      id: entry.workspaceDelta.id,
      author: entry.workspaceDelta.author,
      content: entry.workspaceDelta.content,
    };
  }

  return {
    speaker: entry.speaker,
    phase: entry.phase,
    said: entry.said,
    reasoning: entry.reasoning ?? undefined,
    workspaceEntry,
    isVerdict: entry.type === "teacher_evaluation",
    costUSD: entry.costUSD,
  };
}

// loop.ts's task_assigned line is always exactly:
//   `New task: ${task.title}. ${task.description} Your deliverable: ${task.deliverable}`
// Generated titles are short and reliably period-free (teacher.ts requires
// "Short, catchy task title" via a structured schema), so splitting on the
// first ". " for the title and on the fixed " Your deliverable: " marker for
// the deliverable is safe — and self-contained within the log file, so it
// works for any session regardless of what workspace.json currently holds.
function parseTaskFromAssignedLine(said: string): { title: string; deliverable: string } {
  const withoutPrefix = said.replace(/^New task: /, "");
  const deliverableMarker = " Your deliverable: ";
  const deliverableIdx = withoutPrefix.indexOf(deliverableMarker);
  const beforeDeliverable = deliverableIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, deliverableIdx);
  const deliverable = deliverableIdx === -1 ? "" : withoutPrefix.slice(deliverableIdx + deliverableMarker.length);
  const titleEnd = beforeDeliverable.indexOf(". ");
  const title = titleEnd === -1 ? beforeDeliverable : beforeDeliverable.slice(0, titleEnd);
  return { title, deliverable };
}

export interface LoadedSession {
  turns: TurnView[];
  task: { title: string; deliverable: string };
  isComplete: boolean;
}

/** Loads a full real session and adapts it into the UI's TurnView[] shape. */
export async function loadRealSession(file: string): Promise<LoadedSession> {
  const session = await fetchSession(file);

  const turns: TurnView[] = [];
  let task = { title: file, deliverable: "" };
  for (const entry of session.entries) {
    if (entry.type === "session_end") continue; // bookkeeping only, not a spoken turn
    if (entry.type === "task_assigned") task = parseTaskFromAssignedLine(entry.said);
    turns.push(logEntryToTurnView(entry));
  }

  return { turns, task, isComplete: session.isComplete };
}
