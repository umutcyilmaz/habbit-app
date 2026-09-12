import type {
  UrgeControlOutcome,
  UrgeControlSecondLineAction,
  UrgeControlTechnique,
  UrgeControlTrigger
} from "../domain/models/UrgeControlEvent";
import type { ActiveUrgeControlEvent, UrgeControlState } from "../domain/models/UrgeControlState";
import type { ISODateString, UUID } from "../domain/models/shared";
import { normalizeUrgeControl } from "./bloomProductStateSchema";
import type { BloomLocalState } from "./bloomState";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export type StartUrgeControlEventInput = { eventId: UUID; startedAt: ISODateString };
export type CompleteUrgeControlInterruptInput = { completedAt: ISODateString };
export type SelectUrgeControlTechniqueInput = { technique: UrgeControlTechnique };
export type StartUrgeControlPhoneAwayInput = { startedAt: ISODateString };
export type EndUrgeControlPhoneAwayInput = { endedAt: ISODateString };
export type RecordUrgeControlOutcomeInput = { outcome: UrgeControlOutcome };
export type RecordUrgeControlTriggerInput = { trigger: UrgeControlTrigger };
export type SelectUrgeControlSecondLineActionInput = { action: UrgeControlSecondLineAction };
export type CompleteUrgeControlEventInput = { completedAt: ISODateString };

export function startUrgeControlEventState(state: BloomLocalState, input: StartUrgeControlEventInput): BloomLocalState {
  return updateUrgeControl(state, (urge) => {
    if (!hasFields(input, ["eventId", "startedAt"]) || !isValidBloomIsoTimestamp(input.startedAt) ||
      urge.activeEvent !== null || urge.records.some((record) => record.id === input.eventId)) return null;
    return { ...urge, activeEvent: { id: input.eventId, status: "active", startedAt: input.startedAt } };
  });
}

export function completeUrgeControlInterruptState(state: BloomLocalState, input: CompleteUrgeControlInterruptInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["completedAt"]) || !isValidBloomIsoTimestamp(input.completedAt) ||
      event.interruptCompletedAt !== undefined || Date.parse(input.completedAt) < Date.parse(event.startedAt)) return null;
    return { ...event, interruptCompletedAt: input.completedAt };
  });
}

export function selectUrgeControlTechniqueState(state: BloomLocalState, input: SelectUrgeControlTechniqueInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["technique"]) || event.interruptCompletedAt === undefined ||
      event.phoneAwayStartedAt !== undefined || event.selectedTechnique === input.technique) return null;
    return { ...event, selectedTechnique: input.technique };
  });
}

export function startUrgeControlPhoneAwayState(state: BloomLocalState, input: StartUrgeControlPhoneAwayInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["startedAt"]) || !isValidBloomIsoTimestamp(input.startedAt) ||
      event.interruptCompletedAt === undefined || event.selectedTechnique === undefined ||
      event.phoneAwayStartedAt !== undefined || Date.parse(input.startedAt) < Date.parse(event.interruptCompletedAt)) return null;
    return { ...event, phoneAwayStartedAt: input.startedAt };
  });
}

export function endUrgeControlPhoneAwayState(state: BloomLocalState, input: EndUrgeControlPhoneAwayInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["endedAt"]) || !isValidBloomIsoTimestamp(input.endedAt) ||
      event.phoneAwayStartedAt === undefined || event.phoneAwayEndedAt !== undefined ||
      Date.parse(input.endedAt) < Date.parse(event.phoneAwayStartedAt)) return null;
    return { ...event, phoneAwayEndedAt: input.endedAt };
  });
}

export function recordUrgeControlOutcomeState(state: BloomLocalState, input: RecordUrgeControlOutcomeInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["outcome"]) || event.phoneAwayEndedAt === undefined || event.outcome === input.outcome) return null;
    const clearSecondLine = input.outcome === "reduced" && event.secondLineAction !== undefined;
    // This is an in-progress answer correction, not an external action.
    const updated = { ...event, outcome: input.outcome };
    if (clearSecondLine) delete updated.secondLineAction;
    return updated;
  });
}

