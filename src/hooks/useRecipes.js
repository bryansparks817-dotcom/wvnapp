import { useEffect, useState } from "react";
import seedRecipes from "../data/sampleRecipes.json";
import { loadRecipes, saveRecipes } from "../lib/storage";

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

export function useRecipes() {
  const [recipes, setRecipes] = useState(() => loadRecipes(seedRecipes));

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

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

  return { recipes, addRecipe, updateRecipe, deleteRecipe };
}
