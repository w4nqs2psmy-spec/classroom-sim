import type { GroupId, TurnView } from "./data";

// Bespoke replacement for WorkspacePanel on the jigsaw task: there is no
// ideas/evaluations/synthesis list here (jigsaw turns never set
// workspaceEntry), so instead this shows the task card plus the one
// comparison that's the whole point of the exercise — which chapters each
// group has been taught so far. "Taught" is read off docRef, which the
// authored dataset (jigsawTask.ts) sets only on each chapter's actual
// teaching turn, not on the Q&A around it.

const CHAPTERS: { id: string; title: string }[] = [
  { id: "a", title: "Yhteisöllinen johtajuus käytännössä" },
  { id: "b", title: "Työyhteisön kehittäminen yhdessä" },
  { id: "c", title: "Hyvät kokouskäytännöt" },
];
const GROUP_LABELS: Record<GroupId, string> = { ryhma1: "Ryhmä 1", ryhma2: "Ryhmä 2" };

interface Props {
  task: { title: string; deliverable: string };
  turns: TurnView[];
  turnIndex: number;
  compact?: boolean;
}

export function JigsawSidePanel({ task, turns, turnIndex, compact }: Props) {
  const seenSoFar = turns.slice(0, turnIndex + 1);
  const taughtFor = (groupId: GroupId) =>
    new Set(seenSoFar.filter((t) => t.group === groupId && t.docRef).map((t) => t.docRef));

  const groups: GroupId[] = ["ryhma1", "ryhma2"];

  if (compact) {
    return (
      <aside className="workspace workspace-compact">
        <div className="workspace-header">
          <h2>Palapeli</h2>
        </div>
        <div className="task-card">
          <div className="task-card-label">Tehtävä</div>
          <div className="task-card-title">{task.title}</div>
        </div>
        <div className="ws-counters">
          {groups.map((g) => (
            <div key={g} className="ws-counter">
              <div className="ws-counter-value">{taughtFor(g).size}/3</div>
              <div className="ws-counter-label">{GROUP_LABELS[g]}</div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="workspace">
      <div className="workspace-header">
        <h2>Palapeli</h2>
      </div>

      <div className="task-card">
        <div className="task-card-label">Tehtävä</div>
        <div className="task-card-title">{task.title}</div>
        <div className="task-card-deliverable">{task.deliverable}</div>
      </div>

      {groups.map((g) => {
        const taught = taughtFor(g);
        return (
          <section key={g} className="ws-section">
            <div className="ws-section-header">
              <span>{GROUP_LABELS[g]}</span>
              <span className="ws-count">{taught.size}/3</span>
            </div>
            {CHAPTERS.map((c) => (
              <div key={c.id} className="ws-entry">
                <div className="ws-entry-meta">
                  <span className="ws-dot" style={{ backgroundColor: taught.has(c.id) ? "#22c55e" : "#d8d2bf" }} />
                  <span className="ws-author">{taught.has(c.id) ? "✓ Opetettu" : "Ei vielä"}</span>
                </div>
                <div className="ws-content">{c.title}</div>
              </div>
            ))}
          </section>
        );
      })}
    </aside>
  );
}
