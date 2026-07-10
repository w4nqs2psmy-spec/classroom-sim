import type { Phase } from "./data";
import { useT } from "./i18n";

const PHASE_KEYS: Phase[] = ["ideation", "evaluation", "synthesis"];

export function PhaseIndicator({ current }: { current: Phase }) {
  const { t } = useT();
  const currentIdx = PHASE_KEYS.indexOf(current);
  return (
    <div className="phase-indicator">
      {PHASE_KEYS.map((key, i) => (
        <div key={key} className="phase-step">
          {i > 0 && <div className={`phase-line ${i <= currentIdx ? "done" : ""}`} />}
          <div className={`phase-pill ${i === currentIdx ? "current" : i < currentIdx ? "done" : ""}`}>
            {i < currentIdx ? "✓ " : ""}
            {t.phase[key]}
          </div>
        </div>
      ))}
    </div>
  );
}
