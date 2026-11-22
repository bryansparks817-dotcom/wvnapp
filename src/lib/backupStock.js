// Backup stations (Prep). Prep counts every item it makes, wherever the backup
// sits, up until a line station pulls it to the line for service. A line
// station's collect-only item (item.madeAt) is topped up from Prep's stock,
// and whatever Prep's stock can't cover is asked of Prep.
import { loadInventory, loadShift, saveInventory } from "./storage";
import { takeFromStock } from "./inventory";

const EMPTY = { line: 0, lowboy: [], walkIn: [] };
const same = (a, b) => a.id === b.id || (a.recipeId && a.recipeId === b.recipeId) || a.id === b.recipeId || a.recipeId === b.id;

export const holdsBackup = (st) => Boolean(st?.holdsBackup);
// Backup stations have no line pans.
export const linePar = (st) => (holdsBackup(st) ? 0 : st.linePar);

// The backup station's own entry for an item a line station collects.
export function stockItemFor(item, stations) {
  const maker = stations.find((s) => s.id === item.madeAt && holdsBackup(s));
  const stockItem = maker?.items.find((i) => same(i, item));
  return stockItem ? { maker, stockItem } : null;
}

export function backupFor(stations) {
  return (item) => {
    const found = stockItemFor(item, stations);
    if (!found) return null;
    const inv = loadInventory(found.maker.id)?.items?.[found.stockItem.id] ?? EMPTY;
    return { itemId: found.stockItem.id, item: found.stockItem, inv };
  };
}

// What line stations still need from this backup station today: rows on their
// Collect lists that its stock couldn't cover and they haven't ticked.
export function lineRequests(maker, stations, today) {
  const list = [];
  for (const st of stations) {
    if (st.id === maker.id) continue;
    const shift = loadShift(st.id);
    if (!shift || shift.closedAt || shift.date !== today) continue;
    for (const row of shift.collect ?? []) {
      if (row.from !== maker.id) continue;
      // Once collected, what's still missing is what the pull couldn't cover.
      const key = `c:${row.id}`;
      const grams = shift.done?.[key] ? shift.meta?.[key]?.shortAfter ?? 0 : row.shortG ?? 0;
      if (!(grams > 0)) continue;
      const item = maker.items.find((i) => i.id === row.fromItemId);
      if (item) list.push({ station: st.name, stationId: st.id, itemId: item.id, name: item.name, grams });
    }
  }
  const byItem = {};
  for (const r of list) byItem[r.itemId] = (byItem[r.itemId] ?? 0) + r.grams;
  return { list, byItem };
}

// Options for buildShift on this station.
export function shiftOptions(st, stations, today) {
  return holdsBackup(st)
    ? { holdsBackup: true, requests: lineRequests(st, stations, today).byItem }
    : { backupFor: backupFor(stations) };
}

// A Collect row from Prep's stock was ticked (or unticked): take the pulls out
// of Prep's count (or put them back).
export function moveStock(row, putBack = false) {
  if (!row.from || !row.fromItemId || !row.toLine?.length) return;
  const inv = loadInventory(row.from) ?? { items: {} };
  const cur = inv.items?.[row.fromItemId] ?? EMPTY;
  saveInventory({ ...inv, items: { ...(inv.items ?? {}), [row.fromItemId]: takeFromStock(cur, row.toLine, putBack) } }, row.from);
}
