function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function RecipeList({ recipes, onDelete, onBack }) {
  function handleDelete(recipe) {
    if (window.confirm(`Delete "${recipe.name}"? This can't be undone.`)) {
      onDelete(recipe.id);
    }
  }

  return (
    <div className="app__section">
      <div className="recipe-manager__header">
        <h2>Manage recipes</h2>
        <button type="button" className="link-button" onClick={onBack}>
          ← Back
        </button>
      </div>

      <ul className="recipe-manager-list">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="recipe-manager-row">
            <span className="recipe-manager-row__info">
              <span className="recipe-manager-row__name">{recipe.name}</span>
              <span className="recipe-manager-row__meta">
                {pluralize(recipe.ingredients.length, "ingredient")} ·{" "}
                {pluralize(recipe.steps.length, "step")}
              </span>
            </span>
            <span className="recipe-manager-row__actions">
              <button type="button" className="schedule-row__cancel-button" onClick={() => handleDelete(recipe)}>
                Delete
              </button>
            </span>
          </li>
        ))}
        {recipes.length === 0 && <li className="recipe-manager-row recipe-manager-row--empty">No recipes yet.</li>}
      </ul>
    </div>
  );
}
