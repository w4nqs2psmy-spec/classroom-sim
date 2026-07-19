// Jigsaw-moodi: kuusi opiskelijaa kahdessa kolmen hengen ryhmässä
// (homogeeninen vs. heterogeeninen) opettaa toisilleen Leppilammen
// artikkelin kolme lukua palapelimenetelmällä. Koko sessio suomeksi.
//
// ERILLINEN ajomoodi: `npm run jigsaw` (oikea) / `npm run jigsaw:dry`
// (mock, ei API-kutsuja). Jäädytettyä Stage 1 -ydintä (loop/agent/
// prompts/teacher/workspace) EI muokata — tämä moodi tuo omat promptinsa
// ja oman silmukkansa ja uudelleenkäyttää vain model-routing.ts:n
// (sama Haiku-reititys, hinnoittelu ja kustannuskirjanpito).
//
// Lokit: logs/jigsaw-<aikaleima>.jsonl — nimi EI ala "session-", joten
// UI:n istuntovalitsin (SESSION_FILE_RE vite.config.ts:ssä) ei poimi
// näitä yhteensopimattomia lokeja replay-listaansa. Jokaisella rivillä
// on groupType ("homogeeninen"/"heterogeeninen"/null), jotta ryhmien
// vertailu onnistuu jälkikäteen suoraan lokista.

import "dotenv/config";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AnthropicModelClient,
  MockModelClient,
  type ModelClient,
} from "../model-routing.ts";
import type { Usage } from "../types.ts";
import {
  CHAPTER_FILES,
  CHAPTER_TITLES,
  JIGSAW_REPLY_SCHEMA,
  JIGSAW_WORLD,
  ROSTER,
  estimateTokens,
  jigsawSystem,
  memberBlock,
  type ChapterId,
  type GroupId,
  type JigsawMember,
} from "./prompts.ts";

// ---------------------------------------------------------------------------
// Konfiguraatio
// ---------------------------------------------------------------------------

// Vuorotyyppien max_tokens: opetusvuoro 150–250 sanaa, tavalliset vuorot
// 50–100 sanaa, synteesi ~100–150 sanaa (kattaa kolme teemaa). Rajat ovat
// tarkoituksella väljät — suomi tokenisoituu tiheästi, ja liian matala
// katto katkoo lauseita ja latistaa kielen (aiempi ongelma).
const MAX_TOKENS = {
  opetus: 1024,
  normaali: 512,
  synteesi: 768,
} as const;

const HAIKU_CACHE_MIN_TOKENS = 4096;

const DRY_RUN = process.argv.includes("--dry-run");

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));

// ---------------------------------------------------------------------------
// Lokitus — oma logger, jotta (1) tiedostonimi ei osu UI:n session-regexiin
// ja (2) jokaiselle riville saadaan ryhmäkentät.
// ---------------------------------------------------------------------------

type JigsawPhase = "luku" | "opetus" | "synteesi";

interface JigsawLogEntry {
  type: "session_start" | "turn" | "phase_transition" | "session_end";
  timestamp: string;
  turn: number;
  phase: JigsawPhase | null;
  speaker: string;
  group: GroupId | null;
  groupType: "homogeeninen" | "heterogeeninen" | null;
  role: string | null;
  chapter: ChapterId | null;
  said: string;
  model: string | null;
  usage: Usage | null;
  costUSD: number | null;
}

const COLORS: Record<string, string> = {
  Opettaja: "\x1b[35m",
  Vilma: "\x1b[33m",
  Otto: "\x1b[31m",
  Nea: "\x1b[36m",
  Sami: "\x1b[32m",
  Leo: "\x1b[34m",
  Aino: "\x1b[95m",
};
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

class JigsawLogger {
  private file: string;

  constructor() {
    const logsDir = root("logs");
    mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.file = `${logsDir}/jigsaw-${stamp}.jsonl`;
    console.log(`${DIM}Loki: ${this.file}${RESET}\n`);
  }

  log(entry: JigsawLogEntry): void {
    appendFileSync(this.file, JSON.stringify(entry) + "\n");
    if (entry.type === "session_start" || entry.type === "session_end") return;

    const color = COLORS[entry.speaker] ?? "";
    const cost = entry.costUSD != null ? ` ${DIM}(~$${entry.costUSD.toFixed(4)})${RESET}` : "";
    const grp = entry.group ? `${DIM}[${entry.group} · ${entry.groupType}]${RESET} ` : "";
    const phase = entry.phase ? `${DIM}[${entry.phase.toUpperCase()} v${entry.turn}]${RESET} ` : "";
    console.log(`${phase}${grp}${color}${BOLD}${entry.speaker}:${RESET} ${entry.said}${cost}\n`);
  }

