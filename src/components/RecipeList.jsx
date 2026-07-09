import { useState } from "react";

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function RecipeList({ recipes, onDelete, onAdd, onEdit, onBack }) {
  const [confirmingId, setConfirmingId] = useState(null);

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

      <button type="button" className="generate-button recipe-manager__add-button" onClick={onAdd}>
        + Add recipe
      </button>

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
