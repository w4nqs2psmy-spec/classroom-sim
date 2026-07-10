import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Phase, Usage } from "./types.ts";

const COLORS: Record<string, string> = {
  Teacher: "\x1b[35m", // magenta
  Vilma: "\x1b[33m", // yellow
  Otto: "\x1b[31m", // red
  Nea: "\x1b[36m", // cyan
  Sami: "\x1b[32m", // green
  Leo: "\x1b[34m", // blue
};
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

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
  usage: Usage | null;
  costUSD: number | null;
}

export class SessionLogger {
  private file: string;

  constructor() {
    const logsDir = fileURLToPath(new URL("../logs", import.meta.url));
    mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.file = `${logsDir}/session-${stamp}.jsonl`;
    console.log(`${DIM}Logging to ${this.file}${RESET}\n`);
  }

  log(entry: LogEntry): void {
    appendFileSync(this.file, JSON.stringify(entry) + "\n");

    const color = COLORS[entry.speaker] ?? "";
    const cost = entry.costUSD != null ? ` ${DIM}(~$${entry.costUSD.toFixed(4)})${RESET}` : "";
    const phase = entry.phase ? `${DIM}[${entry.phase.toUpperCase()} t${entry.turn}]${RESET} ` : "";

    console.log(`${phase}${color}${BOLD}${entry.speaker}:${RESET} ${entry.said}${cost}`);
    if (entry.reasoning) {
      console.log(`${DIM}   └─ thinking: ${entry.reasoning}${RESET}`);
    }
    if (entry.workspaceChanged && entry.workspaceDelta) {
      const d = entry.workspaceDelta as { id?: string; content?: string };
      console.log(`${DIM}   └─ workspace += [${d.id}] ${d.content}${RESET}`);
    }
    console.log("");
  }

  banner(text: string): void {
    console.log(`${BOLD}${"═".repeat(70)}${RESET}`);
    console.log(`${BOLD}${text}${RESET}`);
    console.log(`${BOLD}${"═".repeat(70)}${RESET}\n`);
  }
}