  banner(text: string): void {
    console.log(`${BOLD}${"═".repeat(70)}${RESET}`);
    console.log(`${BOLD}${text}${RESET}`);
    console.log(`${BOLD}${"═".repeat(70)}${RESET}\n`);
  }
}

// ---------------------------------------------------------------------------
// Alustus
// ---------------------------------------------------------------------------

const chapters: Record<ChapterId, string> = {
  a: readFileSync(root(CHAPTER_FILES.a), "utf8"),
  b: readFileSync(root(CHAPTER_FILES.b), "utf8"),
  c: readFileSync(root(CHAPTER_FILES.c), "utf8"),
};

const client: ModelClient = DRY_RUN ? new MockModelClient() : new AnthropicModelClient();
const logger = new JigsawLogger();

// Ryhmäkohtaiset keskustelut (agentit kuulevat vain oman ryhmänsä) ja
// jokaisen omat lukuvaiheen muistiinpanot (näkyvät vain tekijälleen).
const transcripts: Record<GroupId, string[]> = { ryhma1: [], ryhma2: [] };
const notes: Record<string, string> = {};
let globalTurn = 0;

function groupTranscript(group: GroupId): string {
  const lines = transcripts[group];
  return lines.length === 0 ? "(keskustelu ei ole vielä alkanut)" : lines.join("\n");
}

function membersOf(group: GroupId): JigsawMember[] {
  return ROSTER.filter((m) => m.group === group);
}

function logStudent(member: JigsawMember, phase: JigsawPhase, said: string, meta: { model: string; usage: Usage; costUSD: number }): void {
  logger.log({
    type: "turn",
    timestamp: new Date().toISOString(),
    turn: globalTurn,
    phase,
    speaker: member.name,
    group: member.group,
    groupType: member.groupType,
    role: member.role,
    chapter: member.chapter,
    said,
    model: meta.model,
    usage: meta.usage,
    costUSD: meta.costUSD,
  });
}

// Fasilitaattorin repliikit ovat skriptattuja (ei mallikutsua) — sama
// linjaus kuin live-moodin vaiheavauksissa: deterministinen ja ilmainen.
function logFacilitator(said: string, opts: { phase: JigsawPhase | null; group?: GroupId | null; type?: "turn" | "phase_transition" } = { phase: null }): void {
  globalTurn++;
  const member = opts.group ? membersOf(opts.group)[0] : null;
  logger.log({
    type: opts.type ?? "phase_transition",
    timestamp: new Date().toISOString(),
    turn: globalTurn,
    phase: opts.phase,
    speaker: "Opettaja",
    group: opts.group ?? null,
    groupType: member ? member.groupType : null,
    role: null,
    chapter: null,
    said,
    model: null,
    usage: null,
    costUSD: null,
  });
  if (opts.group) transcripts[opts.group].push(`Opettaja: ${said}`);
}

// ---------------------------------------------------------------------------
// Yksi agenttivuoro
// ---------------------------------------------------------------------------

async function jigsawTurn(
  member: JigsawMember,
  phase: JigsawPhase,
  instruction: string,
  maxTokens: number,
  mock: string,
): Promise<string> {
  globalTurn++;
  const ownNotes = notes[member.name]
    ? `\nOMAT MUISTIINPANOSI LUKUVAIHEESTA:\n${notes[member.name]}\n`
    : "";
  const userMessage = [
    `RYHMÄSI KESKUSTELU TÄHÄN ASTI:\n${groupTranscript(member.group)}`,
    ownNotes,
    instruction,
  ].join("\n");

  const result = await client.call({
    kind: "agent_turn",
    system: jigsawSystem(member, chapters[member.chapter]),
    userMessage,
    maxTokens,
    jsonSchema: JIGSAW_REPLY_SCHEMA as unknown as Record<string, unknown>,
    mockResponse: DRY_RUN ? JSON.stringify({ puhe: mock }) : undefined,
  });

  let said: string;
  try {
    said = (JSON.parse(result.text) as { puhe: string }).puhe.trim();
  } catch {
    said = result.text.trim().slice(0, 1500); // structured outputs pettää harvoin; älä kaada sessiota
  }

  logStudent(member, phase, said, { model: result.model, usage: result.usage, costUSD: result.costUSD });
  return said;
}

