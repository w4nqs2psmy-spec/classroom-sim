# Live session mode — implementation plan

**Status:** design only. Nothing built. This plan honours the two hard
invariants in `CLAUDE.md`: **Stage 1 (`src/`) stays frozen** (reuse, never edit)
and the **prompt-cache invariant** (the ≥4,096-token static world block is
byte-identical and cache-controlled on every call; only volatile content — task,
workspace, transcript — goes in the user message).

## 1. Goal

A presenter types a **free-text task** on stage; the same five agents (Vilma,
Otto, Nea, Sami, Leo) + teacher work it for **~23 rounds**, generated **live**
by Stage 1's turn logic, revealed turn-by-turn through the existing autoplay/
dynamics pipeline. This is the first true "zero API calls in the UI" exception —
scoped exactly like the existing live-interjection reply (`/api/agent-reply`):
**dev-server only, key stays server-side, degrades to a graceful no-op on the
static Pages build.**

## 2. Why this fits the existing architecture

- The UI already renders any `TurnView[]` through one path (`authoredTurns` →
  `mergeContributions` → `turns` → autoplay reveal → `computeDynamics` /
  `WorkspacePanel` / cost accounting). A live session is just **a fourth
  dataset source** feeding a *growing* `turns` array — alongside `scenario`,
  `task` (library), and `real session`.
- Generating one turn = `runAgentTurn(client, staticWorld, speaker, ctx)` —
  already exported from `src/agent.ts`, already used verbatim by Stage 1.
- The cached-prefix discipline we need is **exactly** the documented Stage-1
  injection contract in `ui/src/tasks.ts:8-13`: task/interaction addenda ride
  the *volatile user message*, never the cached world block. Live mode is the
  first thing to actually exercise that contract.
- `agentReplyApiPlugin` in `ui/vite.config.ts` is the proven template: lazily
  builds `staticWorld` + `characters` + `AnthropicModelClient` once, reuses
  `agentSystem(...)[0]` (the cached block), loads `.env` server-side, validates
  input, bounds output. The new endpoint is the same shape, extended from one
  reply to an orchestrated turn sequence.

## 3. Turn-generation model: server-owned session, one turn per request

The client **does not** stream a long-lived connection. It drives a lazy loop:
a `/api/live/start` returns an opaque `sessionId`; each `/api/live/next` returns
**one** fully-formed turn; the client appends it to the live `turns` array and
lets autoplay reveal it. A small **prefetch buffer** (generate 1–2 turns ahead
of the revealed index) keeps the stage from stalling on model latency, and the
presenter can pause/seek exactly as today.

Why server-owned session state (a `Map<sessionId, LiveSession>` in the plugin
closure, TTL-evicted, capped in count) rather than stateless:

- It lets the endpoint **reuse `src/workspace.ts` unchanged** (`createWorkspace`
  / `applyContribution` / `setPhase` / `workspaceJson`) for id assignment
  (`idea-3`, `synthesis-1`), phase validation, and the append-only workspace —
  the same semantics Stage 1 produces, for free.
- It keeps the **volatile/cached split identical to `loop.ts`**: `staticWorld`
  (cached) is built once; `workspaceJson` + `recentTranscript` (volatile) are
  rebuilt per turn from session state.
- Session state is **in-memory only** — the endpoint never writes `logs/` or
  `workspace.json` (unlike `loop.ts`) so the replay corpus stays clean and the
  disk surface of `sessionApiPlugin` is untouched.

Stateless alternative (client posts full transcript + reconstructed workspace
each call) is viable and lighter, but pushes workspace-id/phase logic into the
browser and diverges from Stage 1's semantics — **rejected for v1**, noted here.

### Orchestration = a thin, labelled mirror of `loop.ts`'s driver

The only Stage-1 logic that isn't already exported is the *driver*:
`pickSpeaker` (weighted-by-talkativeness, damped by turns-this-phase, never
twice in a row — `loop.ts:50-62`), the phase schedule, and `CONFIG`. Because
`src/` is frozen, the endpoint carries a **~15-line mirror** of `pickSpeaker` +
the phase schedule, clearly commented as a deliberate copy of the frozen driver
(the *agent core* — prompts, model routing, workspace, turn call — is reused,
not copied). The free task has no `InteractionProfile`, so `speakingWeights`
don't apply: pure persona baselines from `character.talkativeness`.

