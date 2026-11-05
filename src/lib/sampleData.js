// Four believable weeks of line data, so the chef's Data tab can be tried
// before real shifts have built up. Only fills in what's missing; real data
// is never overwritten.
import {
  loadHistory, saveHistory, loadFlagLog, saveFlagLog, loadWaste, saveWaste, loadChefAlerts, saveChefAlerts,
  loadCovers, saveCovers, loadDailyNumbers, saveDailyNumbers, loadPrices, savePrices,
} from "./storage";
import { dateKey } from "./numbers";

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const COOKS = [
  { id: "JR", pace: 1.05 },
  { id: "MT", pace: 1.3 },
  { id: "AL", pace: 0.92 },
];

// Planned minutes (first step to end of last hands-on step) and hands-on
// minutes per recipe, roughly what the scheduler plans for these recipes.
const TIMES = {
  "lobster-stock": [240, 45],
  "clam-chowder-veloute": [75, 50, 16], // runs long in real life
  "lobster-and-shrimp-bolognese": [120, 70],
  "apple-cider-thyme-mignonette": [25, 20],
  "atomic-whipped-horseradish-cream": [20, 15],
};

const KNOWN_PRICES = {
  "lobster bodies/shells": 6.6, shrimp: 22, "p/d shrimp": 22, butter: 9.5, "heavy cream": 7.2, cream: 7.2,
  shallot: 6.5, onion: 2.2, fennel: 4.8, celery: 3.1, carrot: 2.0, garlic: 8.5, "tomato paste": 5.5,
  "white wine": 6.0, parmesan: 24, thyme: 40, parsley: 18, "olive oil": 11, "apple cider vinegar": 4.2,
  horseradish: 14, "creme fraiche": 12, "crème fraîche": 12, clams: 9, "clam juice": 5, flour: 1.4, "ap flour": 1.4,
};

function priceFor(name) {
  const key = name.toLowerCase();
  if (KNOWN_PRICES[key] != null) return KNOWN_PRICES[key];
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 997;
  return Math.round((3 + (h % 22)) * 10) / 10;
}

export function hasSampleData() {
  return loadHistory().some((r) => r.sample);
}

export function loadSampleData({ station, today, ingredientNames }) {
  const r = rng(42);
  const [y, m, d] = today.split("-").map(Number);
  const items = station.items;
  const history = [];
  const flags = [];
  const waste = [];
  const alerts = [];
  const covers = {};
  const daily = {};

  for (let back = 28; back >= 1; back--) {
    const date = dateKey(new Date(y, m - 1, d - back));
    const c = Math.round(95 + r() * 70 + (back % 7 >= 5 ? 30 : 0));
    covers[`${date}:dinner`] = c;
    const sales = Math.round(c * (64 + r() * 10));
    daily[date] = { sales, food: Math.round(sales * (0.3 + r() * 0.04)), labor: Math.round(sales * (0.28 + r() * 0.05)) };

    const cook = COOKS[back % 3];
    const chosen = items.filter(() => r() < 0.65);
    const recItems = chosen.map((it) => {
      const makeG = Math.round((it.panGrams * (0.45 + c / 260)) / 10) * 10;
      const t = TIMES[it.recipeId];
      const actual = t ? Math.round(t[0] + (t[2] ?? 0) + t[1] * (cook.pace - 1) + (r() - 0.5) * 10) : null;
      return {
        id: it.id, name: it.name, recipeId: it.recipeId ?? null, plannedG: makeG, makeG, done: true, doneAt: null, extra: false,
        plannedSpan: t ? t[0] : null, actualSpan: actual, handsOn: t ? t[1] : 0,
      };
    });
    const behind = Math.round((cook.pace - 1) * 80 + (r() - 0.5) * 16);
    const closedAt = new Date(y, m - 1, d - back, 22, 30).getTime();
    history.push({
      id: `${date}:${station.id}:sample`, sample: true, date, stationId: station.id, station: station.name, cook: cook.id,
      gatherDoneAt: new Date(y, m - 1, d - back, 13, 0).getTime(), closedAt, plannedEnd: 240, actualEnd: 240 + behind,
      behindMin: behind, complete: true, items: recItems, skipped: [],
    });

    const at = closedAt - 3 * 3600000;
    if (back % 4 === 0) flags.push({ date, name: "Preserved lemon & fennel relish", kind: "86", by: cook.id, at });
    if (back % 9 === 0) flags.push({ date, name: "Magic dust", kind: "low", by: cook.id, at });
    if (back === 11) flags.push({ date, name: "Atomic horseradish cream", kind: "low", by: cook.id, at });
    const toss = (id, grams, reason) => {
      const it = items.find((x) => x.id === id);
      if (it) waste.push({ key: `${date}:${id}:sample`, date, itemId: id, name: it.name, grams, reason, by: cook.id, at, sample: true });
    };
    if (back % 6 === 0) toss("apple-cider-thyme-mignonette", 300 + Math.round(r() * 250), "shelf life");
    if (back % 13 === 0) toss("clam-chowder-veloute", 900, "shelf life");
    if (back === 17) toss("lobster-and-shrimp-bolognese", 800, "dropped");
    if (back === 20) toss("atomic-whipped-horseradish-cream", 250, "shelf life");
    const short = (ingredient, needG, haveG, item) =>
      alerts.push({ id: `${date}:${station.id}:${ingredient}:sample`, type: "short", date, station: station.name, ingredient, needG, haveG, items: [{ name: item, plannedG: 0, makeG: 0 }], by: cook.id, at, seenAt: at, sample: true });
    if (back % 7 === 2) short("Shallot", 400, 180 + Math.round(r() * 100), "Apple cider-thyme mignonette");
    if (back === 15 || back === 4) short("Lobster bodies/shells", 11340, 6800, "Lobster stock");
    if (back === 9) short("Crème fraîche", 500, 250, "Atomic horseradish cream");
  }

  saveHistory([...loadHistory(), ...history]);
  saveFlagLog([...loadFlagLog(), ...flags.map((f) => ({ ...f, sample: true }))]);
  saveWaste([...loadWaste(), ...waste]);
  saveChefAlerts([...loadChefAlerts(), ...alerts]);
  saveCovers({ ...covers, ...loadCovers() });
  saveDailyNumbers({ ...daily, ...loadDailyNumbers() });
  const prices = Object.fromEntries(ingredientNames.map((n) => [n.toLowerCase(), priceFor(n)]));
  savePrices({ ...prices, ...loadPrices() });
}
