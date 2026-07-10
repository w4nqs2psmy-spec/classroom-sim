import { PERSONAS, type ListName, type WorkspaceEntryView } from "./data";
import { useT } from "./i18n";
import { SourceDoc } from "./SourceDoc";
import type { SourceDocument } from "./tasks";

const SECTION_LISTS: ListName[] = ["ideas", "evaluations", "synthesis"];

interface Props {
  task: { title: string; deliverable: string } | null;
  sourceDocument: SourceDocument | null;
  entries: WorkspaceEntryView[];
  status: "in_progress" | "accepted" | "no_task";
  /** Presentation mode: replace the text wall with big counters + a one-line
   *  ticker of the latest entry — legible from the back of a room. */
  compact?: boolean;
}

export function WorkspacePanel({ task, sourceDocument, entries, status, compact }: Props) {
  const { t } = useT();

  if (compact && task) {
    const latest = entries[entries.length - 1] ?? null;
    return (
      <aside className="workspace workspace-compact">
        <div className="workspace-header">
          <h2>{t.sharedWorkspace}</h2>
          <span className={`status-chip ${status}`}>
            {status === "accepted" ? t.statusAccepted : t.statusInProgress}
          </span>
        </div>

        {sourceDocument && <SourceDoc key={sourceDocument.id} doc={sourceDocument} />}

        <div className="task-card">
          <div className="task-card-label">{t.taskLabel}</div>
          <div className="task-card-title">{task.title}</div>
        </div>

        <div className="ws-counters">
          {SECTION_LISTS.map((list) => (
            <div key={list} className="ws-counter">
              <div className="ws-counter-value">{entries.filter((e) => e.list === list).length}</div>
              <div className="ws-counter-label">{t.section[list]}</div>
            </div>
          ))}
        </div>

        {latest && (
          <div className="ws-ticker" key={latest.id}>
            <span className="ws-dot" style={{ backgroundColor: PERSONAS[latest.author]?.color }} />
            <span className="ws-author">{latest.author}</span>
            <span className="ws-ticker-text">{latest.content.split("\n")[0]}</span>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="workspace">
      <div className="workspace-header">
        <h2>{t.sharedWorkspace}</h2>
        <span className={`status-chip ${status}`}>
          {status === "accepted" ? t.statusAccepted : status === "no_task" ? t.statusBetween : t.statusInProgress}
        </span>
      </div>

      {task && sourceDocument && <SourceDoc key={sourceDocument.id} doc={sourceDocument} />}

      {task ? (
        <div className="task-card">
          <div className="task-card-label">{t.taskLabel}</div>
          <div className="task-card-title">{task.title}</div>
          <div className="task-card-deliverable">{task.deliverable}</div>
        </div>
      ) : (
        <div className="task-card task-card-empty">
          <div className="task-card-label">{t.taskLabel}</div>
          <div className="task-card-empty-text">{t.noActiveTask}</div>
        </div>
      )}

      {SECTION_LISTS.map((list) => {
        const items = entries.filter((e) => e.list === list);
        return (
          <section key={list} className="ws-section">
            <div className="ws-section-header">
              <span>{t.section[list]}</span>
              <span className="ws-count">{items.length}</span>
            </div>
            {items.length === 0 ? (
              <div className="ws-empty">{t.nothingHere}</div>
            ) : (
              items.map((e) => (
                <div key={e.id} className="ws-entry">
                  <div className="ws-entry-meta">
                    <span className="ws-dot" style={{ backgroundColor: PERSONAS[e.author]?.color }} />
                    <span className="ws-author">{e.author}</span>
                    <span className="ws-id">{e.id}</span>
                  </div>
                  <div className="ws-content">{e.content}</div>
                </div>
              ))
            )}
          </section>
        );
      })}
    </aside>
  );
}