> Optional (needs explicit approval — it edits frozen `src/`): export
> `pickSpeaker` + `CONFIG` from `loop.ts` and import them instead of mirroring.
> Default recommendation: **mirror**, to keep the freeze intact.

## 4. Configurable round cap (default 23)

Server-side config in the plugin:

```
LIVE_CONFIG = {
  maxRounds: Number(process.env.LIVE_MAX_ROUNDS ?? 23),  // student turns
  bounds: { min: 8, max: 40 },                            // clamp per-request override
  // phase split scaled from Stage 1's 6/5/4 ratio to maxRounds, e.g.
  // 23 -> ideation 9, evaluation 8, synthesis 6
}
```

- `/api/live/start` accepts an optional `maxRounds` from the presenter's input,
  **clamped to `bounds`** to cap cost/latency; falls back to `LIVE_CONFIG`.
- The default **23** matches the ask; a session ends at the cap **or** when the
  teacher emits an accept verdict, whichever comes first.
- Teacher phase-boundary lines: reuse `teacher.ts phaseTransitionMessage`
  (authentic, but a Haiku call each) **or** a scripted opener per phase (zero
  cost/latency). Recommend the scripted opener for v1 to keep the stage snappy;
  note the real-teacher option as a toggle.
- **Cost guard:** ~23 Haiku agent turns with cache-read prefixes (~10% input
  cost after turn 1) land in the same ~$0.2–0.3 ballpark as one Stage-1 session.
  The endpoint tracks cumulative `costUSD` per session and refuses to exceed a
  hard ceiling.

## 5. Prompt-cache invariant — how it is preserved

Non-negotiable, and the whole reason this endpoint is safe:

1. Every live turn passes **the same** `buildStaticWorld(...)` output as its
   first system block, with `cache_control` — via `agentSystem(staticWorld,
   character)[0]`, exactly as `agentReplyApiPlugin` already does. Byte-identical
   across all 23 turns **and** identical to Stage 1 → shared cache entry.
2. The **free task text goes only into the volatile user message** (the
   `taskText` slot of `agentUserMessage`), never concatenated into `WORLD`.
   This is the documented contract in `tasks.ts:8-13` / `36-43`.
3. Turns fire seconds apart → within the 5-minute cache TTL → cache-read
   pricing on turns 2+. A pause >5 min lapses the cache (a re-write, benign).
4. **No source-document block in live v1** — adding one would alter the cached
   prefix. Keep it out; note as future (the append-only doc-block contract in
   `tasks.ts` already describes how to add it without breaking the invariant).

Verification hook: assert `cache_read_input_tokens > 0` on turn 2 of a live
session — direct proof the invariant held.

## 6. Files that change

**New — server (dev only):**
- `ui/vite.config.ts` → add `liveSessionApiPlugin()` next to
  `agentReplyApiPlugin()` and register it in `plugins`. Endpoints:
  `POST /api/live/start` `{ taskText, lang, maxRounds? }` → `{ sessionId, task }`;
  `POST /api/live/next` `{ sessionId }` → `{ turn, done, phase, costUSD }` or
  `{ done: true }`; `POST /api/live/end` `{ sessionId }`. Reuses
  `buildStaticWorld`, `agentSystem`, `runAgentTurn`, `workspace.ts` helpers,
  `AnthropicModelClient`, `.env` loading, and the `readBody`/`sendJson`/input-
  validation helpers already in the file. Mirrors `pickSpeaker` + phase
  schedule (§3). In-memory session `Map` with TTL + count cap.

**New — client:**
- `ui/src/liveSession.ts` (mirrors `liveReply.ts`): `startLiveSession`,
  `nextLiveTurn`, `endLiveSession`; each `fetch` wrapped with `AbortController`
  timeout and try/catch → returns `null` on any failure/404/refusal so the UI
  can degrade. Maps a server turn → `TurnView`: `costUSD` = measured number;
  **no `dialogueMove`** (so `dynamics.ts` classifies heuristically and renders it
  faded/estimated — the honest treatment for dynamic content; no schema change
  to `data.ts` needed).
- `ui/src/LiveTaskInput.tsx` (mirrors `ContributeInput.tsx`): free-text task
  prompt + optional round-cap field; submit dispatches the new command.

