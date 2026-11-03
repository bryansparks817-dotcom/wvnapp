// Turns a line count into the two lists a line cook works from.
//
// Counts are taken in 25% steps of the pan each item lives in (a ninth pan
// half full = 50%). Par is a full pan for now; chef screens will set it.
// Each item that is under par is then either:
//   COLLECT — more is already made in the lowboy or walk-in; restock from there.
//   PREP    — nothing in the back; make it from scratch.
// Prep is ordered by the existing scheduler: the longest remaining recipe
// starts first and its passive time (simmer, braise, chill) is filled with
// active steps from the other recipes.
import { buildTracks } from "./recipeComposition";
import { buildTimeline } from "./scheduler";

export const LEVELS = [0, 25, 50, 75, 100];
export const BACK_OPTIONS = [
  { id: "none", label: "None" },
  { id: "lowboy", label: "Lowboy" },
  { id: "walk-in", label: "Walk-in" },
];
export const PAR = 100;

export function isCounted(entry) {
  if (!entry || entry.level == null) return false;
  return entry.level >= PAR || entry.back != null;
}

export function needOf(entry) {
  return Math.max(0, PAR - (entry?.level ?? 0));
}

export function splitCount(items, entries) {
  const collect = [];
  const prep = [];
  for (const item of items) {
    const entry = entries[item.id];
    if (!isCounted(entry) || needOf(entry) === 0) continue;
    const row = { ...item, level: entry.level, need: needOf(entry), back: entry.back };
    if (entry.back === "none") prep.push(row);
    else collect.push(row);
  }
  return { collect, prep };
}

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
