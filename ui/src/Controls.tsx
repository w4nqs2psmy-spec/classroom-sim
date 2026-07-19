import { IDLE_PACES } from "./downtime";
import { useT, type Lang } from "./i18n";
import { CURATED_SESSION, type SessionSummary } from "./sessionLoader";

const SPEEDS = [
  { label: "Slow", ms: 7000 },
  { label: "Normal", ms: 4000 },
  { label: "Fast", ms: 2000 },
] as const;


type Mode = "downtime" | "task";

interface Props {
  mode: Mode;
  turn: number;
  totalTurns: number;
  playing: boolean;
  speedMs: number;
  atEnd: boolean;
  idlePaceMs: number;
  scenarios: { id: string; label: string }[];
  tasks: { id: string; label: string }[];
  sessions: SessionSummary[];
  datasetValue: string;
  sessionLoading: boolean;
  sessionError: string | null;
  onSelectDataset: (value: string) => void;
  onToggleDock: () => void;
  onContribute: () => void;
  onLive: () => void;
  liveGenerating: boolean;
  liveUnavailable: boolean;
  onStartTask: () => void;
  onBackToDowntime: () => void;
  onNextTurn: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (ms: number) => void;
  onIdlePaceChange: (ms: number) => void;
  onPresent: () => void;
  dynamicsVisible: boolean;
  onToggleDynamics: () => void;
  lang: Lang;
  onSetLang: (lang: Lang) => void;
  /** Hides Live/Dynamics/Contribute for the jigsaw task: pre-scripted,
   *  never live-generated, and dynamics never runs on it (App.tsx). */
  hideExtras?: boolean;
}

export function Controls(p: Props) {
  const { t } = useT();
  return (
    <footer className="controls">
      {p.mode === "downtime" ? (
        <button className="btn btn-primary" onClick={p.onStartTask}>
          {t.startTask}
        </button>
      ) : (
        <button className="btn" onClick={p.onBackToDowntime}>
          {t.backToDowntime}
        </button>
      )}

      <div className="controls-divider" />

      <select
        className="session-picker"
        value={p.datasetValue}
        disabled={p.sessionLoading}
        onChange={(e) => p.onSelectDataset(e.target.value)}
        title={t.pickerTitle}
      >
        <optgroup label={t.taskLibrary}>
          {p.tasks.map((task) => (
            <option key={task.id} value={`task:${task.id}`}>
              {task.label}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.scenariosGroup}>
          {p.scenarios.map((s) => (
            <option key={s.id} value={`scenario:${s.id}`}>
              {s.label}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.realSessions}>
          {p.sessions.map((s) => (
            <option key={s.file} value={s.file}>
              {s.file === CURATED_SESSION ? t.realSessionCurated : s.file.replace(/^session-|\.jsonl$/g, "")}
              {!s.isComplete ? t.inProgress : ""}
            </option>
          ))}
        </optgroup>
      </select>
      {p.sessionLoading && <span className="control-label">{t.loading}</span>}
      {p.sessionError && (
        <span className="control-label session-error" title={p.sessionError}>
          {t.loadFailed}
        </span>
      )}

      {!p.hideExtras && (
        <>
          <button className="btn" onClick={p.onLive} title={t.liveBtnTitle}>
            {t.liveBtn}
          </button>
          {p.liveGenerating && <span className="control-label">{t.liveGenerating}</span>}
          {p.liveUnavailable && (
            <span className="control-label session-error" title={t.liveDevOnly}>
              {t.liveFailed}
            </span>
          )}
        </>
      )}

      <div className="controls-divider" />

      {p.mode === "task" ? (
        <>
          <button className="btn" onClick={p.onNextTurn} disabled={p.atEnd || p.playing}>
            {t.nextTurn}
          </button>

          <button className={`btn ${p.playing ? "btn-active" : ""}`} onClick={p.onTogglePlay} disabled={p.atEnd}>
            {p.playing ? t.pause : t.autoplay}
          </button>

          <span className="control-label">{t.speed}</span>
          <div className="speed-group" role="group" aria-label={t.speed}>
            {SPEEDS.map((s) => (
              <button
                key={s.label}
                className={`speed-btn ${p.speedMs === s.ms ? "speed-btn-active" : ""}`}
                onClick={() => p.onSpeedChange(s.ms)}
              >
                {t.speedName(s.label)}
              </button>
            ))}
          </div>

          {!p.hideExtras && (
            <button
              className={`btn ${p.dynamicsVisible ? "btn-active" : ""}`}
              onClick={p.onToggleDynamics}
              title={t.dynamicsTitle}
            >
              {t.dynamics}
            </button>
          )}

          <button className="btn" onClick={p.onToggleDock} title={t.tasksTitle}>
            {t.tasksBtn}
          </button>

          {!p.hideExtras && (
            <button className="btn" onClick={p.onContribute} title={t.youTitle}>
              {t.youBtn}
            </button>
          )}

          <button className="btn" onClick={p.onPresent} title={t.presentTitle}>
            {t.present}
          </button>
        </>
      ) : (
        <>
          <span className="control-label">{t.idlePace}</span>
          <div className="speed-group" role="group" aria-label={t.idlePace}>
            {IDLE_PACES.map((s) => (
              <button
                key={s.label}
                className={`speed-btn ${p.idlePaceMs === s.meaningfulMs ? "speed-btn-active" : ""}`}
                onClick={() => p.onIdlePaceChange(s.meaningfulMs)}
              >
                {t.paceName(s.label as "Calm" | "Normal" | "Lively")}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="controls-spacer" />

      <div className="lang-toggle" role="group" aria-label="Language">
        {(["en", "fi"] as const).map((l) => (
          <button
            key={l}
            className={`lang-btn ${p.lang === l ? "lang-btn-active" : ""}`}
            onClick={() => p.onSetLang(l)}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {p.mode === "task" && <span className="turn-counter">{t.turnCounter(p.turn + 1, p.totalTurns)}</span>}
    </footer>
  );
}
