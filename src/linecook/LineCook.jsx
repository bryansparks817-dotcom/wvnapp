import { useEffect, useMemo, useState } from "react";
import { STATIONS, stationsFor } from "../data/stations";
import {
  loadEightySix, saveEightySix, loadInventory, saveInventory, loadShift, saveShift,
  loadCook, saveCook, loadWaste, saveWaste, loadStaff, saveStaff, loadStation, saveStation, loadChefAlerts, saveChefAlerts,
} from "../lib/storage";
import { applyCollect, applyPrep, buildShift, emptyInventory, gramsIn, isLastDay, sampleInventory } from "../lib/inventory";
import { buildPrepSteps } from "../lib/lineList";
import { batchGrams, scaleRecipe } from "../lib/recipeScale";
import { gatherForPrep } from "../lib/gatherList";
import { applyShortages } from "../lib/shortage";
import { printLabel } from "../lib/label";
import { normalizeName, previewInitials, signIn } from "../lib/staff";
import TodayScreen from "./TodayScreen";
import CountScreen from "./CountScreen";
import RecipeScreen from "./RecipeScreen";
import { PassHeader, StationTabs, TabBar } from "./Chrome";
import "./pass.css";

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
// "TUE 3:05 PM" for the close a count came from (older saves only have a date).
function closeLabel(inv) {
  if (inv?.closedAt) {
    const d = new Date(inv.closedAt);
    return `${DAY_NAMES[d.getDay()]} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toUpperCase()}`;
  }
  if (!inv?.closedOn) return "";
  const [y, m, d] = inv.closedOn.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

// Sign-in by name. The chef uses the same screen with its own wording.
export function WhoScreen({ station, roster, onSignIn, title = "Who’s on?", lede = "Your initials go on counts, check-offs and labels today.", cta = "START SHIFT →", extra = null }) {
  const [name, setName] = useState("");
  const initials = previewInitials(name, roster);
  const ok = normalizeName(name).split(" ").length >= 2 || roster.some((p) => p.name.toLowerCase() === normalizeName(name).toLowerCase());
  return (
    <div className="pass">
      <PassHeader station={station}>
        <h1 className="pass__title">{title}</h1>
        <p className="pass__lede">{lede}</p>
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
          <button type="submit" className="pass__cta" disabled={!ok}>{cta}</button>
        </form>
        {extra}
      </main>
    </div>
  );
}

// Sign-in and station choice. Each station's counts and shift live in their
// own StationLine, which remounts when the station changes.
export default function LineCook(props) {
  const today = localDateKey();
  const [cook, setCook] = useState(() => loadCook());
  const [staff, setStaff] = useState(() => loadStaff());
  const [stationId, setStationId] = useState(() => loadStation() ?? STATIONS[0].id);
  // Every sign-in starts on the opening shift page (confirm the count), even
  // when the shift is already underway.
  const [opening, setOpening] = useState(false);

  useEffect(() => { if (cook) saveCook(cook); }, [cook]);
  useEffect(() => { saveStaff(staff); }, [staff]);
  useEffect(() => { saveStation(stationId); }, [stationId]);

  const signedIn = cook?.date === today ? cook : null;
  const person = signedIn ? staff.find((p) => p.initials === signedIn.initials) : null;
  const allowed = stationsFor(person);
  const station = allowed.find((s) => s.id === stationId) ?? allowed[0];

  if (!signedIn) {
    return (
      <WhoScreen
        station={station.name}
        roster={staff}
        onSignIn={(name) => {
          const { person: p, roster } = signIn(name, staff);
          setStaff(roster);
          setCook({ date: today, name: p.name, initials: p.initials });
          setOpening(true);
        }}
      />
    );
  }

  const tabs = <StationTabs stations={allowed} current={station.id} onPick={setStationId} />;
  return (
    <StationLine
      key={station.id}
      {...props}
      station={station}
      stationTabs={tabs}
      by={signedIn.initials}
      opening={opening}
      onOpened={() => setOpening(false)}
      onChangeCook={() => setCook(null)}
    />
  );
}

function StationLine({ station: st, stationTabs, by, opening, onOpened, onChangeCook, recipesById, ingredients, onOpenChef, timers, onStartTimer }) {
  const today = localDateKey();
  const { items, linePar } = st;
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [inventory, setInventory] = useState(() => loadInventory(st.id));
  const [shift, setShift] = useState(() => loadShift(st.id));
  const [waste, setWaste] = useState(() => loadWaste());
  const [flags, setFlags] = useState(() => loadEightySix());
  const [screen, setScreen] = useState("today");
  const [openPrepId, setOpenPrepId] = useState(null);

  useEffect(() => { if (inventory) saveInventory(inventory, st.id); }, [inventory, st.id]);
  useEffect(() => { if (shift) saveShift(shift, st.id); }, [shift, st.id]);
  useEffect(() => { saveWaste(waste); }, [waste]);
  useEffect(() => { saveEightySix(flags); }, [flags]);

  const invItems = inventory?.items ?? emptyInventory(items);
  // Counts are taken at the end of every shift, not once a day. A shift runs
  // from confirming a count to the next close count; the close ends it, and
  // the next shift (same day or not) starts by confirming that count.
  const shiftIsToday = Boolean(shift && !shift.closedAt && shift.date === today);
  const unclosedShift = Boolean(shift && !shift.closedAt && shift.date !== today);
  const meta = shiftIsToday ? shift.meta ?? {} : {};

  // Prep as planned from the count, and as scaled down by any short
  // ingredient (see lib/shortage.js).
  const fullPrep = useMemo(() => (shiftIsToday ? shift.prep.filter((p) => p.makeG > 0) : []), [shift, shiftIsToday]);
  const prepRows = useMemo(() => (shiftIsToday ? applyShortages(shift.prep, shift.short) : []), [shift, shiftIsToday]);
  const prepForPlan = useMemo(() => prepRows.filter((p) => p.makeG > 0), [prepRows]);
  const cantMake = useMemo(() => prepRows.filter((p) => p.plannedG > 0 && p.makeG === 0), [prepRows]);
  const plan = useMemo(() => buildPrepSteps(prepForPlan, recipesById), [prepForPlan, recipesById]);
  // What the full list needs (for judging a shortage) and what to actually pull.
  const fullGather = useMemo(
    () => gatherForPrep(fullPrep, recipesById, ingredients, (r) => batchGrams(r, recipesById, ingredients).grams),
    [fullPrep, recipesById, ingredients]
  );
  const gather = useMemo(
    () => gatherForPrep(prepForPlan, recipesById, ingredients, (r) => batchGrams(r, recipesById, ingredients).grams),
    [prepForPlan, recipesById, ingredients]
  );

  // Short on an ingredient: scale the items that use it down to what's on
  // hand and tell the chef which ingredient it is. haveG null clears it.
  function setShort(entry, haveG) {
    const key = entry.name.toLowerCase();
    const full = fullGather.items.find((g) => g.name.toLowerCase() === key) ?? entry;
    const short = { ...(shift.short ?? {}) };
    const id = `${today}:${st.id}:${key}`;
    if (haveG != null) short[key] = { name: full.name, needG: full.grams, haveG, items: full.usedIn, by, at: Date.now() };
    else delete short[key];
    setShift({ ...shift, short });
    const alerts = loadChefAlerts().filter((a) => a.id !== id);
    if (haveG != null) {
      const scaled = applyShortages(shift.prep, short).filter((r) => full.usedIn.includes(r.name));
      alerts.push({
        id, type: "short", date: today, station: st.name, ingredient: full.name,
        needG: Math.round(full.grams), haveG: Math.round(haveG),
        items: scaled.map((r) => ({ name: r.name, plannedG: r.plannedG ?? r.makeG, makeG: r.makeG })),
        by, at: Date.now(),
      });
    }
    saveChefAlerts(alerts);
  }

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
    const closedAt = Date.now();
    const nextInv = {
      ...inventory,
      items: inventory?.items ?? emptyInventory(items),
      closedOn: today,
      closedAt,
      closedBy: by,
      notes: inventory?.draftNotes?.trim() ? { text: inventory.draftNotes.trim(), by } : null,
      draftNotes: "",
    };
    const nextShift = shift ? { ...shift, closedAt } : shift;
    // Saved right away: signing the cook out below unmounts this station.
    saveInventory(nextInv, st.id);
    if (nextShift) saveShift(nextShift, st.id);
    setInventory(nextInv);
    setShift(nextShift);
    setScreen("today");
    // The shift is over: the next cook signs in and confirms this count.
    onChangeCook();
  }

  function confirmCount() {
    const { collect, prep } = buildShift(items, invItems, linePar, today);
    const strip = (rows) => rows.map(({ item: _item, ...rest }) => rest);
    setShift({ date: today, collect: strip(collect), prep: strip(prep), done: {}, meta: {}, confirmedBy: by, confirmedAt: Date.now() });
    setScreen("today");
    onOpened();
  }

  function loadSample() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setInventory({
      closedOn: localDateKey(yesterday),
      closedAt: yesterday.setHours(22, 30, 0, 0),
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
    const row = step.item ? prepRows.find((p) => p.id === step.item.id) : null;
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

  const shared = { station: stationTabs, onOpenChef, screen, setScreen, initials: by, onChangeCook };

  if (items.length === 0) {
    return (
      <div className="pass">
        <PassHeader {...shared}>
          <h1 className="pass__title">{st.name}</h1>
          <p className="pass__lede">No items set up for this station yet.</p>
        </PassHeader>
        <main className="pass__main">
          <section className="pass__gate">
            <p className="pass__hint">The chef adds {st.name}’s items, pans and pars. Once they’re in, this station gets its own close count, gather list, collect and prep.</p>
          </section>
        </main>
        <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
      </div>
    );
  }

  if (openPrepId && shiftIsToday) {
    const row = prepRows.find((p) => p.id === openPrepId);
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

  // Opening shift page for a shift that's already underway: check the
  // count, then carry on (or rebuild the list from a fresh count).
  if (opening && screen === "today" && shiftIsToday) {
    return (
      <CountScreen
        {...shared}
        mode="confirm"
        items={items}
        inventory={invItems}
        today={today}
        closedOnLabel={closeLabel(inventory)}
        closedBy={inventory?.closedBy}
        lastNotes={inventory?.notes}
        underway={{ by: shift.confirmedBy, at: shift.confirmedAt }}
        onChangeItem={changeItem}
        onSubmit={onOpened}
        onRestart={confirmCount}
      />
    );
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
          closedOnLabel={closeLabel(inventory)}
          unclosed={mode === "confirm" && unclosedShift}
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
        short={shiftIsToday ? shift.short ?? {} : {}}
        onShort={setShort}
        cantMake={cantMake}
        gatherDone={shiftIsToday && Boolean(shift.gatherDone)}
        onFinishGather={() => { setShift({ ...shift, gatherDone: true, gatherDoneAt: shift.gatherDoneAt ?? Date.now() }); window.scrollTo(0, 0); }}
        onReopenGather={() => { setShift({ ...shift, gatherDone: false }); window.scrollTo(0, 0); }}
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