**Changed — client wiring:**
- `ui/src/commands.ts` → add `{ type: "START_LIVE"; taskText: string;
  maxRounds?: number }` to `SimCommand`, a `startLive` handler to
  `CommandHandlers`, and its `case` in `useCommandBus` (validate non-empty text,
  clamp `maxRounds`). Keeps the single-envelope contract; a future audience
  surface can propose tasks through the same channel.
- `ui/src/App.tsx`:
  - New source state: `liveTurns: TurnView[]`, `liveSessionId`, `liveTask`,
    `liveDone`, `liveLoading`, `liveError` (data-source selection, outside the
    reducer — same category as `activeSession`).
  - `authoredTurns = activeSession?.turns ?? liveTurns ?? resolvedLibraryTask?.turns ?? scenario.turns`;
    `taskInfo` gains the live branch.
  - `handleSelectDataset` gains a `live:` reset branch; the existing
    reset discipline (turnIndex via `START_TASK`, clear contributions/insights,
    re-arm cost ref) is reused, plus `endLiveSession` on switch-away and on
    `onStartTask`/`BACK_TO_DOWNTIME`.
  - **Generation driver effect:** in live mode, while not `liveDone` and the
    revealed index is within N of the buffer end, call `nextLiveTurn` and append.
    Stop on `done` (cap or verdict). Autoplay reveals as before; a `null` result
    surfaces `liveError` and stops the loop (no fabricated turns).
  - **Cost:** live turns carry measured `costUSD` (number) → the existing cost
    effect books them as **measured**, not estimated (correct — they are real
    API calls), and `null` would surface as unknown. No change to that effect.
  - Header badge: a `live` variant of `data-source-badge` (App header +
    `styles.css` + `i18n.ts`).
- `ui/src/Controls.tsx` (and `PresenterDock`/`PresentationBar` affordances): a
  "Propose a live task" entry/button that opens `LiveTaskInput`; a `c`/hotkey or
  dock action in presentation mode, consistent with the existing hotkey map.
- `ui/src/i18n.ts`: live badge, input labels, round-cap label, dev-only/error
  fallback lines (EN + FI, per the all-content-English rule with FI overlay).

**Docs (after build, not now):** add a Stage-3 bullet + a locked-decision note
to `CLAUDE.md` recording that live mode is the sanctioned dev-only exception to
"zero API calls in the UI," with the same static-host degradation as
`/api/agent-reply`.

## 7. Static-host degradation (Pages build)

Identical philosophy to `postAgentReply`: on the static build there is no dev
middleware, so `/api/live/*` 404s → `liveSession.ts` returns `null` → the UI
disables/hides the live entry and shows a "live mode is dev-only" note. The
scripted task library, scenarios, and curated real-session replay remain the
public experience. Verify via `vite preview` (serves `dist/` with no
middleware), exactly as the deploy checklist already requires.

## 8. Verification plan

- **Dry-run parity:** support a mock path (reuse `MockModelClient`, e.g. a
  `?dry` flag or `LIVE_DRY=1`) so the entire live loop — start → 23 turns →
  cap/verdict → end — runs offline with zero API calls, mirroring `--dry-run`.
- **Cache proof:** assert `cache_read_input_tokens > 0` on turn ≥2.
- **Cap:** session stops at exactly `maxRounds` student turns (or verdict),
  respects the clamp, honours a per-request override.
- **Phases progress** ideation → evaluation → synthesis; `computeDynamics`
  produces sane participation/transactivity within ~5 turns.
- **UI:** autoplay reveals live turns; pause/seek work; live turns book as
  **measured** cost; switching away or back-to-downtime calls `endLiveSession`.
- **Degradation:** `vite preview` build → live entry disabled, no console errors.
- Restart the Vite dev server before diagnosing any "bug" (the standing gotcha).

## 9. Open decisions for the user

1. **Teacher phase openers:** scripted (snappy, free) vs. reuse
   `phaseTransitionMessage` (authentic, +Haiku calls). Plan defaults to scripted.
2. **Driver reuse:** mirror `pickSpeaker`/`CONFIG` in the endpoint (no `src/`
   edit — default) vs. export them from frozen `loop.ts` (needs approval).
3. **Round-cap override in the UI:** expose the field to the presenter, or fix
   it at 23 and keep override env-only.
