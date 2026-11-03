import { useState } from "react";
import { CheckBox, PassHeader, TabBar } from "./Chrome";
import { NoteCard } from "./CountScreen";
import { formatMinutes } from "../lib/format";
import { containerLabel, formatG, shelfLabel } from "../lib/inventory";

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

const WHERE = { lowboy: "LOWBOY", "walk-in": "WALK-IN" };

function TakeLine({ item, take, today }) {
  return (
    <span className="pass__take">
      <span className="pass__where">{WHERE[take.where]}</span> {containerLabel(take)}
      <span className="pass__muted"> · {shelfLabel(item, take.madeOn, today)}</span>
    </span>
  );
}

function tossText(row) {
  return row.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", ");
}

// A prep row: the check on the left marks it done; the rest opens the recipe.
function PrepRow({ row, done, meta, step, lead, title, sub, showAmount, onToggle, onOpen }) {
  return (
    <div className={`pass__row pass__row--split${done ? " pass__row--done" : ""}${lead ? " pass__row--lead" : ""}`}>
      <button type="button" className="pass__checkbtn" aria-pressed={done} aria-label={`${done ? "Undo" : "Mark done"}: ${row.name}`} onClick={onToggle}>
        {done || step == null ? <CheckBox checked={done} tone="amber" /> : <span className="pass__step">{step}</span>}
      </button>
      <button type="button" className="pass__rowopen" onClick={onOpen}>
        <span className="pass__rowtext">
          <span className="pass__rowname">{title}</span>
          {sub && <span className="pass__rowsub">{sub}</span>}
          {done && meta && <span className="pass__rowsub">✓ {stamp(meta)}</span>}
          {!done && row.toss?.length > 0 && <span className="pass__toss">TOSS {tossText(row)} · last day</span>}
        </span>
        {showAmount && (
          <span className="pass__rowend">
            <span className="pass__mono pass__amber">{formatG(row.makeG)}</span>
            <span className="pass__open">RECIPE ›</span>
          </span>
        )}
      </button>
    </div>
  );
}

export default function TodayScreen({
  station, screen, setScreen, onOpenChef, initials, onChangeCook,
  hasClose, lastNotes, flags, onAddFlag, onRemoveFlag, items, itemsById, today,
  collect, tossOnly, plan, done, meta, wasteToday, onToggle, onOpenPrep, onLoadSample,
}) {
  const header = { station, initials, onChangeCook };
  if (!hasClose) {
    return (
      <div className="pass">
        <PassHeader {...header}>
          <span className="pass__date">{dateLine()}</span>
          <h1 className="pass__title">No close count yet</h1>
          <p className="pass__lede">Your list builds itself from last night’s close count.</p>
        </PassHeader>
        <main className="pass__main">
          <section className="pass__gate">
            <p className="pass__hint">At the end of the night, count your line pans and lowboy. Tomorrow’s Collect and Prep come from that.</p>
            <button type="button" className="pass__cta" onClick={() => setScreen("close")}>
              CLOSE COUNT →
            </button>
            <button type="button" className="pass__ghost" onClick={onLoadSample}>
              Try it with a sample close
            </button>
          </section>
          <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
        </main>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  const collectDone = collect.filter((r) => done[`c:${r.id}`]).length;
  const prepRows = [...new Map(plan.blocks.filter((b) => b.item).map((b) => [b.item.id, b.item])).values(), ...plan.untimed];
  const prepTotal = prepRows.length + tossOnly.length;
  const prepDone = [...prepRows, ...tossOnly].filter((r) => done[`p:${r.id}`]).length;
  const wasteG = wasteToday.reduce((s, w) => s + w.grams, 0);
  let lastDuring = null;

  return (
    <div className="pass">
      <PassHeader {...header}>
        <span className="pass__date">{dateLine()} · COUNT CONFIRMED</span>
        <h1 className="pass__title">Today</h1>
      </PassHeader>
      <main className="pass__main">
        <FlagBoard flags={flags} items={items} onAdd={onAddFlag} onRemove={onRemoveFlag} />
        {lastNotes && <NoteCard notes={lastNotes} />}

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
            Tap an item for its recipe, scaled. Start the long one, fill its downtime.
            {plan.totalMinutes > 0 && ` About ${formatMinutes(plan.totalMinutes)} total.`}
          </p>
          {prepTotal === 0 && <p className="pass__empty">Nothing to prep from scratch.</p>}
          <ol className="pass__list">
            {plan.blocks.map((block, i) => {
              const row = block.item;
              if (!row) return null;
              const key = `p:${row.id}`;
              const duringLabel = block.during ? `${block.during.name}: ${block.during.step}` : null;
              const showDuring = duringLabel && duringLabel !== lastDuring;
              lastDuring = duringLabel;
              return (
                <li key={`${block.trackId}#${i}`} className={block.during ? "pass__while" : undefined}>
                  {showDuring && <span className="pass__whilelabel">WHILE {block.during.name.toUpperCase()} · {block.during.step.toLowerCase()}</span>}
                  <PrepRow
                    row={row}
                    done={Boolean(done[key])}
                    meta={block.firstForRecipe ? meta[key] : null}
                    step={i + 1}
                    lead={!block.during && i === 0}
                    title={block.firstForRecipe ? block.name : `Back to ${block.name}`}
                    sub={`${formatMinutes(block.end - block.start)} hands-on${block.thenPassive ? ` · then ${formatMinutes(block.thenPassive.minutes)} ${block.thenPassive.step.toLowerCase()}` : ""}`}
                    showAmount={block.firstForRecipe}
                    onToggle={() => onToggle("p", row)}
                    onOpen={() => onOpenPrep(row.id)}
                  />
                </li>
              );
            })}
          </ol>
          {plan.untimed.length > 0 && (
            <>
              <span className="pass__whilelabel">NO RECIPE TIMES YET</span>
              <ul className="pass__list">
                {plan.untimed.map((row) => (
                  <li key={row.id}>
                    <PrepRow
                      row={row}
                      done={Boolean(done[`p:${row.id}`])}
                      meta={meta[`p:${row.id}`]}
                      title={row.name}
                      showAmount
                      onToggle={() => onToggle("p", row)}
                      onOpen={() => onOpenPrep(row.id)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          {tossOnly.length > 0 && (
            <>
              <span className="pass__whilelabel">TOSS ONLY · enough backup left</span>
              <ul className="pass__list">
                {tossOnly.map((row) => (
                  <li key={row.id}>
                    <PrepRow
                      row={row}
                      done={Boolean(done[`p:${row.id}`])}
                      meta={meta[`p:${row.id}`]}
                      title={row.name}
                      onToggle={() => onToggle("p", row)}
                      onOpen={() => onToggle("p", row)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
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
