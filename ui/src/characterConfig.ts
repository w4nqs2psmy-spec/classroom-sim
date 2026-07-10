// Design tokens for the SVG character system. Shapes live in Character.tsx;
// this file holds only per-character data so palette tweaks never touch
// geometry. Persona colors match PERSONAS in data.ts — the same color runs
// through clothing, participation bars, arcs, and bubbles.

export interface CharacterTokens {
  clothing: string; // persona color
  clothingDark: string; // shaded edge of the clothing
  skin: string;
  hair: string;
  broadShoulders?: boolean;
}

export const INK = "#2b3040"; // outline + facial features, projector-safe

export const CHARACTER_TOKENS: Record<string, CharacterTokens> = {
  Vilma: { clothing: "#f59e0b", clothingDark: "#c47d08", skin: "#f6c9a0", hair: "#7a4a21" },
  Otto: { clothing: "#ef4444", clothingDark: "#c73333", skin: "#f0b482", hair: "#2e2419", broadShoulders: true },
  Nea: { clothing: "#06b6d4", clothingDark: "#0592aa", skin: "#8d5a3b", hair: "#14100c" },
  Sami: { clothing: "#22c55e", clothingDark: "#1a9e4b", skin: "#c68e5e", hair: "#8a4b23" },
  Leo: { clothing: "#3b82f6", clothingDark: "#2f68c5", skin: "#a06a45", hair: "#3d2c1e" },
  Teacher: { clothing: "#a855f7", clothingDark: "#8a44cc", skin: "#e8b48c", hair: "#9aa2b1" },
  // The human participant — slate outfit + a visitor lanyard, deliberately
  // reading as a guest rather than one of the coloured AI agents.
  You: { clothing: "#475569", clothingDark: "#334155", skin: "#dcae8a", hair: "#4a4640" },
};
