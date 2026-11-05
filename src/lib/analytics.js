// The chef's Data tab: turns what the line logs (waste, 86 flags, shift
// history, short alerts, covers, daily numbers) into a few plain reports.
// Every report covers the `days` days ending today.

function dayNum(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(new Date(y, m - 1, d).getTime() / 86400000);
}

export function inRange(date, today, days, offset = 0) {
  const diff = dayNum(today) - dayNum(date);
  return diff >= offset && diff < offset + days;
}

const sortBy = (arr, f) => [...arr].sort((a, b) => f(b) - f(a));

// 1. Waste in dollars. costOfItem(itemId) → $/g or null when not priced.
export function wasteReport(waste, costOfItem, today, days) {
  const rows = waste.filter((w) => inRange(w.date, today, days));
  const byItem = new Map();
  const byReason = new Map();
  const byCook = new Map();
  let grams = 0;
  let dollars = 0;
  let unpricedG = 0;
  for (const w of rows) {
    const cpg = costOfItem(w.itemId);
    const cost = cpg != null ? w.grams * cpg : null;
    grams += w.grams;
    if (cost == null) unpricedG += w.grams;
    else dollars += cost;
    for (const [map, key] of [[byItem, w.name], [byReason, w.reason || "other"], [byCook, w.by || "?"]]) {
      const e = map.get(key) ?? { key, grams: 0, dollars: 0, count: 0, unpriced: false };
      e.grams += w.grams;
      e.dollars += cost ?? 0;
      e.unpriced ||= cost == null;
      e.count += 1;
      map.set(key, e);
    }
  }
  const list = (m) => sortBy([...m.values()], (e) => e.dollars || e.grams / 1000);
  return { grams, dollars, unpricedG, entries: rows.length, byItem: list(byItem), byReason: list(byReason), byCook: list(byCook) };
}

// 2. Par tuning: an item that keeps running out but never gets tossed needs
// more par; one that keeps getting tossed but never runs out needs less.
export function parTuning(items, flagLog, waste, today, days) {
  return items.map((item) => {
    const flags = flagLog.filter((f) => f.name === item.name && inRange(f.date, today, days));
    const outs = flags.filter((f) => f.kind === "86").length;
    const lows = flags.filter((f) => f.kind === "low").length;
    const tossed = waste.filter((w) => (w.itemId === item.id || w.name === item.name) && inRange(w.date, today, days));
    const tossG = tossed.reduce((s, w) => s + w.grams, 0);
    const short = outs + lows;
    let call = "OK";
    let why = "Par looks right.";
    if (short >= 2 && tossed.length === 0) {
      call = "RAISE";
      why = `Ran out or low ${short}× and never tossed.`;
    } else if (tossed.length >= 2 && short === 0) {
      call = "LOWER";
      why = `Tossed ${tossed.length}× and never ran low.`;
    } else if (short > 0 && tossed.length > 0) {
      call = "WATCH";
      why = "Both runs out and gets tossed: check batch size or shelf life.";
    }
    return { id: item.id, name: item.name, outs, lows, tossCount: tossed.length, tossG, call, why };
  });
}

// 3. Prep per 100 covers, from what each shift actually made and that day's
// covers. coversOn(date) → number or null.
export function prepPerCovers(history, coversOn, today, days) {
  const recs = history.filter((r) => inRange(r.date, today, days));
  const byItem = new Map();
  const daysCounted = new Set();
  let totalCovers = 0;
  for (const r of recs) {
    const covers = coversOn(r.date);
    if (!covers) continue;
    if (!daysCounted.has(r.date)) {
      daysCounted.add(r.date);
      totalCovers += covers;
    }
    for (const it of r.items) {
      if (!it.done || it.extra) continue;
      const e = byItem.get(it.id) ?? { id: it.id, name: it.name, grams: 0 };
      e.grams += it.makeG;
      byItem.set(it.id, e);
    }
  }
  const rows = [...byItem.values()].map((e) => ({ ...e, per100: totalCovers ? (e.grams / totalCovers) * 100 : 0 }));
  return { days: daysCounted.size, totalCovers, rows: sortBy(rows, (e) => e.per100) };
}

