const RECIPES_KEY = "kitchenPrep.recipes.v1";
const INGREDIENTS_KEY = "kitchenPrep.ingredients.v1";
const SELECTED_RECIPE_IDS_KEY = "kitchenPrep.selectedRecipeIds.v1";
const DONE_LOG_KEY = "kitchenPrep.doneLog.v1";
const SCHEDULE_SETTINGS_KEY = "kitchenPrep.scheduleSettings.v1";

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
];

// Wipes everything this app has stored locally (recipes, ingredients,
// today's selection, the done-log, schedule settings), so the next load
// falls back to whatever is currently seeded — used to recover from a
// browser whose cached recipes have drifted from a newer build.
export function clearAllLocalData() {
  try {
    for (const key of ALL_KEYS) localStorage.removeItem(key);
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
