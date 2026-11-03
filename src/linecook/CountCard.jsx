import { LEVELS, containerLabel, shelfLabel, isLastDay } from "../lib/inventory";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function madeLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `made ${DAY[new Date(y, m - 1, d).getDay()]}`;
}

function Levels({ value, onPick, label }) {
  return (
    <div className="pass__levels" role="group" aria-label={label}>
      {LEVELS.map((lv) => (
        <button
          key={lv}
          type="button"
          className={`pass__level${value === lv ? " is-on" : ""}`}
          aria-pressed={value === lv}
          onClick={() => onPick(lv)}
        >
          {lv}%
        </button>
      ))}
    </div>
  );
}

// One item's count: the line pan, then each lowboy container. Walk-in is the
// chef's count, shown read-only.
export default function CountCard({ item, inv, today, onChange }) {
  const setLine = (line) => onChange({ ...inv, line });
  const setLowboy = (i, fill) =>
    onChange({ ...inv, lowboy: inv.lowboy.map((c, j) => (j === i ? { ...c, fill } : c)) });
  const addContainer = (size) =>
    onChange({ ...inv, lowboy: [...inv.lowboy, { size, fill: 100, madeOn: today }] });
  const walkIn = inv.walkIn.filter((c) => c.fill > 0);

  return (
    <fieldset className="pass__card">
      <legend className="pass__cardhead">
        <span className="pass__rowname">{item.name}</span>
      </legend>

      <div className="pass__countrow">
        <span className="pass__countlabel">LINE · {item.pan} PAN</span>
        <Levels value={inv.line} onPick={setLine} label={`${item.name} line pan`} />
      </div>

      <div className="pass__countrow">
        <span className="pass__countlabel">LOWBOY · par {item.lowboyPar} {item.lowboySize}</span>
        {inv.lowboy.length === 0 && <span className="pass__none">Nothing in the lowboy.</span>}
        {inv.lowboy.map((c, i) => (
          <div key={i} className="pass__container">
            <span className={`pass__containerinfo${isLastDay(item, c.madeOn, today) ? " is-expiring" : ""}`}>
              {c.size.toUpperCase()} · {madeLabel(c.madeOn)} · {shelfLabel(item, c.madeOn, today)}
            </span>
            <Levels value={c.fill} onPick={(fill) => setLowboy(i, fill)} label={`${item.name} lowboy ${c.size} ${i + 1}`} />
          </div>
        ))}
        <div className="pass__addrow">
          <button type="button" className="pass__add" onClick={() => addContainer("qt")}>+ qt</button>
          <button type="button" className="pass__add" onClick={() => addContainer("pt")}>+ pt</button>
        </div>
      </div>

      <p className="pass__walkin">
        WALK-IN (chef):{" "}
        {walkIn.length === 0
          ? "none"
          : walkIn.map((c) => `${containerLabel(c)} · ${shelfLabel(item, c.madeOn, today)}`).join(", ")}
      </p>
    </fieldset>
  );
}
