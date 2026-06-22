export const TAB_BAR_MIN_HEIGHT = 72;
export const TAB_BAR_MIN_BOTTOM_PADDING = 8;
export const TAB_BAR_TOP_PADDING = 8;
export const TAB_SCREEN_BOTTOM_PADDING = 28;

export function getTabBarBottomPadding(bottomInset: number) {
  return Math.max(bottomInset, TAB_BAR_MIN_BOTTOM_PADDING);
}

export function getTabBarHeight(bottomInset: number) {
  return TAB_BAR_MIN_HEIGHT + getTabBarBottomPadding(bottomInset) - TAB_BAR_MIN_BOTTOM_PADDING;
}
