import { strict as assert } from "node:assert";
import { calendarDays, getContentActivity, getContentStreakHistory, getTrackingHistory } from "../src/features/home/history/activityHistory";
import { completeElapsedResetPeriodState, createDefaultBloomState } from "../src/storage/bloomState";
import { activateContentFreeState, recordManualContentFreeViolationState, undoManualContentFreeViolationState, deactivateContentFreeState, decideResetContentFreeContinuationState } from "../src/storage/bloomContentFreeTransitions";
import { createResetContinuityFixture } from "./fixtures/resetContinuity";
import { advanceContentHistoryClock, getContentHistoryClockFacts, getContentHistoryClockKey, getContentHistoryClockSnapshot } from "../src/features/home/history/contentHistoryClock";

// Exercise production transitions and pure presentation selectors. No device writes.
const start = "2026-10-01T09:00:00.000Z", violationAt = "2026-10-03T09:00:00.000Z", at = "2026-10-05T09:00:00.000Z";
let state = createDefaultBloomState();
assert(getContentActivity(state.contentFree, at).every(d => d.status === "untracked"));
assert.equal(getContentStreakHistory(state.contentFree, at).length, 0);
assert.equal(getTrackingHistory(state.masturbationTracking, at).sessions.length, 0);
state = activateContentFreeState(state, { activationId: "a1", activatedAt: start });
state = recordManualContentFreeViolationState(state, { violationId: "v1", logActionId: "l1", occurredAt: violationAt, recordedAt: violationAt });
const snapshot = JSON.stringify(state);
let rows = getContentStreakHistory(state.contentFree, at);
assert.equal(rows.length, 2);
assert.equal(rows[0]!.seconds, 2 * 86400);
assert.equal(rows[1]!.endReason, "violation");
assert.equal(rows[1]!.seconds, 2 * 86400);
assert.equal(getContentActivity(state.contentFree, at).filter(d => d.status === "violation").length, 1);
assert.equal(JSON.stringify(state), snapshot, "Selectors never mutate state");
state = undoManualContentFreeViolationState(state, { violationId: state.contentFree.violations[0]!.id, undoneAt: at });
rows = getContentStreakHistory(state.contentFree, at);
assert.equal(rows.length, 1);
assert.equal(rows[0]!.seconds, 4 * 86400);
assert.equal(getContentActivity(state.contentFree, at).filter(d => d.status === "violation").length, 0);
state = deactivateContentFreeState(state, { endedAt: at });
assert.equal(getContentStreakHistory(state.contentFree, at)[0]!.endReason, "stopped");
state = activateContentFreeState(state, { activationId: "a2", activatedAt: "2026-10-07T09:00:00.000Z" });
rows = getContentStreakHistory(state.contentFree, "2026-10-08T09:00:00.000Z");
assert.equal(rows.length, 2);
assert.equal(rows[0]!.seconds, 86400, "Stopped gap must not join streaks");
assert.equal(getContentActivity(state.contentFree, "2026-10-08T09:00:00.000Z").find(d => d.key.endsWith("10-06"))!.status, "untracked");
const fixture = createResetContinuityFixture();
fixture.observeDays(9);
const credited = activateContentFreeState(fixture.state, { activationId: "credit", activatedAt: fixture.now().toISOString() });
assert.equal(getContentStreakHistory(credited.contentFree, fixture.now().toISOString())[0]!.seconds, 9 * 86400);
assert(getContentActivity(credited.contentFree, fixture.now().toISOString()).some(d => d.trackedSeconds > 0), "Earned credit uses actual Reset dates");
// Accept earned Reset time after a gap; no gap day may be painted as tracked.
const lateFixture = createResetContinuityFixture();
const completed = completeElapsedResetPeriodState(lateFixture.state, { observedAt: lateFixture.observeDays(15) });
const late = decideResetContentFreeContinuationState(completed, { decision: "accepted", decidedAt: lateFixture.observeDays(20), activationId: "late" });
assert.equal(getContentStreakHistory(late.contentFree, lateFixture.now().toISOString())[0]!.seconds, 15 * 86400);
const lateDays = getContentActivity(late.contentFree, lateFixture.now().toISOString());
assert(lateDays.filter(d => d.key >= "2026-10-17" && d.key <= "2026-10-20").every(d => d.status === "untracked"));
assert.equal(getContentStreakHistory(state.contentFree, "2026-09-30T12:00:00.000Z").length, 0, "Clock before facts cannot fabricate a stopped date");
// Half-open calendar boundaries: an event at local midnight belongs to the next day.
process.env.TZ = "Europe/Istanbul";
const boundaryState = createDefaultBloomState();
boundaryState.masturbationTracking.sessions = [1, 2, 3].map(n => ({ status: "completed", id: `s${n}`, startedAt: `2026-10-0${n}T20:59:00.000Z`, endedAt: `2026-10-0${n}T21:00:00.000Z`, durationSeconds: 60, pauses: [], erectionQuality: n === 2 ? 8 : 4, usedExplicitContent: false, endingReason: "stoppedByChoice" }));
boundaryState.masturbationTracking.currentSession = { status: "awaiting_feedback", id: "pending", startedAt: start, endedAt: violationAt, durationSeconds: 172800, pauses: [] };
const history = getTrackingHistory(boundaryState.masturbationTracking, at);
assert.equal(history.sessions.length, 3);
assert.equal(history.days.find(d => d.key === "2026-10-01")!.count, 0);
assert.equal(history.days.find(d => d.key === "2026-10-02")!.count, 1);
assert.equal(history.incomplete?.status, "awaiting_feedback");
assert.equal(getTrackingHistory(boundaryState.masturbationTracking, "2026-10-02T20:00:00.000Z").sessions.length, 1, "Future completions excluded");
process.env.TZ = "America/New_York";
const spring = calendarDays("2026-03-10T12:00:00.000Z", 7);
assert.equal(spring.find(d => d.key === "2026-03-08")!.end - spring.find(d => d.key === "2026-03-08")!.start, 23 * 3600000);
const fall = calendarDays("2026-11-03T12:00:00.000Z", 7);
assert.equal(fall.find(d => d.key === "2026-11-01")!.end - fall.find(d => d.key === "2026-11-01")!.start, 25 * 3600000);
assert.equal(new Set(spring.map(d => d.key)).size, 7);
assert.equal(getTrackingHistory(boundaryState.masturbationTracking, at).days.find(d => d.key === "2026-10-01")!.count, 1, "Timezone change regroups without timestamp writes");
const tied = { ...boundaryState.masturbationTracking, sessions: [boundaryState.masturbationTracking.sessions[0]!, { ...boundaryState.masturbationTracking.sessions[0]!, id: "second-saved" }] };
assert.equal(getTrackingHistory(tied, at).sessions[0]!.id, "second-saved", "Equal timestamps retain deterministic saved array order without locale sorting");
process.env.TZ = "Africa/Cairo";
const midnight = calendarDays("2026-04-24T12:00:00.000Z", 28);
const cairoDay = midnight.find(d => d.key === "2026-04-24")!;
assert.equal(cairoDay.end - cairoDay.start, 23 * 3600000, "Midnight DST jump is a 23-hour local day");
assert.equal(new Date(midnight.find(d => d.key === "2026-04-23")!.start).getHours(), 0, "Normalized 01:00 must not propagate to earlier days");
process.env.TZ = "Pacific/Apia";
const skipped = calendarDays("2011-12-31T12:00:00.000Z", 28);
assert.equal(new Set(skipped.map(d => d.key)).size, 28, "Skipped civil date cannot duplicate the next day's key");
const skippedDay = skipped.find(d => d.key === "2011-12-30")!;
assert.equal(skippedDay.start, skippedDay.end, "A nonexistent local day has an empty interval, never invented activity");
assert.deepEqual(calendarDays("bad", 28), []);
verifyHistoryClock();
console.log("Counter/history metrics passed: actual transitions, undo, stop/restart gaps, earned Reset dates, incomplete/future records, midnight, timezone regrouping both DST boundaries, midnight DST and skipped civil dates.");

