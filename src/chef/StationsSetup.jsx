import { useState } from "react";
import { useBack } from "../lib/backNav";
import { getStations, setupFlags } from "../data/stations";
import { saveStationSetup } from "../lib/storage";
import { isCateringRecipe } from "../lib/recipeLibrary";
import { PANS, PAN_GRAMS } from "../lib/panSize";
import { addRecipeTo, hasRecipe, removeRecipeFrom } from "../lib/stationRecipes";
import { isTaskRecipe, taskRecipeId } from "../lib/prepTasks";
import { PAN_SHARE, SPOTS, railMap, railSlots, shareLabel, slotSpots, spotGrid, spotLabel, validSpot } from "../lib/rail";

// Setup → Stations, items & pars. The chef adds and renames stations, and
// for each station sets its items: line pan size and weight, lowboy
// container and par, and shelf life. Saved for every phone in the kitchen.

const LINE_PARS = [50, 75, 100];
const FIELD_LABEL = {
  pan: "line pan",
  panGrams: "full pan weight",
  lowboySize: "lowboy container",
  qtGrams: "quart weight",
  lowboyPar: "lowboy par",
  shelfLifeDays: "shelf life",
  eachGrams: "portion weight",
  parEach: "par",
  taskMinutes: "hands-on minutes",
  caseGrams: "case size",
};

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
function uniqueId(base, taken) {
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}
const move = (list, i, by) => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function Field({ label, draft, children }) {
  return (
    <label className={`chef__stafffield${draft ? " chef__draftfield" : ""}`}>
      <span className="pass__countlabel">{label}{draft ? " · DRAFT" : ""}</span>
      {children}
    </label>
  );
}

