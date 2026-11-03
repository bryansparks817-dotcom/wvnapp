import { CheckBox, PassHeader, TabBar } from "./Chrome";
import { formatMinutes } from "../lib/format";

const WHERE_LABEL = { lowboy: "LOWBOY", "walk-in": "WALK-IN" };
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

export default function TodayScreen({
  station, screen, setScreen, onOpenChef,
  countDone, totalItems, eightySix,
  collect, plan, collected, prepped, onToggleCollected, onTogglePrepped,
}) {
  if (!countDone) {
    return (
      <div className="pass">
        <PassHeader station={station}>
          <span className="pass__date">{dateLine()}</span>
          <h1 className="pass__title">Count first.</h1>
          <p className="pass__lede">Your prep list builds itself from the count.</p>
        </PassHeader>
        <main className="pass__main">
          <section className="pass__gate">
            <div className="pass__sectionhead">
              <h2>TODAY’S COUNT</h2>
              <span className="pass__mono pass__amber">0 of {totalItems}</span>
            </div>
            <p className="pass__hint">Pan by pan, in 25% steps. Then say what’s in the back.</p>
            <button type="button" className="pass__cta" onClick={() => setScreen("count")}>
              START COUNT →
            </button>
          </section>
          <EightySix items={eightySix} />
        </main>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  const openCollect = collect.filter((i) => !collected.has(i.id));
  const doneCollect = collect.filter((i) => collected.has(i.id));
  const blockKey = (b, i) => `${b.trackId}#${i}`;
  const totalPrep = plan.blocks.length + plan.untimed.length;
  const donePrep =
    plan.blocks.filter((b, i) => prepped.has(blockKey(b, i))).length +
    plan.untimed.filter((i) => prepped.has(i.id)).length;

  let lastDuring = null;

  return (
    <div className="pass">
      <PassHeader station={station}>
        <span className="pass__date">{dateLine()} · COUNT DONE</span>
        <h1 className="pass__title">Today</h1>
      </PassHeader>
      <main className="pass__main">
        <EightySix items={eightySix} />

        <section>
          <div className="pass__sectionhead">
            <h2><span className="pass__vine">1</span> · COLLECT</h2>
            <span className="pass__mono pass__vine">{doneCollect.length} of {collect.length}</span>
          </div>
          <p className="pass__hint">Already made. Top up your station and get it off your mind.</p>
          {collect.length === 0 && <p className="pass__empty">Nothing to collect.</p>}
          <ul className="pass__list">
            {openCollect.map((item) => (
              <li key={item.id}>
                <button type="button" className="pass__row" onClick={() => onToggleCollected(item.id)}>
                  <CheckBox checked={false} />
                  <span className="pass__rowtext">
                    <span className="pass__rowname">{item.name}</span>
                    <span className="pass__rowsub">{item.pan} pan · counted {item.level}%</span>
                  </span>
                  <span className="pass__rowend">
                    <span className="pass__where">{WHERE_LABEL[item.back]}</span>
                    <span className="pass__mono">+{item.need}%</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {doneCollect.length > 0 && (
            <ul className="pass__list pass__list--done">
              {doneCollect.map((item) => (
                <li key={item.id}>
                  <button type="button" className="pass__row pass__row--done" onClick={() => onToggleCollected(item.id)}>
                    <CheckBox checked />
                    <span className="pass__rowname">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="pass__sectionhead">
            <h2><span className="pass__amber">2</span> · PREP</h2>
            <span className="pass__mono pass__amber">{donePrep} of {totalPrep}</span>
          </div>
          <p className="pass__hint">
            Nothing in the back. Start the long one, fill its downtime.
            {plan.totalMinutes > 0 && ` About ${formatMinutes(plan.totalMinutes)} total.`}
          </p>
          {totalPrep === 0 && <p className="pass__empty">Nothing to prep from scratch.</p>}
          <ol className="pass__list">
            {plan.blocks.map((block, i) => {
              const key = blockKey(block, i);
              const done = prepped.has(key);
              const duringLabel = block.during ? `${block.during.name}: ${block.during.step}` : null;
              const showDuring = duringLabel && duringLabel !== lastDuring;
              lastDuring = duringLabel;
              const minutes = block.end - block.start;
              return (
                <li key={key} className={block.during ? "pass__while" : undefined}>
                  {showDuring && <span className="pass__whilelabel">WHILE {block.during.name.toUpperCase()} · {block.during.step.toLowerCase()}</span>}
                  <button
                    type="button"
                    className={`pass__row${done ? " pass__row--done" : ""}${!block.during && i === 0 ? " pass__row--lead" : ""}`}
                    onClick={() => onTogglePrepped(key)}
                  >
                    {done ? <CheckBox checked tone="amber" /> : <span className="pass__step">{i + 1}</span>}
                    <span className="pass__rowtext">
                      <span className="pass__rowname">
                        {block.firstForRecipe ? block.name : `Back to ${block.name}`}
                      </span>
                      <span className="pass__rowsub">
                        {formatMinutes(minutes)} hands-on
                        {block.thenPassive && ` · then ${formatMinutes(block.thenPassive.minutes)} ${block.thenPassive.step.toLowerCase()}`}
                      </span>
                    </span>
                    {block.firstForRecipe && block.item && (
                      <span className="pass__rowend">
                        <span className="pass__mono pass__amber">+{block.item.need}%</span>
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
                {plan.untimed.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`pass__row${prepped.has(item.id) ? " pass__row--done" : ""}`}
                      onClick={() => onTogglePrepped(item.id)}
                    >
                      <CheckBox checked={prepped.has(item.id)} tone="amber" />
                      <span className="pass__rowtext">
                        <span className="pass__rowname">{item.name}</span>
                        <span className="pass__rowsub">{item.pan} pan · counted {item.level}%</span>
                      </span>
                      <span className="pass__rowend">
                        <span className="pass__mono pass__amber">+{item.need}%</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </main>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}
