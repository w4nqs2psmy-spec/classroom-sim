import { useEffect } from "react";
import { PERSONAS } from "./data";
import type { Insight } from "./dynamics";
import { useT } from "./i18n";
import { SEATS } from "./Classroom";

// The magic moment: the first time a detector fires, the room dims for a
// beat, a spotlight ring lands on the agent the insight is about, and the
// insight's name sweeps across the room before settling into its chip in the
// dynamics band. The audience watches the simulation RECOGNIZE a group
// phenomenon the second it happens — the demo's whole claim in one effect.
//
// Pure CSS animation; self-terminating via onAnimationEnd on the label
// (the longest-running element). No dynamics/store changes.

interface Props {
  insight: Insight;
  onDone: () => void;
}

export function InsightFlash({ insight, onDone }: Props) {
  const { t } = useT();
  const name = insight.params.name;
  const seat = name ? SEATS[name] : null;

  // Safety: never wedge the stage — if the animationend event is lost (tab
  // hidden, HMR), clear after a hard timeout anyway.
  useEffect(() => {
    const timer = setTimeout(onDone, 2600);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="insight-flash" aria-hidden="true">
      <div className="insight-flash-veil" />
      {seat && (
        <div
          className="insight-flash-spot"
          style={{
            left: `${seat.x}%`,
            top: `${seat.y}%`,
            ["--spot-color" as string]: name ? (PERSONAS[name]?.color ?? "#fff") : "#fff",
          }}
        />
      )}
      <div className="insight-flash-label" onAnimationEnd={onDone}>
        {t.insightLabel(insight.id, insight.params)}
      </div>
    </div>
  );
}
