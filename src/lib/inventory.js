// Inventory model for the line cook view.
//
// For each item:
//   line:    how full the line pan is, in 25% steps (0–100)
//   lowboy:  containers (qt or pt) the line cook counts at close
//   walkIn:  containers the chef counts at close (chef screens; sample for now)
// A container is { size: "qt" | "pt" | "6qt", fill: 0–100, madeOn: "YYYY-MM-DD" }.
// All math is in grams: an item knows its full line pan and its quart weight
// (a pint is half a quart), so the cook never converts anything.

import { loadCovers } from "./storage";

export const LEVELS = [0, 25, 50, 75, 100];

// Par for an item counted each (filets, Wellingtons, KC strips). With
// item.parPctCovers (Bryan, 2026-11-28: filets and Wellingtons are 15% of the
// night's reservations), it's that share of tonight's covers on Chef Home,
// rounded up; with no covers typed in yet it falls back to item.parEach.
export function coversFor(today) {
  const all = loadCovers();
  const n = Object.entries(all).filter(([k, v]) => k.startsWith(`${today}:`) && Number(v) > 0).reduce((a, [, v]) => a + Number(v), 0);
  return n || null;
}
// Pmix par (Bryan, 2026-11-28): item.coverPar = { g, v }, grams used per cover
// and its variance per cover, from the Sep–Nov 2026 product mix rolled down
// through the dish builds. Tonight's total par (line pan + lowboy) = average
// use + 1 standard deviation = g × covers + √(v × covers). Null with no covers
// typed in for the day, or when the chef turned it off (item.coverParOff).
export function coverParG(item, today) {
  const cp = item.coverPar;
  if (!cp?.g || item.coverParOff || !today) return null;
  const covers = coversFor(today);
  if (!covers) return null;
  return cp.g * covers + Math.sqrt((cp.v || 0) * covers);
}
// With a pmix par the line pan is filled only as far as tonight needs, in 25%
// steps (most nights a full pan is more than service uses), and the lowboy par
// is whatever tonight calls for beyond that. Without one: the station's line
// par and the fixed lowboy par.
export function lineParFor(item, linePar, today) {
  const cp = coverParG(item, today);
  if (cp == null || !(item.panGrams > 0)) return linePar;
  return Math.min(linePar, Math.max(25, Math.ceil((cp / item.panGrams) * 4) * 25));
}
export function lowboyParGFor(item, linePar, today) {
  const cp = coverParG(item, today);
  if (cp != null) return Math.max(0, cp - (lineParFor(item, linePar, today) / 100) * (item.panGrams || 0));
  return (item.lowboyPar ?? 0) * containerGrams(item, item.lowboySize);
}

export function parEachFor(item, today) {
  const pct = Number(item.parPctCovers) || 0;
  const covers = pct > 0 && today ? coversFor(today) : null;
  if (covers) return Math.ceil((covers * pct) / 100);
  return Number(item.parEach) || 0;
}

export function containerGrams(item, size) {
  return size === "pt" ? item.qtGrams / 2 : size === "6qt" ? item.qtGrams * 6 : item.qtGrams;
}

export function gramsIn(item, c) {
  return (containerGrams(item, c.size) * c.fill) / 100;
}

