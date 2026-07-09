import { useState } from "react";
import { UNITS, unitNeedsIngredientData } from "../lib/unitConversion";
import { flattenIngredients } from "../lib/recipeComposition";

let rowIdCounter = 0;
function nextRowId() {
  rowIdCounter += 1;
  return rowIdCounter;
}

function emptyIngredientRow() {
  return { rowId: nextRowId(), kind: "ingredient", qty: "1", unit: "ea", name: "", conversionValue: "", subRecipeId: "", batches: "1" };
}

function emptyStepRow() {
  return { rowId: nextRowId(), name: "", type: "active", duration: "5" };
}

function conversionFieldFor(unit) {
  return unit === "ea" ? "gramsPerEach" : "gramsPerCup";
}

function conversionLabelFor(unit) {
  return unit === "ea" ? "Average weight (g) per each" : "Grams per cup";
}

export default function RecipeForm({
  initialRecipe,
  recipes,
  recipesById,
  ingredients,
  findIngredient,
  upsertIngredient,
  onSave,
  onCancel,
}) {
  const isEditing = Boolean(initialRecipe);

  const [name, setName] = useState(initialRecipe?.name ?? "");
  const [isSubRecipe, setIsSubRecipe] = useState(initialRecipe?.isSubRecipe ?? false);
  const [ingredientRows, setIngredientRows] = useState(() =>
    initialRecipe
      ? initialRecipe.ingredients.map((ing) =>
          ing.subRecipeId != null
            ? {
                rowId: nextRowId(),
                kind: "subRecipe",
                qty: "1",
                unit: "ea",
                name: "",
                conversionValue: "",
                subRecipeId: ing.subRecipeId,
                batches: String(ing.qty),
              }
            : {
                rowId: nextRowId(),
                kind: "ingredient",
                qty: String(ing.qty),
                unit: ing.unit,
                name: ing.name,
                conversionValue: "",
                subRecipeId: "",
                batches: "1",
              }
        )
      : [emptyIngredientRow()]
  );
  const [stepRows, setStepRows] = useState(() =>
    initialRecipe
      ? initialRecipe.steps.map((step) => ({
          rowId: nextRowId(),
          name: step.name,
          type: step.type,
          duration: String(step.duration_minutes),
        }))
      : [emptyStepRow()]
  );
  const [error, setError] = useState(null);

  const subRecipeOptions = recipes.filter((r) => r.isSubRecipe && r.id !== initialRecipe?.id);

  function updateIngredientRow(rowId, field, value) {
    setIngredientRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  function addIngredientRow() {
    setIngredientRows((prev) => [...prev, emptyIngredientRow()]);
  }

  function removeIngredientRow(rowId) {
    setIngredientRows((prev) => prev.filter((row) => row.rowId !== rowId));
  }

  function updateStepRow(rowId, field, value) {
    setStepRows((prev) => prev.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  function addStepRow() {
    setStepRows((prev) => [...prev, emptyStepRow()]);
  }

  function removeStepRow(rowId) {
    setStepRows((prev) => prev.filter((row) => row.rowId !== rowId));
  }

  function moveStepRow(rowId, direction) {
    setStepRows((prev) => {
      const index = prev.findIndex((row) => row.rowId === rowId);
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Recipe name is required.");
      return;
    }
    if (ingredientRows.length === 0) {
      setError("Add at least one ingredient.");
      return;
    }
    if (stepRows.length === 0) {
      setError("Add at least one step.");
      return;
    }

    const recipeIngredients = [];
    for (const row of ingredientRows) {
      if (row.kind === "subRecipe") {
        const batches = Number(row.batches);
        if (!row.subRecipeId) {
          setError("Choose a sub-recipe for every sub-recipe row.");
          return;
        }
        if (!Number.isFinite(batches) || batches <= 0) {
          setError("Sub-recipe batches must be a positive number.");
          return;
        }
        recipeIngredients.push({ subRecipeId: row.subRecipeId, qty: batches });
        continue;
      }

      const ingName = row.name.trim();
      const qty = Number(row.qty);
      if (!ingName || !Number.isFinite(qty) || qty <= 0) {
        setError("Every ingredient needs a name and a positive quantity.");
        return;
      }
      const needsData = unitNeedsIngredientData(row.unit);
      const existing = findIngredient(ingName);
      if (needsData && !existing) {
        const conversionValue = Number(row.conversionValue);
        if (!Number.isFinite(conversionValue) || conversionValue <= 0) {
          setError(`"${ingName}" is a new ingredient — enter its conversion value.`);
          return;
        }
        upsertIngredient(ingName, { [conversionFieldFor(row.unit)]: conversionValue });
      }
      recipeIngredients.push({ name: ingName, qty, unit: row.unit });
    }

    const steps = [];
    for (const row of stepRows) {
      const stepName = row.name.trim();
      const duration = Number(row.duration);
      if (!stepName || !Number.isFinite(duration) || duration <= 0) {
        setError("Every step needs a name and a positive duration.");
        return;
      }
      steps.push({ name: stepName, type: row.type, duration_minutes: duration });
    }

    const candidateId = initialRecipe?.id ?? "__new-recipe__";
    const candidateRecipe = { id: candidateId, name: trimmedName, ingredients: recipeIngredients, steps, isSubRecipe };
    const tempRecipesById = new Map(recipesById);
    tempRecipesById.set(candidateId, candidateRecipe);
    try {
      flattenIngredients(candidateRecipe, tempRecipesById);
    } catch {
      setError("This creates a circular sub-recipe reference — a recipe can't depend on itself, even indirectly.");
      return;
    }

    setError(null);
    onSave(candidateRecipe);
  }

  return (
    <form className="recipe-form" onSubmit={handleSubmit}>
      <div className="recipe-manager__header">
        <h2>{isEditing ? "Edit recipe" : "Add recipe"}</h2>
        <button type="button" className="link-button" onClick={onCancel}>
          ← Cancel
        </button>
      </div>

      {error && <div className="recipe-form__error">{error}</div>}

      <label className="recipe-form__field">
        <span className="recipe-form__label">Recipe name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Braised short ribs"
        />
      </label>

      <label className="recipe-form__checkbox-field">
        <input type="checkbox" checked={isSubRecipe} onChange={(e) => setIsSubRecipe(e.target.checked)} />
        <span>This is a sub-recipe (a component other recipes can use as an ingredient)</span>
      </label>

      <div className="recipe-form__group">
        <span className="recipe-form__label">Ingredients</span>
        {ingredientRows.map((row) => {
          const trimmedIngName = row.name.trim();
          const existing = trimmedIngName ? findIngredient(trimmedIngName) : null;
          const isNew = trimmedIngName && !existing;
          const needsConversion = isNew && unitNeedsIngredientData(row.unit);
          const isSubRecipeRow = row.kind === "subRecipe";

          return (
            <div key={row.rowId} className="recipe-form__row">
              <span className="recipe-form__toggle recipe-form__toggle--kind">
                <button
                  type="button"
                  className={`recipe-form__toggle-option ${!isSubRecipeRow ? "recipe-form__toggle-option--active" : ""}`}
                  onClick={() => updateIngredientRow(row.rowId, "kind", "ingredient")}
                >
                  Ingredient
                </button>
                <button
                  type="button"
                  className={`recipe-form__toggle-option ${isSubRecipeRow ? "recipe-form__toggle-option--active" : ""}`}
                  onClick={() => updateIngredientRow(row.rowId, "kind", "subRecipe")}
                >
                  Sub-recipe
                </button>
              </span>

              {isSubRecipeRow ? (
                <>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="recipe-form__qty-input"
                    value={row.batches}
                    onChange={(e) => updateIngredientRow(row.rowId, "batches", e.target.value)}
                    aria-label="Batches"
                  />
                  <span className="recipe-form__hint">batch(es) of</span>
                  <select
                    className="recipe-form__name-input"
                    value={row.subRecipeId}
                    onChange={(e) => updateIngredientRow(row.rowId, "subRecipeId", e.target.value)}
                    aria-label="Sub-recipe"
                  >
                    <option value="">Choose a sub-recipe…</option>
                    {subRecipeOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {subRecipeOptions.length === 0 && (
                    <span className="recipe-form__hint">No sub-recipes yet — flag one above first.</span>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="recipe-form__qty-input"
                    value={row.qty}
                    onChange={(e) => updateIngredientRow(row.rowId, "qty", e.target.value)}
                    aria-label="Quantity"
                  />
                  <select
                    className="recipe-form__unit-select"
                    value={row.unit}
                    onChange={(e) => updateIngredientRow(row.rowId, "unit", e.target.value)}
                    aria-label="Unit"
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    list="ingredient-names"
                    className="recipe-form__name-input"
                    value={row.name}
                    onChange={(e) => updateIngredientRow(row.rowId, "name", e.target.value)}
                    placeholder="Ingredient name"
                    aria-label="Ingredient name"
                  />
                  {needsConversion && (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="recipe-form__conversion-input"
                      value={row.conversionValue}
                      onChange={(e) => updateIngredientRow(row.rowId, "conversionValue", e.target.value)}
                      placeholder={conversionLabelFor(row.unit)}
                      aria-label={conversionLabelFor(row.unit)}
                    />
                  )}
                  {!needsConversion && trimmedIngName && (
                    <span className="recipe-form__hint">{existing ? "matches existing" : ""}</span>
                  )}
                </>
              )}

              <button
                type="button"
                className="recipe-form__remove-button"
                onClick={() => removeIngredientRow(row.rowId)}
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            </div>
          );
        })}
        <datalist id="ingredient-names">
          {ingredients.map((ingredient) => (
            <option key={ingredient.name} value={ingredient.name} />
          ))}
        </datalist>
        <button type="button" className="link-button" onClick={addIngredientRow}>
          + Add ingredient
        </button>
      </div>

      <div className="recipe-form__group">
        <span className="recipe-form__label">Steps (in order)</span>
        {stepRows.map((row, index) => (
          <div key={row.rowId} className="recipe-form__row">
            <span className="recipe-form__reorder">
              <button
                type="button"
                className="recipe-form__reorder-button"
                onClick={() => moveStepRow(row.rowId, -1)}
                disabled={index === 0}
                aria-label="Move step up"
              >
                ↑
              </button>
              <button
                type="button"
                className="recipe-form__reorder-button"
                onClick={() => moveStepRow(row.rowId, 1)}
                disabled={index === stepRows.length - 1}
                aria-label="Move step down"
              >
                ↓
              </button>
            </span>
            <input
              type="text"
              className="recipe-form__step-name-input"
              value={row.name}
              onChange={(e) => updateStepRow(row.rowId, "name", e.target.value)}
              placeholder="Step name"
              aria-label="Step name"
            />
            <span className="recipe-form__toggle">
              <button
                type="button"
                className={`recipe-form__toggle-option ${row.type === "active" ? "recipe-form__toggle-option--active" : ""}`}
                onClick={() => updateStepRow(row.rowId, "type", "active")}
              >
                Active
              </button>
              <button
                type="button"
                className={`recipe-form__toggle-option ${row.type === "passive" ? "recipe-form__toggle-option--active" : ""}`}
                onClick={() => updateStepRow(row.rowId, "type", "passive")}
              >
                Passive
              </button>
            </span>
            <input
              type="number"
              min="0"
              className="recipe-form__duration-input"
              value={row.duration}
              onChange={(e) => updateStepRow(row.rowId, "duration", e.target.value)}
              aria-label="Duration (minutes)"
            />
            <span className="recipe-form__hint">min</span>
            <button
              type="button"
              className="recipe-form__remove-button"
              onClick={() => removeStepRow(row.rowId)}
              aria-label="Remove step"
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="link-button" onClick={addStepRow}>
          + Add step
        </button>
      </div>

      <button type="submit" className="generate-button">
        {isEditing ? "Save changes" : "Add recipe"}
      </button>
    </form>
  );
}
