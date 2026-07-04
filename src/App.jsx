import { useMemo, useState } from "react";
import recipes from "./data/sampleRecipes.json";
import RecipeSelector from "./components/RecipeSelector";
import GatherList from "./components/GatherList";
import TimelineList from "./components/TimelineList";
import { buildGatherList } from "./lib/gatherList";
import { buildTimeline } from "./lib/scheduler";
import "./App.css";

export default function App() {
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

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.has(r.id)),
    [selectedIds]
  );

  function handleGenerate() {
    if (selectedRecipes.length === 0) return;
    const gatherList = buildGatherList(selectedRecipes);
    const timeline = buildTimeline(selectedRecipes);
    setGenerated({ gatherList, timeline });
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Kitchen Prep</h1>
        <p>Select today's recipes, then generate the gather list and prep timeline.</p>
      </header>

      <section className="app__section">
        <h2>1. Select recipes</h2>
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
