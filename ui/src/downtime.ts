// Content pools for ambient "Sims-like" downtime life between tasks.
// Ambient ticks are pure client-side animation (no API call, no cost).
// Meaningful moments simulate a single real Haiku call (small mocked cost)
// until this is wired to the live backend.

import type { Emotion } from "./data";

export interface AmbientTick {
  icon: string;
  caption: string;
}

export interface MeaningfulMoment {
  speaker: string;
  said: string;
  reasoning: string;
  emotion?: Emotion;
}

export const AMBIENT_POOL: Record<string, AmbientTick[]> = {
  Vilma: [
    { icon: "✏️", caption: "doodles a new idea in the margin" },
    { icon: "📱", caption: "scrolls through something on her phone" },
    { icon: "🦵", caption: "bounces her leg, thinking" },
    { icon: "☕", caption: "takes a quick sip of coffee" },
  ],
  Otto: [
    { icon: "⏱️", caption: "checks the time" },
    { icon: "📝", caption: "flips back through his notes" },
    { icon: "🖊️", caption: "taps his pen on the table" },
    { icon: "👀", caption: "glances around, ready to get going" },
  ],
  Nea: [
    { icon: "📖", caption: "reads quietly" },
    { icon: "💧", caption: "sips her water" },
    { icon: "🤔", caption: "thinks, says nothing" },
    { icon: "✍️", caption: "jots something down" },
  ],
  Sami: [
    { icon: "🙄", caption: "raises an eyebrow at nothing in particular" },
    { icon: "🪑", caption: "leans back, arms crossed" },
    { icon: "❓", caption: "doodles a question mark" },
    { icon: "☕", caption: "eyes the coffee machine suspiciously" },
  ],
  Leo: [
    { icon: "☕", caption: "refills his coffee" },
    { icon: "👀", caption: "glances around the room" },
    { icon: "📱", caption: "smiles at something on his phone" },
    { icon: "🙂", caption: "settles back, relaxed" },
  ],
  Teacher: [
    { icon: "☕", caption: "sips coffee at the front" },
    { icon: "📋", caption: "reviews notes" },
    { icon: "🕐", caption: "glances at the clock" },
    { icon: "📚", caption: "flips through a folder" },
  ],
};

// Casual, low-stakes chat — small talk and loose reactions, not task work.
// Reasoning stays visible in the drawer, same as real turns.
export const MEANINGFUL_POOL: MeaningfulMoment[] = [
  {
    speaker: "Vilma",
    said: "Okay but for real, that protein bar thing kind of made me hungry.",
    reasoning: "Just reacting honestly — the smell of the idea is still stuck in my head. Low stakes, just breaking the silence with something true.",
  },
  {
    speaker: "Sami",
    said: "I still don't buy that fifteen percent repeat rate, by the way.",
    reasoning: "Can't quite let it go. Reopening a settled question in a low-stakes moment because it's genuinely still bugging me, not because I want to relitigate anything right now.",
  },
  {
    speaker: "Otto",
    said: "That went fine. We should just always structure it like that.",
    reasoning: "Reviewing what worked, staying in 'keep the momentum' mode even during downtime — it's just how my brain runs.",
  },
  {
    speaker: "Nea",
    said: "The coffee here is bad.",
    reasoning: "Genuinely just an observation. Filling silence with something true and low-effort, which is basically my whole downtime personality.",
  },
  {
    speaker: "Leo",
    said: "Good session today, honestly. We actually listened to each other.",
    reasoning: "Noticing and naming the group's dynamic even when nothing's at stake — that's just part of how I keep track of us.",
  },
  {
    speaker: "Vilma",
    said: "Do you guys think our plan would actually work though? Like for real for real?",
    reasoning: "Half-joking, half-genuinely wondering. My brain doesn't really turn off between tasks.",
  },
  {
    speaker: "Sami",
    said: "Anyone else starving, or is it just me?",
    reasoning: "Just being a person for a second. Not everything has to be a critique.",
  },
  {
    speaker: "Otto",
    said: "Anyway. What's after this?",
    reasoning: "Naturally impatient even at rest — already oriented toward whatever's next.",
  },
  {
    speaker: "Leo",
    said: "Hey Nea, you good? You were pretty quiet today.",
    reasoning: "Checking in on someone who spoke less than usual. That's just instinct for me.",
  },
  {
    speaker: "Nea",
    said: "I'm fine. Just didn't have anything to add.",
    reasoning: "Answering plainly. No need to over-explain — that's genuinely all it is.",
  },
  {
    speaker: "Teacher",
    said: "Nice work today, everyone. Take a few minutes.",
    reasoning: "Giving the group a real breather before the next task. The pacing itself is part of good facilitation.",
  },
  {
    speaker: "Vilma",
    said: "Ooh, wait, unrelated — did anyone see what was in the vending machine downstairs?",
    reasoning: "Genuinely off-topic. My attention just goes wherever it goes between tasks.",
  },
];

// How often real (meaningful) turns happen during downtime. Ambient ticks
// run on a fixed, separate cadence regardless of this setting — the room
// should always feel alive, but idle pace only governs the API-costing part.
export const IDLE_PACES: { label: string; meaningfulMs: number }[] = [
  { label: "Calm", meaningfulMs: 16000 },
  { label: "Normal", meaningfulMs: 9000 },
  { label: "Lively", meaningfulMs: 4500 },
];
