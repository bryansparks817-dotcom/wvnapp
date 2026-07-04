// Recomputes clock times forward once tasks are marked done with actual
// durations. Preserves the original schedule's ordering — which recipe's
// step the chef works on next, and each recipe's own step sequence — and
// only shifts timing: a step can't start until the chef is free (its queue
// position finished, using actual duration where logged) and its recipe is
// ready (the previous step in that recipe finished, actual or planned).
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
    state.set(recipeId, { steps, index: 0, clock: 0 });
  }

  const adjusted = new Map();

  function durationFor(row) {
    const actual = actualMinutesByKey[row.key];
    return actual !== undefined ? actual : row.end - row.start;
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
  }

  for (const s of state.values()) {
    cascadePassive(s);
  }

  const chefQueue = rows.filter((row) => row.type === "active").sort((a, b) => a.start - b.start);

  let chefTime = 0;
  for (const row of chefQueue) {
    const s = state.get(row.recipeId);
    const start = Math.max(chefTime, s.clock);
    const end = start + durationFor(row);
    adjusted.set(row.key, { start, end });
    chefTime = end;
    s.clock = end;
    s.index += 1;
    cascadePassive(s);
  }

  return adjusted;
}
