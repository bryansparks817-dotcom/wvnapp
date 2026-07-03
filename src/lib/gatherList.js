// Combines ingredients across a set of recipes: group by name + unit, sum quantities.
export function buildGatherList(recipes) {
  const totals = new Map();

  for (const recipe of recipes) {
    for (const { name, qty, unit } of recipe.ingredients) {
      const key = `${name.toLowerCase()}|${unit.toLowerCase()}`;
      const existing = totals.get(key);
      if (existing) {
        existing.qty += qty;
      } else {
        totals.set(key, { name, unit, qty });
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.name.localeCompare(b.name));
}
