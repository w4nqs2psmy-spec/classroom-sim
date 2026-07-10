import { SEATS } from "./Classroom";
import { PERSONAS } from "./data";
import type { CurrentAttribution, InteractionEdge } from "./dynamics";

// Who-addresses-whom arcs, drawn in the classroom itself — the room is
// already a spatial sociogram, so interaction structure is rendered where
// the people are instead of in a separate abstract graph.
//
// SVG specifics: viewBox 0 0 100 100 + preserveAspectRatio="none" makes the
// SEATS percentage coordinates map 1:1 into viewBox units at any container
// size — no ResizeObserver, no pixel math. That scaling is non-uniform, so
// every path uses vector-effect="non-scaling-stroke" to keep stroke widths
// crisp instead of smearing into ellipses.

interface Props {
  edges: InteractionEdge[];
  current: CurrentAttribution | null;
  turnKey: number;
}

// The seat point is the center of the whole seat column (avatar + labels);
// the avatar's visual center sits slightly above it.
const Y_OFFSET = -3;

// Approximate room center (the table), used to bow arcs consistently inward.
const CENTER = { x: 50, y: 58 };

function arcPath(from: string, to: string): string {
  const a = SEATS[from];
  const b = SEATS[to];
  const x1 = a.x, y1 = a.y + Y_OFFSET;
  const x2 = b.x, y2 = b.y + Y_OFFSET;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bulge = Math.min(14, len * 0.3);
  // Perpendicular unit vector, flipped if needed so the bow points toward
  // the room center — arcs read as conversation across the table.
  let px = -dy / len;
  let py = dx / len;
  const toward = Math.hypot(mx + px * bulge - CENTER.x, my + py * bulge - CENTER.y);
  const away = Math.hypot(mx - px * bulge - CENTER.x, my - py * bulge - CENTER.y);
  if (toward > away) {
    px = -px;
    py = -py;
  }
  return `M ${x1} ${y1} Q ${mx + px * bulge} ${my + py * bulge} ${x2} ${y2}`;
}

export function InteractionOverlay({ edges, current, turnKey }: Props) {
  return (
    <svg className="interaction-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {/* Arrowhead inherits the arc's stroke color via context-stroke. */}
        <marker id="arc-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker>
      </defs>
      {edges.map((e) => (
        <path
          key={`${e.from}->${e.to}`}
          d={arcPath(e.from, e.to)}
          className="arc-cumulative"
          style={{ stroke: PERSONAS[e.from].color, strokeWidth: 1 + Math.min(e.weight, 6) * 0.7 }}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {current &&
        current.to.map((to) => (
          <path
            key={`${turnKey}-${current.from}-${to}`}
            d={arcPath(current.from, to)}
            className={`arc-flash ${current.explicit ? "arc-hero" : "arc-inferred"}`}
            style={{ stroke: PERSONAS[current.from].color }}
            pathLength={1}
            markerEnd={current.explicit ? "url(#arc-head)" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </svg>
  );
}
