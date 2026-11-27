// A line cook asks Prep to take a recipe off their list (Bryan, 2026-11-27).
// Allowed only if Prep still finishes by the prep deadline (4:30) and nothing
// needed tonight gets bumped. Items on Prep's list that are for tomorrow (added
// by hand, not for a line station's shortfall, or resting overnight anyway)
// can be bumped to tomorrow to make room.
import { closeNeeds, holdsBackup } from "./backupStock";
import { prepForecast, prepTime } from "./prepTime";
import { loadShift } from "./storage";

const recipeKey = (i) => i.recipeId ?? i.id;

export const prepStation = (stations) => stations.find(holdsBackup) ?? null;

// The Prep item that makes this line row's recipe, if any.
export function prepItemFor(row, stations) {
  const prep = prepStation(stations);
  return prep?.items.find((i) => recipeKey(i) === recipeKey(row)) ?? null;
}

// Prep's list as it stands: its built shift today, or what it would build
// from the line closes.
function prepList(prep, stations, today) {
  const sh = loadShift(prep.id);
  if (sh && !sh.closedAt && sh.date === today) {
    return { built: true, shift: sh, rows: sh.prep.filter((p) => p.makeG > 0 && !sh.skip?.[p.id]), progress: { done: sh.done ?? {}, stepsDone: sh.stepsDone ?? {} }, startAt: sh.startedAt ?? null };
  }
  const { byItem } = closeNeeds(prep, stations);
  const rows = prep.items.filter((i) => byItem[i.id] > 0).map((i) => {
    const g = Math.ceil(byItem[i.id] / 50) * 50;
    return { id: i.id, recipeId: i.recipeId, name: i.name, makeG: g, toss: [], askedG: g };
  });
  return { built: false, shift: null, rows, progress: null, startAt: null };
}

const forecast = (rows, recipesById, list, now, prepDueAt) => {
  const t = prepTime(rows, recipesById, list.progress);
  return { t, f: prepForecast(t, { startAt: list.startAt, now, prepDueAt }) };
};

// → { ok, prepItem, doneAt, bump: [{ id, name }], reason }
export function askCheck({ row, stations, recipesById, today, now = Date.now(), prepDueAt }) {
  const prep = prepStation(stations);
  const prepItem = prepItemFor(row, stations);
  if (!prep || !prepItem) return { ok: false, reason: "Prep doesn’t make this recipe." };
  const list = prepList(prep, stations, today);
  if (list.built && list.shift.done?.[`p:${prepItem.id}`]) return { ok: false, prepItem, reason: "Prep already finished this today. Ask them what’s left." };
  const addTo = (rows) => (rows.some((p) => p.id === prepItem.id)
    ? rows.map((p) => (p.id === prepItem.id ? { ...p, makeG: p.makeG + row.makeG, askedG: (p.askedG ?? 0) + row.makeG } : p))
    : [...rows, { id: prepItem.id, recipeId: prepItem.recipeId, name: prepItem.name, makeG: row.makeG, toss: [], askedG: row.makeG }]);
  let rows = addTo(list.rows);
  let { t, f } = forecast(rows, recipesById, list, now, prepDueAt);
  const fits = () => f.doneAt == null || f.doneAt <= prepDueAt;
  if (fits()) return { ok: true, prepItem, doneAt: f.doneAt, bump: [] };

  // Make room with tomorrow's items: not for a line shortfall (hand-added) or
  // resting overnight anyway, and not started yet. Latest-finishing first.
  const started = (id) => Boolean(list.progress?.done?.[`p:${id}`]) || Object.keys(list.progress?.stepsDone ?? {}).some((k) => k.startsWith(`${recipeKey(list.rows.find((r) => r.id === id) ?? { id })}#`));
  const overnight = new Set(t.items.filter((i) => i.overnight).map((i) => i.id));
  const ends = Object.fromEntries(t.items.map((i) => [i.id, i.end]));
  const candidates = list.rows
    .filter((r) => r.id !== prepItem.id && !started(r.id) && (!(r.askedG > 0) || overnight.has(r.id)))
    .sort((a, b) => (ends[b.id] ?? 0) - (ends[a.id] ?? 0));
  const bump = [];
  for (const c of candidates) {
    bump.push({ id: c.id, name: c.name });
    rows = rows.filter((r) => r.id !== c.id);
    ({ t, f } = forecast(rows, recipesById, list, now, prepDueAt));
    if (fits()) return { ok: true, prepItem, doneAt: f.doneAt, bump };
  }
  return { ok: false, prepItem, doneAt: f.doneAt, reason: "Prep can’t fit it before the deadline without bumping something the line needs tonight." };
}
