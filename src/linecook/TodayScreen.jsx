import { CheckBox, PassHeader, TabBar } from "./Chrome";
import { formatMinutes } from "../lib/format";
import { containerLabel, formatG, shelfLabel } from "../lib/inventory";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dateLine() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function EightySix({ items }) {
  if (items.length === 0) return null;
  return (
    <div className="pass__86">
      <span className="pass__86label">86</span>
      {items.map((name) => (
        <span key={name} className="pass__86chip">{name}</span>
      ))}
    </div>
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

export default function TodayScreen({
  station, screen, setScreen, onOpenChef,
  hasClose, eightySix, itemsById, today,
  collect, tossOnly, plan, done, onToggle, onLoadSample,
}) {
  if (!hasClose) {
    return (
      <div className="pass">
        <PassHeader station={station}>
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
          <EightySix items={eightySix} />
        </main>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  const collectDone = collect.filter((r) => done[`c:${r.id}`]).length;
  const prepRows = [...new Map(plan.blocks.filter((b) => b.item).map((b) => [b.item.id, b.item])).values(), ...plan.untimed];
  const prepTotal = prepRows.length + tossOnly.length;
  const prepDone = [...prepRows, ...tossOnly].filter((r) => done[`p:${r.id}`]).length;
  let lastDuring = null;

  return (
    <div className="pass">
      <PassHeader station={station}>
        <span className="pass__date">{dateLine()} · COUNT CONFIRMED</span>
        <h1 className="pass__title">Today</h1>
      </PassHeader>
      <main className="pass__main">
        <EightySix items={eightySix} />

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
                  <button type="button" className={`pass__row pass__row--tall${isDone ? " pass__row--done" : ""}`} onClick={() => onToggle("c", row)}>
                    <CheckBox checked={isDone} />
                    <span className="pass__rowtext">
                      <span className="pass__rowname">{item.name}</span>
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
            Make it to line par + lowboy par. Start the long one, fill its downtime.
            {plan.totalMinutes > 0 && ` About ${formatMinutes(plan.totalMinutes)} total.`}
          </p>
          {prepTotal === 0 && <p className="pass__empty">Nothing to prep from scratch.</p>}
          <ol className="pass__list">
            {plan.blocks.map((block, i) => {
              const row = block.item;
              const isDone = row ? Boolean(done[`p:${row.id}`]) : false;
              const duringLabel = block.during ? `${block.during.name}: ${block.during.step}` : null;
              const showDuring = duringLabel && duringLabel !== lastDuring;
              lastDuring = duringLabel;
              return (
                <li key={`${block.trackId}#${i}`} className={block.during ? "pass__while" : undefined}>
                  {showDuring && <span className="pass__whilelabel">WHILE {block.during.name.toUpperCase()} · {block.during.step.toLowerCase()}</span>}
                  <button
                    type="button"
                    className={`pass__row${isDone ? " pass__row--done" : ""}${!block.during && i === 0 ? " pass__row--lead" : ""}`}
                    onClick={() => row && onToggle("p", row)}
                  >
                    {isDone ? <CheckBox checked tone="amber" /> : <span className="pass__step">{i + 1}</span>}
                    <span className="pass__rowtext">
                      <span className="pass__rowname">{block.firstForRecipe ? block.name : `Back to ${block.name}`}</span>
                      <span className="pass__rowsub">
                        {formatMinutes(block.end - block.start)} hands-on
                        {block.thenPassive && ` · then ${formatMinutes(block.thenPassive.minutes)} ${block.thenPassive.step.toLowerCase()}`}
                      </span>
                      {block.firstForRecipe && row?.toss.length > 0 && (
                        <span className="pass__toss">TOSS {tossText(row)} · last day</span>
                      )}
                    </span>
                    {block.firstForRecipe && row && (
                      <span className="pass__rowend">
                        <span className="pass__mono pass__amber">{formatG(row.makeG)}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          {plan.untimed.length > 0 && (
            <>
              <span className="pass__whilelabel">NO RECIPE TIMES YET</span>
              <ul className="pass__list">
                {plan.untimed.map((row) => {
                  const isDone = Boolean(done[`p:${row.id}`]);
                  return (
                    <li key={row.id}>
                      <button type="button" className={`pass__row${isDone ? " pass__row--done" : ""}`} onClick={() => onToggle("p", row)}>
                        <CheckBox checked={isDone} tone="amber" />
                        <span className="pass__rowtext">
                          <span className="pass__rowname">{row.name}</span>
                          {row.toss.length > 0 && <span className="pass__toss">TOSS {tossText(row)} · last day</span>}
                        </span>
                        <span className="pass__rowend">
                          <span className="pass__mono pass__amber">{formatG(row.makeG)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {tossOnly.length > 0 && (
            <>
              <span className="pass__whilelabel">TOSS ONLY · enough backup left</span>
              <ul className="pass__list">
                {tossOnly.map((row) => {
                  const isDone = Boolean(done[`p:${row.id}`]);
                  return (
                    <li key={row.id}>
                      <button type="button" className={`pass__row${isDone ? " pass__row--done" : ""}`} onClick={() => onToggle("p", row)}>
                        <CheckBox checked={isDone} tone="amber" />
                        <span className="pass__rowtext">
                          <span className="pass__rowname">{row.name}</span>
                          <span className="pass__toss">TOSS {tossText(row)} · last day</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      </main>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}
