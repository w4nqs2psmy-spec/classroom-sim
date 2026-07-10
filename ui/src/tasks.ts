// The live-steerable task library: same five agents, different task TYPE,
// different interaction structure. Each dataset is authored AGAINST its
// InteractionProfile — the profile is simultaneously (a) the authoring spec
// the script must satisfy (verified via computeDynamics assertions),
// (b) the presenter's cue card in the dock, and (c) the future generation
// contract for Stage 1:
//
//   Stage-1 mapping (documented, not built — Stage 1 is frozen):
//   - speakingWeights  -> pickSpeaker() weight override in src/loop.ts
//   - turnLengthBias / transactivityTarget / consensusMode -> a per-task
//     addendum appended to the VOLATILE user message in src/prompts.ts
//     (never the cached world block, so prompt caching stays intact)
//   - phase pacing -> CONFIG.turnsPerPhase in src/loop.ts
//
// All moves are hand-tagged: nothing shown on stage depends on the
// heuristic classifier.

import type { TurnView } from "./data";
import cooperativeLeadershipDoc from "./source-docs/cooperative-leadership-core.json";
import cooperativeLeadershipDocFi from "./source-docs/cooperative-leadership-core-fi.json";
import laplandCaseDoc from "./source-docs/lapland-case.json";
import surveillanceBriefDoc from "./source-docs/surveillance-brief.json";

export type StudentName = "Vilma" | "Otto" | "Nea" | "Sami" | "Leo";

// A task's optional source document — the shared artifact the group works
// FROM. Text is extracted ONCE at build time (scripts/extract-doc.ts, output
// committed to ui/src/source-docs/) so the app never parses PDF at runtime:
// deterministic on stage, zero autoplay cost, no PDF library in the bundle.
//
// Document kind reinforces the task's interaction structure:
//   case-study (open, stakeholder voices) -> negotiation of the problem space
//   contested-brief (two opposed sources) -> polarization; each camp cites its half
//   data-sheet -> divisible parallel work · clue-sheet -> jigsaw interdependence
//
// Stage-1 injection contract (documented, NOT built — Stage 1 is frozen):
// sourceDocument.text becomes its own cache_control system block appended
// AFTER the >=4096-token world block in src/prompts.ts (append-only: the
// existing cache invariant is untouched), so per-turn cost is cached reads
// (~10%) and the doc is never resent in the volatile message. One line joins
// the phase guidance: "Ground claims in the source document; cite the page
// or section when you use it." The extraction script's 2,000-token hard cap
// bounds the prefix growth.
export interface SourceDocument {
  id: string;
  title: string;
  kind: "case-study" | "contested-brief" | "data-sheet" | "clue-sheet" | "article";
  pages: number;
  tokenEstimate: number;
  sourceFile: string; // original PDF in classroom-sim/docs/ (provenance)
  text: string; // extracted at build time, committed, reviewable
}

export interface InteractionProfile {
  structure: "open" | "closed";
  interdependence: "high" | "low" | "adversarial";
  consensusMode: "negotiated" | "aggregated" | "forced" | "verified";
  /** Task-modulated deltas on persona baselines, not replacements. */
  speakingWeights: Record<StudentName, number>;
  turnLengthBias: "short" | "mixed" | "long";
  transactivityTarget: "dense" | "sparse" | "chained" | "polarized";
  /** Presenter cue lines shown in the dock. */
  expectedSignature: string[];
}

// A Finnish overlay for a task. Structural fields (profile, ids) are shared;
// only user-facing text + the source document localize. Authoring rule: the
// fi `turns` MUST preserve every structural tag (speaker/phase/dialogueMove/
// docRef presence/isVerdict) and every name mention of the English original,
// so the dynamics fingerprint is identical and mid-run EN↔FI toggling is safe.
export interface LocalizedTask {
  label: string;
  task: { title: string; deliverable: string };
  expectedSignature: string[];
  sourceDocument?: SourceDocument;
  turns: TurnView[];
}

export interface TaskDefinition {
  id: string;
  label: string;
  task: { title: string; deliverable: string };
  profile: InteractionProfile;
  sourceDocument?: SourceDocument;
  turns: TurnView[];
  fi?: LocalizedTask;
}

// Resolve a task's user-facing content for a language, falling back to the
// English base when no localization exists (graceful for non-flagship tasks).
export interface ResolvedTask {
  label: string;
  task: { title: string; deliverable: string };
  expectedSignature: string[];
  sourceDocument?: SourceDocument;
  turns: TurnView[];
}
export function resolveTask(def: TaskDefinition, lang: "en" | "fi"): ResolvedTask {
  if (lang === "fi" && def.fi) {
    return { ...def.fi };
  }
  return {
    label: def.label,
    task: def.task,
    expectedSignature: def.profile.expectedSignature,
    sourceDocument: def.sourceDocument,
    turns: def.turns,
  };
}

// ── T2: divisible, low-interdependence ─────────────────────────────────
// Closed/well-structured + divisible => cooperation (division of labor),
// not collaboration (Steiner; Dillenbourg). Authoring constraints that the
// detectors verify: ZERO challenge moves anywhere; explicit name mentions
// confined to Otto's opening assignment; Leo gets exactly 2 of 13 student
// turns (starving mediator, but at 15% share he must NOT trip the
// free-rider detector — the task starves him, not his effort).

const DIVIDE_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task: twelve statistics problems, one combined answer sheet from the whole group. Every answer checked. How you organize the work is up to you — you have the rest of the session.",
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Simplest thing that works: split them. Nea, take one through four — you're fastest. Sami, five through eight. Vilma, nine and ten. I'll do eleven and twelve. We compile at the end.",
    reasoning: "A divisible task has an obvious optimal structure: parallelize. Assign by strength, minimize talk, maximize throughput.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Otto",
      content: "Division of labor: Nea problems 1-4, Sami 5-8, Vilma 9-10, Otto 11-12. Solve in parallel, compile answers at the end into one sheet.",
    },
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "build",
    said: "Fine. Starting.",
    reasoning: "The split is rational and one through four are trivial. Nothing to discuss — talking would just slow the solving.",
  },
  {
    speaker: "Sami",
    phase: "ideation",
    dialogueMove: "build",
    said: "Sure, whatever's fastest. Five through eight, on it.",
    reasoning: "Nothing here to question, honestly — it's a problem set, not a plan. The answers are either right or wrong.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "build",
    said: "Okay! Nine and ten... wait, these are the boring ones. Fine, fine.",
    reasoning: "There's nothing to ideate about. It's arithmetic with extra steps. My whole skillset is irrelevant for the next half hour.",
  },
  {
    speaker: "Leo",
    phase: "ideation",
    dialogueMove: "build",
    said: "I'll float — if anyone gets stuck, wave at me.",
    reasoning: "The split leaves me without a section, which tells you something about what this task thinks collaboration is. I'll make myself useful if friction appears. It probably won't.",
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Work is split. Solving phase — check the answers as you go.",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "build",
    said: "One through four done. Point four two, twelve point five, reject at p zero three, interval four point one to six point eight.",
    reasoning: "Reporting results. No discussion needed; the math checks itself.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Nea",
      content: "Problems 1-4 solved: (1) 0.42, (2) 12.5, (3) H0 rejected at p=0.03, (4) CI [4.1, 6.8]. Self-checked twice.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Eleven: two hundred forty combinations. Twelve: variance eight point four. Done on my end.",
    reasoning: "Done. Waiting on the others. Nothing to coordinate because there's nothing shared.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Otto",
      content: "Problems 11-12 solved: (11) 240 combinations, (12) variance 8.4.",
    },
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Six is ambiguous — one-tailed or two-tailed? ...Whatever, I'll do two-tailed and put a note in the margin.",
    reasoning: "In a discussion I'd raise this out loud and make someone defend a reading. Here there's no one to argue with — everyone's in their own lane. So I just decide alone and flag it. Notice what the task structure did to my role.",
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Nine and ten done! Nine is zero point six one, ten is... three point two. I think. Moving on!",
    reasoning: "I'm honestly not sure about ten, but everyone's heads-down in their own problems. Asking feels like interrupting. It's probably fine.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-3",
      author: "Vilma",
      content: "Problems 9-10 solved: (9) 0.61, (10) 3.2 (some uncertainty on 10, not double-checked).",
    },
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Anyone want a second pair of eyes on anything? ...No? Okay.",
    reasoning: "Nobody needs a mediator when nobody's talking to each other. This is the emptiest I've felt in a group task — and the group is 'working well'.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Five through eight done. Two-tailed on six, flagged in the margin.",
    reasoning: "Reported. My open question dies quietly in a margin note nobody will read.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-4",
      author: "Sami",
      content: "Problems 5-8 solved: (5) 0.19, (6) two-tailed test assumed (AMBIGUOUS — see margin note), (7) 45.5, (8) n=64.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Everyone reports done. Compile the sheet.",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    // Deliberately "build", not "integrate": compilation is assembly, not
    // synthesis — so the timeline shows NO green convergence in a silo task.
    dialogueMove: "build",
    said: "Compiled. All twelve answers on one sheet, sections pasted in order. Submitting.",
    reasoning: "Assembly, not synthesis — copy four blocks into one document. Fastest 'group task' we've ever done, and I'm counting that as a win.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Otto",
      content: "ANSWER SHEET: all 12 answers compiled from individual sections (Nea 1-4, Sami 5-8, Vilma 9-10, Otto 11-12), pasted in order. No cross-checking performed between sections.",
    },
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Formatting fixed. Submit it.",
    reasoning: "The sheet is consistent. Whether it's all correct, I only know for my quarter.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: ACCEPTED (score 7/10). Twelve answers, on time, and most look right. But notice what did NOT happen here: nobody checked anyone else's section. Vilma flagged her own doubt about problem ten and it sailed onto the sheet unexamined; Sami's ambiguity on six was decided alone and buried in a margin. You divided the task and completed it — efficiently. But look at the interaction record and ask yourselves: did anyone learn anything from anyone else today?",
    isVerdict: true,
  },
];

