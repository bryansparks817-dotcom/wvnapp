// Shift history: when a cook saves the close count, the shift is boiled down
// to one record the chef's Data tab learns from (cook speed, real recipe
// times, how much got made per cover).
import { loadHistory, saveHistory } from "./storage";

const tickTimes = (steps, shift) =>
  steps.flatMap((s) => s.parts.map((p) => shift.stepsDone?.[p])).filter((t) => typeof t === "number");

// Planned minutes from the first step's start to the end of the last
// hands-on step (ticks land when hands-on work ends, so the two compare).
export function plannedSpan(steps) {
  const first = steps[0];
  const last = steps[steps.length - 1];
  return (last.at ?? 0) + last.handsOn - (first.at ?? 0);
}

export function shiftRecord({ station, shift, plan, rows, closedAt }) {
  const steps = plan.steps.filter((s) => s.kind !== "wait");
  const items = rows
    .filter((r) => (r.plannedG ?? r.makeG) > 0)
    .map((r) => {
      const own = steps.filter((s) => s.item?.id === r.id);
      const doneAt = shift.meta?.[`p:${r.id}`]?.at ?? null;
      const ticks = tickTimes(own, shift);
      const allTicked = own.length > 0 && own.every((s) => s.parts.every((p) => typeof shift.stepsDone?.[p] === "number"));
      let actualSpan = null;
      if (allTicked) {
        // first tick marks the end of the first step's hands-on time
        actualSpan = Math.round((Math.max(...ticks) - Math.min(...ticks)) / 60000 + own[0].handsOn);
      }
      return {
        id: r.id,
        name: r.name,
        recipeId: r.recipeId ?? null,
        plannedG: Math.round(r.plannedG ?? r.makeG),
        makeG: Math.round(r.makeG),
        done: Boolean(shift.done?.[`p:${r.id}`]),
        doneAt,
        extra: Boolean(r.extra),
        plannedSpan: own.length ? plannedSpan(own) : null,
        actualSpan,
        handsOn: own.reduce((n, s) => n + s.handsOn, 0),
      };
    });

  const allTicks = tickTimes(steps, shift);
  const plannedEnd = steps.length ? Math.max(...steps.map((s) => (s.at ?? 0) + s.handsOn)) : 0;
  const complete = steps.length > 0 && steps.every((s) => (s.item && shift.done?.[`p:${s.item.id}`]) || s.parts.every((p) => shift.stepsDone?.[p]));
  const endAt = complete && allTicks.length ? Math.max(...allTicks) : closedAt;
  const actualEnd = shift.gatherDoneAt ? Math.round((endAt - shift.gatherDoneAt) / 60000) : null;

  return {
    id: `${shift.date}:${station.id}:${closedAt}`,
    date: shift.date,
    stationId: station.id,
    station: station.name,
    cook: shift.confirmedBy ?? null,
    gatherDoneAt: shift.gatherDoneAt ?? null,
    closedAt,
    plannedEnd,
    actualEnd,
    // Only a finished list says how far behind the cook ran; an unfinished
    // one is counted separately.
    behindMin: actualEnd == null || !complete ? null : actualEnd - plannedEnd,
    complete,
    items,
    skipped: Object.keys(shift.skip ?? {}),
  };
}

export function recordShift(record) {
  saveHistory([...loadHistory().filter((r) => r.id !== record.id), record]);
}
