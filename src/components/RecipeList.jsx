import { useRef, useState } from "react";

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function RecipeList({
  recipes,
  onDelete,
  onAdd,
  onEdit,
  onReset,
  onImport,
  importReport,
  onDismissImport,
  onBack,
}) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const fileInputRef = useRef(null);

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (file) onImport(file);
  }

  function handleConfirmDelete(id) {
    onDelete(id);
    setConfirmingId(null);
  }

  return (
    <div className="app__section">
      <div className="recipe-manager__header">
        <h2>Manage recipes</h2>
        <button type="button" className="link-button" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="recipe-manager__toolbar">
        <button type="button" className="generate-button recipe-manager__add-button" onClick={onAdd}>
          + Add recipe
        </button>

        {confirmingReset ? (
          <span className="recipe-manager__reset-confirm">
            <span className="recipe-manager-row__confirm-text">
              This clears any local edits, additions, deletions, and the done-log — back to
              whatever's currently shipped. Continue?
            </span>
            <button type="button" className="schedule-row__save-button" onClick={onReset}>
              Confirm
            </button>
            <button type="button" className="schedule-row__cancel-button" onClick={() => setConfirmingReset(false)}>
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirmingReset(true)}>
            Reset to latest recipes
          </button>
        )}

        <button
          type="button"
          className="link-button recipe-manager__import-button"
          onClick={() => fileInputRef.current?.click()}
        >
          Import recipe sheet (.xlsx)
        </button>
        <a className="recipe-manager__template-link" href="/recipe-sheet-template.xlsx" download>
          Download blank recipe sheet
        </a>
        <input ref={fileInputRef} type="file" accept=".xlsx" hidden onChange={handleFileChosen} />
      </div>

      {importReport && (
        <div className="import-report">
          <ul className="import-report__list">
            {importReport.map((item) => (
              <li
                key={item.sheet}
                className={item.errors.length ? "import-report__item import-report__item--error" : "import-report__item"}
              >
                <strong>{item.name}</strong>{" "}
                {item.errors.length === 0
                  ? item.replaced
                    ? "updated"
                    : "added"
                  : "not imported, fix in the sheet and import again:"}
                {item.errors.length > 0 && (
                  <ul>
                    {item.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="link-button" onClick={onDismissImport}>
            Dismiss
          </button>
        </div>
      )}

      <ul className="recipe-manager-list">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="recipe-manager-row">
            <span className="recipe-manager-row__info">
              <span className="recipe-manager-row__name">
                {recipe.name}
                {recipe.isSubRecipe && <span className="sub-recipe-badge">Sub-recipe</span>}
              </span>
              <span className="recipe-manager-row__meta">
                {pluralize(recipe.ingredients.length, "ingredient")} ·{" "}
                {pluralize(recipe.steps.length, "step")}
              </span>
            </span>
            <span className="recipe-manager-row__actions">
              {confirmingId === recipe.id ? (
                <>
                  <span className="recipe-manager-row__confirm-text">Delete?</span>
                  <button
                    type="button"
                    className="schedule-row__save-button"
                    onClick={() => handleConfirmDelete(recipe.id)}
                  >
                    Confirm
                  </button>
                  <button type="button" className="schedule-row__cancel-button" onClick={() => setConfirmingId(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="link-button" onClick={() => onEdit(recipe.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="schedule-row__cancel-button"
                    onClick={() => setConfirmingId(recipe.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
        {recipes.length === 0 && <li className="recipe-manager-row recipe-manager-row--empty">No recipes yet.</li>}
      </ul>
    </div>
  );
}
