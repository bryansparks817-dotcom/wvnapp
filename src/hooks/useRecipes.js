import { useEffect, useState } from "react";
import { loadRecipes, saveRecipes, loadSeededIds, loadLibraryState, saveLibraryState, KEYS } from "../lib/storage";
import { onRemoteChange } from "../lib/sync";
import { PENDING_PREFIX } from "../lib/recipeSheetImport";
import { mergeLibrary, isLibraryRecipe, confirmDrafts, carryOverDetails } from "../lib/recipeLibrary";
import builtInV1 from "../data/builtInRecipesV1.json";

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function generateId(name, existingIds) {
  const base = slugify(name) || "recipe";
  let id = base;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

// Before the recipe library, this phone tracked which built-in recipes it had
// been given. One it was given but no longer has was deleted by the chef, so
// it goes on the shared "removed" list and the library leaves it out.
function carryOverOldDeletes(stored) {
  const given = loadSeededIds();
  if (!Array.isArray(given) || !Array.isArray(stored)) return;
  const have = new Set(stored.map((r) => r.id));
  const deleted = builtInV1.map((r) => r.id).filter((id) => given.includes(id) && !have.has(id));
  if (!deleted.length) return;
  const state = loadLibraryState();
  const removed = [...new Set([...(state.removed ?? []), ...deleted])];
  if (removed.length !== (state.removed ?? []).length) saveLibraryState({ ...state, removed });
}

// The saved recipes with the recipe library merged in.
function currentRecipes() {
  return mergeLibrary(loadRecipes([]), loadLibraryState());
}

function initialRecipes() {
  carryOverOldDeletes(loadRecipes(null));
  return currentRecipes();
}

export function useRecipes() {
  const [recipes, setRecipes] = useState(initialRecipes);

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);
  // Another phone changed the recipes.
  // Another phone changed the recipes (or deleted a library recipe). Merging
  // again here also puts the library back if an older phone's list arrives.
  useEffect(
    () => onRemoteChange((keys) => { if (keys.includes(KEYS.RECIPES) || keys.includes(KEYS.LIBRARY)) setRecipes(currentRecipes()); }),
    [],
  );

  function addRecipe(recipe) {
    setRecipes((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const id = generateId(recipe.name, existingIds);
      return [...prev, { ...recipe, id }];
    });
  }

  // Keeps what the recipe form doesn't edit (stations, yield, plating, prep
  // notes, light-blue flags) from the saved recipe.
  function updateRecipe(id, recipe) {
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...carryOverDetails(r, recipe), id } : r)));
  }

  // The chef has checked everything Claude drafted on this recipe.
  function confirmRecipe(id) {
    setRecipes((prev) => prev.map((r) => (r.id === id ? confirmDrafts(r) : r)));
  }

  function deleteRecipe(id) {
    if (isLibraryRecipe(id)) {
      const state = loadLibraryState();
      saveLibraryState({ ...state, removed: [...new Set([...(state.removed ?? []), id])] });
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  // Adds recipes from an imported recipe sheet. A recipe whose name matches an
  // existing one replaces it (keeping its id, so other recipes that use it as
  // a sub-recipe still point at it); anything else is added. Sub-recipe
  // references to recipes from the same import are resolved to their new ids.
  function importRecipes(incoming) {
    setRecipes((prev) => {
      const next = [...prev];
      const existingIds = new Set(prev.map((r) => r.id));
      const idByName = new Map();
      const placed = [];
      for (const recipe of incoming) {
        const index = next.findIndex((r) => r.name.toLowerCase() === recipe.name.toLowerCase());
        const id = index === -1 ? generateId(recipe.name, existingIds) : next[index].id;
        existingIds.add(id);
        idByName.set(recipe.name.toLowerCase(), id);
        placed.push({ index, recipe: { ...recipe, id } });
      }
      for (const { index, recipe } of placed) {
        const ingredients = recipe.ingredients.map((ing) =>
          ing.subRecipeId?.startsWith(PENDING_PREFIX)
            ? { ...ing, subRecipeId: idByName.get(ing.subRecipeId.slice(PENDING_PREFIX.length)) }
            : ing,
        );
        const resolved = { ...recipe, ingredients };
        if (index === -1) next.push(resolved);
        else next[index] = resolved;
      }
      return next;
    });
  }

  return { recipes, addRecipe, updateRecipe, confirmRecipe, deleteRecipe, importRecipes };
}
