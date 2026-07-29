import type {
  ArousalPauseCountBucket,
  ArousalSessionPatch
} from "../../storage/bloomState";

export const durationRangeOptions = [
  "lessThanOne",
  "oneToThree",
  "threeToFive",
  "fiveToTen",
  "tenToFifteen",
  "fifteenPlus"
] as const;

export type DurationRange = (typeof durationRangeOptions)[number];
export type DurationInputMode = "preferNot" | "range" | "exact";

export type DurationInputState = {
  mode: DurationInputMode;
  selectedRange: DurationRange | null;
  minutes: string;
  seconds: string;
};

export type DurationInputAction =
  | { type: "selectPreferNot" }
  | { type: "selectRange"; range: DurationRange }
  | { type: "selectExact" }
  | { type: "setMinutes"; value: string }
  | { type: "setSeconds"; value: string };

export type DurationSubmissionResult =
  | { ok: true; patch: ArousalSessionPatch }
  | {
      ok: false;
      reason: "rangeRequired" | "exactDurationRequired" | "invalidExactDuration";
    };

const durationEstimatesInSeconds: Record<DurationRange, number> = {
  lessThanOne: 30,
  oneToThree: 120,
  threeToFive: 240,
  fiveToTen: 450,
  tenToFifteen: 750,
  fifteenPlus: 900
};

export function createInitialDurationInputState(): DurationInputState {
  return {
    mode: "preferNot",
    selectedRange: null,
    minutes: "",
    seconds: ""
  };
}

export function durationInputReducer(
  state: DurationInputState,
  action: DurationInputAction
): DurationInputState {
  switch (action.type) {
    case "selectPreferNot":
      return createInitialDurationInputState();
    case "selectRange":
      return {
        mode: "range",
        selectedRange: action.range,
        minutes: "",
        seconds: ""
      };
    case "selectExact":
      return {
        mode: "exact",
        selectedRange: null,
        minutes: "",
        seconds: ""
      };
    case "setMinutes":
      return {
        ...state,
        mode: "exact",
        selectedRange: null,
        minutes: sanitizeNumberInput(action.value, 3)
      };
    case "setSeconds":
      return {
        ...state,
        mode: "exact",
        selectedRange: null,
        seconds: sanitizeNumberInput(action.value, 2)
      };
  }
}

export function resolveDurationSubmission(
  state: DurationInputState
): DurationSubmissionResult {
  switch (state.mode) {
    case "preferNot":
      return {
        ok: true,
        patch: {
          durationPreference: "notLogged",
          durationSeconds: null
        }
      };
    case "range":
      return state.selectedRange === null
        ? { ok: false, reason: "rangeRequired" }
        : {
            ok: true,
            patch: {
              durationPreference: "estimated",
              durationSeconds:
                durationEstimatesInSeconds[state.selectedRange]
            }
          };
    case "exact": {
      if (
        !/^\d{0,3}$/.test(state.minutes) ||
        !/^\d{0,2}$/.test(state.seconds)
      ) {
        return { ok: false, reason: "invalidExactDuration" };
      }

      const minutes = Number(state.minutes || "0");
      const seconds = Number(state.seconds || "0");

      if (
        !Number.isInteger(minutes) ||
        !Number.isInteger(seconds) ||
        minutes < 0 ||
        seconds < 0 ||
        seconds > 59
      ) {
        return { ok: false, reason: "invalidExactDuration" };
      }

      const durationSeconds = minutes * 60 + seconds;

      return durationSeconds > 0
        ? {
            ok: true,
            patch: {
              durationPreference: "exact",
              durationSeconds
            }
          }
        : { ok: false, reason: "exactDurationRequired" };
    }
  }
}

export function mapReflectionPauseCount(
  bucket: ArousalPauseCountBucket
): Pick<ArousalSessionPatch, "pauseCount" | "pauseCountBucket"> {
  const numericValues: Record<ArousalPauseCountBucket, number> = {
    "0": 0,
    "1": 1,
    "2": 2,
    "3plus": 3
  };

  return {
    pauseCount: numericValues[bucket],
    pauseCountBucket: bucket
  };
}

export function formatArousalPauseCount(
  pauseCount: number | null | undefined,
  bucket: ArousalPauseCountBucket | null | undefined
) {
  if (bucket === "3plus") {
    return "3+";
  }

  return pauseCount !== undefined && pauseCount !== null
    ? String(pauseCount)
    : "Not logged";
}

function sanitizeNumberInput(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}
