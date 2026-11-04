// When there isn't enough of an ingredient for a full production run, The
// Pass scales every item that uses it down to what the ingredient on hand
// allows (the lowest ingredient sets the batch), and tells the chef. Cooks
// never choose to make more or less themselves.
//
// short: { [ingredientKey]: { name, needG, haveG, items: [itemName] } }
// needG is what the full prep list needed, haveG what is on hand.

export function shortFactor(s) {
  if (!(s.needG > 0)) return 1;
  return Math.max(0, Math.min(1, s.haveG / s.needG));
}

// Returns the prep rows with makeG scaled down where an ingredient is short.
// A scaled row keeps plannedG (the full amount) and limitedBy (which
// ingredients cut it).
export function applyShortages(rows, short) {
  const byItem = {};
  for (const s of Object.values(short ?? {})) {
    const f = shortFactor(s);
    for (const name of s.items) {
      const e = (byItem[name] ??= { factor: 1, limits: [] });
      e.factor = Math.min(e.factor, f);
      e.limits.push({ name: s.name, haveG: s.haveG, needG: s.needG });
    }
  }
  return rows.map((r) => {
    const e = byItem[r.name];
    if (!e || e.factor >= 1 || r.makeG <= 0) return r;
    return { ...r, makeG: Math.floor(r.makeG * e.factor), plannedG: r.makeG, limitedBy: e.limits };
  });
}