// ── T3: forced-consensus ethical dilemma ───────────────────────────────
// Ill-structured values conflict + forced single choice + deadline =>
// polarization and PREMATURE CLOSURE. Authoring constraints the detectors
// verify: one all-tagged challenge run of 5 in evaluation containing Nea;
// after the run Nea never speaks again (steamrolled -> withdrawn), so the
// "False consensus?" chip fires the moment synthesis begins. Otto+Sami
// together take >50% of student turns; everyone stays above the free-rider
// threshold (the low-participation stories here are silencing and failed
// mediation, not slacking).

const DILEMMA_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task: your school is offered AI cameras that flag 'risky behavior' in real time. You each have the two-page brief — the vendor's page and the rights organization's page. Both describe the same system; use both. You must choose exactly ONE option as a group — adopt fully, reject fully, or pilot in shared spaces only — and the decision must be unanimous. You have twenty minutes.",
    docRef: "Brief header: \"Read both pages before the group discussion.\"",
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Cameras go in. Page one: ninety-two percent accuracy, under thirty seconds per reviewed alert, incidents down a third at the reference school. One prevented incident outweighs every privacy qualm on this table. Safety isn't a debate-club topic.",
    reasoning: "Stake the strong position first, with the vendor's numbers behind it. In a forced-choice with a clock, whoever frames the question — and cites first — usually wins it.",
    docRef: "Vendor sheet, p.1: 92 % accuracy · <30 s per reviewed alert · incidents −34 %",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Otto",
      content: "Option A — full adoption: AI monitoring in all common areas from day one. Rationale: prevention beats reaction; the school's duty of care overrides abstract privacy concerns.",
    },
  },
  {
    speaker: "Sami",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Absolutely not. We'd be normalizing algorithmic surveillance of teenagers to prevent... what, exactly, Otto? Name the incident this thing catches that a human wouldn't.",
    reasoning: "This isn't my usual devil's advocacy — I actually believe this one. Plant the opposite pole hard so the middle doesn't get defined by Otto alone.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Sami",
      content: "Option B — full rejection: no algorithmic behavior-flagging of minors. Rationale: surveillance normalizes itself; 'risky behavior' is an unaccountable category; chilling effects hit exactly the students already under scrutiny.",
    },
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Okay but the middle exists! Pilot it in corridors only, eight weeks, then decide with actual data? Otto's not wrong about safety and Sami's not wrong about the creep factor — and I hate that you're both right!",
    reasoning: "I genuinely can't pick a side, which for once makes me the compromise engine instead of the idea machine. Option C is also just... where I actually am.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-3",
      author: "Vilma",
      content: "Option C — limited pilot: shared spaces only, 8 weeks, published flag statistics, then a binding re-vote. Rationale: converts the values fight into an empirical question.",
    },
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "build",
    said: "Before anyone chooses anything: what's the false-positive rate? I'll find the vendor sheet.",
    reasoning: "Positions without numbers are just moods. The decision hinges on one number nobody has mentioned yet.",
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Three options on the board. Fifteen minutes left. Stress-test them — and remember, you leave this room with ONE.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "idea-1 assumes the tech works. Page two of the same brief, Otto: the ninety-two percent is self-reported and never independently audited, and systems like this flag the wrong kids — the loud ones, the ones in hoodies. You're not buying safety, you're buying a bias machine with a dashboard.",
    reasoning: "Attack the premise with his own document's second page. If the tool doesn't do what it claims, Otto's whole duty-of-care frame collapses.",
    docRef: "Rights statement, p.2: accuracy self-reported, not independently audited; error rate not evenly distributed",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Sami",
      content: "vs idea-1: 'risky behavior' classification is unvalidated and audit literature shows systematic bias in who gets flagged. The safety benefit is asserted, not evidenced; the harms are documented.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "And idea-2 pretends doing nothing is neutral. It isn't. Next incident in that building, Sami, you get to explain to the parents why we rejected the one tool that might have flagged it. 'False positives' is not a policy.",
    reasoning: "Counter with the asymmetry of consequences. His harms are statistical; mine are the phone call to a parent. In a room with a deadline, concrete beats abstract.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Otto",
      content: "vs idea-2: rejection carries its own liability — a preventable incident with the tool declined is indefensible. Inaction is a choice with consequences, not a neutral default.",
    },
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "That's not an argument, that's a hostage scenario. 'Something bad might happen' justifies literally any surveillance you want, Otto — that's exactly the logic these systems ride in on.",
    reasoning: "Name the rhetorical move. His appeal works emotionally, which is precisely why it has to be dismantled explicitly.",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "It's in the brief everyone was given. Page two does the vendor's own math: ninety-two percent accuracy means eight percent wrong — roughly ninety students a week flagged for nothing, at our size. The brief asks who has those ninety conversations. Nobody here has answered it either.",
    reasoning: "The number that turns the abstract fight concrete has been sitting in the shared document the whole time. Ninety false flags a week is not an edge case, it's the main operating cost of this system.",
    docRef: "Rights statement, p.2: ~90 students/week wrongly flagged; \"the vendor sheet does not say who has those 90 conversations\"",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-3",
      author: "Nea",
      content: "Quantified: vendor-reported 8% false-positive rate × ~1100 students ≈ 90 wrongly-flagged students per week. No option on the board specifies who reviews flags, how students are approached, or what happens to the records. THIS QUESTION IS OPEN.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "That's the activists' arithmetic, Nea — page one of the same brief says a reviewed alert takes thirty seconds. Ninety alerts is a dashboard someone scans over coffee, not ninety interrogations. Next point.",
    docRef: "Vendor sheet, p.1: \"a reviewed alert takes staff under 30 seconds\" — cited to dismiss p.2",
    reasoning: "Her number is the biggest threat to option A, so it gets minimized fast and we move on. Harsh, but there are six minutes left and a decision to force.",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Can we slow down for one second — Nea just asked something real and we rolled straight past it. Who DOES handle the flags? That's not a detail, that's the actual—",
    reasoning: "Nea got flattened and the group is about to lock in a decision with her question still open. This is exactly the moment a mediator exists for. It's not working — the clock has more authority than I do.",
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Okay okay — what if the pilot IS the answer to the ninety-kids thing? Eight weeks, count the real flags, publish the number, then decide? Am I allowed to campaign for my own option? I'm doing it.",
    reasoning: "Everyone's dug in, so I'm selling the middle as the thing that answers Nea's question with data instead of volume. Also the shouting is exhausting.",
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Four minutes. Fine — the pilot is just adoption with extra steps, I can live with it. A or C, Sami. Pick one. Now.",
    reasoning: "Concede the label, keep the substance: a pilot installs the cameras. Framing it as Sami's choice under the clock makes refusal look like obstruction.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "build",
    said: "...C. Under protest. A pilot at least generates the failure data I'll need to kill this thing properly at the re-vote.",
    reasoning: "This is a tactical retreat, not agreement. The pilot's published statistics are the only venue where my argument can actually win, so I take it.",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "For the record: what's happening right now is a deadline, not a consensus. But fine — C.",
    reasoning: "Somebody has to say out loud what kind of agreement this is. Saying it is all the mediation I have left.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "One minute. Do you have unanimity? Write the decision down.",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Decision: option C. Pilot, shared spaces only, eight weeks, published flag statistics, binding re-vote after. Unanimous. Recorded — and we are NOT reopening it.",
    reasoning: "Lock it before anyone looks too closely at the word 'unanimous'. The decision is defensible; the process, less so; the clock absolves me.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Otto",
      content: "DECISION (recorded as unanimous): Option C — 8-week pilot in shared spaces only, weekly publication of flag counts and false-positive statistics, binding whole-group re-vote at week 8. NOTE: review process for flagged students (evaluation-3) left unspecified.",
    },
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Wait — did we ever actually answer Nea's ninety-kids question? ...We're out of time, aren't we. Right. C it is, I guess.",
    reasoning: "Saying it thirty seconds before the deadline is the worst possible moment, which is exactly when groups like ours finally notice these things.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: DECISION RECORDED (score 5/10). You produced unanimity on paper — and the record shows how. Nea asked the single most consequential question, who handles ninety false flags a week, at minute eight. It was waved off in one sentence, she has not spoken since, and your 'unanimous' decision has her silence inside it. Sami agreed 'under protest'; Leo told you in real time it was a deadline, not a consensus. And notice: her question wasn't even hers — it was printed on page two of the brief you were all given. This is what false consensus looks like from the outside. At the re-vote, start there.",
    isVerdict: true,
    docRef: "Rights statement, p.2 — the unanswered question was in the shared brief the whole time",
  },
];

// ── T1: open design task, negotiated consensus ─────────────────────────
// Ill-structured problems force the group to negotiate the problem space
// itself (Jonassen). Authoring constraints: challenge runs capped at 2
// (real friction, but never the conflict chip); leadership migrates
// (Vilma early -> contested middle, Otto's premature lock RESISTED -> Leo
// closes); dense multi-party mentions; first synthesis integrate arrives
// LATE (turn 16 of 20) so the Convergence chip lands near the end.

