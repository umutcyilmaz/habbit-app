import type {
  BehaviorEventSource,
  CompletedContentFreeActivation,
  ContentFreeState,
  ContentFreeViolation,
  MasturbationPause,
  MasturbationSession,
  MasturbationTrackingState,
  PostResetAssessment,
  ResetAttempt,
  ResetBaseline,
  ResetJourney,
  ResetViolation,
  UrgeControlEvent,
  UrgeControlState
} from "../domain/models";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

const endingReasons = [
  "climaxed", "stoppedBeforeClimax", "firmnessDecreased",
  "feltAnxious", "stoppedByChoice", "other"
] as const;
const techniques = [
  "changeEnvironment", "grounding54321", "cognitiveTask", "urgeSurfing", "personalReminder"
] as const;
const outcomes = ["reduced", "stillStrong", "stronger", "unchanged"] as const;
const triggers = [
  "boredom", "stress", "loneliness", "sleeplessnessNighttime",
  "sexualDesire", "habitAutomatic", "notSure"
] as const;
const secondLineActions = ["putPhoneInAnotherRoom", "doAnotherTask", "messageSupportPerson"] as const;
const incompleteDays = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;
const completedDays = [...incompleteDays, 15] as const;

// New records are validated as a whole. Never filter a malformed history entry
// or coerce an answer into a different user fact; the caller owns quarantine.
export function normalizeMasturbationTracking(value: unknown): MasturbationTrackingState {
  const path = "state.masturbationTracking";
  const record = object(value, path);
  const sessions = list(record.sessions, `${path}.sessions`, (entry, entryPath) => {
    const session = normalizeSession(entry, entryPath);
    ensure(session.status === "completed", entryPath, "must contain a completed session");
    return session;
  });
  const currentSession = record.currentSession === null
    ? null
    : normalizeSession(record.currentSession, `${path}.currentSession`);
  ensure(currentSession?.status !== "completed", path, "cannot keep a completed current session");
  uniqueIds([...sessions, ...(currentSession === null ? [] : [currentSession])], path);
  return {
    enabled: boolean(record.enabled, `${path}.enabled`),
    currentSession,
    sessions
  };
}

function normalizeSession(value: unknown, path: string): MasturbationSession {
  const record = object(value, path);
  const status = choice(record.status, ["active", "awaiting_feedback", "completed"], `${path}.status`);
  const identity = {
    id: identityString(record.id, `${path}.id`),
    startedAt: timestamp(record.startedAt, `${path}.startedAt`)
  };
  const pauses = list(record.pauses, `${path}.pauses`, normalizePause);
  absent(record, ["feedback"], path);
  for (const pause of pauses) {
    notBefore(pause.startedAt, identity.startedAt, `${path}.pauses.startedAt`);
  }
  nonOverlapping(pauses.map((pause) => pause.status === "active"
    ? { startedAt: pause.startedAt }
    : pause), `${path}.pauses`);

  if (status === "active") {
    absent(record, ["endedAt", "durationSeconds", "erectionQuality", "usedExplicitContent", "endingReason"], path);
    ensure(pauses.filter((pause) => pause.status === "active").length <= 1, path, "may have only one active pause");
    return { ...identity, status, pauses };
  }

  const endedAt = timestamp(record.endedAt, `${path}.endedAt`);
  notBefore(endedAt, identity.startedAt, `${path}.endedAt`);
  const closedPauses = pauses.map((pause) => {
    ensure(pause.status === "completed", `${path}.pauses`, "must close pauses when the session ends");
    notBefore(endedAt, pause.endedAt, `${path}.pauses.endedAt`);
    return pause;
  });
  const ended = {
    ...identity,
    endedAt,
    durationSeconds: nonnegativeInteger(record.durationSeconds, `${path}.durationSeconds`),
    pauses: closedPauses
  };
  if (status === "awaiting_feedback") {
    return {
      ...ended,
      status,
      ...optionalField(record, "erectionQuality", path, erectionQuality),
      ...optionalField(record, "usedExplicitContent", path, boolean),
      ...optionalField(record, "endingReason", path, endingReason)
    };
  }
  return {
    ...ended,
    status,
    erectionQuality: erectionQuality(record.erectionQuality, `${path}.erectionQuality`),
    usedExplicitContent: boolean(record.usedExplicitContent, `${path}.usedExplicitContent`),
    endingReason: endingReason(record.endingReason, `${path}.endingReason`)
  };
}