// ---------------------------------------------------------------------------
// Pääohjelma
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.banner(`PALAPELISESSIO — yhteistoiminnallinen johtajuus${DRY_RUN ? " — KUIVAHARJOITUS (ei API-kutsuja)" : ""}`);

  // Välimuisti-invariantin tarkistus: jokaisen agentin pysyvän prefiksin
  // (maailma + rooli + kappale) on ylitettävä Haikun 4096 tokenin minimi,
  // muuten välimuisti jää hiljaa käyttämättä.
  const worldEst = estimateTokens(JIGSAW_WORLD);
  for (const m of ROSTER) {
    const prefixEst = worldEst + estimateTokens(memberBlock(m, chapters[m.chapter]));
    const flag = prefixEst >= HAIKU_CACHE_MIN_TOKENS ? "ok" : "ALLE MINIMIN — välimuisti ei toimi!";
    console.log(`${DIM}  prefiksi ${m.name}: ~${prefixEst} tok (${flag})${RESET}`);
    if (prefixEst < HAIKU_CACHE_MIN_TOKENS) {
      console.warn(`VAROITUS: ${m.name}:n prefiksi alittaa ${HAIKU_CACHE_MIN_TOKENS} tokenia.`);
    }
  }
  console.log("");

  logger.log({
    type: "session_start",
    timestamp: new Date().toISOString(),
    turn: 0,
    phase: null,
    speaker: "system",
    group: null,
    groupType: null,
    role: null,
    chapter: null,
    said: `Palapelisessio: 6 opiskelijaa, 2 ryhmää (ryhma1=homogeeninen: Aino/Nea/Leo; ryhma2=heterogeeninen: Vilma=ideoija/Sami=kriitikko/Otto=driver), kappaleet a/b/c Leppilammen artikkelista.`,
    model: null,
    usage: null,
    costUSD: null,
  });

  // ── Vaihe 1: LUKU ───────────────────────────────────────────────────
  logFacilitator(
    "Tervetuloa! Tänään käytetään palapelimenetelmää: jokainen on saanut yhden luvun Leppilammen artikkelista. Lukekaa ensin oma kappaleenne rauhassa ja kirjoittakaa itsellenne lyhyet muistiinpanot — noin 50–100 sanaa siitä, mitkä ovat kappaleen tärkeimmät ajatukset ja mitä aiotte painottaa, kun opetatte sen omalle ryhmällenne.",
    { phase: "luku" },
  );

  for (const m of ROSTER) {
    const said = await jigsawTurn(
      m,
      "luku",
      `TEHTÄVÄSI NYT (lukuvaihe): Lue oma kappaleesi ja kirjoita itsellesi lyhyet muistiinpanot (noin 50–100 sanaa): kappaleen 2–4 tärkeintä ajatusta omin sanoin, keskeiset käsitteet jotka aiot selittää muille, ja yksi konkreettinen esimerkki jolla havainnollistat. Muistiinpanot ovat vain sinulle — kirjoita ne siinä muodossa, josta on sinulle opettaessa eniten hyötyä.`,
      MAX_TOKENS.normaali,
      `[kuivaharjoitus] ${m.name}:n muistiinpanot kappaleesta ${m.chapter}.`,
    );
    notes[m.name] = said; // muistiinpanot talteen — eivät mene ryhmän keskusteluun
  }

  // ── Vaihe 2: OPETUS ─────────────────────────────────────────────────
  logFacilitator(
    "Hyvä, muistiinpanot on tehty. Sitten opetusvuorot: käydään kappaleet järjestyksessä a, b, c, molemmissa ryhmissä. Opettaja selittää kappaleensa omin sanoin, ja sen jälkeen kumpikin kuulija esittää yhden tarkentavan kysymyksen, joihin opettaja vastaa.",
    { phase: "opetus" },
  );

  const chapterOrder: ChapterId[] = ["a", "b", "c"];
  const groupOrder: GroupId[] = ["ryhma1", "ryhma2"];

  for (const chapter of chapterOrder) {
    for (const group of groupOrder) {
      const teacher = membersOf(group).find((m) => m.chapter === chapter)!;
      const listeners = membersOf(group).filter((m) => m.name !== teacher.name);

      logFacilitator(
        `${teacher.name}, sun vuoro: opeta kappaleesi "${CHAPTER_TITLES[chapter]}" ryhmällesi.`,
        { phase: "opetus", group, type: "turn" },
      );

      const teachText = await jigsawTurn(
        teacher,
        "opetus",
        `TEHTÄVÄSI NYT (opetusvuoro): Opeta oman kappaleesi sisältö ryhmällesi omin sanoin, noin 150–250 sanaa. Etene jäsennellysti: iso kuva ensin, sitten pääkohdat esimerkkien kanssa, lopuksi lyhyt kokoava ajatus. Muista että kukaan muu ryhmässäsi ei ole lukenut kappalettasi.`,
        MAX_TOKENS.opetus,
        `[kuivaharjoitus] ${teacher.name} opettaa kappaleen ${chapter} ryhmälleen (150–250 sanaa).`,
      );
      transcripts[group].push(`${teacher.name}: ${teachText}`);

      for (const listener of listeners) {
        const question = await jigsawTurn(
          listener,
          "opetus",
          `TEHTÄVÄSI NYT: ${teacher.name} opetti juuri kappaleensa. Esitä hänelle YKSI tarkentava kysymys juuri kuulemastasi (1–3 virkettä). Tartu johonkin, minkä hän oikeasti sanoi — pyydä esimerkkiä, koettele väitettä tai pyydä täsmennystä epäselvään kohtaan.`,
          MAX_TOKENS.normaali,
          `[kuivaharjoitus] ${listener.name} kysyy tarkentavan kysymyksen ${teacher.name}:lta.`,
        );
        transcripts[group].push(`${listener.name}: ${question}`);

        const answer = await jigsawTurn(
          teacher,
          "opetus",
          `TEHTÄVÄSI NYT: Vastaa ${listener.name}:n äskeiseen kysymykseen (noin 50–100 sanaa). Vastaa juuri siihen mitä kysyttiin; jos kappaleesi ei käsittele asiaa, sano se rehellisesti ja erota oma arviosi artikkelin väitteistä.`,
          MAX_TOKENS.normaali,
          `[kuivaharjoitus] ${teacher.name} vastaa ${listener.name}:n kysymykseen.`,
        );
        transcripts[group].push(`${teacher.name}: ${answer}`);
      }
    }
  }

  // ── Vaihe 3: SYNTEESI ───────────────────────────────────────────────
  logFacilitator(
    "Kaikki kolme kappaletta on nyt opetettu molemmissa ryhmissä. Lopuksi synteesi: pyydän jokaista kertomaan omin sanoin, miten ymmärsitte kaikki kolme teemaa — myös ne kaksi, joita ette itse lukeneet.",
    { phase: "synteesi" },
  );

  for (const group of groupOrder) {
    for (const m of membersOf(group)) {
      logFacilitator(
        `${m.name}, kerro omin sanoin: miten sä ymmärsit nää kolme teemaa kokonaisuutena?`,
        { phase: "synteesi", group, type: "turn" },
      );
      const said = await jigsawTurn(
        m,
        "synteesi",
        `TEHTÄVÄSI NYT (synteesi): Kerro omin sanoin, miten ymmärsit kaikki kolme teemaa — myös ne kaksi, jotka opit ryhmätovereiltasi (noin 100–150 sanaa). Älä toista opetusvuoroja: kytke teemat toisiinsa, nimeä mikä niitä yhdistää, ja sano ääneen myös se, mikä jäi mietityttämään tai minkä ymmärsit vain osittain.`,
        MAX_TOKENS.synteesi,
        `[kuivaharjoitus] ${m.name}:n synteesi kolmesta teemasta.`,
      );
      transcripts[group].push(`${m.name}: ${said}`);
    }
  }

  logFacilitator("Kiitos kaikille — hieno sessio! Tässä näkyi palapelimenetelmän ydin: kukaan ei olisi voinut oppia tätä kokonaisuutta yksin.", { phase: "synteesi" });

  // ── Lopetus ─────────────────────────────────────────────────────────
  logger.banner("SESSIO PÄÄTTYI");
  console.log(`Ryhmä 1 (homogeeninen):  ${transcripts.ryhma1.length} puheenvuoroa keskustelussa`);
  console.log(`Ryhmä 2 (heterogeeninen): ${transcripts.ryhma2.length} puheenvuoroa keskustelussa\n`);
  console.log(client.costs.summary());

  logger.log({
    type: "session_end",
    timestamp: new Date().toISOString(),
    turn: globalTurn,
    phase: null,
    speaker: "system",
    group: null,
    groupType: null,
    role: null,
    chapter: null,
    said: `Sessio valmis. Kokonaiskustannus: $${client.costs.total().toFixed(4)}`,
    model: null,
    usage: null,
    costUSD: client.costs.total(),
  });
}

main().catch((err) => {
  console.error("\nPalapelisessio epäonnistui:", err instanceof Error ? err.message : err);
  if (!process.env.ANTHROPIC_API_KEY && !DRY_RUN) {
    console.error("\nVihje: ANTHROPIC_API_KEY puuttuu. Aseta se .env-tiedostoon tai testaa ilman API-kutsuja:\n  npm run jigsaw:dry");
  }
  process.exit(1);
});
