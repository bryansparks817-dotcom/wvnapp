// Recomputes clock times forward once tasks are marked done with actual
// durations. Preserves the original schedule's ordering — which recipe's
// step the chef works on next, and each recipe's own step sequence — and
// only shifts timing: a step can't start until the chef is free (its queue
// position finished, using actual duration where logged) and its recipe is
// ready — either immediately, or once every recipe it depends on (e.g. a
// sub-recipe component) has actually finished.
export function recomputeRows(rows, actualMinutesByKey) {
  const byRecipe = new Map();
  for (const row of rows) {
    if (!byRecipe.has(row.recipeId)) byRecipe.set(row.recipeId, []);
    byRecipe.get(row.recipeId).push(row);
  }
  for (const steps of byRecipe.values()) {
    steps.sort((a, b) => a.start - b.start);
  }

  const state = new Map();
  for (const [recipeId, steps] of byRecipe) {
    state.set(recipeId, {
      steps,
      index: 0,
      clock: null,
      dependsOn: steps[0]?.dependsOn ?? [],
      finished: false,
      finishTime: null,
    });
  }

  const adjusted = new Map();

  function durationFor(row) {
    const actual = actualMinutesByKey[row.key];
    return actual !== undefined ? actual : row.end - row.start;
  }

  function markFinishedIfDone(s) {
    if (s.index >= s.steps.length) {
      s.finished = true;
      s.finishTime = s.clock;
      activateReady();
    }
  }

  function cascadePassive(s) {
    while (s.index < s.steps.length && s.steps[s.index].type === "passive") {
      const row = s.steps[s.index];
      const start = s.clock;
      const end = start + durationFor(row);
      adjusted.set(row.key, { start, end });
      s.clock = end;
      s.index += 1;
    }
    markFinishedIfDone(s);
  }

  function activate(s) {
    const readyTime =
      s.dependsOn.length === 0 ? 0 : Math.max(...s.dependsOn.map((depId) => state.get(depId).finishTime));
    s.clock = readyTime;
    cascadePassive(s);
  }

  function activateReady() {
    for (const s of state.values()) {
      if (s.clock !== null) continue;
      if (s.dependsOn.every((depId) => state.get(depId).finished)) activate(s);
    }
  }

  activateReady();

  const chefQueue = rows.filter((row) => row.type === "active").sort((a, b) => a.start - b.start);

  let chefTime = 0;
  for (const row of chefQueue) {
    const s = state.get(row.recipeId);
    // s.clock is guaranteed set by here: the original schedule only ever
    // placed this active step after every track it depends on had finished,
    // so those tracks' rows already appear earlier in chefQueue.
    const start = Math.max(chefTime, s.clock ?? chefTime);
    const end = start + durationFor(row);
    adjusted.set(row.key, { start, end });
    chefTime = end;
    s.clock = end;
    s.index += 1;
    cascadePassive(s);
  }

  return adjusted;
}
