import priceSeed from "../data/ingredientPrices.json";
import menuPriceSeed from "../data/menuPrices.json";

// Bump when ingredientPrices.json is rebuilt from a newer inventory sheet.
export const PRICE_SEED_REV = 3;

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
const HISTORY_KEY = "thePass.history.v1";
const FLAG_LOG_KEY = "thePass.flagLog.v1";
const PRICES_KEY = "thePass.prices.v1";
const PRICE_SEED_KEY = "thePass.priceSeed.v1";
const MENU_PRICES_KEY = "thePass.menuPrices.v1";
const SEEDED_KEY = "kitchenPrep.seededRecipeIds.v1";
const LIBRARY_KEY = "thePass.recipeLibrary.v1";
const STATIONS_KEY = "thePass.stations.v1";
const PAN_REQUESTS_KEY = "thePass.panRequests.v1";
const STATION_FIXES_KEY = "thePass.stationFixes.v1";
const KITCHEN_MODE_KEY = "thePass.kitchenMode.v1";
const EVENTS_KEY = "thePass.events.v1";

// Kept on this phone only, never shared: who is signed in here, which
// station this phone is on, its running timers.
// The kitchen type is per phone for now, so trying private chef mode on one
// phone doesn't switch the restaurant's line phones over.
export const DEVICE_KEYS = new Set([KITCHEN_MODE_KEY, COOK_KEY, CHEF_KEY, STATION_KEY, TIMERS_KEY, SEEDED_KEY, SELECTED_RECIPE_IDS_KEY, "thePass.cleanup.v1", "thePass.installHint.v1"]);
// Key names, for screens that reload when another phone changes them.
export const KEYS = { RECIPES: RECIPES_KEY, INGREDIENTS: INGREDIENTS_KEY, STAFF: STAFF_KEY, WASTE: WASTE_KEY, EIGHTY_SIX: EIGHTY_SIX_KEY, LIBRARY: LIBRARY_KEY, STATIONS: STATIONS_KEY, PAN_REQUESTS: PAN_REQUESTS_KEY, KITCHEN_MODE: KITCHEN_MODE_KEY, EVENTS: EVENTS_KEY };

// Count and shift data are kept per station. Garde manger keeps the original
// keys so data saved before stations existed still loads.
export const shiftKeyFor = (stationId) => stationKey(SHIFT_KEY, stationId);
export const inventoryKeyFor = (stationId) => stationKey(INVENTORY_KEY, stationId);
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

// The shared-database sync (lib/sync.js) listens to every save so it can
// send the change to the other phones.
let onSave = null;
export function setSaveListener(fn) {
  onSave = fn;
}

