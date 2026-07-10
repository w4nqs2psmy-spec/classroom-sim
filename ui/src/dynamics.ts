// Pedagogical dynamics layer — pure derivation, no state, no DOM.
//
// Everything here is a pure function of the visible turn prefix
// (turns.slice(0, turnIndex + 1)), the same pattern App.tsx already uses
// for workspaceEntries/status. That single decision keeps the layer in
// perfect sync with autoplay, manual stepping, click-to-seek, and dataset
// switching for free, and honors the store.tsx lesson: derive per render,
// never round-trip through dispatch+effect.
//
// Classification honesty: turns with an explicit hand-authored
// `dialogueMove` (all scripted content) are exact. Everything else — the
// addressee fallback and the text-cue move classifier — is DEMO-GRADE
// heuristics for unscripted session logs, and the UI styles inferred
// results differently (faint arcs, untagged ticks) so estimation is never
// dressed up as ground truth.

import { STUDENTS, type Move, type Phase, type TurnView } from "./data";

export interface ParticipationStat {
  name: string;
  turns: number;
  words: number;
  turnShare: number; // 0..1 of all student turns in the prefix
  wordShare: number; // 0..1 of all student words in the prefix
  docCites: number; // turns where this student cited the source document
}

export interface InteractionEdge {
  from: string;
  to: string;
  weight: number; // total attributions from -> to
  explicitCount: number; // of which were explicit name mentions
}

export interface TimelineTick {
  index: number; // index into the turns array (for click-to-seek)
  speaker: string;
  phase: Phase;
  move: Move;
  tagged: boolean; // true = hand-authored dialogueMove, false = heuristic
  docRef?: string; // hand-authored source-document citation (presence = this turn engages the doc)
}

export interface CurrentAttribution {
  from: string;
  to: string[];
  explicit: boolean;
}

export type InsightId =
  | "free-rider"
  | "conflict"
  | "convergence"
  | "silos"
  | "false-consensus"
  | "source-ignored"
  | "shared-understanding";

// Insights carry only an id + structured params; the human-readable label
// and detail are formatted in the UI layer (i18n.ts) per language. This
// keeps dynamics.ts language-free.
export interface InsightParams {
  name?: string;
  turns?: number;
  total?: number;
  pct?: number;
  runLength?: number;
  windowSize?: number;
  docTurns?: number;
}

export interface Insight {
  id: InsightId;
  params: InsightParams;
}

export interface DynamicsSnapshot {
  participation: ParticipationStat[]; // all five students, seat order, always present
  totalStudentTurns: number;
  edges: InteractionEdge[];
  current: CurrentAttribution | null; // the latest turn's arcs, for the flash
  timeline: TimelineTick[];
  insights: Insight[];
}

// Peer roster — the set of participants whose turns count as peer
// interaction (participation bars, arcs). Defaults to the five students; a
// live human participant ("You") is appended only when they have joined, so
// scripted tasks with the default roster are unaffected.
interface RosterContext {
  set: Set<string>;
  nameRe: Record<string, RegExp>;
  names: readonly string[];
}

// Names are distinctive tokens with no substring collisions, and \b treats
// the possessive apostrophe as a boundary, so "Nea's" matches.
function makeRosterContext(names: readonly string[]): RosterContext {
  return {
    set: new Set<string>(names),
    nameRe: Object.fromEntries(names.map((n) => [n, new RegExp(`\\b${n}\\b`)])),
    names,
  };
}

const DEFAULT_ROSTER = makeRosterContext(STUDENTS);

/**
 * Who is this turn addressed to? Explicit name mentions win (high
 * precision — the Stage 1 dialogue style deliberately has agents address
 * each other by name). With no mention, fall back to the previous peer
 * speaker (conversation-analysis adjacency-pair assumption) — honest but
 * approximate, which the UI renders as a fainter arc.
 */
