import type { TextStyle } from "react-native";

export type PracticeTextRole = "content" | "display" | "control" | "timer";

/** Essential prose follows native Dynamic Type. Display and control lettering
 * grows more gradually: the HTML's large display sizes are not body text styles.
 * No ceiling: every role continues to grow with the user's text size.
 * The native Text still scales; this is its feature-local base-size adjustment.
 */
export function practiceTypeStyle(style: TextStyle, role: PracticeTextRole, fontScale: number): TextStyle {
  const scale = Math.max(1, fontScale);
  const exponent = role === "content" ? 1 : role === "timer" ? .15 : .5;
  const adjustment = Math.pow(scale, exponent - 1);
  return {
    ...style,
    fontSize: (style.fontSize ?? 14) * adjustment,
    lineHeight: (style.lineHeight ?? (style.fontSize ?? 14) * 1.5) * adjustment,
    letterSpacing: (style.letterSpacing ?? 0) * adjustment
  };
}

/** Only a word wider than the actual available line triggers an adjustment.
 * This is not a paragraph/height fit: wrapping and vertical growth remain free.
 * Native measurement includes the registered Inter face, weight and OS scale.
 */
export function practiceWordFit(availableWidth: number, widestWord: number): number {
  if (availableWidth <= 0 || widestWord <= availableWidth + .5) return 1;
  return Math.min(1, Math.max(1, availableWidth - 2) / widestWord);
}

export function practiceLayout(width: number, height: number, fontScale: number) {
  return {
    stacked: fontScale >= 1.35 || width < 360,
    flowingControls: fontScale >= 1.35 || height < 700,
    columns: fontScale > 2.4 ? 2 : fontScale >= 1.35 || width < 360 ? 3 : 5
  };
}
