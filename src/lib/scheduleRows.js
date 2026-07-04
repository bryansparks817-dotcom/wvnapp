// Merges the scheduler's chef (active) timeline and passive lanes into a single
// chronological list, sorted by start time. Purely a display-layer concern —
// does not touch the underlying scheduling logic in scheduler.js.
export function buildScheduleRows({ chefTimeline, passiveLanes }) {
  const activeRows = chefTimeline.map((block) => ({ ...block, type: "active" }));
  const passiveRows = passiveLanes.lanes.map((block) => ({ ...block, type: "passive" }));

  return [...activeRows, ...passiveRows]
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((row) => ({
      ...row,
      key: `${row.recipeId}::${row.stepName}::${row.start}`,
    }));
}