export function recordUrgeControlTriggerState(state: BloomLocalState, input: RecordUrgeControlTriggerInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["trigger"]) || event.outcome === undefined || event.trigger === input.trigger) return null;
    return { ...event, trigger: input.trigger };
  });
}

export function selectUrgeControlSecondLineActionState(state: BloomLocalState, input: SelectUrgeControlSecondLineActionInput): BloomLocalState {
  return updateActiveEvent(state, (event) => {
    if (!hasFields(input, ["action"]) || event.outcome === undefined || event.outcome === "reduced" ||
      event.secondLineAction === input.action) return null;
    return { ...event, secondLineAction: input.action };
  });
}

export function completeUrgeControlEventState(state: BloomLocalState, input: CompleteUrgeControlEventInput): BloomLocalState {
  return updateUrgeControl(state, (urge) => {
    const event = urge.activeEvent;
    if (!hasFields(input, ["completedAt"]) || !isValidBloomIsoTimestamp(input.completedAt) || event === null ||
      event.interruptCompletedAt === undefined || event.selectedTechnique === undefined ||
      event.phoneAwayStartedAt === undefined || event.phoneAwayEndedAt === undefined ||
      event.outcome === undefined || event.trigger === undefined || !hasOrderedSteps(event) ||
      Date.parse(input.completedAt) < Date.parse(event.phoneAwayEndedAt) ||
      Date.parse(input.completedAt) < Date.parse(event.startedAt)) return null;
    return {
      activeEvent: null,
      records: [...urge.records, {
        ...event, status: "completed", completedAt: input.completedAt,
        selectedTechnique: event.selectedTechnique, outcome: event.outcome, trigger: event.trigger
      }]
    };
  });
}

export function discardActiveUrgeControlEventState(state: BloomLocalState): BloomLocalState {
  return updateUrgeControl(state, (urge) => urge.activeEvent === null ? null : { ...urge, activeEvent: null });
}

function updateActiveEvent(
  state: BloomLocalState,
  update: (event: ActiveUrgeControlEvent) => ActiveUrgeControlEvent | null
): BloomLocalState {
  return updateUrgeControl(state, (urge) => {
    if (urge.activeEvent === null) return null;
    const activeEvent = update(urge.activeEvent);
    return activeEvent === null ? null : { ...urge, activeEvent };
  });
}

function updateUrgeControl(
  state: BloomLocalState,
  update: (urge: UrgeControlState) => UrgeControlState | null
): BloomLocalState {
  try {
    normalizeUrgeControl(state.urgeControl);
    const urgeControl = update(state.urgeControl);
    if (urgeControl === null) return state;
    normalizeUrgeControl(urgeControl);
    if (urgeControl.activeEvent !== null && !hasOrderedSteps(urgeControl.activeEvent)) return state;
    return { ...state, urgeControl };
  } catch {
    return state;
  }
}

// The storage validator deliberately accepts older partial guided-step shapes.
// New transitions must produce ordered facts, without inventing missing steps
// or silently removing earlier answers. Explicit outcome correction may remove
// an unnecessary second-line choice; historical completed records stay intact.
function hasOrderedSteps(event: ActiveUrgeControlEvent): boolean {
  return (event.selectedTechnique === undefined || event.interruptCompletedAt !== undefined) &&
    (event.phoneAwayStartedAt === undefined || (event.interruptCompletedAt !== undefined && event.selectedTechnique !== undefined)) &&
    (event.phoneAwayEndedAt === undefined || event.phoneAwayStartedAt !== undefined) &&
    (event.outcome === undefined || event.phoneAwayEndedAt !== undefined) &&
    (event.trigger === undefined || event.outcome !== undefined) &&
    (event.secondLineAction === undefined || (event.outcome !== undefined && event.outcome !== "reduced"));
}

function hasFields(value: unknown, required: readonly string[]): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === required.length && required.every((key) =>
    keys.includes(key) && (value as Record<string, unknown>)[key] !== undefined);
}