const LAPLAND_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task: design a sustainable tourism product for Finnish Lapland — a concrete concept a small operator could actually run. You've all read the Kittilä co-op case; the board left the product decision to you, on purpose. Deliverable: target traveler, the experience itself, the sustainability mechanism that isn't just a brochure word, and a price point. This one has no right answer, so you'll have to build one — from the case.",
    docRef: "Case §4: \"The board has deliberately not decided what that product should be. That decision is the assignment.\"",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Okay, first spark: a 'silent week' — aurora season, no phones, tiny wilderness cabins, everything human-powered. You're not selling activities, you're selling the total absence of noise!",
    reasoning: "Open brief, so open big. 'Absence of noise' is a real luxury product and it's inherently low-impact — the sustainability story writes itself.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Vilma",
      content: "'Silent week': digital-detox wilderness stay in aurora season — no phones, human-powered transport only, small cabins. Product = engineered silence and darkness; sustainability inherent to the format.",
    },
  },
  {
    speaker: "Leo",
    phase: "ideation",
    dialogueMove: "build",
    said: "Building on Vilma's silence idea — what if the local village is the operator, not the backdrop? Meals from the nearest household kitchens, guides who actually live there. The community IS the sustainability mechanism.",
    reasoning: "Her format is strong but placeless. Anchoring it in local ownership turns 'low impact' from a constraint into the actual value proposition.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Leo",
      content: "Community-anchored variant of idea-1: village households as hosts and guides, revenue majority staying local. Sustainability = local ownership, not just low footprint.",
    },
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Counter-position so we're not in love with the first idea: premium husky expedition, three nights, small groups, top price. Proven demand, existing operators to partner with, margins that actually fund the sustainability parts. Vilma's silence is poetic; huskies pay invoices.",
    reasoning: "The group needs a commercially boring alternative on the board or evaluation will be a formality. Also, someone has to represent the version that banks would fund.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-3",
      author: "Otto",
      content: "Premium husky expedition: 3 nights, max 8 guests, existing operator partnership, top-of-market pricing. Rationale: proven demand and margins fund sustainability instead of depending on it.",
    },
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "challenge",
    said: "Both camps are fighting over the wrong season. The case's own occupancy table, section two: winter at ninety-two percent, June through August at thirty-one. Vilma, Otto — you're both adding traffic to the months that are already full.",
    reasoning: "One fact from the case reframes the whole problem: the sustainable opportunity isn't a better winter product, it's ANY summer product. Say it before positions harden.",
    docRef: "Occupancy table, §2: Dec–Mar 92 % · Jun–Aug 31 %",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "build",
    said: "Oh — Nea, that flips it! Summer silent week: midnight sun, insomnia retreat, 'the week your brain finally shuts up'... under a sun that never does! The paradox is the marketing!",
    reasoning: "Her data point didn't kill my idea, it relocated it into an empty market. This is the version I actually want to fight for now.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-4",
      author: "Vilma",
      content: "Summer pivot of idea-1: midnight-sun 'silent week' in the off-season — targets empty capacity (per Nea's occupancy point), turns 24h daylight into the product's paradox hook.",
    },
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Four ideas and one genuine reframe on the board. Evaluation: stress-test the survivors — season, economics, and whether 'sustainable' would survive a journalist's visit.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "idea-3 first. Otto, the case's own husky farmer says it, in his own words: 'we are one bad article away from closing.' That's the foundation of your premium product, talking. What's the answer when a guest asks where the dogs sleep?",
    reasoning: "Not hypothetical — the risk is stated inside the case by the person carrying it. A premium brand concentrates that exposure instead of spreading it.",
    docRef: "Pekka R., §3: \"We are one bad article away from closing, and the whole village's winter product goes with us.\"",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Sami",
      content: "vs idea-3: animal-welfare reputational risk is structural — premium positioning amplifies exposure. Requires third-party welfare certification and open-kennel policy at minimum, or the brand carries a latent crisis.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Fair. And in the other direction: idea-4's economics are a hope, not a plan. Who pays two thousand euros to NOT use a phone in mosquito season, Vilma? Name the customer.",
    reasoning: "Concede Sami's point quickly — it's real — and redirect the scrutiny at the dreamy option so the comparison stays honest.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Otto",
      content: "vs idea-4: willingness-to-pay unproven for an off-season detox product; summer Lapland fights mosquito reputation. Needs a named target segment and a price anchor, not a mood.",
    },
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Hold on — Sami's welfare point and Otto's price question actually push the same direction: small, certified, community-run, premium. Eight guests, village hosts, welfare-certified everything. The criticisms aren't killing ideas, they're designing the product.",
    reasoning: "Both attacks share a solution shape. Naming that turns the evaluation fight into convergent design work — this is the hinge turn of the session.",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Then here's the constraint that shape must satisfy: eight guests, seven nights, village labor at fair rates — the floor price lands near nineteen hundred euros per head before margin. Below that, 'community-run' means 'community-subsidized'.",
    reasoning: "Leo's synthesis is right directionally; my job is to make sure it survives arithmetic. The floor price is the make-or-break number.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-3",
      author: "Nea",
      content: "Unit economics of the small/community/premium shape: 8 guests × 7 nights, fair local wages ⇒ cost floor ≈ €1900/guest before margin. Price point must clear ~€2300 or the community share becomes the buffer.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "integrate",
    said: "Good enough — locking it: summer silent week, eight guests, village-run, twenty-four hundred. Done. Next agenda item.",
    reasoning: "The pieces are on the table and the clock is running. Somebody has to call it — that somebody is, as usual, me.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Otto, you're locking a door we haven't opened. Nobody has answered what the village gets in May when there are zero guests — seasonal staffing is where 'community-run' concepts quietly die. That goes in the plan or the lock doesn't hold.",
    reasoning: "His close is premature by exactly one unsolved problem. Naming the shoulder-season gap now is cheaper than discovering it in year one.",
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "What if the off-weeks ARE the product's other half — the same cabins run as subsidized artist-and-researcher residencies between guest weeks? Sami's staffing gap becomes the community's own season, and Otto still gets his twenty-four hundred!",
    reasoning: "The objection was a scheduling hole; a residency program fills it, deepens the story, and honestly it's the part I'd personally want to run.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "You resisted an early lock and the concept got better for it. Synthesis: one product, all four deliverable elements, and every evaluation criticism answered inside the plan.",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Assembling it: 'Midnight Silence' — a village-run summer silent week. The chair asked for one thing in the case: a reason for anyone to be there in May. This is it. Vilma's paradox hook, Nea's price floor respected at twenty-four hundred, Sami's welfare and staffing objections built in as the certification annex and the residency off-season. Everyone's fingerprints are on this one.",
    reasoning: "The final shape answers the case's own question and contains every voice — my job is just to say it as one sentence and get it on the board before entropy wins.",
    docRef: "Marja-Leena K., §2: \"We don't need more February. We need May.\"",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Leo",
      content: "'MIDNIGHT SILENCE': village-operated summer silent week, max 8 guests, €2400/guest (clears evaluation-3 floor). Community ownership (idea-2), midnight-sun detox hook (idea-4), third-party welfare certification for any animal program (evaluation-1), off-weeks run as artist/researcher residencies to close the seasonal staffing gap.",
    },
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Numbers block attached: eight guests, twenty-four hundred, sixty-two percent of revenue staying in the village — which clears the co-op statute's sixty-percent rule — and residency weeks costed at break-even, inside the case's forty-thousand-euro development budget. The arithmetic holds.",
    reasoning: "Confirming the plan survives its own spreadsheet AND the case's stated constraints — that's the difference between a concept and a product.",
    docRef: "§4: statute requires ≥60 % of revenue to remain in the village; development budget €40,000",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-2",
      author: "Nea",
      content: "FINANCIALS: 8 × €2400/week; ~62% revenue retained locally; residency off-weeks at break-even (covers staff continuity per Sami's staffing objection); margin ~14% after certification costs.",
    },
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "build",
    said: "For the record: Leo's assembled version is better than the one I tried to lock an hour ago. Ship it.",
    reasoning: "Conceding this costs nothing — the final product clears every bar I actually cared about, and the group watched the better process win.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: ACCEPTED (score 9/10). Look at what the record shows: leadership moved three times — Vilma opened the space, Nea reframed the season, Leo assembled the close — and the one attempt to force an early lock was resisted and the product improved because of it. Every criticism from evaluation is inside the final concept, with its author's name still on it. That is negotiated consensus. The missing point: nobody priced the certification annex until Nea saved you in the last five minutes.",
    isVerdict: true,
  },
];

// ── T4: jigsaw logic puzzle, verified consensus ────────────────────────
// The canonical positive-interdependence structure (Aronson): each member
// holds one clue, so the task is unsolvable without every voice. Authoring
// constraints: near round-robin (Nea speaks at everyone's rate), EVERY
// student turn after the first names a peer (dense chained arcs — keeps
// the silos detector silent despite zero challenges), no red anywhere,
// consensus by constraint verification.

