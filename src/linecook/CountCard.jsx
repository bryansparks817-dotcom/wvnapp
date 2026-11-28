import { spotLabel } from "../lib/rail";
import { LEVELS, SIZES, containerLabel, sizeName, shelfLabel, isLastDay, parEachFor } from "../lib/inventory";
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

const PART = [[0, "none"], [25, "¼"], [50, "½"], [75, "¾"]];

// The lowboy, compact (Bryan, 2026-11-28): one row per container size and
// made-on day, with a stepper for full containers and one "open" container
// picked as ¼ ½ ¾. Emptied containers stay in the list at 0% so Collect's
// pulls (which point at a container by position) still line up.
function Backup({ item, inv, today, onChange }) {
  const list = inv.lowboy;
  const groups = [];
  list.forEach((c) => {
    const key = `${c.size}|${c.madeOn}`;
    if (!groups.some((g) => g.key === key)) groups.push({ key, size: c.size, madeOn: c.madeOn });
  });
  const live = groups.filter((g) => list.some((c) => `${c.size}|${c.madeOn}` === g.key && c.fill > 0));
  const save = (lowboy) => onChange({ ...inv, lowboy });
  const inGroup = (g) => list.map((c, i) => [c, i]).filter(([c]) => c.size === g.size && c.madeOn === g.madeOn);
  const setFull = (g, n) => {
    const next = list.map((c) => ({ ...c }));
    const full = inGroup(g).filter(([c]) => c.fill === 100).map(([, i]) => i);
    for (let k = full.length; k > n; k--) next[full[k - 1]].fill = 0;
    const empty = inGroup(g).filter(([c]) => c.fill === 0).map(([, i]) => i);
    for (let k = full.length; k < n; k++) {
      const i = empty.shift();
      if (i != null) next[i].fill = 100; else next.push({ size: g.size, fill: 100, madeOn: g.madeOn });
    }
    save(next);
  };
  const setPart = (g, at, fill) => {
    const next = list.map((c) => ({ ...c }));
    if (at != null) next[at].fill = fill;
    else if (fill) {
      const i = inGroup(g).find(([c]) => c.fill === 0)?.[1];
      if (i != null) next[i].fill = fill; else next.push({ size: g.size, fill, madeOn: g.madeOn });
    }
    save(next);
  };
  const add = (size) => setFull({ size, madeOn: today }, inGroup({ size, madeOn: today }).filter(([c]) => c.fill === 100).length + 1);
  const sizes = [item.lowboySize, ...SIZES.filter((z) => z !== item.lowboySize)].filter(Boolean);

  return <>
    {live.length === 0 && <span className="pass__none">Nothing in the lowboy.</span>}
    {live.map((g) => {
      const rows = inGroup(g);
      const full = rows.filter(([c]) => c.fill === 100).length;
      const parts = rows.filter(([c]) => c.fill > 0 && c.fill < 100);
      const name = sizeName(g.size).toUpperCase();
      return (
        <div key={g.key} className="pass__bgroup">
          <span className={`pass__containerinfo${isLastDay(item, g.madeOn, today) ? " is-expiring" : ""}`}>
            {name} · {madeLabel(g.madeOn)} · {shelfLabel(item, g.madeOn, today)}
          </span>
          <div className="pass__brow">
            <span className="pass__blabel">FULL</span>
            <button type="button" className="pass__add" aria-label={`One less full ${name}`} onClick={() => setFull(g, Math.max(0, full - 1))}>−</button>
            <span className="pass__bnum" aria-label={`${item.name} full ${name}, ${madeLabel(g.madeOn)}`}>{full}</span>
            <button type="button" className="pass__add" aria-label={`One more full ${name}`} onClick={() => setFull(g, full + 1)}>+</button>
          </div>
          {(parts.length ? parts : [[null, null]]).map(([c, at], k) => (
            <div key={k} className="pass__brow" role="group" aria-label={`${item.name} open ${name}`}>
              <span className="pass__blabel">OPEN</span>
              {PART.map(([v, l]) => {
                const on = (c?.fill ?? 0) === v;
                return <button key={v} type="button" className={`pass__level pass__bpart${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setPart(g, at, v)}>{l}</button>;
              })}
            </div>
          ))}
        </div>
      );
    })}
    <div className="pass__addrow">
      {sizes.map((z) => <button key={z} type="button" className="pass__add" onClick={() => add(z)}>+ {sizeName(z)}</button>)}
    </div>
  </>;
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
  const walkIn = inv.walkIn.filter((c) => c.fill > 0);

  if (item.frozenEach || item.countEach) {
    const count = inv.count ?? 0;
    const setCount = (n) => onChange({ ...inv, count: Math.max(0, n) });
    return (
      <fieldset className="pass__card">
        <legend className="pass__cardhead">
          {item.slot === "bottles" ? <span className="pass__slottag">BOTTLE RAIL</span> : item.slot === "dry" ? <span className="pass__slottag">DRY RAIL</span> : item.slot ? <span className="pass__slottag">SLOT {item.slot}{item.spot ? ` ${spotLabel(item.spot).toUpperCase()}` : ""}</span> : null}
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
          {mode === "backup" ? `ALL BACKUP (walk-in + lowboys) · prep par ${item.lowboyPar} ${sizeName(item.lowboySize)}${item.unconfirmed?.includes("lowboyPar") ? " · DRAFT" : ""}` : `LOWBOY · par ${item.lowboyPar} ${sizeName(item.lowboySize)}`}
        </span>
        <Backup item={item} inv={inv} today={today} onChange={onChange} />
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
