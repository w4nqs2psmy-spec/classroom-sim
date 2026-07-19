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
import { JIGSAW_TURNS } from "./jigsawTask";
import cooperativeLeadershipDoc from "./source-docs/cooperative-leadership-core.json";
import cooperativeLeadershipDocFi from "./source-docs/cooperative-leadership-core-fi.json";

export type StudentName = "Vilma" | "Otto" | "Nea" | "Sami" | "Leo" | "Aino";

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
  // "jigsaw" swaps Classroom/WorkspacePanel/PhaseIndicator for the two-group
  // jigsaw layout (App.tsx) and hides live/dynamics/contribute controls
  // (Controls.tsx). Absent = the default single-room layout.
  layout?: "single-room" | "jigsaw";
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
    said: "New task, unusual one: you've all read Leppilampi's piece on cooperative leadership. Today just understand it — restate what it claims, agree what it means.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "I'll take face-to-face interaction. The article says leadership should build 'structures that force people to work together' — I love how blunt that is.",
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
    said: "Positive interdependence, that's mine. My read: everyone pulls their weight and you divide the work so nobody's a bottleneck. Efficient teamwork, basically.",
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
    said: "Individual accountability: a well-functioning group 'will not accept any hitch hikers' — everyone brings real input. Opposite of hiding in a crowd.",
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
    said: "Social skills — I actually believe this one. The article says 'employees not wanting responsibility' is misguided; the real issue is how they're invited in.",
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
    said: "That leaves group processing for me. Shared reflection — the article's own questions: 'What happened, and why? Where did we succeed, where failed?'",
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
    said: "Five principles, five readings. Now the real work: pressure-test them against the text. Do you agree on what they mean — or does one not survive a second look?",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "One doesn't. Otto — 'divide the work so nobody's a bottleneck' is just division of labour. That's literally the silos task. Not what the article means.",
    reasoning: "His reading is the common one and it's subtly wrong — name it against a case we all remember, the silos task, so the distinction is concrete rather than pedantic.",
    docRef: "§i vs. §iii: division of labour alone would let a group of 'hitch hikers' pass",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Sami's right, and the text is exact why. It says each person 'feels both needed AND that she needs others.' Otto, your version drops the second half.",
    reasoning: "Correct with the precise wording rather than a paraphrase — the whole misreading lives in the half of the sentence he dropped, so the exact quote is the correction.",
    docRef: "§i verbatim: \"everyone feels both needed and that she needs others to achieve the common goal\"",
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "build",
    said: "...Huh. Yeah. I read it through my own habit — split it up, stay out of each other's way. It says 'success depends on the success of each member.' Backwards.",
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
    said: "That's the 'same boat' line, isn't it? Otto, you didn't just describe being in the boat — you need the others rowing or you don't move.",
    reasoning: "Reinforce the corrected reading with the article's own image so it sticks for everyone, not just Otto — a metaphor consolidates what the precise quote just fixed.",
    docRef: "§i: \"Everyone feels being 'in the same boat'\"",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Notice what just happened — that WAS principle five. We hit a misreading, checked it against the text, and fixed it. We just did group processing on ourselves.",
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
    said: "You just did the thing the article describes, not the thing it says. Now write it down — the shared understanding, with the correction on the record.",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Shared version: cooperative leadership isn't managing people, it's building a group where each person needs the others to succeed — and knows it.",
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
    said: "Takeaway, and I should say it since I got it wrong first: you cannot divide your way to cooperative leadership. You can't do it alone, and you know it.",
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
    said: "And my one from the start still fits under it — the 'structures that force people to work together' build a boat where everyone has to row. One idea.",
    reasoning: "Tie my opening principle back into the corrected centre, showing the five aren't a list but a connected whole — that connection is a sign we understood rather than just catalogued.",
    docRef: "§ii + §i: structures that \"force people to work together\" serve the mutual dependence of §i",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "build",
    said: "For the record, the piece is light on what you do when someone won't get in the boat. But that's a critique, not a misreading. I understand it now.",
    reasoning: "Separate a fair criticism of the article from a failure to understand it — signalling that comprehension doesn't require agreement is itself part of understanding the text well.",
    docRef: "§iv: the reliance on how people \"are invited to participate\" — my open critique, not a misreading",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "You understand it. Now the deepest part — reflect out loud: how would these five principles show up in practice? Take them one at a time, be concrete.",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Positive interdependence in practice: a shared deliverable where my part fails if yours does. The moment I can succeed while you sink, it's gone.",
    reasoning: "Make the abstract concrete with the failure condition — a principle you can't picture as behaviour hasn't really been understood.",
    docRef: "§i: \"The success of a group depends on the success of each of its members\" — in practice",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Individual accountability in practice is a test I can run: can each person explain the whole group's task, not just their own slice? If not, it's fake.",
    reasoning: "Turn the principle into a checkable behaviour — as the one who misread earlier, I trust a concrete test more than a good feeling.",
    docRef: "§iii: each member \"takes charge of her own share\" and brings constructive input — made testable",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "challenge",
    said: "Here's where I push back. Vilma took principle two — 'structures that force people together'. If I can't hide, is that collaboration, or just compliance?",
    reasoning: "The principle sounds benign until you sit in the forced seat. Naming the tension between structure and genuine buy-in is the reflection the text invites but never resolves.",
    docRef: "§ii: \"structures that 'force' people to work together\" — challenged: forced participation vs. genuine buy-in",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Sami's right that it's the sharp edge. But the text's example is putting the tables away — that's not coercion, it's removing the option to disappear.",
    reasoning: "Reframe without dismissing — the mediator's job is to hold both truths at once: the text means scaffolding, and Sami's worry about where that tips into control is real and unanswered.",
    docRef: "§ii: \"structures that 'force' people to work together\" — read as scaffolding; the scaffolding/control line left open",
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Then make principle four operational — cheapest to do. The text's rule: 'talk to your neighbours about what you just heard.' Measurable, and free.",
    reasoning: "The most practical principle is the one with a concrete procedure attached — turn §iv from a virtue into a scheduled behaviour.",
    docRef: "§iv: \"talk to your neighbours about what you just heard\" — as a standing meeting rule",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "And close the loop with principle five — as a ritual, not an afterthought. Every project ends with the article's own four questions.",
    reasoning: "Group processing only exists in practice if it's built into the calendar — name the ritual so it survives contact with a busy week.",
    docRef: "§v: \"What happened, and why? ... Where did we succeed, where failed?\" — as a closing ritual",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "So the five aren't a poster, they're a way to run a room. And Sami's edge stays in the margin on purpose — that's the signal to loosen it.",
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
    said: "Verdict: UNDERSTOOD, and applied (9/10). You moved from what the text means to what it makes you DO, and left Sami's unresolved tension honestly open.",
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
    said: "Uusi tehtävä, tavallisesta poikkeava: olette lukeneet tekstin johtajuudesta. Tänään vain ymmärrätte sen — muotoilkaa väite, sopikaa mitä se tarkoittaa.",
  },
  {
    speaker: "Vilma",
    phase: "ideation",
    dialogueMove: "propose",
    said: "Otan kasvokkaisen vuorovaikutuksen. Artikkeli sanoo: johtajuuden pitäisi rakentaa 'rakenteita, jotka pakottavat ihmiset yhteen' — rakastan sen suoruutta.",
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
    said: "Positiivinen keskinäisriippuvuus, se on minun. Oma lukutapani: jokainen vetää oman kortensa kekoon, ja työ jaetaan niin ettei kukaan ole pullonkaula.",
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
    said: "Yksilöllinen vastuu: hyvin toimiva ryhmä 'ei hyväksy yhtään vapaamatkustajaa' — jokainen tuo oman panoksensa. Ei piiloutumista joukkoon.",
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
    said: "Vuorovaikutustaidot — tähän todella uskon. Oletus 'työntekijät eivät halua vastuuta' on harhaanjohtava; kysymys on, miten heidät kutsutaan mukaan.",
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
    said: "Minulle jää ryhmän prosessointi. Jaettu reflektointi — artikkelin omat kysymykset: 'Mitä tapahtui, ja miksi? Missä onnistuimme, missä epäonnistuimme?'",
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
    said: "Viisi periaatetta, viisi lukutapaa. Nyt työ: koetelkaa niitä tekstiä vasten. Oletteko yhtä mieltä — vai eikö jokin lukutapa kestä toista silmäystä?",
  },
  {
    speaker: "Sami",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Yksi ei kestä. Otto — 'jaetaan työ niin ettei kukaan ole pullonkaula' on pelkkää työnjakoa. Se on juuri se siilotehtävä. Ei se ole mitä artikkeli tarkoittaa.",
    reasoning: "Hänen lukutapansa on yleinen ja hienovaraisesti väärä — nimeä se tapausta vasten, jonka kaikki muistamme, siilotehtävän, jotta erottelu on konkreettinen eikä saivartelua.",
    docRef: "§i vs. §iii: pelkkä työnjako päästäisi läpi ryhmän täynnä 'vapaamatkustajia'",
  },
  {
    speaker: "Nea",
    phase: "evaluation",
    dialogueMove: "challenge",
    said: "Sami on oikeassa, ja teksti kertoo miksi: jokainen on 'sekä tarpeellinen ETTÄ tarvitsee muita'. Otto, sinun versiosi pudottaa jälkimmäisen puolikkaan.",
    reasoning: "Korjaa täsmällisellä sanamuodolla parafraasin sijaan — koko väärinluenta piilee siinä lauseen puolikkaassa, jonka hän pudotti, joten juuri tarkka lainaus on korjaus.",
    docRef: "§i sanatarkasti: \"jokainen tuntee olevansa sekä tarpeellinen että tarvitsevansa muita yhteisen tavoitteen saavuttamiseksi\"",
  },
  {
    speaker: "Otto",
    phase: "evaluation",
    dialogueMove: "build",
    said: "...Hetkinen. Niin. Luin sen oman tapani läpi — pilko osiin, pysykää tieltä. Mutta se sanoo: 'menestys riippuu jokaisen jäsenen menestyksestä.' Väärinpäin.",
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
    said: "Sehän on se 'samassa veneessä' -kohta, eikö? Otto, et vain kuvannut veneessä olemista — tarvitset muut soutamaan, tai vene ei liiku.",
    reasoning: "Vahvista korjattu lukutapa artikkelin omalla kuvalla, jotta se jää mieleen kaikille, ei vain Otolle — vertauskuva vakiinnuttaa sen, minkä tarkka lainaus juuri korjasi.",
    docRef: "§i: \"Jokainen tuntee olevansa 'samassa veneessä'\"",
  },
  {
    speaker: "Leo",
    phase: "evaluation",
    dialogueMove: "build",
    said: "Huomatkaa mitä juuri tapahtui — se OLI periaate viisi. Osuimme väärinluentaan, tarkistimme sen tekstistä ja korjasimme sen. Teimme ryhmän prosessointia.",
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
    said: "Jaettu versio: johtajuus ei ole ihmisten johtamista vaan ryhmän rakentamista, jossa jokainen tarvitsee muita — ja tietää sen.",
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
    said: "Ydinviesti, ja minun pitäisi sanoa se, koska luin sen ensin väärin: yhteistoiminnalliseen johtajuuteen ei pääse jakamalla. Et pärjää yksin, ja tiedät sen.",
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
    said: "Ja oma alkuperäiseni sopii yhä tämän alle — 'rakenteet, jotka pakottavat ihmiset yhteen' rakentavat veneen, jossa kaikkien on soudettava. Yksi idea.",
    reasoning: "Kytke oma avausperiaatteeni takaisin korjattuun ytimeen ja näytä, että viisi eivät ole lista vaan yhtenäinen kokonaisuus — se yhteys on merkki ymmärryksestä, ei pelkästä luettelosta.",
    docRef: "§ii + §i: rakenteet, jotka \"pakottavat ihmiset työskentelemään yhdessä\", palvelevat §i:n keskinäistä riippuvuutta",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Kirjattakoon: teksti on yhä ohut siitä, mitä teet, kun joku ei suostu veneeseen. Mutta se on kritiikkiä, ei väärinluentaa. Ymmärrän nyt, mitä se väittää.",
    reasoning: "Erota reilu kritiikki artikkelia kohtaan siitä, ettei sitä ymmärrä — sen osoittaminen, ettei ymmärrys vaadi samaa mieltä olemista, on itsessään osa tekstin hyvää ymmärtämistä.",
    docRef: "§iv: luottaminen siihen, miten ihmiset \"kutsutaan mukaan\" — avoin kritiikkini, ei väärinluenta",
  },
  {
    speaker: "Teacher",
    phase: "synthesis",
    dialogueMove: "facilitate",
    said: "Ymmärrätte tekstin. Nyt syvin osa — pohtikaa ääneen: miten nämä viisi periaatetta näkyisivät käytännössä? Ei määritelmiä — tekoja. Olkaa konkreettisia.",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Positiivinen keskinäisriippuvuus käytännössä: yhteinen tuotos, jossa osani kaatuu, jos sinun kaatuu. Hetkellä jona voin onnistua sinun upotessasi, se on mennyt.",
    reasoning: "Tee abstraktista konkreettista epäonnistumisehdon kautta — periaatetta, jota et osaa kuvitella tekona, ei ole oikeasti ymmärretty.",
    docRef: "§i: \"Ryhmän menestys riippuu jokaisen jäsenensä menestyksestä\" — käytännössä",
  },
  {
    speaker: "Otto",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Yksilöllinen vastuu käytännössä on testi: pystyykö jokainen selittämään koko ryhmän tehtävän, ei vain omaa siivuaan? Jos ei, vastuu on näennäistä.",
    reasoning: "Muuta periaate tarkistettavaksi teoksi — väärinlukijana luotan konkreettiseen testiin enemmän kuin hyvään fiilikseen.",
    docRef: "§iii: jokainen \"hoitaa myös oman osuutensa niin hyvin kuin mahdollista\" ja tuo rakentavan panoksensa — testattavaksi tehtynä",
  },
  {
    speaker: "Sami",
    phase: "synthesis",
    dialogueMove: "challenge",
    said: "Tässä panen vastaan. Vilma otti periaatteen kaksi — 'pakottavat ihmiset yhteen'. Jos teen yhteistyötä vain koska en voi piiloutua, onko se yhteistyötä?",
    reasoning: "Periaate kuulostaa vaarattomalta, kunnes istut siinä pakotetussa tuolissa. Rakenteen ja aidon sitoutumisen jännitteen nimeäminen on juuri sitä reflektiota, jota teksti kutsuu mutta ei koskaan ratkaise.",
    docRef: "§ii: \"rakenteita, jotka 'pakottavat' ihmiset työskentelemään yhdessä\" — haastettu: pakotettu osallistuminen vs. aito sitoutuminen",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Sami on oikeassa, se on terävin reuna. Tekstin esimerkki on pöytien siirtäminen pois — se poistaa piiloutumisen, ei pakota. Raja jää meille.",
    reasoning: "Kehystä uudelleen tyrmäämättä — sovittelijan tehtävä on pitää molemmat totuudet yhtä aikaa: teksti tarkoittaa tukirakennetta, ja Samin huoli siitä, missä se kääntyy kontrolliksi, on aito ja vastaamaton.",
    docRef: "§ii: \"rakenteita, jotka 'pakottavat' ihmiset työskentelemään yhdessä\" — luettuna tukirakenteena; tuki/kontrolli-raja jätetty auki",
  },
  {
    speaker: "Nea",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Tehkää periaate neljä toiminnalliseksi — halvin toteuttaa. Teksti antaa säännön: 'puhukaa hetki naapurin kanssa siitä, mitä kuulitte.' Mitattavaa, ja ilmaista.",
    reasoning: "Käytännöllisin periaate on se, johon liittyy konkreettinen menettely — muuta §iv hyveestä aikataulutetuksi toiminnaksi.",
    docRef: "§iv: \"Puhukaa hetki naapureidenne kanssa siitä, mitä juuri kuulitte\" — vakiintuneena kokoussääntönä",
  },
  {
    speaker: "Vilma",
    phase: "synthesis",
    dialogueMove: "build",
    said: "Ja sulkekaa ympyrä periaatteella viisi — rituaalina, ei jälkiajatuksena. Joka projekti päättyy artikkelin neljään kysymykseen. Aikataulutettuna se tapahtuu.",
    reasoning: "Ryhmän prosessointi on olemassa käytännössä vain jos se on rakennettu kalenteriin — nimeä rituaali, jotta se selviää kiireisen viikon yli.",
    docRef: "§v: \"Mitä tapahtui, ja miksi? ... Missä onnistuimme, missä epäonnistuimme?\" — päättävänä rituaalina",
  },
  {
    speaker: "Leo",
    phase: "synthesis",
    dialogueMove: "integrate",
    said: "Viisi ei ole juliste, se on tapa vetää huonetta. Sami saa pitää reunansa marginaalissa — sinä päivänä kun 'rakenne' tuntuu kontrollilta, on aika löysätä.",
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
    said: "Arvio: YMMÄRRETTY, ja sovellettu (9/10). Siirryitte tekstin tarkoituksesta siihen mitä se panee TEKEMÄÄN — ja jätitte Samin jännitteen auki.",
    isVerdict: true,
  },
];

