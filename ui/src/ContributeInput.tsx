import { useEffect, useRef, useState } from "react";
import type { Move } from "./data";
import { useT } from "./i18n";

// The presenter's compose overlay. Type a contribution, optionally self-tag
// the CSCL move, submit — it dispatches a CONTRIBUTE command. Autoplay is
// already paused by the caller when this opens.

const MOVE_VALUES: Move[] = ["propose", "build", "challenge", "integrate"];

interface Props {
  presentAgents: string[];
  defaultTarget: string | null; // the current/last speaker (whom you interrupted)
  onSubmit: (text: string, move: Move, targetAgent: string | null) => void;
  onCancel: () => void;
}

export function ContributeInput({ presentAgents, defaultTarget, onSubmit, onCancel }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [move, setMove] = useState<Move>("build");
  // Whom you address — defaults to the speaker you interrupted (else the first
  // agent, so a reply always comes back); "" = the group (no live reply).
  const [target, setTarget] = useState<string>(defaultTarget ?? presentAgents[0] ?? "");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const submit = () => {
    const trimmed = text.trim();
    if (trimmed) onSubmit(trimmed, move, target || null);
  };

  return (
    <div className="contribute-overlay" role="dialog" aria-label={t.contributeTitle}>
      <div className="contribute-card">
        <div className="contribute-head">
          <span className="contribute-title">{t.contributeTitle}</span>
          <span className="contribute-hint">{t.contributeJoinsAs}</span>
        </div>
        <textarea
          ref={inputRef}
          className="contribute-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter submits; Shift+Enter for a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t.contributePlaceholder}
          rows={3}
        />
        <div className="contribute-target">
          <span className="contribute-target-label">{t.contributeTo}</span>
          <select className="contribute-target-select" value={target} onChange={(e) => setTarget(e.target.value)}>
            {presentAgents.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="">{t.contributeGroup}</option>
          </select>
        </div>
        <div className="contribute-foot">
          <div className="contribute-moves">
            {MOVE_VALUES.map((value) => (
              <button
                key={value}
                className={`contribute-move dyn-move-${value} ${move === value ? "contribute-move-active" : ""}`}
                onClick={() => setMove(value)}
                type="button"
              >
                {t.move[value]}
              </button>
            ))}
          </div>
          <div className="contribute-actions">
            <button className="btn" onClick={onCancel} type="button">
              {t.cancel}
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={!text.trim()} type="button">
              {t.send}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
