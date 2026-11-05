// A sample crew with six weeks of believable line data, so the chef side can
// be tried before real shifts have built up. One cook per station, each with
// a random effectiveness: it sets how fast they really work against the plan
// and how much they toss. Sample entries are marked `sample` and live next to
// real data; loading again replaces the old sample, never the real data.
import {
  loadHistory, saveHistory, loadFlagLog, saveFlagLog, loadWaste, saveWaste, loadChefAlerts, saveChefAlerts,
  loadCovers, saveCovers, loadDailyNumbers, saveDailyNumbers, loadPrices, savePrices, loadStaff, saveStaff,
  loadShift, saveShift, loadInventory, saveInventory,
} from "./storage";
import { addDays, emptyInventory } from "./inventory";
import { dateKey } from "./numbers";
import { STATIONS } from "../data/stations";
import made from "../data/sampleStations.json";
import { buildPrepSteps } from "./lineList";
import { plannedSpan } from "./history";
import { withPace } from "./pace";

export const SAMPLE_DAYS = 42;

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Effectiveness 0–1 → how long their hands-on work really takes vs the
// recipe (0.85× for the best, 1.5× for the weakest) and how often they toss.
export const paceOf = (eff) => Math.round((1.5 - 0.65 * eff) * 100) / 100;
const wasteRate = (eff) => 1.6 - eff;

// Items whose par is set too high (tossed for shelf life a lot) and too low
// (86'd or low a lot), so the par check has something to say.
const OVERMADE = new Set(["apple-cider-thyme-mignonette", "creme-anglaise", "pasta-dough", "garlic-confit"]);
const RUNS_OUT = new Set(["preserved-lemon-fennel-relish", "magic-dust", "chimichurri", "salted-caramel", "veal-demi"]);

// Recipes that run long in real life whoever makes them (minutes).
const DRIFT = { "clam-chowder-veloute": 16, "mushroom-duxelles": 12, "hanger-steak-marinade": 8 };

const KNOWN_PRICES = {
  "lobster bodies/shells": 6.6, shrimp: 22, "p/d shrimp": 22, butter: 9.5, "heavy cream": 7.2, cream: 7.2,
  shallot: 6.5, onion: 2.2, fennel: 4.8, celery: 3.1, carrot: 2.0, carrots: 2.0, garlic: 8.5, "tomato paste": 5.5,
  "white wine": 6.0, parmesan: 24, thyme: 40, parsley: 18, "olive oil": 11, "apple cider vinegar": 4.2,
  horseradish: 14, "creme fraiche": 12, "crème fraîche": 12, clams: 9, "clam juice": 5, flour: 1.4, "ap flour": 1.4,
  "all-purpose flour": 1.4, "hanger steak": 19, "veal bones": 4.4, "chicken bones": 2.6, "egg yolks": 9, milk: 1.2,
  sugar: 1.6, "brown sugar": 2.2, "vanilla bean": 600, "vanilla extract": 90, "cremini mushrooms": 8.8, scallions: 6,
  "red onion": 2.4, "red wine vinegar": 3.6, "red wine": 7, water: 0, salt: 0.9, "canned san marzano tomatoes": 4.5,
  basil: 30, oregano: 34, "soy sauce": 4, "chili flake": 22,
};

function priceFor(name) {
  const key = name.toLowerCase();
  if (KNOWN_PRICES[key] != null) return KNOWN_PRICES[key];
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 997;
  return Math.round((3 + (h % 22)) * 10) / 10;
}

// True once the sample crew is loaded (an older four-week sample without a
// crew doesn't count, so it can be swapped for this one).
export function hasSampleData() {
  return loadStaff().some((p) => p.sample);
}

export function sampleCrew() {
  return loadStaff().filter((p) => p.sample);
}

const keepReal = (list) => list.filter((e) => !e.sample);

export function removeSampleData() {
  saveHistory(keepReal(loadHistory()));
  saveFlagLog(keepReal(loadFlagLog()));
  saveWaste(keepReal(loadWaste()));
  saveChefAlerts(keepReal(loadChefAlerts()));
  saveStaff(keepReal(loadStaff()));
  for (const st of STATIONS) {
    if (loadShift(st.id)?.sample) saveShift(null, st.id);
    if (loadInventory(st.id)?.sample) saveInventory(null, st.id);
  }
}

