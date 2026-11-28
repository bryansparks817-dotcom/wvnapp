import { spotLabel } from "../lib/rail";
import { LEVELS, containerLabel, shelfLabel, isLastDay, parEachFor } from "../lib/inventory";
import { PANS, panName } from "../lib/panSize";

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

// The line pan's size. The chef changes it outright; a cook's pick becomes a
// request the chef approves or declines.
function PanPick({ item, pan }) {
  const req = pan.request;
  return (
    <span className="pass__panpick">
      <span className="pass__countlabel">LINE ·</span>
      <select
        className="pass__pansel"
        aria-label={`${item.name} line pan size`}
        value={req && !pan.isChef ? req.to : item.pan}
        onChange={(e) => pan.onPick(e.target.value)}
      >
        {PANS.map((p) => <option key={p} value={p}>{panName(p).toUpperCase()}</option>)}
      </select>
      {req && !pan.isChef && (
        <span className="pass__panreq">
          Asked chef for {req.to} (now {item.pan}) ·{" "}
          <button type="button" className="pass__linkbtn" onClick={pan.onCancel}>cancel</button>
        </span>
      )}
      {req && pan.isChef && (
        <span className="pass__panreq">
          {req.by} asked for {req.to} ·{" "}
          <button type="button" className="pass__linkbtn" onClick={() => pan.onAnswer(true)}>approve</button>{" · "}
          <button type="button" className="pass__linkbtn" onClick={() => pan.onAnswer(false)}>decline</button>
        </span>
      )}
    </span>
  );
}

// One item's count: the line pan, then each lowboy container. Walk-in is the
// chef's count, shown read-only.
// mode "backup": a backup station (Prep) counts every container of the item,
//   wherever it sits, against its prep par. No line pan.
// mode "line": a collect-only item on a line station: just the line pan,
//   since the backup is the making station's to count.
export default function CountCard({ item, inv, today, onChange, pan = null, mode = "full" }) {
  const setLine = (line) => onChange({ ...inv, line });
  const setLowboy = (i, fill) =>
    onChange({ ...inv, lowboy: inv.lowboy.map((c, j) => (j === i ? { ...c, fill } : c)) });
  const addContainer = (size) =>
    onChange({ ...inv, lowboy: [...inv.lowboy, { size, fill: 100, madeOn: today }] });
  const walkIn = inv.walkIn.filter((c) => c.fill > 0);

  if (item.frozenEach || item.countEach) {
    const count = inv.count ?? 0;
    const setCount = (n) => onChange({ ...inv, count: Math.max(0, n) });
    return (
      <fieldset className="pass__card">
        <legend className="pass__cardhead">
          <span className="pass__rowname">{item.name}</span>
        </legend>
        <div className="pass__countrow">
          <span className={`pass__countlabel${item.unconfirmed?.includes("parEach") ? " chef__draftfield" : ""}`}>{item.frozenEach ? "ON HAND, THAWED" : "ON HAND"} · par {parEachFor(item, today)} each{item.parPctCovers ? ` (${item.parPctCovers}% of tonight's covers)` : ""}</span>
          <div className="pass__eachrow">
            <button type="button" className="pass__add" aria-label={`One less ${item.name}`} onClick={() => setCount(count - 1)}>−</button>
            <input className="pass__input pass__eachnum" type="number" inputMode="numeric" min="0" aria-label={`${item.name} count`} value={count} onChange={(e) => setCount(Number(e.target.value) || 0)} />
            <button type="button" className="pass__add" aria-label={`One more ${item.name}`} onClick={() => setCount(count + 1)}>+</button>
          </div>
        </div>
        <p className="pass__walkin">{item.frozenEach ? "PRECUT, FROZEN · no prep. The chef pulls what’s short from the freezer; you collect it thawed from the walk-in." : "COUNTED EACH · whatever’s under par goes on your prep list."}</p>
      </fieldset>
    );
  }

  return (
    <fieldset className="pass__card">
      <legend className="pass__cardhead">
        {item.slot === "bottles" ? <span className="pass__slottag">BOTTLE RAIL</span> : item.slot === "dry" ? <span className="pass__slottag">DRY RAIL</span> : item.slot ? <span className="pass__slottag">SLOT {item.slot}{item.spot ? ` ${spotLabel(item.spot).toUpperCase()}` : ""}</span> : null}
        <span className="pass__rowname">{item.name}</span>
      </legend>

      {mode !== "backup" && <div className="pass__countrow">
        {pan ? <PanPick item={item} pan={pan} /> : <span className="pass__countlabel">LINE · {panName(item.pan).toUpperCase()}</span>}
        <Levels value={inv.line} onPick={setLine} label={`${item.name} line pan`} />
      </div>}

      {mode === "line" ? (
        <p className="pass__walkin">BACKUP: Prep counts it. Collect pulls from Prep’s stock.</p>
      ) : <>
      <div className="pass__countrow">
        <span className={`pass__countlabel${mode === "backup" && item.unconfirmed?.includes("lowboyPar") ? " chef__draftfield" : ""}`}>
          {mode === "backup" ? `ALL BACKUP (walk-in + lowboys) · prep par ${item.lowboyPar} ${item.lowboySize}${item.unconfirmed?.includes("lowboyPar") ? " · DRAFT" : ""}` : `LOWBOY · par ${item.lowboyPar} ${item.lowboySize}`}
        </span>
        {inv.lowboy.length === 0 && <span className="pass__none">{mode === "backup" ? "None on hand." : "Nothing in the lowboy."}</span>}
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

      {mode === "full" && <p className="pass__walkin">
        WALK-IN (chef):{" "}
        {walkIn.length === 0
          ? "none"
          : walkIn.map((c) => `${containerLabel(c)} · ${shelfLabel(item, c.madeOn, today)}`).join(", ")}
      </p>}
      </>}
    </fieldset>
  );
}
