// Prep tasks (Bryan, 2026-11-27): station items that aren't recipes, like
// shaved garlic or cleaned oyster mushrooms. Counted like any item; when
// short, they go on the prep list as one hands-on step of item.taskMinutes
// (to fill the pan). Each gets a one-step stand-in recipe "task:<item id>",
// so the scheduler fits it around the long recipes like anything else.
export const taskRecipeId = (itemId) => `task:${itemId}`;
export const isTaskRecipe = (id) => typeof id === "string" && id.startsWith("task:");

export function taskRecipe(item) {
  return {
    id: taskRecipeId(item.id),
    name: item.name,
    kind: "prep",
    isSubRecipe: false,
    task: true,
    yieldGrams: item.panGrams,
    ingredients: [],
    steps: [{ name: item.taskNote || item.name, type: "active", duration_minutes: Number(item.taskMinutes) || 15 }],
  };
}

// recipesById plus a stand-in recipe for every task item on the stations.
export function withTaskRecipes(recipesById, stations) {
  const tasks = stations.flatMap((s) => s.items).filter((i) => i.task);
  if (!tasks.length) return recipesById;
  const next = new Map(recipesById);
  for (const i of tasks) next.set(taskRecipeId(i.id), taskRecipe(i));
  return next;
}