// Add or edit one item on a station.
function ItemForm({ item, station, stations, recipes, onSave, onCancel, onRemove }) {
  const [f, setF] = useState(() => ({
    name: item?.name ?? "",
    recipeId: item?.recipeId ?? "",
    pan: item?.pan ?? "1/6",
    panGrams: String(item?.panGrams ?? PAN_GRAMS["1/6"]),
    lowboySize: item?.lowboySize ?? "qt",
    qtGrams: String(item?.qtGrams ?? 950),
    lowboyPar: String(item?.lowboyPar ?? 1),
    shelfLifeDays: String(item?.shelfLifeDays ?? 5),
    stationId: station.id,
    madeAt: item?.madeAt ?? "",
    frozenEach: Boolean(item?.frozenEach),
    task: Boolean(item?.task),
    boughtIn: Boolean(item?.boughtIn),
    slot: item?.slot ?? null,
    spot: item?.spot ?? null,
    caseLabel: item?.caseLabel ?? "",
    caseGrams: String(item?.caseGrams ?? ""),
    taskMinutes: String(item?.taskMinutes ?? 15),
    taskNote: item?.taskNote ?? "",
    eachGrams: String(item?.eachGrams ?? 397),
    parEach: String(item?.parEach ?? 10),
  }));
  const [askRemove, setAskRemove] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const drafts = new Set(item?.unconfirmed ?? []);
  const num = (v) => Number(v);
  const target = stations.find((s) => s.id === f.stationId);
  const backup = Boolean(target.holdsBackup);
  const dupName = target.items.some((i) => i !== item && i.name.toLowerCase() === f.name.trim().toLowerCase());
  const ok = f.name.trim() && !dupName && num(f.panGrams) > 0 && num(f.qtGrams) > 0 && num(f.lowboyPar) >= 0 && num(f.shelfLifeDays) >= 1 && (!f.frozenEach || (num(f.eachGrams) > 0 && num(f.parEach) >= 0)) && (!f.task || num(f.taskMinutes) > 0) && (!f.boughtIn || !f.caseGrams || num(f.caseGrams) > 0);
  const frozen = f.frozenEach && !backup;

  function pickRecipe(id) {
    const r = recipes.find((x) => x.id === id);
    setF((x) => ({
      ...x,
      recipeId: id,
      name: x.name.trim() ? x.name : r?.name ?? "",
      shelfLifeDays: r?.shelfLifeDays && !item ? String(r.shelfLifeDays) : x.shelfLifeDays,
    }));
  }

  function pickPan(pan) {
    // Move the weight with the pan unless the chef already typed their own.
    setF((x) => ({ ...x, pan, panGrams: Number(x.panGrams) === PAN_GRAMS[x.pan] ? String(PAN_GRAMS[pan]) : x.panGrams }));
  }

  return (
    <form
      className="chef__staffform"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        const { stationId, madeAt, frozenEach, eachGrams, parEach, task, taskMinutes, taskNote, boughtIn, caseLabel, caseGrams, slot, spot, ...rest } = f;
        const next = {
          ...(item ?? {}),
          ...rest,
          name: f.name.trim(),
          recipeId: f.recipeId || undefined,
          panGrams: num(f.panGrams),
          qtGrams: num(f.qtGrams),
          lowboyPar: num(f.lowboyPar),
          shelfLifeDays: num(f.shelfLifeDays),
        };
        if (!next.recipeId) delete next.recipeId;
        if (frozenEach) Object.assign(next, { frozenEach: true, freezerKind: next.freezerKind ?? "portions", eachGrams: num(eachGrams), parEach: num(parEach) });
        else delete next.frozenEach;
        if (task && !frozenEach) Object.assign(next, { task: true, taskMinutes: num(taskMinutes), taskNote: taskNote.trim() || undefined });
        else { delete next.task; delete next.taskMinutes; delete next.taskNote; if (isTaskRecipe(next.recipeId)) delete next.recipeId; }
        if (!next.taskNote) delete next.taskNote;
        if (boughtIn && !task && !frozenEach) {
          Object.assign(next, { boughtIn: true, caseLabel: caseLabel.trim() || undefined, caseGrams: caseGrams ? num(caseGrams) : undefined });
          delete next.recipeId;
        } else { delete next.boughtIn; delete next.caseLabel; delete next.caseGrams; }
        if (!next.caseLabel) delete next.caseLabel;
        if (!next.caseGrams) delete next.caseGrams;
        if (frozenEach || task || boughtIn) delete next.madeAt;
        else if (madeAt && madeAt !== stationId) next.madeAt = madeAt;
        else delete next.madeAt;
        if (slot && railSlots(target).includes(slot)) next.slot = slot;
        else delete next.slot;
        if (next.slot && validSpot(spot, target, next.slot)) next.spot = spot;
        else delete next.spot;
        // Saving means the chef has checked the numbers: no more drafts.
        delete next.unconfirmed;
        onSave(next, stationId);
      }}
    >
      {!f.task && !f.frozenEach && !f.boughtIn && (
      <Field label="RECIPE">
          <select className="pass__input" value={f.recipeId} onChange={(e) => pickRecipe(e.target.value)}>
            <option value="">No recipe yet</option>
            {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="NAME ON THE COUNT">
        <input className="pass__input" value={f.name} placeholder="e.g. Lobster stock" onChange={(e) => set("name", e.target.value)} />
      </Field>
      {dupName && <p className="pass__hint chef__late">Already on {target.name}.</p>}

      {!backup && <>
        <span className="pass__countlabel">HOW IT COMES IN</span>
        <div className="chef__servicetoggle chef__toggle4" role="group" aria-label="How it comes in">
          {[["recipe", "RECIPE"], ["task", "PREP TASK"], ["boughtIn", "BOUGHT IN"], ["frozenEach", "PRECUT, FROZEN"]].map(([k, label]) => {
            const on = k === "recipe" ? !f.frozenEach && !f.task && !f.boughtIn : f[k];
            return <button key={k} type="button" className={on ? "is-on" : ""} aria-pressed={on} onClick={() => setF((x) => ({ ...x, frozenEach: k === "frozenEach", task: k === "task", boughtIn: k === "boughtIn" }))}>{label}</button>;
          })}
        </div>
      </>}
      {!backup && railSlots(target).length > 0 && <>
        <span className="pass__countlabel">RAIL SLOT ({target.name.toUpperCase()} IS {target.railPans} HOTEL PANS WIDE)</span>
        <div className="fz__need">
          {railSlots(target).map((n) => (
            <button key={n} type="button" className={`fz__chip${f.slot === n ? " is-on" : ""}`} aria-pressed={f.slot === n} onClick={() => set("slot", f.slot === n ? null : n)}>{n}</button>
          ))}
          <button type="button" className={`fz__chip${!f.slot ? " is-on" : ""}`} aria-pressed={!f.slot} onClick={() => set("slot", null)}>NOT ON THE RAIL</button>
        </div>
        {f.slot && slotSpots(target, f.slot) > 0 && <>
          <span className="pass__countlabel">WHICH SPOT IN SLOT {f.slot} (1 = BACK LEFT, SNAKING, BACK ROW ON TOP)</span>
          <div className="rail__grid" role="group" aria-label="Which spot in the slot">
            {spotGrid(slotSpots(target, f.slot)).map((n, k) => {
              if (n == null) return <span key={`x${k}`} />;
              const taken = target.items.find((i) => i.id !== item?.id && i.slot === f.slot && i.spot === n);
              return <button key={n} type="button" className={`fz__chip${f.spot === n ? " is-on" : ""}`} aria-pressed={f.spot === n} title={taken ? `${taken.name} is here` : ""} onClick={() => set("spot", f.spot === n ? null : n)}>{n}{taken ? "•" : ""}</button>;
            })}
          </div>
        </>}
        {f.slot && !slotSpots(target, f.slot) && <div className="fz__need" role="group" aria-label="Where in the slot">
          {SPOTS.map((p) => (
            <button key={p} type="button" className={`fz__chip${f.spot === p ? " is-on" : ""}`} aria-pressed={f.spot === p} onClick={() => set("spot", f.spot === p ? null : p)}>{p.toUpperCase()}</button>
          ))}
        </div>}
      </>}
      {f.task && !backup && <>
        <div className="chef__staffrow">
          <Field label="HANDS-ON MINUTES (TO FILL THE PAN)" draft={drafts.has("taskMinutes")}>
            <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.taskMinutes} onChange={(e) => set("taskMinutes", e.target.value)} />
          </Field>
        </div>
        <Field label="WHAT TO DO (OPTIONAL)">
          <input className="pass__input" value={f.taskNote} placeholder="e.g. Shave on the mandoline, cover with oil" onChange={(e) => set("taskNote", e.target.value)} />
        </Field>
        <p className="pass__hint">No recipe: counted like any item, and when it’s short it goes on the prep list as one hands-on step, fitted around the long recipes.</p>
      </>}
      {f.boughtIn && !backup && <>
        <div className="chef__staffrow">
          <Field label="CASE OR PACK (E.G. 5 LB BAG)">
            <input className="pass__input" value={f.caseLabel} placeholder="5 lb bag" onChange={(e) => set("caseLabel", e.target.value)} />
          </Field>
          <Field label="CASE WEIGHS (G)" draft={drafts.has("caseGrams")}>
            <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.caseGrams} placeholder="2268" onChange={(e) => set("caseGrams", e.target.value)} />
          </Field>
        </div>
        <p className="pass__hint">Bought from a vendor, never prepped. Under par, the cook pulls it from the walk-in or dry storage, and it adds up on the order list (Chef › Stock), rounded to whole cases.</p>
      </>}
      {frozen && <>
        <div className="chef__staffrow">
          <Field label="PAR (EACH)" draft={drafts.has("parEach")}>
            <input className="pass__input" type="number" inputMode="numeric" min="0" value={f.parEach} onChange={(e) => set("parEach", e.target.value)} />
          </Field>
          <Field label="ONE PORTION (G)" draft={drafts.has("eachGrams")}>
            <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.eachGrams} onChange={(e) => set("eachGrams", e.target.value)} />
          </Field>
        </div>
        <div className="chef__staffrow">
          <Field label="SHELF LIFE, THAWED (DAYS)" draft={drafts.has("shelfLifeDays")}>
            <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.shelfLifeDays} onChange={(e) => set("shelfLifeDays", e.target.value)} />
          </Field>
        </div>
        <p className="pass__hint">Counted each at close. Under par goes on the chef’s freezer pull list, and the cook collects it thawed from the walk-in. Never prepped.</p>
      </>}
      {!frozen && <>

      {!backup && <>
      <span className="pass__countlabel">LINE PAN{drafts.has("pan") ? " · DRAFT" : ""}</span>
      <div className={`chef__servicetoggle chef__pantoggle${drafts.has("pan") ? " chef__draftfield" : ""}`} role="group" aria-label="Line pan">
        {PANS.map((p) => (
          <button key={p} type="button" className={f.pan === p ? "is-on" : ""} aria-pressed={f.pan === p} onClick={() => pickPan(p)}>{p.toUpperCase()}</button>
        ))}
      </div>

      <div className="chef__staffrow">
        <Field label="FULL PAN (G)" draft={drafts.has("panGrams")}>
          <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.panGrams} onChange={(e) => set("panGrams", e.target.value)} />
        </Field>
      </div>
      </>}
      <div className="chef__staffrow">
        <Field label="SHELF LIFE (DAYS)" draft={drafts.has("shelfLifeDays")}>
          <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.shelfLifeDays} onChange={(e) => set("shelfLifeDays", e.target.value)} />
        </Field>
      </div>

      <span className="pass__countlabel">{backup ? "BACKUP CONTAINERS" : "LOWBOY BACKUP"}{drafts.has("lowboySize") ? " · DRAFT" : ""}</span>
      <div className={`chef__servicetoggle${drafts.has("lowboySize") ? " chef__draftfield" : ""}`} role="group" aria-label="Lowboy container">
        {[["qt", "QUARTS"], ["pt", "PINTS"]].map(([v, l]) => (
          <button key={v} type="button" className={f.lowboySize === v ? "is-on" : ""} aria-pressed={f.lowboySize === v} onClick={() => set("lowboySize", v)}>{l}</button>
        ))}
      </div>
      <div className="chef__staffrow">
        <Field label={`${backup ? "PREP PAR" : "PAR"} (${f.lowboySize === "pt" ? "PINTS" : "QUARTS"})`} draft={drafts.has("lowboyPar")}>
          <input className="pass__input" type="number" inputMode="decimal" min="0" step="0.5" value={f.lowboyPar} onChange={(e) => set("lowboyPar", e.target.value)} />
        </Field>
        <Field label="1 QUART WEIGHS (G)" draft={drafts.has("qtGrams")}>
          <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.qtGrams} onChange={(e) => set("qtGrams", e.target.value)} />
        </Field>
      </div>
      <p className="pass__hint">
        {backup
          ? `${target.name} counts all the backup for this item, walk-in and lowboys, until a line station pulls it to the line. Prep par is how much to keep on hand. Under par, plus whatever the line stations ask for, goes on the prep list.`
          : f.madeAt
            ? "Collect only: this station counts just its line pan. The backup and its par belong to the station that makes it."
            : "Line par is how full the pan should be at open. Lowboy par is the backup to keep on hand. Anything under par goes on the prep list."}
      </p>

      </>}

      {!frozen && stations.length > 1 && (
        <>
          <Field label="WHO MAKES IT">
            <select className="pass__input" value={f.madeAt === f.stationId ? "" : f.madeAt} onChange={(e) => set("madeAt", e.target.value)}>
              <option value="">{target.name} makes it (goes on its prep list)</option>
              {stations.filter((s) => s.id !== f.stationId).map((s) => <option key={s.id} value={s.id}>{s.name} makes it, {target.name} only collects</option>)}
            </select>
          </Field>
          <p className="pass__hint">When another station makes it, this station only restocks from backup. If backup runs short, the cook is told to ask that station.</p>
        </>
      )}

      {item && stations.length > 1 && (
        <Field label="STATION">
          <select className="pass__input" value={f.stationId} onChange={(e) => set("stationId", e.target.value)}>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      )}

      {drafts.size > 0 && (
        <p className="pass__hint">
          <span className="chef__draftswatch" /> Light blue = a starting number to check ({[...drafts].map((d) => FIELD_LABEL[d] ?? d).join(", ")}). Saving confirms them.
        </p>
      )}

      <div className="chef__sampleactions">
        <button type="submit" className="pass__cta" disabled={!ok}>{item ? "SAVE" : `ADD TO ${station.name.toUpperCase()}`}</button>
        <button type="button" className="pass__ghost" onClick={onCancel}>Cancel</button>
        {item && (
          <button type="button" className="pass__ghost chef__late" onClick={() => (askRemove ? onRemove() : setAskRemove(true))}>
            {askRemove ? `Tap again to take it off ${station.name}` : "Remove"}
          </button>
        )}
      </div>
    </form>
  );
}

