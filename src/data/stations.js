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

// Bryan, 2026-11-28: Garde slot 5 (deviled eggs and salad toppings). Back row
// of two: egg white shells, deviled egg filling. Middle row, left to right on
// the rail: diced pepper, diced chives, lemon wedges (counted right to left,
// snaking). Front row: bacon lardons, roasted tomatoes, blue cheese.
const GARDE_SLOT5_NEW = [
  { ...TASK, id: "egg-white-shells", name: "Egg white shells", pan: "1/6", panGrams: 800, taskMinutes: 30, shelfLifeDays: 3, slot: 5, spot: 1 },
  { ...TASK, id: "lemon-wedges", name: "Lemon wedges", pan: "1/9", panGrams: 500, taskMinutes: 10, shelfLifeDays: 2, slot: 5, spot: 3 },
  { ...TASK, id: "diced-chives", name: "Diced chives", pan: "1/9", panGrams: 150, taskMinutes: 10, shelfLifeDays: 2, slot: 5, spot: 4 },
  { ...TASK, id: "diced-pepper", name: "Diced pepper", pan: "1/9", panGrams: 400, taskMinutes: 15, shelfLifeDays: 3, slot: 5, spot: 5 },
  { ...TASK, id: "bacon-lardons", name: "Cooked bacon lardons", pan: "1/9", panGrams: 500, taskMinutes: 30, shelfLifeDays: 5, slot: 5, spot: 6 },
].map((t) => ({ ...t, recipeId: `task:${t.id}` }));
const GARDE_SLOT5_MOVE = { "black-garlic-deviled-egg-filling": 2, "slow-roasted-steakhouse-tomatoes": 7, "blue-cheese-crumbles": 8 };
const addGardeSlot5 = (stations) => stations.map((s) => {
  if (s.id !== "garde-manger") return s;
  const taken = (n) => s.items.some((i) => i.slot === 5 && i.spot === n);
  const items = s.items.map((i) => (GARDE_SLOT5_MOVE[i.id] && !i.slot && !taken(GARDE_SLOT5_MOVE[i.id]) ? { ...(i.id === "black-garlic-deviled-egg-filling" ? i : toNinth(i)), slot: 5, spot: GARDE_SLOT5_MOVE[i.id] } : i));
  const fresh = GARDE_SLOT5_NEW.filter((g) => !items.some((i) => i.id === g.id)).map((g) => (taken(g.spot) ? (({ slot, spot, ...rest }) => rest)(g) : g));
  return { ...s, items: [...items, ...fresh] };
});

// Bryan, 2026-11-28: Garde's bottle rail sits between slots 2 and 3, squeeze
// bottles in no set order, counted in quarters of a bottle like a pan. A full
// bottle of ranch is about 375 g (Bryan); the others are scaled from it by
// density and stay drafts.
const BOTTLE_GRAMS = { "ranch-dressing": 375, "red-wine-vinaigrette": 350, "balsamic-reduction": 490, "caesar-dressing": 375, "squash-puree-bottle": 385 };
const BOTTLE = { pan: "bottle", panGrams: 375, lowboySize: "qt", qtGrams: 950, lowboyPar: 1, slot: "bottles" };
const GARDE_BOTTLES_NEW = [
  { ...BOTTLE, id: "caesar-dressing", name: "Caesar dressing", recipeId: "caesar-dressing", shelfLifeDays: 5, unconfirmed: ["pan", "panGrams", "lowboySize", "qtGrams", "lowboyPar", "shelfLifeDays"] },
  { ...BOTTLE, panGrams: 385, id: "squash-puree-bottle", name: "Squash purée", recipeId: "butternut-squash-puree-tart-layer", shelfLifeDays: 5, unconfirmed: ["pan", "panGrams", "lowboySize", "qtGrams", "lowboyPar", "shelfLifeDays"] },
];
const GARDE_BOTTLES_MOVE = ["ranch-dressing", "red-wine-vinaigrette", "balsamic-reduction"];
const addGardeBottles = (stations) => stations.map((s) => {
  if (s.id !== "garde-manger") return s;
  const items = s.items.map((i) => (GARDE_BOTTLES_MOVE.includes(i.id) && !i.slot ? { ...i, pan: "bottle", panGrams: BOTTLE_GRAMS[i.id], slot: "bottles", unconfirmed: i.id === "ranch-dressing" ? (i.unconfirmed ?? []).filter((f) => f !== "pan" && f !== "panGrams") : [...new Set([...(i.unconfirmed ?? []), "panGrams"])] } : i));
  const fresh = GARDE_BOTTLES_NEW.filter((g) => !items.some((i) => i.id === g.id));
  return { ...s, bottleRailAfter: s.bottleRailAfter ?? 2, items: [...items, ...fresh] };
});

