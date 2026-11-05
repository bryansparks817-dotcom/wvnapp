import { useState } from "react";

// Quick recipe lookup for the chef: search, then a read-only recipe.
// Editing still lives under Setup → Recipes.
export default function RecipeLookup({ recipes }) {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);
  const open = recipes.find((r) => r.id === openId);
  const term = q.trim().toLowerCase();
  const matches = term ? recipes.filter((r) => r.name.toLowerCase().includes(term)).slice(0, 6) : [];

  return (
    <section className="chef__lookup">
      <input
        className="pass__input"
        type="search"
        placeholder="Find a recipe…"
        aria-label="Find a recipe"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpenId(null); }}
      />
      {!open && matches.length > 0 && (
        <ul className="chef__setup">
          {matches.map((r) => (
            <li key={r.id}>
              <button type="button" className="chef__setuprow" onClick={() => setOpenId(r.id)}>
                <span className="pass__rowname">{r.name}</span>
                <span className="pass__open">OPEN ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {term && matches.length === 0 && <p className="pass__empty">No recipe called that.</p>}
      {open && (
        <div className="chef__recipe">
          <div className="pass__sectionhead">
            <h2>{open.name}</h2>
            <button type="button" className="pass__ghost" onClick={() => { setOpenId(null); setQ(""); }}>Close</button>
          </div>
          <span className="pass__countlabel">INGREDIENTS · ONE BATCH</span>
          <ul className="chef__table">
            {open.ingredients.map((ing, i) => (
              <li key={i}>
                <span>{ing.subRecipeId != null ? recipes.find((r) => r.id === ing.subRecipeId)?.name ?? "Sub-recipe" : ing.name}</span>
                <span className="pass__mono">{ing.qty} {ing.subRecipeId != null ? "batch" : ing.unit}</span>
                <span />
              </li>
            ))}
          </ul>
          <span className="pass__countlabel">METHOD</span>
          <ol className="chef__method">
            {open.steps.map((s, i) => (
              <li key={i}>{s.name} <span className="pass__muted">· {s.type === "passive" ? "hands-off" : "hands-on"} {s.duration_minutes}m</span></li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
