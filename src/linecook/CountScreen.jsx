import { PassHeader, TabBar } from "./Chrome";
import { BACK_OPTIONS, LEVELS, PAR, isCounted } from "../lib/lineList";

export default function CountScreen({
  station, screen, setScreen, onOpenChef,
  items, entries, setEntry, collectCount, prepCount, onFinish,
}) {
  const counted = items.filter((i) => isCounted(entries[i.id])).length;
  const pct = items.length ? Math.round((counted / items.length) * 100) : 0;

  return (
    <div className="pass">
      <PassHeader station={station}>
        <div className="pass__sectionhead">
          <h1 className="pass__title">Count</h1>
          <span className="pass__mono pass__amber">{counted}/{items.length}</span>
        </div>
        <div className="pass__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Items counted">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="pass__hint">How full is the pan on the line? Then, is there more in the back?</p>
      </PassHeader>

      <main className="pass__main">
        {items.map((item) => {
          const entry = entries[item.id] ?? {};
          const full = entry.level != null && entry.level >= PAR;
          return (
            <fieldset key={item.id} className="pass__card">
              <legend className="pass__cardhead">
                <span className="pass__rowname">{item.name}</span>
                <span className="pass__pan">{item.pan} PAN</span>
              </legend>
              <div className="pass__levels" role="group" aria-label={`${item.name} level`}>
                {LEVELS.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    className={`pass__level${entry.level === lv ? " is-on" : ""}`}
                    aria-pressed={entry.level === lv}
                    onClick={() => setEntry(item.id, { level: lv })}
                  >
                    {lv}%
                  </button>
                ))}
              </div>
              <div className={`pass__backs${full ? " is-muted" : ""}`} role="group" aria-label={`${item.name} backup`}>
                <span className="pass__backlabel">BACK</span>
                {BACK_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={full}
                    className={`pass__back pass__back--${opt.id}${entry.back === opt.id && !full ? " is-on" : ""}`}
                    aria-pressed={entry.back === opt.id}
                    onClick={() => setEntry(item.id, { back: opt.id })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        })}
      </main>

      <div className="pass__footer">
        <span className="pass__mono pass__muted">So far: {collectCount} COLLECT · {prepCount} PREP</span>
        <button type="button" className="pass__cta" onClick={onFinish} disabled={counted < items.length}>
          {counted < items.length ? `${items.length - counted} LEFT TO COUNT` : "FINISH COUNT →"}
        </button>
      </div>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}
