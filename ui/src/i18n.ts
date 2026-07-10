// Bilingual UI strings (English + Finnish) and the language context.
//
// Only UI CHROME lives here — button labels, section headers, insight text,
// enum display names. Agent dialogue is not here; it lives in the task
// datasets (a Finnish task carries its own Finnish `turns`). Agent NAMES
// never translate (Vilma/Otto/Nea/Sami/Leo are Finnish already).
//
// dynamics.ts stays language-free: it emits insight `{ id, params }` and the
// human-readable label/detail are formatted here, keyed by id + params.

import { createContext, createElement, useContext, type ReactNode } from "react";
import type { InsightId, InsightParams } from "./dynamics";

export type Lang = "en" | "fi";

export interface Strings {
  // Header
  appTitle: string;
  badgeReal: (file: string) => string;
  badgeTask: (label: string) => string;
  badgeScenario: (label: string) => string;
  freeTimeNoTask: string;
  whiteboardTaskLabel: string;
  whiteboardStatusLabel: string;
  downtimeBadge: string;

  // Phases / moves / roles / doc kinds / profile enums (keyed by stable id)
  phase: Record<string, string>;
  move: Record<string, string>;
  role: Record<string, string>;
  docKind: Record<string, string>;
  structure: Record<string, string>;
  interdep: Record<string, string>;
  consensus: Record<string, string>;
  interdepSuffix: string;

  // Controls
  startTask: string;
  backToDowntime: string;
  pickerTitle: string;
  taskLibrary: string;
  scenariosGroup: string;
  realSessions: string;
  realSessionCurated: string;
  inProgress: string;
  loading: string;
  loadFailed: string;
  nextTurn: string;
  pause: string;
  autoplay: string;
  speed: string;
  speedName: (msLabel: "Slow" | "Normal" | "Fast") => string;
  idlePace: string;
  paceName: (msLabel: "Calm" | "Normal" | "Lively") => string;
  dynamics: string;
  dynamicsTitle: string;
  tasksBtn: string;
  tasksTitle: string;
  youBtn: string;
  youTitle: string;
  present: string;
  presentTitle: string;
  turnCounter: (turn: number, total: number) => string;
  costTitle: (measured: number, estimated: number, unknown: boolean) => string;

  // Workspace panel + source doc
  sharedWorkspace: string;
  statusInProgress: string;
  statusAccepted: string;
  statusBetween: string;
  taskLabel: string;
  noActiveTask: string;
  section: Record<"ideas" | "evaluations" | "synthesis", string>;
  nothingHere: string;
  pagesSuffix: string;
  readFull: string;
  collapse: string;

  // Dynamics band
  participationBalance: string;
  discussionClimate: string;
  citesSource: string;
  fadedEstimated: string;
  estimatedSuffix: string;
  tickTitle: (turn: number, speaker: string, move: string, tagged: boolean, phase: string, docRef?: string) => string;
  barTitle: (name: string, turns: number, words: number, wordPct: number, docCites: number) => string;
  insightLabel: (id: InsightId, p: InsightParams) => string;
  insightDetail: (id: InsightId, p: InsightParams) => string;

  // Presentation bar
  play: string;
  join: string;
  exitPresentation: string;

  // Presenter dock
  dockClose: string;

  // Contribute overlay
  contributeTitle: string;
  contributeJoinsAs: string;
  contributePlaceholder: string;
  cancel: string;
  send: string;

  // Agent drawer
  drawerPersona: string;
  drawerTalkativeness: string;
  drawerReasoning: string;
  drawerNotSpoken: string;
  close: string;

  // Classroom join affordance + presentation bar titles
  joinLabel: string;
  joinTitle: string;
  tasksTitleP: string;
  joinTitleC: string;

  // Live interjection: target selector + thinking + per-agent fallback lines
  contributeTo: string;
  contributeGroup: string;
  thinking: string;
  liveFallback: Record<string, string>;
}

const PHASE_EN = { ideation: "Ideation", evaluation: "Evaluation", synthesis: "Synthesis" };
const PHASE_FI = { ideation: "Ideointi", evaluation: "Arviointi", synthesis: "Synteesi" };