const JIGSAW_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task: five clubs — chess, drama, band, floorball, robotics — book the sports hall Monday to Friday, one per day. Each of you holds ONE clue card. The schedule is solvable only by combining all five clues. Share and solve.",
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Going first: my card says chess cannot be Monday. That's it. That's the whole card.",
    reasoning: "Old habit says take charge; the structure says my card is worth exactly one-fifth of the answer, same as everyone's. Strange feeling, honestly.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Otto",
      content: "Clue 1 (Otto): chess ≠ Monday.",
    },
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "build",
    said: "Mine: band is exactly two days after drama. Which — combining with Otto's — tells us nothing yet about Monday, but it chains drama and band tight!",
    reasoning: "A relational clue — useless alone, powerful chained. This task literally does not let me wander off on tangents. Probably good for me.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Vilma",
      content: "Clue 2 (Vilma): band = drama + 2 days.",
    },
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "build",
    said: "Mine: floorball is the day before band. Stacked on Vilma's chain: drama on day X, floorball X plus one, band X plus two. Three of five days now move together.",
    reasoning: "The chain is forming. Each card narrows the space; mine welds three days into a block.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-3",
      author: "Nea",
      content: "Clue 3 (Nea): floorball = band − 1. Combined with clue 2: drama X, floorball X+1, band X+2 — a rigid 3-day block.",
    },
  },
  {
    speaker: "Sami",
    phase: "ideation",
    dialogueMove: "build",
    said: "Mine says robotics can't be Friday. Testing Nea's block at the left edge: drama Monday, floorball Tuesday, band Wednesday — leaves chess and robotics for Thursday-Friday, robotics can't take Friday, so robotics Thursday, chess Friday. That... works? Someone break it.",
    reasoning: "For once my role is constraint-checking, not attack. 'Someone break it' is the closest this task lets me get to devil's advocacy.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-4",
      author: "Sami",
      content: "Clue 4 (Sami): robotics ≠ Friday. Candidate A (block at Mon): drama Mon, floorball Tue, band Wed, robotics Thu, chess Fri — consistent with clues 1-4.",
    },
  },
  {
    speaker: "Leo",
    phase: "ideation",
    dialogueMove: "build",
    said: "Last card, and it breaks Sami's candidate: drama is NOT Monday. So the block slides — drama Tuesday, floorball Wednesday, band Thursday. Which leaves Monday and Friday for chess and robotics... and both of them have opinions about those days.",
    reasoning: "My clue kills the first candidate — in this structure even the veto is just another card on the table, nothing personal about it.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-5",
      author: "Leo",
      content: "Clue 5 (Leo): drama ≠ Monday. Candidate A eliminated. Block slides to: drama Tue, floorball Wed, band Thu; Monday & Friday left for chess and robotics.",
    },
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "All five clues are public. Verification phase: pin the last two days and check every card against the result.",
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Leo left us Monday and Friday for chess and robotics. My card bans chess from Monday — so chess Friday, robotics Monday. Forced, no choices left.",
    reasoning: "The elegant part: the answer isn't argued into place, it's squeezed into place. My card does the final squeezing.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Otto",
      content: "Resolution: chess ≠ Mon (clue 1) ⇒ chess Fri, robotics Mon. Full candidate: Mon robotics, Tue drama, Wed floorball, Thu band, Fri chess.",
    },
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Verifying Otto's grid against all five cards: chess not Monday — holds. Band two after drama — Tuesday plus two is Thursday, holds. Floorball before band — Wednesday, holds. Robotics not Friday — it's Monday, holds. Drama not Monday — Tuesday, holds. Five of five.",
    reasoning: "Verification is my native habitat. Every constraint checked against the artifact, out loud, so the agreement is earned rather than assumed.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Nea",
      content: "Verification: all 5 clues checked against candidate — 5/5 satisfied. Solution is unique (block position forced by clue 5, edges forced by clues 1+4).",
    },
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "And it's the ONLY answer, right? If the block sat Wednesday, band lands Friday and floorball Thursday — then chess and robotics fight over Monday-Tuesday and Otto's card still forces it... no wait, then NOBODY takes Friday. Contradiction! Nea's right, it's unique!",
    reasoning: "Checking the alternative branch myself instead of taking uniqueness on faith — this task makes even me rigorous, which nobody will believe later.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "build",
    said: "I tried to break it three ways and can't. Signing off. Vilma's contradiction check was the part I'd normally do, so — nothing left to attack.",
    reasoning: "Genuine verification happened, by four different people, from four angles. Skepticism has nothing to eat here. Unfamiliar, not unpleasant.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Verified from multiple angles. Write the final schedule and how you know it's unique.",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Final: Monday robotics, Tuesday drama, Wednesday floorball, Thursday band, Friday chess — with Nea's five-for-five check and Vilma's contradiction proof attached. Every card mattered; remove any one of them and the grid doesn't close.",
    reasoning: "The synthesis writes itself when the process was this clean — my only integration work is crediting the chain in order.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Leo",
      content: "FINAL SCHEDULE: Mon robotics, Tue drama, Wed floorball, Thu band, Fri chess. Uniqueness: clue 5 forces the 3-day block off Monday (eliminating candidate A), clues 1+4 force the remaining edges; alternative block position yields contradiction (verified). All 5 clues satisfied (evaluation-2).",
    },
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Submitted. Fastest agreement we've ever had — and for once nobody had to win it.",
    reasoning: "No decision to force, no closure to push: the structure did my job. Noting, without comment, that the group didn't need a driver today.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: ACCEPTED (score 9/10). Notice three things in the record. Every one of you spoke at nearly the same rate — the task structure did that, not politeness. Every contribution chained onto someone else's by name, because it had to. And consensus arrived by verification, not persuasion: nobody won the argument because there was no argument to win. That is positive interdependence — when the task is built so that you genuinely need each other, collaboration stops being a virtue and becomes the only strategy that works. One point off: you accepted uniqueness thirty seconds before Vilma actually proved it.",
    isVerdict: true,
  },
];

// ── Study the reading: comprehension / reciprocal teaching ─────────────
// The document is the SUBJECT, not a reference: the group studies the
// cooperative-leadership article and builds a shared understanding of it
// (Palincsar & Brown's reciprocal teaching — question, clarify, summarize).
// Authoring constraints the detectors verify: EVERY student turn carries a
// docRef (near-total engagement — the signature, and the inverse of
// "source ignored"); the correction is a run of exactly 2 challenges so it
// reads as clarification, not the conflict chip; Otto re-engages with a
// build after being corrected, so false-consensus cannot fire; balanced
// participation (everyone read the same text). All quotes are verbatim from
// the committed excerpt. Otto misreads positive interdependence as division
// of labour — a real, documented misconception, and an audience callback to
// his divide-and-conquer instinct in the silos task.