function dayNumber(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

export function addDays(isoDate, n) {
  const d = new Date((dayNumber(isoDate) + n) * 86400000);
  return d.toISOString().slice(0, 10);
}

// Calendar days, closed days included.
export function daysLeft(item, madeOn, today) {
  return item.shelfLifeDays - (dayNumber(today) - dayNumber(madeOn));
}

// On its last day (or past it), a batch gets tossed and made fresh.
export function isLastDay(item, madeOn, today) {
  return daysLeft(item, madeOn, today) <= 1;
}

export function shelfLabel(item, madeOn, today) {
  const left = daysLeft(item, madeOn, today);
  if (left <= 1) return "last day · toss";
  return `${left}d left`;
}

// Lowboy container sizes (Bryan, 2026-11-28: 6 qt for cooked-off potatoes,
// cornbread mix and broccolini).
export const SIZES = ["qt", "pt", "6qt"];
export const sizeName = (size) => (size === "6qt" ? "6 qt" : size);

const FRACTIONS = { 25: "¼", 50: "½", 75: "¾", 100: "1" };
export function containerLabel(c) {
  return `${FRACTIONS[c.fill] ?? `${c.fill}%`} ${sizeName(c.size)}`;
}

export function formatG(grams) {
  return `${Math.round(grams).toLocaleString()} g`;
}

const byOldest = (a, b) => a.madeOn.localeCompare(b.madeOn) || (a.where === "lowboy" ? -1 : 1);

// Takes grams out of batches, oldest first. Amounts are rounded up to the
// nearest quarter of the container, since that's how a cook would scoop it.
function takeFrom(item, batches, gramsNeeded) {
  const takes = [];
  let remaining = gramsNeeded;
  for (const b of batches) {
    if (remaining <= 0) break;
    const have = gramsIn(item, b);
    if (have <= 0) continue;
    const want = Math.min(have, remaining);
    const quarter = containerGrams(item, b.size) / 4;
    const fill = Math.min(b.fill, Math.ceil(want / quarter) * 25);
    takes.push({ where: b.where, index: b.index, size: b.size, fill, madeOn: b.madeOn });
    b.fill -= fill;
    remaining -= (containerGrams(item, b.size) * fill) / 100;
  }
  return { takes, short: Math.max(0, remaining) };
}

const tossRows = (toss) => toss.map((b) => ({ where: b.where, size: b.size, fill: b.fill, madeOn: b.madeOn }));

// Builds the shift's Collect and Prep lists from confirmed inventory.
// opts.holdsBackup: a backup station (Prep). It has no line pans: it counts all
//   the backup for its items, wherever it sits, against each item's prep par,
//   and makes what's under par plus what line stations asked for (opts.requests,
//   grams by item id).
// opts.backupFor(item): for an item another station makes (item.madeAt), that
//   station's stock { itemId, item, inv }. The line pan is topped up from it;
//   whatever it can't cover is the shortfall that station is asked to make.
export function buildShift(items, inventory, linePar, today, opts = {}) {
  const { holdsBackup = false, backupFor = null, requests = {} } = opts;
  const collect = [];
  const prep = [];

  for (const item of items) {
    const inv = inventory[item.id] ?? { line: 0, lowboy: [], walkIn: [] };
    // Precut and frozen (KC strip, pork chop): counted each, never prepped.
    // Whatever's under par is collected from the walk-in, thawed: the chef
    // pulls it from the freezer the day before (Chef › Stock pull list).
    if (item.frozenEach) {
      if (holdsBackup) continue;
      const pullEach = Math.max(0, Math.ceil(parEachFor(item, today) - (inv.count ?? 0)));
      if (pullEach > 0) collect.push({ id: item.id, item, toLine: [], toLowboy: [], pullEach });
      continue;
    }
    // Counted each and made here (8 oz filets cut from PSMO, salmon
    // Wellingtons): whatever's under par goes on the prep list, in portions.
    if (item.countEach) {
      if (holdsBackup) continue;
      const makeEach = Math.max(0, Math.ceil(parEachFor(item, today) - (inv.count ?? 0)));
      if (makeEach > 0) prep.push({ id: item.id, item, recipeId: item.recipeId, name: item.name, makeG: makeEach * (Number(item.eachGrams) || 1), makeEach, toss: [] });
      continue;
    }
    // Bought in (blue cheese crumbles): never prepped. Whatever's under line
    // par + lowboy par is pulled from the walk-in or dry storage, and rolls up
    // to the chef's order list (Chef › Stock).
    if (item.boughtIn) {
      if (holdsBackup) continue;
      const lowboyHave = inv.lowboy.filter((c) => c.fill > 0).reduce((sum, c) => sum + gramsIn(item, c), 0);
      const lineHave = (inv.line / 100) * item.panGrams;
      const want = (linePar / 100) * item.panGrams + (item.lowboyPar ?? 0) * containerGrams(item, item.lowboySize);
      const pullG = Math.ceil(Math.max(0, want - lineHave - lowboyHave) / 50) * 50;
      if (pullG > 0) collect.push({ id: item.id, item, toLine: [], toLowboy: [], pullG });
      continue;
    }
    const fromStock = item.madeAt && backupFor ? backupFor(item) : null;
    if (fromStock) {
      const src = fromStock.inv ?? { line: 0, lowboy: [], walkIn: [] };
      const stock = [
        ...src.lowboy.map((c, index) => ({ ...c, where: "prep", list: "lowboy", index })),
        ...src.walkIn.map((c, index) => ({ ...c, where: "prep", list: "walkIn", index })),
      ].filter((b) => b.fill > 0 && !isLastDay(fromStock.item, b.madeOn, today)).sort((a, b) => a.madeOn.localeCompare(b.madeOn));
      const lineNeed = (Math.max(0, linePar - inv.line) / 100) * item.panGrams;
      const toLine = takeFrom(fromStock.item, stock, lineNeed);
      const shortG = Math.ceil(toLine.short / 50) * 50;
      if (toLine.takes.length || shortG > 0) {
        collect.push({ id: item.id, item, toLine: toLine.takes, toLowboy: [], from: item.madeAt, fromItemId: fromStock.itemId, ...(shortG > 0 ? { shortG, madeAt: item.madeAt } : {}) });
      }
      continue;
    }

    const tagged = [
      ...inv.lowboy.map((c, index) => ({ ...c, where: "lowboy", index })),
      ...inv.walkIn.map((c, index) => ({ ...c, where: "walk-in", index })),
    ];
    const toss = tagged.filter((b) => b.fill > 0 && isLastDay(item, b.madeOn, today));
    const usable = tagged.filter((b) => b.fill > 0 && !isLastDay(item, b.madeOn, today)).sort(byOldest);

    if (holdsBackup) {
      const parG = item.lowboyPar * containerGrams(item, item.lowboySize);
      const haveG = usable.reduce((sum, b) => sum + gramsIn(item, b), 0);
      const askedG = requests[item.id] ?? 0;
      const makeG = Math.ceil(Math.max(0, parG - haveG + askedG) / 50) * 50;
      if (makeG > 0 || toss.length) {
        prep.push({ id: item.id, item, recipeId: item.recipeId, name: item.name, makeG, toss: tossRows(toss), ...(askedG > 0 ? { askedG } : {}) });
      }
      continue;
    }

    // 1. Top up the line, from lowboy and walk-in together, oldest first.
    const lineNeed = (Math.max(0, lineParFor(item, linePar, today) - inv.line) / 100) * item.panGrams;
    const toLine = takeFrom(item, usable, lineNeed);

    // 2. Restock the lowboy to its par from what's left in the walk-in.
    const lowboyParG = lowboyParGFor(item, linePar, today);
    const lowboyLeft = usable.filter((b) => b.where === "lowboy").reduce((s, b) => s + gramsIn(item, b), 0);
    const walkInLeft = usable.filter((b) => b.where === "walk-in");
    const toLowboy = takeFrom(item, walkInLeft, Math.max(0, lowboyParG - lowboyLeft));

    // 3. Whatever is still short of line par + lowboy par gets made from scratch,
    // unless another station makes it (item.madeAt): then this station only
    // collects, and the shortfall shows on the Collect row for the cook to ask for.
    const makeG = Math.ceil((toLine.short + toLowboy.short) / 50) * 50;
    const elsewhere = Boolean(item.madeAt);

    if (toLine.takes.length || toLowboy.takes.length || (elsewhere && makeG > 0)) {
      collect.push({ id: item.id, item, toLine: toLine.takes, toLowboy: toLowboy.takes, ...(elsewhere && makeG > 0 ? { shortG: makeG, madeAt: item.madeAt } : {}) });
    }
    if (elsewhere) {
      if (toss.length) prep.push({ id: item.id, item, recipeId: item.recipeId, name: item.name, makeG: 0, toss: tossRows(toss) });
      continue;
    }

    if (makeG > 0 || toss.length) {
      prep.push({
        id: item.id,
        item,
        recipeId: item.recipeId,
        name: item.name,
        makeG: Math.max(makeG, 0),
        toss: toss.map((b) => ({ where: b.where, size: b.size, fill: b.fill, madeOn: b.madeOn })),
      });
    }
  }

  return { collect, prep };
}

// Takes a Collect row's pulls out of the making station's stock, or puts them
// back when the row is unticked.
export function takeFromStock(inv, takes, putBack = false) {
  const next = { line: inv.line, lowboy: inv.lowboy.map((c) => ({ ...c })), walkIn: inv.walkIn.map((c) => ({ ...c })) };
  for (const t of takes) {
    const list = next[t.list ?? "lowboy"];
    const c = list[t.index];
    if (c && c.madeOn === t.madeOn && c.size === t.size) c.fill = Math.max(0, Math.min(100, c.fill + (putBack ? t.fill : -t.fill)));
    else if (putBack) list.push({ size: t.size, fill: t.fill, madeOn: t.madeOn });
  }
  // Emptied containers stay (at 0%) until the next count, so an undo still lines up.
  return next;
}

// Applies a finished Collect row to inventory.
export function applyCollect(inv, row, linePar) {
  if (row.pullEach) return { ...inv, count: (inv.count ?? 0) + row.pullEach };
  // Bought in: the line pan to par, and full fresh containers up to lowboy par.
  if (row.pullG) {
    const item = row.item ?? {};
    const lowboy = inv.lowboy.filter((c) => c.fill > 0);
    const full = item.lowboySize && item.qtGrams ? containerGrams(item, item.lowboySize) : 0;
    let have = lowboy.reduce((sum, c) => sum + (full ? (full * c.fill) / 100 : 0), 0);
    const parG = (item.lowboyPar ?? 0) * full;
    while (full && have < parG) { lowboy.push({ size: item.lowboySize, fill: 100, madeOn: row.today ?? lowboy[0]?.madeOn ?? new Date().toISOString().slice(0, 10) }); have += full; }
    return { ...inv, line: linePar, lowboy };
  }
  // Pulled from another station's stock: only the line pan changes here.
  if (row.from) return { ...inv, line: row.toLine.length ? linePar : inv.line };
  const next = { line: inv.line, lowboy: inv.lowboy.map((c) => ({ ...c })), walkIn: inv.walkIn.map((c) => ({ ...c })) };
  const take = (t) => {
    const list = t.where === "lowboy" ? next.lowboy : next.walkIn;
    if (list[t.index]) list[t.index].fill = Math.max(0, list[t.index].fill - t.fill);
  };
  row.toLine.forEach(take);
  if (row.toLine.length) next.line = linePar;
  row.toLowboy.forEach((t) => {
    take(t);
    next.lowboy.push({ size: t.size, fill: t.fill, madeOn: t.madeOn });
  });
  next.lowboy = next.lowboy.filter((c) => c.fill > 0);
  next.walkIn = next.walkIn.filter((c) => c.fill > 0);
  return next;
}

// Applies a finished Prep row: tosses expired batches, fills the line, and
// puts the rest in the lowboy as new containers dated today.
export function applyPrep(item, inv, row, linePar, today) {
  if (item.countEach) return { ...inv, count: (inv.count ?? 0) + (row.makeEach ?? Math.round(row.makeG / (Number(item.eachGrams) || 1))) };
  const keep = (list) => list.filter((c) => c.fill > 0 && !isLastDay(item, c.madeOn, today));
  const next = { line: inv.line, lowboy: keep(inv.lowboy), walkIn: keep(inv.walkIn) };
  let grams = row.makeG;
  const lineTo = lineParFor(item, linePar, today);
  const lineNeed = (Math.max(0, lineTo - next.line) / 100) * item.panGrams;
  if (lineNeed > 0) {
    next.line = lineTo;
    grams -= lineNeed;
  }
  const full = containerGrams(item, item.lowboySize);
  while (grams > 0) {
    const fill = Math.min(100, Math.ceil(((grams / full) * 100) / 25) * 25);
    next.lowboy.push({ size: item.lowboySize, fill, madeOn: today });
    grams -= full;
  }
  return next;
}

export function emptyInventory(items) {
  return Object.fromEntries(items.map((i) => [i.id, { line: 0, lowboy: [], walkIn: [] }]));
}

// A believable close for trying the app out: dated relative to today.
export function sampleInventory(items, today) {
  const d = (n) => addDays(today, -n);
  const sample = {
    "preserved-lemon-fennel-relish": { line: 25, lowboy: [{ size: "qt", fill: 50, madeOn: d(2) }], walkIn: [] },
    "apple-cider-thyme-mignonette": { line: 100, lowboy: [{ size: "qt", fill: 100, madeOn: d(1) }], walkIn: [] },
    "atomic-whipped-horseradish-cream": { line: 25, lowboy: [{ size: "pt", fill: 50, madeOn: d(3) }], walkIn: [] },
    "magic-dust": { line: 50, lowboy: [{ size: "qt", fill: 75, madeOn: d(9) }], walkIn: [] },
    "clam-chowder-veloute": { line: 50, lowboy: [{ size: "qt", fill: 100, madeOn: d(1) }], walkIn: [{ size: "qt", fill: 100, madeOn: d(2) }] },
    "lobster-and-shrimp-bolognese": { line: 0, lowboy: [], walkIn: [] },
    "pasta-dough": { line: 25, lowboy: [], walkIn: [] },
    "lobster-stock": { line: 25, lowboy: [{ size: "qt", fill: 100, madeOn: d(3) }], walkIn: [] },
  };
  return { ...emptyInventory(items), ...sample };
}
