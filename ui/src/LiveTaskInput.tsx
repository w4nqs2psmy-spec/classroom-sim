import { useEffect, useRef, useState } from "react";
import { useT } from "./i18n";

// The presenter's live-task composer. Type a free-text task, submit — it
// dispatches a START_LIVE command and the five agents begin working it live.
// The round cap is intentionally NOT exposed here (decision: fixed at 23
// server-side); this keeps the on-stage surface a single text box.

interface Props {
  onSubmit: (taskText: string) => void;
  onCancel: () => void;
}

export function LiveTaskInput({ onSubmit, onCancel }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
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
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="contribute-overlay" role="dialog" aria-label={t.liveComposeTitle}>
      <div className="contribute-card">
        <div className="contribute-head">
          <span className="contribute-title">{t.liveComposeTitle}</span>
          <span className="contribute-hint">{t.liveComposeHint}</span>
        </div>
        <textarea
          ref={inputRef}
          className="contribute-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter starts; Shift+Enter for a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t.livePlaceholder}
          rows={3}
        />
        <div className="contribute-foot">
          <span className="contribute-hint">{t.liveDevOnly}</span>
          <div className="contribute-actions">
            <button className="btn" onClick={onCancel} type="button">
              {t.cancel}
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={!text.trim()} type="button">
              {t.liveStartBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