function save(key, value) {
  const text = JSON.stringify(value);
  try {
    // Screens re-save what they loaded when they open: that's not a change,
    // so it isn't sent to the other phones (or marked as made offline).
    if (localStorage.getItem(key) === text) return;
    localStorage.setItem(key, text);
  } catch {
    // storage unavailable (e.g. private browsing) — edits just won't persist
  }
  onSave?.(key, value);
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
  HISTORY_KEY,
  FLAG_LOG_KEY,
  PRICES_KEY,
  PRICE_SEED_KEY,
  SEEDED_KEY,
  LIBRARY_KEY,
  STATIONS_KEY,
  PAN_REQUESTS_KEY,
  STATION_FIXES_KEY,
  KITCHEN_MODE_KEY,
  EVENTS_KEY,
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

// Ids of the built-in recipes this browser has already been given, so a
// recipe added to the app later shows up once, and one the chef deleted
// stays deleted.
export function loadSeededIds() {
  return load(SEEDED_KEY, null);
}

export function saveSeededIds(ids) {
  save(SEEDED_KEY, ids);
}

// Shared across phones: which recipe-library recipes the chef deleted, so
// the library doesn't add them back. { removed: [recipeId] }
export function loadLibraryState() {
  return load(LIBRARY_KEY, { removed: [] });
}

export function saveLibraryState(state) {
  save(LIBRARY_KEY, state);
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
// prepDueAt: every prep recipe done. readyAt: every station set for service.
export const DEFAULT_CHEF_SETTINGS = { marginMin: 15, serviceAt: { lunch: "11:30", dinner: "17:00" }, prepDueAt: "16:30", readyAt: "16:45" };

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

// One record per closed shift, for the chef's Data tab (see lib/history.js).
export function loadHistory() {
  return load(HISTORY_KEY, []);
}

export function saveHistory(records) {
  save(HISTORY_KEY, records);
}

// Every 86 / running-low flag ever raised: [{ date, name, kind, by, at }].
// The 86 board itself is cleared as items come back; this log isn't.
export function loadFlagLog() {
  return load(FLAG_LOG_KEY, []);
}

export function saveFlagLog(entries) {
  save(FLAG_LOG_KEY, entries);
}

export function logFlag(entry) {
  save(FLAG_LOG_KEY, [...loadFlagLog(), entry]);
}

// Ingredient prices, dollars per kg, by lowercase ingredient name.
// The first time a phone opens prices after a new vendor price load
// (src/data/ingredientPrices.json), the loaded prices fill in every
// ingredient the chef hasn't priced. A price the chef set is never changed,
// and one the chef clears afterwards stays cleared.
export function loadPrices() {
  const prices = load(PRICES_KEY, {});
  const seeded = load(PRICE_SEED_KEY, { rev: 0 });
  if ((seeded?.rev ?? 0) >= PRICE_SEED_REV) return prices;
  const next = { ...prices };
  for (const [name, perKg] of Object.entries(priceSeed.prices)) if (next[name] == null) next[name] = perKg;
  save(PRICES_KEY, next);
  save(PRICE_SEED_KEY, { rev: PRICE_SEED_REV });
  return next;
}

// Where a loaded price came from (vendor, case price), for the prices screen.
export const priceSources = priceSeed.source;

export function savePrices(prices) {
  save(PRICES_KEY, prices);
}

// Menu prices for full dish builds, dollars per plate, by recipe id. Only
// the chef's changes are saved; anything not changed comes from the printed
// menu (src/data/menuPrices.json). A price the chef clears is saved as null
// so the menu price doesn't come back.
export function loadMenuPrices() {
  return { ...menuPriceSeed.prices, ...load(MENU_PRICES_KEY, {}) };
}

export function saveMenuPrice(id, price) {
  save(MENU_PRICES_KEY, { ...load(MENU_PRICES_KEY, {}), [id]: price });
}

// The chef's station setup (stations, their items, pans and pars). null until
// the chef first saves a change; the built-in setup is used until then.
export function loadStationSetup() {
  return load(STATIONS_KEY, null);
}

export function saveStationSetup(stations) {
  save(STATIONS_KEY, stations);
}

// Ids of the one-time station fixes already applied to the saved setup.
export function loadStationFixes() {
  const done = load(STATION_FIXES_KEY, []);
  return Array.isArray(done) ? done : [];
}

export function saveStationFixes(ids) {
  save(STATION_FIXES_KEY, ids);
}

// Line cooks' requests for a different line pan size, for the chef to answer.
export function loadPanRequests() {
  return load(PAN_REQUESTS_KEY, []);
}

export function savePanRequests(list) {
  // Keep answered requests for a week, then drop them.
  const cutoff = Date.now() - 7 * 86400000;
  save(PAN_REQUESTS_KEY, list.filter((r) => r.status === "open" || (r.doneAt ?? r.at) > cutoff));
}

// Kitchen type, picked in Setup: "restaurant" (stations, counts, pans) or
// "private" (private chef & catering: events from a BEO). Kept on this
// phone only (see DEVICE_KEYS).
export function loadKitchenMode() {
  return load(KITCHEN_MODE_KEY, "restaurant") === "private" ? "private" : "restaurant";
}

export function saveKitchenMode(mode) {
  save(KITCHEN_MODE_KEY, mode);
}

// Private chef & catering events (see lib/events.js), newest first.
export function loadEvents() {
  const list = load(EVENTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveEvents(list) {
  save(EVENTS_KEY, list);
}
