import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentDrawer } from "./AgentDrawer";
import { Classroom } from "./Classroom";
import { makeEnvelope, useCommandBus } from "./commands";
import { ContributeInput } from "./ContributeInput";
import { Controls } from "./Controls";
import { estimateTurnCost, PERSONAS, STUDENTS, type Move, type TurnView } from "./data";
import type { AmbientTick, MeaningfulMoment } from "./downtime";
import { computeDynamics, type Insight } from "./dynamics";
import { LangProvider, STRINGS, type Lang } from "./i18n";
import { postAgentReply } from "./liveReply";
import { LiveTaskInput } from "./LiveTaskInput";
import { endLiveSession, nextLiveTurn, startLiveSession } from "./liveSession";
import { DynamicsBand } from "./DynamicsBand";
import { JigsawClassroom } from "./JigsawClassroom";
import { JigsawPhaseIndicator } from "./JigsawPhaseIndicator";
import { JigsawSidePanel } from "./JigsawSidePanel";
import { DowntimeBadge } from "./ModeIndicator";
import { PhaseIndicator } from "./PhaseIndicator";
import { PresentationBar } from "./PresentationBar";
import { PresenterDock } from "./PresenterDock";
import { SCENARIOS } from "./scenarios";
import { CURATED_SESSION, listSessions, loadRealSession, type SessionSummary } from "./sessionLoader";
import { AgentsProvider, computeAgents, HUMAN, SimProvider, useSim, type HistoryMoment } from "./store";
import { resolveTask, TASK_LIBRARY } from "./tasks";
import { useDowntimeClock } from "./useDowntimeClock";
import { usePresentationMode } from "./usePresentationMode";
import { WorkspacePanel } from "./WorkspacePanel";

const EMPTY_AMBIENT: Record<string, AmbientTick> = {};

// How many live turns to keep generated ahead of the revealed turn, so autoplay
// never stalls waiting on model latency (generation ~3 s < default speed 7 s).
const LIVE_BUFFER_AHEAD = 2;

// Stage-1 interjection reaction chain (see the CONTRIBUTE handler below): how
// many extra students react, in sequence, after the agent the presenter
// directly addressed. Keep this small — each extra reaction is a real model
// call, adding both latency and cost to a live interjection.
const MAX_REACTION_TURNS = 2;

const HUMAN_ROSTER = [...STUDENTS, HUMAN] as const;