// The rail, slot by slot: what's in each and how full it is. A slot holds
// one full hotel pan's worth of fractional pans.
function RailMap({ station, onEditItem }) {
  const { slots, unplaced } = railMap(station);
  return (
    <div className="rail">
      <span className="pass__countlabel">THE RAIL · SLOTS 1–{slots.length} · BACK AT THE TOP</span>
      <div className="rail__slots" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}>
        {slots.map((s) => (
          <div key={s.slot} className={`rail__slot${s.used > 1.001 ? " is-over" : ""}`}>
            <span className="rail__num">{s.slot}</span>
            {s.spots ? (
              <div className="rail__spots">
                {spotGrid(s.spots).map((n, k) => {
                  if (n == null) return <span key={`x${k}`} />;
                  const here = s.items.filter((i) => i.spot === n);
                  return here.length
                    ? <button key={n} type="button" className={`rail__pan${here.length > 1 ? " is-over" : ""}`} onClick={() => onEditItem(here[0])}><span className="rail__pansize">{n}</span><span className="rail__panname">{here.map((i) => i.name).join(" + ")}</span></button>
                    : <span key={n} className="rail__free"><span className="rail__pansize">{n}</span></span>;
                })}
                {s.items.filter((i) => typeof i.spot !== "number").map((i) => (
                  <button key={i.id} type="button" className="rail__pan rail__nospot" onClick={() => onEditItem(i)}><span className="rail__pansize">no spot</span><span className="rail__panname">{i.name}</span></button>
                ))}
              </div>
            ) : s.items.map((i) => (
              <button key={i.id} type="button" className="rail__pan" style={{ flexGrow: Math.max(PAN_SHARE[i.pan] ?? 0.1, 0.1) }} onClick={() => onEditItem(i)}>
                <span className="rail__pansize">{i.pan}{i.spot ? ` · ${spotLabel(i.spot)}` : ""}</span>
                <span className="rail__panname">{i.name}</span>
              </button>
            ))}
            {s.used < 0.999 && !s.spots && <span className="rail__free" style={{ flexGrow: 1 - s.used }} />}
            <span className="rail__used">{s.spots ? `${s.items.length} / ${s.spots}` : `${shareLabel(s.used)} / 1`}</span>
          </div>
        ))}
      </div>
      {slots.filter((s) => s.spots && s.items.length).map((s) => (
        <p key={`k${s.slot}`} className="pass__hint">Slot {s.slot}: {s.items.filter((i) => typeof i.spot === "number").sort((a, b) => a.spot - b.spot).map((i) => `${i.spot} ${i.name}`).join(" · ")}</p>
      ))}
      {slots.filter((s) => s.used > 1.001).map((s) => (
        <p key={s.slot} className="pass__hint chef__late">{s.spots ? `Slot ${s.slot} is over: ${s.items.length} items for ${s.spots} spots.` : `Slot ${s.slot} is over: ${s.items.map((i) => i.pan).join(" + ")} is more than one hotel pan.`}</p>
      ))}
      <p className="pass__hint">{unplaced.length ? `Not on the rail yet: ${unplaced.map((i) => i.name).join(", ")}. Tap an item and pick its slot.` : "Every item has a slot."} The count goes slot 1 to {slots.length}.</p>
    </div>
  );
}

