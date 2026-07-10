import type { Expression } from "./Character";
import { PERSONAS, STUDENTS, type Move } from "./data";
import type { DynamicsSnapshot, Insight } from "./dynamics";
import { useT } from "./i18n";
import { InsightFlash } from "./InsightFlash";
import { InteractionOverlay } from "./InteractionOverlay";
import { Seat, type SeatLayout } from "./Seat";
import { useAgents } from "./store";

// Speaker's face follows the hand-tagged CSCL move of the current turn.
// Heuristic turns arrive as currentMove=null and stay neutral (honesty rule).
const MOVE_EXPRESSION: Partial<Record<Move, Expression>> = {
  propose: "excited",
  challenge: "skeptical",
  build: "engaged",
  integrate: "warm",
  verdict: "composed",
};

// Single source of truth for room layout: both the seats and the
// interaction-arc overlay anchor to these percentages. Otto nudged
// left-of-centre to open a front seat for the human ("You") beside him —
// the near/front edge of the circle, closest to where the presenter stands.
export const SEATS: Record<string, SeatLayout> = {
  Teacher: { x: 50, y: 21, bubble: "below", bubbleAlign: "center" },
  Nea: { x: 16, y: 52, bubble: "above", bubbleAlign: "left" },
  Vilma: { x: 31, y: 76, bubble: "above", bubbleAlign: "left" },
  Otto: { x: 42, y: 85, bubble: "above", bubbleAlign: "center" },
  You: { x: 60, y: 85, bubble: "above", bubbleAlign: "center" },
  Sami: { x: 69, y: 76, bubble: "above", bubbleAlign: "right" },
  Leo: { x: 84, y: 52, bubble: "above", bubbleAlign: "right" },
};

interface Props {
  taskTitle: string;
  hasTask: boolean;
  turnKey: number;
  dynamics: DynamicsSnapshot | null;
  selected: string | null;
  hasJoined?: boolean;
  thinkingAgent?: string | null;
  currentMove?: Move | null;
  flashInsight?: Insight | null;
  onFlashDone?: () => void;
  onSelect: (name: string) => void;
  onJoin?: () => void;
}

export function Classroom({ taskTitle, hasTask, turnKey, dynamics, selected, hasJoined, thinkingAgent, currentMove, flashInsight, onFlashDone, onSelect, onJoin }: Props) {
  const { t } = useT();
  const agents = useAgents();

  // The room's social state this render: who speaks, whom they address, and
  // which way every head should turn. All derived — no new state.
  const speakerName = (Object.keys(agents) as (keyof typeof agents)[]).find(
    (n) => agents[n].activity.kind === "speaking",
  ) as string | undefined;
  const addressees = new Set(dynamics?.current?.to ?? []);
  const speakerExpression: Expression =
    speakerName === "Teacher" ? "composed" : (currentMove && MOVE_EXPRESSION[currentMove]) || "neutral";

  const faceFor = (name: string): { expression: Expression; gazeX: number } => {
    const activity = agents[name as keyof typeof agents]?.activity;
    if (!activity) return { expression: "neutral", gazeX: 0 };
    if (activity.kind === "speaking") return { expression: speakerExpression, gazeX: 0 };
    if (activity.kind === "ambient") return { expression: "distracted", gazeX: 0 };
    if (speakerName && SEATS[speakerName] && SEATS[name]) {
      const dx = SEATS[speakerName].x - SEATS[name].x;
      return {
        expression: addressees.has(name) ? "listening" : "neutral",
        gazeX: dx === 0 ? 0 : Math.sign(dx),
      };
    }
    return { expression: "neutral", gazeX: 0 };
  };

  return (
    <div className={`classroom ${speakerName ? "classroom-live" : ""}`}>
      <div className={`whiteboard ${hasTask ? "" : "whiteboard-empty"}`}>
        <div className="whiteboard-label">{hasTask ? t.whiteboardTaskLabel : t.whiteboardStatusLabel}</div>
        <div className="whiteboard-title">{taskTitle}</div>
      </div>
      <div className="table">
        <span className="table-laptop" title="Shared workspace">💻</span>
      </div>

      {/* After whiteboard/table (arcs draw over furniture), before seats
          (avatars and bubbles stay on top). */}
      {dynamics && <InteractionOverlay edges={dynamics.edges} current={dynamics.current} turnKey={turnKey} />}

      {["Teacher", ...STUDENTS].map((name, idx) => {
        const face = faceFor(name);
        return (
          <Seat
            key={name}
            name={name}
            layout={SEATS[name]}
            persona={PERSONAS[name]}
            activity={agents[name as keyof typeof agents].activity}
            turnKey={turnKey}
            isSelected={selected === name}
            thinking={thinkingAgent === name}
            moveBadge={currentMove}
            expression={face.expression}
            gazeX={face.gazeX}
            animationDelay={`${idx * 0.55}s`}
            onSelect={onSelect}
          />
        );
      })}

      {/* The human seat. A ghost chair + join hint until the presenter joins,
          then a full participant seat like any other. Only in task mode. */}
      {hasTask &&
        (hasJoined && agents.You ? (
          <Seat
            name="You"
            layout={SEATS.You}
            persona={PERSONAS.You}
            activity={agents.You.activity}
            turnKey={turnKey}
            isSelected={selected === "You"}
            moveBadge={currentMove}
            expression={faceFor("You").expression}
            gazeX={faceFor("You").gazeX}
            animationDelay="0s"
            onSelect={onSelect}
          />
        ) : (
          <div className="seat seat-ghost" style={{ left: `${SEATS.You.x}%`, top: `${SEATS.You.y}%` }}>
            <button className="avatar avatar-ghost" onClick={onJoin} title={t.joinTitle}>
              <span className="avatar-ghost-plus">+</span>
            </button>
            <div className="seat-name seat-name-ghost">{t.joinLabel}</div>
          </div>
        ))}

      {flashInsight && onFlashDone && <InsightFlash insight={flashInsight} onDone={onFlashDone} />}
    </div>
  );
}
