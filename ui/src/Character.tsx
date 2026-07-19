import type { ReactNode } from "react";
import { CHARACTER_TOKENS, INK, type CharacterTokens } from "./characterConfig";

// Layered SVG character busts — flat editorial illustration style, one
// shared geometry system (same head base, stroke weight, feature grammar)
// with per-character hair silhouettes and accessories. Design rule: every
// character must be identifiable as a pure black silhouette; hair shape is
// what carries identity at the back of a room.
//
// Layer order (bottom → top): torso → neck → back hair → head → ears →
// front hair → face (brows/eyes/mouth) → accessory. The head group,
// face group, mouth and pupils carry stable class names so later steps
// (expressions, gaze, talk loop) are pure CSS/class work.

export type Expression = "neutral" | "engaged" | "excited" | "skeptical" | "warm" | "composed" | "listening" | "distracted";

interface Props {
  name: string;
  size?: number; // rendered width in px; height is size * 1.12
  expression?: Expression;
  talking?: boolean;
  gazeDeg?: number; // head-group rotation, later step
}

const OUTLINE = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const };
const FEATURE = { stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, fill: "none" };

function Torso({ t }: { t: CharacterTokens }) {
  const d = t.broadShoulders
    ? "M 15 112 L 15 98 Q 15 75 40 73 L 60 73 Q 85 75 85 98 L 85 112 Z"
    : "M 20 112 L 20 98 Q 20 76 42 74 L 58 74 Q 80 76 80 98 L 80 112 Z";
  return <path d={d} fill={t.clothing} {...OUTLINE} />;
}

// Per-character hair + accessories. Front hair renders above the head shape.
const VARIANTS: Record<string, { back?: (t: CharacterTokens) => ReactNode; front: (t: CharacterTokens) => ReactNode; accessory?: (t: CharacterTokens) => ReactNode }> = {
  Vilma: {
    back: (t) => <circle cx={50} cy={13} r={10} fill={t.hair} {...OUTLINE} />,
    front: (t) => (
      <>
        <path
          d="M 27 40 Q 25 16 50 15 Q 75 16 73 40 Q 71 27 60 26 Q 63 20 52 21 Q 40 19 40 27 Q 29 28 27 40 Z"
          fill={t.hair}
          {...OUTLINE}
        />
        <path d="M 28 36 Q 24 44 27 52" stroke={t.hair} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <path d="M 72 36 Q 76 44 73 52" stroke={t.hair} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      </>
    ),
  },
  Otto: {
    front: (t) => (
      <path d="M 27 34 Q 27 16 50 15 Q 73 16 73 34 Q 73 25 50 23.5 Q 27 25 27 34 Z" fill={t.hair} {...OUTLINE} />
    ),
  },
  Nea: {
    front: (t) => (
      <path
        d="M 25 60 L 25 34 Q 25 13 50 13 Q 75 13 75 34 L 75 60 L 66 60 L 66 36 Q 59 27 50 27 Q 41 27 34 36 L 34 60 Z"
        fill={t.hair}
        {...OUTLINE}
      />
    ),
    accessory: () => (
      <g>
        <rect x={32.5} y={36} width={14.5} height={10.5} rx={3} fill="rgba(255,255,255,0.14)" stroke={INK} strokeWidth={2} />
        <rect x={53} y={36} width={14.5} height={10.5} rx={3} fill="rgba(255,255,255,0.14)" stroke={INK} strokeWidth={2} />
        <path d="M 47 40.5 L 53 40.5" stroke={INK} strokeWidth={2} />
      </g>
    ),
  },
  Sami: {
    front: (t) => (
      <g>
        <path d="M 27 36 Q 27 19 50 17 Q 73 19 73 36 Q 60 27 50 28 Q 40 27 27 36 Z" fill={t.hair} {...OUTLINE} />
        <circle cx={33} cy={25} r={8.5} fill={t.hair} {...OUTLINE} />
        <circle cx={43} cy={17.5} r={8.5} fill={t.hair} {...OUTLINE} />
        <circle cx={55} cy={16.5} r={8.5} fill={t.hair} {...OUTLINE} />
        <circle cx={66} cy={22} r={8} fill={t.hair} {...OUTLINE} />
        <circle cx={71} cy={31} r={7} fill={t.hair} {...OUTLINE} />
      </g>
    ),
  },
  Leo: {
    front: (t) => (
      <path d="M 27 38 Q 25 15 50 14 Q 75 15 73 38 Q 72 26 61 26 Q 52 20 41 26 Q 28 26 27 38 Z" fill={t.hair} {...OUTLINE} />
    ),
    accessory: (t) => (
      <path
        d="M 30 46 Q 31 63 50 65 Q 69 63 70 46 L 70 52 Q 67 60 50 61.5 Q 33 60 30 52 Z"
        fill={t.hair}
        {...OUTLINE}
      />
    ),
  },
  // Chin-length bob with a slight outward flip at the ends — distinct from
  // Nea's longer, straight-sided hair (which reaches the shoulders).
  Aino: {
    front: (t) => (
      <path
        d="M 26 48 Q 22 46 24 36 Q 25 14 50 14 Q 75 14 76 36 Q 78 46 74 48 L 65 48 L 65 34 Q 58 26 50 26 Q 42 26 35 34 L 35 48 Z"
        fill={t.hair}
        {...OUTLINE}
      />
    ),
  },
  Teacher: {
    front: (t) => (
      <path d="M 27 36 Q 27 14 52 14 Q 75 16 73 36 Q 73 24 57 23 L 36 26 Q 28 28 27 36 Z" fill={t.hair} {...OUTLINE} />
    ),
    accessory: (t) => (
      <g>
        <path d="M 44 74 L 50 84 L 56 74 Z" fill="#ffffff" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M 41 74 L 50 89 L 46.5 74 Z" fill={t.clothingDark} {...OUTLINE} />
        <path d="M 59 74 L 50 89 L 53.5 74 Z" fill={t.clothingDark} {...OUTLINE} />
      </g>
    ),
  },
  You: {
    // Simple neutral crop — no distinctive silhouette, because the identity
    // signal is the visitor lanyard, not the hair.
    front: (t) => (
      <path d="M 28 35 Q 28 17 50 16 Q 72 17 72 35 Q 72 26 50 24.5 Q 28 26 28 35 Z" fill={t.hair} {...OUTLINE} />
    ),
    // Visitor lanyard: a cord around the neck and a badge on the chest — the
    // "I'm a guest here" cue.
    accessory: () => (
      <g>
        <path d="M 44 62 L 47 80" stroke="#b0442e" strokeWidth={2.2} fill="none" />
        <path d="M 56 62 L 53 80" stroke="#b0442e" strokeWidth={2.2} fill="none" />
        <rect x={44} y={79} width={12} height={15} rx={2} fill="#ffffff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        <rect x={46.5} y={82} width={7} height={2.4} rx={1} fill="#94a3b8" />
        <rect x={46.5} y={86} width={7} height={1.8} rx={0.9} fill="#cbd5e1" />
        <rect x={46.5} y={89} width={5} height={1.8} rx={0.9} fill="#cbd5e1" />
      </g>
    ),
  },
};

