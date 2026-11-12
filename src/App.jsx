import { useEffect, useMemo, useRef, useState } from "react";
import RecipeSelector from "./components/RecipeSelector";
import GatherList from "./components/GatherList";
import TimelineList from "./components/TimelineList";
import RecipeList from "./components/RecipeList";
import RecipeForm from "./components/RecipeForm";
import LineCook, { WhoScreen } from "./linecook/LineCook";
import ChefHome from "./chef/ChefHome";
import ChefSetup from "./chef/ChefSetup";
import Insights from "./chef/Insights";
import Prices from "./chef/Prices";
import Staff from "./chef/Staff";
import RecipeLookup from "./chef/RecipeLookup";
import TimerBar from "./linecook/TimerBar";
import { PassHeader, TabBar } from "./linecook/Chrome";
import { CHEF_TABS } from "./linecook/tabs";
import "./linecook/pass.css";
import { loadTimers, saveTimers, loadChef, saveChef, loadStaff, saveStaff } from "./lib/storage";
import { activeStaff, hasChef, hashPin, isChef, signIn } from "./lib/staff";
import { onRemoteChange } from "./lib/sync";
import { useRecipes } from "./hooks/useRecipes";
import { useIngredients } from "./hooks/useIngredients";
import { buildGatherList } from "./lib/gatherList";
import { buildTracks } from "./lib/recipeComposition";
import { buildTimeline } from "./lib/scheduler";
import { loadSelectedRecipeIds, saveSelectedRecipeIds, clearAllLocalData } from "./lib/storage";
import { parseRecipeWorkbook } from "./lib/recipeSheetImport";
import "./App.css";

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Chef pages share the line cook look and flow: same header, colors, fonts,
// initials pill and bottom tabs.
// Chef screens reload when another phone changes shared data, unless the
// chef is typing (then right after they leave the field).
function useRemoteVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let waiting = false;
    const typing = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    const bump = () => setVersion((v) => v + 1);
    const onBlur = () => { if (waiting) { waiting = false; setTimeout(bump, 0); } };
    const off = onRemoteChange(() => { if (typing()) waiting = true; else bump(); });
    document.addEventListener("focusout", onBlur);
    return () => { off(); document.removeEventListener("focusout", onBlur); };
  }, []);
  return version;
}

function ChefShell({ title, lede, screen, setScreen, initials, onSignOut, children }) {
  const version = useRemoteVersion();
  return (
    <div className="pass pass--chef">
      <PassHeader station="Chef" initials={initials} onChangeCook={onSignOut}>
        <span className="pass__date">CHEF</span>
        <h1 className="pass__title">{title}</h1>
        {lede && <p className="pass__lede">{lede}</p>}
      </PassHeader>
      <main key={version} className="pass__main chef">{children}</main>
      <TabBar screen={screen} setScreen={setScreen} tabs={CHEF_TABS} />
    </div>
  );
}

