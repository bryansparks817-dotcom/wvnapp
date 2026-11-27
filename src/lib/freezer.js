// Freezer pull list (Bryan, 2026-11-27). The chef marks what's in the freezer
// at inventory; The Pass works out when each item has to come out so it's
// thawed (in the walk-in) by the time Prep starts the day it's needed.
//
// Thaw times are ESTIMATES, averaged from common food-safety guidance, and
// show light blue until the chef confirms them per item:
// - USDA FSIS, "The Big Thaw: Safe Defrosting Methods": in the refrigerator
//   allow about 24 h for every 4 to 5 lb; small packs (1 lb ground meat,
//   boneless chicken breasts) take a full day. Cold water (sealed, water
//   changed every 30 min, cook right after): about 30 min per lb; a 1 lb pack
//   under an hour, 3 to 4 lb 2 to 3 h.
// - FDA, "Selecting and Serving Fresh and Frozen Seafood Safely": thaw
//   frozen seafood overnight in the refrigerator.
// - Stocks, doughs, butters, veg and bread: common kitchen practice.
import { loadFreezer, saveFreezer } from "./storage";
import { addDays } from "./inventory";

// Thaw time goes by the size of ONE pack or container, not the whole count:
// a 23 lb case of short rib in 5 lb vac packs thaws like a 5 lb pack.
// pack: default pack size (lb, or qt for stocks). hours(pack) walk-in,
// cold(pack) cold water, or null when it isn't thawed that way.
export const THAW_KINDS = [
  { id: "large", name: "Large cuts, roasts, whole birds", hint: "24 h per 4–5 lb pack", pack: 5, hours: (lb) => Math.max(24, Math.ceil(lb / 5) * 24), cold: (lb) => Math.max(1, lb * 0.5) },
  { id: "portions", name: "Steaks, chops, chicken pieces, ground meat", hint: "about 1 day", pack: 2, hours: (lb) => (lb > 5 ? Math.ceil(lb / 5) * 24 : 24), cold: (lb) => Math.max(1, lb * 0.75) },
  { id: "fish", name: "Fish fillets & portions", hint: "overnight, about 12 h", pack: 2, hours: (lb) => (lb > 5 ? 24 : 12), cold: () => 1 },
  { id: "shellfish", name: "Shrimp, scallops, lobster, crab", hint: "overnight, about 12 h", pack: 2, hours: (lb) => (lb > 5 ? 24 : 12), cold: () => 1 },
  { id: "stock", name: "Stocks, soups & sauces", hint: "1–2 qt: 24 h · up to 6 qt: 48 h", pack: 1, packUnit: "qt", hours: (qt) => (qt > 6 ? 72 : qt > 2 ? 48 : 24), cold: (qt) => Math.max(1, qt) },
  { id: "dough", name: "Doughs & pastry", hint: "overnight, about 12 h", pack: 1, hours: () => 12, cold: () => null },
  { id: "butter", name: "Butters & fats", hint: "about 12 h", pack: 1, hours: () => 12, cold: () => null },
  { id: "veg", name: "Fruit & vegetables", hint: "about 8 h (or cook from frozen)", pack: 2, hours: () => 8, cold: () => null },
  { id: "bread", name: "Bread & baked goods", hint: "about 8 h", pack: 1, hours: () => 8, cold: () => null },
  { id: "other", name: "Other", hint: "about 1 day", pack: 2, hours: () => 24, cold: () => null },
];
export const UNITS = ["lb", "kg", "ea", "qt", "case"];
export const kindOf = (id) => THAW_KINDS.find((k) => k.id === id) ?? THAW_KINDS.at(-1);
export const packUnit = (item) => kindOf(item.kind).packUnit ?? "lb";

// One pack's size: the chef's number, or the type's usual pack (an estimate).
export function packSize(item) {
  if (item.packSize != null && item.packSize !== "") return Number(item.packSize);
  const k = kindOf(item.kind);
  const q = Number(item.qty) || 0;
  // A small count in lb or qt is probably one pack.
  if (!k.packUnit && item.unit === "lb" && q > 0 && q <= k.pack) return q;
  if (k.packUnit === "qt" && item.unit === "qt" && q > 0 && q <= 2) return q;
  return k.pack;
}

export function thawHours(item) {
  if (item.thawHours != null && item.thawHours !== "") return Number(item.thawHours);
  return kindOf(item.kind).hours(packSize(item));
}

export function coldWaterHours(item) {
  const h = kindOf(item.kind).cold(packSize(item));
  return h == null ? null : Math.round(h * 2) / 2;
}

// A best guess at the kind from the name, for a new item (shown light blue).
export function guessKind(name) {
  const n = name.toLowerCase();
  if (/stock|broth|soup|sauce|velout|demi|jus|bolognese|ragu/.test(n)) return "stock";
  if (/shrimp|scallop|lobster|crab|clam|mussel|oyster|squid|octopus/.test(n)) return "shellfish";
  if (/salmon|fish|cod|halibut|tuna|bass|trout|snapper|branzino/.test(n)) return "fish";
  if (/dough|pastry|puff|phyllo|pasta|gnocchi|pie|tart/.test(n)) return "dough";
  if (/butter|fat|lard|tallow|duck fat/.test(n)) return "butter";
  if (/bread|bun|challah|brioche|roll|focaccia/.test(n)) return "bread";
  if (/pea|corn|berr|fruit|spinach|veg|edamame/.test(n)) return "veg";
  if (/case|whole|roast|rib|brisket|shoulder|leg|loin|turkey|duck|osso|shank|chuck/.test(n)) return "large";
  if (/steak|chop|breast|thigh|wing|ground|quail|chicken|pork|beef|lamb|venison|wagyu|sausage/.test(n)) return "portions";
  return "other";
}

