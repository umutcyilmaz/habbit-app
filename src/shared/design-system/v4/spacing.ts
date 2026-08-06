/**
 * V4 spacing (design-tokens.json -> spacing).
 * 9 scale steps + 9 layout roles. Layout roles follow the 4-base rule.
 */
export const spacing = {
  xs3: 2,
  xs2: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xl2: 32,
  xl3: 48,
  layout: {
    screenX: 24,
    sectionGap: 28,
    cardPadding: 16,
    cardGap: 12,
    formGap: 12,
    listGap: 12,
    inlineGap: 8,
    sheetPadding: 20,
    navClearance: 88
  }
} as const;
