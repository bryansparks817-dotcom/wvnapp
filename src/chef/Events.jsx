import { useEffect, useMemo, useState } from "react";
import { loadEvents, loadPrices, saveEvents } from "../lib/storage";
import { costIndex } from "../lib/costing";
import { formatGrams } from "../lib/format";
import {
  PACK_GROUPS, TAGS, TEMPS, blankEvent, blankItem, castleSampleEvent, eventCost, labelsHtml, newId,
  piecesToMake, prepForEvent, printHtml, shoppingForEvent,
} from "../lib/events";

// Private chef & catering: one screen per event (a BEO). Menu by pieces with
// food cost per piece, the event's total food cost (the shopping budget),
// shopping list, prep list, pack list and transport labels.

const money = (n) => (n == null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const piece$ = (n) => (n == null ? "—" : n > 0 && n < 0.001 ? "<0.1¢" : n < 1 ? `${(n * 100).toFixed(1)}¢` : `$${n.toFixed(2)}`);
const time12 = (hhmm) => {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm ?? "")) return hhmm ?? "";
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const dateText = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Date not set");

function Field({ label, draft, children, wide }) {
  return (
    <label className={`chef__stafffield${draft ? " chef__draftfield" : ""}${wide ? " ev__wide" : ""}`}>
      <span className="pass__countlabel">{label}{draft ? " · DRAFT" : ""}</span>
      {children}
    </label>
  );
}

