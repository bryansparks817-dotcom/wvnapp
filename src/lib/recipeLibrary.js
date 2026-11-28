// Wandering Vine's recipe library: every recipe from Bryan's cleaned recipe
// sheets (src/data/recipeLibrary.json, built by scripts/recipe-library/).
//
// Each phone merges the library into the shared recipe list whenever the list
// loads or another phone changes it, so the recipes reach every phone with no
// database step. The merge is safe to repeat:
//   - a library recipe that isn't in the list is added, unless the chef
//     deleted it (its id is in the shared `removed` list) or a recipe with the
//     same name is already there (no duplicates);
//   - one of the five recipes built in before the library (lobster stock,
//     velouté, bolognese, mignonette, horseradish cream) is replaced by its
//     newer sheet version only if nobody has changed it in the app;
//   - a library recipe from an older library revision is refreshed the same
//     way, unless it was edited in the app.
import restaurantLibrary from "../data/recipeLibrary.json";
// The private chef & catering book (The Castle), built by
// scripts/catering-library/build.py. Each recipe has book: "catering", which
// keeps it off the restaurant's screens (see isCateringRecipe).
import cateringLibrary from "../data/cateringLibrary.json";
import builtInV1 from "../data/builtInRecipesV1.json";
import libraryIngredients from "../data/libraryIngredients.json";

// Bump when recipeLibrary.json is rebuilt and unedited copies should refresh.
export const LIBRARY_REV = 5;

const library = [...restaurantLibrary, ...cateringLibrary];

export const isCateringRecipe = (r) => r?.book === "catering";

const LIBRARY_IDS = new Set(library.map((r) => r.id));
const V1_BY_ID = new Map(builtInV1.map((r) => [r.id, r]));

export const libraryRecipes = library.map((r) => ({ ...r, libraryRev: LIBRARY_REV }));

export function isLibraryRecipe(id) {
  return LIBRARY_IDS.has(id);
}

const core = (r) => JSON.stringify({ name: r.name, isSubRecipe: Boolean(r.isSubRecipe), ingredients: r.ingredients, steps: r.steps });

function untouched(current) {
  if (current.edited) return false;
  if (current.libraryRev != null) return current.libraryRev < LIBRARY_REV;
  const v1 = V1_BY_ID.get(current.id);
  return Boolean(v1) && core(v1) === core(current);
}

// Returns the merged list, or the same array if nothing changed.
export function mergeLibrary(recipes, state) {
  const list = Array.isArray(recipes) ? recipes : [];
  const removed = new Set(state?.removed ?? []);
  const indexById = new Map(list.map((r, i) => [r.id, i]));
  const names = new Set(list.map((r) => r.name.trim().toLowerCase()));
  let next = null;
  for (const recipe of libraryRecipes) {
    if (removed.has(recipe.id)) continue;
    const i = indexById.get(recipe.id);
    if (i == null) {
      if (names.has(recipe.name.trim().toLowerCase())) continue;
      next ??= [...list];
      next.push(recipe);
      names.add(recipe.name.trim().toLowerCase());
    } else if (untouched(list[i])) {
      next ??= [...list];
      next[i] = recipe;
    }
  }
  return next ?? list;
}

// Gram conversions the library's "each" ingredients need. Only adds names the
// app doesn't have yet; never changes a value the chef set.
export function mergeLibraryIngredients(ingredients) {
  const list = Array.isArray(ingredients) ? ingredients : [];
  const have = new Set(list.map((i) => i.name.toLowerCase()));
  const missing = libraryIngredients.filter((i) => !have.has(i.name.toLowerCase()));
  return missing.length ? [...list, ...missing] : list;
}

// Does this recipe still have light-blue (unconfirmed) parts?
export function hasDrafts(recipe) {
  return Boolean(
    recipe.drafts?.length || recipe.platingDraft || recipe.ingredients?.some((i) => i.draft) || recipe.steps?.some((s) => s.draft),
  );
}

// The chef confirmed everything Claude drafted on this recipe.
export function confirmDrafts(recipe) {
  const strip = ({ draft: _d, ...rest }) => rest;
  const { drafts: _drafts, platingDraft: _p, ...rest } = recipe;
  return { ...rest, ingredients: recipe.ingredients.map(strip), steps: recipe.steps.map(strip) };
}

// An edit from the recipe form only knows name / qty / unit and step name /
// type / minutes. Keep the rest of what the sheet gave each line (prep note,
// link to a house recipe, "to taste", light-blue flag) when the line is still
// there, and the recipe's own sheet details (stations, yield, plating…).
export function carryOverDetails(previous, edited) {
  if (!previous) return edited;
  const oldIngs = new Map(previous.ingredients.filter((i) => i.name).map((i) => [i.name.toLowerCase(), i]));
  const ingredients = edited.ingredients.map((ing) => {
    const old = ing.name && oldIngs.get(ing.name.toLowerCase());
    if (!old) return ing;
    const keep = {};
    for (const k of ["note", "recipeRef", "draft"]) if (old[k] != null) keep[k] = old[k];
    if (old.asNeeded && ing.qty === 0) keep.asNeeded = old.asNeeded;
    if (keep.draft && (old.qty !== ing.qty || old.unit !== ing.unit)) delete keep.draft;
    return { ...keep, ...ing };
  });
  const oldSteps = new Map(previous.steps.map((s) => [s.name, s]));
  const steps = edited.steps.map((s) => {
    const old = oldSteps.get(s.name);
    return old?.draft && old.type === s.type && old.duration_minutes === s.duration_minutes ? { ...s, draft: true } : s;
  });
  return { ...previous, ...edited, ingredients, steps };
}
