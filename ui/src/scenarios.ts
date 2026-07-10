// Hand-authored demo scenarios for the pedagogical dynamics layer.
//
// Each script is written so its target phenomenon fires ON CUE and is
// hand-checked against the detectors in dynamics.ts:
// - "free-rider": Leo takes 1 of 11 student turns (9% < 10% threshold with
//   >= 8 student turns) and receives almost no name mentions — lopsided
//   bars, a bare node in the arc overlay, and the free-rider chip.
// - "conflict": five consecutive student challenge moves in Evaluation
//   (>= 3 fires the chip), concentrated in a reciprocal Sami<->Otto edge;
//   Leo keeps 2 turns so the free-rider detector correctly stays silent.
// All moves are hand-tagged (dialogueMove), so nothing shown on stage
// depends on the heuristic classifier.

import { DEMO_TASK, DEMO_TURNS, type TurnView } from "./data";

export interface Scenario {
  id: string;
  label: string;
  task: { title: string; deliverable: string };
  turns: TurnView[];
}

const FREE_RIDER_TASK = {
  title: "Exam-Week Energy: a one-week smoothie pop-up",
  deliverable:
    "A one-page plan for a pop-up smoothie stand in the library lobby during exam week: product, pricing, staffing, and one number that proves it breaks even.",
};

