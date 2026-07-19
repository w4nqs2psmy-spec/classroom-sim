// Placeholder session data. Once the layout is confirmed, this module is
// replaced by a loader that reads the real session logs and workspace.json.

export type Phase = "ideation" | "evaluation" | "synthesis" | "luku" | "opetus" | "synteesi";
export type ListName = "ideas" | "evaluations" | "synthesis";
export type Emotion = "neutral" | "engaged" | "skeptical" | "amused";

// The jigsaw task's two parallel small groups (src/jigsaw/prompts.ts). Kept
// here rather than tasks.ts to avoid a tasks.ts -> data.ts -> tasks.ts cycle.
export type GroupId = "ryhma1" | "ryhma2";

// Dialogue-move taxonomy for the pedagogical dynamics layer (CSCL:
// socio-cognitive conflict -> convergence). Lives here rather than in
// dynamics.ts because it's part of the turn model: turns may carry an
// explicit hand-authored tag (scripted content), and dynamics.ts only
// falls back to a heuristic when the tag is absent (real session logs).
export type Move = "propose" | "build" | "challenge" | "integrate" | "facilitate" | "verdict";

export interface Persona {
  name: string;
  role: string;
  color: string;
  summary: string;
  talkativeness: number; // 0..1
}

export interface WorkspaceEntryView {
  list: ListName;
  id: string;
  author: string;
  content: string;
}

export interface TurnView {
  speaker: string; // "Teacher" or a student name
  phase: Phase;
  said: string;
  reasoning?: string;
  workspaceEntry?: WorkspaceEntryView;
  isVerdict?: boolean;
  emotion?: Emotion;
  // Hand-authored dialogue move for scripted content; real logs omit it and
  // dynamics.ts classifies heuristically (demo-grade).
  dialogueMove?: Move;
  // Hand-authored source-document citation: presence means this turn engages
  // the task's source document; the string is the cited fragment/page ref
  // (shown in the timeline tooltip). Authoring-only — never inferred.
  docRef?: string;
  // Present (number or null) only for turns loaded from a real session log;
  // absent (undefined) for DEMO_TURNS, which has no real cost to report.
  // `null` means Stage 1 recorded no cost for this entry — that must surface
  // as "unknown", never get silently coerced to 0 or estimated.
  costUSD?: number | null;
  // Which jigsaw small group this turn belongs to; undefined for facilitator
  // lines and for every non-jigsaw task (single-room tasks never set this).
  group?: GroupId;
}

// Cost simulation for the placeholder dataset only. Turns loaded from a real
// session log always carry their own measured `costUSD` and must never fall
// back to this estimator (see the cost-accounting effect in App.tsx).
export function estimateTurnCost(t: TurnView): number {
  if (t.isVerdict) return 0.06 + Math.random() * 0.06;
  if (t.speaker === "Teacher") return 0.004 + Math.random() * 0.003;
  return 0.005 + Math.random() * 0.007;
}

export const PERSONAS: Record<string, Persona> = {
  Vilma: {
    name: "Vilma",
    role: "Ideator",
    color: "#f59e0b",
    summary:
      "Enthusiastic and fast-talking, Vilma produces ideas faster than the group can process them. She jumps between topics, builds variations on anything she hears, and treats criticism as a springboard for the next idea. Her energy powers the ideation phase — and occasionally derails the others.",
    talkativeness: 0.85,
  },
  Otto: {
    name: "Otto",
    role: "Driver",
    color: "#ef4444",
    summary:
      "Dominant and decisive, Otto pushes the group toward commitment. He structures discussions into numbered points, gets impatient with drift, and wants a decision on the table before the phase ends. His push for closure regularly collides with Sami's insistence on more scrutiny.",
    talkativeness: 0.9,
  },
  Nea: {
    name: "Nea",
    role: "Precisionist",
    color: "#06b6d4",
    summary:
      "Quiet and exact, Nea speaks rarely — but when she does, the group stops to listen. She dislikes vagueness, checks assumptions against numbers, and delivers short, measured points with no filler. Her sharpest contributions come during evaluation.",
    talkativeness: 0.3,
  },
  Sami: {
    name: "Sami",
    role: "Critic",
    color: "#22c55e",
    summary:
      "Sami questions everything on principle: he believes ideas only become strong by surviving attack. He leads with probing questions and counterexamples, delivered wry and dry. Most active in evaluation, and the group's main source of productive friction with Otto.",
    talkativeness: 0.7,
  },
  Leo: {
    name: "Leo",
    role: "Mediator",
    color: "#3b82f6",
    summary:
      "Calm and socially perceptive, Leo integrates opposing views. He credits ideas to their originators, converts attacks into requirements, and notices when the conversation drifts away from the shared workspace. Valuable everywhere, decisive in synthesis.",
    talkativeness: 0.65,
  },
  // Jigsaw task only (src/jigsaw/prompts.ts / characters/aino.json) — not a
  // member of STUDENTS, never seated in the single-room Classroom.
  Aino: {
    name: "Aino",
    role: "Collaborator",
    color: "#ec4899",
    summary:
      "Conscientious and cooperation-minded: reads instructions twice, does her share carefully and on time, and wants every group member to succeed. Keeps track of what the group has agreed and quietly follows up on loose ends. Her weakness is over-accommodation — she may defer to louder voices even when her own careful reading is the more accurate one.",
    talkativeness: 0.6,
  },
  Teacher: {
    name: "Teacher",
    role: "Facilitator",
    color: "#a855f7",
    summary:
      "Designs open-ended CSCL tasks in entrepreneurship, sales, and marketing; steers the group through Ideation, Evaluation, and Synthesis; and assesses the final solution on concreteness, absorbed criticism, evidence of genuine collaboration, and plausible customer logic.",
    talkativeness: 1,
  },
  // The live human participant. A slate/neutral hue deliberately outside the
  // five persona colours so the audience reads this seat as the human, not an
  // AI. Present in the room only after the presenter joins.
  You: {
    name: "You",
    role: "Guest",
    color: "#475569",
    summary: "The live human participant — you. Your contributions join the transcript and the group's measured dynamics.",
    talkativeness: 0,
  },
};

