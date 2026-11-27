import { useState } from "react";
import { CheckBox } from "./Chrome";
import { formatMinutes } from "../lib/format";
import { containerLabel, formatG } from "../lib/inventory";

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// The little tag above each step that says why it sits where it does.
function tagFor(step) {
  if (step.kind === "start") return step.handsOff.length ? "START FIRST · LONGEST HANDS-OFF TIME" : "START HERE";
  if (step.kind === "fill") return `WHILE ${step.during.name.toUpperCase()} · ${lower(step.during.step)}`;
  if (step.kind === "back") return `BACK TO ${step.name.toUpperCase()}`;
  return "NEXT";
}

function whatToDo(step) {
  if (step.actions.length === 0) return step.handsOff.map((h) => h.step).join(" → ");
  if (step.actions.length <= 3) return step.actions.join(" → ");
  return `${step.actions.slice(0, 3).join(" → ")} + ${step.actions.length - 3} more`;
}

function TimerButton({ label, minutes, running, onStart }) {
  return (
    <button type="button" className="pass__timerbtn pass__steptimer" disabled={running} onClick={() => onStart(label, minutes)}>
      {running ? "RUNNING" : `TIMER ${formatMinutes(minutes)}`}
    </button>
  );
}

// Hands-on plus hands-off time for one item's own steps.
function itemMinutes(steps) {
  return steps.reduce((sum, s) => sum + s.handsOn + s.handsOff.reduce((t, h) => t + h.minutes, 0), 0);
}

