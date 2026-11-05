// Turns the shift's Prep items into one plain, numbered step list for the
// line cook. The order comes from the existing scheduler, which follows the
// optimization rule: start the recipe with the most time left (usually the
// one with the longest hands-off stretch) first, then fill its braise, simmer
// or chill time with hands-on work from the other recipes.
import { buildTracks } from "./recipeComposition";
import { buildTimeline } from "./scheduler";

const baseId = (trackId) => trackId.split("::")[0];

// Which prep item each scheduler track belongs to. A sub-recipe track (stock
// made for a sauce) belongs to the item that needs it.
function ownersByTrack(tracks, itemByRecipe) {
  const dependedOn = new Set(tracks.flatMap((t) => t.dependsOn));
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const owner = new Map();
  function claim(trackId, item) {
    if (owner.has(trackId)) return;
    owner.set(trackId, item);
    for (const dep of byId.get(trackId)?.dependsOn ?? []) claim(dep, item);
  }
  for (const t of tracks) {
    const item = itemByRecipe.get(baseId(t.id));
    if (item && !dependedOn.has(t.id)) claim(t.id, item);
  }
  for (const t of tracks) if (!owner.has(t.id)) owner.set(t.id, itemByRecipe.get(baseId(t.id)) ?? null);
  return owner;
}

// Returns { steps, untimed, totalMinutes }.
// A step is one thing the cook does next:
//   kind "start" | "fill" | "back" | "next": hands-on work (or kicking off a
//     hands-off step), with what to do, how long, and the hands-off time it
//     starts (with a timer).
//   kind "wait": nothing hands-on is free; something is still cooking.
// opts.first: a prep item id the chef wants done first. Its recipe (and any
// sub-recipe it needs) is scheduled ahead of the longest-remaining rule.
//
// Each step lists the recipe steps it covers in `parts` ("track#index").
// Ticks are saved per part, so they survive the list being re-ordered.
export function buildPrepSteps(prepItems, recipesById, { first = null } = {}) {
  const timed = prepItems.filter((i) => i.recipeId && recipesById.has(i.recipeId));
  const untimed = prepItems.filter((i) => !i.recipeId || !recipesById.has(i.recipeId));
  if (timed.length === 0) return { steps: [], untimed, totalMinutes: 0 };

  const recipes = timed.map((i) => recipesById.get(i.recipeId));
  const tracks = buildTracks(recipes, recipesById);
  const itemByRecipe = new Map(timed.map((i) => [i.recipeId, i]));
  const owner = ownersByTrack(tracks, itemByRecipe);
  const timeline = buildTimeline(first ? tracks.map((t) => ({ ...t, priority: owner.get(t.id)?.id === first })) : tracks);
  const passives = [...timeline.passiveLanes.lanes].sort((a, b) => a.start - b.start);

  // The run of hands-off steps a track goes into at a given minute.
  function handsOffFrom(trackId, at) {
    const out = [];
    let t = at;
    for (;;) {
      const p = passives.find((x) => x.recipeId === trackId && x.start === t);
      if (!p) return out;
      out.push({ step: p.stepName, minutes: p.end - p.start });
      t = p.end;
    }
  }

  // Hands-on work, with back-to-back steps of one recipe merged.
  const events = [];
  for (const row of timeline.chefTimeline) {
    const last = events[events.length - 1];
    if (last && !last.kickoff && last.trackId === row.recipeId && last.end === row.start) {
      last.end = row.end;
      last.actions.push(row.stepName);
      last.parts.push(`${row.recipeId}#${row.stepIndex}`);
    } else {
      events.push({ trackId: row.recipeId, name: row.recipeName, start: row.start, end: row.end, actions: [row.stepName], parts: [`${row.recipeId}#${row.stepIndex}`] });
    }
  }
  // Recipes that open with a hands-off step (preheat, soak) still need the
  // cook to start them, so they get their own step.
  const handsOnEnds = new Set(timeline.chefTimeline.map((r) => `${r.recipeId}@${r.end}`));
  for (const p of passives) {
    const followsWork = handsOnEnds.has(`${p.recipeId}@${p.start}`);
    const followsPassive = passives.some((q) => q.recipeId === p.recipeId && q.end === p.start);
    if (!followsWork && !followsPassive) {
      events.push({ trackId: p.recipeId, name: p.recipeName, start: p.start, end: p.start, actions: [], kickoff: true, parts: [`${p.recipeId}#${p.stepIndex}`] });
    }
  }
  events.sort((a, b) => a.start - b.start || (a.kickoff ? -1 : 0) - (b.kickoff ? -1 : 0));

  const steps = [];
  const seen = new Set();
  let busyUntil = 0;
  for (const ev of events) {
    if (ev.start > busyUntil) {
      const cooking = passives.find((p) => p.end === ev.start) ?? passives.find((p) => p.start < ev.start && p.end >= ev.start);
      steps.push({
        kind: "wait",
        key: `wait@${busyUntil}`,
        at: busyUntil,
        minutes: ev.start - busyUntil,
        on: cooking ? { name: cooking.recipeName, step: cooking.stepName } : null,
      });
    }
    const during = passives.find((p) => p.recipeId !== ev.trackId && p.start <= ev.start && p.end > ev.start);
    const kind = seen.has(ev.trackId) ? "back" : steps.length === 0 ? "start" : during ? "fill" : "next";
    steps.push({
      kind,
      key: ev.parts.join("+"),
      parts: ev.parts,
      // Planned start, in minutes from when the cook gets the prep list.
      at: ev.start,
      name: ev.name,
      item: owner.get(ev.trackId) ?? null,
      firstForItem: false,
      actions: ev.actions,
      handsOn: ev.end - ev.start,
      handsOff: handsOffFrom(ev.trackId, ev.end),
      during: during ? { name: during.recipeName, step: during.stepName } : null,
    });
    seen.add(ev.trackId);
    busyUntil = Math.max(busyUntil, ev.end);
  }

  // First and last step of each item: the first shows how much to make, the
  // last is where the item gets checked off (inventory + label).
  const firsts = new Set();
  const lastIndex = new Map();
  steps.forEach((s, i) => {
    if (!s.item) return;
    if (!firsts.has(s.item.id)) {
      firsts.add(s.item.id);
      s.firstForItem = true;
    }
    lastIndex.set(s.item.id, i);
  });
  for (const i of lastIndex.values()) steps[i].lastForItem = true;

  return { steps, untimed, totalMinutes: timeline.totalOptimizedMinutes };
}
