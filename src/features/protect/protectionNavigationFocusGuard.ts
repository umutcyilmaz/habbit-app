export function createProtectionNavigationFocusGuard() {
  let activeFocusSequence = 0;
  let focused = false;

  return {
    beginFocus() {
      const focusSequence = activeFocusSequence + 1;
      activeFocusSequence = focusSequence;
      focused = true;

      return () => {
        if (activeFocusSequence === focusSequence) {
          focused = false;
        }
      };
    },
    captureFocusSequence() {
      return focused ? activeFocusSequence : null;
    },
    runIfFocusUnchanged(
      focusSequence: number | null,
      navigate: () => void
    ) {
      if (
        focusSequence === null ||
        !focused ||
        activeFocusSequence !== focusSequence
      ) {
        return false;
      }

      navigate();
      return true;
    }
  };
}