// The cooks, with a fresh random effectiveness each time.
function makeCrew() {
  const real = keepReal(loadStaff());
  const taken = new Set(real.map((p) => p.initials));
  const names = new Set(real.map((p) => p.name.toLowerCase()));
  // One cook from each band (weak to strong), shuffled, so there's always a
  // spread to work with.
  const bands = [0.15, 0.35, 0.55, 0.7, 0.85].sort(() => Math.random() - 0.5);
  const crew = made.staff
    .filter((p) => !names.has(p.name.toLowerCase()))
    .map((p, i) => {
      let initials = p.initials;
      for (let n = 2; taken.has(initials); n++) initials = `${p.initials}${n}`;
      taken.add(initials);
      const effectiveness = Math.round((bands[i % bands.length] + Math.random() * 0.15) * 100) / 100;
      return { name: p.name, initials, stations: [p.station], sample: true, effectiveness, pace: paceOf(effectiveness) };
    });
  saveStaff([...real, ...crew]);
  return crew;
}

const rowFor = (item, makeG) => ({ id: item.id, recipeId: item.recipeId, name: item.name, makeG, item });

export function loadSampleData({ today, recipesById, ingredientNames }) {
  removeSampleData();
  const crew = makeCrew();
  const r = rng(Math.floor(Math.random() * 100000));
  const [y, m, d] = today.split("-").map(Number);
  const history = [];
  const flags = [];
  const waste = [];
  const alerts = [];
  const covers = {};
  const daily = {};

  for (let back = SAMPLE_DAYS; back >= 1; back--) {
    const date = dateKey(new Date(y, m - 1, d - back));
    const c = Math.round(95 + r() * 70 + (back % 7 >= 5 ? 30 : 0));
    covers[`${date}:dinner`] = c;
    const sales = Math.round(c * (64 + r() * 10));
    daily[date] = { sales, food: Math.round(sales * (0.3 + r() * 0.04)), labor: Math.round(sales * (0.28 + r() * 0.05)) };
    const closedAt = new Date(y, m - 1, d - back, 22, 30).getTime();
    const at = closedAt - 3 * 3600000;

    for (const cook of crew) {
      const station = STATIONS.find((s) => s.id === cook.stations[0]);
      if (!station?.items.length) continue;
      const eff = cook.effectiveness;
      const pace = paceOf(eff);
      // A day off a week.
      if ((back + station.id.length) % 7 === 0) continue;

      let chosen = station.items.filter(() => r() < 0.65);
      if (chosen.length === 0) chosen = [station.items[Math.floor(r() * station.items.length)]];
      const rows = chosen.map((it) => rowFor(it, Math.round((it.panGrams * (0.45 + c / 260)) / 50) * 50));
      const plan = buildPrepSteps(rows, recipesById);
      const steps = plan.steps.filter((s) => s.kind !== "wait");
      const noise = () => (r() - 0.5) * (6 + 16 * (1 - eff));

      let extraMin = 0;
      const items = rows.map((row) => {
        const own = steps.filter((s) => s.item?.id === row.id);
        const handsOn = own.reduce((n, s) => n + s.handsOn, 0);
        const planned = own.length ? plannedSpan(own) : null;
        const over = handsOn * (pace - 1) + (DRIFT[row.recipeId] ?? 0) + noise();
        extraMin += over;
        return {
          id: row.id, name: row.name, recipeId: row.recipeId ?? null, plannedG: row.makeG, makeG: row.makeG, done: true, doneAt: null,
          extra: false, plannedSpan: planned, actualSpan: planned == null ? null : Math.max(1, Math.round(planned + over)), handsOn,
        };
      });
      const plannedEnd = steps.length ? Math.max(...steps.map((s) => (s.at ?? 0) + s.handsOn)) : 0;
      const complete = r() > (1 - eff) * 0.12;
      const behind = Math.round(extraMin * 0.8 + noise());
      history.push({
        id: `${date}:${station.id}:sample`, sample: true, date, stationId: station.id, station: station.name, cook: cook.initials,
        gatherDoneAt: new Date(y, m - 1, d - back, 13, 0).getTime(), closedAt, plannedEnd,
        actualEnd: plannedEnd + behind, behindMin: complete ? behind : null, complete,
        items: complete ? items : items.map((it, i) => (i === items.length - 1 ? { ...it, done: false, actualSpan: null } : it)),
        skipped: [],
      });

      // Tosses: shelf life gets everyone now and then (short-life items more),
      // burned and dropped batches follow the cook.
      for (const it of station.items) {
        const toss = (grams, reason) =>
          waste.push({ key: `${date}:${it.id}:${reason}:sample`, date, itemId: it.id, name: it.name, grams: Math.round(grams / 10) * 10, reason, by: cook.initials, at, sample: true });
        if (r() < (OVERMADE.has(it.id) ? 0.14 : RUNS_OUT.has(it.id) ? 0 : 0.012)) toss(it.panGrams * (0.2 + r() * 0.4), "shelf life");
        if (r() < 0.012 * wasteRate(eff)) toss(it.panGrams * (0.3 + r() * 0.5), r() < 0.5 ? "burned" : "dropped");
      }
    }

    const by = (stationId) => crew.find((p) => p.stations[0] === stationId)?.initials ?? null;
    const flag = (name, kind, stationId) => flags.push({ date, name, kind, by: by(stationId), at, sample: true });
    if (back % 4 === 0) flag("Preserved lemon & fennel relish", "86", "garde-manger");
    if (back % 9 === 0) flag("Magic dust", "low", "garde-manger");
    if (back % 5 === 0) flag("Chimichurri", "low", "grill");
    if (back % 8 === 0) flag("Salted caramel", "86", "pastry");
    if (back % 11 === 0) flag("Veal demi-glace", "low", "saute");
    const short = (ingredient, needG, haveG, item, stationId) =>
      alerts.push({ id: `${date}:${stationId}:${ingredient}:sample`, type: "short", date, station: STATIONS.find((s) => s.id === stationId)?.name, ingredient, needG, haveG, items: [{ name: item, plannedG: 0, makeG: 0 }], by: by(stationId), at, seenAt: at, sample: true });
    if (back % 7 === 2) short("Shallot", 400, 180 + Math.round(r() * 100), "Apple cider-thyme mignonette", "garde-manger");
    if (back % 15 === 4) short("Lobster bodies/shells", 11340, 6800, "Lobster stock", "garde-manger");
    if (back % 10 === 3) short("Veal bones", 5000, 3000, "Veal demi-glace", "saute");
    if (back % 12 === 6) short("Egg yolks", 240, 120, "Vanilla crème anglaise", "pastry");
  }

  saveHistory([...loadHistory(), ...history]);
  saveFlagLog([...loadFlagLog(), ...flags]);
  saveWaste([...loadWaste(), ...waste]);
  saveChefAlerts([...loadChefAlerts(), ...alerts]);
  saveCovers({ ...covers, ...loadCovers() });
  saveDailyNumbers({ ...daily, ...loadDailyNumbers() });
  const prices = Object.fromEntries(ingredientNames.map((n) => [n.toLowerCase(), priceFor(n)]));
  savePrices({ ...prices, ...loadPrices() });
  startSampleShifts({ today, recipesById, crew });
  return crew;
}

