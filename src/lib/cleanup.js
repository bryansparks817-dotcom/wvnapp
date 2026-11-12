// One-time wipe of the test data on each phone, before it joins the shared
// kitchen data (Bryan, 2026-11-12). Keeps Bryan's own recipes (and any he
// added or imported), real staff profiles, ingredients and chef settings.
// Removes the made-up Grill / Sauté / Pastry / Prep recipes, the sample crew,
// and every count, shift, waste entry, 86 flag, alert, cover, daily number,
// price and shift history recorded while testing.
const DONE = "thePass.cleanup.v1";

const MADE_UP_RECIPES = new Set([
  "hanger-steak-marinade", "chimichurri", "charred-scallion-butter", "veal-demi-glace", "mushroom-duxelles", "garlic-confit",
  "vanilla-creme-anglaise", "brown-butter-shortbread", "salted-caramel", "chicken-stock", "pickled-red-onion", "roasted-tomato-sauce",
]);

const CLEAR = [
  "thePass.waste.v1", "thePass.eightySix.v1", "thePass.chefAlerts.v1", "thePass.covers.v1", "thePass.dailyNumbers.v1",
  "thePass.history.v1", "thePass.flagLog.v1", "thePass.prices.v1", "thePass.timers.v1", "thePass.station.v1",
  "kitchenPrep.doneLog.v1", "kitchenPrep.selectedRecipeIds.v1",
];
const CLEAR_PREFIX = ["thePass.inventory.v1", "thePass.shift.v1"];

function edit(key, fn) {
  const text = localStorage.getItem(key);
  if (text == null) return;
  try {
    localStorage.setItem(key, JSON.stringify(fn(JSON.parse(text))));
  } catch {
    // unreadable: leave it
  }
}

export const CLEANUP_KEY = DONE;

export function cleanUpTestData() {
  try {
    if (localStorage.getItem(DONE)) return;
    for (const k of CLEAR) localStorage.removeItem(k);
    for (const k of Object.keys(localStorage)) {
      if (CLEAR_PREFIX.some((p) => k === p || k.startsWith(`${p}.`))) localStorage.removeItem(k);
    }
    edit("kitchenPrep.recipes.v1", (list) => (Array.isArray(list) ? list.filter((r) => !MADE_UP_RECIPES.has(r.id)) : list));
    edit("thePass.staff.v1", (list) => (Array.isArray(list) ? list.filter((p) => !p.sample) : list));
    edit("thePass.chefSettings.v1", (s) => {
      if (!s || typeof s !== "object") return s;
      const { cookPace: _drop, ...rest } = s;
      return rest;
    });
    localStorage.setItem(DONE, "1");
  } catch {
    // storage blocked: nothing to clean
  }
}
