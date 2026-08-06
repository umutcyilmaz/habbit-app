import type { CubicBezierTuple } from "./types";

/**
 * V4 motion tokens (design-tokens.json -> motion).
 * Durations are numeric milliseconds; easings are cubic-bezier tuples.
 * The runtime reduced-motion helper (AccessibilityInfo) belongs to the first
 * component that uses animation — not to the token layer.
 */
export const motion = {
  duration: {
    instant: 0,
    fast: 120,
    standard: 220,
    slow: 320,
    sheet: 280
  },
  easing: {
    standard: [0.2, 0, 0, 1] as const satisfies CubicBezierTuple,
    decelerate: [0, 0, 0, 1] as const satisfies CubicBezierTuple,
    accelerate: [0.3, 0, 1, 1] as const satisfies CubicBezierTuple
  },
  reducedMotion: {
    policy: {
      allDurationsMs: 0,
      disable: ["translate", "scale"] as const,
      keep: ["opacity"] as const,
      skeletonShimmer: "static" as const
    }
  }
} as const;
