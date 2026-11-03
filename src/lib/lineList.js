// Orders the shift's Prep list (see inventory.js for how it's built).
// Prep is ordered by the existing scheduler: the longest remaining recipe
// starts first and its passive time (simmer, braise, chill) is filled with
// active steps from the other recipes.
import { buildTracks } from "./recipeComposition";
import { buildTimeline } from "./scheduler";

// Builds the ordered prep plan. Returns blocks of hands-on work in order,
// each tagged with whatever passive step is running in the background while
// you do it, plus items with no recipe times yet.
export function buildPrepPlan(prepItems, recipesById) {
  const timed = prepItems.filter((i) => i.recipeId && recipesById.has(i.recipeId));
  const untimed = prepItems.filter((i) => !i.recipeId || !recipesById.has(i.recipeId));
  if (timed.length === 0) return { blocks: [], untimed, totalMinutes: 0 };

  const recipes = timed.map((i) => recipesById.get(i.recipeId));
  const timeline = buildTimeline(buildTracks(recipes, recipesById));
  const itemByRecipe = new Map(timed.map((i) => [i.recipeId, i]));
  const baseId = (trackId) => trackId.split("::")[0];

  // Merge consecutive hands-on steps of the same recipe into one block.
  const blocks = [];
  for (const row of timeline.chefTimeline) {
    const last = blocks[blocks.length - 1];
    if (last && last.trackId === row.recipeId && last.end === row.start) {
      last.end = row.end;
      last.steps.push(row.stepName);
    } else {
      blocks.push({
        trackId: row.recipeId,
        recipeId: baseId(row.recipeId),
        name: row.recipeName,
        start: row.start,
        end: row.end,
        steps: [row.stepName],
      });
    }
  }

  const passives = timeline.passiveLanes.lanes;
  const seen = new Set();
  for (const block of blocks) {
    const running = passives.find(
      (p) => p.recipeId !== block.trackId && p.start <= block.start && p.end > block.start
    );
    block.during = running ? { name: running.recipeName, step: running.stepName } : null;
    const item = itemByRecipe.get(block.recipeId);
    block.item = item ?? null;
    block.firstForRecipe = !seen.has(block.trackId);
    seen.add(block.trackId);
    // Passive time this block kicks off (e.g. the simmer after you set the pot up).
    const next = passives.find((p) => p.recipeId === block.trackId && p.start === block.end);
    block.thenPassive = next ? { step: next.stepName, minutes: next.end - next.start } : null;
  }

  return { blocks, untimed, totalMinutes: timeline.totalOptimizedMinutes };
}