export function extractAddressees(
  turn: TurnView,
  prevStudentSpeaker: string | null,
  ctx: RosterContext = DEFAULT_ROSTER,
): CurrentAttribution | null {
  if (!ctx.set.has(turn.speaker)) return null; // arcs are peer interaction only

  const mentioned = ctx.names.filter((n) => n !== turn.speaker && ctx.nameRe[n].test(turn.said));
  if (mentioned.length > 0) return { from: turn.speaker, to: mentioned, explicit: true };

  if (prevStudentSpeaker && prevStudentSpeaker !== turn.speaker) {
    return { from: turn.speaker, to: [prevStudentSpeaker], explicit: false };
  }
  return null;
}

const CHALLENGE_CUES = /^(but\b|yeah,? but|okay,? but|ok,? but|wait\b|hold on|hmm\b|who\b|why\b|how do we|has anyone|i still don't|i'm not convinced|i don't buy)/i;
const BUILD_CUES = /^(yeah\b|yes\b|exactly|right\b|okay,? so|ok,? so|good point|i love|i think you|building on|so let's|totally)/i;

/** Move classification. Priority: explicit tag > structural signals > text cues. */
export function classifyMove(turn: TurnView): { move: Move; tagged: boolean } {
  if (turn.dialogueMove) return { move: turn.dialogueMove, tagged: true };

  if (turn.isVerdict) return { move: "verdict", tagged: false };
  if (turn.speaker === "Teacher") return { move: "facilitate", tagged: false };

  if (turn.workspaceEntry) {
    switch (turn.workspaceEntry.list) {
      case "ideas":
        return { move: "propose", tagged: false };
      case "evaluations":
        return { move: "challenge", tagged: false };
      case "synthesis":
        return { move: "integrate", tagged: false };
    }
  }

  const said = turn.said.trim();
  const questionCount = (said.match(/\?/g) ?? []).length;
  if (CHALLENGE_CUES.test(said) || questionCount >= 2) return { move: "challenge", tagged: false };
  if (BUILD_CUES.test(said)) return { move: "build", tagged: false };
  return { move: "build", tagged: false };
}

// Insight thresholds — deliberately conservative so chips are cue cards,
// not noise. All evaluated over the visible prefix only.
const FREE_RIDER_MIN_STUDENT_TURNS = 8;
const FREE_RIDER_MAX_SHARE = 0.1;
const CONFLICT_RUN_LENGTH = 3; // consecutive student challenge ticks in evaluation
const SILOS_MIN_STUDENT_TURNS = 6;
const SILOS_WINDOW = 6; // recent student turns examined for peer addressing
const SILOS_MAX_EXPLICIT_IN_WINDOW = 1;
const FALSE_CONSENSUS_RUN = 3; // min tagged challenge-run length in evaluation
const SOURCE_IGNORED_MIN_STUDENT_TURNS = 8;
const SHARED_UNDERSTANDING_MIN_STUDENT_TURNS = 8;
const SHARED_UNDERSTANDING_MIN_DOC_RATIO = 0.7; // fraction of student turns that cite the document

export interface DynamicsOptions {
  /** True when the active dataset carries a source document. */
  hasSourceDocument?: boolean;
  /** Participants counted as peers (participation bars + arcs). Defaults to
   *  the five students; a joined human ("You") is appended by the caller. */
  roster?: readonly string[];
}

function detectInsights(
  participation: ParticipationStat[],
  totalStudentTurns: number,
  timeline: TimelineTick[],
  explicitPerStudentTurn: number[],
  opts: DynamicsOptions,
): Insight[] {
  const insights: Insight[] = [];

  if (totalStudentTurns >= FREE_RIDER_MIN_STUDENT_TURNS) {
    const rider = participation.find((p) => p.turnShare <= FREE_RIDER_MAX_SHARE);
    if (rider) {
      insights.push({
        id: "free-rider",
        params: { name: rider.name, turns: rider.turns, total: totalStudentTurns, pct: Math.round(rider.turnShare * 100) },
      });
    }
  }

  let run = 0;
  for (const tick of timeline) {
    if (tick.speaker !== "Teacher" && tick.phase === "evaluation" && tick.move === "challenge") {
      run += 1;
      if (run >= CONFLICT_RUN_LENGTH) {
        insights.push({ id: "conflict", params: { runLength: CONFLICT_RUN_LENGTH } });
        break;
      }
    } else if (tick.speaker !== "Teacher") {
      run = 0;
    }
  }

  const firstIntegrate = timeline.find((t) => t.phase === "synthesis" && t.move === "integrate");
  if (firstIntegrate) {
    insights.push({ id: "convergence", params: { name: firstIntegrate.speaker } });
  }

  // False consensus: a decision was recorded (verdict tick present) while a
  // serious challenge run's dissenter never re-engaged — agreement obtained
  // by not asking everyone. Anchored on the verdict deliberately: (a) it's
  // flicker-free (a mid-replay prefix can never fire transiently on
  // datasets where dissenters resolve late, e.g. the Conflict scenario),
  // and (b) on stage the chip lands exactly as the teacher names the
  // phenomenon. Hand-tagged runs only — too subtle for heuristic ticks.
  if (timeline.some((t) => t.move === "verdict")) {
    const unresolved = findUnresolvedDissenter(timeline);
    if (unresolved) {
      insights.push({ id: "false-consensus", params: { name: unresolved } });
    }
  }

  // Source ignored: the group was given a shared document and, well into the
  // discussion, nobody has engaged it. Structurally inert without an attached
  // doc (opts flag), and docRef is authoring-only, so this can never misfire
  // on scenarios, real logs, or doc-less tasks.
  if (
    opts.hasSourceDocument &&
    totalStudentTurns >= SOURCE_IGNORED_MIN_STUDENT_TURNS &&
    !timeline.some((t) => t.docRef)
  ) {
    insights.push({ id: "source-ignored", params: { total: totalStudentTurns } });
  }

  // Shared understanding: the exact inverse of "source ignored" — the group
  // is working FROM the document, nearly every turn anchored in the text.
  // The signature of a comprehension task done well: understanding built on
  // the source, not floating free of it. Same authoring-only docRef basis,
  // so it can only fire on hand-tagged comprehension content.
  if (opts.hasSourceDocument && totalStudentTurns >= SHARED_UNDERSTANDING_MIN_STUDENT_TURNS) {
    const studentDocTurns = timeline.filter((t) => t.speaker !== "Teacher" && t.docRef).length;
    if (studentDocTurns / totalStudentTurns >= SHARED_UNDERSTANDING_MIN_DOC_RATIO) {
      insights.push({ id: "shared-understanding", params: { docTurns: studentDocTurns, total: totalStudentTurns } });
    }
  }

  // Working in silos: sustained parallel work — nobody challenges anything
  // and, in the recent window, nobody addresses a peer by name. Structural
  // (arc + move based), so it is safe on unscripted logs too; any real
  // discussion session contains challenge moves and never fires it.
  if (totalStudentTurns >= SILOS_MIN_STUDENT_TURNS && !timeline.some((t) => t.move === "challenge")) {
    const window = explicitPerStudentTurn.slice(-SILOS_WINDOW);
    const explicitInWindow = window.reduce((a, b) => a + b, 0);
    if (explicitInWindow <= SILOS_MAX_EXPLICIT_IN_WINDOW) {
      insights.push({ id: "silos", params: { windowSize: SILOS_WINDOW } });
    }
  }

  return insights;
}

/**
 * Finds a challenge-run dissenter who never re-engaged. Runs are consecutive
 * student challenge ticks in Evaluation (teacher ticks don't break a run),
 * ALL hand-tagged, length >= FALSE_CONSENSUS_RUN. A run author is resolved
 * if they contribute any build/integrate tick after the run ends.
 */
function findUnresolvedDissenter(timeline: TimelineTick[]): string | null {
  const qualifying: { authors: Set<string>; endIdx: number }[] = [];
  let authors: string[] = [];
  let allTagged = true;
  let lastIdx = -1;

  const flush = () => {
    if (authors.length >= FALSE_CONSENSUS_RUN && allTagged) {
      qualifying.push({ authors: new Set(authors), endIdx: lastIdx });
    }
    authors = [];
    allTagged = true;
  };

  for (let idx = 0; idx < timeline.length; idx++) {
    const tick = timeline[idx];
    if (tick.speaker === "Teacher") continue; // teacher ticks never break a run
    if (tick.phase === "evaluation" && tick.move === "challenge") {
      authors.push(tick.speaker);
      allTagged = allTagged && tick.tagged;
      lastIdx = idx;
    } else {
      flush();
    }
  }
  flush();

  for (const run of qualifying) {
    for (const author of run.authors) {
      const resolved = timeline.some(
        (t, idx) => idx > run.endIdx && t.speaker === author && (t.move === "build" || t.move === "integrate"),
      );
      if (!resolved) return author;
    }
  }
  return null;
}

/** The layer's single entry point: dynamics of the visible prefix. */
export function computeDynamics(turns: TurnView[], opts: DynamicsOptions = {}): DynamicsSnapshot {
  // Default roster is the five students → scripted tasks are unaffected. A
  // joined human is appended by the caller, making "You" a peer here.
  const roster: RosterContext =
    opts.roster && opts.roster !== STUDENTS ? makeRosterContext(opts.roster) : DEFAULT_ROSTER;

  const turnCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  const docCiteCounts = new Map<string, number>();
  const edgeMap = new Map<string, InteractionEdge>();
  const timeline: TimelineTick[] = [];
  const explicitPerStudentTurn: number[] = []; // explicit-mention count per student turn, in order

  let totalStudentTurns = 0;
  let totalStudentWords = 0;
  let prevStudentSpeaker: string | null = null;
  let current: CurrentAttribution | null = null;

  turns.forEach((turn, index) => {
    const { move, tagged } = classifyMove(turn);
    timeline.push({ index, speaker: turn.speaker, phase: turn.phase, move, tagged, docRef: turn.docRef });
    if (turn.docRef) docCiteCounts.set(turn.speaker, (docCiteCounts.get(turn.speaker) ?? 0) + 1);

    if (roster.set.has(turn.speaker)) {
      const words = turn.said.split(/\s+/).filter(Boolean).length;
      turnCounts.set(turn.speaker, (turnCounts.get(turn.speaker) ?? 0) + 1);
      wordCounts.set(turn.speaker, (wordCounts.get(turn.speaker) ?? 0) + words);
      totalStudentTurns += 1;
      totalStudentWords += words;

      const attribution = extractAddressees(turn, prevStudentSpeaker, roster);
      explicitPerStudentTurn.push(attribution?.explicit ? attribution.to.length : 0);
      current = attribution; // only the latest student turn's arcs flash
      if (attribution) {
        for (const to of attribution.to) {
          const key = `${attribution.from}->${to}`;
          const edge = edgeMap.get(key) ?? { from: attribution.from, to, weight: 0, explicitCount: 0 };
          edge.weight += 1;
          if (attribution.explicit) edge.explicitCount += 1;
          edgeMap.set(key, edge);
        }
      }
      prevStudentSpeaker = turn.speaker;
    } else {
      current = null; // a teacher turn is on screen; no peer arc flashing
    }
  });

  const participation: ParticipationStat[] = roster.names.map((name) => {
    const t = turnCounts.get(name) ?? 0;
    const w = wordCounts.get(name) ?? 0;
    return {
      name,
      turns: t,
      words: w,
      turnShare: totalStudentTurns > 0 ? t / totalStudentTurns : 0,
      wordShare: totalStudentWords > 0 ? w / totalStudentWords : 0,
      docCites: docCiteCounts.get(name) ?? 0,
    };
  });

  return {
    participation,
    totalStudentTurns,
    edges: [...edgeMap.values()],
    current,
    timeline,
    insights: detectInsights(participation, totalStudentTurns, timeline, explicitPerStudentTurn, opts),
  };
}
