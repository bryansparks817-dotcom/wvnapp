// Put a recipe on a station, or take it off. Used by Setup → Stations,
// items & pars (BY RECIPE) and by one-time station fixes.
import { PAN_GRAMS } from "./panSize";

function uniqueId(base, taken) {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

export const hasRecipe = (st, rid) => st.items.some((i) => i.recipeId === rid || i.id === rid);
const DRAFT_FIELDS = ["pan", "panGrams", "lowboySize", "qtGrams", "lowboyPar"];

export function addRecipeTo(stations, stationId, recipe, { lineCollects = true } = {}) {
  const target = stations.find((s) => s.id === stationId);
  if (!target || hasRecipe(target, recipe.id)) return stations;
  const copy = stations.flatMap((s) => s.items).find((i) => i.recipeId === recipe.id || i.id === recipe.id);
  const maker = stations.find((s) => s.id !== stationId && s.holdsBackup && hasRecipe(s, recipe.id));
  const taken = new Set(target.items.map((i) => i.id));
  const base = copy
    ? (({ madeAt: _m, ...rest }) => rest)(copy)
    : { name: recipe.name, pan: "1/6", panGrams: PAN_GRAMS["1/6"], lowboySize: "qt", qtGrams: 950, lowboyPar: 1, shelfLifeDays: recipe.shelfLifeDays || 5 };
  const item = {
    ...base,
    id: taken.has(recipe.id) ? uniqueId(recipe.id, taken) : recipe.id,
    recipeId: recipe.id,
    unconfirmed: [...new Set([...(copy?.unconfirmed ?? []), ...DRAFT_FIELDS, ...(recipe.shelfLifeDays || copy ? [] : ["shelfLifeDays"])])],
  };
  // A line station collects from Prep when Prep already makes it; turning on
  // a Prep (backup) station makes the line stations that have it collect only.
  if (!target.holdsBackup && maker) item.madeAt = maker.id;
  return stations.map((s) => {
    if (s.id === stationId) return { ...s, items: [...s.items, item] };
    if (lineCollects && target.holdsBackup && !s.holdsBackup) {
      return { ...s, items: s.items.map((i) => ((i.recipeId === recipe.id || i.id === recipe.id) && !i.madeAt ? { ...i, madeAt: stationId } : i)) };
    }
    return s;
  });
}

export function removeRecipeFrom(stations, stationId, recipeId) {
  return stations.map((s) => {
    if (s.id === stationId) return { ...s, items: s.items.filter((i) => !(i.recipeId === recipeId || i.id === recipeId)) };
    // Nobody makes it there any more, so the line copies make it themselves again.
    return { ...s, items: s.items.map((i) => ((i.recipeId === recipeId || i.id === recipeId) && i.madeAt === stationId ? (({ madeAt: _m, ...rest }) => rest)(i) : i)) };
  });
}

