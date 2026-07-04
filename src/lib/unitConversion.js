const GRAMS_PER_LB = 453.592;
const CUPS_PER_UNIT = { cup: 1, tbsp: 1 / 16, tsp: 1 / 48 };

// Grams per cup, by ingredient — volume-to-weight depends on the ingredient's density.
const GRAMS_PER_CUP = {
  "red wine": 236,
  "beef stock": 240,
  butter: 227,
  "heavy cream": 238,
  "olive oil": 216,
  honey: 340,
  milk: 244,
  "caesar dressing": 230,
  croutons: 30,
  sugar: 200,
  salt: 288,
  yeast: 144,
};

// Average weight (g) of a single "each" unit.
const GRAMS_PER_EACH = {
  carrots: 61,
  onion: 110,
  "salmon fillets": 170,
  lemon: 100,
  romaine: 500,
  "egg yolks": 18,
};

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
    const gramsEach = GRAMS_PER_EACH[key];
    if (gramsEach == null) {
      throw new Error(`No average weight defined for "${name}" (ea)`);
    }
    return qty * gramsEach;
  }

  if (normalizedUnit in CUPS_PER_UNIT) {
    const gramsPerCup = GRAMS_PER_CUP[key];
    if (gramsPerCup == null) {
      throw new Error(`No density defined for "${name}" (${unit})`);
    }
    return qty * CUPS_PER_UNIT[normalizedUnit] * gramsPerCup;
  }

  throw new Error(`Unsupported unit "${unit}" for "${name}"`);
}
