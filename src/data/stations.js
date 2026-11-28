// The restaurant's stations. Garde manger's first items are in lineItems.json;
// everything else came from the kitchen setup workbook (stationItems.json,
// built by scripts/setup-workbook/stations.py). Pastry and Prep get theirs
// when their recipes go in.
import garde from "./lineItems.json";
import fromSetup from "./stationItems.json";
import library from "./recipeLibrary.json";
import { addRecipeTo } from "../lib/stationRecipes";
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

// Bryan, 2026-11-27: steaks and chops come in precut and frozen. Grill counts
// them each and collects them thawed; the chef pulls them from the freezer.
// No prep, never on Prep's list. 4 days once thawed (Bryan). Portion weight
// and par are drafts (light blue) to confirm.
const FROZEN_EACH = { frozenEach: true, freezerKind: "portions", pan: "1/6", panGrams: 2500, lowboySize: "qt", qtGrams: 950, lowboyPar: 0, shelfLifeDays: 4, unconfirmed: ["eachGrams", "parEach"] };
const GRILL_FROZEN = [
  { ...FROZEN_EACH, id: "kc-strip", name: "KC strip", eachGrams: 397, parEach: 12 },
  { ...FROZEN_EACH, id: "dry-aged-pork-chop", name: "Dry-aged pork chop", eachGrams: 454, parEach: 10 },
];
const addGrillFrozen = (stations) => stations.map((s) => (s.id !== "grill" ? s : { ...s, items: [...s.items, ...GRILL_FROZEN.filter((g) => !s.items.some((i) => i.id === g.id))] }));

// Bryan, 2026-11-27: Sauté's prep tasks that aren't recipes. Pan, weight,
// hands-on minutes and shelf life are drafts (light blue) to confirm.
const TASK = { task: true, lowboySize: "qt", qtGrams: 450, lowboyPar: 0, unconfirmed: ["pan", "panGrams", "taskMinutes", "shelfLifeDays"] };
const SAUTE_TASKS = [
  { ...TASK, id: "shaved-garlic", name: "Shaved garlic", pan: "1/9", panGrams: 450, taskMinutes: 20, shelfLifeDays: 2 },
  { ...TASK, id: "shaved-shallots", name: "Shaved shallots", pan: "1/9", panGrams: 450, taskMinutes: 15, shelfLifeDays: 2 },
  { ...TASK, id: "diced-cold-butter", name: "Diced cold butter", pan: "1/9", panGrams: 900, taskMinutes: 10, shelfLifeDays: 5 },
  { ...TASK, id: "cored-peeled-brussels-sprouts", name: "Cored & peeled Brussels sprouts", pan: "1/3", panGrams: 1500, taskMinutes: 30, shelfLifeDays: 3 },
  { ...TASK, id: "cleaned-oyster-mushrooms", name: "Cleaned oyster mushrooms", pan: "1/3", panGrams: 1000, taskMinutes: 20, shelfLifeDays: 3 },
].map((t) => ({ ...t, recipeId: `task:${t.id}` }));
const addSauteTasks = (stations) => stations.map((s) => (s.id !== "saute" ? s : { ...s, items: [...s.items, ...SAUTE_TASKS.filter((g) => !s.items.some((i) => i.id === g.id))] }));

// Bryan, 2026-11-27: bought-in items (pulled from the walk-in, never prepped,
// added up on the chef's order list). Blue cheese on Garde is the first; pan
// weight and case size are drafts to confirm.
const GARDE_BOUGHT = [
  { id: "blue-cheese-crumbles", name: "Blue cheese crumbles", boughtIn: true, pan: "1/9", panGrams: 450, lowboySize: "qt", qtGrams: 450, lowboyPar: 0, shelfLifeDays: 14, caseLabel: "5 lb bag", caseGrams: 2268, unconfirmed: ["panGrams", "shelfLifeDays", "caseGrams"] },
];
// Bryan, 2026-11-28: Garde slot 3 is three deep third pans, back to front:
// trimmed iceberg, arugula, cut romaine. Weights, minutes, shelf life and
// the arugula case are drafts (light blue) to confirm.
const GARDE_GREENS = [
  { ...TASK, recipeId: "task:trimmed-iceberg", id: "trimmed-iceberg", name: "Trimmed iceberg lettuce", pan: "1/3", panGrams: 900, taskMinutes: 15, shelfLifeDays: 3, slot: 3, spot: "back" },
  { id: "arugula", name: "Arugula", boughtIn: true, pan: "1/3", panGrams: 300, lowboySize: "qt", qtGrams: 60, lowboyPar: 0, shelfLifeDays: 4, caseLabel: "2 × 2 lb", caseGrams: 1814, slot: 3, spot: "middle", unconfirmed: ["panGrams", "shelfLifeDays", "caseGrams"] },
  { ...TASK, recipeId: "task:cut-romaine", id: "cut-romaine", name: "Cut romaine", pan: "1/3", panGrams: 600, taskMinutes: 15, shelfLifeDays: 3, slot: 3, spot: "front" },
];
const addGardeGreens = (stations) => stations.map((s) => (s.id !== "garde-manger" ? s : { ...s, items: [...s.items, ...GARDE_GREENS.filter((g) => !s.items.some((i) => i.id === g.id))] }));

