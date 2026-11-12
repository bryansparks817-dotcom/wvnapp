import { useState } from "react";
import { CheckBox, PassHeader, TabBar } from "./Chrome";
import { NoteCard } from "./CountScreen";
import { formatMinutes } from "../lib/format";
import { containerLabel, formatG, shelfLabel } from "../lib/inventory";
import PrepSteps from "./PrepSteps";
import GatherList from "./GatherList";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dateLine() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function stamp(m) {
  if (!m) return "";
  const time = new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${m.by ?? ""} · ${time}`;
}

// The 86 board, plus a way for the cook to raise an 86 or a running-low.
function FlagBoard({ flags, items, onAdd, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pass__flags">
      {flags.length > 0 && (
        <div className="pass__86">
          <span className="pass__86label">86 / LOW</span>
          {flags.map((f) => (
            <button
              key={f.name}
              type="button"
              className={`pass__86chip${f.kind === "low" ? " is-low" : ""}`}
              onClick={() => onRemove(f.name)}
              aria-label={`Clear ${f.kind === "low" ? "running low" : "86"}: ${f.name}`}
            >
              {f.kind === "low" ? "LOW " : "86 "}
              {f.name}
              {f.by ? ` · ${f.by}` : ""} ✕
            </button>
          ))}
        </div>
      )}
      <button type="button" className="pass__flagbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Done flagging" : "+ Flag 86 / running low"}
      </button>
      {open && (
        <ul className="pass__flaglist">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span className="pass__flagactions">
                <button type="button" onClick={() => onAdd(item.name, "low")}>LOW</button>
                <button type="button" onClick={() => onAdd(item.name, "86")}>86</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Changes the chef made to this list: do-first, skips, one-off items. The
// cook taps GOT IT; acknowledged ones drop off.
function ChefCard({ notes, onAck }) {
  const open = notes.filter((m) => !m.seenAt);
  if (open.length === 0) return null;
  return (
    <section className="pass__chefcard" aria-label="From the chef">
      <span className="pass__countlabel">FROM CHEF</span>
      {open.map((m) => (
        <div key={m.id} className="pass__chefmsg">
          <span className="pass__rowtext">
            <span className="pass__rowname">{m.text}</span>
            <span className="pass__rowsub">{m.by} · {new Date(m.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          </span>
          <button type="button" className="pass__chefack" onClick={() => onAck(m.id)}>GOT IT</button>
        </div>
      ))}
    </section>
  );
}

const WHERE = { lowboy: "LOWBOY", "walk-in": "WALK-IN" };

function TakeLine({ item, take, today }) {
  return (
    <span className="pass__take">
      <span className="pass__where">{WHERE[take.where]}</span> {containerLabel(take)}
      <span className="pass__muted"> · {shelfLabel(item, take.madeOn, today)}</span>
    </span>
  );
}

export default function TodayScreen({
  station, screen, setScreen, onOpenChef, initials, onChangeCook,
  hasClose, lastNotes, flags, onAddFlag, onRemoveFlag, items, itemsById, today,
  collect, chefNotes = [], bump = null, onAckChef, gather, gathered, short, onShort, cantMake, gatherDone, onToggleGather, onFinishGather, onReopenGather, tossOnly, plan, done, stepsDone, meta, wasteToday, timers, onToggle, onToggleStep, onOpenPrep, onStartTimer,
}) {
  const header = { station, initials, onChangeCook };
  if (!hasClose) {
    return (
      <div className="pass">
        <PassHeader {...header}>
          <span className="pass__date">{dateLine()}</span>
          <h1 className="pass__title">No close count yet</h1>
          <p className="pass__lede">Your list builds itself from the last shift’s close count.</p>
        </PassHeader>
        <main className="pass__main">
          <section className="pass__gate">
            <p className="pass__hint">At the end of every shift, count your line pans and lowboy. The next shift’s Collect and Prep come from that.</p>
            <button type="button" className="pass__cta" onClick={() => setScreen("close")}>
              CLOSE COUNT →
            </button>
          </section>
          <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
        </main>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  const hasGather = gather.items.length > 0 || gather.missing.length > 0;
  if (hasGather && !gatherDone) {
    const got = gather.items.filter((g) => gathered[g.name.toLowerCase()]).length;
    return (
      <div className="pass">
        <PassHeader {...header}>
          <span className="pass__date">{dateLine()} · COUNT CONFIRMED</span>
          <h1 className="pass__title">Gather</h1>
          <p className="pass__lede">Pull these from the walk-in and dry storage first. Amounts cover all of today’s prep.</p>
        </PassHeader>
        <main className="pass__main">
          <ChefCard notes={chefNotes} onAck={onAckChef} />
          <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
          {lastNotes && <NoteCard notes={lastNotes} />}
          <section>
            <div className="pass__sectionhead">
              <h2>GATHER LIST</h2>
              <span className="pass__mono pass__amber">{got} of {gather.items.length}</span>
            </div>
            <GatherList gather={gather} gathered={gathered} short={short} onToggle={onToggleGather} onShort={onShort} />
          </section>
        </main>
        <div className="pass__footer">
          <button type="button" className="pass__cta" onClick={onFinishGather}>
            FINISH · TO COLLECT &amp; PREP →
          </button>
          {got < gather.items.length && <span className="pass__hint">{gather.items.length - got} not ticked yet. You can still go on.</span>}
        </div>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  const collectDone = collect.filter((r) => done[`c:${r.id}`]).length;
  const prepRows = [...new Map(plan.steps.filter((s) => s.item).map((s) => [s.item.id, s.item])).values(), ...plan.untimed];
  const prepTotal = prepRows.length + tossOnly.length;
  const prepDone = [...prepRows, ...tossOnly].filter((r) => done[`p:${r.id}`]).length;
  const wasteG = wasteToday.reduce((s, w) => s + w.grams, 0);

  return (
    <div className="pass">
      <PassHeader {...header}>
        <span className="pass__date">{dateLine()} · COUNT CONFIRMED</span>
        <h1 className="pass__title">Today</h1>
      </PassHeader>
      <main className="pass__main">
        <ChefCard notes={chefNotes} onAck={onAckChef} />
        <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
        {lastNotes && !hasGather && <NoteCard notes={lastNotes} />}
        {hasGather && (
          <button type="button" className="pass__ghost pass__backgather" onClick={onReopenGather}>
            ‹ Back to gather list
          </button>
        )}

        <section>
          <div className="pass__sectionhead">
            <h2><span className="pass__vine">1</span> · COLLECT</h2>
            <span className="pass__mono pass__vine">{collectDone} of {collect.length}</span>
          </div>
          <p className="pass__hint">Already made. Oldest first. Top up and get it off your mind.</p>
          {collect.length === 0 && <p className="pass__empty">Nothing to collect.</p>}
          <ul className="pass__list">
            {collect.map((row) => {
              const item = itemsById.get(row.id);
              const isDone = Boolean(done[`c:${row.id}`]);
              return (
                <li key={row.id}>
                  <button type="button" aria-pressed={isDone} className={`pass__row pass__row--tall${isDone ? " pass__row--done" : ""}`} onClick={() => onToggle("c", row)}>
                    <CheckBox checked={isDone} />
                    <span className="pass__rowtext">
                      <span className="pass__rowname">{item.name}</span>
                      {isDone && <span className="pass__rowsub">✓ {stamp(meta[`c:${row.id}`])}</span>}
                      {!isDone && row.toLine.length > 0 && (
                        <span className="pass__takes">
                          <span className="pass__takehead">TO LINE ({item.pan} pan)</span>
                          {row.toLine.map((t, i) => <TakeLine key={i} item={item} take={t} today={today} />)}
                        </span>
                      )}
                      {!isDone && row.toLowboy.length > 0 && (
                        <span className="pass__takes">
                          <span className="pass__takehead">TO LOWBOY</span>
                          {row.toLowboy.map((t, i) => <TakeLine key={i} item={item} take={t} today={today} />)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <div className="pass__sectionhead">
            <h2><span className="pass__amber">2</span> · PREP</h2>
            <span className="pass__mono pass__amber">{prepDone} of {prepTotal}</span>
          </div>
          <p className="pass__hint">
            One step at a time, in order. The long hands-off recipe starts first and the rest fill its downtime. Tap a step for the scaled recipe.
            {plan.totalMinutes > 0 && ` About ${formatMinutes(plan.totalMinutes)} start to finish.`}
          </p>
          {prepTotal === 0 && <p className="pass__empty">Nothing to prep from scratch.</p>}
          {cantMake.length > 0 && (
            <p className="pass__holdnote pass__cantmake">
              CAN’T MAKE · {cantMake.map((r) => `${r.name} (out of ${r.limitedBy.map((l) => l.name).join(", ")})`).join("; ")}. Chef alerted.
            </p>
          )}
          <PrepSteps
            plan={plan}
            bump={bump}
            tossOnly={tossOnly}
            done={done}
            stepsDone={stepsDone}
            timers={timers}
            onToggleStep={onToggleStep}
            onToggleItem={(row) => onToggle("p", row)}
            onOpenPrep={onOpenPrep}
            onStartTimer={onStartTimer}
          />
          {wasteG > 0 && (
            <p className="pass__waste">
              Tossed today: {formatG(wasteG)} ({wasteToday.map((w) => w.name).join(", ")}). Logged for food cost.
            </p>
          )}
        </section>
      </main>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}