// 4. Cook trends: this week vs the week before.
export function cookTrends(history, today, marginMin) {
  const week = (offset) => {
    const map = new Map();
    for (const r of history) {
      if (!r.cook || !inRange(r.date, today, 7, offset)) continue;
      const e = map.get(r.cook) ?? { shifts: 0, onTime: 0, inMargin: 0, behind: 0, unfinished: 0 };
      if (r.behindMin == null) {
        e.unfinished += 1;
        map.set(r.cook, e);
        continue;
      }
      e.shifts += 1;
      if (r.behindMin <= 0) e.onTime += 1;
      else if (r.behindMin <= marginMin) e.inMargin += 1;
      e.behind += Math.max(0, r.behindMin);
      map.set(r.cook, e);
    }
    return map;
  };
  const now = week(0);
  const before = week(7);
  const cooks = new Set([...now.keys(), ...before.keys()]);
  const stat = (e) =>
    e ? { shifts: e.shifts, unfinished: e.unfinished, onTimePct: e.shifts ? (e.onTime / e.shifts) * 100 : null, avgBehind: e.shifts ? e.behind / e.shifts : null } : null;
  return [...cooks].map((cook) => ({ cook, now: stat(now.get(cook)), before: stat(before.get(cook)) }))
    .sort((a, b) => (b.now?.shifts ?? 0) - (a.now?.shifts ?? 0));
}

// 5. Real recipe times: planned vs actual minutes, from the cooks' ticks.
// since(recipeId) → ms: shifts before a recipe's times were last updated
// are left out, so an update isn't suggested twice.
export function recipeTimes(history, today, days, since = () => 0) {
  const map = new Map();
  for (const r of history) {
    if (!inRange(r.date, today, days)) continue;
    for (const it of r.items) {
      if (!it.recipeId || it.actualSpan == null || !it.plannedSpan) continue;
      if (r.closedAt <= since(it.recipeId)) continue;
      const e = map.get(it.recipeId) ?? { recipeId: it.recipeId, name: it.name, n: 0, planned: 0, actual: 0, handsOn: 0 };
      e.n += 1;
      e.planned += it.plannedSpan;
      e.actual += it.actualSpan;
      e.handsOn += it.handsOn;
      map.set(it.recipeId, e);
    }
  }
  return sortBy(
    [...map.values()].map((e) => ({
      ...e,
      planned: e.planned / e.n,
      actual: e.actual / e.n,
      handsOn: e.handsOn / e.n,
      diffPct: ((e.actual - e.planned) / e.planned) * 100,
    })),
    (e) => Math.abs(e.diffPct)
  );
}

// The extra (or saved) time comes out of hands-on work: hands-off times like
// a 2-hour chill don't change with who's cooking. Returns the factor to apply
// to each active step, kept between 0.5× and 2×.
export function activeFactor(row) {
  if (!(row.handsOn > 0)) return 1;
  const f = (row.handsOn + (row.actual - row.planned)) / row.handsOn;
  return Math.min(2, Math.max(0.5, f));
}

// 6. Shortage history from the cooks' SHORT alerts.
export function shortageHistory(alerts, today, days) {
  const map = new Map();
  for (const a of alerts) {
    if (a.type !== "short" || !inRange(a.date, today, days)) continue;
    const key = a.ingredient.toLowerCase();
    const e = map.get(key) ?? { name: a.ingredient, count: 0, shortG: 0, last: a.date, stations: new Set() };
    e.count += 1;
    e.shortG += Math.max(0, a.needG - a.haveG);
    if (a.date > e.last) e.last = a.date;
    e.stations.add(a.station);
    map.set(key, e);
  }
  return sortBy([...map.values()].map((e) => ({ ...e, stations: [...e.stations] })), (e) => e.count * 1e6 + e.shortG);
}

// 7. Theoretical vs actual food cost. Theoretical = what the prep the cooks
// finished should have cost from the recipes and prices; actual = the food
// purchases typed in on Home.
export function foodCost(history, daily, costOfRecipe, today, days) {
  let theoretical = 0;
  let unpricedG = 0;
  for (const r of history) {
    if (!inRange(r.date, today, days)) continue;
    for (const it of r.items) {
      if (!it.done) continue;
      const cpg = it.recipeId ? costOfRecipe(it.recipeId) : null;
      if (cpg == null) unpricedG += it.makeG;
      else theoretical += it.makeG * cpg;
    }
  }
  let actual = 0;
  let sales = 0;
  for (const [date, d] of Object.entries(daily)) {
    if (!inRange(date, today, days)) continue;
    actual += Number(d.food) || 0;
    sales += Number(d.sales) || 0;
  }
  return {
    theoretical,
    actual,
    sales,
    unpricedG,
    variance: actual - theoretical,
    theoreticalPct: sales ? (theoretical / sales) * 100 : null,
    actualPct: sales ? (actual / sales) * 100 : null,
  };
}
