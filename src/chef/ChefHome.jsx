import { useEffect, useMemo, useState } from "react";
import { STATIONS } from "../data/stations";
import {
  loadShift, loadInventory, loadCook, loadStaff, loadEightySix, saveEightySix, loadChefAlerts, saveChefAlerts,
  loadWaste, loadChefSettings, saveChefSettings, loadCovers, saveCovers,
} from "../lib/storage";
import { buildPrepSteps } from "../lib/lineList";
import { applyShortages } from "../lib/shortage";
import { crewStatus, currentServiceShift, stepIsDone, todayAt } from "../lib/crew";
import { formatG } from "../lib/inventory";
import Numbers from "./Numbers";
import { addItem, bumpItem, skipItem } from "../lib/chefActions";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const time = (ms) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayTime = (ms) => {
  const d = new Date(ms);
  return `${DAY_NAMES[d.getDay()]} ${time(ms)}`;
};

const STATE_LABEL = { green: "ON TIME", yellow: "IN MARGIN", red: "BEHIND", gathering: "GATHERING", done: "PREP DONE", signedin: "SIGNED IN" };

// Everything the chef needs at the top of a shift, read from what the line
// cooks have saved. Until the shared database exists this only sees the data
// on this phone.
// view "home": the oversight board. "crew": each cook's live prep list.
// "stock": 86s, short ingredients, waste.
const VIEWS = {
  home: { numbers: true, covers: true, crew: true, flags: true, alerts: true, close: true, todos: true },
  crew: { crew: true, lists: true },
  stock: { flags: true, addFlag: true, alerts: true, close: true, stock: true },
};