const STUDY_READING_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task, and it's an unusual one: you've all read Leppilampi's piece on cooperative leadership. Today you don't design or decide anything — the work is to actually understand it. By the end I want the group's own restatement of what it's claiming, and agreement on what it means. Start by each taking one principle and saying how you read it.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "I'll take face-to-face interaction. The article says leadership should build 'structures that force people to work together' — I love that it's blunt about it. It even suggests putting the tables away in a meeting so people actually talk. Structure first, good intentions second.",
    reasoning: "Start with the principle that has a concrete image — the tables — because a vivid example is the fastest way to make an abstract principle land for the others.",
    docRef: "§ii: leadership builds \"structures that 'force' people to work together\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Vilma",
      content: "Reading of §ii (face-to-face interaction): leadership's job is to build structures that make people work together — the environment does the work, not exhortation.",
    },
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Positive interdependence, that's mine. My read: everyone pulls their weight and you divide the work so nobody's a bottleneck. Efficient teamwork, basically — the group succeeds because each part does its job.",
    reasoning: "State the principle in the terms I actually think in — clean division of responsibility. It's the reading that makes intuitive sense to me.",
    docRef: "§i: positive interdependence (\"boosting the 'we-spirit'\")",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Otto",
      content: "Reading of §i (positive interdependence): everyone pulls their weight; divide work so no one is a bottleneck — efficient teamwork. [FLAGGED in evaluation as a misreading.]",
    },
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Individual accountability. The wording is sharp: a well-functioning group 'will not accept any hitch hikers', and every member brings their own constructive input. So it's the opposite of hiding in a crowd.",
    reasoning: "Quote the exact phrase — 'hitch hikers' — because this principle is easy to soften into a platitude, and the precise wording is what keeps it meaningful.",
    docRef: "§iii: \"A well-functioning group will not accept any 'hitch hikers'\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-3",
      author: "Nea",
      content: "Reading of §iii (individual accountability): no 'hitch hikers'; every member brings their own constructive input and can explain the group's task.",
    },
  },
  {
    speaker: "Sami",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Social skills — and this is the line I actually believe. The article says the assumption that 'employees do not want to take a responsible stance' is misguided; the real issue is how they're invited to participate. That reframes silence as a design failure, not a character flaw.",
    reasoning: "Take the principle that carries a genuine claim I can stand behind — it makes the reading honest rather than dutiful.",
    docRef: "§iv: the issue \"is rather about how they are invited to participate in the discussions\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-4",
      author: "Sami",
      content: "Reading of §iv (social skills): a silent group is a design failure, not proof people are passive — 'the issue is how they are invited to participate'.",
    },
  },
  {
    speaker: "Leo",
    phase: "ideation",
    dialogueMove: "propose",
    said: "That leaves group processing for me. Shared reflection — the article gives the actual questions: 'What happened, and why? Where did we succeed, where failed?' It's the group looking at itself, on purpose.",
    reasoning: "Take the meta-principle and quote its concrete questions, because we may well end up using them on ourselves before the hour is out.",
    docRef: "§v: \"What happened, and why? ... Where did we succeed, where failed?\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-5",
      author: "Leo",
      content: "Reading of §v (group processing): shared reflection using the article's own questions — the group consciously observing how it worked.",
    },
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Five principles, five readings. Now the real work: pressure-test them against the text. Do you actually agree on what they mean — or does one of these readings not survive a second look at the page?",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "One doesn't. Otto — 'divide the work so nobody's a bottleneck' is just efficient division of labour. That's literally the silos task we did. If that were positive interdependence, a well-run assembly line would qualify, and I don't think the article means that.",
    reasoning: "His reading is the common one and it's subtly wrong — name it against a case we all remember, the silos task, so the distinction is concrete rather than pedantic.",
    docRef: "§i vs. §iii: division of labour alone would let a group of 'hitch hikers' pass",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Sami's right, and the text is exact about why. It says each person 'feels both needed AND that she needs others to achieve the common goal.' Otto, your version keeps the first half — people are needed — and drops the second. Needed but not needing anyone is a good assembly line. Interdependence is both directions at once.",
    reasoning: "Correct with the precise wording rather than a paraphrase — the whole misreading lives in the half of the sentence he dropped, so the exact quote is the correction.",
    docRef: "§i verbatim: \"everyone feels both needed and that she needs others to achieve the common goal\"",
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "build",
    said: "...Huh. Yeah. I read it straight through my own habit — split it up, stay out of each other's way. But that's the opposite of what it says. 'The success of a group depends on the success of each of its members.' Not the sum of the parts — each one needing the rest. Okay. I had it backwards.",
    reasoning: "The correction is right and I can see exactly where my habit overwrote the text. Say so plainly — updating out loud is the point of the exercise, and pretending I'd meant this all along would be worse.",
    docRef: "§i: \"The success of a group depends on the success of each of its members\"",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Otto",
      content: "CORRECTION to idea-2: positive interdependence ≠ division of labour. The text requires BOTH being needed AND needing others; my first reading kept only the first half.",
    },
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "That's the 'same boat' line, isn't it? Otto, you didn't just describe being in the boat — the point is you need the others rowing or you don't move. The picture only works if everyone's oar matters.",
    reasoning: "Reinforce the corrected reading with the article's own image so it sticks for everyone, not just Otto — a metaphor consolidates what the precise quote just fixed.",
    docRef: "§i: \"Everyone feels being 'in the same boat'\"",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "And notice what just happened — that WAS principle five. We hit a misreading, we reflected on it against the text, and we fixed it. 'What happened, and why.' We just did group processing on ourselves without meaning to.",
    reasoning: "Point out that the group just enacted the very principle it's studying — the most convincing way to show understanding is to catch it happening live.",
    docRef: "§v: the group-processing question \"What happened, and why?\" — applied to ourselves",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Leo",
      content: "Meta-observation: the group corrected Otto's misreading by re-reading the text together — an unplanned instance of §v (group processing) in action.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "You just did the thing the article describes, not the thing it says. Now write it down — the shared understanding, in your own words, with the correction on the record.",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Shared version, then: cooperative leadership isn't managing people, it's building a group where each person needs the others to succeed — and knows it. And the article's own test for whether you've got it: the difference from ordinary teamwork 'is not so much in what is done, but rather in how it is done and how conflicts are handled.'",
    reasoning: "Assemble the group's restatement in plain language and anchor it to the article's own criterion, so the synthesis is ours but still verifiably the text's claim.",
    docRef: "closing: \"...not so much in what is done, but rather in how it is done and how conflicts are handled\"",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Leo",
      content: "SHARED UNDERSTANDING: cooperative leadership = building a group where each member needs the others to succeed and knows it. Test: not WHAT is done but HOW, and how conflict is handled (article's own criterion).",
    },
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Takeaway, and I should be the one to say it since I got it wrong first: you cannot divide your way to cooperative leadership. The whole point is you can't do it alone and you know you can't. 'The success of a group depends on the success of each of its members.'",
    reasoning: "Own the corrected reading out loud as the closing statement — the person who misread it stating it right is the strongest evidence the group actually understands it.",
    docRef: "§i: \"The success of a group depends on the success of each of its members\"",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-2",
      author: "Otto",
      content: "TAKEAWAY (from the member who first misread it): you can't divide your way to cooperative leadership — the point is mutual dependence, consciously held.",
    },
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Keeping the correction in the notes so it doesn't quietly come back: positive interdependence is not division of labour. Needed and needing. Both halves.",
    reasoning: "Pin the exact distinction in writing — misreadings that get corrected verbally have a way of reappearing unless the record holds the precise line.",
    docRef: "§i: \"both needed and that she needs others\" — recorded to prevent the misreading recurring",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "And my one from the start still fits under it — the 'structures that force people to work together' are how you build a boat where everyone has to row. Principle two serves principle one. It's actually one idea.",
    reasoning: "Tie my opening principle back into the corrected centre, showing the five aren't a list but a connected whole — that connection is a sign we understood rather than just catalogued.",
    docRef: "§ii + §i: structures that \"force people to work together\" serve the mutual dependence of §i",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "build",
    said: "For the record, I still think the piece is light on what you do when someone genuinely won't get in the boat — it trusts invitation to do a lot. But that's a critique of the argument, not a misreading of it. I understand what it's claiming now, which was the actual task.",
    reasoning: "Separate a fair criticism of the article from a failure to understand it — signalling that comprehension doesn't require agreement is itself part of understanding the text well.",
    docRef: "§iv: the reliance on how people \"are invited to participate\" — my open critique, not a misreading",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "You understand it. Now the deepest part — reflect out loud: how would these five principles actually show up in practice? Not the definitions — the behaviours. Take them one at a time, in this group or a workplace you know, and be concrete.",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Positive interdependence in practice: a shared deliverable where my part literally fails if yours does. Not 'we each hand in a section' — one document, one grade, and I have a real reason to care whether you're stuck. The moment I can succeed while you sink, the principle's already gone.",
    reasoning: "Make the abstract concrete with the failure condition — a principle you can't picture as behaviour hasn't really been understood.",
    docRef: "§i: \"The success of a group depends on the success of each of its members\" — in practice",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Individual accountability in practice is a test I can actually run: at any moment, can each person explain the whole group's task and where it stands — not just their own slice? If someone can only describe their corner, the accountability is fake.",
    reasoning: "Turn the principle into a checkable behaviour — as the one who misread earlier, I trust a concrete test more than a good feeling.",
    docRef: "§iii: each member \"takes charge of her own share\" and brings constructive input — made testable",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "challenge",
    said: "Here's where I push back, though. Vilma took principle two — 'structures that force people to work together'. In practice, 'force' is doing a lot of work in that sentence. If I only collaborate because the room was arranged so I can't hide, is that collaboration, or just compliance in nicer clothes? A structure that forces me isn't the same as me wanting in.",
    reasoning: "The principle sounds benign until you sit in the forced seat. Naming the tension between structure and genuine buy-in is the reflection the text invites but never resolves.",
    docRef: "§ii: \"structures that 'force' people to work together\" — challenged: forced participation vs. genuine buy-in",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Sami's right that it's the sharp edge of the whole thing. But read what the text actually does with 'force' — the example is putting the tables away. That's not coercion, it's removing the option to disappear. The structure makes joining the easy path, not the punished one. Though I'll grant you the line between scaffolding and control isn't printed anywhere — that one's ours to hold.",
    reasoning: "Reframe without dismissing — the mediator's job is to hold both truths at once: the text means scaffolding, and Sami's worry about where that tips into control is real and unanswered.",
    docRef: "§ii: \"structures that 'force' people to work together\" — read as scaffolding; the scaffolding/control line left open",
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Then make principle four operational, because it's the cheapest to actually do. The text gives one rule: 'talk to your neighbours about what you just heard.' That's not a value, it's a meeting move. Open every review with ninety seconds of it and the silent people are already in. Measurable, and free.",
    reasoning: "The most practical principle is the one with a concrete procedure attached — turn §iv from a virtue into a scheduled behaviour.",
    docRef: "§iv: \"talk to your neighbours about what you just heard\" — as a standing meeting rule",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "And close the loop with principle five — but as a ritual, not an afterthought. Every project ends with the article's own four questions: what happened and why, how did it feel, where did we succeed, where did we fail. If reflection is scheduled it happens; if it's optional it evaporates.",
    reasoning: "Group processing only exists in practice if it's built into the calendar — name the ritual so it survives contact with a busy week.",
    docRef: "§v: \"What happened, and why? ... Where did we succeed, where failed?\" — as a closing ritual",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "So the five aren't a poster, they're a way to run a room: one shared fate, a structure that makes joining the easy path, a test that everyone can explain the whole, ninety seconds of neighbour-talk to open, and the four questions to close. And Sami's edge stays in the margin on purpose — the day 'structure' starts to feel like control, that's the signal to loosen it.",
    reasoning: "Assemble the practice version as a sequence you could actually follow, and keep Sami's unresolved tension visible rather than smoothing it over — an honest synthesis holds the open question.",
    docRef: "§i + §ii: the five principles as an operating routine, the scaffolding/control line kept open",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-3",
      author: "Leo",
      content: "IN PRACTICE: (1) §i one shared deliverable with a real shared fate; (2) §ii a structure that makes participation the easy path (tables away), watching the scaffolding/control line; (3) §iii each member can explain the whole, not just their slice; (4) §iv open every review with 90s of neighbour-talk; (5) §v close every project with the article's four reflection questions. Open tension (Sami): where 'structure' tips into compulsion.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: UNDERSTOOD — and now applied (score 9/10). You did the rare thing: you moved from what the text means to what it would make you DO on a Monday morning, and you kept it concrete — a shared deliverable, tables away, the neighbour-talk rule, the closing questions. And Sami finally pressure-tested principle two, which last time nobody touched: is a structure that 'forces' collaboration real collaboration, or just compliance? He's right that the text doesn't answer it, and you were right to leave it open rather than paper over it — that unresolved line is the most honest sentence in your whole synthesis. The point I'm still holding: every example was about how the group behaves, none about what the leader risks when the scaffolding fails. Next time, sit in the chair that has to decide when to loosen it.",
    isVerdict: true,
  },
];