const MOVE_EN = { propose: "Propose", build: "Build on", challenge: "Challenge", integrate: "Integrate", facilitate: "Teacher", verdict: "Verdict" };
const MOVE_FI = { propose: "Ehdota", build: "Jatka", challenge: "Haasta", integrate: "Kokoa", facilitate: "Opettaja", verdict: "Arvio" };

const ROLE_EN = { Ideator: "Ideator", Driver: "Driver", Precisionist: "Precisionist", Critic: "Critic", Mediator: "Mediator", Facilitator: "Facilitator", Guest: "Guest" };
const ROLE_FI = { Ideator: "Ideoija", Driver: "Vetäjä", Precisionist: "Tarkkuusihminen", Critic: "Kriitikko", Mediator: "Sovittelija", Facilitator: "Ohjaaja", Guest: "Vieras" };

const KIND_EN = { "case-study": "Case study", "contested-brief": "Contested brief", "data-sheet": "Data sheet", "clue-sheet": "Clue sheet", article: "Article" };
const KIND_FI = { "case-study": "Tapaustutkimus", "contested-brief": "Kiistanalainen aineisto", "data-sheet": "Datalomake", "clue-sheet": "Vihjekortti", article: "Artikkeli" };

const STRUCTURE_EN = { open: "open", closed: "closed" };
const STRUCTURE_FI = { open: "avoin", closed: "suljettu" };
const INTERDEP_EN = { high: "high", low: "low", adversarial: "adversarial" };
const INTERDEP_FI = { high: "korkea", low: "matala", adversarial: "vastakkainen" };
const CONSENSUS_EN = { negotiated: "negotiated", aggregated: "aggregated", forced: "forced", verified: "verified" };
const CONSENSUS_FI = { negotiated: "neuvoteltu", aggregated: "koottu", forced: "pakotettu", verified: "varmennettu" };

const SPEED_EN = { Slow: "Slow", Normal: "Normal", Fast: "Fast" };
const SPEED_FI = { Slow: "Hidas", Normal: "Normaali", Fast: "Nopea" };
const PACE_EN = { Calm: "Calm", Normal: "Normal", Lively: "Lively" };
const PACE_FI = { Calm: "Rauhallinen", Normal: "Normaali", Lively: "Vilkas" };