// Matching a freezer item to recipe ingredients: every main word of the
// shorter name is in the longer one ("Wagyu short rib" ↔ "Wagyu short rib, boneless").
const SKIP = new Set(["the", "and", "with", "fresh", "frozen", "house", "made", "of", "a"]);
const words = (s) => s.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !SKIP.has(w)).map((w) => w.replace(/(es|s)$/, ""));
export function namesMatch(a, b) {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return false;
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return short.every((w) => long.includes(w));
}

// Which freezer items the next prep list uses. needs: [{ name, recipeId }]
// (Prep's list from the line closes); recipesById: the recipe library.
export function prepUses(items, needs, recipesById) {
  const uses = {};
  for (const n of needs) {
    const recipe = recipesById.get(n.recipeId);
    const names = [n.name, ...(recipe?.ingredients ?? []).map((i) => i.name)];
    for (const it of items) {
      if (names.some((x) => x && namesMatch(it.name, x))) (uses[it.id] ??= []).push(n.name);
    }
  }
  return uses;
}

// The pull list. day: the prep day the list is for ("YYYY-MM-DD").
// startAt(day) → ms when Prep starts that day. Each row: when to pull it, or
// PULL NOW (and whether there's still time in the walk-in, else cold water).
export function pullList(state, { uses = {}, nextDay, startAt, now = Date.now() }) {
  const rows = [];
  for (const it of state.items) {
    if (!it.inFreezer || it.pulledAt) continue;
    const day = it.needOn ?? (uses[it.id] && !state.notNeeded?.[`${it.id}@${nextDay}`] ? nextDay : null);
    if (!day) continue;
    const hours = thawHours(it);
    const needAt = startAt(day);
    const pullAt = needAt - hours * 3600000;
    const late = pullAt <= now;
    const cold = coldWaterHours(it);
    rows.push({ item: it, day, auto: !it.needOn, forRecipes: uses[it.id] ?? [], hours, needAt, pullAt, late, tooLate: now + hours * 3600000 > needAt, cold });
  }
  return rows.sort((a, b) => a.pullAt - b.pullAt);
}

export const thawing = (state, now = Date.now()) => state.items
  .filter((it) => it.pulledAt)
  .map((it) => ({ item: it, readyAt: it.pulledAt + thawHours(it) * 3600000 }))
  .map((r) => ({ ...r, ready: r.readyAt <= now }))
  .sort((a, b) => a.readyAt - b.readyAt);

export { loadFreezer, saveFreezer, addDays };

// Precut frozen line items (KC strip, pork chop: item.frozenEach) that a line
// station closed under par. needs: [{ key, stationId, station, item, each }].
// Each becomes a pull row, using the freezer count's matching item for its
// thaw time when there is one.
export function linePullRows(needs, state, { nextDay, startAt, now = Date.now() }) {
  const rows = [];
  for (const n of needs) {
    const key = `${n.key}@${nextDay}`;
    if (state.linePulls?.[key] || state.notNeeded?.[key]) continue;
    const match = state.items.find((it) => it.inFreezer && namesMatch(it.name, n.item.name));
    const kind = match?.kind ?? n.item.freezerKind ?? "portions";
    const thawItem = match ?? { kind, qty: 1, unit: "ea", packSize: n.item.eachGrams ? Math.round((n.item.eachGrams / 453.6) * 10) / 10 : null };
    const hours = thawHours(thawItem);
    const needAt = startAt(nextDay);
    const pullAt = needAt - hours * 3600000;
    rows.push({
      key, line: true, day: nextDay, auto: true, forRecipes: [], item: { id: key, name: n.item.name, qty: n.each, unit: "ea" },
      need: n, match, hours, needAt, pullAt, late: pullAt <= now, tooLate: now + hours * 3600000 > needAt, cold: coldWaterHours(thawItem),
      short: match && match.unit === "ea" && Number(match.qty) < n.each ? Number(match.qty) : null,
    });
  }
  return rows;
}

// Marks a line pull done and takes the pieces out of the freezer count.
export function pullForLine(state, row, by) {
  const items = row.match && row.match.unit === "ea"
    ? state.items.map((it) => (it.id !== row.match.id ? it : { ...it, qty: Math.max(0, Number(it.qty) - row.item.qty), inFreezer: Number(it.qty) - row.item.qty > 0 }))
    : state.items;
  return { ...state, items, linePulls: { ...state.linePulls, [row.key]: { at: Date.now(), by, each: row.item.qty, name: row.item.name, station: row.need.station, hours: row.hours, matchId: row.match?.id ?? null } } };
}

export function undoLinePull(state, key) {
  const p = state.linePulls?.[key];
  if (!p) return state;
  const items = p.matchId ? state.items.map((it) => (it.id !== p.matchId || it.unit !== "ea" ? it : { ...it, qty: Number(it.qty) + p.each, inFreezer: true })) : state.items;
  const linePulls = { ...state.linePulls };
  delete linePulls[key];
  return { ...state, items, linePulls };
}