// One cook's day at a glance, with the chef's hole-plugging controls: do an
// item first, skip it today (or put it back), and add a one-off item.
function CookList({ st, shift, plan, rows, recipes, by, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [recipeId, setRecipeId] = useState("");
  const [grams, setGrams] = useState("");
  const steps = plan.steps.filter((s) => s.kind !== "wait");
  const next = steps.find((s) => !stepIsDone(s, shift));
  const collectDone = shift.collect.filter((c) => shift.done?.[`c:${c.id}`]).length;
  const items = rows.filter((r) => (r.plannedG ?? r.makeG) > 0 || shift.skip?.[r.id]);
  const act = (fn) => { fn(); onChanged(); };
  return (
    <div className="chef__cooklist">
      {next && (
        <p className="chef__now">
          <span className="pass__steptag">NOW · </span>
          {next.name}: {next.actions.length ? next.actions.slice(0, 2).join(" → ") : next.handsOff.map((h) => h.step).join(" → ")}
        </p>
      )}
      {shift.collect.length > 0 && <span className="pass__rowsub">Collect {collectDone} of {shift.collect.length}</span>}
      <ul className="chef__items">
        {items.map((r) => {
          const own = steps.filter((s) => s.item?.id === r.id);
          const doneN = own.filter((s) => stepIsDone(s, shift)).length;
          const done = Boolean(shift.done?.[`p:${r.id}`]);
          const skipped = Boolean(shift.skip?.[r.id]);
          const first = shift.bump === r.id;
          const state = skipped ? "SKIPPED" : r.makeG === 0 ? "CAN’T MAKE" : done ? "DONE" : own.length === 0 && !r.extra ? "NO RECIPE" : doneN > 0 ? `${doneN}/${own.length} STEPS` : "NOT STARTED";
          return (
            <li key={r.id} className={done ? "is-done" : skipped ? "is-skipped" : r.makeG === 0 ? "is-cant" : ""}>
              <span>
                {first && !done && <span className="pass__chefbump">FIRST</span>} {r.name}
                {r.extra && <span className="pass__muted"> · added</span>}
              </span>
              <span className="pass__mono">{formatG(r.makeG)}{r.limitedBy ? " ↓" : ""}</span>
              <span className="chef__itemstate">{state}</span>
              {!done && (
                <span className="chef__itemacts">
                  {!skipped && !first && (
                    <button type="button" onClick={() => act(() => bumpItem(st.id, r, by))}>DO FIRST</button>
                  )}
                  <button type="button" onClick={() => act(() => skipItem(st.id, r, !skipped, by))}>{skipped ? "PUT BACK" : "SKIP"}</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {adding ? (
        <form
          className="chef__addform"
          onSubmit={(e) => {
            e.preventDefault();
            const recipe = recipes.find((x) => x.id === recipeId);
            const g = Number(grams);
            if (!recipe || !(g > 0)) return;
            act(() => addItem(st.id, recipe, g, by));
            setAdding(false);
            setRecipeId("");
            setGrams("");
          }}
        >
          <select className="pass__input" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} aria-label="Recipe">
            <option value="">Pick a recipe…</option>
            {recipes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <input className="pass__input" type="number" inputMode="numeric" min="1" placeholder="grams" value={grams} onChange={(e) => setGrams(e.target.value)} aria-label="Grams to make" />
          <button type="submit" className="chef__ack" disabled={!recipeId || !(Number(grams) > 0)}>ADD</button>
          <button type="button" className="pass__ghost" onClick={() => setAdding(false)}>Cancel</button>
        </form>
      ) : (
        <button type="button" className="pass__flagbtn" onClick={() => setAdding(true)}>+ Add a one-off item</button>
      )}
    </div>
  );
}

// The 86 / low picker for the chef: any item on any station.
function AddFlags({ onAdd }) {
  const [open, setOpen] = useState(false);
  const items = STATIONS.flatMap((st) => st.items.map((i) => ({ ...i, station: st.name })));
  return (
    <>
      <button type="button" className="pass__flagbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Done flagging" : "+ Flag 86 / running low"}
      </button>
      {open && (
        <ul className="pass__flaglist">
          {items.map((item) => (
            <li key={`${item.station}:${item.id}`}>
              <span>{item.name} <span className="pass__muted">· {item.station}</span></span>
              <span className="pass__flagactions">
                <button type="button" onClick={() => onAdd(item.name, "low")}>LOW</button>
                <button type="button" onClick={() => onAdd(item.name, "86")}>86</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function ChefHome({ today, recipesById, onOpenRecipes, view = "home", by }) {
  const show = VIEWS[view];
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState(() => loadChefSettings());
  const [covers, setCovers] = useState(() => loadCovers());
  const [flags, setFlags] = useState(() => loadEightySix());
  const [alerts, setAlerts] = useState(() => loadChefAlerts());
  const [service, setService] = useState(() => currentServiceShift());
  const recipes = useMemo(() => [...recipesById.values()].sort((a, b) => a.name.localeCompare(b.name)), [recipesById]);

  // Re-read the line's data and tick the clock so the board stays current.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      setFlags(loadEightySix());
      setAlerts(loadChefAlerts());
    }, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { saveChefSettings(settings); }, [settings]);
  useEffect(() => { saveCovers(covers); }, [covers]);

  const staff = useMemo(() => loadStaff(), []);
  const nameOf = (initials) => staff.find((p) => p.initials === initials)?.name ?? initials;
  const coverKey = `${today}:${service}`;
  const serviceMs = todayAt(settings.serviceAt[service]);

  // One entry per station: its open shift (if any), prep plan and status.
  const stations = useMemo(() => STATIONS.map((st) => {
    const shift = loadShift(st.id);
    const inventory = loadInventory(st.id);
    const open = Boolean(shift && !shift.closedAt && shift.date === today);
    const unclosed = Boolean(shift && !shift.closedAt && shift.date !== today);
    let plan = null;
    let status = null;
    let rows = [];
    if (open) {
      rows = applyShortages(shift.prep, shift.short);
      plan = buildPrepSteps(rows.filter((p) => p.makeG > 0 && !shift.skip?.[p.id]), recipesById, { first: shift.bump });
      status = crewStatus(shift, plan, now, settings.marginMin);
    }
    return { st, shift, inventory, open, unclosed, plan, status, rows };
  }), [today, recipesById, now, settings.marginMin]);

  const cook = loadCook();
  const cookOn = cook?.date === today ? cook : null;
  const crew = stations.filter((s) => s.open);
  const onShift = new Set(crew.map((s) => s.shift.confirmedBy));
  const setUp = stations.filter((s) => s.st.items.length > 0);
  const uncovered = setUp.filter((s) => !s.open);
  const notSetUp = stations.filter((s) => s.st.items.length === 0);

  const todaysAlerts = alerts.filter((a) => a.type === "short" && a.date === today);
  const newAlerts = todaysAlerts.filter((a) => !a.seenAt);
  const seenAlerts = todaysAlerts.filter((a) => a.seenAt);
  const waste = loadWaste().filter((w) => w.date === today);

  const noRecipe = crew.flatMap((s) => s.plan.untimed.map((row) => ({ station: s.st.name, name: row.name })));
  const todos = [
    ...stations.filter((s) => s.unclosed).map((s) => `${s.st.name}: last shift (${s.shift.date}) was never closed. Check the count with the cook.`),
    ...noRecipe.map((r) => `Add a recipe for ${r.name} (${r.station}). The cook has no steps or times for it.`),
    ...notSetUp.map((s) => `Set up ${s.st.name}: items, pans and pars.`),
  ];

  function ackAlert(id) {
    const next = alerts.map((a) => (a.id === id ? { ...a, seenAt: Date.now() } : a));
    setAlerts(next);
    saveChefAlerts(next);
  }

  function addFlag(name, kind) {
    const next = [...loadEightySix().filter((f) => f.name !== name), { name, kind, by, at: Date.now() }];
    setFlags(next);
    saveEightySix(next);
  }

  function clearFlag(name) {
    const next = flags.filter((f) => f.name !== name);
    setFlags(next);
    saveEightySix(next);
  }

  const d = new Date(now);
  return (
    <>
      {show.numbers && <Numbers today={today} />}
      {show.covers && (
      <section className="chef__covers" aria-label="Reservations">
        <div className="chef__servicetoggle" role="group" aria-label="Shift">
          {["lunch", "dinner"].map((s) => (
            <button key={s} type="button" className={service === s ? "is-on" : ""} aria-pressed={service === s} onClick={() => setService(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="chef__coverrow">
          <label className="chef__coverfield">
            <span className="pass__countlabel">COVERS</span>
            <input
              className="pass__input chef__covernum"
              type="number"
              inputMode="numeric"
              min="0"
              placeholder="—"
              value={covers[coverKey] ?? ""}
              onChange={(e) => setCovers({ ...covers, [coverKey]: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </label>
          <label className="chef__coverfield">
            <span className="pass__countlabel">SERVICE AT</span>
            <input
              className="pass__input chef__servicetime"
              type="time"
              value={settings.serviceAt[service]}
              onChange={(e) => e.target.value && setSettings({ ...settings, serviceAt: { ...settings.serviceAt, [service]: e.target.value } })}
            />
          </label>
        </div>
        <p className="pass__hint">{DAY_NAMES[d.getDay()]} · {MONTHS[d.getMonth()]} {d.getDate()}. Type covers in from OpenTable until it’s connected.</p>
      </section>
      )}
      {show.crew && (
      <section>
        <div className="pass__sectionhead">
          <h2>Crew</h2>
          <label className="chef__margin">
            <span>RED AFTER</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={settings.marginMin}
              onChange={(e) => setSettings({ ...settings, marginMin: Math.max(0, Number(e.target.value) || 0) })}
              aria-label="Minutes behind before a cook goes red"
            />
            <span>MIN BEHIND</span>
          </label>
        </div>
        <ul className="pass__list">
          {crew.map(({ st, shift, status, plan, rows }) => {
            const late = status.finishAt && status.finishAt > serviceMs;
            return (
              <li key={st.id} className={`chef__cook chef__cook--${status.state}`}>
                <span className="chef__dot" aria-hidden="true" />
                <span className="pass__rowtext">
                  <span className="pass__rowname">{nameOf(shift.confirmedBy)} <span className="pass__muted">· {st.name}</span></span>
                  <span className="pass__rowsub">
                    {status.state === "gathering"
                      ? "On the gather list. Clock starts at FINISH."
                      : `${status.doneSteps} of ${status.totalSteps} steps${status.behindMin > 0 ? ` · ${status.behindMin} min behind` : ""}${status.startedAt ? ` · started ${time(status.startedAt)}` : ""}`}
                  </span>
                  {status.finishAt && (
                    <span className={`pass__rowsub${late ? " chef__late" : ""}`}>
                      Done ~{time(status.finishAt)}{late ? ` · AFTER SERVICE (${time(serviceMs)})` : ` · service ${time(serviceMs)}`}
                    </span>
                  )}
                </span>
                <span className="chef__state">{STATE_LABEL[status.state]}</span>
                {show.lists && <CookList st={st} shift={shift} plan={plan} rows={rows} recipes={recipes} by={by} onChanged={() => setNow(Date.now())} />}
              </li>
            );
          })}
          {cookOn && !onShift.has(cookOn.initials) && (
            <li className="chef__cook chef__cook--signedin">
              <span className="chef__dot" aria-hidden="true" />
              <span className="pass__rowtext">
                <span className="pass__rowname">{cookOn.name}</span>
                <span className="pass__rowsub">Signed in, hasn’t confirmed a count yet.</span>
              </span>
              <span className="chef__state">{STATE_LABEL.signedin}</span>
            </li>
          )}
          {crew.length === 0 && !cookOn && <li className="pass__empty">No one is signed in yet.</li>}
        </ul>
        {uncovered.length > 0 && (
          <div className="chef__missing">
            <span className="pass__countlabel">NO ONE ON</span>
            <span>{uncovered.map((s) => s.st.name).join(", ")}</span>
          </div>
        )}
        <p className="pass__hint">Cooks who are scheduled but not signed in will show here once the staff schedule is in.</p>
      </section>
      )}
      {show.flags && (
      <section>
        <div className="pass__sectionhead"><h2>86 / Low</h2></div>
        {flags.length > 0 ? (
          <div className="pass__86">
            {flags.map((f) => (
              <button key={f.name} type="button" className={`pass__86chip${f.kind === "low" ? " is-low" : ""}`} onClick={() => clearFlag(f.name)} aria-label={`Clear ${f.name}`}>
                {f.kind === "low" ? "LOW " : "86 "}{f.name}{f.by ? ` · ${f.by}` : ""} ✕
              </button>
            ))}
          </div>
        ) : (
          <p className="pass__empty">Nothing 86’d or running low.</p>
        )}
        {show.addFlag && <AddFlags onAdd={addFlag} />}
      </section>
      )}
      {show.alerts && (
      <section>
        <div className="pass__sectionhead">
          <h2>Low ingredients</h2>
          {newAlerts.length > 0 && <span className="chef__badge">{newAlerts.length} NEW</span>}
        </div>
        {todaysAlerts.length === 0 && <p className="pass__empty">No ingredient shortages today.</p>}
        <ul className="pass__list">
          {[...newAlerts, ...seenAlerts].map((a) => (
            <li key={a.id} className={`chef__alert${a.seenAt ? " is-seen" : ""}`}>
              <span className="pass__rowtext">
                <span className="pass__rowname">Short on {a.ingredient}</span>
                <span className="pass__rowsub">{a.station} · have {formatG(a.haveG)} of {formatG(a.needG)} · {a.by} {time(a.at)}</span>
                {a.items.map((it) => (
                  <span key={it.name} className="chef__scaled">
                    {it.makeG === 0 ? `${it.name}: can’t make (needed ${formatG(it.plannedG)})` : `${it.name}: scaled to ${formatG(it.makeG)}, not ${formatG(it.plannedG)}`}
                  </span>
                ))}
              </span>
              {!a.seenAt && <button type="button" className="chef__ack" onClick={() => ackAlert(a.id)}>GOT IT</button>}
            </li>
          ))}
        </ul>
        <p className="pass__hint">Walk-in stock levels show here once the walk-in count is in.</p>
      </section>
      )}
      {show.close && (
      <section>
        <div className="pass__sectionhead"><h2>Last close</h2></div>
        <ul className="pass__list">
          {setUp.map(({ st, inventory, unclosed }) => (
            <li key={st.id} className="chef__close">
              <span className="pass__rowname">{st.name}</span>
              <span className="pass__rowsub">
                {inventory?.closedAt ? `Closed ${dayTime(inventory.closedAt)}${inventory.closedBy ? ` by ${inventory.closedBy}` : ""}` : "No close count yet"}
                {unclosed ? " · last shift not closed" : ""}
              </span>
              {inventory?.notes && <p className="chef__note">“{inventory.notes.text}” <span className="pass__muted">· {inventory.notes.by}</span></p>}
            </li>
          ))}
        </ul>
        {waste.length > 0 && (
          <div className="chef__waste">
            <span className="pass__countlabel">TOSSED TODAY</span>
            {waste.map((w) => (
              <span key={w.key} className="pass__rowsub">{w.name} · {formatG(w.grams)} · {w.reason} · {w.by}</span>
            ))}
          </div>
        )}
      </section>
      )}
      {show.todos && (
      <section>
        <div className="pass__sectionhead"><h2>Your to-dos</h2></div>
        {todos.length === 0 ? (
          <p className="pass__empty">Nothing waiting on you.</p>
        ) : (
          <ul className="pass__list">
            {todos.map((t) => (
              <li key={t} className="chef__todo">{t}</li>
            ))}
          </ul>
        )}
        {noRecipe.length > 0 && (
          <button type="button" className="pass__ghost chef__torecipes" onClick={onOpenRecipes}>Go to recipes</button>
        )}
      </section>
      )}
      {show.stock && (
      <section>
        <div className="pass__sectionhead"><h2>Walk-in &amp; pars</h2></div>
        <p className="pass__hint">Next to build: the chef’s walk-in count at close, and the end-of-night par report for every station.</p>
      </section>
      )}
    </>
  );
}
