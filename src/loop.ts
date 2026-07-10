import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runAgentTurn } from "./agent.ts";
import { SessionLogger } from "./logger.ts";
import {
  AnthropicModelClient,
  MockModelClient,
  type ModelClient,
} from "./model-routing.ts";
import { buildStaticWorld } from "./prompts.ts";
import { evaluateSolution, generateTask, phaseTransitionMessage } from "./teacher.ts";
import type { Character, Phase, Task, TeacherProfile, TranscriptLine, Workspace } from "./types.ts";
import { applyContribution, createWorkspace, saveWorkspace, setPhase, workspaceJson } from "./workspace.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG = {
  turnsPerPhase: { ideation: 6, evaluation: 5, synthesis: 4 } as Record<Phase, number>,
  revisionTurns: 3, // extra synthesis turns after a "revise" verdict
  maxEvaluations: 2, // teacher evaluates at most this many times per task
  transcriptWindow: 12, // how many recent lines each agent sees
};

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const root = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));

const CHARACTER_ORDER = ["vilma", "otto", "nea", "sami", "leo"];
const characters: Character[] = CHARACTER_ORDER.map(
  (n) => JSON.parse(readFileSync(root(`characters/${n}.json`), "utf8")) as Character,
);
const teacherProfile = JSON.parse(readFileSync(root("teacher.json"), "utf8")) as TeacherProfile;
const staticWorld = buildStaticWorld(characters, teacherProfile);

const client: ModelClient = DRY_RUN ? new MockModelClient() : new AnthropicModelClient();
const logger = new SessionLogger();

// ---------------------------------------------------------------------------
// Speaker selection: weighted by talkativeness, damped by how much the
// character has already spoken this phase, never the same speaker twice in a row.
// ---------------------------------------------------------------------------

