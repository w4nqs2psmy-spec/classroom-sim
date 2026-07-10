import { useT } from "./i18n";

interface Props {
  playing: boolean;
  atEnd: boolean;
  dynamicsVisible: boolean;
  onTogglePlay: () => void;
  onToggleDynamics: () => void;
  onToggleDock: () => void;
  onContribute: () => void;
  onExit: () => void;
}

export function PresentationBar({ playing, atEnd, dynamicsVisible, onTogglePlay, onToggleDynamics, onToggleDock, onContribute, onExit }: Props) {
  const { t } = useT();
  return (
    <div className="presentation-bar">
      <button className="btn btn-primary" onClick={onTogglePlay} disabled={atEnd}>
        {playing ? t.pause : t.play}
      </button>
      {/* The keynote reveal: run the discussion plain first, then flip the
          dynamics layer on mid-talk. */}
      <button className={`btn ${dynamicsVisible ? "btn-active" : ""}`} onClick={onToggleDynamics}>
        {t.dynamics}
      </button>
      <button className="btn" onClick={onToggleDock} title={t.tasksTitleP}>
        {t.tasksBtn}
      </button>
      <button className="btn" onClick={onContribute} title={t.joinTitleC}>
        {t.join}
      </button>
      <button className="btn" onClick={onExit}>
        {t.exitPresentation}
      </button>
    </div>
  );
}