function normalizePause(value: unknown, path: string): MasturbationPause {
  const record = object(value, path);
  const status = choice(record.status, ["active", "completed"], `${path}.status`);
  const startedAt = timestamp(record.startedAt, `${path}.startedAt`);
  if (status === "active") {
    absent(record, ["endedAt", "durationSeconds"], path);
    return { status, startedAt };
  }
  const endedAt = timestamp(record.endedAt, `${path}.endedAt`);
  notBefore(endedAt, startedAt, `${path}.endedAt`);
  return {
    status,
    startedAt,
    endedAt,
    durationSeconds: nonnegativeInteger(record.durationSeconds, `${path}.durationSeconds`)
  };
}

export function normalizeContentFree(value: unknown): ContentFreeState {
  const path = "state.contentFree";
  const record = object(value, path);
  const status = choice(record.status, ["inactive", "active"], `${path}.status`);
  const history = {
    bestStreakSeconds: nonnegativeInteger(record.bestStreakSeconds, `${path}.bestStreakSeconds`),
    pastActivations: list(record.pastActivations, `${path}.pastActivations`, normalizeActivation),
    violations: list(record.violations, `${path}.violations`, normalizeContentViolation)
  };
  let state: ContentFreeState;
  if (status === "inactive") {
    absent(record, ["activationId", "activatedAt", "currentStreakStartedAt"], path);
    state = { status, ...history };
  } else {
    const activatedAt = timestamp(record.activatedAt, `${path}.activatedAt`);
    const currentStreakStartedAt = timestamp(record.currentStreakStartedAt, `${path}.currentStreakStartedAt`);
    notBefore(currentStreakStartedAt, activatedAt, `${path}.currentStreakStartedAt`);
    state = {
      ...history,
      status,
      activationId: identityString(record.activationId, `${path}.activationId`),
      activatedAt,
      currentStreakStartedAt
    };
  }
  const activations: Array<{ id: string; startedAt: string; endedAt?: string }> = [...state.pastActivations];
  if (state.status === "active") {
    activations.push({ id: state.activationId, startedAt: state.activatedAt });
  }
  uniqueIds(activations, `${path}.activations`);
  nonOverlapping(activations, `${path}.activations`);
  uniqueIds(state.violations, `${path}.violations`);
  uniqueSources(state.violations, `${path}.violations`);
  for (const violation of state.violations) {
    const activation = activations.find((entry) => entry.id === violation.activationId);
    ensure(activation !== undefined, path, "has a violation referencing an unknown activation");
    within(violation.occurredAt, activation, `${path}.violations.occurredAt`);
    within(violation.streakBefore.currentStreakStartedAt, activation, `${path}.violations.streakBefore`);
    // A backdated log can be entered after other violations. Its prior snapshot
    // belongs to the logging moment, not necessarily before occurredAt.
    notBefore(violation.recordedAt, violation.streakBefore.currentStreakStartedAt, `${path}.violations.recordedAt`);
  }
  return state;
}

function normalizeActivation(value: unknown, path: string): CompletedContentFreeActivation {
  const record = object(value, path);
  const startedAt = timestamp(record.startedAt, `${path}.startedAt`);
  const endedAt = timestamp(record.endedAt, `${path}.endedAt`);
  notBefore(endedAt, startedAt, `${path}.endedAt`);
  return { id: identityString(record.id, `${path}.id`), startedAt, endedAt };
}

function normalizeContentViolation(value: unknown, path: string): ContentFreeViolation {
  const record = object(value, path);
  const prior = object(record.streakBefore, `${path}.streakBefore`);
  const occurredAt = timestamp(record.occurredAt, `${path}.occurredAt`);
  const recordedAt = timestamp(record.recordedAt, `${path}.recordedAt`);
  notBefore(recordedAt, occurredAt, `${path}.recordedAt`);
  const base = {
    id: identityString(record.id, `${path}.id`),
    activationId: identityString(record.activationId, `${path}.activationId`),
    kind: choice(record.kind, ["intentionalExplicitContent"], `${path}.kind`),
    occurredAt,
    recordedAt,
    source: normalizeSource(record.source, `${path}.source`),
    streakBefore: {
      currentStreakStartedAt: timestamp(prior.currentStreakStartedAt, `${path}.streakBefore.currentStreakStartedAt`),
      bestStreakSeconds: nonnegativeInteger(prior.bestStreakSeconds, `${path}.streakBefore.bestStreakSeconds`)
    }
  };
  const status = choice(record.status, ["recorded", "undone"], `${path}.status`);
  if (status === "recorded") {
    absent(record, ["undoneAt"], path);
    return { ...base, status };
  }
  const undoneAt = timestamp(record.undoneAt, `${path}.undoneAt`);
  notBefore(undoneAt, recordedAt, `${path}.undoneAt`);
  return { ...base, status, undoneAt };
}

