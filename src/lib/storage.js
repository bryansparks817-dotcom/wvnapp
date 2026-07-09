const RECIPES_KEY = "kitchenPrep.recipes.v1";
const INGREDIENTS_KEY = "kitchenPrep.ingredients.v1";

function load(key, seed) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to seed
  }
  return seed;
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (e.g. private browsing) — edits just won't persist
  }
}

export function loadRecipes(seed) {
  return load(RECIPES_KEY, seed);
}

export function saveRecipes(recipes) {
  save(RECIPES_KEY, recipes);
}

export function loadIngredients(seed) {
  return load(INGREDIENTS_KEY, seed);
}

export function saveIngredients(ingredients) {
  save(INGREDIENTS_KEY, ingredients);
}