export const STRINGS: Record<Lang, Strings> = {
  en: {
    appTitle: "CSCL Classroom",
    badgeReal: (f) => `real session — ${f}`,
    badgeTask: (l) => `task — ${l}`,
    badgeScenario: (l) => `scenario — ${l}`,
    freeTimeNoTask: "Free time — no task assigned",
    whiteboardTaskLabel: "Today's task",
    whiteboardStatusLabel: "Status",
    downtimeBadge: "Free time — between tasks",

    phase: PHASE_EN,
    move: MOVE_EN,
    role: ROLE_EN,
    docKind: KIND_EN,
    structure: STRUCTURE_EN,
    interdep: INTERDEP_EN,
    consensus: CONSENSUS_EN,
    interdepSuffix: "-interdep",

    startTask: "▶ Start task",
    backToDowntime: "↺ Back to downtime",
    pickerTitle: "Pick a scripted scenario or load a real Stage 1 session",
    taskLibrary: "Task library",
    scenariosGroup: "Scenarios",
    realSessions: "Real sessions",
    realSessionCurated: "Real AI session (unedited)",
    inProgress: " (in progress)",
    loading: "Loading…",
    loadFailed: "⚠ load failed",
    nextTurn: "⏭ Next turn",
    pause: "⏸ Pause",
    autoplay: "⏵ Autoplay",
    speed: "Speed",
    speedName: (l) => SPEED_EN[l],
    idlePace: "Idle pace",
    paceName: (l) => PACE_EN[l],
    dynamics: "📊 Dynamics",
    dynamicsTitle: "Show or hide the group-dynamics visualization",
    tasksBtn: "🎛 Tasks",
    tasksTitle: "Open the task-library dock (rehearsal)",
    youBtn: "🙋 You",
    youTitle: "Join the discussion as a participant",
    present: "🖥 Present",
    presentTitle: "Enter presentation mode for a lecture or workshop",
    turnCounter: (t, total) => `Turn ${t} / ${total}`,
    costTitle: (m, e, u) =>
      `Measured (from session logs): $${m.toFixed(4)} · Estimated (scenarios & downtime): ~$${e.toFixed(4)}` +
      (u ? " · some log entries had no recorded cost" : ""),

    sharedWorkspace: "Shared workspace",
    statusInProgress: "In progress",
    statusAccepted: "✓ Accepted",
    statusBetween: "Between tasks",
    taskLabel: "Task",
    noActiveTask: "No active task — the group is just hanging out.",
    section: { ideas: "Ideas", evaluations: "Evaluations", synthesis: "Solution" },
    nothingHere: "Nothing here yet",
    pagesSuffix: "p.",
    readFull: "Read the full document",
    collapse: "Collapse",

    participationBalance: "Participation balance",
    discussionClimate: "Discussion climate — click a turn to jump",
    citesSource: "• = cites source",
    fadedEstimated: "faded = estimated",
    estimatedSuffix: " (estimated)",
    tickTitle: (turn, speaker, move, tagged, phase, docRef) =>
      `Turn ${turn} — ${speaker}: ${move}${tagged ? "" : " (estimated)"} · ${phase}` + (docRef ? `\n📄 ${docRef}` : ""),
    barTitle: (name, turns, words, wordPct, docCites) =>
      `${name}: ${turns} turns, ${words} words (${wordPct}% of words)` + (docCites > 0 ? ` · cites source ×${docCites}` : ""),
    insightLabel: (id, p) => insightLabelEn(id, p),
    insightDetail: (id, p) => insightDetailEn(id, p),

    play: "⏵ Play",
    join: "🙋 Join",
    exitPresentation: "✕ Exit presentation (Esc)",

    dockClose: "Close (P)",

    contributeTitle: "🙋 Your contribution",
    contributeJoinsAs: "joins the group as “You”",
    contributePlaceholder: "Say something to the group…  (Enter to send, Esc to cancel)",
    cancel: "Cancel",
    send: "Send",

    drawerPersona: "Persona",
    drawerTalkativeness: "Talkativeness",
    drawerReasoning: "Current reasoning",
    drawerNotSpoken: "Hasn't spoken yet in this session.",
    close: "Close",
    joinLabel: "Join (C)",
    joinTitle: "Join the group (C)",
    tasksTitleP: "Task library (P)",
    joinTitleC: "Join the discussion (C)",
    contributeTo: "To whom?",
    contributeGroup: "The group",
    thinking: "thinking…",
    liveFallback: {
      Vilma: "Ooh, interesting — let me chew on that for a second!",
      Otto: "Good question — but let's keep the focus, I'll come back to that.",
      Nea: "Give me a moment to think about that precisely.",
      Sami: "Hm. That deserves a real answer, not a quick one.",
      Leo: "That's worth sitting with — let me come back to you on it.",
    },
  },

  fi: {
    appTitle: "CSCL-luokka",
    badgeReal: (f) => `oikea istunto — ${f}`,
    badgeTask: (l) => `tehtävä — ${l}`,
    badgeScenario: (l) => `skenaario — ${l}`,
    freeTimeNoTask: "Vapaa-aikaa — ei tehtävää",
    whiteboardTaskLabel: "Päivän tehtävä",
    whiteboardStatusLabel: "Tilanne",
    downtimeBadge: "Vapaa-aikaa — tehtävien välissä",

    phase: PHASE_FI,
    move: MOVE_FI,
    role: ROLE_FI,
    docKind: KIND_FI,
    structure: STRUCTURE_FI,
    interdep: INTERDEP_FI,
    consensus: CONSENSUS_FI,
    interdepSuffix: "-riippuvuus",

    startTask: "▶ Aloita tehtävä",
    backToDowntime: "↺ Takaisin vapaa-aikaan",
    pickerTitle: "Valitse skenaario tai lataa oikea Vaihe 1 -istunto",
    taskLibrary: "Tehtäväkirjasto",
    scenariosGroup: "Skenaariot",
    realSessions: "Oikeat istunnot",
    realSessionCurated: "Aito AI-istunto (editoimaton)",
    inProgress: " (kesken)",
    loading: "Ladataan…",
    loadFailed: "⚠ lataus epäonnistui",
    nextTurn: "⏭ Seuraava vuoro",
    pause: "⏸ Tauko",
    autoplay: "⏵ Automaatti",
    speed: "Nopeus",
    speedName: (l) => SPEED_FI[l],
    idlePace: "Vapaa-ajan tahti",
    paceName: (l) => PACE_FI[l],
    dynamics: "📊 Dynamiikka",
    dynamicsTitle: "Näytä tai piilota ryhmädynamiikan visualisointi",
    tasksBtn: "🎛 Tehtävät",
    tasksTitle: "Avaa tehtäväkirjaston telakka (harjoittelu)",
    youBtn: "🙋 Sinä",
    youTitle: "Liity keskusteluun osallistujana",
    present: "🖥 Esitys",
    presentTitle: "Siirry esitystilaan luentoa tai työpajaa varten",
    turnCounter: (t, total) => `Vuoro ${t} / ${total}`,
    costTitle: (m, e, u) =>
      `Mitattu (istuntolokeista): $${m.toFixed(4)} · Arvioitu (skenaariot & vapaa-aika): ~$${e.toFixed(4)}` +
      (u ? " · joillakin lokiriveillä ei ollut kirjattua kustannusta" : ""),

    sharedWorkspace: "Yhteinen työtila",
    statusInProgress: "Kesken",
    statusAccepted: "✓ Hyväksytty",
    statusBetween: "Tehtävien välissä",
    taskLabel: "Tehtävä",
    noActiveTask: "Ei aktiivista tehtävää — ryhmä vain viettää aikaa.",
    section: { ideas: "Ideat", evaluations: "Arviot", synthesis: "Ratkaisu" },
    nothingHere: "Ei vielä mitään",
    pagesSuffix: "s.",
    readFull: "Lue koko dokumentti",
    collapse: "Pienennä",

    participationBalance: "Osallistumisen tasapaino",
    discussionClimate: "Keskustelun ilmapiiri — napsauta vuoroa hypätäksesi",
    citesSource: "• = viittaa lähteeseen",
    fadedEstimated: "haalea = arvioitu",
    estimatedSuffix: " (arvioitu)",
    tickTitle: (turn, speaker, move, tagged, phase, docRef) =>
      `Vuoro ${turn} — ${speaker}: ${move}${tagged ? "" : " (arvioitu)"} · ${phase}` + (docRef ? `\n📄 ${docRef}` : ""),
    barTitle: (name, turns, words, wordPct, docCites) =>
      `${name}: ${turns} vuoroa, ${words} sanaa (${wordPct}% sanoista)` + (docCites > 0 ? ` · viittaa lähteeseen ×${docCites}` : ""),
    insightLabel: (id, p) => insightLabelFi(id, p),
    insightDetail: (id, p) => insightDetailFi(id, p),

    play: "⏵ Toista",
    join: "🙋 Liity",
    exitPresentation: "✕ Poistu esityksestä (Esc)",

    dockClose: "Sulje (P)",

    contributeTitle: "🙋 Sinun puheenvuorosi",
    contributeJoinsAs: "liittyy ryhmään nimellä “Sinä”",
    contributePlaceholder: "Sano jotain ryhmälle…  (Enter lähettää, Esc peruu)",
    cancel: "Peru",
    send: "Lähetä",

    drawerPersona: "Persoona",
    drawerTalkativeness: "Puheliaisuus",
    drawerReasoning: "Nykyinen päättely",
    drawerNotSpoken: "Ei ole vielä puhunut tässä istunnossa.",
    close: "Sulje",
    joinLabel: "Liity (C)",
    joinTitle: "Liity ryhmään (C)",
    tasksTitleP: "Tehtäväkirjasto (P)",
    joinTitleC: "Liity keskusteluun (C)",
    contributeTo: "Kenelle?",
    contributeGroup: "Ryhmälle",
    thinking: "miettii…",
    liveFallback: {
      Vilma: "Ai, kiinnostavaa — annas kun mietin tuota hetki!",
      Otto: "Hyvä kysymys — mutta pidetään fokus, palataan siihen kohta.",
      Nea: "Hetki — mietin tuon tarkasti.",
      Sami: "Hmm. Tuo ansaitsee kunnon vastauksen, ei hätäistä.",
      Leo: "Tuota kannattaa pohtia — palaan siihen sinulle.",
    },
  },
};

