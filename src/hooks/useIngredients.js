import { useEffect, useState } from "react";
import seedIngredients from "../data/ingredients.json";
import { loadIngredients, saveIngredients } from "../lib/storage";

export function useIngredients() {
  const [ingredients, setIngredients] = useState(() => loadIngredients(seedIngredients));

  useEffect(() => {
    saveIngredients(ingredients);
  }, [ingredients]);

  function findIngredient(name) {
    const key = name.toLowerCase();
    return ingredients.find((i) => i.name.toLowerCase() === key);
  }

  // Creates the ingredient if it's new, or updates its conversion fields if it
  // already exists — either way this is the single record used everywhere
  // that ingredient appears across recipes.
  function upsertIngredient(name, fields) {
    setIngredients((prev) => {
      const key = name.toLowerCase();
      const idx = prev.findIndex((i) => i.name.toLowerCase() === key);
      if (idx === -1) return [...prev, { name, ...fields }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...fields };
      return next;
    });
  }

  return { ingredients, findIngredient, upsertIngredient };
}
