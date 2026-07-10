// The command layer: every steering input — presenter hotkey, presenter
// dock button, and (later) a QR/audience relay — flows through ONE envelope
// shape and ONE dispatch function. A future audience-vote page on the same
// origin posts the identical envelope to the BroadcastChannel below and
// steers the sim with zero refactor; validation (unknown task ids rejected)
// is in place from day one so audience input can never wedge the show.

import { useCallback, useEffect, useRef } from "react";

export type SimCommand =
  | { type: "SELECT_TASK"; taskId: string }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SET_SPEED"; ms: number }
  | { type: "SEEK"; index: number }
  | { type: "TOGGLE_DYNAMICS" }
  // A live human contribution. `move` is the contributor's self-tagged CSCL
  // move (ground truth, so its timeline tick is `tagged`). `targetAgent`, when
  // set, is the agent the human addresses — that agent generates a real live
  // reply. The same envelope is what a future audience-join surface posts.
  | { type: "CONTRIBUTE"; text: string; move?: string; targetAgent?: string | null };

export type CommandSource = "presenter-hotkey" | "presenter-dock" | "audience" | "system";

export interface CommandEnvelope {
  command: SimCommand;
  source: CommandSource;
  id: string; // idempotency key for future networked sources
  ts: number;
}

export type CommandResult = { ok: true } | { ok: false; reason: string };
export type DispatchCommand = (env: CommandEnvelope) => CommandResult;

export const COMMAND_CHANNEL = "classroom-sim-commands";

export function makeEnvelope(command: SimCommand, source: CommandSource): CommandEnvelope {
  return {
    command,
    source,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };
}

export interface CommandHandlers {
  /** Returns false for unknown task ids — the audience-input safety valve. */
  selectTask: (taskId: string) => boolean;
  play: () => void;
  pause: () => void;
  setSpeed: (ms: number) => void;
  seek: (index: number) => void;
  toggleDynamics: () => void;
  /** Inject a human contribution; returns false if not currently possible
   *  (not in task mode) so networked callers get a clear result. */
  contribute: (text: string, move?: string, targetAgent?: string | null) => boolean;
}

function isEnvelope(x: unknown): x is CommandEnvelope {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as CommandEnvelope).command === "object" &&
    (x as CommandEnvelope).command !== null &&
    typeof (x as CommandEnvelope).command.type === "string"
  );
}

/**
 * Wires the command contract to the app's handlers and listens on the
 * BroadcastChannel so external same-origin surfaces dispatch identically.
 * Handlers are kept in a ref so external messages never see stale closures.
 */
export function useCommandBus(handlers: CommandHandlers): DispatchCommand {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const dispatchCommand = useCallback((env: CommandEnvelope): CommandResult => {
    const h = handlersRef.current;
    const c = env.command;
    switch (c.type) {
      case "SELECT_TASK":
        return h.selectTask(c.taskId) ? { ok: true } : { ok: false, reason: `unknown taskId: ${c.taskId}` };
      case "PLAY":
        h.play();
        return { ok: true };
      case "PAUSE":
        h.pause();
        return { ok: true };
      case "SET_SPEED":
        if (!Number.isFinite(c.ms) || c.ms < 500 || c.ms > 60000) return { ok: false, reason: "speed out of range" };
        h.setSpeed(c.ms);
        return { ok: true };
      case "SEEK":
        if (!Number.isInteger(c.index) || c.index < 0) return { ok: false, reason: "invalid index" };
        h.seek(c.index);
        return { ok: true };
      case "TOGGLE_DYNAMICS":
        h.toggleDynamics();
        return { ok: true };
      case "CONTRIBUTE": {
        if (typeof c.text !== "string" || !c.text.trim()) return { ok: false, reason: "empty contribution" };
        return h.contribute(c.text.trim(), c.move, c.targetAgent) ? { ok: true } : { ok: false, reason: "cannot contribute now" };
      }
      default:
        return { ok: false, reason: "unknown command type" };
    }
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel(COMMAND_CHANNEL);
    channel.onmessage = (e: MessageEvent) => {
      if (isEnvelope(e.data)) dispatchCommand(e.data);
    };
    return () => channel.close();
  }, [dispatchCommand]);

  return dispatchCommand;
}