// Puts each sample cook on today's shift at their station, part way through
// their prep list at their own pace, so the crew board and the chef's
// DO FIRST / SKIP / add tools have something to work on. A station with a
// real shift open today is left alone.
export function startSampleShifts({ today, recipesById, crew = sampleCrew(), now = Date.now(), cookPace = {} }) {
  const r = rng(now % 100000);
  for (const cook of crew) {
    const station = STATIONS.find((s) => s.id === cook.stations[0]);
    if (!station?.items.length) continue;
    const current = loadShift(station.id);
    if (current && !current.sample && !current.closedAt && current.date === today) continue;

    const items = [...station.items].sort(() => r() - 0.5).slice(0, 2 + Math.floor(r() * 2));
    const prep = items.map((it) => ({ id: it.id, recipeId: it.recipeId, name: it.name, makeG: Math.round((it.panGrams * (0.8 + r() * 0.8)) / 50) * 50, toss: [] }));
    const plan = buildPrepSteps(prep.map((p) => ({ ...p, item: station.items.find((i) => i.id === p.id) })), withPace(recipesById, cookPace[cook.initials] ?? 1));
    const steps = plan.steps.filter((s) => s.kind !== "wait");
    // Started 30–90 minutes ago; ticks land at the cook's real pace, and a
    // weaker cook also loses time getting going.
    const startedMin = 30 + Math.floor(r() * 60);
    const slowStart = Math.round((1 - cook.effectiveness) * 35);
    const gatherDoneAt = now - startedMin * 60000;
    const stepsDone = {};
    for (const s of steps) {
      const realEnd = ((s.at ?? 0) + s.handsOn) * cook.pace + slowStart;
      if (realEnd > startedMin) break;
      for (const p of s.parts) stepsDone[p] = gatherDoneAt + realEnd * 60000;
    }
    // The line screen needs a close count to work from.
    if (!loadInventory(station.id)?.closedOn) {
      const picked = new Set(items.map((i) => i.id));
      const levels = Object.fromEntries(Object.entries(emptyInventory(station.items)).map(([id, inv]) => [id, { ...inv, line: picked.has(id) ? 25 : 100 }]));
      saveInventory({ closedOn: addDays(today, -1), closedAt: now - 20 * 3600000, closedBy: cook.initials, sample: true, items: levels }, station.id);
    }
    saveShift({
      sample: true, date: today, collect: [], prep, done: {}, meta: {}, stepsDone, gathered: {}, gatherDone: true, gatherDoneAt,
      confirmedBy: cook.initials, confirmedAt: gatherDoneAt - 20 * 60000,
    }, station.id);
  }
}
