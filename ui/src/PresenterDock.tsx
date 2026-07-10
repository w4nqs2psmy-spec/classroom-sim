import { useT, type Lang } from "./i18n";
import { resolveTask, type TaskDefinition } from "./tasks";

// The presenter's steering surface: task cards, blind-operable via the
// 1-5 hotkeys in presentation mode, with the expected dynamic signature as
// the cue line. Appearing briefly over the room is deliberate theater
// ("I'm giving them a new task now"), not disruption — it auto-hides after
// a selection.

interface Props {
  tasks: TaskDefinition[];
  lang: Lang;
  activeTaskId: string | null;
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

export function PresenterDock({ tasks, lang, activeTaskId, onSelect, onClose }: Props) {
  const { t } = useT();
  return (
    <div className="presenter-dock" role="dialog" aria-label={t.taskLibrary}>
      {tasks.map((task, i) => {
        const r = resolveTask(task, lang);
        return (
          <button
            key={task.id}
            className={`dock-card ${task.id === activeTaskId ? "dock-card-active" : ""}`}
            onClick={() => onSelect(task.id)}
          >
            <div className="dock-card-head">
              <span className="dock-key">{i + 1}</span>
              <span className="dock-label">{r.label}</span>
              {r.sourceDocument && (
                <span className="dock-doc" title={r.sourceDocument.title} aria-hidden="true">
                  📄
                </span>
              )}
            </div>
            <div className="dock-badge">
              {t.structure[task.profile.structure]} · {t.interdep[task.profile.interdependence]}
              {t.interdepSuffix} · {t.consensus[task.profile.consensusMode]}
            </div>
            <div className="dock-signature">{r.expectedSignature[0]}</div>
          </button>
        );
      })}
      <button className="dock-close" onClick={onClose} title={t.dockClose}>
        ✕
      </button>
    </div>
  );
}
