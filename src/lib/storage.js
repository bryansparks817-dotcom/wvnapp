const RECIPES_KEY = "kitchenPrep.recipes.v1";
const INGREDIENTS_KEY = "kitchenPrep.ingredients.v1";
const SELECTED_RECIPE_IDS_KEY = "kitchenPrep.selectedRecipeIds.v1";
const DONE_LOG_KEY = "kitchenPrep.doneLog.v1";
const SCHEDULE_SETTINGS_KEY = "kitchenPrep.scheduleSettings.v1";
const INVENTORY_KEY = "thePass.inventory.v1";
const SHIFT_KEY = "thePass.shift.v1";
const COOK_KEY = "thePass.cook.v1";
const STAFF_KEY = "thePass.staff.v1";
const TIMERS_KEY = "thePass.timers.v1";
const WASTE_KEY = "thePass.waste.v1";
const EIGHTY_SIX_KEY = "thePass.eightySix.v1";
const STATION_KEY = "thePass.station.v1";
const CHEF_ALERTS_KEY = "thePass.chefAlerts.v1";
const CHEF_KEY = "thePass.chef.v1";
const CHEF_SETTINGS_KEY = "thePass.chefSettings.v1";
const COVERS_KEY = "thePass.covers.v1";
const DAILY_NUMBERS_KEY = "thePass.dailyNumbers.v1";

// Count and shift data are kept per station. Garde manger keeps the original
// keys so data saved before stations existed still loads.
const stationKey = (key, stationId) => (!stationId || stationId === "garde-manger" ? key : `${key}.${stationId}`);

function load(key, seed) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to seed
  }
  return seed;
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (e.g. private browsing) — edits just won't persist
  }
}

const ALL_KEYS = [
  RECIPES_KEY,
  INGREDIENTS_KEY,
  SELECTED_RECIPE_IDS_KEY,
  DONE_LOG_KEY,
  SCHEDULE_SETTINGS_KEY,
  INVENTORY_KEY,
  SHIFT_KEY,
  COOK_KEY,
  STAFF_KEY,
  TIMERS_KEY,
  WASTE_KEY,
  "thePass.lineDay.v1",
  EIGHTY_SIX_KEY,
  CHEF_ALERTS_KEY,
  CHEF_KEY,
  CHEF_SETTINGS_KEY,
  COVERS_KEY,
  DAILY_NUMBERS_KEY,
];

// Wipes everything this app has stored locally (recipes, ingredients,
// today's selection, the done-log, schedule settings), so the next load
// falls back to whatever is currently seeded — used to recover from a
// browser whose cached recipes have drifted from a newer build.
export function clearAllLocalData() {
  try {
    for (const key of ALL_KEYS) localStorage.removeItem(key);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(`${INVENTORY_KEY}.`) || key.startsWith(`${SHIFT_KEY}.`) || key === STATION_KEY) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable — nothing to clear
  }
}

export function loadRecipes(seed) {
  return load(RECIPES_KEY, seed);
}

export function saveRecipes(recipes) {
  save(RECIPES_KEY, recipes);
}

export function loadIngredients(seed) {
  return load(INGREDIENTS_KEY, seed);
}

export function saveIngredients(ingredients) {
  save(INGREDIENTS_KEY, ingredients);
}

// Which recipes are checked on the home screen — restored on reload so a
// refresh mid-shift doesn't lose the day's selection.
export function loadSelectedRecipeIds() {
  return load(SELECTED_RECIPE_IDS_KEY, []);
}

export function saveSelectedRecipeIds(ids) {
  save(SELECTED_RECIPE_IDS_KEY, ids);
}

// The day's done-log: schedule row key -> actual minutes logged.
export function loadDoneLog() {
  return load(DONE_LOG_KEY, {});
}

export function saveDoneLog(doneLog) {
  save(DONE_LOG_KEY, doneLog);
}

// Forward/backward scheduling direction + the chosen start/finish time.
export function loadScheduleSettings() {
  return load(SCHEDULE_SETTINGS_KEY, { direction: "forward", anchorTime: "09:00" });
}

export function saveScheduleSettings(settings) {
  save(SCHEDULE_SETTINGS_KEY, settings);
}