export default function App() {
  const { recipes, addRecipe, updateRecipe, deleteRecipe, importRecipes } = useRecipes();
  const { ingredients, findIngredient, upsertIngredient } = useIngredients();
  // "line" = the line cook screens (default); "chef" = recipe and prep tools.
  const [mode, setMode] = useState("line");
  // Prep timers live here so the timer strip shows on every screen, line or chef.
  const [timers, setTimers] = useState(() => loadTimers());
  useEffect(() => {
    saveTimers(timers);
  }, [timers]);
  const startTimer = (label, minutes) =>
    setTimers((t) => [...t, { id: `${Date.now()}`, label, endsAt: Date.now() + minutes * 60000 }]);
  const timerBar = <TimerBar timers={timers} onDismiss={(id) => setTimers((t) => t.filter((x) => x.id !== id))} />;
  const [screen, setScreen] = useState("home");
  const today = localDateKey();
  const [chef, setChef] = useState(() => loadChef());
  useEffect(() => { saveChef(chef); }, [chef]);
  const chefOn = chef?.date === today ? chef : null;
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set(loadSelectedRecipeIds()));
  const [generated, setGenerated] = useState(null);
  const [importReport, setImportReport] = useState(null);

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

  function handleResetToLatest() {
    clearAllLocalData();
    window.location.reload();
  }

  // Reads a standard recipe sheet workbook. Recipes with problems are skipped
  // (not half-imported) and listed in the report so they can be fixed in the
  // sheet and imported again.
  async function handleImportSheet(file) {
    setImportReport(null);
    try {
      // Loaded on demand so the spreadsheet reader isn't in the main bundle.
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(file);
      const results = parseRecipeWorkbook(sheets, { recipes, findIngredient });
      const ok = results.filter((r) => r.recipe && r.errors.length === 0);
      for (const { conversions } of ok) {
        for (const { name, fields } of conversions) upsertIngredient(name, fields);
      }
      if (ok.length > 0) importRecipes(ok.map((r) => r.recipe));
      setGenerated(null);
      setImportReport(
        results.map(({ sheet, label, recipe, errors }) => ({
          sheet,
          name: recipe?.name ?? label,
          replaced: Boolean(recipe && recipes.some((r) => r.name.toLowerCase() === recipe.name.toLowerCase())),
          errors,
        })),
      );
    } catch {
      setImportReport([{ sheet: file.name, name: file.name, errors: ["Couldn't read this file. Is it an .xlsx?"] }]);
    }
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

  if (mode === "line") {
    return (
      <>
        {timerBar}
        <LineCook
          recipesById={recipesById}
          ingredients={ingredients}
          onOpenChef={() => setMode("chef")}
          timers={timers}
          onStartTimer={startTimer}
        />
      </>
    );
  }

  if (!chefOn) {
    return (
      <>
        {timerBar}
        <WhoScreen
          station="Chef"
          roster={hasChef(loadStaff()) ? activeStaff(loadStaff()).filter(isChef) : []}
          title={hasChef(loadStaff()) ? "Chef sign-in" : "Set up the chef"}
          lede={hasChef(loadStaff()) ? "See the crew, covers, 86s and anything waiting on you." : "You’ll be the first chef. Pick a PIN so only you can open the chef view, then add your staff under Setup → Staff."}
          cta="OPEN CHEF VIEW →"
          allowNew={!hasChef(loadStaff())}
          newNeedsPin
          emptyHint="Only chefs can open the chef view. A chef can make you one in Setup → Staff."
          onSignIn={(name, pin) => {
            const { person, roster } = signIn(name, loadStaff());
            const first = !hasChef(roster);
            saveStaff(first ? roster.map((p) => (p === person || p.initials === person.initials ? { ...p, role: "chef", active: true, ...(pin ? { pinHash: hashPin(pin) } : {}) } : p)) : roster);
            setChef({ date: today, name: person.name, initials: person.initials });
            setScreen("home");
          }}
          extra={<button type="button" className="pass__ghost" onClick={() => setMode("line")}>← Back to the line view</button>}
        />
      </>
    );
  }

  const shell = {
    // Setup (and the recipes and prep plan tool under it) is off the daily
    // tabs: it's done once, then only for new menu items. It hangs off Home.
    screen: ["setup", "form", "manage", "plan", "prices", "staff"].includes(screen) ? "home" : screen,
    setScreen: (id) => (id === "line" ? setMode("line") : setScreen(id)),
    initials: chefOn.initials,
    onSignOut: () => setChef(null),
  };

  if (screen === "home") {
    const d = new Date();
    const hello = d.getHours() < 12 ? "Morning" : d.getHours() < 17 ? "Afternoon" : "Evening";
    return (
      <>
        {timerBar}
        <ChefShell title={`${hello}, ${chefOn.name.split(" ")[0]}`} {...shell}>
          <RecipeLookup recipes={recipes} />
          <ChefHome today={today} recipesById={recipesById} onOpenRecipes={() => setScreen("manage")} by={chefOn.initials} />
          <button type="button" className="chef__setuplink" onClick={() => setScreen("setup")}>
            Setup &amp; new menu items ›
          </button>
        </ChefShell>
      </>
    );
  }

  if (screen === "crew" || screen === "stock") {
    return (
      <>
        {timerBar}
        <ChefShell
          title={screen === "crew" ? "Crew" : "Stock"}
          lede={screen === "crew" ? "Where every cook is on their list, step by step." : "86s, short ingredients and what got tossed."}
          {...shell}
        >
          <ChefHome key={screen} view={screen} today={today} recipesById={recipesById} onOpenRecipes={() => setScreen("manage")} by={chefOn.initials} />
        </ChefShell>
      </>
    );
  }

  if (screen === "data") {
    return (
      <>
        {timerBar}
        <ChefShell title="Data" lede="What the line’s logs say: waste, pars, prep per cover, cooks, recipe times, shortages, food cost." {...shell}>
          <Insights
            today={today}
            recipes={recipes}
            recipesById={recipesById}
            ingredients={ingredients}
            onUpdateRecipe={updateRecipe}
            onOpenPrices={() => setScreen("prices")}
          />
        </ChefShell>
      </>
    );
  }

  if (screen === "prices") {
    return (
      <>
        {timerBar}
        <ChefShell title="Prices" lede="Ingredient prices, $ per kg." {...shell}>
          <Prices recipes={recipes} recipesById={recipesById} ingredients={ingredients} />
        </ChefShell>
      </>
    );
  }

  if (screen === "staff") {
    return (
      <>
        {timerBar}
        <ChefShell title="Staff" lede="Who signs in, what they can open, and their PIN." {...shell}>
          <Staff />
        </ChefShell>
      </>
    );
  }

  if (screen === "setup") {
    return (
      <>
        {timerBar}
        <ChefShell title="Setup" lede="Done once, then for new menu items: recipes, stations, staff and storage." {...shell}>
          <ChefSetup onOpen={setScreen} />
        </ChefShell>
      </>
    );
  }

  if (screen === "form") {
    const initialRecipe = editingRecipeId ? recipes.find((r) => r.id === editingRecipeId) : null;
    return (
      <>
      {timerBar}
      <ChefShell title="Recipes" {...shell}>
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
      </ChefShell>
      </>
    );
  }

  if (screen === "manage") {
    return (
      <>
      {timerBar}
      <ChefShell title="Recipes" lede="Add, edit or import recipe sheets." {...shell}>
        <RecipeList
          recipes={recipes}
          onDelete={handleDeleteRecipe}
          onAdd={openAddForm}
          onEdit={openEditForm}
          onReset={handleResetToLatest}
          onImport={handleImportSheet}
          importReport={importReport}
          onDismissImport={() => setImportReport(null)}
          onBack={() => {
            setImportReport(null);
            setScreen("setup");
          }}
        />
      </ChefShell>
      </>
    );
  }

  return (
    <>
    {timerBar}
    <ChefShell title="Prep plan" lede="Select recipes, then generate the gather list and prep timeline." {...shell}>

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
    </ChefShell>
    </>
  );
}