function StepRow({ s, done, isNow, running, onToggleStep, onStartTimer }) {
  const first = s.handsOff[0];
  const timerLabel = first ? `${s.name}: ${first.step}` : null;
  const timing = [
    s.handsOn > 0 ? `${formatMinutes(s.handsOn)} hands-on` : null,
    s.handsOff.length ? `then ${s.handsOff.map((h) => `${lower(h.step)} ${formatMinutes(h.minutes)}`).join(", ")}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <li className={`pass__substep${done ? " is-done" : ""}${isNow ? " is-now" : ""}`}>
      <button type="button" className="pass__subcheck" aria-pressed={done} aria-label={`${done ? "Undo" : "Done"}: ${s.actions.join(", ") || s.name}`} onClick={() => onToggleStep(s, done)}>
        <CheckBox checked={done} tone="amber" />
      </button>
      <span className="pass__rowtext">
        <span className="pass__steptag">{isNow ? "NOW · " : ""}{tagFor(s)}</span>
        <span className="pass__stepdo">{whatToDo(s)}</span>
        {!done && timing && <span className="pass__rowsub">{timing}</span>}
        {!done && s.lastForItem && <span className="pass__rowsub pass__vine">LAST STEP · ticking it finishes the item</span>}
      </span>
      {!done && first && <TimerButton label={timerLabel} minutes={first.minutes} running={running.has(timerLabel)} onStart={onStartTimer} />}
    </li>
  );
}

// One row per prep item, in the optimized order (the long hands-off recipe
// first). Each row shows only what's next; tap STEPS to open the item's
// steps, or QUICK FINISH to check the whole item off at once.
export default function PrepSteps({ plan, bump = null, tossOnly, done, stepsDone, timers, onToggleStep, onToggleItem, onOpenPrep, onStartTimer, onAsk = null }) {
  const [open, setOpen] = useState(() => new Set());
  const running = new Set(timers.map((t) => t.label));
  const itemDone = (id) => Boolean(done[`p:${id}`]);
  const stepDone = (s) => (s.item && itemDone(s.item.id)) || s.parts.every((p) => stepsDone[p]);
  const toggleOpen = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Group the timed steps by item, keeping the order items first appear.
  const groups = new Map();
  for (const s of plan.steps) {
    if (s.kind === "wait" || !s.item) continue;
    if (!groups.has(s.item.id)) groups.set(s.item.id, { row: s.item, steps: [] });
    groups.get(s.item.id).steps.push(s);
  }
  // The next step to do across the whole list is "NOW".
  const nowStep = plan.steps.find((s) => s.kind !== "wait" && !stepDone(s));

  const rows = [
    ...tossOnly.map((row) => ({ type: "toss", row, done: itemDone(row.id) })),
    ...[...groups.values()].map((g) => ({ type: "item", ...g, done: itemDone(g.row.id) })),
    ...plan.untimed.map((row) => ({ type: "untimed", row, done: itemDone(row.id) })),
  ];
  const nowRow = rows.findIndex((r) => !r.done && (r.type !== "item" || r.steps.includes(nowStep)));

  return (
    <ol className="pass__list pass__steplist">
      {rows.map((r, i) => {
        const row = r.row;
        const num = i + 1;
        const isNow = i === nowRow;
        const cls = `pass__row pass__row--split pass__stepcard${r.done ? " pass__row--done" : ""}${isNow ? " pass__row--lead" : ""}`;
        const check = (
          <button type="button" className="pass__checkbtn" aria-pressed={r.done} aria-label={`${r.done ? "Undo" : "Done"}: ${row.name}`} onClick={() => onToggleItem(row)}>
            {r.done ? <CheckBox checked tone="amber" /> : <span className="pass__step">{num}</span>}
          </button>
        );

        if (r.type === "toss") {
          return (
            <li key={`toss:${row.id}`}>
              <div className={cls}>
                {check}
                <button type="button" className="pass__rowopen" onClick={() => onToggleItem(row)}>
                  <span className="pass__rowtext">
                    <span className="pass__steptag">{isNow ? "NOW · " : ""}TOSS · LAST DAY</span>
                    <span className="pass__rowname">Toss {row.name}</span>
                    <span className="pass__rowsub">{row.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", ")}. Enough backup left, no prep.</span>
                  </span>
                </button>
              </div>
            </li>
          );
        }

        const steps = r.steps ?? [];
        const left = steps.filter((s) => !stepDone(s));
        const next = left[0];
        const expanded = open.has(row.id);
        const minutes = itemMinutes(steps);
        return (
          <li key={`${r.type}:${row.id}`}>
            <div className={cls}>
              {check}
              <button type="button" className="pass__rowopen" onClick={() => onOpenPrep(row.id)}>
                <span className="pass__rowtext">
                  {!r.done && bump && row.id === bump && <span className="pass__chefbump">CHEF: DO THIS FIRST</span>}
                  <span className="pass__steptag">
                    {isNow ? "NOW · " : ""}
                    {r.type === "untimed" ? "NO RECIPE TIMES YET" : r.done ? "DONE" : next ? tagFor(next) : "NEXT"}
                  </span>
                  <span className="pass__rowname">{row.name}</span>
                  <span className="pass__rowsub">
                    <span className="pass__mono pass__amber">{formatG(row.makeG)}</span>
                    {minutes > 0 && ` · ${formatMinutes(minutes)}`}
                    {steps.length > 0 && !r.done && ` · ${steps.length - left.length} of ${steps.length} steps`}
                  </span>
                  {!r.done && row.limitedBy && (
                    <span className="pass__holdnote">
                      SCALED DOWN · short on {row.limitedBy.map((l) => `${l.name} (${formatG(l.haveG)} of ${formatG(l.needG)})`).join(", ")}. Making {formatG(row.makeG)}, not {formatG(row.plannedG)}. Chef alerted.
                    </span>
                  )}
                  {!r.done && row.toss?.length > 0 && (
                    <span className="pass__toss">TOSS {row.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", ")} first · last day</span>
                  )}
                  {!r.done && next && !expanded && <span className="pass__stepdo pass__nextline">Next: {whatToDo(next)}</span>}
                </span>
                <span className="pass__open">RECIPE ›</span>
              </button>
              {!r.done && (
                <div className="pass__itemactions">
                  {steps.length > 0 && (
                    <button type="button" className="pass__timerbtn" aria-expanded={expanded} onClick={() => toggleOpen(row.id)}>
                      {expanded ? "HIDE STEPS ▴" : `STEPS ▾`}
                    </button>
                  )}
                  <button type="button" className="pass__timerbtn pass__quickfinish" onClick={() => onToggleItem(row)}>
                    QUICK FINISH ✓
                  </button>
                  {onAsk?.(row) && steps.length - left.length === 0 && (
                    <button type="button" className="pass__timerbtn" onClick={onAsk(row)}>ASK PREP</button>
                  )}
                </div>
              )}
              {!r.done && expanded && (
                <ol className="pass__substeps">
                  {steps.map((s) => (
                    <StepRow key={s.key} s={s} done={stepDone(s)} isNow={s === nowStep} running={running} onToggleStep={onToggleStep} onStartTimer={onStartTimer} />
                  ))}
                </ol>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
