import { useMemo, useState } from "react";
import { STATIONS } from "../data/stations";
import {
  loadWaste, loadFlagLog, loadHistory, loadChefAlerts, loadCovers, loadDailyNumbers, loadPrices, loadChefSettings,
} from "../lib/storage";
import { activeFactor, cookTrends, foodCost, parTuning, prepPerCovers, recipeTimes, shortageHistory, wasteReport } from "../lib/analytics";
import { allIngredientNames, costIndex } from "../lib/costing";
import { hasSampleData, loadSampleData } from "../lib/sampleData";
import { currentServiceShift } from "../lib/crew";
import { formatMinutes } from "../lib/format";
import { formatG } from "../lib/inventory";

const money = (v) => `$${Math.round(v).toLocaleString()}`;
const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const kg = (g) => (g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : formatG(g));
const prettyDate = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
};

function Section({ title, aside, children }) {
  return (
    <section className="chef__data">
      <div className="pass__sectionhead">
        <h2>{title}</h2>
        {aside && <span className="pass__countlabel">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

const CALL_CLASS = { RAISE: "is-raise", LOWER: "is-lower", WATCH: "is-watch", OK: "" };

// The chef's Data tab: waste in dollars, par tuning, prep per cover, cook
// trends, real recipe times, shortage history, theoretical vs actual food
// cost. Everything comes from what the line already logs.
export default function Insights({ today, recipes, recipesById, ingredients, onUpdateRecipe, onOpenPrices }) {
  const [days, setDays] = useState(28);
  const [reload, setReload] = useState(0);
  const [forecastCovers, setForecastCovers] = useState(() => {
    const c = loadCovers()[`${today}:${currentServiceShift()}`];
    return c ? String(c) : "";
  });

  const data = useMemo(() => {
    void reload;
    return {
      waste: loadWaste(),
      flags: loadFlagLog(),
      history: loadHistory(),
      alerts: loadChefAlerts(),
      covers: loadCovers(),
      daily: loadDailyNumbers(),
      prices: loadPrices(),
      margin: loadChefSettings().marginMin,
    };
  }, [reload]);

  const costs = useMemo(() => costIndex(recipes, recipesById, ingredients, data.prices), [recipes, recipesById, ingredients, data.prices]);
  const items = STATIONS.flatMap((s) => s.items);
  const recipeOfItem = new Map(items.map((i) => [i.id, i.recipeId]));
  const costOfRecipe = (id) => {
    const c = costs.get(id);
    return c && c.priced > 0 ? c.perGram : null;
  };
  const costOfItem = (itemId) => (recipeOfItem.get(itemId) ? costOfRecipe(recipeOfItem.get(itemId)) : null);
  const coversOn = (date) =>
    Object.entries(data.covers).filter(([k]) => k.startsWith(`${date}:`)).reduce((s, [, v]) => s + (Number(v) || 0), 0) || null;

  const waste = wasteReport(data.waste, costOfItem, today, days);
  const pars = parTuning(items, data.flags, data.waste, today, days);
  const perCovers = prepPerCovers(data.history, coversOn, today, days);
  const cooks = cookTrends(data.history, today, data.margin);
  const times = recipeTimes(data.history, today, days, (id) => recipesById.get(id)?.timesUpdatedAt ?? 0);
  const shorts = shortageHistory(data.alerts, today, days);
  const food = foodCost(data.history, data.daily, costOfRecipe, today, days);
  const flagged = pars.filter((p) => p.call !== "OK");
  const empty = data.history.length === 0 && data.waste.length === 0 && data.flags.length === 0;
  const canSample = useMemo(() => {
    void reload;
    return !hasSampleData();
  }, [reload]);

  function applyRealTimes(row) {
    const recipe = recipesById.get(row.recipeId);
    if (!recipe) return;
    const f = activeFactor(row);
    const steps = recipe.steps.map((s) =>
      s.type === "active" ? { ...s, duration_minutes: Math.max(1, Math.round(s.duration_minutes * f)) } : s
    );
    onUpdateRecipe(recipe.id, { ...recipe, steps, timesUpdatedAt: Date.now() });
  }

  return (
    <>
      <div className="chef__servicetoggle" role="group" aria-label="Range">
        {[7, 28].map((n) => (
          <button key={n} type="button" className={days === n ? "is-on" : ""} aria-pressed={days === n} onClick={() => setDays(n)}>
            LAST {n} DAYS
          </button>
        ))}
      </div>

      {canSample && (
        <section className="pass__gate">
          <p className="pass__hint">
            {empty ? "Nothing logged yet. " : "Only a little logged so far. "}Every closed shift, toss, 86 and short alert lands here.
          </p>
          <button
            type="button"
            className="pass__ghost"
            onClick={() => {
              loadSampleData({ station: STATIONS[0], today, ingredientNames: allIngredientNames(recipes, recipesById, ingredients).map((n) => n.name) });
              setReload((n) => n + 1);
            }}
          >
            Try it with four sample weeks
          </button>
        </section>
      )}

      <Section title="Waste" aside={`${waste.entries} TOSSES`}>
        <div className="chef__tiles chef__tiles--2">
          <div className="chef__tile"><span className="pass__countlabel">DOLLARS</span><span className="chef__big">{money(waste.dollars)}</span></div>
          <div className="chef__tile"><span className="pass__countlabel">WEIGHT</span><span className="chef__big">{kg(waste.grams)}</span></div>
        </div>
        <ul className="chef__table">
          {waste.byItem.slice(0, 5).map((e) => (
            <li key={e.key}><span>{e.key}</span><span className="pass__mono">{kg(e.grams)}</span><span className="pass__mono pass__amber">{e.unpriced ? "no price" : money(e.dollars)}</span></li>
          ))}
        </ul>
        {waste.byReason.length > 0 && <p className="pass__rowsub">Why: {waste.byReason.map((e) => `${e.key} ${e.unpriced && !e.dollars ? kg(e.grams) : money(e.dollars)}`).join(" · ")}</p>}
        {waste.byCook.length > 0 && <p className="pass__rowsub">Who: {waste.byCook.map((e) => `${e.key} ${e.count}×`).join(" · ")}</p>}
        {waste.unpricedG > 0 && <p className="pass__hint">{kg(waste.unpricedG)} has no price yet (no recipe in the app, or ingredients without prices).</p>}
      </Section>

      <Section title="Par check" aside={flagged.length ? `${flagged.length} TO LOOK AT` : "ALL GOOD"}>
        <ul className="chef__table chef__table--pars">
          {flagged.map((p) => (
            <li key={p.id}>
              <span className={`chef__call ${CALL_CLASS[p.call]}`}>{p.call}</span>
              <span className="pass__rowtext">
                <span className="pass__rowname">{p.name}</span>
                <span className="pass__rowsub">{p.why} 86 {p.outs} · low {p.lows} · tossed {p.tossCount}{p.tossG ? ` (${kg(p.tossG)})` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
        {pars.length - flagged.length > 0 && <p className="pass__hint">{pars.length - flagged.length} items look right. RAISE: keeps running out. LOWER: keeps getting tossed.</p>}
      </Section>

      <Section title="Prep per 100 covers" aside={perCovers.days ? `${perCovers.days} DAYS · ${perCovers.totalCovers.toLocaleString()} COVERS` : "NEEDS COVERS"}>
        <label className="chef__forecast">
          <span className="pass__countlabel">FORECAST FOR</span>
          <input className="pass__input" type="number" inputMode="numeric" min="0" placeholder="covers" value={forecastCovers} onChange={(e) => setForecastCovers(e.target.value)} />
          <span className="pass__countlabel">COVERS</span>
        </label>
        <ul className="chef__table">
          {perCovers.rows.map((e) => (
            <li key={e.id}>
              <span>{e.name}</span>
              <span className="pass__mono">{formatG(e.per100)}</span>
              <span className="pass__mono pass__amber">{Number(forecastCovers) > 0 ? formatG((e.per100 * Number(forecastCovers)) / 100) : "—"}</span>
            </li>
          ))}
        </ul>
        <p className="pass__hint">Grams made per 100 covers, from closed shifts and the covers typed in on Home. Amber is the forecast.</p>
      </Section>

      <Section title="Cooks" aside="THIS WEEK VS LAST">
        {cooks.length === 0 && <p className="pass__empty">No closed shifts yet.</p>}
        <ul className="chef__table">
          {cooks.map(({ cook, now, before }) => {
            const better = now?.avgBehind != null && before?.avgBehind != null ? now.avgBehind < before.avgBehind : null;
            return (
              <li key={cook}>
                <span className="pass__rowname">{cook}</span>
                <span className="pass__mono">
                  {now?.onTimePct != null ? `${Math.round(now.onTimePct)}% on time` : "—"}
                  {now?.unfinished ? ` · ${now.unfinished} unfinished` : ""}
                </span>
                <span className={`pass__mono ${better === true ? "pass__vine" : better === false ? "chef__late" : ""}`}>
                  {now?.avgBehind != null ? `${Math.round(now.avgBehind)}m behind avg` : "no shifts"}
                  {now?.avgBehind != null && before?.avgBehind != null ? ` (${Math.round(before.avgBehind)}m)` : ""}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="pass__hint">From each closed shift: when the last step was ticked vs the plan. In brackets: last week.</p>
      </Section>

      <Section title="Real recipe times" aside={times.length ? `${times.length} RECIPES` : ""}>
        {times.length === 0 && <p className="pass__empty">Needs a few closed shifts with every step ticked.</p>}
        <ul className="chef__table chef__table--times">
          {times.map((t) => {
            const off = Math.abs(t.diffPct) >= 10 && t.n >= 3;
            return (
              <li key={t.recipeId}>
                <span className="pass__rowtext">
                  <span className="pass__rowname">{t.name}</span>
                  <span className="pass__rowsub">plan {formatMinutes(Math.round(t.planned))} · real {formatMinutes(Math.round(t.actual))} · {t.n} shifts</span>
                </span>
                <span className={`pass__mono ${t.diffPct > 10 ? "chef__late" : t.diffPct < -10 ? "pass__vine" : ""}`}>{t.diffPct > 0 ? "+" : ""}{Math.round(t.diffPct)}%</span>
                {off && <button type="button" className="chef__ack" onClick={() => applyRealTimes(t)}>USE REAL</button>}
              </li>
            );
          })}
        </ul>
        <p className="pass__hint">USE REAL changes the recipe’s hands-on step times to match how long it really takes. Hands-off times (simmer, chill) stay as they are.</p>
      </Section>

      <Section title="Shortages" aside={shorts.length ? `${shorts.reduce((s, e) => s + e.count, 0)} ALERTS` : ""}>
        {shorts.length === 0 && <p className="pass__empty">No ingredient shortages.</p>}
        <ul className="chef__table">
          {shorts.map((e) => (
            <li key={e.name}>
              <span>{e.name}</span>
              <span className="pass__mono">{e.count}× · {kg(e.shortG)} short</span>
              <span className="pass__mono pass__muted">last {prettyDate(e.last)}</span>
            </li>
          ))}
        </ul>
        <p className="pass__hint">Ingredients the cooks marked SHORT. Worth a bigger order or a second vendor.</p>
      </Section>

      <Section title="Food cost" aside="RECIPES VS PURCHASES">
        <div className="chef__tiles chef__tiles--2">
          <div className="chef__tile">
            <span className="pass__countlabel">SHOULD COST</span>
            <span className="chef__big">{money(food.theoretical)}</span>
            <span className="chef__delta">{pct(food.theoreticalPct)} of sales</span>
          </div>
          <div className="chef__tile">
            <span className="pass__countlabel">PURCHASES</span>
            <span className="chef__big">{money(food.actual)}</span>
            <span className="chef__delta">{pct(food.actualPct)} of sales</span>
          </div>
        </div>
        <p className="pass__hint">
          Should cost = the prep finished in The Pass × recipe cost from your ingredient prices. Until every menu item is in the app it only covers prep, so purchases will run higher.
          {food.unpricedG > 0 && ` ${kg(food.unpricedG)} of prep has no price yet.`}
        </p>
        <button type="button" className="pass__ghost chef__torecipes" onClick={onOpenPrices}>Ingredient prices ›</button>
      </Section>
    </>
  );
}