export const STUDENTS = ["Vilma", "Otto", "Nea", "Sami", "Leo"] as const;

export const DEMO_TASK = {
  title: "From Hobby to Paying Customers",
  deliverable:
    "A concrete business plan for a hobby-to-revenue venture: target customer, core offer, go-to-market, pricing and unit economics, one major risk with mitigation.",
};

export const DEMO_TURNS: TurnView[] = [
  {
    speaker: "Teacher",
    phase: "ideation",
    dialogueMove: "facilitate",
    said: "Welcome, everyone. Today's challenge: take one hobby-based skill and design a business model that turns it into real revenue within six months. Real customer, real pricing, honest unit economics. Ideation starts now — quantity over polish.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Okay okay — what about social media management for tiny local shops? Every cafe near campus has a sad Instagram with two posts from last spring! Someone who's good at content could run it as a monthly service. Oh, and it costs basically nothing to start!",
    reasoning: "Opening with my strongest idea fast, before the group settles into one direction. Local cafes are concrete and everyone can picture them, which makes the idea easy to build on.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-1",
      author: "Vilma",
      content: "Monthly social-media retainer for owner-operated local shops (cafes, boutiques): content calendar, visuals, captions for one platform. Near-zero material cost; sold as a time-saving service.",
    },
  },
  {
    speaker: "Otto",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Fine, that's one. Let me put a second on the table so we have something to compare: paid exam-prep tutoring, packaged as a fixed-price crash course before exam weeks. Predictable demand, predictable calendar. Two ideas in the workspace beats one — next.",
    reasoning: "Vilma's idea is decent but the group needs alternatives or evaluation will be a rubber stamp. A tutoring package is deliberately different in shape: product-like, seasonal, fixed price.",
    workspaceEntry: {
      list: "ideas",
      id: "idea-2",
      author: "Otto",
      content: "Fixed-price exam crash course: 4-session small-group tutoring package sold before each exam period. Seasonal but predictable demand; price anchored per package, not per hour.",
    },
  },
  {
    speaker: "Teacher",
    phase: "evaluation",
    dialogueMove: "facilitate",
    said: "Good spread of ideas. Closing Ideation. Evaluation begins now — stress-test what's in the workspace. Reference ideas by id, and surface every serious flaw today, not after launch.",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Alright, idea-1. Who says a cafe owner will pay monthly for Instagram? Has any of us seen one actually do it? 'They know social media matters' is our assumption, not their behavior. And idea-2 — the crash course dies eleven months a year. What's the plan between exam weeks, Otto?",
    reasoning: "Both ideas share the same weakness: unvalidated willingness to pay. My job is to make that explicit now, in the workspace, so synthesis can't quietly skip it.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-1",
      author: "Sami",
      content: "idea-1: core assumption unvalidated — no evidence small-shop owners pay monthly for social media. idea-2: revenue is seasonal; dead outside exam periods. Both need a willingness-to-pay test before any scale plan.",
    },
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Numbers. Idea-1 at 600 per month and roughly six hours a week is about 25 per hour — sustainable. Idea-2 at 120 per package, four sessions, four students, is 480 per cohort but only six weeks a year. Idea-1 wins on annualized revenue if — and only if — retention holds.",
    reasoning: "The group is arguing direction on instinct. One concrete comparison of hourly economics settles which idea deserves synthesis, and pins the open question to retention.",
    workspaceEntry: {
      list: "evaluations",
      id: "evaluation-2",
      author: "Nea",
      content: "Unit economics: idea-1 ≈ $600/mo at ~6 h/wk ≈ $25/h, year-round. idea-2 ≈ $480 per cohort, limited to ~6 weeks/year. idea-1 dominates annualized — conditional on monthly retention, which is unproven.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Evaluation surfaced the right tension: strong economics against unproven willingness to pay. Synthesis begins — converge on one solution, and make sure Sami's and Nea's criticisms are answered inside the plan, not around it.",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "So let's take Vilma's retainer, priced with Nea's math, and answer Sami inside the plan: a two-client pilot at 600 a month on three-month commitments, landed through warm intros. If neither renews, the willingness-to-pay assumption fails and we pivot — that's the test, built in.",
    reasoning: "Everyone's contribution has a place in this frame, which makes agreement easy: Vilma keeps the idea, Nea's numbers set the price, and Sami's objection becomes the pilot's exit criterion instead of a blocker.",
    workspaceEntry: {
      list: "synthesis",
      id: "synthesis-1",
      author: "Leo",
      content: "FINAL PLAN: Social-media retainer for owner-operated local shops. Offer: monthly content service (calendar, visuals, captions, one platform) at $600/mo, 3-month minimum. GTM: two pilot clients via warm introductions (near-zero CAC). Validation gate: if neither pilot renews after 3 months, willingness-to-pay is falsified — pivot. Economics: ~$25/h at 6 h/wk per client; breakeven at 2 clients.",
    },
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "verdict",
    said: "Verdict: ACCEPTED (score 8/10). The plan answers the deliverable: specific segment, concrete offer and price, realistic go-to-market, honest economics. Best of all, the evaluation phase is visible inside the solution — Sami's objection became the pilot's exit criterion. Weak spot: customer acquisition cost is named but never quantified.",
    isVerdict: true,
  },
];
