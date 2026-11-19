import { useEffect, useMemo, useRef, useState } from "react";
import { loadMenuPrices, loadPrices, priceSources, saveMenuPrice, savePrices } from "../lib/storage";
import { allIngredientNames, costIndex, foodCostPct, houseRecipeNames, plateCost } from "../lib/costing";
import { groupRecipes, isDishBuild } from "../lib/recipeCategories";

// Ingredient prices in $ per kg. They feed recipe cost, waste in dollars
// and the theoretical food cost. Prices from the vendor order guides are loaded once
// (see loadPrices); after that the chef's numbers win.
export default function Prices({ recipes, recipesById, ingredients }) {
  const [prices, setPrices] = useState(() => loadPrices());
  useEffect(() => { savePrices(prices); }, [prices]);
  const [menuPrices, setMenuPrices] = useState(() => loadMenuPrices());
  function setMenuPrice(id, raw) {
    const value = raw === "" ? null : Number(raw);
    setMenuPrices((m) => ({ ...m, [id]: value }));
    saveMenuPrice(id, value);
  }
  const names = useMemo(() => allIngredientNames(recipes, recipesById, ingredients), [recipes, recipesById, ingredients]);
  const costs = useMemo(() => costIndex(recipes, recipesById, ingredients, prices), [recipes, recipesById, ingredients, prices]);
  const priced = names.filter((n) => prices[n.name.toLowerCase()] != null).length;
  // Tapping a recipe narrows the ingredient list to what that recipe still
  // needs priced. The list is fixed at the tap, so a row doesn't disappear
  // while the chef is typing its price.
  const [focus, setFocus] = useState(null); // { id, name, keys: Set, via: [house-made names] }
  const refs = useMemo(() => houseRecipeNames(recipesById), [recipesById]);
  const listRef = useRef(null);
  // Full dish builds first, then house recipes by category (proteins, sauces…).
  const groups = useMemo(() => groupRecipes(recipes), [recipes]);
  const shown = focus ? names.filter((n) => focus.keys.has(n.name.toLowerCase())) : names;
  function pick(r, c) {
    if (!c.missing.length || focus?.id === r.id) {
      setFocus(null);
      return;
    }
    // A house-made component (mole, lobster stock…) that isn't fully priced
    // is unpriced because of its own ingredients, so those are shown too.
    const keys = new Set();
    const via = [];
    const walk = (missing, chain) => {
      for (const m of missing) {
        const key = m.toLowerCase();
        const refId = refs.get(key);
        if (refId && costs.has(refId) && !chain.includes(refId)) {
          via.push(m);
          walk(costs.get(refId).missing, [...chain, refId]);
        } else keys.add(key);
      }
    };
    walk(c.missing, [r.id]);
    setFocus({ id: r.id, name: r.name, keys, via: [...new Set(via)] });
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "start" }));
  }

  return (
    <>
      <section className="chef__data">
        <div className="pass__sectionhead">
          <h2>Recipe cost</h2>
          <span className="pass__countlabel">{priced} OF {names.length} PRICED</span>
        </div>
        {groups.map((g) => (
          <div key={g.name} className="chef__group">
            <div className="chef__grouphead">
              <h3>{g.name}</h3>
              <span className="pass__countlabel">{g.recipes.length}</span>
            </div>
            <ul className="chef__table">
              {g.recipes.map((r) => {
                const c = costs.get(r.id);
                const dish = isDishBuild(r);
                // Full builds are costed per plate, with food cost % against
                // the menu price. Everything else stays $/kg.
                const plate = dish ? plateCost(r, c, recipesById, ingredients) : null;
                const menu = dish ? menuPrices[r.id] : null;
                const pct = dish ? foodCostPct(plate, menu) : null;
                // "+": some ingredients aren't priced yet, so the real number is higher.
                const partial = c.missing.length ? "+" : "";
                return (
                  <li key={r.id} className={focus?.id === r.id ? "chef__row--on" : undefined}>
                    <button type="button" className="chef__rowbtn" onClick={() => pick(r, c)} disabled={!c.missing.length} aria-pressed={focus?.id === r.id}>
                      <span>{r.name}</span>
                      {dish ? (
                        <span className="pass__mono pass__amber">
                          {plate != null ? `$${plate.toFixed(2)}${partial}/ea` : "—"}
                          {plate != null && <span className="chef__fcpct">{pct != null ? `${pct.toFixed(1)}%${partial}` : "no menu $"}</span>}
                        </span>
                      ) : (
                        <span className="pass__mono pass__amber">{c.priced ? `$${(c.perGram * 1000).toFixed(2)}/kg` : "—"}</span>
                      )}
                      <span className="pass__mono pass__muted">{c.missing.length ? `${c.missing.length} unpriced ›` : c.total ? "all priced" : "no amounts"}</span>
                    </button>
                    {dish && (
                      <label className="chef__menuprice">
                        <span>Menu price $</span>
                        <input
                          className="pass__input"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="—"
                          aria-label={`${r.name} menu price`}
                          value={menu ?? ""}
                          onChange={(e) => setMenuPrice(r.id, e.target.value)}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="pass__hint">Full dish builds show cost per plate and food cost % (plate cost ÷ menu price). A "+" means some ingredients aren't priced yet, so the real cost is higher. Tap the dish to see what's missing.</p>
      </section>
      <section className="chef__data">
        <div className="pass__sectionhead" ref={listRef}><h2>Ingredients</h2><span className="pass__countlabel">$ PER KG</span></div>
        {focus && (
          <div className="chef__filterbar">
            <span>Unpriced in <b>{focus.name}</b> ({shown.length})</span>
            <button type="button" className="pass__ghost" onClick={() => setFocus(null)}>Show all</button>
          </div>
        )}
        {focus?.via.length > 0 && (
          <p className="pass__hint">Includes what {focus.via.join(", ")} still need{focus.via.length === 1 ? "s" : ""}. Those are house-made, so they're priced from their own ingredients.</p>
        )}
        <ul className="chef__table chef__table--prices">
          {shown.map((n) => {
            const key = n.name.toLowerCase();
            return (
              <li key={key}>
                <span className="pass__rowtext">
                  <span className="pass__rowname">{n.name}</span>
                  <span className="pass__rowsub">{n.usedIn.join(", ")}</span>
                  {priceSources[key] && prices[key] != null && <span className="pass__rowsub">From {priceSources[key]}</span>}
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
