import { useEffect, useMemo, useState } from "react";
import { getStations } from "../data/stations";
import { closeNeeds, holdsBackup } from "../lib/backupStock";
import { THAW_KINDS, UNITS, addDays, coldWaterHours, guessKind, kindOf, linePullRows, loadFreezer, packSize, packUnit, prepUses, pullForLine, pullList, saveFreezer, thawHours, thawing, undoLinePull } from "../lib/freezer";
import { buildShift, emptyInventory } from "../lib/inventory";
import { loadInventory } from "../lib/storage";
import { loadChefSettings, saveChefSettings, KEYS } from "../lib/storage";
import { onRemoteChange } from "../lib/sync";
import { formatMinutes } from "../lib/format";

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const atOn = (day, hhmm) => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi).getTime();
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const when = (ms, today) => {
  const d = new Date(ms);
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const k = dayKey(d);
  if (k === today) return `today ${t}`;
  if (k === addDays(today, 1)) return `tomorrow ${t}`;
  if (k === addDays(today, -1)) return `yesterday ${t}`;
  return `${DAYS[d.getDay()]} ${t}`;
};
const dayName = (day, today) => (day === today ? "today" : day === addDays(today, 1) ? "tomorrow" : DAYS[new Date(atOn(day, "12:00")).getDay()]);
const hrs = (h) => formatMinutes(Math.round(h * 60));
const newId = () => `fz-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Chef › Stock: the freezer count and the pull list built from it.
export default function Freezer({ recipesById, by }) {
  const [state, setStateRaw] = useState(loadFreezer);
  const [settings, setSettings] = useState(loadChefSettings);
  const [now, setNow] = useState(() => Date.now());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  useEffect(() => onRemoteChange((keys) => { if (keys.includes(KEYS.FREEZER)) setStateRaw(loadFreezer()); }), []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(id); }, []);
  const setState = (next) => { setStateRaw(next); saveFreezer(next); };
  const update = (id, patch) => setState({ ...state, items: state.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });

  const today = dayKey(new Date(now));
  const startAt = (day) => atOn(day, settings.prepStartAt);
  // The next prep day: today until Prep starts, then tomorrow.
  const nextDay = now < startAt(today) ? today : addDays(today, 1);

  // What the next prep list (from the line stations' last closes) uses from the freezer.
  const needs = useMemo(() => {
    const stations = getStations();
    const prep = stations.find(holdsBackup);
    if (!prep) return [];
    const { byItem } = closeNeeds(prep, stations);
    return Object.keys(byItem).map((id) => prep.items.find((i) => i.id === id)).filter(Boolean).map((i) => ({ name: i.name, recipeId: i.recipeId ?? i.id }));
  }, [state.countedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Precut frozen items the line stations closed under par (KC strip, chops).
  const lineNeeds = useMemo(() => getStations().filter((st) => !holdsBackup(st)).flatMap((st) => {
    const frozen = st.items.filter((i) => i.frozenEach);
    const inv = loadInventory(st.id);
    if (!frozen.length || !inv?.closedAt) return [];
    const { collect } = buildShift(frozen, { ...emptyInventory(frozen), ...(inv.items ?? {}) }, st.linePar, today);
    return collect.filter((r) => r.pullEach > 0).map((r) => ({ key: `${st.id}:${r.id}`, stationId: st.id, station: st.name, item: r.item, each: r.pullEach }));
  }), [state.countedAt, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const uses = useMemo(() => prepUses(state.items.filter((i) => i.inFreezer), needs, recipesById), [state.items, needs, recipesById]);
  const pulls = [...linePullRows(lineNeeds, state, { nextDay, startAt, now }), ...pullList(state, { uses, nextDay, startAt, now })].sort((a, b) => a.pullAt - b.pullAt);
  const linePulled = Object.entries(state.linePulls ?? {})
    .map(([key, p]) => ({ key, ...p, readyAt: p.at + p.hours * 3600000 }))
    .filter((p) => now - p.readyAt < 2 * 86400000)
    .sort((a, b) => a.readyAt - b.readyAt);
  const thaw = thawing(state, now);
  const inFreezer = state.items.filter((i) => i.inFreezer && !i.pulledAt);
  const names = useMemo(() => {
    const set = new Set();
    for (const r of recipesById.values()) { set.add(r.name); for (const i of r.ingredients ?? []) set.add(i.name); }
    return [...set].sort();
  }, [recipesById]);

  const pull = (row) => (row.line ? setState(pullForLine(state, row, by)) : update(row.item.id, { pulledAt: Date.now(), pulledBy: by }));
  const notNeeded = (row) => setState({ ...state, notNeeded: { ...state.notNeeded, [row.line ? row.key : `${row.item.id}@${row.day}`]: true } });

  return (
    <>
      <section>
        <div className="pass__sectionhead"><h2>Freezer pull list</h2></div>
        <label className="chef__coverfield fz__start">
          <span className="pass__countlabel">PREP STARTS (THAWED BY)</span>
          <input className="pass__input chef__servicetime" type="time" value={settings.prepStartAt}
            onChange={(e) => { if (!e.target.value) return; const next = { ...loadChefSettings(), prepStartAt: e.target.value }; setSettings(next); saveChefSettings(next); }} />
        </label>
        {pulls.length === 0 && (
          <p className="pass__empty">
            {inFreezer.length ? `Nothing to pull for ${dayName(nextDay, today)}'s prep. Tap NEED IT on a freezer item to add one.` : "Count the freezer below, then pulls show here."}
          </p>
        )}
        <ul className="pass__list">
          {pulls.map((r) => (
            <li key={r.key ?? r.item.id} className={`fz__pull${r.late ? " is-late" : ""}`}>
              <span className="pass__rowtext">
                <span className="pass__rowname">{r.item.name} <span className="pass__mono">· {r.item.qty} {r.item.unit}</span></span>
                <span className={`pass__rowsub${r.late ? " chef__late" : ""}`}>
                  {r.late ? "PULL NOW" : `Pull ${when(r.pullAt, today)}`} → walk-in, {hrs(r.hours)} to thaw. Needed {when(r.needAt, today)}.
                </span>
                {r.late && r.tooLate && (
                  <span className="pass__rowsub chef__late">
                    Won’t thaw in the walk-in in time (ready about {when(now + r.hours * 3600000, today)}).
                    {r.cold ? ` Cold water instead: sealed, changed every 30 min, about ${hrs(r.cold)}, then use right away.` : " Use it from frozen, or move the recipe to later."}
                  </span>
                )}
                {r.line && (
                  <span className="pass__rowsub">
                    {r.need.station} closed {r.item.qty} under par. Precut: pull {r.item.qty}, the cook collects them thawed.
                    {r.short != null ? ` Freezer count shows only ${r.short}.` : !r.match ? " Not in the freezer count yet." : ""}
                  </span>
                )}
                {!r.line && <span className="pass__rowsub">{r.auto ? `${dayName(r.day, today)}'s prep uses it: ${[...new Set(r.forRecipes)].join(", ")}` : `Chef needs it ${dayName(r.day, today)}`}</span>}
              </span>
              <span className="fz__actions">
                <button type="button" className="chef__ack" onClick={() => pull(r)}>PULLED</button>
                <button type="button" className="pass__ghost" onClick={() => (r.auto ? notNeeded(r) : update(r.item.id, { needOn: null }))}>Not needed</button>
              </span>
            </li>
          ))}
        </ul>
        {(thaw.length > 0 || linePulled.length > 0) && (
          <>
            <span className="pass__countlabel">THAWING IN THE WALK-IN</span>
            <ul className="pass__list">
              {thaw.map((t) => (
                <li key={t.item.id} className="fz__pull">
                  <span className="pass__rowtext">
                    <span className="pass__rowname">{t.item.name} <span className="pass__mono">· {t.item.qty} {t.item.unit}</span></span>
                    <span className={`pass__rowsub${t.ready ? " pass__vine" : ""}`}>{t.ready ? "Thawed" : `Ready about ${when(t.readyAt, today)}`} · pulled {when(t.item.pulledAt, today)}{t.item.pulledBy ? ` by ${t.item.pulledBy}` : ""}</span>
                  </span>
                  <span className="fz__actions">
                    <button type="button" className="pass__ghost" onClick={() => update(t.item.id, { pulledAt: null, inFreezer: false, needOn: null })}>Used · clear</button>
                    <button type="button" className="pass__ghost" onClick={() => update(t.item.id, { pulledAt: null })}>Undo</button>
                  </span>
                </li>
              ))}
              {linePulled.map((p) => (
                <li key={p.key} className="fz__pull">
                  <span className="pass__rowtext">
                    <span className="pass__rowname">{p.name} <span className="pass__mono">· {p.each} ea for {p.station}</span></span>
                    <span className={`pass__rowsub${p.readyAt <= now ? " pass__vine" : ""}`}>{p.readyAt <= now ? "Thawed" : `Ready about ${when(p.readyAt, today)}`} · pulled {when(p.at, today)}{p.by ? ` by ${p.by}` : ""}</span>
                  </span>
                  <span className="fz__actions">
                    <button type="button" className="pass__ghost" onClick={() => setState(undoLinePull(state, p.key))}>Undo</button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <div className="pass__sectionhead"><h2>Freezer count</h2></div>
        <p className="pass__hint">
          {state.countedAt ? `Last counted ${when(state.countedAt, today)}${state.countedBy ? ` by ${state.countedBy}` : ""}.` : "Not counted yet."} Mark what’s in the freezer. Anything the next prep list uses goes on the pull list by itself.
        </p>
        <ul className="pass__list">
          {state.items.filter((i) => !i.pulledAt).map((it) => {
            const est = !it.confirmed;
            const open = editing === it.id;
            return (
              <li key={it.id} className={`fz__item${it.inFreezer ? "" : " is-out"}`}>
                <button type="button" className="fz__name" onClick={() => setEditing(open ? null : it.id)} aria-expanded={open}>
                    <span className="pass__rowname">{it.name}</span>
                    <span className={`pass__rowsub${est ? " fz__draft" : ""}`}>{kindOf(it.kind).name} · {packSize(it)} {packUnit(it)} packs · {hrs(thawHours(it))} walk-in thaw{est ? " (estimate)" : ""}</span>
                </button>
                <div className="fz__row">
                  <input className="pass__input fz__qty" type="number" inputMode="decimal" min="0" aria-label={`${it.name} amount`} value={it.qty}
                    onChange={(e) => update(it.id, { qty: e.target.value === "" ? "" : Number(e.target.value), inFreezer: Number(e.target.value) > 0 })} />
                  <select className="pass__input fz__unit" aria-label={`${it.name} unit`} value={it.unit} onChange={(e) => update(it.id, { unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <div className="chef__servicetoggle fz__inout" role="group" aria-label={`${it.name} in the freezer`}>
                    <button type="button" className={it.inFreezer ? "is-on" : undefined} aria-pressed={it.inFreezer} onClick={() => update(it.id, { inFreezer: true })}>IN</button>
                    <button type="button" className={!it.inFreezer ? "is-on" : undefined} aria-pressed={!it.inFreezer} onClick={() => update(it.id, { inFreezer: false, needOn: null })}>OUT</button>
                  </div>
                </div>
                {it.inFreezer && (
                  <div className="fz__need">
                    <span className="pass__countlabel">NEED IT</span>
                    {[0, 1, 2].map((n) => {
                      const d = addDays(nextDay, n);
                      return <button key={d} type="button" className={`fz__chip${it.needOn === d ? " is-on" : ""}`} aria-pressed={it.needOn === d} onClick={() => update(it.id, { needOn: it.needOn === d ? null : d })}>{dayName(d, today).toUpperCase()}</button>;
                    })}
                  </div>
                )}
                {open && <ItemDetails it={it} onChange={(patch) => update(it.id, patch)} onRemove={() => { setState({ ...state, items: state.items.filter((x) => x.id !== it.id) }); setEditing(null); }} />}
              </li>
            );
          })}
        </ul>
        {adding ? (
          <AddItem names={names} onCancel={() => setAdding(false)} onAdd={(it) => { setState({ ...state, items: [...state.items, it] }); setAdding(false); }} />
        ) : (
          <button type="button" className="pass__ghostbtn fz__add" onClick={() => setAdding(true)}>+ ADD A FREEZER ITEM</button>
        )}
        <button type="button" className="pass__cta fz__done" onClick={() => setState({ ...state, countedAt: Date.now(), countedBy: by })}>FREEZER COUNT DONE</button>
        <p className="pass__hint fz__sources">
          Thaw times are estimates from USDA FSIS “The Big Thaw” (walk-in: about 24 h per 4–5 lb, a full day for small packs; cold water: about 30 min per lb, sealed, water changed every 30 min, cook right after) and FDA seafood guidance (thaw overnight in the fridge). Stocks, doughs, butters, veg and bread use common kitchen practice. Thaw time goes by one pack, not the whole count. Light blue means not confirmed yet: tap an item to set its pack size or real thaw time.
        </p>
      </section>
    </>
  );
}

function ItemDetails({ it, onChange, onRemove }) {
  const cold = coldWaterHours(it);
  return (
    <div className="fz__details">
      <label className={`chef__coverfield${it.confirmed ? "" : " chef__draftfield"}`}>
        <span className="pass__countlabel">TYPE</span>
        <select className="pass__input" value={it.kind} onChange={(e) => onChange({ kind: e.target.value, thawHours: null })}>
          {THAW_KINDS.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.hint})</option>)}
        </select>
      </label>
      <label className={`chef__coverfield${it.confirmed ? "" : " chef__draftfield"}`}>
        <span className="pass__countlabel">ONE PACK OR CONTAINER, {packUnit(it).toUpperCase()} (SETS THE THAW TIME)</span>
        <input className="pass__input" type="number" inputMode="decimal" min="0" placeholder={String(packSize({ ...it, packSize: null }))} value={it.packSize ?? ""}
          onChange={(e) => onChange({ packSize: e.target.value === "" ? null : Number(e.target.value), thawHours: null })} />
      </label>
      <label className={`chef__coverfield${it.confirmed ? "" : " chef__draftfield"}`}>
        <span className="pass__countlabel">WALK-IN THAW, HOURS</span>
        <input className="pass__input" type="number" inputMode="decimal" min="0" placeholder={String(thawHours({ ...it, thawHours: null }))} value={it.thawHours ?? ""}
          onChange={(e) => onChange({ thawHours: e.target.value === "" ? null : Number(e.target.value) })} />
      </label>
      <p className="pass__hint">{cold ? `Cold water, if it's late: about ${hrs(cold)}.` : "No cold-water thaw for this type."}</p>
      <div className="fz__actions">
        {!it.confirmed && <button type="button" className="chef__ack" onClick={() => onChange({ confirmed: true })}>CONFIRM THAW TIME</button>}
        <button type="button" className="pass__ghost" onClick={onRemove}>Remove item</button>
      </div>
    </div>
  );
}

function AddItem({ names, onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState("lb");
  const k = kind ?? (name ? guessKind(name) : "other");
  return (
    <form className="chef__staffform" onSubmit={(e) => { e.preventDefault(); if (name.trim()) onAdd({ id: newId(), name: name.trim(), kind: k, qty, unit, inFreezer: true, confirmed: false }); }}>
      <label className="pass__countlabel" htmlFor="fz-name">ITEM</label>
      <input id="fz-name" className="pass__input" list="fz-names" placeholder="e.g. Wagyu short rib" value={name} onChange={(e) => setName(e.target.value)} />
      <datalist id="fz-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="fz__row">
        <input className="pass__input fz__qty" type="number" inputMode="decimal" min="0" aria-label="Amount" value={qty} onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))} />
        <select className="pass__input fz__unit" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {UNITS.map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
      <label className="chef__coverfield chef__draftfield">
        <span className="pass__countlabel">TYPE (SETS THE THAW TIME)</span>
        <select className="pass__input" value={k} onChange={(e) => setKind(e.target.value)}>
          {THAW_KINDS.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.hint})</option>)}
        </select>
      </label>
      <button type="submit" className="pass__cta" disabled={!name.trim()}>ADD TO FREEZER</button>
      <button type="button" className="pass__ghost" onClick={onCancel}>Cancel</button>
    </form>
  );
}
