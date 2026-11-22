import { useState } from "react";
import { getStations } from "../data/stations";
import { saveStationSetup } from "../lib/storage";
import { PANS, PAN_GRAMS } from "../lib/panSize";

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
  }));
  const [askRemove, setAskRemove] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const drafts = new Set(item?.unconfirmed ?? []);
  const num = (v) => Number(v);
  const target = stations.find((s) => s.id === f.stationId);
  const dupName = target.items.some((i) => i !== item && i.name.toLowerCase() === f.name.trim().toLowerCase());
  const ok = f.name.trim() && !dupName && num(f.panGrams) > 0 && num(f.qtGrams) > 0 && num(f.lowboyPar) >= 0 && num(f.shelfLifeDays) >= 1;

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
        const { stationId, madeAt, ...rest } = f;
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
        if (madeAt && madeAt !== stationId) next.madeAt = madeAt;
        else delete next.madeAt;
        // Saving means the chef has checked the numbers: no more drafts.
        delete next.unconfirmed;
        onSave(next, stationId);
      }}
    >
      <Field label="RECIPE">
        <select className="pass__input" value={f.recipeId} onChange={(e) => pickRecipe(e.target.value)}>
          <option value="">No recipe yet</option>
          {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      <Field label="NAME ON THE COUNT">
        <input className="pass__input" value={f.name} placeholder="e.g. Lobster stock" onChange={(e) => set("name", e.target.value)} />
      </Field>
      {dupName && <p className="pass__hint chef__late">Already on {target.name}.</p>}

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
        <Field label="SHELF LIFE (DAYS)" draft={drafts.has("shelfLifeDays")}>
          <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.shelfLifeDays} onChange={(e) => set("shelfLifeDays", e.target.value)} />
        </Field>
      </div>

      <span className="pass__countlabel">LOWBOY BACKUP{drafts.has("lowboySize") ? " · DRAFT" : ""}</span>
      <div className={`chef__servicetoggle${drafts.has("lowboySize") ? " chef__draftfield" : ""}`} role="group" aria-label="Lowboy container">
        {[["qt", "QUARTS"], ["pt", "PINTS"]].map(([v, l]) => (
          <button key={v} type="button" className={f.lowboySize === v ? "is-on" : ""} aria-pressed={f.lowboySize === v} onClick={() => set("lowboySize", v)}>{l}</button>
        ))}
      </div>
      <div className="chef__staffrow">
        <Field label={`PAR (${f.lowboySize === "pt" ? "PINTS" : "QUARTS"})`} draft={drafts.has("lowboyPar")}>
          <input className="pass__input" type="number" inputMode="decimal" min="0" step="0.5" value={f.lowboyPar} onChange={(e) => set("lowboyPar", e.target.value)} />
        </Field>
        <Field label="1 QUART WEIGHS (G)" draft={drafts.has("qtGrams")}>
          <input className="pass__input" type="number" inputMode="numeric" min="1" value={f.qtGrams} onChange={(e) => set("qtGrams", e.target.value)} />
        </Field>
      </div>
      <p className="pass__hint">
        Line par is how full the pan should be at open. Lowboy par is the backup to keep on hand. Anything under par goes on the prep list.
      </p>

      {stations.length > 1 && (
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

        <span className="pass__countlabel">LINE PANS FILLED TO AT OPEN</span>
        <div className="chef__servicetoggle" role="group" aria-label="Line par">
          {LINE_PARS.map((p) => (
            <button key={p} type="button" className={station.linePar === p ? "is-on" : ""} aria-pressed={station.linePar === p} onClick={() => onSave({ ...station, linePar: p })}>{p}%</button>
          ))}
        </div>
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
                  {item.pan} pan · par {item.lowboyPar} {item.lowboySize} · {item.shelfLifeDays} day{item.shelfLifeDays === 1 ? "" : "s"}{item.recipeId ? "" : " · no recipe"}{item.madeAt ? ` · collect only, ${stations.find((s) => s.id === item.madeAt)?.name ?? "another station"} makes it` : ""}
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

export default function StationsSetup({ recipesById }) {
  const [stations, setStations] = useState(() => getStations());
  const [view, setView] = useState({ kind: "list" }); // list | station | item
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const recipes = [...(recipesById?.values() ?? [])].filter((r) => r.kind !== "dish").sort((a, b) => a.name.localeCompare(b.name));

  function commit(next) {
    setStations(next);
    saveStationSetup(next);
  }
  const updateStation = (st) => commit(stations.map((s) => (s.id === st.id ? st : s)));

  const station = view.stationId ? stations.find((s) => s.id === view.stationId) : null;

  if (view.kind === "item" && station) {
    const item = view.itemId ? station.items.find((i) => i.id === view.itemId) : null;
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
          onCancel={() => setView({ kind: "station", stationId: station.id })}
          onRemove={() => {
            updateStation({ ...station, items: station.items.filter((i) => i !== item) });
            setView({ kind: "station", stationId: station.id });
          }}
          onSave={(next, toId) => {
            const dest = stations.find((s) => s.id === toId);
            let saved = next;
            if (!item || toId !== station.id) {
              const taken = new Set(dest.items.filter((i) => i !== item).map((i) => i.id));
              const base = item ? item.id : slug(next.name);
              saved = { ...next, id: taken.has(base) ? uniqueId(slug(next.name), taken) : base };
            }
            commit(stations.map((s) => {
              if (s.id === station.id && s.id === toId) return { ...s, items: item ? s.items.map((i) => (i === item ? saved : i)) : [...s.items, saved] };
              if (s.id === station.id) return { ...s, items: s.items.filter((i) => i !== item) };
              if (s.id === toId) return { ...s, items: [...s.items, saved] };
              return s;
            }));
            setView({ kind: "station", stationId: station.id });
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
  return (
    <section className="chef__data">
      <div className="pass__sectionhead">
        <h2>Stations</h2>
        <span className="pass__countlabel">{stations.length} STATIONS</span>
      </div>
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
