import { routes } from "../../constants/navigation";
import {
  getLatestPauseRecord,
  type PauseRecord,
  type PauseState
} from "../../storage/bloomState";

export type PauseSavedRouteIntent =
  | {
      mode: "completion";
      recordId: string | null;
    }
  | {
      mode: "history";
    };

export type PauseSavedRouteResolution =
  | {
      status: "collect-completion";
    }
  | {
      status: "show-completion";
      record: PauseRecord;
    }
  | {
      status: "show-history";
      record: PauseRecord;
    }
  | {
      status: "unconfirmed";
    }
  | {
      status: "redirect";
    };

export function createPauseSavedCompletionHref(recordId: string) {
  return {
    pathname: routes.pauseSaved,
    params: { recordId }
  } as const;
}

export function getPauseSavedRouteIntent(
  recordId: string | string[] | undefined
): PauseSavedRouteIntent {
  if (recordId === undefined) {
    return { mode: "history" };
  }

  return {
    mode: "completion",
    recordId:
      typeof recordId === "string" && recordId.length > 0
        ? recordId
        : null
  };
}

export function resolvePauseSavedRoute(
  acceptedPause: PauseState,
  durablePause: PauseState,
  intent: PauseSavedRouteIntent
): PauseSavedRouteResolution {
  if (acceptedPause.activeSession !== null) {
    return { status: "collect-completion" };
  }

  const durableRecordIds = new Set(
    durablePause.records.map((record) => record.id)
  );
  const hasUnconfirmedAcceptedRecord = acceptedPause.records.some(
    (record) => !durableRecordIds.has(record.id)
  );

  if (hasUnconfirmedAcceptedRecord) {
    return { status: "unconfirmed" };
  }

  if (durablePause.activeSession !== null) {
    return { status: "collect-completion" };
  }

  if (intent.mode === "completion") {
    const exactRecord =
      intent.recordId === null
        ? undefined
        : durablePause.records.find(
            (record) => record.id === intent.recordId
          );

    return exactRecord === undefined
      ? { status: "unconfirmed" }
      : {
          status: "show-completion",
          record: exactRecord
        };
  }

  const latestRecord = getLatestPauseRecord(durablePause.records);

  return latestRecord === null
    ? { status: "redirect" }
    : {
        status: "show-history",
        record: latestRecord
      };
}
