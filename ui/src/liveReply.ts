// Client for the live agent-reply endpoint (dev-server only). A human
// interjection POSTs here and one agent replies for real. Everything is
// wrapped so the caller can always fall back to a scripted line: a timeout,
// a network error, a non-2xx, or a model refusal all resolve to `null`.

import type { Lang } from "./i18n";

export interface LiveReplyArgs {
  agentName: string;
  humanText: string;
  transcript: string;
  taskText: string;
  lang: Lang;
}

export interface LiveReplyResult {
  say: string;
  costUSD: number;
}

const TIMEOUT_MS = 6000;

/** Returns the agent's reply, or null on any failure/timeout/refusal (→ fallback). */
export async function postAgentReply(args: LiveReplyArgs): Promise<LiveReplyResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/agent-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { say?: string; costUSD?: number; refused?: boolean };
    if (data.refused || !data.say || !data.say.trim()) return null;
    return { say: data.say.trim(), costUSD: data.costUSD ?? 0 };
  } catch {
    // Aborted (timeout) or network error.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
