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

// One plain numbered list: toss what's expired, then each prep step in the
// optimized order, then anything without recipe times yet. The first step not
// yet ticked is "NOW".
export default function PrepSteps({ plan, tossOnly, done, stepsDone, holds = {}, timers, onToggleStep, onToggleItem, onOpenPrep, onStartTimer }) {
  const running = new Set(timers.map((t) => t.label));
  const itemDone = (id) => Boolean(done[`p:${id}`]);
  const stepDone = (s) => (s.item && itemDone(s.item.id)) || Boolean(stepsDone[s.key]);

  const rows = [
    ...tossOnly.map((row) => ({ type: "toss", row, done: itemDone(row.id) })),
    ...plan.steps.map((s) => ({ type: s.kind === "wait" ? "wait" : "step", step: s, done: s.kind !== "wait" && stepDone(s) })),
    ...plan.untimed.map((row) => ({ type: "untimed", row, done: itemDone(row.id) })),
  ];
  const nowIndex = rows.findIndex((r) => r.type !== "wait" && !r.done);
  let n = 0;

  return (
    <ol className="pass__list pass__steplist">
      {rows.map((r, i) => {
        const isNow = i === nowIndex;
        if (r.type === "wait") {
          const s = r.step;
          return (
            <li key={s.key} className="pass__waitstep">
              WAIT ~{formatMinutes(s.minutes)}
              {s.on && <> · {s.on.name} still on “{lower(s.on.step)}”</>}. Clean down, restock, help the line.
            </li>
          );
        }
        n += 1;
        const num = n;
        const cls = `pass__row pass__row--split pass__stepcard${r.done ? " pass__row--done" : ""}${isNow ? " pass__row--lead" : ""}`;

        if (r.type === "toss" || r.type === "untimed") {
          const row = r.row;
          return (
            <li key={`${r.type}:${row.id}`}>
              <div className={cls}>
                <button type="button" className="pass__checkbtn" aria-pressed={r.done} aria-label={`${r.done ? "Undo" : "Done"}: ${row.name}`} onClick={() => onToggleItem(row)}>
                  {r.done ? <CheckBox checked tone="amber" /> : <span className="pass__step">{num}</span>}
                </button>
                <button type="button" className="pass__rowopen" onClick={() => (r.type === "toss" ? onToggleItem(row) : onOpenPrep(row.id))}>
                  <span className="pass__rowtext">
                    <span className="pass__steptag">{isNow ? "NOW · " : ""}{r.type === "toss" ? "TOSS · LAST DAY" : "NO RECIPE TIMES YET"}</span>
                    <span className="pass__rowname">{r.type === "toss" ? `Toss ${row.name}` : row.name}</span>
                    {r.type === "toss" && <span className="pass__rowsub">{row.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", ")}. Enough backup left, no prep.</span>}
                  </span>
                  {r.type === "untimed" && (
                    <span className="pass__rowend">
                      <span className="pass__mono pass__amber">{formatG(row.makeG)}</span>
                      <span className="pass__open">RECIPE ›</span>
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        }

        const s = r.step;
        const row = s.item;
        const first = s.handsOff[0];
        const timerLabel = first ? `${s.name}: ${first.step}` : null;
        const timing = [
          s.handsOn > 0 ? `${formatMinutes(s.handsOn)} hands-on` : null,
          s.handsOff.length ? `then ${s.handsOff.map((h) => `${lower(h.step)} ${formatMinutes(h.minutes)}`).join(", ")}` : null,
        ].filter(Boolean).join(" · ");
        return (
          <li key={s.key}>
            <div className={cls}>
              <button
                type="button"
                className="pass__checkbtn"
                aria-pressed={r.done}
                aria-label={`${r.done ? "Undo" : "Done"}: step ${num}, ${s.name}`}
                onClick={() => onToggleStep(s, r.done)}
              >
                {r.done ? <CheckBox checked tone="amber" /> : <span className="pass__step">{num}</span>}
              </button>
              <button type="button" className="pass__rowopen" onClick={() => row && onOpenPrep(row.id)}>
                <span className="pass__rowtext">
                  <span className="pass__steptag">{isNow ? "NOW · " : ""}{tagFor(s)}</span>
                  <span className="pass__rowname">{s.name}{s.firstForItem && row && <span className="pass__mono pass__amber"> · make {formatG(row.makeG)}</span>}</span>
                  {!r.done && row && holds[row.name] && (
                    <span className="pass__holdnote">ON HOLD · short on {holds[row.name].join(", ")}. Chef alerted. No partial batch.</span>
                  )}
                  {!r.done && <span className="pass__stepdo">{whatToDo(s)}</span>}
                  {!r.done && timing && <span className="pass__rowsub">{timing}</span>}
                  {!r.done && s.firstForItem && row?.toss?.length > 0 && (
                    <span className="pass__toss">TOSS {row.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", ")} first · last day</span>
                  )}
                  {!r.done && s.lastForItem && <span className="pass__rowsub pass__vine">LAST STEP · ticking it restocks and labels</span>}
                </span>
              </button>
              {!r.done && first && (
                <TimerButton label={timerLabel} minutes={first.minutes} running={running.has(timerLabel)} onStart={onStartTimer} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