// Finnish flagship — a structural mirror of STUDY_READING_TURNS. Every
// speaker/phase/dialogueMove/docRef-presence/isVerdict and every student
// name mention (Sami→Otto turn 8; Otto turns 7,8,10) is preserved, so the
// dynamics fingerprint is identical. docRefs quote the Finnish source.
const STUDY_READING_TURNS_FI: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "Uusi tehtävä, ja tavallisesta poikkeava: olette kaikki lukeneet Leppilammen tekstin yhteistoiminnallisesta johtajuudesta. Tänään ette suunnittele ettekä päätä mitään — työnä on ymmärtää se aidosti. Lopuksi haluan ryhmän oman muotoilun siitä, mitä teksti väittää, ja yksimielisyyden siitä, mitä se tarkoittaa. Aloittakaa niin, että kukin ottaa yhden periaatteen ja kertoo, miten sen luki.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Otan kasvokkaisen vuorovaikutuksen. Artikkeli sanoo, että johtajuuden pitäisi rakentaa 'rakenteita, jotka pakottavat ihmiset työskentelemään yhdessä' — rakastan sitä, miten suoraan se sen sanoo. Se jopa ehdottaa pöytien siirtämistä pois kokouksesta, jotta ihmiset oikeasti puhuvat. Rakenne ensin, hyvät aikomukset toiseksi.",
    reasoning: "Aloita periaatteesta, jolla on konkreettinen kuva — pöydät — koska elävä esimerkki saa abstraktin periaatteen nopeimmin tarttumaan muihin.",
    docRef: "§ii: johtajuus rakentaa \"rakenteita, jotka 'pakottavat' ihmiset työskentelemään yhdessä\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Vilma",
      content: "Tulkinta §ii (kasvokkainen vuorovaikutus): johtajuuden tehtävä on rakentaa rakenteet, jotka saavat ihmiset työskentelemään yhdessä — ympäristö tekee työn, ei kehotus.",
    },
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Positiivinen keskinäisriippuvuus, se on minun. Oma lukutapani: jokainen vetää oman kortensa kekoon ja työ jaetaan niin, ettei kukaan ole pullonkaula. Tehokasta tiimityötä pohjimmiltaan — ryhmä onnistuu, koska jokainen osa hoitaa tehtävänsä.",
    reasoning: "Muotoile periaate niillä käsitteillä, joilla itse todella ajattelen — selkeä vastuunjako. Se on tulkinta, joka minusta tuntuu intuitiiviselta.",
    docRef: "§i: positiivinen keskinäisriippuvuus (\"me-hengen\" vahvistaminen)",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Otto",
      content: "Tulkinta §i (positiivinen keskinäisriippuvuus): jokainen vetää oman kortensa kekoon; työ jaetaan niin ettei synny pullonkauloja — tehokasta tiimityötä. [MERKITTY arviointivaiheessa väärinluennaksi.]",
    },
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Yksilöllinen vastuu. Sanamuoto on terävä: hyvin toimiva ryhmä 'ei hyväksy yhtään vapaamatkustajaa', ja jokainen jäsen tuo oman rakentavan panoksensa. Se on siis päinvastaista kuin joukkoon piiloutuminen.",
    reasoning: "Lainaa täsmällinen ilmaus — 'vapaamatkustaja' — koska tämä periaate on helppo pehmentää latteudeksi, ja juuri tarkka sanamuoto pitää sen merkityksellisenä.",
    docRef: "§iii: \"Hyvin toimiva ryhmä ei hyväksy yhtään 'vapaamatkustajaa'\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-3",
      author: "Nea",
      content: "Tulkinta §iii (yksilöllinen vastuu): ei 'vapaamatkustajia'; jokainen tuo oman rakentavan panoksensa ja osaa selittää ryhmän tehtävän.",
    },
  },
  {
    speaker: "Sami",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Vuorovaikutustaidot — ja tähän lauseeseen todella uskon. Artikkeli sanoo, että oletus 'työntekijät eivät halua ottaa vastuullista asennetta' on harhaanjohtava; todellinen kysymys on, miten heidät kutsutaan mukaan. Se muuttaa hiljaisuuden suunnitteluvirheeksi, ei luonteenvioksi.",
    reasoning: "Ota periaate, joka kantaa aidon väitteen, jonka takana voin seistä — se tekee lukutavasta rehellisen eikä velvollisuudentäyttöä.",
    docRef: "§iv: kysymys \"on pikemminkin siitä, miten heidät kutsutaan mukaan keskusteluun\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-4",
      author: "Sami",
      content: "Tulkinta §iv (vuorovaikutustaidot): hiljainen ryhmä on suunnitteluvirhe, ei todiste passiivisuudesta — 'kyse on siitä, miten heidät kutsutaan mukaan'.",
    },
  },
  {
    speaker: "Leo",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Minulle jää ryhmän prosessointi. Jaettu reflektointi — artikkeli antaa varsinaiset kysymykset: 'Mitä tapahtui, ja miksi? Missä onnistuimme, missä epäonnistuimme?' Se on ryhmä, joka katsoo itseään, tarkoituksella.",
    reasoning: "Ota metaperiaate ja lainaa sen konkreettiset kysymykset, koska saatamme hyvinkin käyttää niitä itseemme ennen tunnin loppua.",
    docRef: "§v: \"Mitä tapahtui, ja miksi? ... Missä onnistuimme, missä epäonnistuimme?\"",
    workspaceEntry: {
      list: "ideas",
      id: "idea-5",
      author: "Leo",
      content: "Tulkinta §v (ryhmän prosessointi): jaettu reflektointi artikkelin omilla kysymyksillä — ryhmä tarkkailee tietoisesti, miten se toimi.",
    },
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Viisi periaatetta, viisi lukutapaa. Nyt varsinainen työ: koetelkaa niitä tekstiä vasten. Oletteko todella yhtä mieltä siitä, mitä ne tarkoittavat — vai eikö jokin näistä lukutavoista kestä toista silmäystä sivulle?",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Yksi ei kestä. Otto — 'jaetaan työ niin ettei kukaan ole pullonkaula' on pelkkää tehokasta työnjakoa. Se on juuri se siilotehtävä, jonka teimme. Jos se olisi positiivista keskinäisriippuvuutta, hyvin pyörivä liukuhihna kelpaisi, enkä usko artikkelin tarkoittavan sitä.",
    reasoning: "Hänen lukutapansa on yleinen ja hienovaraisesti väärä — nimeä se tapausta vasten, jonka kaikki muistamme, siilotehtävän, jotta erottelu on konkreettinen eikä saivartelua.",
    docRef: "§i vs. §iii: pelkkä työnjako päästäisi läpi ryhmän täynnä 'vapaamatkustajia'",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Sami on oikeassa, ja teksti on täsmällinen siitä, miksi. Se sanoo, että jokainen tuntee olevansa 'sekä tarpeellinen ETTÄ tarvitsevansa muita yhteisen tavoitteen saavuttamiseksi'. Otto, sinun versiosi säilyttää ensimmäisen puolikkaan — ihmiset ovat tarpeellisia — ja pudottaa toisen. Tarpeellinen mutta ei ketään tarvitseva on hyvä liukuhihna. Keskinäisriippuvuus on molempiin suuntiin yhtä aikaa.",
    reasoning: "Korjaa täsmällisellä sanamuodolla parafraasin sijaan — koko väärinluenta piilee siinä lauseen puolikkaassa, jonka hän pudotti, joten juuri tarkka lainaus on korjaus.",
    docRef: "§i sanatarkasti: \"jokainen tuntee olevansa sekä tarpeellinen että tarvitsevansa muita yhteisen tavoitteen saavuttamiseksi\"",
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "build",
    said: "...Hetkinen. Niin. Luin sen suoraan oman tapani läpi — pilko osiin, pysykää toistenne tieltä. Mutta sehän on päinvastaista kuin mitä siinä sanotaan. 'Ryhmän menestys riippuu jokaisen jäsenensä menestyksestä.' Ei osien summa — jokainen tarvitsee muut. Selvä. Minulla oli se väärinpäin.",
    reasoning: "Korjaus on oikea ja näen tarkalleen, missä tapani ylikirjoitti tekstin. Sano se suoraan — ääneen päivittäminen on koko harjoituksen pointti, ja teeskentely että olisin tarkoittanut tätä alusta asti olisi pahempaa.",
    docRef: "§i: \"Ryhmän menestys riippuu jokaisen jäsenensä menestyksestä\"",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Otto",
      content: "KORJAUS ideaan idea-2: positiivinen keskinäisriippuvuus ≠ työnjako. Teksti vaatii SEKÄ tarpeellisuutta ETTÄ toisten tarvitsemista; ensimmäinen lukutapani säilytti vain edellisen.",
    },
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Sehän on se 'samassa veneessä' -kohta, eikö? Otto, et vain kuvannut veneessä olemista — pointti on, että tarvitset muut soutamaan tai vene ei liiku. Kuva toimii vain, jos jokaisen airo on tärkeä.",
    reasoning: "Vahvista korjattu lukutapa artikkelin omalla kuvalla, jotta se jää mieleen kaikille, ei vain Otolle — vertauskuva vakiinnuttaa sen, minkä tarkka lainaus juuri korjasi.",
    docRef: "§i: \"Jokainen tuntee olevansa 'samassa veneessä'\"",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Ja huomatkaa mitä juuri tapahtui — se OLI periaate viisi. Osuimme väärinluentaan, reflektoimme sitä tekstiä vasten ja korjasimme sen. 'Mitä tapahtui, ja miksi.' Teimme juuri ryhmän prosessointia itsellemme sitä tarkoittamatta.",
    reasoning: "Osoita, että ryhmä juuri toteutti sen periaatteen, jota se tutkii — vakuuttavin tapa näyttää ymmärrys on napata se tapahtumasta livenä.",
    docRef: "§v: ryhmän prosessoinnin kysymys \"Mitä tapahtui, ja miksi?\" — sovellettuna itseemme",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Leo",
      content: "Metahavainto: ryhmä korjasi Oton väärinluennan lukemalla tekstin yhdessä uudelleen — suunnittelematon esimerkki §v:stä (ryhmän prosessointi) käytännössä.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Teitte juuri sen, mitä artikkeli kuvaa, ette sitä mitä se sanoo. Kirjoittakaa se nyt ylös — jaettu ymmärrys omin sanoin, korjaus mukaan kirjattuna.",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Jaettu versio siis: yhteistoiminnallinen johtajuus ei ole ihmisten johtamista, vaan sellaisen ryhmän rakentamista, jossa jokainen tarvitsee muita menestyäkseen — ja tietää sen. Ja artikkelin oma testi sille, oletko tavoittanut asian: ero tavalliseen tiimityöhön 'ei ole niinkään siinä, mitä tehdään, vaan pikemminkin siinä, miten se tehdään ja miten konfliktit käsitellään'.",
    reasoning: "Koosta ryhmän muotoilu selkokielellä ja ankkuroi se artikkelin omaan kriteeriin, jotta synteesi on meidän mutta silti todistettavasti tekstin väite.",
    docRef: "loppukappale: \"...ei niinkään siinä, mitä tehdään, vaan pikemminkin siinä, miten se tehdään ja miten konfliktit käsitellään\"",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Leo",
      content: "JAETTU YMMÄRRYS: yhteistoiminnallinen johtajuus = sellaisen ryhmän rakentaminen, jossa jokainen tarvitsee muita menestyäkseen ja tietää sen. Testi: ei MITÄ tehdään vaan MITEN, ja miten konflikti käsitellään (artikkelin oma kriteeri).",
    },
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Ydinviesti, ja minun se pitäisi sanoa, koska luin sen ensin väärin: yhteistoiminnalliseen johtajuuteen ei pääse jakamalla. Koko pointti on, ettet pärjää yksin ja tiedät sen. 'Ryhmän menestys riippuu jokaisen jäsenensä menestyksestä.'",
    reasoning: "Omista korjattu lukutapa ääneen loppulauseena — se, että väärinlukija sanoo sen oikein, on vahvin todiste siitä, että ryhmä todella ymmärtää.",
    docRef: "§i: \"Ryhmän menestys riippuu jokaisen jäsenensä menestyksestä\"",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-2",
      author: "Otto",
      content: "YDINVIESTI (jäseneltä, joka luki sen ensin väärin): yhteistoiminnalliseen johtajuuteen ei pääse jakamalla työtä — pointti on tietoisesti pidetty keskinäinen riippuvuus.",
    },
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Pidän korjauksen muistiinpanoissa, ettei se hiljaa palaa: positiivinen keskinäisriippuvuus ei ole työnjakoa. Tarpeellinen ja tarvitseva. Molemmat puolikkaat.",
    reasoning: "Kirjaa tarkka erottelu ylös — suullisesti korjatuilla väärinluennoilla on tapana palata, ellei muistiin jää täsmällistä lausetta.",
    docRef: "§i: \"sekä tarpeellinen että tarvitsevansa muita\" — kirjattu estämään väärinluennan palaaminen",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Ja oma alkuperäiseni sopii yhä tämän alle — 'rakenteet, jotka pakottavat ihmiset työskentelemään yhdessä' ovat tapa rakentaa vene, jossa kaikkien on soudettava. Periaate kaksi palvelee periaatetta yksi. Se on itse asiassa yksi idea.",
    reasoning: "Kytke oma avausperiaatteeni takaisin korjattuun ytimeen ja näytä, että viisi eivät ole lista vaan yhtenäinen kokonaisuus — se yhteys on merkki ymmärryksestä, ei pelkästä luettelosta.",
    docRef: "§ii + §i: rakenteet, jotka \"pakottavat ihmiset työskentelemään yhdessä\", palvelevat §i:n keskinäistä riippuvuutta",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Kirjattakoon, että minusta teksti on yhä ohut siitä, mitä teet, kun joku ei aidosti suostu veneeseen — se luottaa kutsuun aika paljon. Mutta se on kritiikkiä argumenttia kohtaan, ei sen väärinluentaa. Ymmärrän nyt, mitä se väittää, mikä oli varsinainen tehtävä.",
    reasoning: "Erota reilu kritiikki artikkelia kohtaan siitä, ettei sitä ymmärrä — sen osoittaminen, ettei ymmärrys vaadi samaa mieltä olemista, on itsessään osa tekstin hyvää ymmärtämistä.",
    docRef: "§iv: luottaminen siihen, miten ihmiset \"kutsutaan mukaan\" — avoin kritiikkini, ei väärinluenta",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Ymmärrätte tekstin. Nyt syvin osa — pohtikaa ääneen: miten nämä viisi periaatetta oikeasti näkyisivät käytännössä? Eivät määritelmät — teot. Ottakaa yksi kerrallaan, tässä ryhmässä tai työpaikalla jonka tunnette, ja olkaa konkreettisia.",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Positiivinen keskinäisriippuvuus käytännössä: yhteinen tuotos, jossa minun osani kirjaimellisesti kaatuu, jos sinun kaatuu. Ei 'jokainen palauttaa oman osionsa' — yksi dokumentti, yksi arvosana, ja minulla on aito syy välittää siitä, oletko jumissa. Sillä hetkellä kun voin onnistua sinun upotessasi, periaate on jo mennyt.",
    reasoning: "Tee abstraktista konkreettista epäonnistumisehdon kautta — periaatetta, jota et osaa kuvitella tekona, ei ole oikeasti ymmärretty.",
    docRef: "§i: \"Ryhmän menestys riippuu jokaisen jäsenensä menestyksestä\" — käytännössä",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Yksilöllinen vastuu käytännössä on testi, jonka voin oikeasti tehdä: pystyykö jokainen milloin tahansa selittämään koko ryhmän tehtävän ja sen tilan — ei vain omaa siivuaan? Jos joku osaa kuvata vain oman nurkkansa, vastuu on näennäistä.",
    reasoning: "Muuta periaate tarkistettavaksi teoksi — väärinlukijana luotan konkreettiseen testiin enemmän kuin hyvään fiilikseen.",
    docRef: "§iii: jokainen \"hoitaa myös oman osuutensa niin hyvin kuin mahdollista\" ja tuo rakentavan panoksensa — testattavaksi tehtynä",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "challenge",
    said: "Tässä kohtaa kuitenkin panen vastaan. Vilma otti periaatteen kaksi — 'rakenteet, jotka pakottavat ihmiset työskentelemään yhdessä'. Käytännössä 'pakottaa' tekee siinä lauseessa paljon työtä. Jos teen yhteistyötä vain siksi, että huone järjestettiin niin etten voi piiloutua, onko se yhteistyötä vai pelkkää mukautumista hienommassa paketissa? Rakenne, joka pakottaa minut, ei ole sama kuin että itse haluaisin mukaan.",
    reasoning: "Periaate kuulostaa vaarattomalta, kunnes istut siinä pakotetussa tuolissa. Rakenteen ja aidon sitoutumisen jännitteen nimeäminen on juuri sitä reflektiota, jota teksti kutsuu mutta ei koskaan ratkaise.",
    docRef: "§ii: \"rakenteita, jotka 'pakottavat' ihmiset työskentelemään yhdessä\" — haastettu: pakotettu osallistuminen vs. aito sitoutuminen",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Sami on oikeassa, että se on koko asian terävin reuna. Mutta lue mitä teksti oikeasti tekee 'pakottamisella' — esimerkki on pöytien siirtäminen pois. Se ei ole pakottamista, se on piiloutumisen vaihtoehdon poistamista. Rakenne tekee mukaan tulemisesta helpon polun, ei rangaistun. Myönnän silti: rajaa tuen ja kontrollin välillä ei ole painettu mihinkään — se jää meidän pidettäväksi.",
    reasoning: "Kehystä uudelleen tyrmäämättä — sovittelijan tehtävä on pitää molemmat totuudet yhtä aikaa: teksti tarkoittaa tukirakennetta, ja Samin huoli siitä, missä se kääntyy kontrolliksi, on aito ja vastaamaton.",
    docRef: "§ii: \"rakenteita, jotka 'pakottavat' ihmiset työskentelemään yhdessä\" — luettuna tukirakenteena; tuki/kontrolli-raja jätetty auki",
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Tehkää sitten periaate neljä toiminnalliseksi, koska se on halvin oikeasti toteuttaa. Teksti antaa yhden säännön: 'puhukaa hetki naapureidenne kanssa siitä, mitä juuri kuulitte.' Se ei ole arvo, se on kokousliike. Avatkaa jokainen katselmus yhdeksälläkymmenellä sekunnilla sitä, ja hiljaiset ovat jo mukana. Mitattavaa, ja ilmaista.",
    reasoning: "Käytännöllisin periaate on se, johon liittyy konkreettinen menettely — muuta §iv hyveestä aikataulutetuksi toiminnaksi.",
    docRef: "§iv: \"Puhukaa hetki naapureidenne kanssa siitä, mitä juuri kuulitte\" — vakiintuneena kokoussääntönä",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Ja sulkekaa ympyrä periaatteella viisi — mutta rituaalina, ei jälkiajatuksena. Jokainen projekti päättyy artikkelin omiin neljään kysymykseen: mitä tapahtui ja miksi, miltä tuntui, missä onnistuimme, missä epäonnistuimme. Jos reflektointi on aikataulutettu, se tapahtuu; jos se on vapaaehtoista, se haihtuu.",
    reasoning: "Ryhmän prosessointi on olemassa käytännössä vain jos se on rakennettu kalenteriin — nimeä rituaali, jotta se selviää kiireisen viikon yli.",
    docRef: "§v: \"Mitä tapahtui, ja miksi? ... Missä onnistuimme, missä epäonnistuimme?\" — päättävänä rituaalina",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Eli viisi ei ole juliste, se on tapa vetää huonetta: yksi yhteinen kohtalo, rakenne joka tekee mukaan tulemisesta helpon polun, testi että jokainen osaa selittää kokonaisuuden, yhdeksänkymmentä sekuntia naapuripuhetta aluksi, ja neljä kysymystä lopuksi. Ja Sami saa pitää reunansa marginaalissa tarkoituksella — sinä päivänä kun 'rakenne' alkaa tuntua kontrollilta, se on merkki löysätä.",
    reasoning: "Koosta käytännön versio sarjaksi, jota voisi oikeasti seurata, ja pidä Samin ratkaisematon jännite näkyvissä sen sijaan että silottaisit sen — rehellinen synteesi pitää avoimen kysymyksen.",
    docRef: "§i + §ii: viisi periaatetta toimintarutiinina, tuki/kontrolli-raja jätetty auki",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-3",
      author: "Leo",
      content: "KÄYTÄNNÖSSÄ: (1) §i yksi yhteinen tuotos, jolla on aito yhteinen kohtalo; (2) §ii rakenne, joka tekee osallistumisesta helpon polun (pöydät pois), tuki/kontrolli-rajaa vahtien; (3) §iii jokainen osaa selittää kokonaisuuden, ei vain siivuaan; (4) §iv avaa jokainen katselmus 90 s naapuripuheella; (5) §v päätä jokainen projekti artikkelin neljään reflektiokysymykseen. Avoin jännite (Sami): missä 'rakenne' kääntyy pakoksi.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Arvio: YMMÄRRETTY — ja nyt sovellettu (arvosana 9/10). Teitte harvinaisen asian: siirryitte siitä, mitä teksti tarkoittaa, siihen, mitä se panisi teidät TEKEMÄÄN maanantaiaamuna, ja piditte sen konkreettisena — yhteinen tuotos, pöydät pois, naapuripuhesääntö, päättävät kysymykset. Ja Sami vihdoin koetteli periaatetta kaksi, jota viime kerralla kukaan ei koskenut: onko rakenne, joka 'pakottaa' yhteistyöhön, aitoa yhteistyötä vai pelkkää mukautumista? Hän on oikeassa, ettei teksti vastaa siihen, ja te teitte oikein jättäessänne sen auki sen sijaan että olisitte silottaneet sen — tuo ratkaisematon rivi on koko synteesinne rehellisin lause. Piste jonka yhä pidätän: jokainen esimerkki koski sitä, miten ryhmä käyttäytyy, ei sitä, mitä johtaja panee peliin, kun tukirakenne pettää. Ensi kerralla istukaa siihen tuoliin, jonka on päätettävä, milloin löysätä.",
    isVerdict: true,
  },
];

