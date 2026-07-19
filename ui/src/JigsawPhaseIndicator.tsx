import type { Phase } from "./data";

// Mirrors PhaseIndicator.tsx's structure for the jigsaw task's own three
// phases. Kept as a separate component rather than generalizing
// PhaseIndicator (which stays English-only ideation/evaluation/synthesis)
// to avoid any regression risk to the existing stepper. Labels are
// hardcoded Finnish — jigsaw content is Finnish regardless of the EN/FI
// chrome toggle, same as the task's own dialogue.
const JIGSAW_PHASE_KEYS: Phase[] = ["luku", "opetus", "synteesi"];
const JIGSAW_PHASE_LABELS: Record<string, string> = {
  luku: "Luku",
  opetus: "Opetus",
  synteesi: "Synteesi",
};

export function JigsawPhaseIndicator({ current }: { current: Phase }) {
  const currentIdx = JIGSAW_PHASE_KEYS.indexOf(current);
  return (
    <div className="phase-indicator">
      {JIGSAW_PHASE_KEYS.map((key, i) => (
        <div key={key} className="phase-step">
          {i > 0 && <div className={`phase-line ${i <= currentIdx ? "done" : ""}`} />}
          <div className={`phase-pill ${i === currentIdx ? "current" : i < currentIdx ? "done" : ""}`}>
            {i < currentIdx ? "✓ " : ""}
            {JIGSAW_PHASE_LABELS[key]}
          </div>
        </div>
      ))}
    </div>
  );
}
