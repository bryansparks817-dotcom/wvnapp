// The station's rail (Bryan, 2026-11-28): Garde manger is 5 full hotel pans
// wide, slots labeled 1–5. Each line item sits in a slot; a slot holds one
// hotel pan's worth of fractional pans (three thirds, six sixths, nine ninths…).
export const PAN_SHARE = { "1/9": 1 / 9, "1/6": 1 / 6, "1/4": 1 / 4, "1/3": 1 / 3, "1/2": 1 / 2, full: 1 };

// Where a pan sits in its slot, back (far from the cook) to front.
export const SPOTS = ["back", "middle", "front"];
// A slot can instead be set to a fixed number of pan spots (Bryan, 2026-11-28:
// Garde slot 4 is six ninth pans and that's full). Spots are numbered from the
// back left and snake (Bryan, 2026-11-28): back row left to right, next row
// right to left, next left to right, 3 to a row. Spot number = count order.
export const slotSpots = (station, slot) => Number(station?.railLayout?.[slot]) || 0;
// Spot numbers in on-screen grid order (row by row, back row on top).
export function spotGrid(n) {
  const out = [];
  for (let r = 0; r * 3 < n; r++) {
    const row = [];
    for (let c = 0; c < 3 && r * 3 + c < n; c++) row.push(r * 3 + c + 1);
    if (r % 2) { row.reverse(); while (row.length < 3) row.unshift(null); }
    out.push(...row);
  }
  return out;
}
export const validSpot = (spot, station, slot) => (slotSpots(station, slot) ? Number.isInteger(spot) && spot >= 1 && spot <= slotSpots(station, slot) : SPOTS.includes(spot));
export const spotLabel = (spot) => (typeof spot === "number" ? `#${spot}` : spot);
const spotRank = (it) => (typeof it.spot === "number" ? it.spot / 100 : SPOTS.includes(it.spot) ? SPOTS.indexOf(it.spot) : 1.5);

export const railSlots = (station) => Array.from({ length: Number(station?.railPans) || 0 }, (_, i) => i + 1);

// { slot: { items, used } } plus the items with no slot yet.
export function railMap(station) {
  const slots = railSlots(station).map((n) => ({ slot: n, items: [], used: 0, spots: slotSpots(station, n) }));
  const unplaced = [];
  for (const item of station.items ?? []) {
    const s = slots.find((x) => x.slot === item.slot);
    if (!s) { unplaced.push(item); continue; }
    s.items.push(item);
    s.used += s.spots ? 1 / s.spots : PAN_SHARE[item.pan] ?? 0;
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