function verifyHistoryClock() {
  const observer = (content: typeof state.contentFree) => {
    const facts = getContentHistoryClockFacts(content);
    let key: string | undefined;
    let cache: ReturnType<typeof getContentHistoryClockSnapshot>;
    let builds = 0;
    return {
      read(time: string, refresh = 0) {
        const nextKey = getContentHistoryClockKey(facts, Date.parse(time), Intl.DateTimeFormat().resolvedOptions().timeZone, refresh);
        if (nextKey !== key) { cache = getContentHistoryClockSnapshot(facts, time); key = nextKey; builds++; }
        const live = advanceContentHistoryClock(cache, time);
        assert.deepEqual(live.activity, getContentActivity(content, time), `Exact 28-day coverage at ${time}`);
        assert.deepEqual(live.week, getContentActivity(content, time, true), `Exact weekly coverage at ${time}`);
        assert.deepEqual(live.streaks, getContentStreakHistory(content, time), `Exact streak durations at ${time}`);
        return live;
      }, builds: () => builds,
    };
  };
  process.env.TZ = "Europe/Istanbul";
  const clock = observer(state.contentFree);
  const first = clock.read("2026-10-08T09:00:00.123Z");
  for (let second = 1; second <= 60; second++) {
    const live = clock.read(new Date(Date.parse("2026-10-08T09:00:00.123Z") + second * 1000).toISOString());
    assert.strictEqual(live.streaks.find(s => s.endReason === "stopped"), first.streaks.find(s => s.endReason === "stopped"), "Completed streak objects are reused");
  }
  assert.equal(clock.builds(), 1, "Sixty seconds reuse one historical snapshot");
  clock.read("2026-10-08T09:00:00.100Z"); // Same-day rollback, including fractional seconds.
  assert.equal(clock.builds(), 1);
  clock.read("2026-10-08T09:00:00.100Z", 1);
  assert.equal(clock.builds(), 2, "Focus/foreground can refresh at an identical timestamp");
  clock.read("2026-10-08T20:59:59.999Z", 1);
  clock.read("2026-10-08T21:00:00.000Z", 1);
  assert.equal(clock.builds(), 3, "Local midnight rebuilds both calendars");
  process.env.TZ = "America/New_York";
  clock.read("2026-10-08T21:00:00.000Z", 1);
  assert.equal(clock.builds(), 4, "Timezone changes rebuild without a write or new timestamp");
  for (const zone of ["Europe/Istanbul", "America/New_York", "Africa/Cairo", "Pacific/Apia"]) {
    process.env.TZ = zone;
    const events = observer(state.contentFree);
    for (const time of ["2026-09-30T09:00:00.000Z", start, "2026-10-01T09:00:00.001Z", "2026-10-01T09:00:01.000Z", at,
      "2026-10-07T08:59:59.999Z", "2026-10-07T09:00:00.000Z", "2026-10-07T09:00:00.001Z", "2026-10-07T09:00:01.000Z", start]) events.read(time);
    let violated = activateContentFreeState(createDefaultBloomState(), { activationId: "clock-v", activatedAt: start });
    violated = recordManualContentFreeViolationState(violated, { violationId: "clock-event", logActionId: "clock-log", occurredAt: violationAt, recordedAt: violationAt });
    const eventClock = observer(violated.contentFree);
    for (const time of [start, "2026-10-03T08:59:59.999Z", violationAt, "2026-10-03T09:00:00.001Z", at, start]) eventClock.read(time);
    const creditClock = observer(late.contentFree);
    creditClock.read(lateFixture.now().toISOString());
    creditClock.read(new Date(lateFixture.now().getTime() + 1123).toISOString());
  }
  for (const [zone, before, after] of [
    ["America/New_York", "2026-03-08T06:59:59.999Z", "2026-03-08T07:00:00.000Z"],
    ["America/New_York", "2026-11-01T05:59:59.999Z", "2026-11-01T06:00:00.000Z"],
    ["Africa/Cairo", "2026-04-23T21:59:59.999Z", "2026-04-23T22:00:00.000Z"],
    ["Pacific/Apia", "2011-12-30T09:59:59.999Z", "2011-12-30T10:00:00.000Z"],
  ]) {
    process.env.TZ = zone;
    const active = activateContentFreeState(createDefaultBloomState(), { activationId: "dst", activatedAt: new Date(Date.parse(before!) - 86400000).toISOString() });
    const dst = observer(active.contentFree);
    dst.read(before!); dst.read(after!);
    assert.equal(dst.builds(), 2, "DST offset or civil-date changes invalidate the snapshot");
  }
  console.log("History clock passed: one snapshot / 60 ticks, exact live calendar seconds, completed-row reuse, first-second coverage, future events, rollback, local midnight, timezone/foreground and DST refresh.");
}
