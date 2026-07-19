// One-off (but reusable) converter: turns a real src/jigsaw/loop.ts session
// log into the ui/src/jigsawTask.ts TurnView[] dataset. Run once against the
// verified real run, hand-review the output, commit the result — the UI
// never parses JSONL at runtime (same "extract once, ship the committed
// text" principle as scripts/extract-doc.ts).
//
// dialogueMove/docRef are assigned from a hand-verified per-turn table below
// (not inferred), because this session's exact shape — which turn is the
// chapter "explain", which are the two follow-up Q/A pairs — was read
// directly off the log by a human, once, and is stable for this file only.

import { readFileSync, writeFileSync } from "node:fs";

const LOG_FILE = "logs/jigsaw-2026-07-19T14-56-24-481Z.jsonl";
const OUT_FILE = "ui/src/jigsawTask.ts";

type Move = "propose" | "build" | "challenge" | "integrate" | "facilitate" | "verdict";

interface LogRow {
  type: string;
  turn: number;
  phase: string | null;
  speaker: string | null;
  group: string | null;
  chapter: string | null;
  said: string | null;
  costUSD: number | null;
}

// turn -> { move?, docRef? }. Absent move = no dialogueMove (luku notes).
const TAGS: Record<number, { move?: Move; docRef?: string }> = {
  1: { move: "facilitate" },
  2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {},
  8: { move: "facilitate" },
  9: { move: "facilitate" },
  10: { move: "propose", docRef: "a" },
  11: { move: "challenge" },
  12: { move: "build" },
  13: { move: "challenge" },
  14: { move: "build" },
  15: { move: "facilitate" },
  16: { move: "propose", docRef: "a" },
  17: { move: "challenge" },
  18: { move: "build" },
  19: { move: "challenge" },
  20: { move: "build" },
  21: { move: "facilitate" },
  22: { move: "propose", docRef: "b" },
  23: { move: "challenge" },
  24: { move: "build" },
  25: { move: "challenge" },
  26: { move: "build" },
  27: { move: "facilitate" },
  28: { move: "propose", docRef: "b" },
  29: { move: "challenge" },
  30: { move: "build" },
  31: { move: "challenge" },
  32: { move: "build" },
  33: { move: "facilitate" },
  34: { move: "propose", docRef: "c" },
  35: { move: "challenge" },
  36: { move: "build" },
  37: { move: "challenge" },
  38: { move: "build" },
  39: { move: "facilitate" },
  40: { move: "propose", docRef: "c" },
  41: { move: "challenge" },
  42: { move: "build" },
  43: { move: "challenge" },
  44: { move: "build" },
  45: { move: "facilitate" },
  46: { move: "facilitate" },
  47: { move: "integrate" },
  48: { move: "facilitate" },
  49: { move: "integrate" },
  50: { move: "facilitate" },
  51: { move: "integrate" },
  52: { move: "facilitate" },
  53: { move: "integrate" },
  54: { move: "facilitate" },
  55: { move: "integrate" },
  56: { move: "facilitate" },
  57: { move: "integrate" },
  58: { move: "facilitate" },
};

function tsString(s: string): string {
  return JSON.stringify(s);
}

const lines = readFileSync(LOG_FILE, "utf-8").trim().split("\n");
const rows: LogRow[] = lines.map((l) => JSON.parse(l));

const out: string[] = [];
out.push(`// AUTHORED from a real, verified src/jigsaw/loop.ts session —`);
out.push(`// logs/jigsaw-2026-07-19T14-56-24-481Z.jsonl ($0.2396, 42 real API calls),`);
out.push(`// converted by scripts/convert-jigsaw-log.ts and hand-reviewed. Not`);
out.push(`// runtime-generated: the UI never calls the API (locked decision).`);
out.push(``);
out.push(`import type { TurnView } from "./data";`);
out.push(``);
out.push(`export const JIGSAW_TURNS: TurnView[] = [`);

for (const row of rows) {
  if (row.type !== "turn" && row.type !== "phase_transition") continue;
  const tag = TAGS[row.turn];
  if (!tag) throw new Error(`No tag for turn ${row.turn}`);
  const speaker = row.speaker === "Opettaja" ? "Teacher" : row.speaker;
  const said = (row.said ?? "").trim().replace(/\n{3,}/g, "\n\n");

  out.push(`  {`);
  out.push(`    speaker: ${tsString(speaker!)},`);
  out.push(`    phase: ${tsString(row.phase!)},`);
  if (row.group) out.push(`    group: ${tsString(row.group)},`);
  if (tag.move) out.push(`    dialogueMove: ${tsString(tag.move)},`);
  if (tag.docRef) out.push(`    docRef: ${tsString(tag.docRef)},`);
  out.push(`    said: ${tsString(said)},`);
  out.push(`    costUSD: ${row.costUSD === null ? "null" : row.costUSD},`);
  out.push(`  },`);
}

out.push(`];`);
out.push(``);

writeFileSync(OUT_FILE, out.join("\n"), "utf-8");
console.log(`Wrote ${OUT_FILE}`);
