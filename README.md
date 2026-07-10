# classroom-sim

An on-demand CSCL (Computer-Supported Collaborative Learning) classroom simulation. Five AI students — Vilma, Otto, Nea, Sami, Leo — collaboratively solve open-ended entrepreneurship/sales/marketing tasks assigned by a teacher agent, moving through Ideation → Evaluation → Synthesis, building the solution in a shared JSON workspace.

## 🎓 Live demo (Stage 3 — presentation UI)

**Try it here: https://w4nqs2psmy-spec.github.io/classroom-sim/**

This is a browser-based keynote/workshop tool built on top of the Stage 1 core below: pick a learning task from the task dock, watch the group's dynamics (participation, who addresses whom, conflict vs. convergence) visualize live, and jump into presentation mode.

**How to try it:**
- Pick a task from the **task library** in the picker (bottom toolbar), or open the presenter dock (`P`) and click/press `1`–`5`.
- Toggle **presentation mode** (`Present` button) for a projector-friendly view; `Esc` to exit.
- Use the **EN / FI** switch to change language — one flagship task ("Study the reading") is fully localized into Finnish; everything else falls back to English.
- Click **🙋 You** (or press `C` in presentation mode) to interrupt mid-discussion and address an agent directly.
- Click any agent's seat to see their private reasoning for the current turn.

**Known limitation in this public build:** the live version runs entirely client-side with no backend, so when you interrupt an agent it replies with a short in-character scripted line rather than a fresh AI-generated one (the real live-AI-reply feature needs a local dev server with an API key — see `ui/vite.config.ts`'s `agentReplyApiPlugin` if you want to run that part yourself). Everything else — task switching, the dynamics visualization, the one bundled real AI session, presentation mode, EN/FI — is fully live.

**Feedback:** please open a [GitHub Issue](../../issues) on this repo — screenshots and "I expected X, saw Y" are the most useful.

---

**Stage 1: text-only core.** Runs one full task per invocation, like a game session.

## Run

Requires Node ≥ 23.6 (runs TypeScript natively — no build step).

```sh
export ANTHROPIC_API_KEY=sk-ant-...
node src/loop.ts        # real session (~$0.10–0.20 per run)
node src/loop.ts --dry-run   # offline plumbing test, no API calls
```

## What happens in a session

1. The teacher generates an open-ended task (saved to `tasks/`).
2. The group discusses through three phases (6 + 5 + 4 turns by default; see `CONFIG` in `src/loop.ts`). Speakers are picked by persona-weighted random selection — Otto and Vilma talk a lot, Nea rarely.
3. Each turn the speaking agent returns what it says, its private reasoning, and (optionally) one contribution appended to the shared workspace (`workspace.json`).
4. The teacher evaluates the solution with the strong model — accept, or return with feedback for one revision round.
5. A cost summary is printed.

## Outputs

- `workspace.json` — the shared workspace, rewritten after every change (primary data output)
- `logs/session-*.jsonl` — one entry per turn: speaker, said, private reasoning, phase, workspace delta, model, token usage, cost
- `tasks/task-*.json` — generated tasks

## Cost control

- Routine turns (agents, task generation, phase transitions) → **claude-haiku-4-5**
- Teacher evaluation → **claude-opus-4-8**
- Routing table: `MODEL_FOR` in `src/model-routing.ts`
- The static world + persona description carries a prompt-cache breakpoint. Note: it is currently ~3,000 tokens, below Haiku 4.5's 4,096-token minimum cacheable prefix, so cache reads may show 0 until the world doc grows. The session cost summary prints `cacheRead` tokens so you can verify.

## Structure

```
characters/*.json   persona files (drive group dynamics + speaker weighting)
teacher.json        teacher persona + evaluation criteria
workspace.json      current shared workspace state
tasks/              generated tasks
logs/               JSONL session logs
src/loop.ts         entry point + turn loop + config
src/agent.ts        student agent turn (structured output)
src/teacher.ts      task generation, phase transitions, evaluation
src/prompts.ts      static world description (cached) + per-turn messages
src/model-routing.ts model routing, cost tracking, real/mock clients
src/workspace.ts    shared workspace operations + persistence
src/logger.ts       console rendering + JSONL logging
src/types.ts        shared types
ui/                 Stage 3 — the browser presentation UI (see live demo above)
```

Full Stage 3 architecture, locked design decisions, and known gotchas are documented in `CLAUDE.md`.

### Running Stage 3 locally

```sh
npm install
npm run ui        # http://localhost:5173, with the full live-AI-reply dev endpoint
```

Requires `ANTHROPIC_API_KEY` in a local `.env` file (never committed — see `.gitignore`) only if you want live AI replies to interruptions; everything else works without a key.
