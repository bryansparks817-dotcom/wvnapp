import { useMemo, useState } from "react";
import RecipeSelector from "./components/RecipeSelector";
import GatherList from "./components/GatherList";
import TimelineList from "./components/TimelineList";
import RecipeList from "./components/RecipeList";
import { useRecipes } from "./hooks/useRecipes";
import { buildGatherList } from "./lib/gatherList";
import { buildTimeline } from "./lib/scheduler";
import "./App.css";

export default function App() {
  const { recipes, deleteRecipe } = useRecipes();
  const [screen, setScreen] = useState("home");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [generated, setGenerated] = useState(null);

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

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.has(r.id)),
    [recipes, selectedIds]
  );

  function handleGenerate() {
    if (selectedRecipes.length === 0) return;
    const gatherList = buildGatherList(selectedRecipes);
    const timeline = buildTimeline(selectedRecipes);
    setGenerated({ gatherList, timeline });
  }

  if (screen === "manage") {
    return (
      <div className="app">
        <header className="app__header">
          <h1>Kitchen Prep</h1>
        </header>
        <RecipeList recipes={recipes} onDelete={handleDeleteRecipe} onBack={() => setScreen("home")} />
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
          onClick={handleGenerate}
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
            <TimelineList
              chefTimeline={generated.timeline.chefTimeline}
              passiveLanes={generated.timeline.passiveLanes}
              totalOptimizedMinutes={generated.timeline.totalOptimizedMinutes}
              totalSequentialMinutes={generated.timeline.totalSequentialMinutes}
            />
          </section>
        </>
      )}
    </div>
  );
}