export function normalizeResetJourney(value: unknown): ResetJourney {
  const path = "state.resetJourney";
  const record = object(value, path);
  const status = choice(record.status,
    ["inactive", "recommended", "baseline_pending", "active", "assessment_pending", "completed"],
    `${path}.status`);
  const history = {
    durationDays: choice(record.durationDays, [15], `${path}.durationDays`),
    bestCompletedDays: choice(record.bestCompletedDays, completedDays, `${path}.bestCompletedDays`),
    pastAttempts: list(record.pastAttempts, `${path}.pastAttempts`, (entry, entryPath) => {
      const attempt = normalizeAttempt(entry, entryPath);
      ensure(attempt.status !== "active", entryPath, "cannot contain an active past attempt");
      return attempt;
    }),
    violations: list(record.violations, `${path}.violations`, normalizeResetViolation)
  };
  let journey: ResetJourney;
  if (status === "inactive" || status === "recommended" || status === "baseline_pending") {
    absent(record, ["startedAt", "baseline", "currentAttempt", "completedAt", "assessment"], path);
    if (status === "inactive") {
      absent(record, ["id"], path);
      journey = { status, ...history };
    } else {
      const id = identityString(record.id, `${path}.id`);
      journey = status === "recommended"
        ? { ...history, status: "recommended", id }
        : { ...history, status: "baseline_pending", id };
    }
  } else {
    const started = {
      ...history,
      id: identityString(record.id, `${path}.id`),
      startedAt: timestamp(record.startedAt, `${path}.startedAt`),
      baseline: normalizeBaseline(record.baseline, `${path}.baseline`)
    };
    const currentAttempt = normalizeAttempt(record.currentAttempt, `${path}.currentAttempt`);
    notBefore(started.startedAt, started.baseline.capturedAt, `${path}.startedAt`);
    notBefore(currentAttempt.startedAt, started.startedAt, `${path}.currentAttempt.startedAt`);
    if (status === "active") {
      absent(record, ["completedAt", "assessment"], path);
      ensure(currentAttempt.status === "active", path, "requires an active current attempt");
      journey = { ...started, status, currentAttempt };
    } else {
      ensure(currentAttempt.status === "completed", path, "requires a completed current attempt");
      const bestCompletedDays = choice(record.bestCompletedDays, [15], `${path}.bestCompletedDays`);
      const completedAt = timestamp(record.completedAt, `${path}.completedAt`);
      ensure(completedAt === currentAttempt.completedAt, path, "must agree with the current attempt completion time");
      const finished = { ...started, bestCompletedDays, currentAttempt, completedAt };
      if (status === "assessment_pending") {
        absent(record, ["assessment"], path);
        journey = { ...finished, status };
      } else {
        const assessment = normalizeAssessment(record.assessment, `${path}.assessment`);
        ensure(assessment.resetJourneyId === started.id && assessment.resetAttemptId === currentAttempt.id &&
          assessment.baselineId === started.baseline.id, path, "has inconsistent assessment references");
        notBefore(assessment.completedAt, completedAt, `${path}.assessment.completedAt`);
        journey = { ...finished, status, assessment };
      }
    }
  }
  validateResetReferences(journey, path);
  return journey;
}

function normalizeAttempt(value: unknown, path: string): ResetAttempt {
  const record = object(value, path);
  const status = choice(record.status, ["active", "restarted", "completed"], `${path}.status`);
  const identity = {
    id: identityString(record.id, `${path}.id`),
    startedAt: timestamp(record.startedAt, `${path}.startedAt`)
  };
  if (status === "completed") {
    absent(record, ["endedAt", "restartViolationId"], path);
    const completedAt = timestamp(record.completedAt, `${path}.completedAt`);
    notBefore(completedAt, identity.startedAt, `${path}.completedAt`);
    return { ...identity, status, completedAt, completedDays: choice(record.completedDays, [15], `${path}.completedDays`) };
  }
  const progress = choice(record.completedDays, incompleteDays, `${path}.completedDays`);
  absent(record, ["completedAt"], path);
  if (status === "active") {
    absent(record, ["endedAt", "restartViolationId"], path);
    return { ...identity, status, completedDays: progress };
  }
  const endedAt = timestamp(record.endedAt, `${path}.endedAt`);
  notBefore(endedAt, identity.startedAt, `${path}.endedAt`);
  return {
    ...identity, status, completedDays: progress, endedAt,
    restartViolationId: identityString(record.restartViolationId, `${path}.restartViolationId`)
  };
}

