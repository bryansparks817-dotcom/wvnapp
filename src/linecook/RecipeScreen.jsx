import { formatG } from "../lib/inventory";
import { formatMinutes } from "../lib/format";

// A prep item's recipe, scaled to the grams the Prep list asks for, with a
// timer on every passive step and the done / print-label actions.
export default function RecipeScreen({ row, recipe, scaled, doneMeta, timers, onBack, onToggleDone, onStartTimer, onPrintLabel }) {
  const runningLabels = new Set(timers.map((t) => t.label));
  return (
    <div className="pass">
      <header className="pass__header">
        <div className="pass__brandrow">
          <button type="button" className="pass__back-link" onClick={onBack}>← Today</button>
        </div>
        <span className="pass__date">PREP</span>
        <h1 className="pass__title">{row.name}</h1>
        <p className="pass__lede">
          Make <strong className="pass__amber">{formatG(row.makeG)}</strong>
          {scaled && ` · ×${scaled.factor.toFixed(2)} of a batch`}
        </p>
        {row.toss.length > 0 && <span className="pass__toss">TOSS the old batch first · last day</span>}
      </header>

      <main className="pass__main">
        {!recipe && <p className="pass__empty">This item has no recipe in the app yet. Add it under Chef → Manage recipes.</p>}

        {recipe && scaled && (
          <>
            <section>
              <div className="pass__sectionhead"><h2>INGREDIENTS</h2></div>
              {scaled.basis === "ingredients" && (
                <p className="pass__hint">Scaled from the ingredient total ({formatG(scaled.batchGrams)}). Set the recipe’s finished yield for exact numbers.</p>
              )}
              <ul className="pass__ingredients">
                {scaled.lines.map((l, i) => (
                  <li key={i}>
                    <span>{l.name}</span>
                    <span className="pass__mono">{l.amount}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="pass__sectionhead"><h2>METHOD</h2></div>
              <ol className="pass__steps">
                {recipe.steps.map((step, i) => {
                  const label = `${recipe.name}: ${step.name}`;
                  const running = runningLabels.has(label);
                  return (
                    <li key={i} className={step.type === "passive" ? "is-passive" : undefined}>
                      <span className="pass__stepnum">{i + 1}</span>
                      <span className="pass__steptext">
                        <span>{step.name}</span>
                        <span className="pass__rowsub">{step.type === "passive" ? "hands-off" : "hands-on"} · {formatMinutes(step.duration_minutes)}</span>
                      </span>
                      {step.type === "passive" && (
                        <button
                          type="button"
                          className="pass__timerbtn"
                          disabled={running}
                          onClick={() => onStartTimer(label, step.duration_minutes)}
                        >
                          {running ? "RUNNING" : "TIMER"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}

        <section className="pass__recipeactions">
          <button type="button" className="pass__cta" onClick={onToggleDone}>
            {doneMeta ? `DONE · ${doneMeta.by} · UNDO` : "MARK DONE"}
          </button>
          {doneMeta && (
            <button type="button" className="pass__ghostbtn" onClick={onPrintLabel}>
              PRINT LABEL
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
