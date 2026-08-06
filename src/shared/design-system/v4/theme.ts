import { colors } from "./colors";
import { motion } from "./motion";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { size } from "./size";
import { spacing } from "./spacing";
import { typography } from "./typography";

/**
 * Public V4 theme. Primitives are intentionally not exposed.
 */
export const theme = {
  colors,
  spacing,
  radius,
  size,
  typography,
  shadows,
  motion
} as const;

export type Theme = typeof theme;
