// The restaurant's stations. Garde manger's first items are in lineItems.json;
// everything else came from the kitchen setup workbook (stationItems.json,
// built by scripts/setup-workbook/stations.py). Pastry and Prep get theirs
// when their recipes go in.
import garde from "./lineItems.json";
import fromSetup from "./stationItems.json";
import library from "./recipeLibrary.json";
import { loadStationFixes, loadStationSetup, saveStationFixes, saveStationSetup } from "../lib/storage";

const extra = (id) => fromSetup.stations[id] ?? [];

// The built-in setup. Once the chef edits stations or items in
// Chef → Setup → Stations, items & pars, the saved copy (shared with every
// phone) is used instead.
const BASE_STATIONS = [
  { id: "garde-manger", name: "Garde manger", linePar: garde.linePar, items: [...garde.items, ...extra("garde-manger")] },
  { id: "grill", name: "Grill", linePar: 100, items: extra("grill") },
  { id: "saute", name: "Sauté", linePar: 100, items: extra("saute") },
  { id: "pastry", name: "Pastry", linePar: 100, items: extra("pastry") },
  // Prep holds the backup: no line pans, every item counted against its prep par.
  { id: "prep", name: "Prep", linePar: 0, holdsBackup: true, items: extra("prep") },
];

// Prep cook trial (2026-11-27): the big batches Prep makes. Each sits on Prep
// with a prep par (in quarts, about one batch: a light-blue draft for the chef
// to confirm), and any line station that also lists it only collects it.
// Keep in step with PREP_OWNS in scripts/setup-workbook/stations.py.
export const PREP_OWNS = [
  ["chicken-stock", 8],
  ["d-o-p-san-marzano-tomato-sauce", 6],
  ["farm-heirloom-tomato-sauce", 4],
  ["albondigas-sauce", 3],
  ["black-cherry-pepita-black-lime-mole", 3],
  ["clam-chowder-veloute", 4],
  ["12-hour-braised-wagyu-short-rib", 6],
  ["wagyu-braising-reduction", 1],
  ["venison-osso-bucco-traditional-braise", 2],
  ["blackberry-demi-glace-scallop-sauce", 1],
  ["house-potato-gnocchi", 1],
  ["pasta-dough", 4],
  ["albondigas-meatballs", 2],
];
const DRAFT = ["pan", "lowboySize", "qtGrams", "lowboyPar", "panGrams"];
function prepItemFrom(id, par, stations) {
  const onLine = stations.flatMap((s) => s.items).find((i) => i.id === id || i.recipeId === id);
  if (onLine) {
    const { madeAt: _m, ...rest } = onLine;
    return { ...rest, id, recipeId: id, lowboySize: "qt", lowboyPar: par, unconfirmed: [...new Set([...(rest.unconfirmed ?? []), "lowboyPar"])] };
  }
  const r = library.find((x) => x.id === id);
  if (!r) return null;
  return { id, name: r.name, pan: "1/6", panGrams: 2500, lowboySize: "qt", qtGrams: 950, lowboyPar: par, shelfLifeDays: r.shelfLifeDays || 3, recipeId: id, unconfirmed: [...DRAFT, ...(r.shelfLifeDays ? [] : ["shelfLifeDays"])] };
}
function prepOwns(stations) {
  const prep = stations.find((s) => s.id === "prep");
  if (!prep) return stations;
  const add = [];
  for (const [id, par] of PREP_OWNS) {
    if (prep.items.some((i) => i.id === id || i.recipeId === id) || add.some((i) => i.id === id)) continue;
    const item = prepItemFrom(id, par, stations);
    if (item) add.push(item);
  }
  const owned = new Set(PREP_OWNS.map(([id]) => id));
  return stations.map((s) => {
    if (s.id === "prep") return { ...s, items: [...s.items, ...add] };
    return { ...s, items: s.items.map((i) => (owned.has(i.recipeId ?? i.id) || owned.has(i.id) ? { ...i, madeAt: "prep" } : i)) };
  });
}
export const DEFAULT_STATIONS = prepOwns(BASE_STATIONS);
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
  // Bryan, 2026-11-22: Prep owns the backup for what it makes, up until a line
  // station pulls it to the line. Its par is the prep par.
  ["prep-holds-backup-2026-11-22", (st) => st.map((s) => {
    if (s.id !== "prep") return s;
    return {
      ...s,
      holdsBackup: true,
      linePar: 0,
      items: s.items.map((i) => (i.id === "clam-chowder-veloute" && i.unconfirmed?.includes("lowboyPar") && i.lowboyPar < 4 ? { ...i, lowboyPar: 4 } : i)),
    };
  })],
  // Prep cook trial, 2026-11-27: Prep makes the big batches (PREP_OWNS).
  ["prep-owns-big-batches-2026-11-27", prepOwns],
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

// Setup problems to flag: items on a backup station with no prep par, and
// collect-only items whose making station doesn't stock them.
export function setupFlags(stations = getStations()) {
  const flags = [];
  for (const s of stations) {
    for (const i of s.items) {
      if (s.holdsBackup && !(i.lowboyPar > 0)) flags.push({ stationId: s.id, itemId: i.id, text: `${i.name} on ${s.name} has no prep par.` });
      else if (s.holdsBackup && i.unconfirmed?.includes("lowboyPar")) flags.push({ stationId: s.id, itemId: i.id, draft: true, text: `${i.name} on ${s.name}: prep par of ${i.lowboyPar} ${i.lowboySize} is a draft to confirm.` });
      if (i.madeAt) {
        const maker = stations.find((m) => m.id === i.madeAt);
        const stocked = maker?.items.some((m) => m.id === i.id || (i.recipeId && m.recipeId === i.recipeId));
        if (!maker || !stocked) flags.push({ stationId: s.id, itemId: i.id, text: `${i.name} on ${s.name} is collect only, but ${maker?.name ?? "the making station"} doesn't have it as an item yet.` });
        else if (!maker.holdsBackup) flags.push({ stationId: s.id, itemId: i.id, text: `${i.name} on ${s.name} is collect only, but ${maker.name} isn't set to hold backup.` });
      }
    }
  }
  return flags;
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
