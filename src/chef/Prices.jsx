import { useEffect, useMemo, useState } from "react";
import { loadPrices, savePrices } from "../lib/storage";
import { allIngredientNames, costIndex } from "../lib/costing";

// Ingredient prices in $ per kg. They feed recipe cost, waste in dollars
// and the theoretical food cost. (Vendor CSV import comes later.)
export default function Prices({ recipes, recipesById, ingredients }) {
  const [prices, setPrices] = useState(() => loadPrices());
  useEffect(() => { savePrices(prices); }, [prices]);
  const names = useMemo(() => allIngredientNames(recipes, recipesById, ingredients), [recipes, recipesById, ingredients]);
  const costs = useMemo(() => costIndex(recipes, recipesById, ingredients, prices), [recipes, recipesById, ingredients, prices]);
  const priced = names.filter((n) => prices[n.name.toLowerCase()] != null).length;

  return (
    <>
      <section className="chef__data">
        <div className="pass__sectionhead">
          <h2>Recipe cost</h2>
          <span className="pass__countlabel">{priced} OF {names.length} PRICED</span>
        </div>
        <ul className="chef__table">
          {recipes.map((r) => {
            const c = costs.get(r.id);
            return (
              <li key={r.id}>
                <span>{r.name}</span>
                <span className="pass__mono pass__amber">{c.priced ? `$${(c.perGram * 1000).toFixed(2)}/kg` : "—"}</span>
                <span className="pass__mono pass__muted">{c.missing.length ? `${c.missing.length} unpriced` : "all priced"}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="chef__data">
        <div className="pass__sectionhead"><h2>Ingredients</h2><span className="pass__countlabel">$ PER KG</span></div>
        <ul className="chef__table chef__table--prices">
          {names.map((n) => {
            const key = n.name.toLowerCase();
            return (
              <li key={key}>
                <span className="pass__rowtext">
                  <span className="pass__rowname">{n.name}</span>
                  <span className="pass__rowsub">{n.usedIn.join(", ")}</span>
                </span>
                <input
                  className="pass__input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="$/kg"
                  aria-label={`${n.name} dollars per kg`}
                  value={prices[key] ?? ""}
                  onChange={(e) => {
                    const next = { ...prices };
                    if (e.target.value === "") delete next[key];
                    else next[key] = Number(e.target.value);
                    setPrices(next);
                  }}
                />
              </li>
            );
          })}
        </ul>
        <p className="pass__hint">Price per kilogram as bought (case price ÷ case weight). Liquids by weight too.</p>
      </section>
    </>
  );
}