// Bryan, 2026-11-28: Garde slot 4 is nine ninth pans (3 × 3), counted from the
// back left, snaking: back radish, carrot, figs; middle (right to left)
// horseradish, parmesan, apple; front burrata, pumpkin, pickled red onion.
// The new prep tasks are drafts (light blue). Figs, horseradish and roasted
// pumpkin are existing recipe items moved into the slot as ninth pans.
const GARDE_SLOT4_NEW = [
  { ...TASK, id: "shaved-radish", name: "Shaved radish", pan: "1/9", panGrams: 300, taskMinutes: 15, shelfLifeDays: 2, slot: 4, spot: 1 },
  { ...TASK, id: "shaved-carrot", name: "Shaved carrot", pan: "1/9", panGrams: 300, taskMinutes: 15, shelfLifeDays: 2, slot: 4, spot: 2 },
  { ...TASK, id: "shaved-parmesan", name: "Shaved parmesan", pan: "1/9", panGrams: 400, taskMinutes: 15, shelfLifeDays: 14, slot: 4, spot: 5 },
  { ...TASK, id: "shaved-apple", name: "Shaved apple", pan: "1/9", panGrams: 300, taskMinutes: 10, shelfLifeDays: 1, slot: 4, spot: 6 },
  { ...TASK, id: "portioned-burrata", name: "Portioned burrata", pan: "1/9", panGrams: 600, taskMinutes: 10, shelfLifeDays: 3, slot: 4, spot: 7 },
  { ...TASK, id: "pickled-red-onion", name: "Pickled red onion", pan: "1/9", panGrams: 500, taskMinutes: 20, shelfLifeDays: 14, slot: 4, spot: 9 },
].map((t) => ({ ...t, recipeId: `task:${t.id}` }));
const GARDE_SLOT4_MOVE = { "poached-figs": 3, "atomic-whipped-horseradish-cream": 4, "roasted-pumpkin-small-dice": 8 };
const toNinth = (i) => (i.pan === "1/9" ? i : { ...i, pan: "1/9", panGrams: Math.round(((i.panGrams || 1000) * 1000) / ({ "1/6": 2500, "1/3": 4000, "1/2": 6000, full: 12000 }[i.pan] || 1000)) });
const addGardeSlot4 = (stations) => stations.map((s) => {
  if (s.id !== "garde-manger") return s;
  const taken = (n) => s.items.some((i) => i.slot === 4 && i.spot === n);
  const items = s.items.map((i) => (GARDE_SLOT4_MOVE[i.id] && !i.slot && !taken(GARDE_SLOT4_MOVE[i.id]) ? { ...toNinth(i), slot: 4, spot: GARDE_SLOT4_MOVE[i.id] } : i));
  const fresh = GARDE_SLOT4_NEW.filter((g) => !items.some((i) => i.id === g.id)).map((g) => (g.slot && taken(g.spot) ? (({ slot, spot, ...rest }) => rest)(g) : g));
  return { ...s, items: [...items, ...fresh] };
});

const addGardeBought = (stations) => stations.map((s) => (s.id !== "garde-manger" ? s : { ...s, items: [...s.items, ...GARDE_BOUGHT.filter((g) => !s.items.some((i) => i.id === g.id))] }));

// Bryan, 2026-11-27: every restaurant recipe except the dish builds goes on
// Prep, with light-blue starting prep pars to confirm. Line stations keep
// their items as they were (switch one to collect only under WHO MAKES IT).
function everyRecipeOnPrep(stations) {
  return library.filter((r) => r.kind !== "dish").reduce((st, r) => addRecipeTo(st, "prep", r, { lineCollects: false }), stations);
}
export const DEFAULT_STATIONS = addGardeSlot4(addGardeGreens(addGardeBought(addSauteTasks(addGrillFrozen(everyRecipeOnPrep(BASE_STATIONS)))))).map((s) => (s.id === "garde-manger" ? { ...s, railPans: 5, railLayout: { 4: 9 } } : s));
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
  ["every-recipe-on-prep-2026-11-27", everyRecipeOnPrep],
  ["grill-frozen-steaks-2026-11-27", addGrillFrozen],
  ["saute-prep-tasks-2026-11-27", addSauteTasks],
  ["garde-blue-cheese-2026-11-27", addGardeBought],
  // Bryan, 2026-11-28: Garde manger is 5 hotel pans wide, slots 1–5.
  ["garde-slot-3-greens-2026-11-28", addGardeGreens],
  ["garde-rail-5-2026-11-28", (st) => st.map((s) => (s.id === "garde-manger" && !s.railPans ? { ...s, railPans: 5 } : s))],
  // Bryan, 2026-11-28: Garde slot 4 is six ninth pans, and that fills it.
  // Bryan, 2026-11-28: slot 4 is nine ninth pans after all (3 × 3).
  ["garde-slot-4-nine-2026-11-28", (st) => st.map((s) => (s.id === "garde-manger" && (s.railLayout?.[4] ?? 6) === 6 ? { ...s, railLayout: { ...(s.railLayout ?? {}), 4: 9 } } : s))],
  ["garde-slot-4-items-2026-11-28", addGardeSlot4],
  ["garde-slot-4-six-2026-11-28", (st) => st.map((s) => (s.id === "garde-manger" && !s.railLayout?.[4] ? { ...s, railLayout: { ...(s.railLayout ?? {}), 4: 6 } } : s))],
  // Bryan, 2026-11-27: 4 days once thawed, confirmed.
  ["frozen-steaks-4-days-2026-11-27", (st) => st.map((s) => ({
    ...s,
    items: s.items.map((i) => (GRILL_FROZEN.some((g) => g.id === i.id)
      ? { ...i, shelfLifeDays: 4, unconfirmed: (i.unconfirmed ?? []).filter((u) => u !== "shelfLifeDays") }
      : i)),
  }))],
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
