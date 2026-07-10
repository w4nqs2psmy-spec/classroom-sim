import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { STUDENTS, type Emotion } from "./data";
import { IDLE_PACES, type AmbientTick, type MeaningfulMoment } from "./downtime";

export type Mode = "downtime" | "task";
export const ALL_PEOPLE = ["Teacher", ...STUDENTS] as const;
export type AgentName = (typeof ALL_PEOPLE)[number];
// The human participant is not part of the AI cast; its activity is only
// present in the agents map after the presenter joins.
export const HUMAN = "You";

export interface HistoryMoment extends MeaningfulMoment {
  key: number;
}

export type AgentActivity =
  | { kind: "idle" }
  | { kind: "ambient"; tick: AmbientTick }
  | { kind: "speaking"; text: string; emotion?: Emotion };

export interface AgentState {
  activity: AgentActivity;
  lastSpokeTurn: number;
}

export type AgentsMap = Record<AgentName, AgentState> & { You?: AgentState };

// Per-agent activity is deliberately NOT reducer state (see AgentsProvider):
// it's a pure function of turnIndex/activeSpeaker/ambient, computed in the
// same render as those inputs change. Routing it through a dispatch+effect
// round-trip instead introduces a one-render lag between "turnIndex changed"
// and "agents caught up", which showed up as a stuck-at-opacity-0 ghost
// bubble in AnimatePresence (confirmed in both dev and production builds).
// Measured = summed from real session logs' per-turn costUSD.
// Estimated = the mock estimator (scripted scenarios, downtime moments).
// Kept separate so the UI can be honest about provenance: a total that
// includes any estimate is displayed with a ~ prefix, never dressed up
// as a measured number.
export interface CostTotals {
  measured: number;
  estimated: number;
}

export interface SimState {
  mode: Mode;
  turnIndex: number;
  playing: boolean;
  speedMs: number;
  idlePaceMs: number;
  selected: string | null;
  totalCost: CostTotals;
  downtimeHistory: HistoryMoment[];
}

export type SimAction =
  | { type: "START_TASK"; keepPlaying?: boolean }
  | { type: "BACK_TO_DOWNTIME" }
  | { type: "NEXT_TURN"; maxIndex: number }
  | { type: "SEEK_TURN"; index: number; maxIndex: number }
  | { type: "AUTOPLAY_TICK"; maxIndex: number }
  | { type: "TOGGLE_PLAY" }
  | { type: "SET_SPEED"; ms: number }
  | { type: "SET_IDLE_PACE"; ms: number }
  | { type: "SELECT"; name: string }
  | { type: "ADD_MEANINGFUL"; moment: HistoryMoment; costUSD: number }
  | { type: "ADD_COST"; measured: number; estimated: number };

const initialState: SimState = {
  mode: "downtime",
  turnIndex: 0,
  playing: false,
  speedMs: 7000,
  idlePaceMs: IDLE_PACES[0].meaningfulMs,
  selected: null,
  totalCost: { measured: 0, estimated: 0 },
  downtimeHistory: [],
};

function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case "START_TASK":
      // keepPlaying: a mid-run task switch from the presenter/command layer
      // shouldn't force the presenter to press play again on stage.
      return { ...state, mode: "task", turnIndex: 0, playing: action.keepPlaying ? state.playing : false, selected: null };
    case "BACK_TO_DOWNTIME":
      return { ...state, mode: "downtime", playing: false, selected: null };
    case "NEXT_TURN":
      return { ...state, turnIndex: Math.min(state.turnIndex + 1, action.maxIndex) };
    case "SEEK_TURN":
      return { ...state, turnIndex: Math.max(0, Math.min(action.index, action.maxIndex)) };
    case "AUTOPLAY_TICK":
      if (state.turnIndex >= action.maxIndex) return { ...state, playing: false };
      return { ...state, turnIndex: state.turnIndex + 1 };
    case "TOGGLE_PLAY":
      return { ...state, playing: !state.playing };
    case "SET_SPEED":
      return { ...state, speedMs: action.ms };
    case "SET_IDLE_PACE":
      return { ...state, idlePaceMs: action.ms };
    case "SELECT":
      return { ...state, selected: state.selected === action.name ? null : action.name };
    case "ADD_MEANINGFUL":
      return {
        ...state,
        downtimeHistory: [...state.downtimeHistory.slice(-19), action.moment],
        // Downtime moments are always simulated cost — estimated by definition.
        totalCost: { ...state.totalCost, estimated: state.totalCost.estimated + action.costUSD },
      };
    case "ADD_COST":
      return {
        ...state,
        totalCost: {
          measured: state.totalCost.measured + action.measured,
          estimated: state.totalCost.estimated + action.estimated,
        },
      };
    default:
      return state;
  }
}

interface SimContextValue {
  state: SimState;
  dispatch: Dispatch<SimAction>;
}

const SimContext = createContext<SimContextValue | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(simReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim(): SimContextValue {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be used within a SimProvider");
  return ctx;
}

// Computed once per render by whoever holds the derived inputs (turnIndex,
// activeSpeaker, said, ambient) and handed down via AgentsProvider — see
// computeAgents() below and its use in App.tsx.
const AgentsContext = createContext<AgentsMap | null>(null);

export const AgentsProvider = AgentsContext.Provider;

export function useAgents(): AgentsMap {
  const ctx = useContext(AgentsContext);
  if (!ctx) throw new Error("useAgents must be used within an AgentsProvider");
  return ctx;
}

export function computeAgents(args: {
  turnIndex: number;
  activeSpeaker: string | null;
  said: string | null;
  emotion?: Emotion;
  ambient: Record<string, AmbientTick>;
  lastSpokeTurns: Record<string, number>;
  includeHuman?: boolean; // add a "You" entry once the presenter has joined
}): AgentsMap {
  const agents = {} as AgentsMap;
  const people = args.includeHuman ? [...ALL_PEOPLE, HUMAN] : ALL_PEOPLE;
  for (const name of people) {
    if (name === args.activeSpeaker && args.said) {
      args.lastSpokeTurns[name] = args.turnIndex;
      agents[name] = {
        activity: { kind: "speaking", text: args.said, emotion: args.emotion },
        lastSpokeTurn: args.turnIndex,
      };
    } else if (args.ambient[name]) {
      agents[name] = { activity: { kind: "ambient", tick: args.ambient[name] }, lastSpokeTurn: args.lastSpokeTurns[name] ?? 0 };
    } else {
      agents[name] = { activity: { kind: "idle" }, lastSpokeTurn: args.lastSpokeTurns[name] ?? 0 };
    }
  }
  return agents;
}
