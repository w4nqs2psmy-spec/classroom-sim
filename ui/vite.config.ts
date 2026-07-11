import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { runAgentTurn } from "../src/agent.ts";
import { AnthropicModelClient, MockModelClient, type ModelClient } from "../src/model-routing.ts";
import { agentSystem, buildStaticWorld } from "../src/prompts.ts";
import { applyContribution, createWorkspace, setPhase, workspaceJson } from "../src/workspace.ts";
import type { Character, ContributionKind, Phase, Task, TeacherProfile, Workspace } from "../src/types.ts";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(uiRoot, "..");
const logsDir = path.resolve(projectRoot, "logs");
const workspaceFile = path.resolve(projectRoot, "workspace.json");

// Session file names are the only browser-controlled input this middleware
// accepts; anything not matching this is rejected outright, and the resolved
// path is additionally checked to stay inside logsDir. Without both checks
// this read-only convenience endpoint would be an arbitrary-file-read
// primitive (e.g. a path to ../.env, which holds the real Anthropic key).
const SESSION_FILE_RE = /^session-[\w-]+\.jsonl$/;

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Dev-only, read-only bridge from Stage 1's on-disk session output
 * (classroom-sim/logs/*.jsonl, classroom-sim/workspace.json) to the Stage 3
 * UI. Strictly readFileSync/readdirSync over those two locations — never
 * imports model-routing.ts/agent.ts/teacher.ts/loop.ts, never reads
 * process.env, and never grows into a "run a session" endpoint.
 */
function sessionApiPlugin(): Plugin {
  return {
    name: "session-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();
        const url = new URL(req.url, "http://localhost");

        if (url.pathname === "/api/sessions") {
          if (!existsSync(logsDir)) return sendJson(res, 200, []);
          const files = readdirSync(logsDir)
            .filter((f) => SESSION_FILE_RE.test(f))
            .map((file) => {
              const full = path.join(logsDir, file);
              const stat = statSync(full);
              const raw = readFileSync(full, "utf8");
              const isComplete = raw
                .trimEnd()
                .split("\n")
                .some((line) => {
                  try {
                    return JSON.parse(line).type === "session_end";
                  } catch {
                    return false;
                  }
                });
              return { file, size: stat.size, mtime: stat.mtime.toISOString(), isComplete };
            })
            .sort((a, b) => b.mtime.localeCompare(a.mtime));
          return sendJson(res, 200, files);
        }

        const sessionMatch = url.pathname.match(/^\/api\/sessions\/(.+)$/);
        if (sessionMatch) {
          const file = decodeURIComponent(sessionMatch[1]);
          if (!SESSION_FILE_RE.test(file)) return sendJson(res, 400, { error: "invalid session file name" });
          const full = path.resolve(logsDir, file);
          if (!full.startsWith(logsDir + path.sep) || !existsSync(full)) {
            return sendJson(res, 404, { error: "not found" });
          }

          const raw = readFileSync(full, "utf8");
          const lines = raw.split("\n").filter((l) => l.trim().length > 0);
          const entries: unknown[] = [];
          let isComplete = false;
          for (let i = 0; i < lines.length; i++) {
            try {
              const entry = JSON.parse(lines[i]);
              entries.push(entry);
              if (entry.type === "session_end") isComplete = true;
            } catch {
              // Only the last line can legitimately be mid-write (loop.ts
              // appends synchronously, line by line); drop it silently. A
              // malformed line anywhere else means something is genuinely
              // wrong with the file.
              if (i !== lines.length - 1) {
                return sendJson(res, 500, { error: `malformed log line ${i} in ${file}` });
              }
            }
          }
          return sendJson(res, 200, { entries, isComplete });
        }

        if (url.pathname === "/api/workspace") {
          if (!existsSync(workspaceFile)) return sendJson(res, 404, { error: "no workspace.json" });
          res.setHeader("Content-Type", "application/json");
          res.end(readFileSync(workspaceFile, "utf8"));
          return;
        }

        next();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Live agent reply — the ONE endpoint that deliberately runs a model call.
//
// Unlike sessionApiPlugin above (read-only, never touches model/agent code or
// the key), this plugin exists specifically to let a human interjection get a
// real, in-character reply from one agent. It is dev-server-only (never in the
// production bundle), the API key stays server-side (loaded from ../.env and
// read only by the Anthropic SDK — never sent to the browser), and Stage 1's
// code (agentSystem/buildStaticWorld/AnthropicModelClient) is REUSED, not
// modified. Input is validated and the reply is bounded (Haiku, ~200 tokens).
// ---------------------------------------------------------------------------

const STUDENT_FILES: Record<string, string> = {
  Vilma: "vilma",
  Otto: "otto",
  Nea: "nea",
  Sami: "sami",
  Leo: "leo",
};
const MAX_HUMAN_TEXT = 800;
const MAX_TRANSCRIPT = 6000;

function replyDirective(lang: string, name: string): string {
  const base =
    `You are ${name}. Embody ${name} completely — personality, speaking style, and group behaviour as described above. ` +
    "A human participant in the room has just interjected mid-discussion and is speaking directly to you. " +
    "Reply to them out loud in 1-2 short spoken sentences, fully in character, reacting to what they actually said. " +
    "Output ONLY the words you say aloud — no private reasoning, no labels, no headings, no markdown, no JSON.";
  return lang === "fi" ? base + " TÄRKEÄÄ: vastaa tässä vuorossa kokonaan suomeksi." : base + " Reply in English.";
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > MAX_HUMAN_TEXT + MAX_TRANSCRIPT + 2000) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function agentReplyApiPlugin(): Plugin {
  // Built lazily on first request, then reused across calls.
  let staticWorld: string | null = null;
  let characters: Record<string, Character> | null = null;
  let client: AnthropicModelClient | null = null;

  const ensureReady = async () => {
    if (staticWorld && characters && client) return;
    const dotenv = await import("dotenv");
    dotenv.config({ path: path.resolve(projectRoot, ".env") });
    const load = <T,>(p: string) => JSON.parse(readFileSync(path.resolve(projectRoot, p), "utf8")) as T;
    const ordered = ["vilma", "otto", "nea", "sami", "leo"].map((n) => load<Character>(`characters/${n}.json`));
    const teacher = load<TeacherProfile>("teacher.json");
    staticWorld = buildStaticWorld(ordered, teacher);
    characters = Object.fromEntries(ordered.map((c) => [c.name, c]));
    client = new AnthropicModelClient();
  };

  return {
    name: "agent-reply-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/agent-reply") return next();
        (async () => {
          try {
            const body = JSON.parse(await readBody(req)) as {
              agentName?: string;
              humanText?: string;
              transcript?: string;
              taskText?: string;
              lang?: string;
            };
            const agentName = body.agentName ?? "";
            const humanText = (body.humanText ?? "").trim();
            if (!STUDENT_FILES[agentName]) return sendJson(res, 400, { error: "unknown agent" });
            if (!humanText) return sendJson(res, 400, { error: "empty humanText" });
            if (humanText.length > MAX_HUMAN_TEXT) return sendJson(res, 400, { error: "humanText too long" });

            await ensureReady();
            const character = characters![agentName];
            const lang = body.lang === "fi" ? "fi" : "en";
            // Reuse only the cached static-world block (persona detail lives
            // there); replace agentSystem's second block, which would tell the
            // model to also emit private reasoning + a workspace entry.
            const worldBlock = agentSystem(staticWorld!, character)[0];
            const system = [worldBlock, { type: "text" as const, text: replyDirective(lang, character.name) }];
            const userMessage = [
              `THE TASK:\n${(body.taskText ?? "").slice(0, 1000)}`,
              ``,
              `RECENT DISCUSSION:\n${(body.transcript ?? "").slice(0, MAX_TRANSCRIPT)}`,
              ``,
              `The human just said, directly to you (${character.name}):\n"${humanText}"`,
              ``,
              `Reply to them now, ${character.name}.`,
            ].join("\n");

            let result: { text: string; costUSD: number; refused?: boolean };
            try {
              const r = await client!.call({ kind: "agent_turn", system, userMessage, maxTokens: 200 });
              result = { text: r.text, costUSD: r.costUSD };
            } catch (err) {
              // Refusal (the SDK client throws on stop_reason "refusal") or any
              // model error → let the client fall back to a scripted line.
              return sendJson(res, 200, { refused: true, reason: (err as Error).message });
            }
            return sendJson(res, 200, { say: result.text.trim(), costUSD: result.costUSD });
          } catch (err) {
            return sendJson(res, 500, { error: (err as Error).message });
          }
        })();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Live session — the SECOND endpoint that deliberately runs model calls.
//
// A presenter proposes a free-text task and the five agents work it live for a
// bounded number of rounds, ONE turn per /api/live/next request (the client
// drives the loop and reveals turns as they arrive). Like agentReplyApiPlugin
// this is dev-server-only (never in the production bundle), keeps the API key
// server-side (../.env, read only by the Anthropic SDK — never sent to the
// browser), and REUSES Stage 1's frozen agent core: buildStaticWorld/
// agentSystem (via runAgentTurn) and workspace.ts, unmodified.
//
// The ONLY Stage-1 logic copied here is the loop DRIVER — speaker selection and
// the phase schedule — which src/loop.ts keeps module-private. It is mirrored
// below deliberately (decision: mirror, do not edit frozen src/).
//
// Cache invariant: every turn's first system block is the same cache-controlled
// staticWorld (byte-identical to Stage 1, built once via buildStaticWorld). The
// free task text rides ONLY the volatile user message (runAgentTurn's
// ctx.taskText) — never the cached world block — which is exactly the injection
// contract documented in ui/src/tasks.ts. Session state is in-memory only: this
// endpoint never writes logs/ or workspace.json.
// ---------------------------------------------------------------------------

const LIVE_DEFAULT_ROUNDS = Number(process.env.LIVE_MAX_ROUNDS ?? 23);
const LIVE_ROUND_BOUNDS = { min: 8, max: 40 };
const MAX_TASK_TEXT = 2000;
const LIVE_TRANSCRIPT_WINDOW = 12; // mirror of src/loop.ts CONFIG.transcriptWindow
const LIVE_SESSION_TTL_MS = 30 * 60_000;
const LIVE_MAX_SESSIONS = 20;
const LIVE_COST_CEILING_USD = 1.0; // hard stop, well above a ~$0.2-0.3 run

// Phase turn counts scaled from Stage 1's 6/5/4 ratio to the round cap
// (23 -> ideation 9, evaluation 8, synthesis 6). Remainder lands on synthesis.
const STAGE_RATIO: Array<{ phase: Phase; weight: number }> = [
  { phase: "ideation", weight: 6 },
  { phase: "evaluation", weight: 5 },
  { phase: "synthesis", weight: 4 },
];

function phaseSchedule(maxRounds: number): Array<{ phase: Phase; turns: number }> {
  const totalWeight = STAGE_RATIO.reduce((a, s) => a + s.weight, 0);
  const first = Math.max(1, Math.round((STAGE_RATIO[0].weight / totalWeight) * maxRounds));
  const second = Math.max(1, Math.round((STAGE_RATIO[1].weight / totalWeight) * maxRounds));
  const third = Math.max(1, maxRounds - first - second);
  return [
    { phase: "ideation", turns: first },
    { phase: "evaluation", turns: second },
    { phase: "synthesis", turns: third },
  ];
}

const LIVE_LIST_FOR: Record<Exclude<ContributionKind, "none">, "ideas" | "evaluations" | "synthesis"> = {
  idea: "ideas",
  evaluation: "evaluations",
  synthesis: "synthesis",
};

// Scripted teacher phase openers (decision: scripted, not a model call — keeps
// the stage snappy and cost bounded). Phase 0 also announces the free task.
function teacherOpener(phaseIndex: number, taskText: string): string {
  if (phaseIndex === 0)
    return `New task: ${taskText.slice(0, 280)} Ideation starts now — quantity over polish, build on each other's ideas, and hold the criticism for the next phase.`;
  if (phaseIndex === 1)
    return "Good spread of ideas — closing Ideation. Evaluation begins now: stress-test what's in the workspace, reference ideas by id, and surface every serious flaw today, not after launch.";
  return "Evaluation's done its job. Synthesis now — converge on ONE concrete solution to the deliverable, and make sure the criticisms are answered inside the plan, not around it.";
}

function deriveTitle(taskText: string): string {
  const firstLine = taskText.split("\n")[0].trim();
  return firstLine.length > 70 ? firstLine.slice(0, 67).trimEnd() + "…" : firstLine || "Live task";
}

const LIVE_DELIVERABLE = "One concrete, workable solution the whole group agrees on and can defend.";

interface LiveSession {
  id: string;
  dry: boolean;
  lang: "en" | "fi";
  taskPrompt: string; // free text + deliverable line — the agents' volatile task text
  taskTitle: string;
  ws: Workspace;
  transcript: Array<{ speaker: string; text: string }>;
  schedule: Array<{ phase: Phase; turns: number }>;
  phaseIndex: number;
  openerEmitted: boolean;
  turnInPhase: number;
  spokenThisPhase: Map<string, number>;
  lastSpeaker: string | null;
  globalTurn: number;
  costUSD: number;
  done: boolean;
  lastAccess: number;
}

// Mirror of src/loop.ts pickSpeaker (module-private there): weighted by
// talkativeness, damped by turns already taken this phase, never twice in a row.
function pickLiveSpeaker(
  characters: Character[],
  lastSpeaker: string | null,
  spokenThisPhase: Map<string, number>,
): Character {
  const candidates = characters.filter((c) => c.name !== lastSpeaker);
  const weights = candidates.map((c) => c.talkativeness / (1 + (spokenThisPhase.get(c.name) ?? 0)));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Mirror of src/loop.ts mockAgentReply — offline content for the dry path.
function mockLiveReply(name: string, phase: Phase): string {
  const kind = phase === "ideation" ? "idea" : phase === "evaluation" ? "evaluation" : "synthesis";
  return JSON.stringify({
    say: `[dry-run] ${name} says something in the ${phase} phase.`,
    reasoning: `[dry-run] ${name}'s private reasoning.`,
    workspaceContribution: { kind, content: `[dry-run] A ${kind} contribution from ${name}.` },
  });
}

function liveSessionApiPlugin(): Plugin {
  // Built lazily on first request, then reused across calls (staticWorld is the
  // cached prefix — identical bytes every turn).
  let staticWorld: string | null = null;
  let ordered: Character[] | null = null;
  let realClient: AnthropicModelClient | null = null;
  const mockClient = new MockModelClient();
  const sessions = new Map<string, LiveSession>();

  const ensureWorld = async () => {
    if (staticWorld && ordered) return;
    const dotenv = await import("dotenv");
    dotenv.config({ path: path.resolve(projectRoot, ".env") });
    const load = <T,>(p: string) => JSON.parse(readFileSync(path.resolve(projectRoot, p), "utf8")) as T;
    ordered = ["vilma", "otto", "nea", "sami", "leo"].map((n) => load<Character>(`characters/${n}.json`));
    const teacher = load<TeacherProfile>("teacher.json");
    staticWorld = buildStaticWorld(ordered, teacher);
  };

  // Only constructed for a real (non-dry) session — the Anthropic SDK throws if
  // no key is present, so the dry path must never reach this.
  const getRealClient = (): AnthropicModelClient => (realClient ??= new AnthropicModelClient());

  const evictStale = () => {
    const now = Date.now();
    for (const [id, s] of sessions) if (now - s.lastAccess > LIVE_SESSION_TTL_MS) sessions.delete(id);
  };

  const recentTranscript = (s: LiveSession): string => {
    const lines = s.transcript.slice(-LIVE_TRANSCRIPT_WINDOW);
    if (lines.length === 0) return "(the discussion has not started yet)";
    return lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  };

  // Emit the next turn for a session (mutates state). Returns null at the end.
  const advance = async (s: LiveSession): Promise<Record<string, unknown> | null> => {
    if (s.done) return null;
    if (s.costUSD >= LIVE_COST_CEILING_USD) {
      s.done = true;
      return null;
    }

    // Scripted teacher opener — emitted once at the start of each phase.
    if (!s.openerEmitted) {
      s.openerEmitted = true;
      const phase = s.schedule[s.phaseIndex].phase;
      setPhase(s.ws, phase);
      const said = teacherOpener(s.phaseIndex, s.taskPrompt);
      s.transcript.push({ speaker: "Teacher", text: said });
      return { speaker: "Teacher", phase, said, costUSD: 0 };
    }

    // Current phase exhausted → advance; the next call emits the new opener.
    if (s.turnInPhase >= s.schedule[s.phaseIndex].turns) {
      s.phaseIndex++;
      if (s.phaseIndex >= s.schedule.length) {
        s.done = true;
        return null;
      }
      s.openerEmitted = false;
      s.turnInPhase = 0;
      s.spokenThisPhase = new Map();
      s.lastSpeaker = null;
      return advance(s);
    }

    // Student turn — Stage 1's runAgentTurn, unmodified.
    const phase = s.schedule[s.phaseIndex].phase;
    const speaker = pickLiveSpeaker(ordered!, s.lastSpeaker, s.spokenThisPhase);
    s.lastSpeaker = speaker.name;
    s.spokenThisPhase.set(speaker.name, (s.spokenThisPhase.get(speaker.name) ?? 0) + 1);
    s.turnInPhase++;
    s.globalTurn++;

    const client: ModelClient = s.dry ? mockClient : getRealClient();
    const { reply, costUSD } = await runAgentTurn(client, staticWorld!, speaker, {
      phase,
      phaseTurn: s.turnInPhase,
      phaseTurns: s.schedule[s.phaseIndex].turns,
      taskText: s.taskPrompt,
      workspaceJson: workspaceJson(s.ws),
      transcript: recentTranscript(s),
      mockResponse: s.dry ? mockLiveReply(speaker.name, phase) : undefined,
    });
    s.costUSD += costUSD;
    s.transcript.push({ speaker: speaker.name, text: reply.say });

    const kind = reply.workspaceContribution.kind;
    const entry = applyContribution(s.ws, speaker.name, kind, reply.workspaceContribution.content, s.globalTurn);
    const workspaceEntry = entry
      ? { list: LIVE_LIST_FOR[kind as Exclude<ContributionKind, "none">], id: entry.id, author: entry.author, content: entry.content }
      : undefined;

    return { speaker: speaker.name, phase, said: reply.say, reasoning: reply.reasoning, workspaceEntry, costUSD };
  };

  return {
    name: "live-session-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || !req.url || !req.url.startsWith("/api/live/")) return next();
        (async () => {
          try {
            const url = new URL(req.url!, "http://localhost");
            const body = JSON.parse((await readBody(req)) || "{}") as {
              taskText?: string;
              lang?: string;
              maxRounds?: number;
              sessionId?: string;
              dry?: boolean;
            };

            if (url.pathname === "/api/live/start") {
              const taskText = (body.taskText ?? "").trim();
              if (!taskText) return sendJson(res, 400, { error: "empty taskText" });
              if (taskText.length > MAX_TASK_TEXT) return sendJson(res, 400, { error: "taskText too long" });

              await ensureWorld();
              evictStale();
              if (sessions.size >= LIVE_MAX_SESSIONS) {
                const oldest = [...sessions.values()].sort((a, b) => a.lastAccess - b.lastAccess)[0];
                if (oldest) sessions.delete(oldest.id);
              }

              const dry = body.dry === true || process.env.LIVE_DRY === "1";
              const maxRounds = Math.min(
                LIVE_ROUND_BOUNDS.max,
                Math.max(LIVE_ROUND_BOUNDS.min, Math.round(Number(body.maxRounds ?? LIVE_DEFAULT_ROUNDS))),
              );
              const lang = body.lang === "fi" ? "fi" : "en";
              const title = deriveTitle(taskText);
              const task: Task = {
                id: `live-${Date.now()}`,
                title,
                description: taskText,
                deliverable: LIVE_DELIVERABLE,
                themes: [],
                createdAt: new Date().toISOString(),
              };
              const id = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
              sessions.set(id, {
                id,
                dry,
                lang,
                taskPrompt: `${taskText}\nDeliverable: ${LIVE_DELIVERABLE}`,
                taskTitle: title,
                ws: createWorkspace(task),
                transcript: [],
                schedule: phaseSchedule(maxRounds),
                phaseIndex: 0,
                openerEmitted: false,
                turnInPhase: 0,
                spokenThisPhase: new Map(),
                lastSpeaker: null,
                globalTurn: 0,
                costUSD: 0,
                done: false,
                lastAccess: Date.now(),
              });
              return sendJson(res, 200, { sessionId: id, task: { title, deliverable: LIVE_DELIVERABLE }, maxRounds, dry });
            }

            if (url.pathname === "/api/live/next") {
              const s = body.sessionId ? sessions.get(body.sessionId) : undefined;
              if (!s) return sendJson(res, 404, { error: "unknown session" });
              s.lastAccess = Date.now();
              const turn = await advance(s);
              if (!turn) return sendJson(res, 200, { done: true, costUSD: s.costUSD });
              return sendJson(res, 200, { turn, done: s.done, phase: turn.phase, costUSD: s.costUSD });
            }

            if (url.pathname === "/api/live/end") {
              if (body.sessionId) sessions.delete(body.sessionId);
              return sendJson(res, 200, { ok: true });
            }

            return sendJson(res, 404, { error: "unknown live endpoint" });
          } catch (err) {
            return sendJson(res, 500, { error: (err as Error).message });
          }
        })();
      });
    },
  };
}

export default defineConfig({
  root: uiRoot,
  // Relative asset paths so the build works from a GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) as well as from "/" in dev.
  base: "./",
  plugins: [react(), sessionApiPlugin(), agentReplyApiPlugin(), liveSessionApiPlugin()],
  server: { port: 5173, strictPort: true },
});