// Reaction-chain speaker pick: weighted by talkativeness (same spirit as
// src/loop.ts's pickSpeaker — frozen and Node-only, so not importable here),
// excluding whoever is passed in `exclude` (the directly-addressed agent,
// always; the previous reactor, so the same voice never repeats back-to-back).
function pickReactor(exclude: ReadonlySet<string>): string | null {
  const candidates = STUDENTS.filter((n) => !exclude.has(n));
  if (candidates.length === 0) return null;
  const weights = candidates.map((n) => PERSONAS[n].talkativeness);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

interface ActiveSession {
  file: string;
  turns: TurnView[];
  task: { title: string; deliverable: string };
  isComplete: boolean;
}

// A live session: turns are generated server-side one at a time and appended
// here as they arrive (the generation driver in AppInner keeps a small buffer
// ahead of the revealed turn). `done` flips when the server reaches the round
// cap. Same category as ActiveSession — data-source selection, not sim state.
interface LiveActive {
  sessionId: string;
  turns: TurnView[];
  task: { title: string; deliverable: string };
  done: boolean;
  costUSD: number;
}

// A human turn spliced into the authored script, anchored to the authored
// index it follows; `order` disambiguates multiple contributions at one anchor.
interface Contribution {
  afterAuthored: number;
  order: number;
  turn: TurnView;
}

function mergeContributions(
  authored: TurnView[],
  contributions: Contribution[],
): { turns: TurnView[]; anchors: number[] } {
  if (contributions.length === 0) return { turns: authored, anchors: authored.map((_, i) => i) };
  const turns: TurnView[] = [];
  const anchors: number[] = [];
  authored.forEach((t, i) => {
    turns.push(t);
    anchors.push(i);
    contributions
      .filter((c) => c.afterAuthored === i)
      .sort((a, b) => a.order - b.order)
      .forEach((c) => {
        turns.push(c.turn);
        anchors.push(i);
      });
  });
  return { turns, anchors };
}

function AppInner() {
  const { state, dispatch } = useSim();
  const { mode, turnIndex, playing, speedMs, idlePaceMs, selected, downtimeHistory } = state;

  // UI language — a display preference like dynamicsVisible; persisted, never
  // resets the sim. Finnish task content falls back to English where absent.
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("classroom-sim-lang") === "fi" ? "fi" : "en"));
  const setLangPersisted = useCallback((next: Lang) => {
    setLang(next);
    localStorage.setItem("classroom-sim-lang", next);
  }, []);
  const t = STRINGS[lang];

  const historyKeyRef = useRef(0);
  const lastCostedTurnRef = useRef(-1);

  const handleMeaningful = useCallback((moment: MeaningfulMoment, costUSD: number) => {
    historyKeyRef.current += 1;
    const entry: HistoryMoment = { ...moment, key: historyKeyRef.current };
    dispatch({ type: "ADD_MEANINGFUL", moment: entry, costUSD });
  }, [dispatch]);

  const { ambient, activeMoment } = useDowntimeClock(mode === "downtime", idlePaceMs, handleMeaningful);

  // Which dataset is active: a scripted scenario or a real log file. This is
  // data-source selection, not simulation state, so it lives outside the
  // reducer — same category as the picker's fetch status.
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [libraryTaskId, setLibraryTaskId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // ── Live session (dev-only real generation) ────────────────────────────
  const [liveState, setLiveState] = useState<LiveActive | null>(null);
  const [liveComposeOpen, setLiveComposeOpen] = useState(false);
  const [liveGenerating, setLiveGenerating] = useState(false); // start or a turn is in flight
  const [liveUnavailable, setLiveUnavailable] = useState(false); // start returned null (static host)
  // Teardown reads the id from a ref so callbacks needn't depend on liveState.
  const liveSessionIdRef = useRef<string | null>(null);
  const liveGenRef = useRef(false); // one /api/live/next in flight at a time
  const liveAutoPlayedRef = useRef(false); // autoplay kicked off once per live session

  const endLive = useCallback(() => {
    const sid = liveSessionIdRef.current;
    if (sid) endLiveSession(sid);
    liveSessionIdRef.current = null;
    liveGenRef.current = false;
    liveAutoPlayedRef.current = false;
    setLiveState(null);
    setLiveGenerating(false);
  }, []);

  useEffect(() => {
    listSessions()
      // The picker shows only the curated showcase log; the rest are archive
      // clutter on stage (they remain on disk and loadable by filename).
      .then((all) => setSessions(all.filter((s) => s.file === CURATED_SESSION)))
      .catch((err) => setSessionError(err instanceof Error ? err.message : String(err)));
  }, []);

  const handleSelectDataset = useCallback(
    (value: string, opts?: { keepPlaying?: boolean }) => {
      // Switching dataset — scenario↔scenario, scenario↔real, real↔real —
      // always resets turnIndex via START_TASK first. Skipping the reset on
      // any path can leave turnIndex past the new dataset's length (datasets
      // differ in turn count), making turns[turnIndex] undefined.
      setSessionError(null);
      lastCostedTurnRef.current = -1;
      setContributions([]); // each task is a fresh discussion; you keep your chair
      firedInsightsRef.current = new Set();
      setFlashInsight(null);
      endLive(); // switching to a scripted/real dataset ends any live session
      setLiveUnavailable(false);
      dispatch({ type: "START_TASK", keepPlaying: opts?.keepPlaying });

      if (value.startsWith("task:")) {
        setActiveSession(null);
        setLibraryTaskId(value.slice("task:".length));
        return;
      }
      if (value.startsWith("scenario:")) {
        setActiveSession(null);
        setLibraryTaskId(null);
        setScenarioId(value.slice("scenario:".length));
        return;
      }
      setSessionLoading(true);
      loadRealSession(value)
        .then((loaded) => {
          setActiveSession({ file: value, ...loaded });
          // Re-arm cost accounting for the moment the loaded turns actually
          // swap in — the reset at selection time above happened while the
          // OLD dataset was still mounted.
          lastCostedTurnRef.current = -1;
        })
        .catch((err) => setSessionError(err instanceof Error ? err.message : String(err)))
        .finally(() => setSessionLoading(false));
    },
    [dispatch, endLive],
  );

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const libraryTask = libraryTaskId ? (TASK_LIBRARY.find((t) => t.id === libraryTaskId) ?? null) : null;
  // Resolve the active task's user-facing content for the current language
  // (falls back to English where no Finnish overlay exists).
  const resolvedLibraryTask = libraryTask ? resolveTask(libraryTask, lang) : null;
  // Live session takes priority as the active dataset when present; its turns
  // array grows as the generation driver appends.
  const authoredTurns = liveState?.turns ?? activeSession?.turns ?? resolvedLibraryTask?.turns ?? scenario.turns;
  const taskInfo = liveState?.task ?? activeSession?.task ?? resolvedLibraryTask?.task ?? scenario.task;
  // Swaps Classroom/WorkspacePanel/PhaseIndicator for the two-group jigsaw
  // layout below. `layout` is structural (not language-dependent), so it's
  // read off the raw libraryTask, not the language-resolved one.
  const isJigsaw = mode === "task" && libraryTask?.layout === "jigsaw";

  // ── Human participant ──────────────────────────────────────────────────
  // Contributions are spliced into the authored script at runtime, never
  // written back into a task dataset. `hasJoined` persists across tasks (you
  // keep your chair); `contributions` reset per task (fresh discussion).
  const [hasJoined, setHasJoined] = useState(false);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const contribOrderRef = useRef(0);

  // Effective transcript = authored turns with each human turn spliced in
  // right after the authored turn it followed. `anchors[i]` is the authored
  // index each effective turn belongs to — used to place the next injection.
  const { turns, anchors } = useMemo(() => mergeContributions(authoredTurns, contributions), [authoredTurns, contributions]);

  const atEnd = turnIndex >= turns.length - 1;
  const current = turns[turnIndex] ?? turns[turns.length - 1];

  // Task-mode autoplay: advance every speedMs; pause automatically at the end.
  useEffect(() => {
    if (mode !== "task" || !playing) return;
    const id = setInterval(() => {
      dispatch({ type: "AUTOPLAY_TICK", maxIndex: turns.length - 1 });
    }, speedMs);
    return () => clearInterval(id);
  }, [mode, playing, speedMs, turns.length, dispatch]);

  // Live cost of each task turn as it's revealed. Real sessions carry their
  // own measured costUSD per turn (number or null-for-unknown); scripted
  // content (costUSD left undefined) falls back to the mock estimator. The
  // two are accumulated SEPARATELY into store state (see CostTotals in
  // store.tsx) so an estimate is never conflated with a measured number —
  // kept as dev-only bookkeeping even though no UI currently displays it.
  useEffect(() => {
    // No booking while a session load is in flight: between selection and
    // the async swap, the OLD dataset's turns are still mounted and booking
    // its turn 0 would both add a phantom estimate and advance the ref past
    // the incoming dataset's first turn.
    if (mode !== "task" || sessionLoading) return;
    if (turnIndex <= lastCostedTurnRef.current) return;
    let measured = 0;
    let estimated = 0;
    for (let i = lastCostedTurnRef.current + 1; i <= turnIndex; i++) {
      const t = turns[i];
      if (t.costUSD === undefined) {
        estimated += estimateTurnCost(t);
      } else if (t.costUSD !== null) {
        measured += t.costUSD;
      }
    }
    lastCostedTurnRef.current = turnIndex;
    dispatch({ type: "ADD_COST", measured, estimated });
  }, [mode, sessionLoading, turnIndex, turns, dispatch]);

  const workspaceEntries = useMemo(
    () =>
      turns
        .slice(0, turnIndex + 1)
        .flatMap((t) => (t.workspaceEntry ? [t.workspaceEntry] : [])),
    [turns, turnIndex],
  );

  const status =
    mode === "downtime"
      ? ("no_task" as const)
      : turns.slice(0, turnIndex + 1).some((t) => t.isVerdict)
        ? ("accepted" as const)
        : ("in_progress" as const);

  // Latest private reasoning of the selected agent, from whichever stream is active.
  const selectedReasoning = useMemo(() => {
    if (!selected) return null;
    if (mode === "task") {
      for (let i = turnIndex; i >= 0; i--) {
        if (turns[i].speaker === selected && turns[i].reasoning) return turns[i].reasoning!;
      }
      return null;
    }
    for (let i = downtimeHistory.length - 1; i >= 0; i--) {
      if (downtimeHistory[i].speaker === selected) return downtimeHistory[i].reasoning;
    }
    return null;
  }, [selected, mode, turnIndex, turns, downtimeHistory]);

  const activeSpeaker = mode === "task" ? current.speaker : (activeMoment?.speaker ?? null);
  const said = mode === "task" ? current.said : (activeMoment?.said ?? null);
  const emotion = mode === "task" ? current.emotion : activeMoment?.emotion;
  const turnKey = mode === "task" ? turnIndex : (activeMoment?.key ?? -1);
  const ambientForSync = mode === "downtime" ? ambient : EMPTY_AMBIENT;

  // "Last spoke" bookkeeping only, not simulation truth — same category as
  // historyKeyRef/lastCostedTurnRef above, mutated imperatively and read
  // back into the (otherwise pure) computeAgents() call below.
  const lastSpokeTurnsRef = useRef<Record<string, number>>({});

  // Derived synchronously in the same render as turnIndex/activeSpeaker/
  // ambient change — deliberately not a dispatched action (see store.tsx).
  const agents = useMemo(
    () => computeAgents({ turnIndex, activeSpeaker, said, emotion, ambient: ambientForSync, lastSpokeTurns: lastSpokeTurnsRef.current, includeHuman: hasJoined }),
    [turnIndex, activeSpeaker, said, emotion, ambientForSync, hasJoined],
  );

  // Pedagogical dynamics: a pure function of the visible prefix, same
  // derivation pattern as workspaceEntries above. Task-mode only.
  const [dynamicsVisible, setDynamicsVisible] = useState(true);
  const hasSourceDocument = !activeSession && !liveState && Boolean(resolvedLibraryTask?.sourceDocument);
  const dynamics = useMemo(
    () =>
      mode === "task" && !isJigsaw
        ? computeDynamics(turns.slice(0, turnIndex + 1), {
            hasSourceDocument,
            roster: hasJoined ? HUMAN_ROSTER : undefined,
          })
        : null,
    [mode, isJigsaw, turns, turnIndex, hasSourceDocument, hasJoined],
  );

  // Presentation Mode is task-mode only for v1 — exiting it if the presenter
  // ever leaves task mode keeps the two concerns from having to interact.
  const { isPresenting, usingRealFullscreen, enter: enterPresentation, exit: exitPresentation } = usePresentationMode();
  useEffect(() => {
    if (isPresenting && mode !== "task") exitPresentation();
  }, [isPresenting, mode, exitPresentation]);

  // ── Live session ───────────────────────────────────────────────────────
  // Kick off a live session: create it server-side, fetch the first turn, then
  // swap it in as the active dataset. Same reset discipline as a dataset switch.
  const startLiveSessionFlow = useCallback(
    async (taskText: string) => {
      endLive();
      setLiveUnavailable(false);
      setLiveGenerating(true);
      const started = await startLiveSession({ taskText, lang });
      if (!started) {
        // No dev middleware (static Pages build) or a start failure → degrade.
        setLiveGenerating(false);
        setLiveUnavailable(true);
        return;
      }
      const first = await nextLiveTurn(started.sessionId);
      if (!first || !first.turn) {
        endLiveSession(started.sessionId);
        setLiveGenerating(false);
        setLiveUnavailable(true);
        return;
      }
      setSessionError(null);
      lastCostedTurnRef.current = -1;
      setContributions([]);
      firedInsightsRef.current = new Set();
      setFlashInsight(null);
      setActiveSession(null);
      setLibraryTaskId(null);
      liveSessionIdRef.current = started.sessionId;
      liveAutoPlayedRef.current = false;
      setLiveState({
        sessionId: started.sessionId,
        turns: [first.turn],
        task: started.task,
        done: first.done,
        costUSD: first.costUSD,
      });
      dispatch({ type: "START_TASK", keepPlaying: false });
      setLiveGenerating(false);
    },
    [lang, endLive, dispatch],
  );

  // Generation driver: keep LIVE_BUFFER_AHEAD turns generated past the revealed
  // index. Re-runs when a turn is appended (liveState changes) or autoplay
  // advances turnIndex; one /api/live/next in flight at a time (liveGenRef).
  useEffect(() => {
    if (mode !== "task" || !liveState || liveState.done) return;
    if (liveState.turns.length - 1 >= turnIndex + LIVE_BUFFER_AHEAD) return; // buffer full
    if (liveGenRef.current) return;
    const sid = liveState.sessionId;
    liveGenRef.current = true;
    setLiveGenerating(true);
    nextLiveTurn(sid)
      .then((res) => {
        setLiveState((prev) => {
          if (!prev || prev.sessionId !== sid) return prev; // session changed mid-flight
          if (!res) return { ...prev, done: true }; // failure → stop the loop cleanly
          if (res.turn) return { ...prev, turns: [...prev.turns, res.turn], done: res.done, costUSD: res.costUSD };
          return { ...prev, done: true, costUSD: res.costUSD };
        });
      })
      .finally(() => {
        liveGenRef.current = false;
        setLiveGenerating(false);
      });
  }, [mode, liveState, turnIndex]);

  // Auto-start autoplay once a live session has a little buffer, so the reveal
  // begins on its own; after that the presenter controls play/pause.
  useEffect(() => {
    if (mode !== "task" || !liveState || liveAutoPlayedRef.current) return;
    if (liveState.turns.length >= 3 && !playing) {
      liveAutoPlayedRef.current = true;
      dispatch({ type: "TOGGLE_PLAY" });
    }
  }, [mode, liveState, playing, dispatch]);

  const openLive = useCallback(() => {
    if (playing) dispatch({ type: "TOGGLE_PLAY" }); // pause so the composer holds
    setLiveUnavailable(false);
    setLiveComposeOpen(true);
  }, [playing, dispatch]);

  // ── Command layer ─────────────────────────────────────────────────────
  // Single dispatch path for every steering surface (hotkeys, dock, and a
  // future audience relay via BroadcastChannel — see commands.ts).
  // Step 1 scope: SELECT_TASK targets the existing scenarios; the task
  // library joins this validation set when tasks.ts lands.
  const dispatchCommand = useCommandBus({
    selectTask: (taskId) => {
      // Command-driven switches keep the show running: playback state
      // survives the dataset swap (the presenter shouldn't re-press play).
      if (TASK_LIBRARY.some((t) => t.id === taskId)) {
        handleSelectDataset(`task:${taskId}`, { keepPlaying: true });
        return true;
      }
      if (SCENARIOS.some((s) => s.id === taskId)) {
        handleSelectDataset(`scenario:${taskId}`, { keepPlaying: true });
        return true;
      }
      return false;
    },
    play: () => {
      if (!playing) dispatch({ type: "TOGGLE_PLAY" });
    },
    pause: () => {
      if (playing) dispatch({ type: "TOGGLE_PLAY" });
    },
    setSpeed: (ms) => dispatch({ type: "SET_SPEED", ms }),
    seek: (index) => dispatch({ type: "SEEK_TURN", index, maxIndex: turns.length - 1 }),
    toggleDynamics: () => setDynamicsVisible((v) => !v),
    contribute: (text, move, targetAgent) => {
      if (mode !== "task") return false; // you join the group WORK
      // Anchor the new turn to the authored index the current turn belongs
      // to, so it splices in right after what's on screen.
      const anchor = anchors[turnIndex] ?? authoredTurns.length - 1;
      const phase = turns[turnIndex]?.phase ?? "ideation";
      const humanTurn: TurnView = {
        speaker: HUMAN,
        phase,
        said: text,
        dialogueMove: (move as Move) ?? "build",
        costUSD: 0, // a human talking is free — never an estimate
      };
      setContributions((prev) => [...prev, { afterAuthored: anchor, order: contribOrderRef.current++, turn: humanTurn }]);
      setHasJoined(true);
      if (playing) dispatch({ type: "TOGGLE_PLAY" }); // pause so your bubble holds
      const humanIndex = turnIndex + 1;
      dispatch({ type: "SEEK_TURN", index: humanIndex, maxIndex: humanIndex }); // reveal it

      // If you addressed a specific agent, it generates a REAL reply — and
      // then a short reaction chain (MAX_REACTION_TURNS other students, in
      // character, one at a time) so the interjection reads as a moment of
      // group conversation rather than a single Q&A exchange. The whole
      // thing is sequential: each call awaits the previous one and includes
      // its reply in the transcript, so reactions actually build on each
      // other instead of all answering the human in parallel. Every call
      // goes through the same postAgentReply → setContributions → SEEK_TURN
      // path as the original single reply; the first null (offline, 404 on
      // the static Pages build, refusal, timeout) stops the chain right
      // there and the script continues — no turn is ever fabricated.
      if (targetAgent && STUDENTS.includes(targetAgent as (typeof STUDENTS)[number])) {
        setThinkingAgent(targetAgent);
        const recent = turns
          .slice(Math.max(0, turnIndex - 7), turnIndex + 1)
          .map((tn) => `${tn.speaker}: ${tn.said}`)
          .join("\n");
        const transcript = `${recent}\n${HUMAN}: ${text}`;
        const taskText = `${taskInfo.title}. ${taskInfo.deliverable}`;
        let revealIndex = humanIndex;

        (async () => {
          try {
            const result = await postAgentReply({ agentName: targetAgent, humanText: text, transcript, taskText, lang });
            // Real reply carries measured costUSD (the cost effect books it as
            // turnIndex reaches it); a fallback line is free. No dialogueMove →
            // heuristic/faded tick, honest that this turn is dynamic.
            const say = result?.say ?? t.liveFallback[targetAgent] ?? "…";
            const replyTurn: TurnView = { speaker: targetAgent, phase, said: say, costUSD: result?.costUSD ?? 0 };
            setContributions((prev) => [...prev, { afterAuthored: anchor, order: contribOrderRef.current++, turn: replyTurn }]);
            revealIndex += 1;
            dispatch({ type: "SEEK_TURN", index: revealIndex, maxIndex: revealIndex });
            if (!result) return; // offline/refused/timeout — the chain would only fail the same way

            let runningTranscript = `${transcript}\n${targetAgent}: ${say}`;
            let lastLine = say;
            const spoken = new Set<string>([targetAgent]); // never the addressed agent again
            for (let i = 0; i < MAX_REACTION_TURNS; i++) {
              const reactor = pickReactor(spoken);
              if (!reactor) break; // no eligible peer left (can't happen with 5 students)
              setThinkingAgent(reactor);
              const reaction = await postAgentReply({
                agentName: reactor,
                humanText: lastLine,
                transcript: runningTranscript,
                taskText,
                lang,
              });
              if (!reaction) break; // degrade cleanly — stop, don't fabricate a turn
              const reactionTurn: TurnView = { speaker: reactor, phase, said: reaction.say, costUSD: reaction.costUSD };
              setContributions((prev) => [...prev, { afterAuthored: anchor, order: contribOrderRef.current++, turn: reactionTurn }]);
              revealIndex += 1;
              dispatch({ type: "SEEK_TURN", index: revealIndex, maxIndex: revealIndex });
              runningTranscript += `\n${reactor}: ${reaction.say}`;
              lastLine = reaction.say;
              spoken.clear();
              spoken.add(targetAgent);
              spoken.add(reactor); // excluded next round too — no back-to-back repeat
            }
          } finally {
            setThinkingAgent(null);
          }
        })();
      }
      return true;
    },
    startLive: (taskText) => {
      void startLiveSessionFlow(taskText);
      return true;
    },
  });

  // Contribute overlay (local UI state). Opening pauses autoplay so your
  // bubble will hold once you send.
  const [contributeOpen, setContributeOpen] = useState(false);
  // The agent generating a live reply to your interjection (shows a "…" cue).
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);

  // Insight flash — the magic moment. Fires ONCE per insight id per task run
  // (the ref remembers ids across seek-backs, so rewinding never re-fires);
  // reset on dataset switch / task start.
  const [flashInsight, setFlashInsight] = useState<Insight | null>(null);
  const firedInsightsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (mode !== "task" || !dynamics) return;
    for (const ins of dynamics.insights) {
      if (!firedInsightsRef.current.has(ins.id)) {
        firedInsightsRef.current.add(ins.id);
        setFlashInsight(ins);
        break; // one cinematic at a time; simultaneous others become chips quietly
      }
    }
  }, [mode, dynamics]);
  const openContribute = useCallback(() => {
    if (mode !== "task") return;
    if (playing) dispatch({ type: "TOGGLE_PLAY" });
    setContributeOpen(true);
  }, [mode, playing, dispatch]);

  // Presenter dock: local UI-surface state (not part of the command
  // contract). Auto-hides shortly after a selection so the room comes back.
  const [dockVisible, setDockVisible] = useState(false);
  const dockHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDockSelect = useCallback(
    (taskId: string) => {
      dispatchCommand(makeEnvelope({ type: "SELECT_TASK", taskId }, "presenter-dock"));
      if (dockHideTimer.current) clearTimeout(dockHideTimer.current);
      dockHideTimer.current = setTimeout(() => setDockVisible(false), 1600);
    },
    [dispatchCommand],
  );

  // Presenter hotkeys — presentation mode only, so they never collide with
  // normal-mode form controls (the picker, buttons, etc.).
  useEffect(() => {
    if (!isPresenting) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(input|select|textarea)$/i.test(target.tagName)) return;
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const task = TASK_LIBRARY[idx];
        if (task) dispatchCommand(makeEnvelope({ type: "SELECT_TASK", taskId: task.id }, "presenter-hotkey"));
      } else if (e.key === " ") {
        e.preventDefault();
        dispatchCommand(makeEnvelope({ type: playing ? "PAUSE" : "PLAY" }, "presenter-hotkey"));
      } else if (e.key === "d" || e.key === "D") {
        dispatchCommand(makeEnvelope({ type: "TOGGLE_DYNAMICS" }, "presenter-hotkey"));
      } else if (e.key === "p" || e.key === "P") {
        setDockVisible((v) => !v);
      } else if (e.key === "c" || e.key === "C") {
        openContribute();
      } else if (e.key === "l" || e.key === "L") {
        openLive();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPresenting, playing, dispatchCommand, openContribute, openLive]);

  const rootClassName = [
    "app",
    isPresenting && "presenting",
    isPresenting && !usingRealFullscreen && "simulated-fullscreen",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <LangProvider lang={lang}>
    <AgentsProvider value={agents}>
      <div className={rootClassName}>
        <header className="topbar">
          <h1 className="topbar-title">{t.appTitle}</h1>
          {mode === "task" ? (
            isJigsaw ? <JigsawPhaseIndicator current={current.phase} /> : <PhaseIndicator current={current.phase} />
          ) : (
            <DowntimeBadge />
          )}
          <span className={`data-source-badge ${liveState ? "live" : activeSession ? "real" : "placeholder"}`}>
            {liveState
              ? t.liveBadge(taskInfo.title)
              : activeSession
                ? t.badgeReal(activeSession.file)
                : resolvedLibraryTask
                  ? t.badgeTask(resolvedLibraryTask.label)
                  : t.badgeScenario(scenario.label)}
          </span>
        </header>

        <main className="main">
          {isJigsaw ? (
            <>
              <JigsawClassroom
                turns={turns}
                turnIndex={turnIndex}
                selected={selected}
                onSelect={(name) => dispatch({ type: "SELECT", name })}
              />
              <JigsawSidePanel task={taskInfo} turns={turns} turnIndex={turnIndex} compact={isPresenting} />
            </>
          ) : (
            <>
              <Classroom
                taskTitle={mode === "task" ? taskInfo.title : t.freeTimeNoTask}
                hasTask={mode === "task"}
                turnKey={turnKey}
                dynamics={dynamicsVisible ? dynamics : null}
                selected={selected}
                hasJoined={hasJoined}
                thinkingAgent={thinkingAgent}
                currentMove={(() => {
                  // The pedagogy printed on the bubble: current turn's hand-tagged
                  // move. Heuristic turns show no badge (estimation stays honest).
                  const tick = dynamics?.timeline[dynamics.timeline.length - 1];
                  return tick && tick.tagged && tick.move !== "facilitate" ? tick.move : null;
                })()}
                flashInsight={flashInsight}
                onFlashDone={() => setFlashInsight(null)}
                onSelect={(name) => dispatch({ type: "SELECT", name })}
                onJoin={() => openContribute()}
              />
              <WorkspacePanel
                task={mode === "task" ? taskInfo : null}
                sourceDocument={mode === "task" && !activeSession && !liveState ? (resolvedLibraryTask?.sourceDocument ?? null) : null}
                entries={workspaceEntries}
                status={status}
                compact={isPresenting}
              />
            </>
          )}
          {selected && (
            <AgentDrawer
              name={selected}
              reasoning={selectedReasoning}
              onClose={() => dispatch({ type: "SELECT", name: selected })}
            />
          )}
        </main>

        {dynamics && dynamicsVisible && (
          <DynamicsBand
            dynamics={dynamics}
            currentIndex={turnIndex}
            onSeek={(index) => dispatch({ type: "SEEK_TURN", index, maxIndex: turns.length - 1 })}
          />
        )}

        <Controls
          mode={mode}
          hideExtras={isJigsaw}
          turn={turnIndex}
          totalTurns={turns.length}
          playing={playing}
          speedMs={speedMs}
          atEnd={atEnd}
          idlePaceMs={idlePaceMs}
          scenarios={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))}
          tasks={TASK_LIBRARY.map((tk) => ({ id: tk.id, label: resolveTask(tk, lang).label }))}
          sessions={sessions}
          lang={lang}
          onSetLang={setLangPersisted}
          datasetValue={
            activeSession ? activeSession.file : libraryTask ? `task:${libraryTask.id}` : `scenario:${scenario.id}`
          }
          sessionLoading={sessionLoading}
          sessionError={sessionError}
          onSelectDataset={handleSelectDataset}
          onToggleDock={() => setDockVisible((v) => !v)}
          onContribute={openContribute}
          onLive={openLive}
          liveGenerating={liveGenerating}
          liveUnavailable={liveUnavailable}
          onStartTask={() => {
            // Starts (or restarts) whichever dataset is currently selected.
            // A live session is not a picker dataset, so restarting leaves it.
            endLive();
            setLiveUnavailable(false);
            setContributions([]);
            firedInsightsRef.current = new Set();
            setFlashInsight(null);
            dispatch({ type: "START_TASK" });
            lastCostedTurnRef.current = -1;
          }}
          onBackToDowntime={() => {
            endLive();
            dispatch({ type: "BACK_TO_DOWNTIME" });
          }}
          onNextTurn={() => dispatch({ type: "NEXT_TURN", maxIndex: turns.length - 1 })}
          onTogglePlay={() => dispatch({ type: "TOGGLE_PLAY" })}
          onSpeedChange={(ms) => dispatch({ type: "SET_SPEED", ms })}
          onIdlePaceChange={(ms) => dispatch({ type: "SET_IDLE_PACE", ms })}
          onPresent={enterPresentation}
          dynamicsVisible={dynamicsVisible}
          onToggleDynamics={() => setDynamicsVisible((v) => !v)}
        />

        {isPresenting && (
          <PresentationBar
            playing={playing}
            atEnd={atEnd}
            dynamicsVisible={dynamicsVisible}
            onTogglePlay={() => dispatch({ type: "TOGGLE_PLAY" })}
            onToggleDynamics={() => setDynamicsVisible((v) => !v)}
            onToggleDock={() => setDockVisible((v) => !v)}
            onContribute={openContribute}
            onExit={exitPresentation}
          />
        )}

        {dockVisible && (
          <PresenterDock
            tasks={TASK_LIBRARY}
            lang={lang}
            activeTaskId={activeSession ? null : libraryTaskId}
            onSelect={handleDockSelect}
            onClose={() => setDockVisible(false)}
          />
        )}

        {contributeOpen && (
          <ContributeInput
            presentAgents={[...STUDENTS]}
            defaultTarget={activeSpeaker && STUDENTS.includes(activeSpeaker as (typeof STUDENTS)[number]) ? activeSpeaker : null}
            onSubmit={(text, move, targetAgent) => {
              dispatchCommand(makeEnvelope({ type: "CONTRIBUTE", text, move, targetAgent }, "presenter-dock"));
              setContributeOpen(false);
            }}
            onCancel={() => setContributeOpen(false)}
          />
        )}

        {liveComposeOpen && (
          <LiveTaskInput
            onSubmit={(taskText) => {
              dispatchCommand(makeEnvelope({ type: "START_LIVE", taskText }, "presenter-dock"));
              setLiveComposeOpen(false);
            }}
            onCancel={() => setLiveComposeOpen(false)}
          />
        )}
      </div>
    </AgentsProvider>
    </LangProvider>
  );
}

export default function App() {
  return (
    <SimProvider>
      <AppInner />
    </SimProvider>
  );
}
