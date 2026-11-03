// Scales a recipe to the grams the Prep list asks for.
//
// Recipes don't carry a finished yield yet, so the batch weight is the sum of
// the ingredient weights (sub-recipes included). That overstates yield for
// things that reduce (stocks), so the screen says which basis it used. Once a
// recipe has `yieldGrams`, that wins.
import { buildIngredientIndex, convertToGrams } from "./unitConversion";
import { flattenIngredients } from "./recipeComposition";

export function batchGrams(recipe, recipesById, ingredients) {
  if (recipe.yieldGrams) return { grams: recipe.yieldGrams, basis: "yield" };
  const index = buildIngredientIndex(ingredients);
  let total = 0;
  for (const { name, qty, unit } of flattenIngredients(recipe, recipesById)) {
    try {
      total += convertToGrams(name, qty, unit, index);
    } catch {
      // an ingredient without a conversion just doesn't count toward the total
    }
  }
  return { grams: total, basis: "ingredients" };
}

export function scaleRecipe(recipe, makeG, recipesById, ingredients) {
  const { grams, basis } = batchGrams(recipe, recipesById, ingredients);
  const factor = grams > 0 ? makeG / grams : 1;
  const index = buildIngredientIndex(ingredients);

  const lines = recipe.ingredients.map((ing) => {
    if (ing.subRecipeId != null) {
      const sub = recipesById.get(ing.subRecipeId);
      return { name: sub?.name ?? "Missing sub-recipe", amount: `${round(ing.qty * factor, 2)} batch` };
    }
    try {
      const g = convertToGrams(ing.name, ing.qty, ing.unit, index) * factor;
      return { name: ing.name, amount: `${Math.round(g).toLocaleString()} g` };
    } catch {
      return { name: ing.name, amount: `${round(ing.qty * factor, 2)} ${ing.unit}` };
    }
  });

  return { factor, batchGrams: grams, basis, lines };
}

function round(n, places) {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}
