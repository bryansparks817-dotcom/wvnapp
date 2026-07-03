// Single-resource ("the chef") scheduling of active/passive steps across recipes.
export function buildTimeline(recipes) {
  const states = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    steps: r.steps,
    stepIndex: 0,
    clock: 0,
  }));

  const chefTimeline = [];
  const passiveTimeline = [];

  function remainingTotal(state) {
    let total = 0;
    for (let i = state.stepIndex; i < state.steps.length; i++) {
      total += state.steps[i].duration_minutes;
    }
    return total;
  }

  function cascadePassive(state) {
    while (
      state.stepIndex < state.steps.length &&
      state.steps[state.stepIndex].type === "passive"
    ) {
      const step = state.steps[state.stepIndex];
      const start = state.clock;
      const end = start + step.duration_minutes;
      passiveTimeline.push({
        recipeId: state.id,
        recipeName: state.name,
        stepName: step.name,
        start,
        end,
      });
      state.clock = end;
      state.stepIndex += 1;
    }
  }

  for (const state of states) {
    cascadePassive(state);
  }

  let chefTime = 0;
  const pendingStates = () => states.filter((s) => s.stepIndex < s.steps.length);

  while (pendingStates().length > 0) {
    const pending = pendingStates();
    let candidates = pending.filter((s) => s.clock <= chefTime);

    if (candidates.length === 0) {
      chefTime = Math.min(...pending.map((s) => s.clock));
      candidates = pending.filter((s) => s.clock <= chefTime);
    }

    let chosen = candidates[0];
    let chosenRemaining = remainingTotal(chosen);
    for (const candidate of candidates.slice(1)) {
      const remaining = remainingTotal(candidate);
      if (remaining > chosenRemaining) {
        chosen = candidate;
        chosenRemaining = remaining;
      }
    }

    const step = chosen.steps[chosen.stepIndex];
    const start = chefTime;
    const end = start + step.duration_minutes;
    chefTimeline.push({
      recipeId: chosen.id,
      recipeName: chosen.name,
      stepName: step.name,
      start,
      end,
    });

    chefTime = end;
    chosen.clock = end;
    chosen.stepIndex += 1;

    cascadePassive(chosen);
  }

  const totalOptimizedMinutes = Math.max(
    0,
    chefTime,
    ...states.map((s) => s.clock),
    ...passiveTimeline.map((p) => p.end)
  );

  const totalSequentialMinutes = recipes.reduce(
    (sum, r) => sum + r.steps.reduce((s, step) => s + step.duration_minutes, 0),
    0
  );

  const passiveLanes = assignLanes(passiveTimeline);

  return {
    chefTimeline,
    passiveLanes,
    totalOptimizedMinutes,
    totalSequentialMinutes,
  };
}

// Greedy interval-graph lane assignment so overlapping passive blocks render on separate rows.
function assignLanes(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const laneEnds = [];
  const withLanes = [];

  for (const interval of sorted) {
    let laneIndex = laneEnds.findIndex((end) => end <= interval.start);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(interval.end);
    } else {
      laneEnds[laneIndex] = interval.end;
    }
    withLanes.push({ ...interval, lane: laneIndex });
  }

  return { lanes: withLanes, laneCount: Math.max(1, laneEnds.length) };
}