function pickSpeaker(lastSpeaker: string | null, spokenThisPhase: Map<string, number>): Character {
  const candidates = characters.filter((c) => c.name !== lastSpeaker);
  const weights = candidates.map(
    (c) => c.talkativeness / (1 + (spokenThisPhase.get(c.name) ?? 0)),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ---------------------------------------------------------------------------
// Dry-run mock content
// ---------------------------------------------------------------------------

function mockAgentReply(name: string, phase: Phase): string {
  const kind = phase === "ideation" ? "idea" : phase === "evaluation" ? "evaluation" : "synthesis";
  return JSON.stringify({
    say: `[dry-run] ${name} says something in the ${phase} phase.`,
    reasoning: `[dry-run] ${name}'s private reasoning.`,
    workspaceContribution: { kind, content: `[dry-run] A ${kind} contribution from ${name}.` },
  });
}

const MOCK_TASK = JSON.stringify({
  title: "Dry-Run Coffee Cart",
  description:
    "A dry-run task: the campus coffee cart is losing customers to a vending machine. Turn it around.",
  deliverable: "A one-page turnaround marketing plan.",
  themes: ["marketing", "entrepreneurship"],
});

const MOCK_EVALUATION = JSON.stringify({
  verdict: "accepted",
  score: 8,
  feedback: "[dry-run] Solid work; the plan is concrete and criticisms were addressed.",
});

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

const transcript: TranscriptLine[] = [];
let globalTurn = 0;

function recentTranscript(): string {
  const lines = transcript.slice(-CONFIG.transcriptWindow);
  if (lines.length === 0) return "(the discussion has not started yet)";
  return lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
}

function taskText(task: Task): string {
  return `"${task.title}" — ${task.description}\nDeliverable: ${task.deliverable}`;
}

function logTeacher(
  type: "task_assigned" | "phase_transition" | "teacher_evaluation",
  said: string,
  ws: Workspace | null,
  extra: { model?: string; costUSD?: number; delta?: unknown } = {},
): void {
  transcript.push({ speaker: "Teacher", text: said });
  logger.log({
    type,
    timestamp: new Date().toISOString(),
    turn: globalTurn,
    phase: ws?.phase ?? null,
    speaker: "Teacher",
    said,
    reasoning: null,
    workspaceChanged: Boolean(extra.delta),
    workspaceDelta: extra.delta ?? null,
    model: extra.model ?? null,
    usage: null,
    costUSD: extra.costUSD ?? null,
  });
}

// ---------------------------------------------------------------------------
// Phase runner
// ---------------------------------------------------------------------------

async function runPhaseTurns(ws: Workspace, task: Task, turns: number): Promise<void> {
  const spokenThisPhase = new Map<string, number>();
  let lastSpeaker: string | null = null;

  for (let t = 1; t <= turns; t++) {
    globalTurn++;
    const speaker = pickSpeaker(lastSpeaker, spokenThisPhase);
    lastSpeaker = speaker.name;
    spokenThisPhase.set(speaker.name, (spokenThisPhase.get(speaker.name) ?? 0) + 1);

    const { reply, model, usage, costUSD } = await runAgentTurn(client, staticWorld, speaker, {
      phase: ws.phase,
      phaseTurn: t,
      phaseTurns: turns,
      taskText: taskText(task),
      workspaceJson: workspaceJson(ws),
      transcript: recentTranscript(),
      mockResponse: DRY_RUN ? mockAgentReply(speaker.name, ws.phase) : undefined,
    });

    const entry = applyContribution(
      ws,
      speaker.name,
      reply.workspaceContribution.kind,
      reply.workspaceContribution.content,
      globalTurn,
    );
    if (entry) saveWorkspace(ws);

    transcript.push({ speaker: speaker.name, text: reply.say });
    logger.log({
      type: "turn",
      timestamp: new Date().toISOString(),
      turn: globalTurn,
      phase: ws.phase,
      speaker: speaker.name,
      said: reply.say,
      reasoning: reply.reasoning,
      workspaceChanged: entry !== null,
      workspaceDelta: entry,
      model,
      usage,
      costUSD,
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.banner(
    `CSCL CLASSROOM SIMULATION${DRY_RUN ? " — DRY RUN (no API calls)" : ""}`,
  );

  // 1. Teacher assigns a task
  const { task, costUSD: taskCost, model: taskModel } = await generateTask(
    client,
    staticWorld,
    DRY_RUN ? MOCK_TASK : undefined,
  );
  mkdirSync(root("tasks"), { recursive: true });
  writeFileSync(root(`tasks/${task.id}.json`), JSON.stringify(task, null, 2) + "\n");

  const ws = createWorkspace(task);
  saveWorkspace(ws);
  logTeacher(
    "task_assigned",
    `New task: ${task.title}. ${task.description} Your deliverable: ${task.deliverable}`,
    ws,
    { model: taskModel, costUSD: taskCost },
  );

  // 2. Three phases
  const phases: Phase[] = ["ideation", "evaluation", "synthesis"];
  let previous: Phase | null = null;
  for (const phase of phases) {
    setPhase(ws, phase);
    saveWorkspace(ws);
    const { text, costUSD, model } = await phaseTransitionMessage(client, staticWorld, {
      from: previous,
      to: phase,
      workspaceJson: workspaceJson(ws),
      mockResponse: DRY_RUN ? `[dry-run] Teacher opens the ${phase} phase.` : undefined,
    });
    logTeacher("phase_transition", text, ws, { model, costUSD });
    await runPhaseTurns(ws, task, CONFIG.turnsPerPhase[phase]);
    previous = phase;
  }

  // 3. Teacher evaluation (strong model), with one revision round if needed
  for (let round = 1; round <= CONFIG.maxEvaluations; round++) {
    const { evaluation, costUSD, model } = await evaluateSolution(client, staticWorld, {
      taskText: taskText(task),
      workspaceJson: workspaceJson(ws),
      mockResponse: DRY_RUN ? MOCK_EVALUATION : undefined,
    });

    const accepted = evaluation.verdict === "accepted" || round === CONFIG.maxEvaluations;
    logTeacher(
      "teacher_evaluation",
      `Verdict: ${evaluation.verdict.toUpperCase()} (score ${evaluation.score}/10). ${evaluation.feedback}` +
        (accepted && evaluation.verdict === "revise"
          ? " (Accepted with reservations — revision limit reached.)"
          : ""),
      ws,
      { model, costUSD },
    );

    if (accepted) {
      ws.status = "accepted";
      saveWorkspace(ws);
      break;
    }

    // Returned for revision: feedback goes into the workspace, group revises the synthesis.
    ws.teacherFeedback.push(evaluation.feedback);
    saveWorkspace(ws);
    await runPhaseTurns(ws, task, CONFIG.revisionTurns);
  }

  // 4. Wrap up
  logger.banner("SESSION COMPLETE");
  console.log(`Task:      ${task.title}`);
  console.log(`Workspace: ${ws.ideas.length} ideas, ${ws.evaluations.length} evaluations, ${ws.synthesis.length} synthesis entries`);
  console.log(`Status:    ${ws.status}\n`);
  console.log(client.costs.summary());

  logger.log({
    type: "session_end",
    timestamp: new Date().toISOString(),
    turn: globalTurn,
    phase: ws.phase,
    speaker: "system",
    said: `Session complete. Status: ${ws.status}. Total estimated cost: $${client.costs.total().toFixed(4)}`,
    reasoning: null,
    workspaceChanged: false,
    workspaceDelta: null,
    model: null,
    usage: null,
    costUSD: client.costs.total(),
  });
}

main().catch((err) => {
  console.error("\nSimulation failed:", err instanceof Error ? err.message : err);
  if (!process.env.ANTHROPIC_API_KEY && !DRY_RUN) {
    console.error(
      "\nHint: no ANTHROPIC_API_KEY is set. Export one, or test the loop offline with:\n  node src/loop.ts --dry-run",
    );
  }
  process.exit(1);
});
