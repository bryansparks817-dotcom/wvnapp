import { useState } from "react";
import { getStations } from "../data/stations";
import { hasDrafts } from "../lib/recipeLibrary";

// Quick recipe lookup for the chef: search or browse by station, then a
// read-only recipe with everything from its recipe sheet. Light blue marks
// what Claude drafted and Bryan hasn't confirmed yet. Editing still lives
// under Setup → Recipes.
const stationName = (id) => getStations().find((s) => s.id === id)?.name;
const SERVICEWARE = [
  ["plate", "Plate / bowl"],
  ["liner", "Liner / underliner"],
  ["vessels", "Accompanying vessels"],
  ["utensils", "Utensils / service tools"],
];

function amount(ing) {
  if (ing.subRecipeId != null) return `${ing.qty} batch`;
  if (ing.qty === 0) return (ing.asNeeded ?? "to taste").toLowerCase();
  return `${Number(ing.qty.toFixed(2)).toLocaleString()} ${ing.unit}`;
}

function RecipeView({ recipe, recipes, onOpen, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);
  const drafts = new Set(recipe.drafts ?? []);
  const d = (field) => (drafts.has(field) ? " is-draft" : "");
  const stationNames = (recipe.stations ?? []).map((id) => stationName(id) ?? id);
  const unconfirmed = hasDrafts(recipe);
  const facts = [
    ["Yield", recipe.yieldText, "yieldText"],
    ["Portion", recipe.portion, "portion"],
    ["Shelf life", recipe.shelfLife, "shelfLife"],
    ["Storage", recipe.storage, "storage"],
  ].filter(([, v]) => v);

  return (
    <div className="chef__recipe">
      <div className="pass__sectionhead">
        <h2 className={d("name").trim() || undefined}>{recipe.name}</h2>
        <button type="button" className="pass__ghost" onClick={onClose}>Close</button>
      </div>
      <div className="chef__tags">
        <span className="chef__tag">{recipe.kind === "dish" ? "DISH BUILD" : recipe.isSubRecipe ? "PREP" : "RECIPE"}</span>
        {stationNames.map((n) => (
          <span key={n} className={`chef__tag${d("station")}`}>{n}</span>
        ))}
        {stationNames.length === 0 && <span className="chef__tag">No station yet</span>}
      </div>

      {unconfirmed && (
        <div className="chef__draftnote">
          <span><span className="chef__draftswatch" /> Light blue = Claude’s draft, not confirmed yet.</span>
          {onConfirm && (confirming ? (
            <span className="chef__draftactions">
              <button type="button" className="pass__ghostbtn" onClick={() => { onConfirm(recipe.id); setConfirming(false); }}>Yes, all checked</button>
              <button type="button" className="pass__ghost" onClick={() => setConfirming(false)}>Cancel</button>
            </span>
          ) : (
            <button type="button" className="pass__ghost" onClick={() => setConfirming(true)}>Confirm all</button>
          ))}
        </div>
      )}

      {recipe.needsReview?.length > 0 && (
        <ul className="chef__review">
          {recipe.needsReview.map((t, i) => <li key={i}>Check: {t}</li>)}
        </ul>
      )}

      {facts.length > 0 && (
        <dl className="chef__facts">
          {facts.map(([label, value, field]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={d(field).trim() || undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {recipe.allergens && (
        <p className={`chef__allergens${d("allergens")}`}>
          <span className="pass__countlabel">ALLERGENS</span> {recipe.allergens.length ? recipe.allergens.join(", ") : "None marked"}
        </p>
      )}

      <span className="pass__countlabel">INGREDIENTS · {recipe.kind === "dish" ? (recipe.yieldText ?? "ONE ORDER").toUpperCase() : "ONE BATCH"}</span>
      <ul className="chef__table chef__table--ings">
        {recipe.ingredients.map((ing, i) => {
          const sub = ing.subRecipeId != null ? recipes.find((r) => r.id === ing.subRecipeId) : null;
          const house = ing.recipeRef ? recipes.find((r) => r.id === ing.recipeRef) : null;
          return (
            <li key={i} className={ing.draft ? "is-draft" : undefined}>
              <span>
                {house ? (
                  <button type="button" className="chef__reflink" onClick={() => onOpen(house.id)}>{ing.name} ›</button>
                ) : (
                  sub?.name ?? ing.name ?? "Sub-recipe"
                )}
                {ing.note && <span className="pass__rowsub">{ing.note}</span>}
              </span>
              <span className="pass__mono">{amount(ing)}</span>
            </li>
          );
        })}
      </ul>

      <span className="pass__countlabel">METHOD</span>
      {recipe.steps.length === 0 ? (
        <p className="pass__muted">No steps yet.</p>
      ) : (
        <ol className="chef__method">
          {recipe.steps.map((s, i) => (
            <li key={i} className={s.draft ? "is-draft" : undefined}>
              {s.name} <span className="pass__muted">· {s.type === "passive" ? "hands-off" : "hands-on"} {s.duration_minutes}m</span>
            </li>
          ))}
        </ol>
      )}

      {recipe.plating && (
        <>
          <span className="pass__countlabel">PLATING / HOLDING / FOOD SAFETY</span>
          <p className={`chef__plating${recipe.platingDraft ? " is-draft" : ""}`}>{recipe.plating}</p>
        </>
      )}

      {recipe.serviceware && (
        <>
          <span className="pass__countlabel">SERVICEWARE</span>
          <dl className="chef__facts">
            {SERVICEWARE.map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className={recipe.serviceware[key] ? undefined : "pass__muted"}>{recipe.serviceware[key] || "Not set yet"}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

// `catering`: the private chef side, where recipes have no stations, so it
// browses by recipes and build guides instead. `allRecipes` lets a build open
// a restaurant recipe it uses (e.g. caramelized miso aioli).
export default function RecipeLookup({ recipes, onConfirm, catering = false, allRecipes = recipes }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(null); // station id, "dish", or null
  const [openId, setOpenId] = useState(null);
  const open = allRecipes.find((r) => r.id === openId);
  const term = q.trim().toLowerCase();
  const inChip = (r, id) => (id === "dish" ? r.kind === "dish" : id === "prep" ? r.kind !== "dish" : (r.stations ?? []).includes(id));
  const inFilter = (r) => !filter || inChip(r, filter);
  const browsing = Boolean(term || filter);
  const matches = browsing
    ? recipes
        .filter((r) => inFilter(r) && (!term || r.name.toLowerCase().includes(term)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, term && !filter ? 12 : undefined)
    : [];
  const chips = catering ? [["prep", "Recipes"], ["dish", "Build guides"]] : [...getStations().map((s) => [s.id, s.name]), ["dish", "Dish builds"]];

  return (
    <section className="chef__lookup">
      <input
        className="pass__input"
        type="search"
        placeholder={`Find a recipe… (${recipes.length})`}
        aria-label="Find a recipe"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpenId(null); }}
      />
      {!open && (
        <div className="chef__chips" role="group" aria-label="Browse by station">
          {chips.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`chef__chip${filter === id ? " is-on" : ""}`}
              aria-pressed={filter === id}
              onClick={() => setFilter(filter === id ? null : id)}
            >
              {label} <span className="pass__muted">{recipes.filter((r) => inChip(r, id)).length}</span>
            </button>
          ))}
        </div>
      )}
      {!open && matches.length > 0 && (
        <ul className="chef__setup">
          {matches.map((r) => (
            <li key={r.id}>
              <button type="button" className="chef__setuprow" onClick={() => setOpenId(r.id)}>
                <span className="pass__rowname">
                  {r.name}
                  {hasDrafts(r) && <span className="chef__draftdot" title="Has unconfirmed drafts" />}
                </span>
                <span className="pass__open">OPEN ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {browsing && !open && matches.length === 0 && <p className="pass__empty">{term ? "No recipe called that." : "No recipes here yet."}</p>}
      {open && <RecipeView key={open.id} recipe={open} recipes={allRecipes} onOpen={setOpenId} onConfirm={onConfirm} onClose={() => { setOpenId(null); setQ(""); }} />}
    </section>
  );
}
