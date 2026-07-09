import { useEffect, useMemo, useRef, useState } from "react";
import RecipeSelector from "./components/RecipeSelector";
import GatherList from "./components/GatherList";
import TimelineList from "./components/TimelineList";
import RecipeList from "./components/RecipeList";
import RecipeForm from "./components/RecipeForm";
import { useRecipes } from "./hooks/useRecipes";
import { useIngredients } from "./hooks/useIngredients";
import { buildGatherList } from "./lib/gatherList";
import { buildTracks } from "./lib/recipeComposition";
import { buildTimeline } from "./lib/scheduler";
import { loadSelectedRecipeIds, saveSelectedRecipeIds } from "./lib/storage";
import "./App.css";

export default function App() {
  const { recipes, addRecipe, updateRecipe, deleteRecipe } = useRecipes();
  const { ingredients, findIngredient, upsertIngredient } = useIngredients();
  const [screen, setScreen] = useState("home");
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set(loadSelectedRecipeIds()));
  const [generated, setGenerated] = useState(null);

  useEffect(() => {
    saveSelectedRecipeIds(Array.from(selectedIds));
  }, [selectedIds]);

  function toggleRecipe(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setGenerated(null);
  }

  function handleDeleteRecipe(id) {
    deleteRecipe(id);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setGenerated(null);
  }

  function openAddForm() {
    setEditingRecipeId(null);
    setScreen("form");
  }

  function openEditForm(id) {
    setEditingRecipeId(id);
    setScreen("form");
  }

  function handleSaveRecipe(recipe) {
    if (editingRecipeId) {
      updateRecipe(editingRecipeId, recipe);
    } else {
      addRecipe(recipe);
    }
    setGenerated(null);
    setScreen("manage");
  }

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.has(r.id)),
    [recipes, selectedIds]
  );

  function generate(recipesToSchedule) {
    if (recipesToSchedule.length === 0) return;
    const gatherList = buildGatherList(recipesToSchedule, ingredients, recipesById);
    const tracks = buildTracks(recipesToSchedule, recipesById);
    const timeline = buildTimeline(tracks);
    setGenerated({ gatherList, timeline });
  }

  // Restore the day's plan once on load, so a refresh mid-shift doesn't lose
  // the previously selected recipes (and, via TimelineList's own persisted
  // done-log, the tasks already marked done).
  const didRestoreOnLoad = useRef(false);
  useEffect(() => {
    if (didRestoreOnLoad.current) return;
    didRestoreOnLoad.current = true;
    if (selectedRecipes.length > 0) generate(selectedRecipes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (screen === "form") {
    const initialRecipe = editingRecipeId ? recipes.find((r) => r.id === editingRecipeId) : null;
    return (
      <div className="app">
        <header className="app__header">
          <h1>Kitchen Prep</h1>
        </header>
        <RecipeForm
          initialRecipe={initialRecipe}
          recipes={recipes}
          recipesById={recipesById}
          ingredients={ingredients}
          findIngredient={findIngredient}
          upsertIngredient={upsertIngredient}
          onSave={handleSaveRecipe}
          onCancel={() => setScreen("manage")}
        />
      </div>
    );
  }

  if (screen === "manage") {
    return (
      <div className="app">
        <header className="app__header">
          <h1>Kitchen Prep</h1>
        </header>
        <RecipeList
          recipes={recipes}
          onDelete={handleDeleteRecipe}
          onAdd={openAddForm}
          onEdit={openEditForm}
          onBack={() => setScreen("home")}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Kitchen Prep</h1>
        <p>Select today's recipes, then generate the gather list and prep timeline.</p>
      </header>

      <section className="app__section">
        <div className="recipe-manager__header">
          <h2>1. Select recipes</h2>
          <button type="button" className="link-button" onClick={() => setScreen("manage")}>
            Manage recipes →
          </button>
        </div>
        <RecipeSelector recipes={recipes} selectedIds={selectedIds} onToggle={toggleRecipe} />
        <button
          className="generate-button"
          onClick={() => generate(selectedRecipes)}
          disabled={selectedRecipes.length === 0}
        >
          Generate ({selectedRecipes.length} selected)
        </button>
      </section>

      {generated && (
        <>
          <section className="app__section">
            <h2>2. Gather list</h2>
            <GatherList items={generated.gatherList} />
          </section>

          <section className="app__section">
            <h2>3. Prep timeline</h2>
            <TimelineList timeline={generated.timeline} />
          </section>
        </>
      )}
    </div>
  );
}