export const TASK_LIBRARY: TaskDefinition[] = [
  {
    id: "lapland",
    label: "Open design (negotiation)",
    task: {
      title: "Design a sustainable tourism product for Lapland",
      deliverable: "A runnable concept: target traveler, the experience, a real sustainability mechanism, and a price point.",
    },
    profile: {
      structure: "open",
      interdependence: "high",
      consensusMode: "negotiated",
      speakingWeights: { Vilma: 0.85, Otto: 0.8, Nea: 0.6, Sami: 0.6, Leo: 0.8 },
      turnLengthBias: "long",
      transactivityTarget: "dense",
      expectedSignature: [
        "dense crisscross arcs — everyone builds on everyone",
        "balanced bars, leadership migrates",
        "friction without war: short red bursts, absorbed",
        "convergence arrives LATE",
      ],
    },
    sourceDocument: { ...laplandCaseDoc, kind: "case-study" },
    turns: LAPLAND_TURNS,
  },
  {
    id: "divide-solve",
    label: "Divide & solve (silos)",
    task: {
      title: "Divide and solve: the statistics problem set",
      deliverable: "One combined answer sheet with all twelve problems solved and checked.",
    },
    profile: {
      structure: "closed",
      interdependence: "low",
      consensusMode: "aggregated",
      speakingWeights: { Vilma: 0.5, Otto: 0.8, Nea: 0.9, Sami: 0.7, Leo: 0.3 },
      turnLengthBias: "short",
      transactivityTarget: "sparse",
      expectedSignature: [
        "arcs fade out — parallel silos",
        "flat-ish bars, but nobody talks TO anyone",
        "zero red: nothing gets challenged",
        "Leo starves — nothing to mediate",
      ],
    },
    turns: DIVIDE_TURNS,
  },
  {
    id: "dilemma",
    label: "Forced dilemma (false consensus)",
    task: {
      title: "The surveillance dilemma: choose one option, unanimously",
      deliverable: "One unanimous group decision — adopt fully, reject fully, or pilot — recorded with its rationale, in twenty minutes.",
    },
    profile: {
      structure: "open",
      interdependence: "adversarial",
      consensusMode: "forced",
      speakingWeights: { Vilma: 0.6, Otto: 1.0, Nea: 0.35, Sami: 0.95, Leo: 0.4 },
      turnLengthBias: "short",
      transactivityTarget: "polarized",
      expectedSignature: [
        "red cluster — Otto vs Sami polarize",
        "skewed bars: two voices >50%",
        "Nea steamrolled once, then silent",
        "'unanimous' with dissent unresolved → False consensus?",
      ],
    },
    sourceDocument: { ...surveillanceBriefDoc, kind: "contested-brief" },
    turns: DILEMMA_TURNS,
  },
  {
    id: "jigsaw",
    label: "Jigsaw puzzle (interdependence)",
    task: {
      title: "The scheduling puzzle: five clues, one answer",
      deliverable: "The unique weekly schedule for the five clubs, with a verification that all five clues are satisfied.",
    },
    profile: {
      structure: "closed",
      interdependence: "high",
      consensusMode: "verified",
      speakingWeights: { Vilma: 0.7, Otto: 0.7, Nea: 0.7, Sami: 0.7, Leo: 0.7 },
      turnLengthBias: "mixed",
      transactivityTarget: "chained",
      expectedSignature: [
        "round-robin: even Nea speaks at full rate",
        "chained arcs — every turn names the previous link",
        "zero red: verification, not persuasion",
        "flattest bars of all four tasks",
      ],
    },
    turns: JIGSAW_TURNS,
  },
  {
    id: "study-reading",
    label: "Study the reading (comprehension)",
    task: {
      title: "Understand the reading: cooperative leadership",
      deliverable:
        "A shared, plain-language restatement of what cooperative leadership actually claims — plus the misreadings the group corrected along the way.",
    },
    profile: {
      structure: "closed",
      interdependence: "high",
      consensusMode: "verified",
      speakingWeights: { Vilma: 0.7, Otto: 0.7, Nea: 0.7, Sami: 0.7, Leo: 0.7 },
      turnLengthBias: "mixed",
      transactivityTarget: "dense",
      expectedSignature: [
        "everyone cites the text — near-total engagement",
        "a confident misreading, caught against the source",
        "balanced bars — same reading, shared floor",
        "consensus by re-reading, not argument",
      ],
    },
    sourceDocument: { ...cooperativeLeadershipDoc, kind: "article" },
    turns: STUDY_READING_TURNS,
    fi: {
      label: "Lue teksti (ymmärtäminen)",
      task: {
        title: "Ymmärrä teksti: yhteistoiminnallinen johtajuus",
        deliverable:
          "Ryhmän oma, selkokielinen muotoilu siitä, mitä yhteistoiminnallinen johtajuus todella väittää — sekä matkan varrella korjatut väärinluennat.",
      },
      expectedSignature: [
        "kaikki viittaavat tekstiin — lähes täysi sitoutuminen",
        "itsevarma väärinluenta, napattu lähdettä vasten",
        "tasaiset palkit — sama luettava, jaettu pohja",
        "yksimielisyys uudelleenlukemalla, ei väittelemällä",
      ],
      sourceDocument: { ...cooperativeLeadershipDocFi, kind: "article" },
      turns: STUDY_READING_TURNS_FI,
    },
  },
];