// Default face bias per character — part of identity, applied at neutral.
const FACES: Record<string, { brows: ReactNode; mouth: string }> = {
  Vilma: {
    brows: (
      <>
        <path d="M 35 32.5 Q 41 29.5 46 32.5" {...FEATURE} />
        <path d="M 54 32.5 Q 59 29.5 65 32.5" {...FEATURE} />
      </>
    ),
    mouth: "M 43.5 51 Q 50 56 56.5 51",
  },
  Otto: {
    brows: (
      <>
        <path d="M 34 33.5 L 46 33.5" {...FEATURE} />
        <path d="M 54 33.5 L 66 33.5" {...FEATURE} />
      </>
    ),
    mouth: "M 45 52.5 Q 50 54 55 52.5",
  },
  Nea: {
    brows: (
      <>
        <path d="M 35 33.5 Q 41 32 46 33.5" {...FEATURE} />
        <path d="M 54 33.5 Q 59 32 65 33.5" {...FEATURE} />
      </>
    ),
    mouth: "M 44.5 52.5 Q 50 53.5 55.5 52.5",
  },
  Sami: {
    brows: (
      <>
        <path d="M 35 34.5 Q 41 33 46 34.5" {...FEATURE} />
        <path d="M 54 32 Q 59 29.5 65 31" {...FEATURE} />
      </>
    ),
    mouth: "M 44 52.5 Q 51 54.5 56 50.5",
  },
  Leo: {
    brows: (
      <>
        <path d="M 35 33 Q 41 31 46 33" {...FEATURE} />
        <path d="M 54 33 Q 59 31 65 33" {...FEATURE} />
      </>
    ),
    mouth: "M 44.5 50 Q 50 53.5 55.5 50",
  },
  Teacher: {
    brows: (
      <>
        <path d="M 35 33 Q 41 31.5 46 33" {...FEATURE} />
        <path d="M 54 33 Q 59 31.5 65 33" {...FEATURE} />
      </>
    ),
    mouth: "M 44.5 51 Q 50 54.5 55.5 51",
  },
  Aino: {
    brows: (
      <>
        <path d="M 35 32 Q 41 30 46 32" {...FEATURE} />
        <path d="M 54 32 Q 59 30 65 32" {...FEATURE} />
      </>
    ),
    mouth: "M 44 51.5 Q 50 55 56 51.5",
  },
  You: {
    brows: (
      <>
        <path d="M 35 33 L 46 33" {...FEATURE} />
        <path d="M 54 33 L 65 33" {...FEATURE} />
      </>
    ),
    mouth: "M 45 52 Q 50 53.5 55 52",
  },
};

export function Character({ name, size = 88, expression = "neutral", talking = false, gazeDeg = 0 }: Props) {
  const t = CHARACTER_TOKENS[name];
  const variant = VARIANTS[name];
  const face = FACES[name];
  if (!t || !variant || !face) return null;

  return (
    <svg
      className={`character char-${expression} ${talking ? "char-talking" : ""}`}
      style={{ ["--gaze-x" as string]: gazeDeg }}
      width={size}
      height={size * 1.12}
      viewBox="0 0 100 112"
      aria-hidden="true"
    >
      <Torso t={t} />
      <rect x={44} y={60} width={12} height={12} rx={3} fill={t.skin} stroke={INK} strokeWidth={2} />
      <g className="char-head-group">
        {variant.back?.(t)}
        <circle cx={27} cy={42} r={4} fill={t.skin} {...OUTLINE} />
        <circle cx={73} cy={42} r={4} fill={t.skin} {...OUTLINE} />
        <ellipse cx={50} cy={40} rx={23} ry={25} fill={t.skin} {...OUTLINE} />
        {variant.front(t)}
        <g className="char-face">
          <g className="char-brows">{face.brows}</g>
          <g className="char-eyes">
            <circle className="char-pupil" cx={41} cy={41} r={2.7} fill={INK} />
            <circle className="char-pupil" cx={59} cy={41} r={2.7} fill={INK} />
          </g>
          <path className="char-mouth" d={face.mouth} {...FEATURE} />
        </g>
        {variant.accessory?.(t)}
      </g>
    </svg>
  );
}