const FREE_RIDER_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task: Exam-Week Energy. Design a one-week pop-up smoothie stand for the library lobby during exam week. Real product, real prices, real staffing — and one number that proves it breaks even. Ideation starts now.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Okay okay — smoothie flavors named after courses! Like 'Intro to Mango', 'Advanced Beetroot'... and a loyalty punch card, five stamps and your sixth one's free!",
    reasoning: "Get the fun hook on the table first — themed flavors make the stand memorable, and memorable is marketing we don't have to pay for.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Vilma",
      content: "Course-themed smoothie menu ('Intro to Mango', 'Advanced Beetroot') plus a loyalty punch card (buy 5, get 6th free) to pull repeat visits across the exam week.",
    },
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Fine, that's the fun. Here's the engine: three flavors only, pre-batched at 7am, four euros flat. Nobody queues more than ninety seconds during exam week. Speed IS the product.",
    reasoning: "Vilma's hook needs an operations spine. Constraining the menu is the one decision that makes everything else — staffing, prep, price — simple.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Otto",
      content: "Operations-first model: exactly 3 flavors, pre-batched each morning, flat 4 € price, max 90-second queue time. Simplicity as the core value proposition for stressed students.",
    },
  },
  {
    speaker: "Sami",
    phase: "ideation",
    dialogueMove: "challenge",
    said: "Wait — has anyone asked whether the library even allows selling food in the lobby? And Otto, pre-batched smoothies separate. By noon that's just juice with regret.",
    reasoning: "Two real risks nobody's touched: the permit question could kill the whole thing, and pre-batching trades quality for speed. Raise both before we fall in love with the plan.",
  },
  {
    speaker: "Nea",
    phase: "ideation",
    dialogueMove: "challenge",
    said: "Library allows sales with a campus vendor permit. Two-day processing. Someone files it today or this plan is dead on arrival.",
    reasoning: "Sami's question has an answer, and the answer has a deadline. Saying it plainly forces the group to assign the task instead of nodding.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Sami, the separation thing — what if we batch the base but blend the fruit fresh per cup? Adds like twenty seconds, still under Otto's ninety. And I'll file the permit today, whatever, it's a form!",
    reasoning: "Turn Sami's quality objection into a hybrid design instead of a blocker, and volunteer for the permit so the momentum doesn't die in logistics.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-3",
      author: "Vilma",
      content: "Hybrid prep: batch the liquid base in the morning, blend fruit fresh per cup (~20 s extra, still within the 90 s queue target). Permit filing owned by Vilma, today.",
    },
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Closing Ideation — three ideas on the board. Evaluation now: stress-test the economics and the queue math. Leo, you've been quiet — anything from you?",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Alright, idea-1: the punch card is pointless for a one-week pop-up — Vilma, nobody buys six smoothies in five days. But idea-2's flat price plus idea-3's fresh blend, that combination might actually survive contact with reality.",
    reasoning: "Kill the weakest element explicitly and by id so it can't sneak back in during synthesis, but credit what's working so this reads as filtering, not negativity.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Sami",
      content: "idea-1: punch card rejected — repeat-purchase mechanics don't work on a 5-day window. Course-themed flavor names keep (zero cost, real attention value). idea-2 + idea-3 combined (flat price, hybrid prep) is the viable core.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Agreed, card's dead. The real open risk is Nea's permit timeline — if processing slips past two days we lose Monday and Tuesday, which are the two biggest queue days. We need a fallback location that doesn't need the permit.",
    reasoning: "Accept the kill quickly to keep pace, then move the group's attention to the schedule risk, because a two-day slip destroys 40% of the revenue window.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Otto",
      content: "Critical path risk: permit processing (2 days nominal) gates the Monday launch. Mitigation required: fallback pitch outside the library entrance (public campus ground, no vendor permit needed) for days 1-2 if processing slips.",
    },
  },
  {
    speaker: "Vilma",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Okay yeah — and honestly the punch card was me being extra, kill it. The outside-the-entrance fallback is actually better for banner visibility anyway!",
    reasoning: "Concede fast and cheerfully — clinging to the card would cost credibility, and the fallback genuinely helps the marketing angle I care about.",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Break-even: rent 150, fruit and base 1.40 a cup, cups at four euros. That's 180 cups over the week — 26 an hour at peak. One blender does 15. The plan needs two blenders or it needs to admit it's a hobby.",
    reasoning: "The group has a shape but no number. 26 cups an hour against a 15-cup blender is the single fact that changes the equipment list, so it goes on the board verbatim.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-3",
      author: "Nea",
      content: "Break-even math: 150 € rent + 1.40 €/cup COGS at 4 €/cup price ⇒ 180 cups/week to break even ⇒ ~26 cups/hour at peak vs ~15 cups/hour single-blender throughput. Conclusion: two blenders minimum, or the queue target and break-even are both fiction.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Evaluation did its job — the punch card is gone and the numbers are on the board. Synthesis: fold what survived into the one-page plan. Make Nea's break-even line the spine.",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Locking it in: three course-named flavors, four euros flat, hybrid prep, two blenders, permit today with the entrance fallback. Nea's 180-cup line is the budget spine. That's the plan.",
    reasoning: "Everything survived evaluation for a reason; my job now is assembly and closure. Name every piece's owner so the plan reads as decisions, not suggestions.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Otto",
      content: "PLAN CORE: 3 course-themed flavors (names from idea-1), 4 € flat price, hybrid prep (batched base + fresh-blended fruit, idea-3), 2 blenders (per evaluation-3 throughput math), permit filed day 0 with outside-entrance fallback (evaluation-2). Break-even: 180 cups/week per evaluation-3.",
    },
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "And the front of it: chalkboard menu with the course names, a 'study fuel' banner outside the entrance, and Otto's ninety-second promise written right on the sign — that's the whole marketing budget, zero euros!",
    reasoning: "The operations spine is Otto's; the face of it is mine. Writing the queue promise on the signage turns an ops constraint into the marketing message for free.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-2",
      author: "Vilma",
      content: "MARKETING (0 € budget): chalkboard menu with course-themed flavor names, 'Study fuel — 90 seconds, promise' banner at the library entrance, flavors rotated to match that day's biggest exam. All signage hand-made.",
    },
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Yeah — sounds good to me. I can, uh, share the poster in the group chat or something.",
    reasoning: "Honestly I've been half on my phone this whole session. The plan looks done and everyone else has it handled — easiest to just agree and offer something small.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: ACCEPTED (score 7/10). The plan is genuinely executable — priced, staffed, equipment-checked, with a real break-even line and a fallback for the permit risk. But the workspace also tells me exactly who built it: Vilma, Otto, Nea and Sami are all over it, and Leo appears once, in the final five minutes, to agree with work he didn't do. The plan passes. The collaboration doesn't — and that's what the debrief will be about.",
    isVerdict: true,
  },
];

const CONFLICT_TASK = {
  title: "Rebrand the campus gym",
  deliverable:
    "A repositioning plan for the under-used campus gym: the new promise to students, how it's credible, and the one risk that could sink it — with mitigation.",
};

