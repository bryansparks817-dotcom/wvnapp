import ingredients from "../data/ingredients.json";

const GRAMS_PER_LB = 453.592;
const CUPS_PER_UNIT = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48 };

// Per-ingredient conversion data (density as grams/cup, average weight as
// grams/each) lives in src/data/ingredients.json, keyed by name — that's the
// single source of truth a chef can later edit, and edits apply everywhere
// that ingredient is used.
const ingredientsByName = new Map(ingredients.map((entry) => [entry.name.toLowerCase(), entry]));

// Converts an ingredient quantity to grams. Weight units (lb) convert directly;
// volume units (cup/tbsp/tsp) and "ea" require an ingredient-specific lookup
// since they depend on density / average item weight.
export function convertToGrams(name, qty, unit) {
  const key = name.toLowerCase();
  const normalizedUnit = unit.toLowerCase();

  if (normalizedUnit === "lb") {
    return qty * GRAMS_PER_LB;
  }

  if (normalizedUnit === "ea") {
    const gramsEach = ingredientsByName.get(key)?.gramsPerEach;
    if (gramsEach == null) {
      throw new Error(`No average weight defined for "${name}" (ea)`);
    }
    return qty * gramsEach;
  }

  if (normalizedUnit in CUPS_PER_UNIT) {
    const gramsPerCup = ingredientsByName.get(key)?.gramsPerCup;
    if (gramsPerCup == null) {
      throw new Error(`No density defined for "${name}" (${unit})`);
    }
    return qty * CUPS_PER_UNIT[normalizedUnit] * gramsPerCup;
  }

  throw new Error(`Unsupported unit "${unit}" for "${name}"`);
}
