// How long a prep list takes today. Built from the prep list's steps
// (lib/lineList.js), where hands-off steps already overlap other work.
// An overnight rest (a hands-off step that says "overnight", or 8 hours or
// more) ends that item's work for today: the rest and anything after it
// (lift the fat, portion) happen tomorrow, so they don't count toward today.
import { buildPrepSteps } from "./lineList";

const OVERNIGHT_MIN = 480;
const isOvernight = (h) => h.minutes >= OVERNIGHT_MIN || /overnight/i.test(h.step ?? "");

// progress (optional): { done, stepsDone } from the shift. handsOnLeft is the
// hands-on time still to do today: steps not ticked, on items not finished.
export function prepTime(rows, recipesById, progress = null) {
  const { done = {}, stepsDone = {} } = progress ?? {};
  const stepDone = (st) => Boolean(st.item && done[`p:${st.item.id}`]) || (st.parts ?? []).every((p) => stepsDone[p]);
  const made = rows.filter((r) => r.makeG > 0);
  const plan = buildPrepSteps(made, recipesById);
  const tomorrow = new Map(); // item id → { name, handsOn }
  const span = {};
  let handsOn = 0;
  let left = 0;
  let end = 0;
  let nextAt = null; // plan minute of the first step not yet ticked
  for (const st of plan.steps) {
    if (st.kind === "wait") continue;
    const id = st.item?.id;
    if (id && tomorrow.has(id)) {
      tomorrow.get(id).handsOn += st.handsOn ?? 0;
      continue;
    }
    let stepEnd = st.at + (st.handsOn ?? 0);
    for (const h of st.handsOff ?? []) {
      if (isOvernight(h)) {
        if (id) tomorrow.set(id, { name: st.item.name, handsOn: 0 });
        break;
      }
      stepEnd += h.minutes;
    }
    handsOn += st.handsOn ?? 0;
    const open = !stepDone(st);
    if (open) {
      left += st.handsOn ?? 0;
      if (nextAt == null || st.at < nextAt) nextAt = st.at;
    }
    end = Math.max(end, stepEnd);
    if (id) {
      const cur = span[id] ?? { id, name: st.item.name, start: st.at, end: stepEnd, open: false };
      span[id] = { ...cur, start: Math.min(cur.start, st.at), end: Math.max(cur.end, stepEnd), open: cur.open || open };
    }
  }
  const last = Object.values(span).sort((a, b) => b.end - a.end)[0];
  return {
    total: Math.round(end),
    handsOn: Math.round(handsOn),
    handsOnLeft: progress ? Math.round(left) : null,
    count: made.length,
    longest: last ? { name: last.name, minutes: Math.round(last.end - last.start) } : null,
    nextAt,
    items: Object.values(span).map((t) => ({ ...t, overnight: tomorrow.has(t.id) })),
    tomorrow: [...tomorrow.values()].map((t) => ({ name: t.name, handsOn: Math.round(t.handsOn) })),
  };
}

// When the list will really be done, and what won't make the prep deadline.
// The plan's minutes count from startAt (when the cook finished gathering, or
// now if they haven't started). If the cook is behind the plan, the work still
// to do slides by that much. An item that can't finish by the deadline even if
// it were started right now holds over to tomorrow; one that could, if moved
// up, is marked "start next".
export function prepForecast(time, { startAt = null, now = Date.now(), prepDueAt }) {
  const start = startAt ?? now;
  const elapsed = Math.max(0, (now - start) / 60000);
  const lag = time.nextAt != null ? Math.max(0, elapsed - time.nextAt) : 0;
  const at = (min) => start + (min + lag) * 60000;
  const open = (time.items ?? []).filter((t) => t.open);
  const doneAt = open.length ? Math.max(...open.map((t) => at(t.end))) : null;
  const late = open
    .filter((t) => at(t.end) > prepDueAt)
    .sort((a, b) => b.end - a.end)
    .map((t) => {
      const fits = now + (t.end - t.start) * 60000 <= prepDueAt;
      return { id: t.id, name: t.name, endsAt: at(t.end), holdsOver: !fits, first: t.start <= 0, minutes: Math.round(t.end - t.start) };
    });
  // More hands-on work left than minutes before the deadline: something has
  // to hold over, and which is the chef's call.
  const minutesLeft = Math.max(0, Math.round((prepDueAt - now) / 60000));
  const overloaded = (time.handsOnLeft ?? time.handsOn) > minutesLeft;
  return { doneAt, late, overloaded, minutesLeft, behindMin: Math.round(lag), overByMin: doneAt ? Math.round((doneAt - prepDueAt) / 60000) : 0 };
}
