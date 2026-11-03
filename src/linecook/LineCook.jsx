import { useEffect, useMemo, useState } from "react";
import lineData from "../data/lineItems.json";
import {
  loadEightySix, saveEightySix, loadInventory, saveInventory, loadShift, saveShift,
  loadCook, saveCook, loadWaste, saveWaste, loadStaff, saveStaff,
} from "../lib/storage";
import { applyCollect, applyPrep, buildShift, emptyInventory, gramsIn, isLastDay, sampleInventory } from "../lib/inventory";
import { buildPrepSteps } from "../lib/lineList";
import { batchGrams, scaleRecipe } from "../lib/recipeScale";
import { gatherForPrep } from "../lib/gatherList";
import { printLabel } from "../lib/label";
import { normalizeName, previewInitials, signIn } from "../lib/staff";
import TodayScreen from "./TodayScreen";
import CountScreen from "./CountScreen";
import RecipeScreen from "./RecipeScreen";
import { PassHeader } from "./Chrome";
import "./pass.css";

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
function dayName(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function WhoScreen({ station, roster, onSignIn }) {
  const [name, setName] = useState("");
  const initials = previewInitials(name, roster);
  const ok = normalizeName(name).split(" ").length >= 2 || roster.some((p) => p.name.toLowerCase() === normalizeName(name).toLowerCase());
  return (
    <div className="pass">
      <PassHeader station={station}>
        <h1 className="pass__title">Who’s on?</h1>
        <p className="pass__lede">Your initials go on counts, check-offs and labels today.</p>
      </PassHeader>
      <main className="pass__main">
        {roster.length > 0 && (
          <section className="pass__roster" aria-label="Staff">
            <span className="pass__countlabel">TAP YOUR NAME</span>
            <div className="pass__rosterlist">
              {roster.map((p) => (
                <button key={p.initials} type="button" className="pass__person" onClick={() => onSignIn(p.name)}>
                  <span className="pass__personinit">{p.initials}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
        <form
          className="pass__gate"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) onSignIn(name);
          }}
        >
          <label className="pass__countlabel" htmlFor="pass-name">{roster.length ? "OR ENTER YOUR FULL NAME" : "FULL NAME"}</label>
          <input
            id="pass-name"
            className="pass__input pass__input--name"
            value={name}
            autoComplete="name"
            autoCapitalize="words"
            placeholder="First and last name"
            onChange={(e) => setName(e.target.value)}
          />
          <p className="pass__hint" aria-live="polite">
            {initials ? <>You’ll sign as <strong className="pass__amber">{initials}</strong></> : "Your initials are set from your name."}
          </p>
          <button type="submit" className="pass__cta" disabled={!ok}>START SHIFT →</button>
        </form>
      </main>
    </div>
  );
}

export default function LineCook({ recipesById, ingredients, onOpenChef, timers, onStartTimer }) {
  const today = localDateKey();
  const { items, linePar, station } = lineData;
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [inventory, setInventory] = useState(() => loadInventory());
  const [shift, setShift] = useState(() => loadShift());
  const [cook, setCook] = useState(() => loadCook());
  const [staff, setStaff] = useState(() => loadStaff());
  const [waste, setWaste] = useState(() => loadWaste());
  const [flags, setFlags] = useState(() => loadEightySix());
  const [screen, setScreen] = useState("today");
  const [openPrepId, setOpenPrepId] = useState(null);

  useEffect(() => { if (inventory) saveInventory(inventory); }, [inventory]);
  useEffect(() => { if (shift) saveShift(shift); }, [shift]);
  useEffect(() => { if (cook) saveCook(cook); }, [cook]);
  useEffect(() => { saveStaff(staff); }, [staff]);
  useEffect(() => { saveWaste(waste); }, [waste]);
  useEffect(() => { saveEightySix(flags); }, [flags]);

  const by = cook?.date === today ? cook.initials : null;
  const invItems = inventory?.items ?? emptyInventory(items);
  const shiftIsToday = shift?.date === today;
  const meta = shiftIsToday ? shift.meta ?? {} : {};

  const prepForPlan = useMemo(
    () => (shiftIsToday ? shift.prep.filter((p) => p.makeG > 0) : []),
    [shift, shiftIsToday]
  );
  const plan = useMemo(() => buildPrepSteps(prepForPlan, recipesById), [prepForPlan, recipesById]);
  const gather = useMemo(
    () => gatherForPrep(prepForPlan, recipesById, ingredients, (r) => batchGrams(r, recipesById, ingredients).grams),
    [prepForPlan, recipesById, ingredients]
  );

  function toggleGather(key) {
    const gathered = { ...(shift.gathered ?? {}) };
    if (gathered[key]) delete gathered[key];
    else gathered[key] = true;
    setShift({ ...shift, gathered });
  }

  function changeItem(id, next) {
    setInventory((inv) => ({ ...(inv ?? {}), items: { ...(inv?.items ?? emptyInventory(items)), [id]: next } }));
  }

  function changeNotes(text) {
    setInventory((inv) => ({ ...(inv ?? { items: emptyInventory(items) }), draftNotes: text }));
  }

  function saveClose() {
    setInventory((inv) => ({
      ...inv,
      items: inv?.items ?? emptyInventory(items),
      closedOn: today,
      closedBy: by,
      notes: inv?.draftNotes?.trim() ? { text: inv.draftNotes.trim(), by } : null,
      draftNotes: "",
    }));
    setScreen("today");
  }

  function confirmCount() {
    const { collect, prep } = buildShift(items, invItems, linePar, today);
    const strip = (rows) => rows.map(({ item: _item, ...rest }) => rest);
    setShift({ date: today, collect: strip(collect), prep: strip(prep), done: {}, meta: {}, confirmedBy: by });
    setScreen("today");
  }

  function loadSample() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setInventory({
      closedOn: localDateKey(yesterday),
      closedBy: "JR",
      notes: { text: "Low on shallots for mignonette. Stock is on its last day, toss it.", by: "JR" },
      items: sampleInventory(items, today),
    });
    setShift(null);
  }

  // Checking a row applies it to inventory; unchecking restores that item.
  function toggleDone(kind, row, stepsDone = shift.stepsDone) {
    const key = `${kind}:${row.id}`;
    const item = itemsById.get(row.id);
    if (shift.done[key]) {
      const snapshot = shift.done[key];
      setInventory((inv) => ({ ...inv, items: { ...inv.items, [row.id]: snapshot } }));
      const done = { ...shift.done };
      const nextMeta = { ...meta };
      for (const k of [`c:${row.id}`, `p:${row.id}`]) {
        delete done[k];
        delete nextMeta[k];
      }
      setShift({ ...shift, stepsDone, done, meta: nextMeta });
      setWaste((w) => w.filter((e) => e.key !== `${today}:${row.id}`));
      return;
    }
    const before = invItems[row.id];
    const at = Date.now();
    let labels = null;
    let after;
    if (kind === "c") {
      after = applyCollect(before, row, linePar);
    } else {
      after = applyPrep(item, before, row, linePar, today);
      const kept = before.lowboy.filter((c) => c.fill > 0 && !isLastDay(item, c.madeOn, today)).length;
      const added = after.lowboy.slice(kept).map((c) => ({ size: c.size, grams: gramsIn(item, c) }));
      const lineG = ((after.line - before.line) / 100) * item.panGrams;
      labels = [...(lineG > 0 ? [{ size: `${item.pan} pan`, grams: lineG }] : []), ...added];
      if (row.toss.length) {
        const tossG = row.toss.reduce((s, t) => s + gramsIn(item, t), 0);
        setWaste((w) => [
          ...w,
          { key: `${today}:${row.id}`, date: today, itemId: row.id, name: item.name, grams: tossG, reason: "shelf life", by, at },
        ]);
      }
    }
    setInventory((inv) => ({ ...inv, items: { ...inv.items, [row.id]: after } }));
    setShift({ ...shift, stepsDone, done: { ...shift.done, [key]: before }, meta: { ...meta, [key]: { by, at, labels } } });
  }

  // Ticks one step of the prep list. Ticking an item's last step checks the
  // item off (restock + labels); unticking it undoes that.
  function toggleStep(step, isDone) {
    const row = step.item ? shift.prep.find((p) => p.id === step.item.id) : null;
    const itemDone = Boolean(row && shift.done[`p:${row.id}`]);
    const stepsDone = { ...(shift.stepsDone ?? {}) };
    if (isDone) delete stepsDone[step.key];
    else stepsDone[step.key] = true;
    const finishes = !isDone && step.lastForItem && !itemDone;
    const reopens = isDone && itemDone;
    if (row && (finishes || reopens)) toggleDone("p", row, stepsDone);
    else setShift({ ...shift, stepsDone });
  }

  function addFlag(name, kind) {
    setFlags((f) => [...f.filter((x) => x.name !== name), { name, kind, by, at: Date.now() }]);
  }

  const shared = { station, onOpenChef, screen, setScreen, initials: by, onChangeCook: () => setCook(null) };

  if (!by) {
    return (
      <WhoScreen
        station={station}
        roster={staff}
        onSignIn={(name) => {
          const { person, roster } = signIn(name, staff);
          setStaff(roster);
          setCook({ date: today, name: person.name, initials: person.initials });
        }}
      />
    );
  }

  if (openPrepId && shiftIsToday) {
    const row = shift.prep.find((p) => p.id === openPrepId);
    const recipe = row?.recipeId ? recipesById.get(row.recipeId) : null;
    if (row) {
      const scaled = recipe ? scaleRecipe(recipe, row.makeG, recipesById, ingredients) : null;
      const key = `p:${row.id}`;
      return (
        <>
          <RecipeScreen
            row={row}
            recipe={recipe}
            scaled={scaled}
            doneMeta={shift.done[key] ? meta[key] : null}
            timers={timers}
            onBack={() => setOpenPrepId(null)}
            onToggleDone={() => toggleDone("p", row)}
            onStartTimer={onStartTimer}
            onPrintLabel={() =>
              printLabel({ item: itemsById.get(row.id), madeOn: today, madeAt: meta[key]?.at, by: meta[key]?.by, containers: meta[key]?.labels ?? [] })
            }
          />
        </>
      );
    }
  }

  if (screen === "close" || (screen === "today" && inventory?.closedOn && !shiftIsToday)) {
    const mode = screen === "close" ? "close" : "confirm";
    return (
      <>
        <CountScreen
          {...shared}
          mode={mode}
          items={items}
          inventory={invItems}
          today={today}
          closedOnLabel={inventory?.closedOn ? dayName(inventory.closedOn) : ""}
          closedBy={inventory?.closedBy}
          notes={mode === "close" ? inventory?.draftNotes ?? "" : null}
          lastNotes={inventory?.notes}
          onChangeNotes={changeNotes}
          onChangeItem={changeItem}
          onSubmit={mode === "close" ? saveClose : confirmCount}
        />
      </>
    );
  }

  return (
    <>
      <TodayScreen
        {...shared}
        hasClose={Boolean(inventory?.closedOn)}
        lastNotes={inventory?.notes}
        flags={flags}
        onAddFlag={addFlag}
        onRemoveFlag={(name) => setFlags((f) => f.filter((x) => x.name !== name))}
        items={items}
        itemsById={itemsById}
        today={today}
        collect={shiftIsToday ? shift.collect : []}
        tossOnly={shiftIsToday ? shift.prep.filter((p) => p.makeG === 0) : []}
        plan={plan}
        done={shiftIsToday ? shift.done : {}}
        stepsDone={shiftIsToday ? shift.stepsDone ?? {} : {}}
        gather={gather}
        gathered={shiftIsToday ? shift.gathered ?? {} : {}}
        onToggleGather={toggleGather}
        meta={meta}
        timers={timers}
        onToggleStep={toggleStep}
        onStartTimer={onStartTimer}
        wasteToday={waste.filter((w) => w.date === today)}
        onToggle={toggleDone}
        onOpenPrep={setOpenPrepId}
        onLoadSample={loadSample}
      />
    </>
  );
}
