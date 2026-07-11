// Client for the live-session endpoint (dev-server only). A presenter proposes
// a free-text task; the five agents work it live for a bounded number of rounds
// (default 23, held server-side), generated one turn per /api/live/next call.
//
// Everything is wrapped so the caller can always degrade gracefully: a timeout,
// a network error, a non-2xx (e.g. the static Pages build has no middleware and
// 404s), or malformed JSON all resolve to `null` — same philosophy as
// liveReply.ts. `null` from startLiveSession means "live mode is unavailable
// here"; the UI falls back to the scripted library and shows a dev-only note.

import type { Phase, TurnView } from "./data";
import type { Lang } from "./i18n";

const START_TIMEOUT_MS = 8000;
const TURN_TIMEOUT_MS = 20000; // a real Haiku turn can take several seconds

export interface LiveStartResult {
  sessionId: string;
  task: { title: string; deliverable: string };
  maxRounds: number;
  dry: boolean;
}

export interface LiveNextResult {
  /** Absent when the session has ended (done === true). */
  turn?: TurnView;
  done: boolean;
  /** Cumulative measured cost of the session so far. */
  costUSD: number;
}

interface ServerTurn {
  speaker: string;
  phase: Phase;
  said: string;
  reasoning?: string;
  workspaceEntry?: TurnView["workspaceEntry"];
  costUSD?: number;
}

async function postLive<T>(path: string, body: unknown, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // aborted (timeout) or network error
  } finally {
    clearTimeout(timer);
  }
}

export async function startLiveSession(args: {
  taskText: string;
  lang: Lang;
  maxRounds?: number;
}): Promise<LiveStartResult | null> {
  const data = await postLive<LiveStartResult>("/api/live/start", args, START_TIMEOUT_MS);
  return data && data.sessionId ? data : null;
}

/** Fetch the next turn. Returns null on any failure (caller stops the loop). */
export async function nextLiveTurn(sessionId: string): Promise<LiveNextResult | null> {
  const data = await postLive<{ turn?: ServerTurn; done?: boolean; costUSD?: number }>(
    "/api/live/next",
    { sessionId },
    TURN_TIMEOUT_MS,
  );
  if (!data) return null;
  const costUSD = typeof data.costUSD === "number" ? data.costUSD : 0;
  if (!data.turn) return { done: true, costUSD };
  const s = data.turn;
  // Map to a TurnView. Deliberately NO dialogueMove: live turns are dynamic, so
  // dynamics.ts classifies them heuristically and renders them faded/estimated
  // — the honest treatment. costUSD is a measured number (never undefined, so
  // the cost accounting books it as measured, not via the mock estimator).
  const turn: TurnView = {
    speaker: s.speaker,
    phase: s.phase,
    said: s.said,
    reasoning: s.reasoning,
    workspaceEntry: s.workspaceEntry,
    costUSD: typeof s.costUSD === "number" ? s.costUSD : 0,
  };
  return { turn, done: Boolean(data.done), costUSD };
}

/** Best-effort teardown; failures are ignored (the server also TTL-evicts). */
export function endLiveSession(sessionId: string): void {
  void postLive("/api/live/end", { sessionId }, START_TIMEOUT_MS);
}