// ── Insight formatters ─────────────────────────────────────────────────
function insightLabelEn(id: InsightId, p: InsightParams): string {
  switch (id) {
    case "free-rider": return `Free-rider pattern: ${p.name}`;
    case "conflict": return "Socio-cognitive conflict";
    case "convergence": return "Convergence begins";
    case "silos": return "Working in silos";
    case "false-consensus": return "False consensus?";
    case "source-ignored": return "Source ignored";
    case "shared-understanding": return "Shared understanding";
  }
}
function insightDetailEn(id: InsightId, p: InsightParams): string {
  switch (id) {
    case "free-rider": return `${p.name} has taken ${p.turns} of ${p.total} student turns (${p.pct}%).`;
    case "conflict": return `${p.runLength}+ consecutive challenge moves in Evaluation — ideas under sustained attack.`;
    case "convergence": return `${p.name} starts folding the surviving ideas into one solution.`;
    case "false-consensus": return `${p.name} challenged hard in Evaluation, was never answered, and never re-engaged — yet the decision was recorded as agreed.`;
    case "source-ignored": return `The group has a shared source document, but after ${p.total} student turns nobody has cited it.`;
    case "silos": return `No challenges anywhere and almost no peer addressing in the last ${p.windowSize} student turns — division of labor, not collaboration.`;
    case "shared-understanding": return `${p.docTurns} of ${p.total} student turns are anchored in the source — the group is building understanding from the text, not around it.`;
  }
}
function insightLabelFi(id: InsightId, p: InsightParams): string {
  switch (id) {
    case "free-rider": return `Vapaamatkustus: ${p.name}`;
    case "conflict": return "Sosiokognitiivinen konflikti";
    case "convergence": return "Yhteen sovittaminen alkaa";
    case "silos": return "Työskentely siiloissa";
    case "false-consensus": return "Näennäinen yksimielisyys?";
    case "source-ignored": return "Lähde sivuutettu";
    case "shared-understanding": return "Jaettu ymmärrys";
  }
}
function insightDetailFi(id: InsightId, p: InsightParams): string {
  switch (id) {
    case "free-rider": return `${p.name} on käyttänyt ${p.turns} / ${p.total} opiskelijavuoroa (${p.pct}%).`;
    case "conflict": return `${p.runLength}+ peräkkäistä haastavaa vuoroa arviointivaiheessa — ideat kovan kritiikin alla.`;
    case "convergence": return `${p.name} alkaa koota säilyneet ideat yhdeksi ratkaisuksi.`;
    case "false-consensus": return `${p.name} haastoi voimakkaasti arviointivaiheessa, jäi vaille vastausta eikä palannut mukaan — silti päätös kirjattiin yhteiseksi.`;
    case "source-ignored": return `Ryhmällä on yhteinen lähdedokumentti, mutta ${p.total} opiskelijavuoron jälkeen kukaan ei ole viitannut siihen.`;
    case "silos": return `Ei yhtään haastetta eikä juuri lainkaan toisiin kohdistuvaa puhetta viimeisten ${p.windowSize} opiskelijavuoron aikana — työnjakoa, ei yhteistyötä.`;
    case "shared-understanding": return `${p.docTurns} / ${p.total} opiskelijavuoroa nojaa lähteeseen — ryhmä rakentaa ymmärrystä tekstistä, ei sen ympäriltä.`;
  }
}

// ── Context ────────────────────────────────────────────────────────────
interface LangValue {
  lang: Lang;
  t: Strings;
}
const LangContext = createContext<LangValue>({ lang: "en", t: STRINGS.en });

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return createElement(LangContext.Provider, { value: { lang, t: STRINGS[lang] } }, children);
}

export function useT(): LangValue {
  return useContext(LangContext);
}