// One station: its name, line par and items.
function StationEditor({ station, stations, onSave, onRemove, onBack, onEditItem, onAddItem, onMoveItem }) {
  const [name, setName] = useState(station.name);
  const [askRemove, setAskRemove] = useState(false);
  const dup = stations.some((s) => s.id !== station.id && s.name.toLowerCase() === name.trim().toLowerCase());
  const changed = name.trim() && name.trim() !== station.name && !dup;
  const drafts = station.items.filter((i) => i.unconfirmed?.length).length;
  return (
    <section className="chef__data">
      <button type="button" className="pass__ghost chef__backlink" onClick={onBack}>← All stations</button>
      <div className="chef__staffform">
        <Field label="STATION NAME">
          <input className="pass__input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {dup && <p className="pass__hint chef__late">There’s already a station called that.</p>}
        {changed && <button type="button" className="pass__ghostbtn" onClick={() => onSave({ ...station, name: name.trim() })}>SAVE NAME</button>}

        <span className="pass__countlabel">WHAT THIS STATION DOES</span>
        <div className="chef__servicetoggle" role="group" aria-label="Station kind">
          <button type="button" className={!station.holdsBackup ? "is-on" : ""} aria-pressed={!station.holdsBackup} onClick={() => onSave({ ...station, holdsBackup: false, linePar: station.linePar || 100 })}>LINE (SERVICE)</button>
          <button type="button" className={station.holdsBackup ? "is-on" : ""} aria-pressed={Boolean(station.holdsBackup)} onClick={() => onSave({ ...station, holdsBackup: true, linePar: 0 })}>PREP (HOLDS BACKUP)</button>
        </div>
        {station.holdsBackup ? (
          <p className="pass__hint">No line pans. It counts all the backup for its items against each item’s prep par, and line stations collect from it.</p>
        ) : <>
        <span className="pass__countlabel">LINE PANS FILLED TO AT OPEN</span>
        <div className="chef__servicetoggle" role="group" aria-label="Line par">
          {LINE_PARS.map((p) => (
            <button key={p} type="button" className={station.linePar === p ? "is-on" : ""} aria-pressed={station.linePar === p} onClick={() => onSave({ ...station, linePar: p })}>{p}%</button>
          ))}
        </div>
        <Field label="RAIL WIDTH (FULL HOTEL PANS, 0 = NONE)">
          <input className="pass__input" type="number" inputMode="numeric" min="0" max="12" value={station.railPans ?? 0}
            onChange={(e) => onSave({ ...station, railPans: Math.max(0, Math.min(12, Number(e.target.value) || 0)) })} />
        </Field>
        {railSlots(station).length > 0 && <>
          <span className="pass__countlabel">HOW EACH SLOT IS SET</span>
          {railSlots(station).map((n) => (
            <div key={n} className="rail__layoutrow">
              <span className="pass__mono">SLOT {n}</span>
              <select className="pass__input" aria-label={`Slot ${n} layout`} value={slotSpots(station, n)}
                onChange={(e) => { const v = Number(e.target.value); const railLayout = { ...(station.railLayout ?? {}) }; if (v) railLayout[n] = v; else delete railLayout[n]; onSave({ ...station, railLayout }); }}>
                <option value={0}>By pan size (one hotel pan)</option>
                {[2, 3, 4, 5, 6, 8, 9].map((v) => <option key={v} value={v}>{v} pans = full</option>)}
              </select>
            </div>
          ))}
          <RailMap station={station} onEditItem={onEditItem} />
        </>}
        </>}
      </div>

      <div className="pass__sectionhead">
        <h2>Items</h2>
        <span className="pass__countlabel">{station.items.length} ON THE COUNT</span>
      </div>
      {drafts > 0 && <p className="pass__hint"><span className="chef__draftswatch" /> {drafts} item{drafts > 1 ? "s have" : " has"} light-blue starting numbers to check.</p>}
      {station.items.length === 0 && <p className="pass__empty">No items yet. Add what this station counts and preps.</p>}
      <ul className="chef__setup">
        {station.items.map((item, i) => (
          <li key={item.id} className="chef__itemrow">
            <button type="button" className="chef__setuprow" onClick={() => onEditItem(item)}>
              <span className="pass__rowtext">
                <span className="pass__rowname">
                  {item.name}
                  {item.unconfirmed?.length > 0 && <span className="chef__draftswatch chef__draftdot" title="Has draft numbers" />}
                </span>
                <span className="pass__rowsub">
                  {item.frozenEach ? `precut, frozen · par ${item.parEach} each · from the freezer` : item.task ? `prep task · ${item.pan} pan · ${item.taskMinutes} min hands-on` : item.boughtIn ? `bought in · ${item.pan} pan${item.caseLabel ? ` · ${item.caseLabel}` : ""}` : station.holdsBackup ? `prep par ${item.lowboyPar} ${item.lowboySize}` : `${item.pan} pan · par ${item.lowboyPar} ${item.lowboySize}`} · {item.shelfLifeDays} day{item.shelfLifeDays === 1 ? "" : "s"}{item.recipeId || item.frozenEach || item.task || item.boughtIn ? "" : " · no recipe"}{item.madeAt ? ` · collect only, ${stations.find((s) => s.id === item.madeAt)?.name ?? "another station"} makes it` : ""}{item.slot && railSlots(station).includes(item.slot) ? ` · slot ${item.slot}${item.spot ? ` ${spotLabel(item.spot)}` : ""}` : ""}
                </span>
              </span>
              <span className="pass__open">EDIT ›</span>
            </button>
            <span className="chef__orderbtns">
              <button type="button" aria-label={`Move ${item.name} up`} disabled={i === 0} onClick={() => onMoveItem(i, -1)}>▲</button>
              <button type="button" aria-label={`Move ${item.name} down`} disabled={i === station.items.length - 1} onClick={() => onMoveItem(i, 1)}>▼</button>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="pass__cta" onClick={onAddItem}>+ ADD AN ITEM</button>
      <p className="pass__hint">The count lists items in this order. Changes reach every phone; cooks see them on their next count.</p>

      {stations.length > 1 && (
        <button type="button" className="pass__ghost chef__late" onClick={() => (askRemove ? onRemove() : setAskRemove(true))}>
          {askRemove ? `Tap again to remove ${station.name} and its ${station.items.length} items` : "Remove this station"}
        </button>
      )}
    </section>
  );
}


// Tap a recipe, switch each station on or off. On adds the recipe to that
// station's count with starting numbers (light blue drafts, copied from
// another station that already has it when there is one). Off takes it off
// that station's count.
function RecipeAccess({ recipe, stations, onChange, onBack, onEditItem }) {
  return (
    <section className="chef__data">
      <button type="button" className="pass__ghost chef__backlink" onClick={onBack}>← All recipes</button>
      <div className="pass__sectionhead">
        <h2>{recipe.name}</h2>
      </div>
      <span className="pass__countlabel">STATIONS THAT HAVE IT</span>
      <ul className="chef__setup">
        {stations.map((s) => {
          const item = s.items.find((i) => i.recipeId === recipe.id || i.id === recipe.id);
          const on = Boolean(item);
          return (
            <li key={s.id} className="chef__itemrow chef__accessrow">
              <button
                type="button"
                className={`chef__stationpick chef__accesstoggle ${on ? "is-on" : ""}`}
                aria-pressed={on}
                onClick={() => onChange(on ? removeRecipeFrom(stations, s.id, recipe.id) : addRecipeTo(stations, s.id, recipe))}
              >
                <span className="chef__accessname">{s.name}</span>
                <span className="pass__mono">{on ? "ON" : "OFF"}</span>
              </button>
              {on && (
                <button type="button" className="pass__ghost" onClick={() => onEditItem(s.id, item.id)}>
                  {item.unconfirmed?.length > 0 && <span className="chef__draftswatch chef__draftdot" />} PARS ›
                </button>
              )}
              {on && item.madeAt && <span className="pass__rowsub chef__accesssub">collect only, {stations.find((m) => m.id === item.madeAt)?.name ?? "another station"} makes it</span>}
            </li>
          );
        })}
      </ul>
      <p className="pass__hint">
        ON puts it on that station’s count and prep list, with light-blue starting numbers to check under PARS. OFF takes it off that station.
        When a Prep station has it, line stations that have it collect it from Prep.
      </p>
    </section>
  );
}

function RecipeList({ recipes, stations, onPick }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? recipes.filter((r) => r.name.toLowerCase().includes(term)) : recipes;
  return (
    <>
      <input className="pass__input" type="search" placeholder={`Find a recipe… (${recipes.length})`} aria-label="Find a recipe" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="chef__setup">
        {shown.map((r) => {
          const on = stations.filter((s) => hasRecipe(s, r.id)).map((s) => s.name);
          return (
            <li key={r.id}>
              <button type="button" className="chef__setuprow" onClick={() => onPick(r.id)}>
                <span className="pass__rowtext">
                  <span className="pass__rowname">{r.name}</span>
                  <span className="pass__rowsub">{on.length ? on.join(" · ") : "Not on any station"}</span>
                </span>
                <span className="pass__open">STATIONS ›</span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="pass__empty">No recipe matches “{q}”.</p>}
    </>
  );
}

export default function StationsSetup({ recipesById }) {
  const [stations, setStations] = useState(() => getStations());
  const [view, setView] = useState({ kind: "list" }); // list | station | item | recipe
  const [tab, setTab] = useState("stations"); // stations | recipes
  // Phone back steps up one level here before leaving Stations & pars.
  useBack(() => {
    if (view.kind === "item") { setView(view.back ?? { kind: "station", stationId: view.stationId }); return true; }
    if (view.kind !== "list") { setView({ kind: "list" }); return true; }
    return false;
  }, 2);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const recipes = [...(recipesById?.values() ?? [])].filter((r) => r.kind !== "dish" && !isCateringRecipe(r)).sort((a, b) => a.name.localeCompare(b.name));

  function commit(next) {
    setStations(next);
    saveStationSetup(next);
  }
  const updateStation = (st) => commit(stations.map((s) => (s.id === st.id ? st : s)));

  const station = view.stationId ? stations.find((s) => s.id === view.stationId) : null;

  if (view.kind === "recipe") {
    const recipe = recipes.find((r) => r.id === view.recipeId);
    if (recipe) {
      return (
        <RecipeAccess
          recipe={recipe}
          stations={stations}
          onChange={commit}
          onBack={() => setView({ kind: "list" })}
          onEditItem={(stationId, itemId) => setView({ kind: "item", stationId, itemId, back: { kind: "recipe", recipeId: recipe.id } })}
        />
      );
    }
  }

  if (view.kind === "item" && station) {
    const item = view.itemId ? station.items.find((i) => i.id === view.itemId) : null;
    const back = view.back ?? { kind: "station", stationId: station.id };
    return (
      <section className="chef__data">
        <div className="pass__sectionhead">
          <h2>{item ? item.name : `New item · ${station.name}`}</h2>
        </div>
        <ItemForm
          item={item}
          station={station}
          stations={stations}
          recipes={recipes}
          onCancel={() => setView(back)}
          onRemove={() => {
            updateStation({ ...station, items: station.items.filter((i) => i !== item) });
            setView(back);
          }}
          onSave={(next, toId) => {
            const dest = stations.find((s) => s.id === toId);
            let saved = next;
            if (!item || toId !== station.id) {
              const taken = new Set(dest.items.filter((i) => i !== item).map((i) => i.id));
              const base = item ? item.id : slug(next.name);
              saved = { ...next, id: taken.has(base) ? uniqueId(slug(next.name), taken) : base };
            }
            if (saved.task) saved = { ...saved, recipeId: taskRecipeId(saved.id) };
            commit(stations.map((s) => {
              if (s.id === station.id && s.id === toId) return { ...s, items: item ? s.items.map((i) => (i === item ? saved : i)) : [...s.items, saved] };
              if (s.id === station.id) return { ...s, items: s.items.filter((i) => i !== item) };
              if (s.id === toId) return { ...s, items: [...s.items, saved] };
              return s;
            }));
            setView(back);
          }}
        />
      </section>
    );
  }

  if (view.kind === "station" && station) {
    return (
      <StationEditor
        key={station.id}
        station={station}
        stations={stations}
        onBack={() => setView({ kind: "list" })}
        onSave={updateStation}
        onRemove={() => { commit(stations.filter((s) => s.id !== station.id)); setView({ kind: "list" }); }}
        onEditItem={(item) => setView({ kind: "item", stationId: station.id, itemId: item.id })}
        onAddItem={() => setView({ kind: "item", stationId: station.id, itemId: null })}
        onMoveItem={(i, by) => updateStation({ ...station, items: move(station.items, i, by) })}
      />
    );
  }

  const dupNew = stations.some((s) => s.name.toLowerCase() === newName.trim().toLowerCase());
  const flags = setupFlags(stations);
  const tabs = (
    <div className="chef__servicetoggle" role="group" aria-label="Set up by">
      <button type="button" className={tab === "stations" ? "is-on" : ""} aria-pressed={tab === "stations"} onClick={() => setTab("stations")}>BY STATION</button>
      <button type="button" className={tab === "recipes" ? "is-on" : ""} aria-pressed={tab === "recipes"} onClick={() => setTab("recipes")}>BY RECIPE</button>
    </div>
  );
  if (tab === "recipes") {
    return (
      <section className="chef__data">
        {tabs}
        <div className="pass__sectionhead">
          <h2>Recipes</h2>
          <span className="pass__countlabel">TAP ONE TO SWITCH STATIONS ON OR OFF</span>
        </div>
        <RecipeList recipes={recipes} stations={stations} onPick={(id) => setView({ kind: "recipe", recipeId: id })} />
      </section>
    );
  }
  return (
    <section className="chef__data">
      {tabs}
      <div className="pass__sectionhead">
        <h2>Stations</h2>
        <span className="pass__countlabel">{stations.length} STATIONS</span>
      </div>
      {flags.length > 0 && (
        <div className="pass__note">
          <span className="pass__countlabel">TO SET UP</span>
          {flags.map((fl) => (
            <p key={`${fl.stationId}:${fl.itemId}:${fl.text}`}>
              {fl.draft && <span className="chef__draftswatch" />}{" "}
              <button type="button" className="pass__linkbtn" onClick={() => setView({ kind: "item", stationId: fl.stationId, itemId: fl.itemId })}>{fl.text}</button>
            </p>
          ))}
        </div>
      )}
      <ul className="chef__setup">
        {stations.map((s, i) => {
          const drafts = s.items.filter((it) => it.unconfirmed?.length).length;
          return (
            <li key={s.id} className="chef__itemrow">
              <button type="button" className="chef__setuprow" onClick={() => setView({ kind: "station", stationId: s.id })}>
                <span className="pass__rowtext">
                  <span className="pass__rowname">{s.name}</span>
                  <span className="pass__rowsub">
                    {s.items.length ? `${s.items.length} items · line to ${s.linePar}%` : "No items yet"}
                    {drafts > 0 && ` · ${drafts} to check`}
                  </span>
                </span>
                <span className="pass__open">OPEN ›</span>
              </button>
              <span className="chef__orderbtns">
                <button type="button" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => commit(move(stations, i, -1))}>▲</button>
                <button type="button" aria-label={`Move ${s.name} down`} disabled={i === stations.length - 1} onClick={() => commit(move(stations, i, 1))}>▼</button>
              </span>
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          className="chef__staffform"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim() || dupNew) return;
            const id = uniqueId(slug(newName), new Set(stations.map((s) => s.id)));
            commit([...stations, { id, name: newName.trim(), linePar: 100, items: [] }]);
            setAdding(false);
            setNewName("");
            setView({ kind: "station", stationId: id });
          }}
        >
          <Field label="NEW STATION NAME">
            <input className="pass__input" autoFocus value={newName} placeholder="e.g. Pizza, Expo, Banquet" onChange={(e) => setNewName(e.target.value)} />
          </Field>
          {dupNew && <p className="pass__hint chef__late">There’s already a station called that.</p>}
          <div className="chef__sampleactions">
            <button type="submit" className="pass__cta" disabled={!newName.trim() || dupNew}>ADD STATION</button>
            <button type="button" className="pass__ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="pass__cta" onClick={() => setAdding(true)}>+ ADD A STATION</button>
      )}
      <p className="pass__hint">Each station gets its own count, gather list and prep list. Who can open which station is set under Staff.</p>
    </section>
  );
}
