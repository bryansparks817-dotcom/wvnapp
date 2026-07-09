function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function RecipeSelector({ recipes, selectedIds, onToggle }) {
  return (
    <div className="recipe-grid">
      {recipes.map((recipe) => {
        const checked = selectedIds.has(recipe.id);
        return (
          <label key={recipe.id} className={`recipe-card ${checked ? "recipe-card--selected" : ""}`}>
            <span className="recipe-card__header">
              <span className="recipe-card__name">
                {recipe.name}
                {recipe.isSubRecipe && <span className="sub-recipe-badge">Sub-recipe</span>}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(recipe.id)}
              />
            </span>
            <span className="recipe-card__meta">
              {pluralize(recipe.ingredients.length, "ingredient")} &middot;{" "}
              {pluralize(recipe.steps.length, "step")}
            </span>
          </label>
        );
      })}
    </div>
  );
}