export const TASK_LIBRARY: TaskDefinition[] = [
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
      speakingWeights: { Vilma: 0.7, Otto: 0.7, Nea: 0.7, Sami: 0.7, Leo: 0.7, Aino: 0 },
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
  {
    id: "jigsaw-reciprocal-teaching",
    label: "Palapeli: yhteistoiminnallinen johtajuus",
    task: {
      title: "Ymmärrä yhteistoiminnallinen johtajuus — palapelimenetelmä",
      deliverable:
        "Jokainen selittää kaikki kolme artikkelin teemaa omin sanoin — myös ne kaksi, joita ei itse lukenut.",
    },
    // Approximated, not authored-against: jigsaw is 100% pre-scripted from a
    // real Stage 1 session (never live-generated), so computeDynamics never
    // runs on it and this profile drives no verification. Kept only because
    // PresenterDock/Controls render `profile` unconditionally for every task.
    profile: {
      structure: "closed",
      interdependence: "high",
      consensusMode: "verified",
      speakingWeights: { Vilma: 0.7, Otto: 0.7, Nea: 0.7, Sami: 0.7, Leo: 0.7, Aino: 0.6 },
      turnLengthBias: "long",
      transactivityTarget: "dense",
      expectedSignature: [
        "kaksi ryhmää, sama artikkeli, eri lähtökohta",
        "homogeeninen ryhmä 1 vs. roolitettu ryhmä 2",
        "opettaa oppiakseen: palapelimenetelmä",
        "synteesissä näkyy, kantoiko opetus",
      ],
    },
    turns: JIGSAW_TURNS,
    layout: "jigsaw",
  },
];
