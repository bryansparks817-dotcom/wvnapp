// Single-resource ("the chef") scheduling of active/passive steps across
// tracks. A track is normally ready to start at time 0, but a track that
// depends on others (e.g. a recipe waiting on a sub-recipe component) only
// becomes ready once every track it depends on has fully finished.
export function buildTimeline(tracks) {
  const states = new Map();
  for (const t of tracks) {
    states.set(t.id, {
      id: t.id,
      name: t.name,
      steps: t.steps,
      dependsOn: t.dependsOn,
      stepIndex: 0,
      clock: null, // null until ready to start
      finished: false,
      finishTime: null,
    });
  }

  const chefTimeline = [];
  const passiveTimeline = [];

  function remainingTotal(state) {
    let total = 0;
    for (let i = state.stepIndex; i < state.steps.length; i++) {
      total += state.steps[i].duration_minutes;
    }
    return total;
  }

  function markFinishedIfDone(state) {
    if (state.stepIndex >= state.steps.length) {
      state.finished = true;
      state.finishTime = state.clock;
      activateReadyStates();
    }
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
        dependsOn: state.dependsOn,
      });
      state.clock = end;
      state.stepIndex += 1;
    }
    markFinishedIfDone(state);
  }

  function activateState(state) {
    const readyTime =
      state.dependsOn.length === 0
        ? 0
        : Math.max(...state.dependsOn.map((depId) => states.get(depId).finishTime));
    state.clock = readyTime;
    cascadePassive(state);
  }

  function activateReadyStates() {
    for (const state of states.values()) {
      if (state.clock !== null) continue;
      const ready = state.dependsOn.every((depId) => states.get(depId).finished);
      if (ready) activateState(state);
    }
  }

  activateReadyStates();

  let chefTime = 0;
  const pendingActiveStates = () =>
    Array.from(states.values()).filter((s) => s.clock !== null && s.stepIndex < s.steps.length);

  while (Array.from(states.values()).some((s) => !s.finished)) {
    const pending = pendingActiveStates();
    if (pending.length === 0) break; // nothing schedulable — a malformed dependency graph

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
      dependsOn: chosen.dependsOn,
    });

    chefTime = end;
    chosen.clock = end;
    chosen.stepIndex += 1;

    cascadePassive(chosen);
  }

  const allStates = Array.from(states.values());
  const totalOptimizedMinutes = Math.max(
    0,
    chefTime,
    ...allStates.map((s) => s.clock ?? 0),
    ...passiveTimeline.map((p) => p.end)
  );

  const totalSequentialMinutes = tracks.reduce(
    (sum, t) => sum + t.steps.reduce((s, step) => s + step.duration_minutes, 0),
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

// Anchors a 0-based timeline (from buildTimeline) to real clock time, either
// forward from a start time or backward from a target finish time. The
// schedule itself — task order, durations, total length — never changes;
// this only shifts where relative-minute 0 falls in wall-clock terms. For
// "backward", the last task is made to land exactly on anchorMinutes by
// starting the whole thing totalOptimizedMinutes earlier.
export function anchorTimeline(timeline, { direction = "forward", anchorMinutes = 0 } = {}) {
  const offset = direction === "backward" ? anchorMinutes - timeline.totalOptimizedMinutes : anchorMinutes;

  const shift = (rows) => rows.map((row) => ({ ...row, start: row.start + offset, end: row.end + offset }));

  return {
    ...timeline,
    chefTimeline: shift(timeline.chefTimeline),
    passiveLanes: { ...timeline.passiveLanes, lanes: shift(timeline.passiveLanes.lanes) },
    direction,
    anchorMinutes: offset,
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
