export const UNITS = ["lb", "cup", "tbsp", "tsp", "ea"];

const GRAMS_PER_LB = 453.592;
const CUPS_PER_UNIT = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48 };

// A unit "needs" per-ingredient data (density or average item weight) to
// convert to grams; lb is a weight unit already and needs no lookup.
export function unitNeedsIngredientData(unit) {
  return unit.toLowerCase() in CUPS_PER_UNIT || unit.toLowerCase() === "ea";
}

export function buildIngredientIndex(ingredients) {
  return new Map(ingredients.map((entry) => [entry.name.toLowerCase(), entry]));
}

// Converts an ingredient quantity to grams. Weight units (lb) convert directly;
// volume units (cup/tbsp/tsp) and "ea" require an ingredient-specific lookup
// (density or average item weight) from the ingredient registry, since a
// chef can edit those values per ingredient.
export function convertToGrams(name, qty, unit, ingredientIndex) {
  const key = name.toLowerCase();
  const normalizedUnit = unit.toLowerCase();

  if (normalizedUnit === "lb") {
    return qty * GRAMS_PER_LB;
  }

  if (normalizedUnit === "ea") {
    const gramsEach = ingredientIndex.get(key)?.gramsPerEach;
    if (gramsEach == null) {
      throw new Error(`No average weight defined for "${name}" (ea)`);
    }
    return qty * gramsEach;
  }

  if (normalizedUnit in CUPS_PER_UNIT) {
    const gramsPerCup = ingredientIndex.get(key)?.gramsPerCup;
    if (gramsPerCup == null) {
      throw new Error(`No density defined for "${name}" (${unit})`);
    }
    return qty * CUPS_PER_UNIT[normalizedUnit] * gramsPerCup;
  }

  throw new Error(`Unsupported unit "${unit}" for "${name}"`);
}