// Bryan, 2026-11-28: Garde's dry rail, directly behind the station: dusters of
// powdered sugar and smoked paprika, and croutons. Containers, weights and the
// croutons as a prep task are drafts.
const GARDE_DRY = [
  { id: "powdered-sugar-duster", name: "Powdered sugar", boughtIn: true, pan: "duster", panGrams: 250, lowboySize: "qt", qtGrams: 500, lowboyPar: 0, shelfLifeDays: 180, slot: "dry", unconfirmed: ["panGrams", "shelfLifeDays"] },
  { id: "smoked-paprika-duster", name: "Smoked paprika", boughtIn: true, pan: "duster", panGrams: 250, lowboySize: "qt", qtGrams: 450, lowboyPar: 0, shelfLifeDays: 180, slot: "dry", unconfirmed: ["panGrams", "shelfLifeDays"] },
  { ...TASK, id: "croutons", name: "Croutons", recipeId: "task:croutons", pan: "1/6", panGrams: 400, taskMinutes: 30, shelfLifeDays: 5, slot: "dry", unconfirmed: TASK.unconfirmed.filter((f) => f !== "pan") },
];
const addGardeDry = (stations) => stations.map((s) => (s.id !== "garde-manger" ? s : { ...s, dryRail: true, items: [...s.items, ...GARDE_DRY.filter((g) => !s.items.some((i) => i.id === g.id))] }));

const GARDE_ROCKS = "8 qt of rocks, across slots 1–2 · for the small black bowl that props up 3 oysters Rockefeller (not counted)";

// Bryan, 2026-11-28: Grill counts 8 oz filets and salmon Wellingtons each,
// par 15% of the night's reservations. Filets are cut in house from PSMO
// tenderloin (a prep task); Wellingtons are the make-ahead assembly recipe.
// Fallback pars, minutes and shelf life are drafts.
const GRILL_EACH_NEW = [
  { ...TASK, id: "filet-8oz", name: "8 oz filet", recipeId: "task:filet-8oz", countEach: true, eachGrams: 227, parEach: 12, parPctCovers: 15, pan: "1/2", panGrams: 2724, taskMinutes: 45, taskNote: "Clean the PSMO (pull the chain and silver skin), cut 8 oz filets", shelfLifeDays: 3, unconfirmed: ["panGrams", "taskMinutes", "shelfLifeDays", "parEach"] },
];
// Bryan, 2026-11-28: flank steak on Grill's steak section, lower shelf. Comes
// 4–5 pieces a pack (~32 oz each), 47 lb case, little to no trim; tenderize both
// sides and cut into ~16 oz pieces, counted each, half pan, par 10% of the
// night's reservations. Fallback par, minutes and shelf life are drafts.
const GRILL_FLANK = { ...TASK, id: "flank-steak", name: "Flank steak (16 oz)", recipeId: "task:flank-steak", countEach: true, eachGrams: 454, parEach: 8, parPctCovers: 10, pan: "1/2", panGrams: 3632, taskMinutes: 20, taskNote: "Tenderize both sides, cut each ~32 oz piece into two ~16 oz pieces", shelfLifeDays: 3, caseLabel: "47 lb case, 4–5 pieces a pack", caseGrams: 21319, unconfirmed: ["panGrams", "taskMinutes", "shelfLifeDays", "parEach"] };
const addGrillFlank = (stations) => stations.map((s) => (s.id !== "grill" || s.items.some((i) => i.id === GRILL_FLANK.id) ? s : { ...s, items: [...s.items, GRILL_FLANK] }));
// Bryan, 2026-11-28: Grill make table slot 1, six sixth pans, 2 across, counted
// from the back left and snaking: 1 bread pudding portions, 2 cornbread mix,
// 3 provolone portions (middle right), 4 cut calamari (middle left), 5 harissa
// glazed carrots, 6 pumpkin-mushroom mix for the provoleta. New items are drafts.
const SIXTH = { pan: "1/6", panGrams: 1500, lowboySize: "qt", qtGrams: 700, lowboyPar: 1, shelfLifeDays: 3 };
const GRILL_SLOT1_NEW = [
  { ...TASK, ...SIXTH, id: "cornbread-mix", name: "Cornbread mix", recipeId: "task:cornbread-mix", taskMinutes: 15, slot: 1, spot: 2, unconfirmed: [...TASK.unconfirmed, "qtGrams", "lowboyPar"] },
  { ...TASK, ...SIXTH, id: "provolone-portions", name: "Provolone portions", recipeId: "task:provolone-portions", taskMinutes: 15, shelfLifeDays: 5, slot: 1, spot: 3, unconfirmed: [...TASK.unconfirmed, "qtGrams", "lowboyPar"] },
  { ...TASK, ...SIXTH, id: "cut-calamari", name: "Cut calamari", recipeId: "task:cut-calamari", taskMinutes: 20, shelfLifeDays: 2, slot: 1, spot: 4, unconfirmed: [...TASK.unconfirmed, "qtGrams", "lowboyPar"] },
  { ...TASK, ...SIXTH, id: "harissa-glazed-carrots", name: "Harissa-glazed carrots", recipeId: "task:harissa-glazed-carrots", taskMinutes: 30, slot: 1, spot: 5, unconfirmed: [...TASK.unconfirmed, "qtGrams", "lowboyPar"] },
  { ...SIXTH, id: "pumpkin-chestnut-oyster-mushroom-topping", name: "Pumpkin-mushroom mix (provoleta)", recipeId: "pumpkin-chestnut-oyster-mushroom-topping", slot: 1, spot: 6, unconfirmed: ["pan", "panGrams", "qtGrams", "lowboyPar", "shelfLifeDays"] },
];
const addGrillSlot1 = (stations) => stations.map((s) => {
  if (s.id !== "grill") return s;
  const taken = (n) => s.items.some((i) => i.slot === 1 && i.spot === n);
  const items = s.items.map((i) => (i.id === "savory-bacon-challah-bread-pudding" && !i.slot && !taken(1) ? { ...i, name: i.name.includes("portion") ? i.name : `${i.name} portions`, slot: 1, spot: 1 } : i));
  const fresh = GRILL_SLOT1_NEW.filter((g) => !items.some((i) => i.id === g.id)).map((g) => (taken(g.spot) ? (({ slot, spot, ...rest }) => rest)(g) : g));
  return { ...s, railPans: s.railPans || 2, railLayout: { ...(s.railLayout ?? {}), 1: s.railLayout?.[1] ?? [2, 2, 2] }, items: [...items, ...fresh] };
});

