// What a gram of each prep recipe costs, from the chef's ingredient prices
// ($/kg). Uses the same raw-ingredient breakdown as the gather list, so
// sub-recipes are costed through to their own ingredients. Water and ice are
// free. An ingredient with no price (or no gram conversion) is listed as
// missing and left out of the cost.
import { gatherForPrep } from "./gatherList";
import { batchGrams } from "./recipeScale";

export function recipeCost(recipe, recipesById, ingredients, prices) {
  const { items } = gatherForPrep(
    [{ id: recipe.id, name: recipe.name, recipeId: recipe.id, makeG: 1000 }],
    recipesById,
    ingredients,
    (r) => batchGrams(r, recipesById, ingredients).grams
  );
  let cost = 0;
  const missing = [];
  for (const it of items) {
    const price = prices[it.name.toLowerCase()];
    if (price == null || it.other.length > 0 || !(it.grams > 0)) {
      missing.push(it.name);
      continue;
    }
    cost += (it.grams / 1000) * price;
  }
  return { perGram: cost / 1000, missing, priced: items.length - missing.length, total: items.length };
}

// recipeId → { perGram, missing, priced, total }
export function costIndex(recipes, recipesById, ingredients, prices) {
  return new Map(recipes.map((r) => [r.id, recipeCost(r, recipesById, ingredients, prices)]));
}

// Every raw ingredient any recipe uses, for the prices screen.
export function allIngredientNames(recipes, recipesById, ingredients) {
  const names = new Map();
  for (const r of recipes) {
    const { items } = gatherForPrep(
      [{ id: r.id, name: r.name, recipeId: r.id, makeG: 1000 }],
      recipesById,
      ingredients,
      (x) => batchGrams(x, recipesById, ingredients).grams
    );
    for (const it of items) {
      const key = it.name.toLowerCase();
      if (!names.has(key)) names.set(key, { name: it.name, usedIn: [] });
      names.get(key).usedIn.push(r.name);
    }
  }
  return [...names.values()].sort((a, b) => a.name.localeCompare(b.name));
}