function normalizeResetViolation(value: unknown, path: string): ResetViolation {
  const record = object(value, path);
  const occurredAt = timestamp(record.occurredAt, `${path}.occurredAt`);
  const recordedAt = timestamp(record.recordedAt, `${path}.recordedAt`);
  notBefore(recordedAt, occurredAt, `${path}.recordedAt`);
  return {
    id: identityString(record.id, `${path}.id`),
    attemptId: identityString(record.attemptId, `${path}.attemptId`),
    occurredAt,
    recordedAt,
    source: normalizeSource(record.source, `${path}.source`),
    reason: choice(record.reason, ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"], `${path}.reason`)
  };
}

function validateResetReferences(journey: ResetJourney, path: string) {
  const attempts: ResetAttempt[] = [
    ...journey.pastAttempts,
    ...("currentAttempt" in journey ? [journey.currentAttempt] : [])
  ];
  uniqueIds(attempts, `${path}.attempts`);
  uniqueIds(journey.violations, `${path}.violations`);
  uniqueSources(journey.violations, `${path}.violations`);
  nonOverlapping(attempts.map(attemptPeriod), `${path}.attempts`);
  for (const attempt of attempts) {
    ensure(journey.bestCompletedDays >= attempt.completedDays, path, "cannot lose previously completed progress");
    if ("startedAt" in journey) notBefore(attempt.startedAt, journey.startedAt, `${path}.attempts.startedAt`);
    if (attempt.status === "restarted") {
      const violation = journey.violations.find((entry) => entry.id === attempt.restartViolationId);
      ensure(violation?.attemptId === attempt.id, path, "has an inconsistent restart violation reference");
    }
  }
  if ("currentAttempt" in journey) {
    for (const past of journey.pastAttempts) {
      const endedAt = past.status === "completed" ? past.completedAt : past.endedAt;
      notBefore(journey.currentAttempt.startedAt, endedAt, `${path}.currentAttempt.startedAt`);
    }
  }
  for (const violation of journey.violations) {
    const attempt = attempts.find((entry) => entry.id === violation.attemptId);
    ensure(attempt !== undefined, path, "has a violation referencing an unknown attempt");
    within(violation.occurredAt, attemptPeriod(attempt), `${path}.violations.occurredAt`);
  }
}

function attemptPeriod(attempt: ResetAttempt): { startedAt: string; endedAt?: string } {
  return attempt.status === "active" ? { startedAt: attempt.startedAt } : {
    startedAt: attempt.startedAt,
    endedAt: attempt.status === "completed" ? attempt.completedAt : attempt.endedAt
  };
}

function normalizeBaseline(value: unknown, path: string): ResetBaseline {
  const record = object(value, path);
  const selfReport = object(record.selfReport, `${path}.selfReport`);
  return {
    id: identityString(record.id, `${path}.id`),
    capturedAt: timestamp(record.capturedAt, `${path}.capturedAt`),
    ...optionalField(record, "averageIntervalSeconds", path, (entry, entryPath) => finiteNumber(entry, entryPath, 0)),
    ...optionalField(record, "averageErectionQuality", path, (entry, entryPath) => finiteNumber(entry, entryPath, 1, 10)),
    ...optionalField(record, "explicitContentSessionRatio", path, (entry, entryPath) => finiteNumber(entry, entryPath, 0, 1)),
    selfReport: {
      urgeIntensity: choice(selfReport.urgeIntensity, ["low", "medium", "high", "notSure", "preferNotToSay"], `${path}.selfReport.urgeIntensity`),
      abilityToPause: choice(selfReport.abilityToPause, ["difficult", "sometimesPossible", "manageable", "notSure", "preferNotToSay"], `${path}.selfReport.abilityToPause`),
      spontaneousOrMorningErections: choice(selfReport.spontaneousOrMorningErections,
        ["often", "sometimes", "rarely", "notSure", "preferNotToSay"], `${path}.selfReport.spontaneousOrMorningErections`)
    }
  };
}

function normalizeAssessment(value: unknown, path: string): PostResetAssessment {
  const record = object(value, path);
  return {
    id: identityString(record.id, `${path}.id`),
    resetJourneyId: identityString(record.resetJourneyId, `${path}.resetJourneyId`),
    resetAttemptId: identityString(record.resetAttemptId, `${path}.resetAttemptId`),
    baselineId: identityString(record.baselineId, `${path}.baselineId`),
    completedAt: timestamp(record.completedAt, `${path}.completedAt`),
    urgeIntensityChange: choice(record.urgeIntensityChange, ["decreased", "same", "increased", "notSure", "preferNotToSay"], `${path}.urgeIntensityChange`),
    abilityToPauseChange: choice(record.abilityToPauseChange, ["harder", "same", "easier", "notSure", "preferNotToSay"], `${path}.abilityToPauseChange`),
    spontaneousErectionChange: choice(record.spontaneousErectionChange, ["lessFrequent", "same", "moreFrequent", "notSure", "preferNotToSay"], `${path}.spontaneousErectionChange`),
    overallSexualResponseChange: choice(record.overallSexualResponseChange, ["worse", "same", "better", "notSure", "preferNotToSay"], `${path}.overallSexualResponseChange`),
    readinessToRestartTracking: choice(record.readinessToRestartTracking, ["ready", "notReady", "notSure"], `${path}.readinessToRestartTracking`)
  };
}

export function normalizeUrgeControl(value: unknown): UrgeControlState {
  const path = "state.urgeControl";
  const record = object(value, path);
  const records = list(record.records, `${path}.records`, (entry, entryPath) => {
    const event = normalizeUrgeEvent(entry, entryPath);
    ensure(event.status === "completed", entryPath, "must contain a completed event");
    return event;
  });
  const activeEvent = record.activeEvent === null ? null : normalizeUrgeEvent(record.activeEvent, `${path}.activeEvent`);
  ensure(activeEvent?.status !== "completed", path, "requires an active event in activeEvent");
  uniqueIds([...records, ...(activeEvent === null ? [] : [activeEvent])], path);
  return { activeEvent, records };
}

function normalizeUrgeEvent(value: unknown, path: string): UrgeControlEvent {
  const record = object(value, path);
  const status = choice(record.status, ["active", "completed"], `${path}.status`);
  const progress = {
    id: identityString(record.id, `${path}.id`),
    startedAt: timestamp(record.startedAt, `${path}.startedAt`),
    ...optionalField(record, "interruptCompletedAt", path, timestamp),
    ...optionalField(record, "phoneAwayStartedAt", path, timestamp),
    ...optionalField(record, "phoneAwayEndedAt", path, timestamp),
    ...optionalField(record, "secondLineAction", path, (entry, entryPath) => choice(entry, secondLineActions, entryPath))
  };
  for (const time of [progress.interruptCompletedAt, progress.phoneAwayStartedAt, progress.phoneAwayEndedAt]) {
    if (time !== undefined) notBefore(time, progress.startedAt, path);
  }
  if (progress.interruptCompletedAt !== undefined && progress.phoneAwayStartedAt !== undefined) {
    notBefore(progress.phoneAwayStartedAt, progress.interruptCompletedAt, `${path}.phoneAwayStartedAt`);
  }
  if (progress.phoneAwayEndedAt !== undefined) {
    ensure(progress.phoneAwayStartedAt !== undefined, path, "requires the phone-away start before its end");
    notBefore(progress.phoneAwayEndedAt, progress.phoneAwayStartedAt, `${path}.phoneAwayEndedAt`);
  }
  if (status === "active") {
    absent(record, ["completedAt"], path);
    return {
      ...progress, status,
      ...optionalField(record, "selectedTechnique", path, (entry, entryPath) => choice(entry, techniques, entryPath)),
      ...optionalField(record, "outcome", path, (entry, entryPath) => choice(entry, outcomes, entryPath)),
      ...optionalField(record, "trigger", path, (entry, entryPath) => choice(entry, triggers, entryPath))
    };
  }
  const completedAt = timestamp(record.completedAt, `${path}.completedAt`);
  for (const time of [progress.startedAt, progress.interruptCompletedAt, progress.phoneAwayStartedAt, progress.phoneAwayEndedAt]) {
    if (time !== undefined) notBefore(completedAt, time, `${path}.completedAt`);
  }
  return {
    ...progress, status, completedAt,
    selectedTechnique: choice(record.selectedTechnique, techniques, `${path}.selectedTechnique`),
    outcome: choice(record.outcome, outcomes, `${path}.outcome`),
    trigger: choice(record.trigger, triggers, `${path}.trigger`)
  };
}

function normalizeSource(value: unknown, path: string): BehaviorEventSource {
  const record = object(value, path);
  const kind = choice(record.kind, ["manual", "masturbationSession"], `${path}.kind`);
  if (kind === "manual") {
    absent(record, ["sessionId"], path);
    return { kind, logActionId: identityString(record.logActionId, `${path}.logActionId`) };
  }
  absent(record, ["logActionId"], path);
  return { kind, sessionId: identityString(record.sessionId, `${path}.sessionId`) };
}

function object(value: unknown, path: string): Record<string, unknown> {
  ensure(typeof value === "object" && value !== null && !Array.isArray(value), path, "must be an object");
  return value as Record<string, unknown>;
}

function list<T>(value: unknown, path: string, normalize: (entry: unknown, entryPath: string) => T): T[] {
  ensure(Array.isArray(value), path, "must be an array");
  return Array.from(value, (entry, index) => normalize(entry, `${path}[${index}]`));
}

function identityString(value: unknown, path: string): string {
  ensure(typeof value === "string" && value.trim().length > 0, path, "must be a nonempty identity");
  return value;
}

function timestamp(value: unknown, path: string): string {
  ensure(isValidBloomIsoTimestamp(value), path, "must be a valid ISO timestamp");
  return value;
}

function boolean(value: unknown, path: string): boolean {
  ensure(typeof value === "boolean", path, "must be a boolean");
  return value;
}

function finiteNumber(value: unknown, path: string, minimum: number, maximum = Number.MAX_VALUE): number {
  ensure(typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum,
    path, "must be a finite number in range");
  return value;
}

function nonnegativeInteger(value: unknown, path: string): number {
  const result = finiteNumber(value, path, 0);
  ensure(Number.isInteger(result), path, "must be an integer");
  return result;
}

function choice<const T extends readonly (string | number)[]>(value: unknown, values: T, path: string): T[number] {
  ensure(values.some((candidate) => candidate === value), path, "has an unsupported value");
  return value as T[number];
}

function erectionQuality(value: unknown, path: string) {
  return choice(value, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], path);
}