const addGrillEach = (stations) => stations.map((s) => {
  if (s.id !== "grill") return s;
  const items = s.items.map((i) => (i.id === "individual-salmon-wellington-make-ahead-assembly" && !i.countEach ? { ...i, name: i.name.startsWith("Salmon") ? i.name : "Salmon Wellington", countEach: true, eachGrams: 215, parEach: 10, parPctCovers: 15, unconfirmed: [...new Set([...(i.unconfirmed ?? []), "parEach"])] } : i));
  return { ...s, items: [...items, ...GRILL_EACH_NEW.filter((g) => !items.some((i) => i.id === g.id))] };
});

const addGardeBought = (stations) => stations.map((s) => (s.id !== "garde-manger" ? s : { ...s, items: [...s.items, ...GARDE_BOUGHT.filter((g) => !s.items.some((i) => i.id === g.id))] }));

// Bryan, 2026-11-27: every restaurant recipe except the dish builds goes on
// Prep, with light-blue starting prep pars to confirm. Line stations keep
// their items as they were (switch one to collect only under WHO MAKES IT).
function everyRecipeOnPrep(stations) {
  return library.filter((r) => r.kind !== "dish").reduce((st, r) => addRecipeTo(st, "prep", r, { lineCollects: false }), stations);
}
export const DEFAULT_STATIONS = addGrillSlot1(addGrillFlank(addGrillEach(addGardeDry(addGardeBottles(addGardeSlot5(addGardeSlot4(addGardeGreens(addGardeBought(addSauteTasks(addGrillFrozen(everyRecipeOnPrep(BASE_STATIONS)))))))))))).map((s) => (s.id === "grill" ? { ...s, railPans: 2 } : s)).map((s) => (s.id === "garde-manger" ? { ...s, railPans: 5, railLayout: { 4: 9, 5: [2, 3, 3] }, slotNotes: { 1: GARDE_ROCKS, 2: GARDE_ROCKS } } : s));
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
  // Bryan, 2026-11-28: slot 5 is two pans on the back row, then three and three.
  ["garde-bottle-rail-2026-11-28", addGardeBottles],
  ["garde-dry-rail-2026-11-28", addGardeDry],
  ["grill-count-each-2026-11-28", addGrillEach],
  ["grill-flank-2026-11-28", addGrillFlank],
  // Bryan, 2026-11-28: Grill's make table is two full hotel pans wide.
  ["grill-make-table-2-2026-11-28", (st) => st.map((s) => (s.id === "grill" && !s.railPans ? { ...s, railPans: 2 } : s))],
  ["grill-slot-1-2026-11-28", addGrillSlot1],
  // Bryan, 2026-11-28: slot 2 holds the rocks (serviceware, not counted).
  // Bryan, 2026-11-28: the rocks fill slots 1 and 2 together.
  ["garde-rocks-slots-1-2-2026-11-28", (st) => st.map((s) => (s.id === "garde-manger" ? { ...s, slotNotes: { ...(s.slotNotes ?? {}), 1: GARDE_ROCKS, 2: GARDE_ROCKS } } : s))],
  ["garde-slot-2-rocks-2026-11-28", (st) => st.map((s) => (s.id === "garde-manger" && !s.slotNotes?.[2] ? { ...s, slotNotes: { ...(s.slotNotes ?? {}), 2: GARDE_ROCKS } } : s))],
  ["garde-slot-5-2026-11-28", (st) => addGardeSlot5(st.map((s) => (s.id === "garde-manger" && !s.railLayout?.[5] ? { ...s, railLayout: { ...(s.railLayout ?? {}), 5: [2, 3, 3] } } : s)))],
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
