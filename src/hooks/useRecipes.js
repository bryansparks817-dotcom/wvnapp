import { useEffect, useState } from "react";
import baseRecipes from "../data/sampleRecipes.json";
import made from "../data/sampleStations.json";
import { loadRecipes, saveRecipes, loadSeededIds, saveSeededIds, KEYS } from "../lib/storage";
import { onRemoteChange } from "../lib/sync";
import { PENDING_PREFIX } from "../lib/recipeSheetImport";

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

const seedRecipes = [...baseRecipes, ...made.recipes];

// Saved recipes, plus any built-in recipe this browser hasn't been given yet
// (e.g. the made-up Grill, Sauté, Pastry and Prep recipes).
function initialRecipes() {
  const stored = loadRecipes(null);
  const seeded = loadSeededIds();
  saveSeededIds(seedRecipes.map((r) => r.id));
  if (!stored) return seedRecipes;
  const given = new Set(seeded ?? baseRecipes.map((r) => r.id));
  const have = new Set(stored.map((r) => r.id));
  return [...stored, ...seedRecipes.filter((r) => !given.has(r.id) && !have.has(r.id))];
}

export function useRecipes() {
  const [recipes, setRecipes] = useState(initialRecipes);

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);
  // Another phone changed the recipes.
  useEffect(() => onRemoteChange((keys) => { if (keys.includes(KEYS.RECIPES)) setRecipes(loadRecipes(seedRecipes)); }), []);

  function addRecipe(recipe) {
    setRecipes((prev) => {
      const existingIds = new Set(prev.map((r) => r.id));
      const id = generateId(recipe.name, existingIds);
      return [...prev, { ...recipe, id }];
    });
  }

  function updateRecipe(id, recipe) {
    setRecipes((prev) => prev.map((r) => (r.id === id ? { ...recipe, id } : r)));
  }

  function deleteRecipe(id) {
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

  return { recipes, addRecipe, updateRecipe, deleteRecipe, importRecipes };
}
