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

// Nobody gathers these from storage.
const NOT_GATHERED = new Set(["water", "ice", "ice water", "hot water", "cold water"]);

// The line cook's gather list: every raw ingredient today's Prep needs, scaled
// to the grams each item has to make, summed across items, with which items
// use it. Items with no recipe in the app come back in `missing`.
export function gatherForPrep(prepRows, recipesById, ingredients, batchGramsOf) {
  const ingredientIndex = buildIngredientIndex(ingredients);
  const totals = new Map();
  const missing = [];

  for (const row of prepRows) {
    const recipe = row.recipeId ? recipesById.get(row.recipeId) : null;
    if (!recipe) {
      missing.push(row);
      continue;
    }
    const batch = batchGramsOf(recipe);
    const factor = batch > 0 ? row.makeG / batch : 1;
    for (const { name, qty, unit } of flattenIngredients(recipe, recipesById, factor)) {
      const key = name.toLowerCase();
      if (NOT_GATHERED.has(key)) continue;
      let grams = null;
      try {
        grams = convertToGrams(name, qty, unit, ingredientIndex);
      } catch {
        // no gram conversion for this ingredient: keep its own unit
      }
      const entry = totals.get(key) ?? { name, grams: 0, other: [], usedIn: [] };
      if (grams != null) entry.grams += grams;
      else entry.other.push({ qty, unit });
      if (!entry.usedIn.includes(row.name)) entry.usedIn.push(row.name);
      totals.set(key, entry);
    }
  }

  const items = Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
  return { items, missing };
}

// Splits a gather list into the storage zones the chef assigned. The chef
// sets the order: zones follow the order of the zone list, and items inside a
// zone follow the order the chef listed them in. Anything without a zone
// lands in a "No zone yet" group at the end, alphabetical.
export function groupByZone(items, zoneData) {
  const groups = zoneData.zones.map((z) => ({ ...z, items: [] }));
  const byId = new Map(groups.map((g) => [g.id, g]));
  const none = { id: "none", name: "No zone yet", area: "Ask the chef", items: [] };
  for (const item of items) {
    const zone = byId.get(zoneData.assignments[item.name.toLowerCase()]);
    (zone ?? none).items.push(item);
  }
  const order = new Map(Object.keys(zoneData.assignments).map((k, i) => [k, i]));
  for (const g of groups) g.items.sort((a, b) => order.get(a.name.toLowerCase()) - order.get(b.name.toLowerCase()));
  return [...groups, none].filter((g) => g.items.length > 0);
}
