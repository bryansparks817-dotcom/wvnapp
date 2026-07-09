// Expands recipes that use other recipes as sub-recipe components.
//
// An ingredient entry is either a raw ingredient ({ name, qty, unit }) or a
// sub-recipe reference ({ subRecipeId, qty }) where qty is how many batches
// of that sub-recipe this recipe uses. Batch count scales the sub-recipe's
// ingredient quantities; it does not scale its step durations (prep time
// doesn't scale linearly with batch size, so we leave steps as authored).

function isSubRecipeIngredient(ingredient) {
  return ingredient.subRecipeId != null;
}

// Recursively flattens a recipe's ingredients for the gather list, pulling
// in each sub-recipe's own ingredients (scaled by batch count, and by any
// batch counts above it in the chain).
export function flattenIngredients(recipe, recipesById, multiplier = 1, chain = []) {
  if (chain.includes(recipe.id)) {
    throw new Error(`Circular sub-recipe reference: ${[...chain, recipe.id].join(" -> ")}`);
  }
  const nextChain = [...chain, recipe.id];
  const flattened = [];

  for (const ingredient of recipe.ingredients) {
    if (isSubRecipeIngredient(ingredient)) {
      const subRecipe = recipesById.get(ingredient.subRecipeId);
      if (!subRecipe) continue; // referenced sub-recipe no longer exists
      flattened.push(...flattenIngredients(subRecipe, recipesById, multiplier * ingredient.qty, nextChain));
    } else {
      flattened.push({ name: ingredient.name, qty: ingredient.qty * multiplier, unit: ingredient.unit });
    }
  }

  return flattened;
}

// Builds the flat list of schedulable "tracks" the scheduler runs: one track
// per top-level selected recipe, plus one additional track per sub-recipe
// usage (recursively). A track that uses sub-recipes depends on all of its
// own sub-recipe tracks finishing before its own steps can begin — each
// sub-recipe usage is still scheduled independently, so the chef can work
// on it whenever it's optimal, not necessarily right before the parent.
export function buildTracks(selectedRecipes, recipesById) {
  let counter = 0;
  function nextTrackId(baseId) {
    counter += 1;
    return `${baseId}::${counter}`;
  }

  function buildRecipeTracks(recipe, chain) {
    if (chain.includes(recipe.id)) {
      throw new Error(`Circular sub-recipe reference: ${[...chain, recipe.id].join(" -> ")}`);
    }
    const nextChain = [...chain, recipe.id];

    const tracks = [];
    const dependsOn = [];

    for (const ingredient of recipe.ingredients) {
      if (!isSubRecipeIngredient(ingredient)) continue;
      const subRecipe = recipesById.get(ingredient.subRecipeId);
      if (!subRecipe) continue;

      const { tracks: subTracks, rootTrackId } = buildRecipeTracks(subRecipe, nextChain);
      const relabeled = subTracks.map((t) =>
        t.id === rootTrackId ? { ...t, name: `${t.name} (for ${recipe.name})` } : t
      );
      tracks.push(...relabeled);
      dependsOn.push(rootTrackId);
    }

    const rootTrackId = nextTrackId(recipe.id);
    tracks.push({ id: rootTrackId, name: recipe.name, steps: recipe.steps, dependsOn });

    return { tracks, rootTrackId };
  }

  const allTracks = [];
  for (const recipe of selectedRecipes) {
    const { tracks } = buildRecipeTracks(recipe, []);
    allTracks.push(...tracks);
  }
  return allTracks;
}