// Inventory as of the last count: { closedOn, items: { itemId: { line, lowboy, walkIn } } }.
// Carries over to the next shift (see docs/line-cook-screens.md).
export function loadInventory(stationId) {
  return load(stationKey(INVENTORY_KEY, stationId), null);
}

export function saveInventory(inventory, stationId) {
  save(stationKey(INVENTORY_KEY, stationId), inventory);
}

// The current shift: { date, collect, prep, done: { key: snapshot } }.
// Built when the cook confirms last night's count.
export function loadShift(stationId) {
  return load(stationKey(SHIFT_KEY, stationId), null);
}

export function saveShift(shift, stationId) {
  save(stationKey(SHIFT_KEY, stationId), shift);
}

// The station this phone last had open.
export function loadStation() {
  return load(STATION_KEY, null);
}

export function saveStation(stationId) {
  save(STATION_KEY, stationId);
}

// Staff roster: [{ name, initials }]. See lib/staff.js.
export function loadStaff() {
  return load(STAFF_KEY, []);
}

export function saveStaff(staff) {
  save(STAFF_KEY, staff);
}

// Who's on the station today: { date, name, initials }.
export function loadCook() {
  return load(COOK_KEY, null);
}

export function saveCook(cook) {
  save(COOK_KEY, cook);
}

// Running timers: [{ id, label, endsAt (ms) }].
export function loadTimers() {
  return load(TIMERS_KEY, []);
}

export function saveTimers(timers) {
  save(TIMERS_KEY, timers);
}

// Waste log: [{ key, date, itemId, name, grams, reason, by, at }].
export function loadWaste() {
  return load(WASTE_KEY, []);
}

export function saveWaste(entries) {
  save(WASTE_KEY, entries);
}

// The 86 board: [{ name, kind: "86" | "low", by, at }]. Older builds stored
// plain names; those read as 86s.
export function loadEightySix() {
  const raw = load(EIGHTY_SIX_KEY, []);
  return raw.map((f) => (typeof f === "string" ? { name: f, kind: "86", by: "", at: null } : f));
}

export function saveEightySix(flags) {
  save(EIGHTY_SIX_KEY, flags);
}

// Alerts waiting for the chef, e.g. a cook flagging an ingredient that's too
// short for a full production run: [{ id, type, station, ingredient, needG,
// items, by, at, date }]. The chef screens will show these; until the shared
// database exists they only live on this phone.
export function loadChefAlerts() {
  return load(CHEF_ALERTS_KEY, []);
}

export function saveChefAlerts(alerts) {
  save(CHEF_ALERTS_KEY, alerts);
}

// The chef signed in on this phone today: { date, name, initials }.
export function loadChef() {
  return load(CHEF_KEY, null);
}

export function saveChef(chef) {
  save(CHEF_KEY, chef);
}

// Chef settings: how far behind a cook can run before going red, and when
// service starts for each shift ("HH:MM").
export const DEFAULT_CHEF_SETTINGS = { marginMin: 15, serviceAt: { lunch: "11:30", dinner: "17:00" } };

export function loadChefSettings() {
  const s = load(CHEF_SETTINGS_KEY, {});
  return { ...DEFAULT_CHEF_SETTINGS, ...s, serviceAt: { ...DEFAULT_CHEF_SETTINGS.serviceAt, ...(s.serviceAt ?? {}) } };
}

export function saveChefSettings(settings) {
  save(CHEF_SETTINGS_KEY, settings);
}

// Reservation covers per shift, typed in by the chef until OpenTable is
// connected: { "2026-11-04:dinner": 120 }.
export function loadCovers() {
  return load(COVERS_KEY, {});
}

export function saveCovers(covers) {
  save(COVERS_KEY, covers);
}

// Daily sales, food purchases and labor, in dollars, typed in by the chef
// until the POS and payroll are connected: { "2026-11-04": { sales, food, labor } }.
export function loadDailyNumbers() {
  return load(DAILY_NUMBERS_KEY, {});
}

export function saveDailyNumbers(numbers) {
  save(DAILY_NUMBERS_KEY, numbers);
}
