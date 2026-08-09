import type { BloomLocalState } from "../../storage/bloomState";

export type BloomLocalStateProjectionSnapshot = Readonly<{
  acceptedState: BloomLocalState;
  durableState: BloomLocalState;
  persistenceMessage: string | null;
}>;

type ProjectionListener = () => void;

export function createBloomLocalStateProjection(
  initialState: BloomLocalState
) {
  let snapshot: BloomLocalStateProjectionSnapshot = {
    acceptedState: initialState,
    durableState: initialState,
    persistenceMessage: null
  };
  const listeners = new Set<ProjectionListener>();

  const publish = (nextSnapshot: BloomLocalStateProjectionSnapshot) => {
    snapshot = nextSnapshot;

    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: ProjectionListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setAcceptedState(acceptedState: BloomLocalState) {
      publish({
        ...snapshot,
        acceptedState
      });
    },
    setDurableState(durableState: BloomLocalState) {
      publish({
        ...snapshot,
        durableState
      });
    },
    setPersistenceMessage(persistenceMessage: string | null) {
      publish({
        ...snapshot,
        persistenceMessage
      });
    }
  };
}

export type BloomLocalStateProjection = ReturnType<
  typeof createBloomLocalStateProjection
>;