function endingReason(value: unknown, path: string) {
  return choice(value, endingReasons, path);
}

function optionalField<K extends string, T>(record: Record<string, unknown>, key: K, path: string,
  normalize: (value: unknown, valuePath: string) => T): Partial<Record<K, T>> {
  return record[key] === undefined ? {} : { [key]: normalize(record[key], `${path}.${key}`) } as Record<K, T>;
}

function absent(record: Record<string, unknown>, keys: readonly string[], path: string) {
  for (const key of keys) {
    ensure(!Object.prototype.hasOwnProperty.call(record, key), `${path}.${key}`, "does not belong to this lifecycle state");
  }
}

function notBefore(later: string, earlier: string, path: string) {
  ensure(Date.parse(later) >= Date.parse(earlier), path, "has inconsistent timestamp ordering");
}

function within(time: string, period: { startedAt: string; endedAt?: string }, path: string) {
  notBefore(time, period.startedAt, path);
  if (period.endedAt !== undefined) notBefore(period.endedAt, time, path);
}

function nonOverlapping(periods: readonly { startedAt: string; endedAt?: string }[], path: string) {
  const sorted = [...periods].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    ensure(previous.endedAt !== undefined, path, "has an unfinished interval before another interval");
    notBefore(current.startedAt, previous.endedAt, path);
  }
}

function uniqueIds(records: readonly { id: string }[], path: string) {
  ensure(new Set(records.map((entry) => entry.id)).size === records.length, path, "has duplicate identities");
}

function uniqueSources(records: readonly { source: BehaviorEventSource }[], path: string) {
  const keys = records.map(({ source }) => JSON.stringify([
    source.kind, source.kind === "manual" ? source.logActionId : source.sessionId
  ]));
  ensure(new Set(keys).size === keys.length, path, "has duplicate behavioral event sources");
}

function ensure(condition: unknown, path: string, message: string): asserts condition {
  if (!condition) throw new Error(`${path} ${message}.`);
}
