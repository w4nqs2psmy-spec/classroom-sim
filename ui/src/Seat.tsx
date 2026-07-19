import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";
import { Character, type Expression } from "./Character";
import type { Move, Persona } from "./data";
import { useT } from "./i18n";
import type { AgentActivity } from "./store";

export interface SeatLayout {
  x: number; // % of canvas width
  y: number; // % of canvas height
  bubble: "above" | "below";
  bubbleAlign: "left" | "center" | "right";
}

interface Props {
  name: string;
  layout: SeatLayout;
  persona: Persona;
  activity: AgentActivity;
  turnKey: number;
  isSelected: boolean;
  thinking?: boolean;
  /** Hand-tagged CSCL move of the CURRENT turn — the pedagogy printed on the
   *  bubble itself ("CHALLENGE" / "HAASTAA"). Only the speaking seat shows it. */
  moveBadge?: Move | null;
  /** Face of the current speaker (derived from the move); listeners get
   *  "listening" + gaze toward the speaker. Computed in Classroom. */
  expression?: Expression;
  gazeX?: number; // -1 | 0 | 1 — horizontal gaze direction toward the speaker
  /** "long" widens/scrolls the bubble for jigsaw's 150-250 word teaching
   *  turns; every other caller omits it and gets the compact default. */
  bubbleSize?: "normal" | "long";
  animationDelay: string;
  onSelect: (name: string) => void;
}

function SeatImpl({ name, layout, persona, activity, turnKey, isSelected, thinking, moveBadge, expression = "neutral", gazeX = 0, bubbleSize = "normal", animationDelay, onSelect }: Props) {
  const { t } = useT();
  const speaking = activity.kind === "speaking";
  const tick = activity.kind === "ambient" ? activity.tick : null;
  const said = activity.kind === "speaking" ? activity.text : null;

  // .bubble-center relies on a constant horizontal offset to sit centered on
  // the seat; Framer Motion's inline transform would otherwise override the
  // CSS transform that used to provide it, so the offset is applied here as
  // a constant `x` alongside the animated y/scale/opacity.
  const centerX = layout.bubbleAlign === "center" ? "-50%" : 0;

  return (
    <div className="seat" style={{ left: `${layout.x}%`, top: `${layout.y}%` }}>
      {thinking && (
        <div className="seat-thinking" aria-hidden="true">
          <span className="seat-thinking-dots">
            <span />
            <span />
            <span />
          </span>
        </div>
      )}
      <AnimatePresence>
        {speaking && said && (
          <motion.div
            key={turnKey}
            className={`bubble bubble-${layout.bubble} bubble-${layout.bubbleAlign} ${bubbleSize === "long" ? "bubble-long" : ""}`}
            style={{ borderColor: persona.color }}
            initial={{ opacity: 0, x: centerX, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, x: centerX, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: centerX, y: -4, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {moveBadge && <span className={`bubble-move dyn-move-${moveBadge}`}>{t.move[moveBadge]}</span>}
            {said}
            <span className={`bubble-tail bubble-tail-${layout.bubble}`} style={{ borderColor: persona.color }} />
          </motion.div>
        )}
      </AnimatePresence>
      {!speaking && tick && (
        <div key={tick.caption} className={`ambient-tag ambient-${layout.bubble}`}>
          <span className="ambient-icon">{tick.icon}</span> {tick.caption}
        </div>
      )}
      <button
        className={`avatar ${speaking ? "speaking" : "idle"} ${isSelected ? "selected" : ""}`}
        style={{
          ["--glow" as string]: `${persona.color}88`,
          animationDelay,
        }}
        onClick={() => onSelect(name)}
        title={`${name} — ${persona.role}`}
      >
        <Character
          name={name}
          size={name === "Teacher" ? 96 : 86}
          expression={expression}
          talking={speaking}
          gazeDeg={gazeX}
        />
      </button>
      <div className="seat-name">{name}</div>
      <div className="seat-role">{persona.role}</div>
    </div>
  );
}

export const Seat = memo(SeatImpl);
