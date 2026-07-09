import { buildIngredientIndex, convertToGrams } from "./unitConversion.js";
import { flattenIngredients } from "./recipeComposition.js";

// Combines ingredients across a set of recipes: recursively flatten any
// sub-recipe components into raw ingredients (scaled by batch count), convert
// every quantity to grams (weight units directly, volume units and "ea" via
// ingredient-specific lookups from the ingredients registry), then group by
// name and sum.
export function buildGatherList(recipes, ingredients, recipesById) {
  const ingredientIndex = buildIngredientIndex(ingredients);
  const totals = new Map();

  for (const recipe of recipes) {
    const flatIngredients = flattenIngredients(recipe, recipesById);
    for (const { name, qty, unit } of flatIngredients) {
      const grams = convertToGrams(name, qty, unit, ingredientIndex);
      const key = name.toLowerCase();
      const existing = totals.get(key);
      if (existing) {
        existing.grams += grams;
      } else {
        totals.set(key, { name, grams });
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}
