// Hole plugging: the chef's changes to a cook's prep list. Each change is
// saved on that station's shift and leaves a message the cook sees at the top
// of their screen ("FROM CHEF"). Until the shared database exists this only
// reaches cooks on the same phone.
import { loadShift, saveShift } from "./storage";
import { formatG } from "./inventory";

function update(stationId, change, message) {
  const shift = loadShift(stationId);
  if (!shift) return null;
  const next = change({ ...shift });
  next.chef = [...(shift.chef ?? []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...message, at: Date.now() }];
  saveShift(next, stationId);
  return next;
}

// "Do this first": flags one item; the cook's list tags its steps.
export function bumpItem(stationId, row, by) {
  return update(stationId, (s) => ({ ...s, bump: row.id }), { kind: "bump", itemId: row.id, text: `Do ${row.name} first.`, by });
}

// Take an item off (or put it back on) today's list.
export function skipItem(stationId, row, skip, by) {
  return update(
    stationId,
    (s) => {
      const next = { ...(s.skip ?? {}) };
      if (skip) next[row.id] = true;
      else delete next[row.id];
      return { ...s, skip: next, bump: skip && s.bump === row.id ? null : s.bump };
    },
    { kind: skip ? "skip" : "unskip", itemId: row.id, text: skip ? `Skip ${row.name} today.` : `${row.name} is back on your list.`, by }
  );
}

// A one-off item from a recipe, on top of what the count asked for. It has no
// line pan or par, so finishing it doesn't touch the count or print a label.
export function addItem(stationId, recipe, grams, by) {
  const id = `extra-${recipe.id}-${Date.now()}`;
  const row = { id, name: recipe.name, recipeId: recipe.id, makeG: grams, toss: [], extra: true, addedBy: by };
  return update(stationId, (s) => ({ ...s, prep: [...s.prep, row] }), {
    kind: "add",
    itemId: id,
    text: `Added ${recipe.name}: make ${formatG(grams)}.`,
    by,
  });
}
