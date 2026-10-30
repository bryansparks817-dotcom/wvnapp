import { useState } from "react";

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function RecipeList({ recipes, onDelete, onAdd, onEdit, onReset, onBack }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

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
      </div>

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
