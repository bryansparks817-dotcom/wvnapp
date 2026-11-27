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
    if (!stepDone(st)) left += st.handsOn ?? 0;
    end = Math.max(end, stepEnd);
    if (id) {
      const cur = span[id] ?? { name: st.item.name, start: st.at, end: stepEnd };
      span[id] = { ...cur, start: Math.min(cur.start, st.at), end: Math.max(cur.end, stepEnd) };
    }
  }
  const last = Object.values(span).sort((a, b) => b.end - a.end)[0];
  return {
    total: Math.round(end),
    handsOn: Math.round(handsOn),
    handsOnLeft: Math.round(left),
    count: made.length,
    longest: last ? { name: last.name, minutes: Math.round(last.end - last.start) } : null,
    tomorrow: [...tomorrow.values()].map((t) => ({ name: t.name, handsOn: Math.round(t.handsOn) })),
  };
}
