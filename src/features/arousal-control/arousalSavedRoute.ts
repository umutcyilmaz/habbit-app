import { routes } from "../../constants/navigation";
import {
  getLatestValidArousalLog,
  isValidCompletedArousalLog,
  type ArousalControlPracticeLog,
  type ArousalControlState
} from "../../storage/bloomState";

export type ArousalSavedRouteIntent =
  | {
      mode: "completion";
      logId: string | null;
    }
  | {
      mode: "history";
    };

export type ArousalSavedRouteResolution =
  | {
      status: "show-completion";
      log: ArousalControlPracticeLog;
    }
  | {
      status: "show-history";
      log: ArousalControlPracticeLog;
    }
  | {
      status: "unconfirmed";
    }
  | {
      status: "redirect";
    };

export function createArousalSavedCompletionHref(logId: string) {
  return {
    pathname: routes.arousalControlSaved,
    params: { logId }
  } as const;
}

export function getArousalSavedRouteIntent(
  logId: string | string[] | undefined
): ArousalSavedRouteIntent {
  if (logId === undefined) {
    return { mode: "history" };
  }

  return {
    mode: "completion",
    logId:
      typeof logId === "string" && logId.length > 0
        ? logId
        : null
  };
}

export function resolveArousalSavedRoute(
  acceptedArousal: ArousalControlState,
  durableArousal: ArousalControlState,
  intent: ArousalSavedRouteIntent
): ArousalSavedRouteResolution {
  if (acceptedArousal.draft !== null) {
    return { status: "redirect" };
  }

  const durableLogIds = new Set(
    durableArousal.logs
      .filter(isValidCompletedArousalLog)
      .map((log) => log.id)
  );
  const hasUnconfirmedAcceptedLog = acceptedArousal.logs.some(
    (log) =>
      isValidCompletedArousalLog(log) && !durableLogIds.has(log.id)
  );

  if (hasUnconfirmedAcceptedLog) {
    return { status: "unconfirmed" };
  }

  if (intent.mode === "completion") {
    const exactLog =
      intent.logId === null
        ? undefined
        : durableArousal.logs.find(
            (log) =>
              log.id === intent.logId &&
              isValidCompletedArousalLog(log)
          );

    return exactLog === undefined
      ? { status: "unconfirmed" }
      : {
          status: "show-completion",
          log: exactLog
        };
  }

  const latestLog = getLatestValidArousalLog(durableArousal.logs);

  return latestLog === null
    ? { status: "redirect" }
    : {
        status: "show-history",
        log: latestLog
      };
}
