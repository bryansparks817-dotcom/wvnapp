import { useMemo, useState } from "react";
import { STATIONS } from "../data/stations";
import { loadShift, loadInventory, loadStaff, loadChefSettings } from "../lib/storage";
import { activeStaff } from "../lib/staff";
import { emptyInventory, formatG } from "../lib/inventory";
import { formatMinutes, formatTimeOfDay } from "../lib/format";
import { currentServiceShift } from "../lib/crew";
import {
  buildCookSheet, cookFor, hasWork, markPrinted, printSheets, setItemCook, setStationCook, startShiftFromCount, stationCook,
} from "../lib/printLists";

const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function closeLabel(inv) {
  if (!inv?.closedAt) return inv?.closedOn ?? "";
  const d = new Date(inv.closedAt);
  return `${DAY[d.getDay()]} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase()}`;
}

// The next quarter hour, as "HH:MM".
function nextQuarter() {
  const d = new Date();
  const m = Math.ceil((d.getHours() * 60 + d.getMinutes()) / 15) * 15;
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function CookPick({ value, people, onChange, label }) {
  return (
    <select className="pass__input chef__cookpick" value={value ?? ""} aria-label={label} onChange={(e) => e.target.value && onChange(e.target.value)}>
      {!value && <option value="">Pick a cook…</option>}
      {people.map((p) => <option key={p.initials} value={p.initials}>{p.name}</option>)}
    </select>
  );
}

// Paper prep lists: the chef hands each station's items to cooks and prints
// one sheet per cook, so the crew can work off a clipboard, not a phone.
export default function PrintLists({ today, recipesById, ingredients, chef }) {
  const [version, setVersion] = useState(0);
  const [startAt, setStartAt] = useState(nextQuarter);
  const [withRecipes, setWithRecipes] = useState(false);
  const [newCook, setNewCook] = useState({});
  const refresh = () => setVersion((v) => v + 1);

  const people = useMemo(() => {
    const list = activeStaff(loadStaff());
    return [...list.filter((p) => p.role !== "chef"), ...list.filter((p) => p.role === "chef")];
  }, []);
  const nameOf = (i) => people.find((p) => p.initials === i)?.name ?? i;

  const stations = useMemo(() => STATIONS.filter((st) => st.items.length > 0).map((st) => {
    const shift = loadShift(st.id);
    const open = Boolean(shift && !shift.closedAt && shift.date === today);
    return { st, shift: open ? shift : null, inventory: loadInventory(st.id) };
    // `version` re-reads the shifts after the chef changes one.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }), [today, version]);
  const open = stations.filter((s) => s.shift);

  const sheets = useMemo(() => {
    const cooks = new Set();
    for (const { shift } of open) {
      for (const r of [...shift.collect, ...shift.prep]) {
        const c = cookFor(shift, r.id);
        if (c) cooks.add(c);
      }
    }
    return [...cooks].map((i) => buildCookSheet(i, open, recipesById, ingredients)).filter(hasWork);
  }, [open, recipesById, ingredients]);

  const settings = loadChefSettings();
  const service = currentServiceShift();
  const [h, m] = startAt.split(":").map(Number);
  const startMin = h * 60 + m;
  const opts = {
    today, startMin, withRecipes, nameOf, chefName: chef?.name,
    serviceLabel: settings.serviceAt?.[service] ? formatTimeOfDay(Number(settings.serviceAt[service].split(":")[0]) * 60 + Number(settings.serviceAt[service].split(":")[1])) : "",
  };
  const print = (list) => {
    printSheets(list, opts);
    for (const s of list) markPrinted(s.stations.map((x) => x.id), s.initials);
    refresh();
  };

  if (stations.length === 0) {
    return <p className="pass__empty">No station has items set up yet. Once the chef adds items, pans and pars, their lists print here.</p>;
  }

  return (
    <>
      <section className="chef__covers">
        <div className="chef__coverrow">
          <label className="chef__coverfield">
            <span className="pass__countlabel">LISTS START AT</span>
            <input className="pass__input chef__servicetime" type="time" value={startAt} onChange={(e) => e.target.value && setStartAt(e.target.value)} />
          </label>
          <label className="chef__coverfield chef__checkfield">
            <span className="pass__countlabel">RECIPE PAGES</span>
            <span className="chef__check">
              <input type="checkbox" checked={withRecipes} onChange={(e) => setWithRecipes(e.target.checked)} />
              <span>Add each recipe, scaled</span>
            </span>
          </label>
        </div>
        <p className="pass__hint">Every step on the sheet gets a clock time from this start. One letter page per cook, with tick boxes for collect, gather and each prep step.</p>
      </section>

      <section>
        <div className="pass__sectionhead"><h2>1 · Who gets what</h2></div>
        <ul className="pass__list">
          {stations.map(({ st, shift, inventory }) => {
            if (!shift) {
              const hasCount = Boolean(inventory?.closedOn);
              return (
                <li key={st.id} className="chef__printstation">
                  <span className="pass__rowname">{st.name}</span>
                  {hasCount ? (
                    <>
                      <span className="pass__rowsub">No one has confirmed today’s count on a phone. Start today’s list from the last close count ({closeLabel(inventory)}{inventory.closedBy ? `, ${inventory.closedBy}` : ""}).</span>
                      <div className="chef__printrow">
                        <CookPick value={newCook[st.id]} people={people} label={`Cook for ${st.name}`} onChange={(v) => setNewCook({ ...newCook, [st.id]: v })} />
                        <button
                          type="button"
                          className="chef__ack"
                          disabled={!newCook[st.id]}
                          onClick={() => { startShiftFromCount(st, inventory.items ?? emptyInventory(st.items), today, newCook[st.id], chef?.initials); refresh(); }}
                        >
                          BUILD LIST
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="pass__rowsub">No close count yet. The close count builds the list.</span>
                  )}
                </li>
              );
            }
            const itemName = (id) => st.items.find((i) => i.id === id)?.name ?? id;
            const rows = [
              ...shift.collect.map((c) => ({ id: c.id, name: itemName(c.id), what: "COLLECT" })),
              ...shift.prep.filter((p) => !shift.skip?.[p.id]).map((p) => ({ id: p.id, name: p.name, what: p.makeG > 0 ? `MAKE ${formatG(p.makeG)}` : "TOSS" })),
            ];
            // One line per item: an item can be both collected and made.
            const byId = new Map();
            for (const r of rows) byId.set(r.id, byId.has(r.id) ? { ...r, what: `${byId.get(r.id).what} + ${r.what}` } : r);
            return (
              <li key={st.id} className="chef__printstation">
                <div className="chef__printrow">
                  <span className="pass__rowname">{st.name}</span>
                  <CookPick value={stationCook(shift)} people={people} label={`Cook for all of ${st.name}`} onChange={(v) => { setStationCook(st.id, v); refresh(); }} />
                </div>
                <span className="pass__rowsub">Whole station to one cook, or hand single items to someone else below.</span>
                <ul className="chef__items chef__printitems">
                  {[...byId.values()].map((r) => (
                    <li key={r.id}>
                      <span>{r.name}</span>
                      <span className="pass__mono">{r.what}</span>
                      <CookPick value={cookFor(shift, r.id)} people={people} label={`Cook for ${r.name}`} onChange={(v) => { setItemCook(st.id, r.id, v); refresh(); }} />
                    </li>
                  ))}
                  {byId.size === 0 && <li className="pass__empty">Nothing to collect or make. The count says this station is stocked.</li>}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="pass__sectionhead"><h2>2 · Print</h2></div>
        {sheets.length === 0 ? (
          <p className="pass__empty">No lists yet. Build or confirm a station’s count above.</p>
        ) : (
          <>
            <ul className="pass__list">
              {sheets.map((s) => {
                const printed = open.map((o) => o.shift.printedAt?.[s.initials]).filter(Boolean).sort().pop();
                return (
                  <li key={s.initials} className="chef__close chef__printcook">
                    <span className="pass__rowtext">
                      <span className="pass__rowname">{nameOf(s.initials)} <span className="pass__muted">· {s.stations.map((x) => x.name).join(" + ")}</span></span>
                      <span className="pass__rowsub">
                        {[s.toss.length && `${s.toss.length} toss`, s.collect.length && `${s.collect.length} collect`, s.prep.length && `${s.prep.length} to make`, s.plan.totalMinutes && `~${formatMinutes(s.plan.totalMinutes)}, done ~${formatTimeOfDay(startMin + s.plan.totalMinutes)}`].filter(Boolean).join(" · ")}
                      </span>
                      {printed && <span className="pass__rowsub pass__vine">Printed {new Date(printed).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
                    </span>
                    <button type="button" className="chef__ack" onClick={() => print([s])}>PRINT</button>
                  </li>
                );
              })}
            </ul>
            {sheets.length > 1 && (
              <button type="button" className="pass__cta chef__printall" onClick={() => print(sheets)}>PRINT ALL {sheets.length} LISTS</button>
            )}
            <p className="pass__hint">Prints to any printer this phone or tablet can reach (AirPrint on iPhone, the share menu on Android). Cooks tick the paper; the close count at the end of the shift still goes in The Pass so tomorrow’s lists are right.</p>
          </>
        )}
      </section>
    </>
  );
}
