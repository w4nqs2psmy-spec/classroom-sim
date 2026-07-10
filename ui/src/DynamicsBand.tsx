import { PERSONAS, type Move } from "./data";
import type { DynamicsSnapshot } from "./dynamics";
import { useT } from "./i18n";

interface Props {
  dynamics: DynamicsSnapshot;
  currentIndex: number;
  onSeek: (index: number) => void;
}

function ParticipationBars({ dynamics }: { dynamics: DynamicsSnapshot }) {
  const { t } = useT();
  return (
    <div className="dyn-section dyn-participation">
      <div className="dyn-title">{t.participationBalance}</div>
      {dynamics.participation.map((p) => (
        <div
          key={p.name}
          className="dyn-bar-row"
          title={t.barTitle(p.name, p.turns, p.words, Math.round(p.wordShare * 100), p.docCites)}
        >
          <span className="dyn-bar-name">{p.name}</span>
          <div className="dyn-bar-track">
            <div
              className="dyn-bar-fill"
              style={{
                // Floor at 2% once someone has spoken so a tiny share stays
                // visible as a sliver rather than vanishing entirely.
                width: `${p.turns > 0 ? Math.max(p.turnShare * 100, 2) : 0}%`,
                backgroundColor: PERSONAS[p.name].color,
              }}
            />
          </div>
          <span className="dyn-bar-value">{Math.round(p.turnShare * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

const LEGEND_ORDER: Move[] = ["propose", "build", "challenge", "integrate", "facilitate", "verdict"];

function ClimateTimeline({ dynamics, currentIndex, onSeek }: Props) {
  const { t } = useT();
  return (
    <div className="dyn-section dyn-timeline">
      <div className="dyn-timeline-head">
        <span className="dyn-title">{t.discussionClimate}</span>
        {dynamics.insights.map((insight) => (
          <span
            key={insight.id}
            className={`dyn-chip dyn-chip-${insight.id}`}
            title={t.insightDetail(insight.id, insight.params)}
          >
            {t.insightLabel(insight.id, insight.params)}
          </span>
        ))}
      </div>
      <div className="dyn-ticks">
        {dynamics.timeline.map((tick, i) => {
          const phaseStart = i > 0 && dynamics.timeline[i - 1].phase !== tick.phase;
          return (
            <button
              key={tick.index}
              className={[
                "dyn-tick",
                `dyn-move-${tick.move}`,
                tick.index === currentIndex && "dyn-tick-current",
                !tick.tagged && "dyn-tick-heuristic",
                phaseStart && "dyn-tick-phase-start",
                tick.docRef && "dyn-tick-doc",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSeek(tick.index)}
              title={t.tickTitle(tick.index + 1, tick.speaker, t.move[tick.move], tick.tagged, t.phase[tick.phase], tick.docRef)}
            />
          );
        })}
      </div>
      <div className="dyn-legend">
        {LEGEND_ORDER.map((m) => (
          <span key={m} className="dyn-legend-item">
            <span className={`dyn-legend-swatch dyn-move-${m}`} />
            {t.move[m]}
          </span>
        ))}
        {dynamics.timeline.some((tick) => tick.docRef) && <span className="dyn-legend-item">{t.citesSource}</span>}
        <span className="dyn-legend-note">{t.fadedEstimated}</span>
      </div>
    </div>
  );
}

export function DynamicsBand({ dynamics, currentIndex, onSeek }: Props) {
  return (
    <section className="dynamics-band" aria-label="Group dynamics">
      <ParticipationBars dynamics={dynamics} />
      <ClimateTimeline dynamics={dynamics} currentIndex={currentIndex} onSeek={onSeek} />
    </section>
  );
}
