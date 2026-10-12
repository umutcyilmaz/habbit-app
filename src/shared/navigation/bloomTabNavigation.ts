import type { BloomLocalState } from "../../storage/bloomState";
export function canChangeBloomTab(hasHydrated:boolean,accepted:BloomLocalState,durable:BloomLocalState) {
  // Read fresh runtime snapshots at the press boundary, not only rendered props.
  return hasHydrated && accepted===durable;
}
