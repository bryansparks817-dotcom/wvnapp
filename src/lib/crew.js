// Crew board: where each cook is on their prep list compared to the plan.
//
// The clock starts when the cook taps FINISH on the gather list and gets the
// prep list (shift.gatherDoneAt). Each prep step has a planned start (`at`,
// in minutes from then) and hands-on time. A step that should be finished by
// now but isn't makes the cook late by that much.
//   green  = on or ahead of schedule
//   yellow = behind, but within the chef's margin
//   red    = behind by more than the margin

export function stepIsDone(step, shift) {
  if (step.item && shift.done?.[`p:${step.item.id}`]) return true;
  return step.parts.every((p) => shift.stepsDone?.[p]);
}

export function crewStatus(shift, plan, now, marginMin) {
  const steps = plan.steps.filter((s) => s.kind !== "wait");
  const doneSteps = steps.filter((s) => stepIsDone(s, shift)).length;
  const base = { doneSteps, totalSteps: steps.length, behindMin: 0, startedAt: shift.gatherDoneAt ?? null, finishAt: null };
  if (steps.length === 0) return { ...base, state: "done" };
  if (doneSteps === steps.length) return { ...base, state: "done" };
  if (!shift.gatherDone || !shift.gatherDoneAt) return { ...base, state: "gathering" };

  const elapsed = (now - shift.gatherDoneAt) / 60000;
  const next = steps.find((s) => !stepIsDone(s, shift));
  const dueBy = (next.at ?? 0) + next.handsOn;
  const behindMin = Math.max(0, Math.round(elapsed - dueBy));
  // Finish = planned finish pushed back by however late they are now.
  const finishAt = shift.gatherDoneAt + (plan.totalMinutes + behindMin) * 60000;
  const state = behindMin <= 0 ? "green" : behindMin <= marginMin ? "yellow" : "red";
  return { ...base, state, behindMin, finishAt };
}

// "lunch" before 3 PM, otherwise "dinner".
export function currentServiceShift(d = new Date()) {
  return d.getHours() < 15 ? "lunch" : "dinner";
}

// Today at "HH:MM", as ms.
export function todayAt(hhmm, d = new Date()) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = new Date(d);
  t.setHours(h, m, 0, 0);
  return t.getTime();
}
