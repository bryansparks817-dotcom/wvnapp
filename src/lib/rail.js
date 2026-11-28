// The station's rail (Bryan, 2026-11-28): Garde manger is 5 full hotel pans
// wide, slots labeled 1–5. Each line item sits in a slot; a slot holds one
// hotel pan's worth of fractional pans (three thirds, six sixths, nine ninths…).
export const PAN_SHARE = { "1/9": 1 / 9, "1/6": 1 / 6, "1/4": 1 / 4, "1/3": 1 / 3, "1/2": 1 / 2, full: 1 };

// Where a pan sits in its slot, back (far from the cook) to front.
export const SPOTS = ["back", "middle", "front"];
const spotRank = (it) => (SPOTS.includes(it.spot) ? SPOTS.indexOf(it.spot) : 1.5);

export const railSlots = (station) => Array.from({ length: Number(station?.railPans) || 0 }, (_, i) => i + 1);

// { slot: { items, used } } plus the items with no slot yet.
export function railMap(station) {
  const slots = railSlots(station).map((n) => ({ slot: n, items: [], used: 0 }));
  const unplaced = [];
  for (const item of station.items ?? []) {
    const s = slots.find((x) => x.slot === item.slot);
    if (!s) { unplaced.push(item); continue; }
    s.items.push(item);
    s.used += PAN_SHARE[item.pan] ?? 0;
  }
  for (const s of slots) s.items.sort((a, b) => spotRank(a) - spotRank(b));
  return { slots, unplaced };
}

// "1 ⅙" style for how much of a hotel pan a slot uses.
export function shareLabel(x) {
  const ninths = Math.round(x * 18) / 18;
  if (Math.abs(ninths - Math.round(ninths)) < 0.01) return String(Math.round(ninths));
  return `${Math.round(x * 100)}%`;
}

// Count order on a railed station: slot 1 to the last, then anything unplaced.
export function bySlot(items, station) {
  if (!railSlots(station).length) return items;
  return items.map((it, i) => ({ it, i })).sort((a, b) => (a.it.slot ?? 99) - (b.it.slot ?? 99) || (a.it.slot ? spotRank(a.it) - spotRank(b.it) : 0) || a.i - b.i).map((x) => x.it);
}
