import { PERSONAS, type GroupId, type TurnView } from "./data";
import { Seat, type SeatLayout } from "./Seat";
import type { AgentActivity } from "./store";

// Jigsaw's own small room: two parallel 3-person groups, rendered side by
// side so the presenter can compare them directly — the whole point of the
// exercise. Deliberately self-contained: computes "who's speaking" straight
// from turns[turnIndex] rather than routing through the shared
// AgentsContext/computeAgents (store.tsx), which is hardcoded to the
// English single-room STUDENTS roster and knows nothing about Aino or
// groups. Seat.tsx itself is reused as-is — it's pure and prop-driven.

const GROUP_MEMBERS: Record<GroupId, string[]> = {
  ryhma1: ["Aino", "Nea", "Leo"],
  ryhma2: ["Vilma", "Sami", "Otto"],
};
const GROUP_LABELS: Record<GroupId, string> = {
  ryhma1: "Ryhmä 1 — homogeeninen",
  ryhma2: "Ryhmä 2 — heterogeeninen",
};

// Local 3-seat row, positioned within each group panel's own container
// (container-type: inline-size in CSS, same pattern as .classroom).
const GROUP_SEATS: SeatLayout[] = [
  { x: 22, y: 46, bubble: "above", bubbleAlign: "left" },
  { x: 50, y: 46, bubble: "above", bubbleAlign: "center" },
  { x: 78, y: 46, bubble: "above", bubbleAlign: "right" },
];

interface Props {
  turns: TurnView[];
  turnIndex: number;
  selected: string | null;
  onSelect: (name: string) => void;
}

export function JigsawClassroom({ turns, turnIndex, selected, onSelect }: Props) {
  const current = turns[turnIndex] as TurnView | undefined;
  const activeGroup = current?.group;
  const teacherSpeaking = current?.speaker === "Teacher";

  return (
    <div className="jigsaw-room">
      {teacherSpeaking && current && (
        <div className="jigsaw-banner">
          <div className="jigsaw-banner-label">Opettaja</div>
          {current.said}
        </div>
      )}
      <div className="jigsaw-groups">
        {(Object.keys(GROUP_MEMBERS) as GroupId[]).map((groupId) => {
          const inactive = Boolean(activeGroup) && activeGroup !== groupId;
          return (
            <div key={groupId} className={`jigsaw-group ${inactive ? "inactive" : ""}`}>
              <div className="jigsaw-group-label">{GROUP_LABELS[groupId]}</div>
              {GROUP_MEMBERS[groupId].map((name, i) => {
                const speaking = current?.speaker === name;
                const activity: AgentActivity = speaking && current ? { kind: "speaking", text: current.said } : { kind: "idle" };
                const bubbleSize = speaking && current && current.said.length > 400 ? "long" : "normal";
                return (
                  <Seat
                    key={name}
                    name={name}
                    layout={GROUP_SEATS[i]}
                    persona={PERSONAS[name]}
                    activity={activity}
                    turnKey={turnIndex}
                    isSelected={selected === name}
                    moveBadge={speaking ? (current?.dialogueMove ?? null) : null}
                    bubbleSize={bubbleSize}
                    animationDelay={`${i * 0.3}s`}
                    onSelect={onSelect}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