const CONFLICT_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "New task: the campus gym runs at 30% capacity while the private gym across the street has a waiting list. Rebrand it — not the paint, the promise. What does it stand for, why would anyone believe it, and what could sink it? Ideation now.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "First thought: the name! 'Campus Sports Facility B' sounds like a storage unit. Call it something with a pulse — 'The Commons Gym' — and make the whole identity about training with your actual classmates, not next to strangers!",
    reasoning: "The identity layer is genuinely broken and it's the cheapest thing to fix. Anchor the rebrand in the one asset the private gym can't copy: the community is already here.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Vilma",
      content: "Identity rebrand: rename to 'The Commons Gym', visual identity + messaging built on training with classmates — community as the differentiator the private gym cannot copy.",
    },
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Names don't move memberships. Here's what does: a results guarantee. Twelve weeks, measurable progress, or your semester fee back. Nobody in this market dares to promise anything — we win by promising.",
    reasoning: "A guarantee is the strongest credibility device that exists, and precisely because it's risky, no competitor will match it. Bold beats cute.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Otto",
      content: "Results guarantee: 'Measurable progress in 12 weeks or your semester fee back.' Positioning the gym as the only one confident enough to guarantee outcomes.",
    },
  },
  {
    speaker: "Leo",
    phase: "ideation",
    dialogueMove: "build",
    said: "These aren't actually competing, right? Vilma's name is the wrapper, Otto's guarantee is what's inside it. 'The Commons Gym — where progress is guaranteed' — I mean, that's already a poster.",
    reasoning: "Flag early that the two proposals compose rather than compete, so evaluation argues about substance instead of turning into a whose-idea contest.",
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Two strong directions and Leo's already spliced them. Evaluation: stress-test hard, especially the guarantee — a promise you can't fund is worse than no promise at all.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Okay, idea-2. Otto — who pays for it? If a hundred students claim the refund, that's a five-figure hole in a budget that can't buy new treadmills. 'Bold' isn't a funding source.",
    reasoning: "The guarantee's whole appeal rests on an unexamined liability. Force the refund economics into the open before the group commits to a promise it can't cover.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Sami",
      content: "idea-2 risk: unbounded refund liability. At realistic claim rates a semester-fee guarantee creates a five-figure exposure with no identified funding source. Guarantee as stated is uncosted.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Sami, the claim math says the opposite. People who show up twelve weeks straight get results — the refund only pays out for people who attend and still fail, which is a rounding error. The scary version is exactly why it works.",
    reasoning: "Defend the mechanism with the attendance condition Sami skipped past — the guarantee is conditional, and the condition is what makes the liability small.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Otto",
      content: "Defense of idea-2: refund is conditional on logged attendance (3x/week, 12 weeks). Consistent attendance almost always produces measurable progress, so expected payout rate is low; the condition also drives the exact behavior (regular visits) that fixes the 30% utilization problem.",
    },
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "And who verifies 'measurable progress', Otto? The gym does? So the party that owes the refund also judges the claim. That's not a guarantee, that's a dispute generator with a marketing budget.",
    reasoning: "His attendance condition patches the cost hole but opens a fairness hole — self-judged claims will poison exactly the community trust Vilma's half of the plan depends on.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-3",
      author: "Sami",
      content: "idea-2 second flaw: 'measurable progress' judged by the refund-paying party = built-in dispute mechanism. Needs an objective, pre-registered metric per member or the guarantee erodes trust instead of building it.",
    },
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Numbers side with Sami on the exposure: at industry completion rates, roughly one in five finishers misses their target. Uncapped, that is 18% of guarantee-cohort revenue held as liability. Capped at fifty members, it's a line item.",
    reasoning: "Both men are arguing direction; the decision needs magnitude. 18% uncapped versus a bounded pilot is the whole choice, stated in two sentences.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-4",
      author: "Nea",
      content: "Liability quantified: ~20% of attendance-compliant members miss targets at industry rates ⇒ ~18% of guarantee-cohort revenue at risk if uncapped. Capping the guarantee cohort at 50 members converts an open-ended exposure into a fixed, budgetable line item.",
    },
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Fine — then cap it. Fifty guarantee slots, first come first served, and the scarcity becomes part of the story. But the metric stays hard: Nea, pick the measurement, I don't care what it is as long as it's a number nobody argues with.",
    reasoning: "Concede the cap because Nea priced it, but keep the promise's teeth. Handing the metric to Nea also answers Sami's referee objection without saying he was right.",
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Pause. Sami, Otto — look at the board: you've been circling the same number from opposite sides for five turns. Leo, say out loud what just happened.",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "What happened is they agreed twenty minutes ago and kept fighting anyway. Sami never hated the guarantee — he hated the unlimited liability and the self-judged refunds. Otto just capped one and gave Nea the other. That's a deal, guys.",
    reasoning: "Name the resolution explicitly — both of them are too invested in the argument to notice it ended. Crediting each one's contribution lets both climb down without losing face.",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Exactly. Synthesis: write the plan that contains the fight — the guarantee, the cap, the objective metric, and the risk register your own evaluation just produced.",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Core of the plan: The Commons Gym relaunches with fifty guaranteed-results memberships. Attendance-conditional, objectively measured, refund liability capped and pre-funded per Nea's math. Sami's objections go in as the official risk section — verbatim.",
    reasoning: "The strongest version of the plan is the one that absorbed the attack. Putting Sami's criticism in as the risk register is both honest and, frankly, the fastest way to end the war.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Otto",
      content: "RELAUNCH CORE: 'The Commons Gym' (idea-1 identity) launches 50 capped guaranteed-results memberships (idea-2 as amended): 12 weeks, 3x/week logged attendance, pre-registered objective metric per member (owner: Nea), refund pool pre-funded at 18% of cohort revenue (evaluation-4). Risk register = evaluation-1 and evaluation-3, verbatim.",
    },
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "build",
    said: "...I can live with that. One condition: the risk section keeps my wording, including the part about dispute handling. If the metric's pre-registered I've got nothing left to attack — which I suppose was the point.",
    reasoning: "The plan now contains every objection I raised, with owners. Conceding here isn't losing the argument; it's the argument having worked.",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "And the story writes itself now — 'Fifty spots. Real numbers. Or your money back.' The cap Otto conceded is literally the headline, scarcity and confidence in one line! Launch it the week before New Year's resolutions hit.",
    reasoning: "The compromise produced better marketing raw material than either original idea — the cap reads as exclusivity, the metric reads as honesty. My job is to make the fight's output the campaign.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-2",
      author: "Vilma",
      content: "CAMPAIGN: headline 'Fifty spots. Real numbers. Or your money back.' — cap framed as exclusivity, objective metric framed as honesty. Timing: launch week before New Year's resolution season. Channels: campus screens + The Commons Gym identity rollout (idea-1).",
    },
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Final numbers block is in: metric is a per-member pre-registered strength or endurance baseline, re-tested at week twelve by a student trainer who isn't the member's coach. Refund pool: 18% of cohort revenue, ring-fenced. It's a plan now.",
    reasoning: "Close the last open item — measurement design — with the independence Sami's evaluation-3 demanded, and pin the funding number so the guarantee is a budget line, not a hope.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-3",
      author: "Nea",
      content: "MEASUREMENT & FUNDING: pre-registered per-member baseline (strength or endurance), week-12 retest administered by an independent student trainer (answers evaluation-3). Refund pool ring-fenced at 18% of guarantee-cohort revenue (evaluation-4). Break-even unaffected if claim rate ≤ industry baseline.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: ACCEPTED (score 8/10). This plan is better than either of the ideas it started from, and the workspace shows exactly why: Sami's attacks didn't block the guarantee, they became its cap, its metric, and its risk register — that is what productive conflict looks like. Point deducted because it took a facilitator to make you two notice you'd already agreed. Next time, notice it yourselves.",
    isVerdict: true,
  },
];

export const SCENARIOS: Scenario[] = [
  { id: "balanced", label: "Balanced group", task: DEMO_TASK, turns: DEMO_TURNS },
  { id: "free-rider", label: "Free-rider group", task: FREE_RIDER_TASK, turns: FREE_RIDER_TURNS },
  { id: "conflict", label: "Conflict group", task: CONFLICT_TASK, turns: CONFLICT_TURNS },
];
