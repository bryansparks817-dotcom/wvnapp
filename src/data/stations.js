// The restaurant's stations. Garde manger's first items are in lineItems.json;
// everything else came from the kitchen setup workbook (stationItems.json,
// built by scripts/setup-workbook/stations.py). Pastry and Prep get theirs
// when their recipes go in.
import garde from "./lineItems.json";
import fromSetup from "./stationItems.json";
import { loadStationFixes, loadStationSetup, saveStationFixes, saveStationSetup } from "../lib/storage";

const extra = (id) => fromSetup.stations[id] ?? [];

// The built-in setup. Once the chef edits stations or items in
// Chef → Setup → Stations, items & pars, the saved copy (shared with every
// phone) is used instead.
export const DEFAULT_STATIONS = [
  { id: "garde-manger", name: "Garde manger", linePar: garde.linePar, items: [...garde.items, ...extra("garde-manger")] },
  { id: "grill", name: "Grill", linePar: 100, items: extra("grill") },
  { id: "saute", name: "Sauté", linePar: 100, items: extra("saute") },
  { id: "pastry", name: "Pastry", linePar: 100, items: extra("pastry") },
  { id: "prep", name: "Prep", linePar: 100, items: extra("prep") },
];
// One-time changes to a setup the chef already saved, so a fix to the built-in
// stations reaches kitchens that edited theirs. Each runs once per kitchen
// (the ids done are shared with every phone); the chef can undo any of it in
// Setup afterwards and it won't come back.
const findItem = (stations, id) => stations.flatMap((s) => s.items).find((i) => i.id === id || i.recipeId === id);
const matches = (id) => (i) => i.id === id || i.recipeId === id;
function onlyOn(stations, id, homes, madeAt = {}) {
  const template = findItem(stations, id) ?? findItem(DEFAULT_STATIONS, id);
  return stations.map((s) => {
    if (!homes.includes(s.id)) return { ...s, items: s.items.filter((i) => !matches(id)(i)) };
    const has = s.items.some(matches(id));
    const items = has ? s.items : template ? [...s.items, { ...template, id: template.recipeId ?? template.id }] : s.items;
    return {
      ...s,
      items: items.map((i) => {
        if (!matches(id)(i)) return i;
        const { madeAt: _m, ...rest } = i;
        return madeAt[s.id] ? { ...rest, madeAt: madeAt[s.id] } : rest;
      }),
    };
  });
}
// Bryan, 2026-11-22. Keep in step with ONLY_ON in scripts/setup-workbook/stations.py.
const STATION_FIXES = [
  ["one-station-items-2026-11-22", (st) => {
    let next = onlyOn(st, "clam-chowder-veloute", ["prep", "saute"], { saute: "prep" });
    next = onlyOn(next, "robuchon-style-yukon-gold-pommes-puree", ["grill"]);
    return onlyOn(next, "winter-rockefeller-filling", ["garde-manger"]);
  }],
];

// The kitchen's stations: the chef's saved setup, or the built-in one.
export function getStations() {
  const saved = loadStationSetup();
  const done = loadStationFixes();
  const todo = STATION_FIXES.filter(([id]) => !done.includes(id));
  if (!Array.isArray(saved) || !saved.length) {
    // The built-in setup already has these fixes, so a setup saved from it later doesn't need them.
    if (todo.length) saveStationFixes(STATION_FIXES.map(([id]) => id));
    return DEFAULT_STATIONS;
  }
  if (!todo.length) return saved;
  const fixed = todo.reduce((st, [, fix]) => fix(st), saved);
  saveStationSetup(fixed);
  saveStationFixes([...done, ...todo.map(([id]) => id)]);
  return fixed;
}

// Which station makes an item another station only collects.
export function madeAtName(item) {
  return item?.madeAt ? getStations().find((s) => s.id === item.madeAt)?.name ?? "another station" : null;
}

export function stationsFor(person) {
  const all = getStations();
  const allowed = person?.stations;
  if (!Array.isArray(allowed)) return all;
  const list = all.filter((s) => allowed.includes(s.id));
  return list.length ? list : all;
}
