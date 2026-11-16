// What a gram of each prep recipe costs, from the chef's ingredient prices
// ($/kg). Uses the same raw-ingredient breakdown as the gather list, so
// sub-recipes are costed through to their own ingredients. Water and ice are
// free. An ingredient with no price (or no gram conversion) is listed as
// missing and left out of the cost. A line made from another house recipe
// (`recipeRef`, e.g. lobster stock in the velouté) is costed from that
// recipe's own cost per gram when the chef hasn't priced it directly.
import { gatherForPrep } from "./gatherList";
import { batchGrams } from "./recipeScale";

// Ingredient name -> the house recipe it's made from, across all recipes.
function houseRecipeNames(recipesById) {
  const map = new Map();
  for (const r of recipesById.values()) {
    for (const ing of r.ingredients ?? []) if (ing.recipeRef && ing.name) map.set(ing.name.toLowerCase(), ing.recipeRef);
  }
  return map;
}

export function recipeCost(recipe, recipesById, ingredients, prices, chain = [], refs = houseRecipeNames(recipesById)) {
  const { items } = gatherForPrep(
    [{ id: recipe.id, name: recipe.name, recipeId: recipe.id, makeG: 1000 }],
    recipesById,
    ingredients,
    (r) => batchGrams(r, recipesById, ingredients).grams
  );
  let cost = 0;
  const missing = [];
  for (const it of items) {
    let price = prices[it.name.toLowerCase()];
    const refId = refs.get(it.name.toLowerCase());
    if (price == null && refId && recipesById.has(refId) && !chain.includes(refId) && refId !== recipe.id) {
      const sub = recipeCost(recipesById.get(refId), recipesById, ingredients, prices, [...chain, recipe.id], refs);
      if (sub.missing.length === 0 && sub.perGram > 0) price = sub.perGram * 1000;
    }
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
  const refs = houseRecipeNames(recipesById);
  return new Map(recipes.map((r) => [r.id, recipeCost(r, recipesById, ingredients, prices, [], refs)]));
}

// Every raw ingredient any recipe uses, for the prices screen. House recipes
// (lobster stock, miso aioli…) are left out: they're costed from their own
// ingredients.
export function allIngredientNames(recipes, recipesById, ingredients) {
  const refs = houseRecipeNames(recipesById);
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
      if (refs.has(key)) continue;
      if (!names.has(key)) names.set(key, { name: it.name, usedIn: [] });
      names.get(key).usedIn.push(r.name);
    }
  }
  return [...names.values()].sort((a, b) => a.name.localeCompare(b.name));
}