export default function Events({ recipes, recipesById, ingredients }) {
  const [events, setEvents] = useState(() => loadEvents());
  useEffect(() => { saveEvents(events); }, [events]);
  const [openId, setOpenId] = useState(null);
  const prices = useMemo(() => loadPrices(), []);
  const costs = useMemo(() => costIndex(recipes, recipesById, ingredients, prices), [recipes, recipesById, ingredients, prices]);
  const ctx = { recipes, recipesById, ingredients, prices, costs };

  const open = events.find((e) => e.id === openId);
  const update = (id, fn) => setEvents((list) => list.map((e) => (e.id === id ? fn(e) : e)));

  if (open) {
    return (
      <EventView
        event={open}
        ctx={ctx}
        onChange={(fn) => update(open.id, fn)}
        onBack={() => setOpenId(null)}
        onDelete={() => { setEvents((list) => list.filter((e) => e.id !== open.id)); setOpenId(null); }}
      />
    );
  }

  const hasCastle = events.some((e) => e.venue === "The Castle" && e.name === "Holiday mix & mingle");
  const add = (ev) => { setEvents((list) => [ev, ...list]); setOpenId(ev.id); };
  return (
    <section className="chef__data">
      <div className="pass__sectionhead">
        <h2>Events</h2>
        <span className="pass__countlabel">{events.length} ON THE BOOKS</span>
      </div>
      {events.length === 0 && <p className="pass__empty">No events yet. Start one from your BEO: who, where, when, guest count and the menu by pieces.</p>}
      <ul className="ev__list">
        {events.map((e) => {
          const c = eventCost(e, costs, prices, recipesById);
          return (
            <li key={e.id}>
              <button type="button" className="chef__setuprow" onClick={() => setOpenId(e.id)}>
                <span className="pass__rowtext">
                  <span className="pass__rowname">{e.name}</span>
                  <span className="pass__rowsub">{[e.venue, dateText(e.date), `${e.guests || 0} guests`].filter(Boolean).join(" · ")}</span>
                  <span className="pass__rowsub">{e.items.length} items · {c.pieces.toLocaleString()} pieces · food budget <span className="pass__amber">{money(c.total)}{c.unlinked || c.partial ? "+" : ""}</span></span>
                </span>
                <span className="pass__open">OPEN ›</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="pass__cta" onClick={() => add(blankEvent())}>+ NEW EVENT</button>
      {!hasCastle && (
        <button type="button" className="pass__ghost" onClick={() => add(castleSampleEvent())}>Load the test event: holiday party at the Castle, 60 guests</button>
      )}
    </section>
  );
}

const VIEWS = [
  ["menu", "MENU"],
  ["shop", "SHOP"],
  ["prep", "PREP"],
  ["pack", "PACK"],
  ["details", "DETAILS"],
];

function EventView({ event, ctx, onChange, onBack, onDelete }) {
  const [view, setView] = useState("menu");
  const { costs, prices, recipesById } = ctx;
  const cost = useMemo(() => eventCost(event, costs, prices, recipesById), [event, costs, prices, recipesById]);
  const set = (k, v) => onChange((e) => ({ ...e, [k]: v }));
  const plus = cost.unlinked || cost.partial ? "+" : "";

  return (
    <>
      <button type="button" className="pass__ghost chef__backlink" onClick={onBack}>← All events</button>
      <section className="ev__head">
        <input className="pass__input pass__input--name" aria-label="Event name" value={event.name} onChange={(e) => set("name", e.target.value)} />
        <p className="pass__rowsub">{[event.venue || "Venue not set", dateText(event.date), `${event.guests || 0} guests`].join(" · ")}</p>
        <div className="ev__budget">
          <div>
            <span className="pass__countlabel">FOOD BUDGET</span>
            <span className="ev__big pass__amber">{money(cost.total)}{plus}</span>
          </div>
          <div>
            <span className="pass__countlabel">PER GUEST</span>
            <span className="ev__mid">{cost.perGuest != null ? money(cost.perGuest) : "—"}{cost.perGuest != null ? plus : ""}</span>
          </div>
          <div>
            <span className="pass__countlabel">PIECES SOLD</span>
            <span className="ev__mid">{cost.pieces.toLocaleString()}</span>
          </div>
        </div>
        {(cost.unlinked > 0 || cost.partial) && (
          <p className="pass__hint">
            “+” means the real number is higher: {cost.unlinked > 0 ? `${cost.unlinked} item${cost.unlinked === 1 ? " has" : "s have"} no recipe or ingredients yet` : ""}
            {cost.unlinked > 0 && cost.partial ? ", and " : ""}{cost.partial ? "some ingredients aren’t priced" : ""}. Budget includes {event.extraPct || 0}% extra pieces.
          </p>
        )}
      </section>
      <div className="ev__views" role="tablist" aria-label="Event">
        {VIEWS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? "is-on" : undefined} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>
      {view === "menu" && <MenuView event={event} cost={cost} ctx={ctx} onChange={onChange} />}
      {view === "shop" && <ShopView event={event} ctx={ctx} />}
      {view === "prep" && <PrepView event={event} ctx={ctx} />}
      {view === "pack" && <PackView event={event} onChange={onChange} />}
      {view === "details" && <DetailsView event={event} onChange={onChange} onDelete={onDelete} />}
    </>
  );
}

// ---- Menu ---------------------------------------------------------------

function MenuView({ event, cost, ctx, onChange }) {
  const [editing, setEditing] = useState(null);
  const rowFor = new Map(cost.rows.map((r) => [r.item.id, r]));
  const setItems = (fn) => onChange((e) => ({ ...e, items: fn(e.items) }));
  const addItem = (serviceId) => {
    const it = blankItem(serviceId);
    setItems((items) => [...items, it]);
    setEditing(it.id);
  };
  return (
    <section className="chef__data">
      {event.services.map((s) => {
        const items = event.items.filter((it) => it.service === s.id);
        const total = items.reduce((sum, it) => sum + (rowFor.get(it.id)?.total ?? 0), 0);
        const pcs = items.reduce((sum, it) => sum + (Number(it.pieces) || 0), 0);
        return (
          <div key={s.id} className="chef__group">
            <div className="chef__grouphead">
              <h3>{s.name}{s.where ? <span className="pass__muted"> · {s.where}</span> : null}</h3>
              <span className="pass__countlabel">{pcs} PC · {money(total)}</span>
            </div>
            <ul className="ev__items">
              {items.map((it) => {
                const r = rowFor.get(it.id);
                if (editing === it.id) {
                  return (
                    <li key={it.id}>
                      <ItemForm item={it} event={event} ctx={ctx} row={r}
                        onSave={(next) => { setItems((list) => list.map((x) => (x.id === it.id ? next : x))); setEditing(null); }}
                        onCancel={() => { if (!it.name) setItems((list) => list.filter((x) => x.id !== it.id)); setEditing(null); }}
                        onRemove={() => { setItems((list) => list.filter((x) => x.id !== it.id)); setEditing(null); }} />
                    </li>
                  );
                }
                const draft = it.components.some((c) => c.draft);
                return (
                  <li key={it.id}>
                    <button type="button" className="ev__item" onClick={() => setEditing(it.id)}>
                      <span className="pass__rowtext">
                        <span className="pass__rowname">{it.name || "Untitled item"}{draft && <span className="chef__draftdot" title="Has Claude drafts" />}</span>
                        <span className="pass__rowsub">
                          {it.pieces} pc{r.make !== Number(it.pieces) ? ` (make ${r.make})` : ""}
                          {it.tags.length ? ` · ${it.tags.join(" ")}` : ""}
                          {" · "}{TEMPS.find((t) => t.id === it.temp)?.label.toLowerCase()}
                        </span>
                        {!r.linked && <span className="pass__rowsub pass__amber">No recipe yet: tap to build it</span>}
                        {r.linked && r.missing.length > 0 && <span className="pass__rowsub pass__amber">Not priced: {r.missing.join(", ")}</span>}
                      </span>
                      <span className="ev__cost">
                        <span className="pass__mono pass__amber">{piece$(r.cost)}{r.linked && r.partial ? "+" : ""}<span className="pass__muted">/pc</span></span>
                        <span className="pass__mono pass__muted">{money(r.total)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="pass__ghost ev__add" onClick={() => addItem(s.id)}>+ Add to {s.name.toLowerCase()}</button>
          </div>
        );
      })}
      <button type="button" className="pass__ghost" onClick={() => printHtml(labelsHtml(event))} disabled={!event.items.length}>Print transport labels (one per item)</button>
      <p className="pass__hint">Cost per piece comes from your recipe and ingredient prices, in grams per piece. The food budget is cost per piece × pieces to make (pieces sold + {event.extraPct || 0}% extra). <span className="chef__draftswatch" /> Light blue = Claude’s draft, not confirmed.</p>
    </section>
  );
}

function ItemForm({ item, event, ctx, row, onSave, onCancel, onRemove }) {
  const [f, setF] = useState(() => ({ ...item, pieces: String(item.pieces || ""), components: item.components.map((c) => ({ ...c, grams: String(c.grams ?? "") })) }));
  const [askRemove, setAskRemove] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setComp = (i, patch) => setF((x) => ({ ...x, components: x.components.map((c, j) => (j === i ? { ...c, ...patch, draft: false } : c)) }));
  const recipes = useMemo(() => [...ctx.recipes].sort((a, b) => a.name.localeCompare(b.name)), [ctx.recipes]);
  const priceNames = useMemo(() => Object.keys(ctx.prices).sort(), [ctx.prices]);
  const toggleTag = (t) => set("tags", f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t]);
  const save = () => onSave({
    ...f,
    name: f.name.trim(),
    pieces: Number(f.pieces) || 0,
    components: f.components.filter((c) => c.ref).map((c) => ({ ...c, grams: Number(c.grams) || 0 })),
  });
  // Live cost of one piece while editing.
  const preview = f.components.reduce((acc, c) => {
    const g = Number(c.grams) || 0;
    if (!c.ref) return acc;
    if (c.kind === "recipe") {
      const co = ctx.costs.get(c.ref);
      return co?.priced ? acc + co.perGram * g : acc;
    }
    const perKg = ctx.prices[c.ref.toLowerCase()];
    return perKg != null ? acc + (perKg / 1000) * g : acc;
  }, 0);

  return (
    <div className="chef__staffform ev__form">
      <Field label="ITEM"><input className="pass__input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Mini crabcake" autoFocus={!item.name} /></Field>
      <div className="ev__two">
        <Field label="PIECES SOLD"><input className="pass__input" type="number" inputMode="numeric" min="0" value={f.pieces} onChange={(e) => set("pieces", e.target.value)} /></Field>
        <Field label="SERVED">
          <select className="pass__input" value={f.service} onChange={(e) => set("service", e.target.value)}>
            {event.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <span className="pass__countlabel">HOLD</span>
      <div className="chef__servicetoggle ev__three" role="group" aria-label="Hold">
        {TEMPS.map((t) => <button key={t.id} type="button" className={f.temp === t.id ? "is-on" : undefined} onClick={() => set("temp", t.id)}>{t.label.replace("KEEP ", "")}</button>)}
      </div>
      <span className="pass__countlabel">ALLERGEN & DIET TAGS</span>
      <div className="ev__tags">
        {TAGS.map((t) => <button key={t} type="button" className={f.tags.includes(t) ? "is-on" : undefined} aria-pressed={f.tags.includes(t)} onClick={() => toggleTag(t)}>{t}</button>)}
      </div>

      <span className="pass__countlabel">WHAT’S IN ONE PIECE (GRAMS)</span>
      {f.components.length === 0 && <p className="pass__hint">Add the house recipes and raw ingredients in one piece, in grams. That’s what gives the cost per piece and the shopping list.</p>}
      <ul className="ev__comps">
        {f.components.map((c, i) => (
          <li key={i} className={c.draft ? "chef__draftfield" : undefined}>
            <select className="pass__input ev__kind" aria-label="Recipe or ingredient" value={c.kind} onChange={(e) => setComp(i, { kind: e.target.value, ref: "" })}>
              <option value="recipe">Recipe</option>
              <option value="ingredient">Ingredient</option>
            </select>
            {c.kind === "recipe" ? (
              <select className="pass__input" aria-label="Recipe" value={c.ref} onChange={(e) => setComp(i, { ref: e.target.value })}>
                <option value="">Pick a recipe…</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            ) : (
              <input className="pass__input" aria-label="Ingredient" list="ev-ingredients" placeholder="Ingredient" value={c.ref} onChange={(e) => setComp(i, { ref: e.target.value })} />
            )}
            <input className="pass__input ev__grams" aria-label="Grams per piece" type="number" inputMode="decimal" min="0" step="0.1" placeholder="g" value={c.grams} onChange={(e) => setComp(i, { grams: e.target.value })} />
            <button type="button" className="ev__x" aria-label="Remove" onClick={() => setF((x) => ({ ...x, components: x.components.filter((_, j) => j !== i) }))}>×</button>
            {c.draft && <span className="pass__countlabel ev__draftlabel">CLAUDE’S DRAFT · EDIT TO CONFIRM</span>}
          </li>
        ))}
      </ul>
      <datalist id="ev-ingredients">{priceNames.map((n) => <option key={n} value={n} />)}</datalist>
      <div className="ev__compadd">
        <button type="button" className="pass__ghost" onClick={() => setF((x) => ({ ...x, components: [...x.components, { kind: "recipe", ref: "", grams: "" }] }))}>+ Recipe</button>
        <button type="button" className="pass__ghost" onClick={() => setF((x) => ({ ...x, components: [...x.components, { kind: "ingredient", ref: "", grams: "" }] }))}>+ Ingredient</button>
        <span className="pass__mono pass__amber">{f.components.some((c) => c.ref) ? `${piece$(preview)} / piece` : ""}</span>
      </div>
      {row?.missing?.length > 0 && <p className="pass__hint">No price yet for {row.missing.join(", ")}. Add it under Setup → Ingredient prices.</p>}
      <Field label="NOTES"><input className="pass__input" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. GF option on a cracker" /></Field>
      <div className="ev__actions">
        <button type="button" className="pass__cta" onClick={save} disabled={!f.name.trim()}>SAVE ITEM</button>
        <button type="button" className="pass__ghost" onClick={onCancel}>Cancel</button>
        {item.name && (askRemove
          ? <button type="button" className="pass__ghost pass__amber" onClick={onRemove}>Yes, remove it</button>
          : <button type="button" className="pass__ghost" onClick={() => setAskRemove(true)}>Remove item</button>)}
      </div>
    </div>
  );
}

// ---- Shop ---------------------------------------------------------------

function ShopView({ event, ctx }) {
  const list = useMemo(() => shoppingForEvent(event, ctx.recipesById, ctx.ingredients, ctx.prices), [event, ctx]);
  const total = list.reduce((s, r) => s + (r.cost ?? 0), 0);
  const unpriced = list.filter((r) => r.cost == null).length;
  const unlinked = event.items.filter((it) => !it.components.length);
  return (
    <section className="chef__data">
      <div className="pass__sectionhead"><h2>Shopping list</h2><span className="pass__countlabel">{money(total)}{unpriced ? "+" : ""}</span></div>
      {list.length === 0 && <p className="pass__empty">Nothing to buy yet. Add recipes or ingredients to the menu items and the list builds itself.</p>}
      <ul className="chef__table ev__shop">
        {list.map((r) => (
          <li key={r.name}>
            <span className="pass__rowtext">
              <span className="pass__rowname">{r.name}</span>
              <span className="pass__rowsub">{r.usedIn.join(", ")}</span>
            </span>
            <span className="pass__mono">{r.grams > 0 ? formatGrams(r.grams) : r.other.map((o) => `${o.qty} ${o.unit}`).join(" + ")}</span>
            <span className="pass__mono pass__amber">{r.cost != null ? money(r.cost) : "no $"}</span>
          </li>
        ))}
      </ul>
      {unlinked.length > 0 && (
        <p className="pass__hint">Not on this list yet, because they have no recipe in The Pass: {unlinked.map((it) => it.name).join(", ")}.</p>
      )}
      <p className="pass__hint">Amounts are for the pieces to make, with {event.extraPct || 0}% extra. House recipes are broken down to what you buy.</p>
    </section>
  );
}

// ---- Prep ---------------------------------------------------------------

function PrepView({ event, ctx }) {
  const prep = useMemo(() => prepForEvent(event, ctx.recipesById), [event, ctx.recipesById]);
  const unlinked = event.items.filter((it) => !it.components.some((c) => c.kind === "recipe"));
  return (
    <section className="chef__data">
      <div className="pass__sectionhead"><h2>Make at the commissary</h2><span className="pass__countlabel">{prep.length} RECIPES</span></div>
      {prep.length === 0 && <p className="pass__empty">No house recipes on this menu yet.</p>}
      <ul className="chef__table ev__prep">
        {prep.map((p) => (
          <li key={p.recipe.id}>
            <span className="pass__rowtext">
              <span className="pass__rowname">{p.recipe.name}</span>
              <span className="pass__rowsub">For {p.usedIn.join(", ")}</span>
            </span>
            <span className="pass__mono pass__amber">{formatGrams(p.grams)}</span>
          </li>
        ))}
      </ul>
      {unlinked.length > 0 && (
        <>
          <div className="pass__sectionhead"><h2>Still need a recipe</h2><span className="pass__countlabel">{unlinked.length}</span></div>
          <ul className="chef__table ev__prep">
            {unlinked.map((it) => (
              <li key={it.id}><span className="pass__rowname">{it.name}</span><span className="pass__mono">{piecesToMake(it, event)} pc</span></li>
            ))}
          </ul>
        </>
      )}
      <p className="pass__hint">Grams to make = grams per piece × pieces to make. Assembly, timing and holding come next.</p>
    </section>
  );
}

// ---- Pack ---------------------------------------------------------------

function PackView({ event, onChange }) {
  const [adding, setAdding] = useState({});
  const setPack = (fn) => onChange((e) => ({ ...e, pack: fn(e.pack) }));
  const svc = new Map(event.services.map((s) => [s.id, s.name]));
  const done = event.pack.filter((p) => p.done).length + event.items.filter((it) => (event.foodPacked ?? []).includes(it.id)).length;
  const all = event.pack.length + event.items.length;
  const toggleFood = (id) => onChange((e) => {
    const list = e.foodPacked ?? [];
    return { ...e, foodPacked: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
  });
  return (
    <section className="chef__data">
      <div className="pass__sectionhead"><h2>Pack list</h2><span className="pass__countlabel">{done} OF {all} PACKED</span></div>
      <div className="chef__group">
        <div className="chef__grouphead"><h3>Food</h3><span className="pass__countlabel">{event.items.length}</span></div>
        <ul className="ev__checks">
          {event.items.map((it) => (
            <li key={it.id}>
              <label>
                <input type="checkbox" checked={(event.foodPacked ?? []).includes(it.id)} onChange={() => toggleFood(it.id)} />
                <span>{it.name} <span className="pass__muted">· {piecesToMake(it, event)} pc · {svc.get(it.service)} · {TEMPS.find((t) => t.id === it.temp)?.label.toLowerCase()}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      {PACK_GROUPS.map((g) => (
        <div key={g} className="chef__group">
          <div className="chef__grouphead"><h3>{g}</h3><span className="pass__countlabel">{event.pack.filter((p) => p.group === g).length}</span></div>
          <ul className="ev__checks">
            {event.pack.filter((p) => p.group === g).map((p) => (
              <li key={p.id}>
                <label>
                  <input type="checkbox" checked={p.done} onChange={() => setPack((list) => list.map((x) => (x.id === p.id ? { ...x, done: !x.done } : x)))} />
                  <span>{p.name}</span>
                </label>
                <button type="button" className="ev__x" aria-label={`Remove ${p.name}`} onClick={() => setPack((list) => list.filter((x) => x.id !== p.id))}>×</button>
              </li>
            ))}
          </ul>
          <form className="ev__addrow" onSubmit={(e) => {
            e.preventDefault();
            const name = (adding[g] ?? "").trim();
            if (!name) return;
            setPack((list) => [...list, { id: newId("pk"), group: g, name, done: false }]);
            setAdding((a) => ({ ...a, [g]: "" }));
          }}>
            <input className="pass__input" placeholder="Add to this list" value={adding[g] ?? ""} onChange={(e) => setAdding((a) => ({ ...a, [g]: e.target.value }))} />
            <button type="submit" className="pass__ghost">Add</button>
          </form>
        </div>
      ))}
      <button type="button" className="pass__ghost" onClick={() => onChange((e) => ({ ...e, foodPacked: [], pack: e.pack.map((p) => ({ ...p, done: false })) }))}>Uncheck everything</button>
    </section>
  );
}

// ---- Details ------------------------------------------------------------

function DetailsView({ event, onChange, onDelete }) {
  const [askDelete, setAskDelete] = useState(false);
  const set = (k, v) => onChange((e) => ({ ...e, [k]: v }));
  const setRow = (key, id, patch) => onChange((e) => ({ ...e, [key]: e[key].map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const timeline = [...event.timeline].sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  return (
    <section className="chef__data chef__staffform">
      <div className="pass__sectionhead"><h2>Event</h2></div>
      <Field label="CLIENT"><input className="pass__input" value={event.client} onChange={(e) => set("client", e.target.value)} /></Field>
      <Field label="CONTACT (NAME, PHONE)"><input className="pass__input" value={event.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
      <div className="ev__two">
        <Field label="DATE"><input className="pass__input" type="date" value={event.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="GUESTS"><input className="pass__input" type="number" inputMode="numeric" min="0" value={event.guests || ""} onChange={(e) => set("guests", Number(e.target.value) || 0)} /></Field>
      </div>
      <div className="ev__two">
        <Field label="VENUE"><input className="pass__input" value={event.venue} onChange={(e) => set("venue", e.target.value)} /></Field>
        <Field label="EXTRA PIECES %"><input className="pass__input" type="number" inputMode="numeric" min="0" value={event.extraPct ?? 0} onChange={(e) => set("extraPct", Number(e.target.value) || 0)} /></Field>
      </div>
      <Field label="GUEST ALLERGIES"><textarea className="pass__input" rows={2} value={event.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. 2 shellfish, 1 celiac at table 4" /></Field>
      <Field label="SETUP & NOTES"><textarea className="pass__input" rows={4} value={event.notes} onChange={(e) => set("notes", e.target.value)} /></Field>

      <div className="pass__sectionhead"><h2>Timeline</h2></div>
      <ul className="ev__rows">
        {timeline.map((t) => (
          <li key={t.id}>
            <input className="pass__input ev__time" type="time" aria-label="Time" value={t.time} onChange={(e) => setRow("timeline", t.id, { time: e.target.value })} />
            <input className="pass__input" aria-label="What happens" value={t.what} onChange={(e) => setRow("timeline", t.id, { what: e.target.value })} />
            <button type="button" className="ev__x" aria-label="Remove" onClick={() => set("timeline", event.timeline.filter((x) => x.id !== t.id))}>×</button>
          </li>
        ))}
      </ul>
      <button type="button" className="pass__ghost ev__add" onClick={() => set("timeline", [...event.timeline, { id: newId("tl"), time: "", what: "" }])}>+ Add a time (load out, set up, first pass…)</button>
      {timeline.some((t) => t.time) && <p className="pass__hint">Reads: {timeline.filter((t) => t.time).map((t) => `${time12(t.time)} ${t.what}`).join(" · ")}</p>}

      <div className="pass__sectionhead"><h2>Where food is served</h2></div>
      <ul className="ev__rows">
        {event.services.map((s) => (
          <li key={s.id}>
            <input className="pass__input" aria-label="Service" value={s.name} onChange={(e) => setRow("services", s.id, { name: e.target.value })} />
            <input className="pass__input" aria-label="Where" placeholder="Where" value={s.where} onChange={(e) => setRow("services", s.id, { where: e.target.value })} />
            <button type="button" className="ev__x" aria-label="Remove" disabled={event.items.some((it) => it.service === s.id)} title="Move its items first" onClick={() => set("services", event.services.filter((x) => x.id !== s.id))}>×</button>
          </li>
        ))}
      </ul>
      <button type="button" className="pass__ghost ev__add" onClick={() => set("services", [...event.services, { id: newId("sv"), name: "New station", where: "" }])}>+ Add a station or service</button>

      <div className="ev__danger">
        {askDelete
          ? <><span>Delete this event for every phone?</span><button type="button" className="pass__ghost pass__amber" onClick={onDelete}>Yes, delete</button><button type="button" className="pass__ghost" onClick={() => setAskDelete(false)}>Keep it</button></>
          : <button type="button" className="pass__ghost" onClick={() => setAskDelete(true)}>Delete event</button>}
      </div>
    </section>
  );
}
