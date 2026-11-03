// Inventory model for the line cook view.
//
// For each item:
//   line:    how full the line pan is, in 25% steps (0–100)
//   lowboy:  containers (qt or pt) the line cook counts at close
//   walkIn:  containers the chef counts at close (chef screens; sample for now)
// A container is { size: "qt" | "pt", fill: 0–100, madeOn: "YYYY-MM-DD" }.
// All math is in grams: an item knows its full line pan and its quart weight
// (a pint is half a quart), so the cook never converts anything.

export const LEVELS = [0, 25, 50, 75, 100];

export function containerGrams(item, size) {
  return size === "pt" ? item.qtGrams / 2 : item.qtGrams;
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

const FRACTIONS = { 25: "¼", 50: "½", 75: "¾", 100: "1" };
export function containerLabel(c) {
  return `${FRACTIONS[c.fill] ?? `${c.fill}%`} ${c.size}`;
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

// Builds the shift's Collect and Prep lists from confirmed inventory.
export function buildShift(items, inventory, linePar, today) {
  const collect = [];
  const prep = [];

  for (const item of items) {
    const inv = inventory[item.id] ?? { line: 0, lowboy: [], walkIn: [] };
    const tagged = [
      ...inv.lowboy.map((c, index) => ({ ...c, where: "lowboy", index })),
      ...inv.walkIn.map((c, index) => ({ ...c, where: "walk-in", index })),
    ];
    const toss = tagged.filter((b) => b.fill > 0 && isLastDay(item, b.madeOn, today));
    const usable = tagged.filter((b) => b.fill > 0 && !isLastDay(item, b.madeOn, today)).sort(byOldest);

    // 1. Top up the line, from lowboy and walk-in together, oldest first.
    const lineNeed = (Math.max(0, linePar - inv.line) / 100) * item.panGrams;
    const toLine = takeFrom(item, usable, lineNeed);

    // 2. Restock the lowboy to its par from what's left in the walk-in.
    const lowboyParG = item.lowboyPar * containerGrams(item, item.lowboySize);
    const lowboyLeft = usable.filter((b) => b.where === "lowboy").reduce((s, b) => s + gramsIn(item, b), 0);
    const walkInLeft = usable.filter((b) => b.where === "walk-in");
    const toLowboy = takeFrom(item, walkInLeft, Math.max(0, lowboyParG - lowboyLeft));

    if (toLine.takes.length || toLowboy.takes.length) {
      collect.push({ id: item.id, item, toLine: toLine.takes, toLowboy: toLowboy.takes });
    }

    // 3. Whatever is still short of line par + lowboy par gets made from scratch.
    const makeG = Math.ceil((toLine.short + toLowboy.short) / 50) * 50;
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

// Applies a finished Collect row to inventory.
export function applyCollect(inv, row, linePar) {
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
  const keep = (list) => list.filter((c) => c.fill > 0 && !isLastDay(item, c.madeOn, today));
  const next = { line: inv.line, lowboy: keep(inv.lowboy), walkIn: keep(inv.walkIn) };
  let grams = row.makeG;
  const lineNeed = (Math.max(0, linePar - next.line) / 100) * item.panGrams;
  if (lineNeed > 0) {
    next.line = linePar;
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
