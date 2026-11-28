import { useEffect, useMemo, useState } from "react";
import { useBack } from "../lib/backNav";
import InstallHint from "./InstallHint";
import { getStations, stationsFor } from "../data/stations";
import {
  loadEightySix, saveEightySix, loadInventory, saveInventory, loadShift, saveShift,
  loadCook, saveCook, loadWaste, saveWaste, loadStaff, saveStaff, loadStation, saveStation, loadChefAlerts, saveChefAlerts, logFlag,
  KEYS, shiftKeyFor, inventoryKeyFor, loadChefSettings,
} from "../lib/storage";
import { onRemoteChange } from "../lib/sync";
import { applyCollect, applyPrep, buildShift, emptyInventory, gramsIn, isLastDay } from "../lib/inventory";
import { withPace, paceFor } from "../lib/pace";
import { buildPrepSteps } from "../lib/lineList";
import { batchGrams, scaleRecipe } from "../lib/recipeScale";
import { gatherForPrep } from "../lib/gatherList";
import { applyShortages } from "../lib/shortage";
import { printLabel } from "../lib/label";
import LabelPrompt from "./LabelPrompt";
import RecipePicker from "./RecipePicker";
import PrepTime from "./PrepTime";
import { prepTime } from "../lib/prepTime";
import { askCheck, prepItemFor, prepStation } from "../lib/prepAsk";
import { withTaskRecipes } from "../lib/prepTasks";
import { bySlot } from "../lib/rail";
import { todayAt } from "../lib/crew";
import { answerRequest, cancelRequest, openRequests, panName, requestPan, setItemPan } from "../lib/panSize";
import { recordShift, shiftRecord } from "../lib/history";
import { activeStaff, checkPin, hasChef, isChef, normalizeName, previewInitials, signIn, validPin } from "../lib/staff";
import TodayScreen from "./TodayScreen";
import CountScreen from "./CountScreen";
import RecipeScreen from "./RecipeScreen";
import { PassHeader, StationTabs, TabBar } from "./Chrome";
import { backupFor, closeNeeds, holdsBackup, lineRequests, linePar as stationLinePar, moveStock, shiftOptions } from "../lib/backupStock";
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
// Tapping a name with a PIN asks for it. Typing a new name is only allowed
// before the chef has set up the staff list (allowNew); newNeedsPin asks the
// new person to pick a PIN (the first chef).
function PinStep({ person, onOk, onBack }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <form
      className="pass__gate"
      onSubmit={(e) => {
        e.preventDefault();
        if (checkPin(person, pin)) onOk();
        else { setWrong(true); setPin(""); }
      }}
    >
      <span className="pass__countlabel">PIN FOR {person.name.toUpperCase()}</span>
      <input
        className="pass__input pass__input--name pass__input--pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        aria-label="PIN"
        autoFocus
        value={pin}
        onChange={(e) => { setWrong(false); setPin(e.target.value.replace(/\D/g, "")); }}
      />
      <p className="pass__hint" aria-live="polite">{wrong ? <span className="chef__late">That PIN doesn’t match. Try again.</span> : "Forgot it? The chef can set a new one in Setup → Staff."}</p>
      <button type="submit" className="pass__cta" disabled={pin.length !== 4}>SIGN IN →</button>
      <button type="button" className="pass__ghost" onClick={onBack}>← Not me</button>
    </form>
  );
}

export function WhoScreen({
  station, roster, onSignIn, title = "Who’s on?", lede = "Your initials go on counts, check-offs and labels today.", cta = "START SHIFT →", extra = null,
  allowNew = true, newNeedsPin = false, emptyHint = "Not on the list? Ask the chef to add you in Setup → Staff.",
}) {
  const [name, setName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [picked, setPicked] = useState(null);
  useBack(() => (picked ? (setPicked(null), true) : false), 3);
  const initials = previewInitials(name, roster);
  const known = roster.find((p) => p.name.toLowerCase() === normalizeName(name).toLowerCase());
  const ok = (normalizeName(name).split(" ").length >= 2 || Boolean(known)) && (!newNeedsPin || known || validPin(newPin));
  return (
    <div className="pass">
      <PassHeader station={station}>
        <h1 className="pass__title">{title}</h1>
        <p className="pass__lede">{lede}</p>
      </PassHeader>
      <main className="pass__main">
        {picked ? (
          <PinStep person={picked} onOk={() => onSignIn(picked.name)} onBack={() => setPicked(null)} />
        ) : (
          <>
            {roster.length > 0 && (
              <section className="pass__roster" aria-label="Staff">
                <span className="pass__countlabel">TAP YOUR NAME</span>
                <div className="pass__rosterlist">
                  {roster.map((p) => (
                    <button key={p.initials} type="button" className="pass__person" onClick={() => (p.pinHash ? setPicked(p) : onSignIn(p.name))}>
                      <span className="pass__personinit">{p.initials}</span>
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {allowNew ? (
              <form
                className="pass__gate"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!ok) return;
                  if (known?.pinHash) setPicked(known);
                  else onSignIn(name, newNeedsPin && !known ? newPin : undefined);
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
                {newNeedsPin && !known && (
                  <>
                    <label className="pass__countlabel" htmlFor="pass-newpin">PICK A 4-DIGIT PIN</label>
                    <input id="pass-newpin" className="pass__input pass__input--name pass__input--pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} />
                  </>
                )}
                <button type="submit" className="pass__cta" disabled={!ok}>{cta}</button>
              </form>
            ) : (
              <p className="pass__hint">{emptyHint}</p>
            )}
          </>
        )}
        {extra}
        {!picked && <InstallHint />}
      </main>
    </div>
  );
}

// Prep's opening page: no count. Its list is what the line stations' closes
// came up short on, plus what they've asked for today.
function PrepStart({ station, screen, setScreen, onOpenChef, initials, onChangeCook, needs, requests, lastNotes, items, onBuild, timeFor }) {
  const [picked, setPicked] = useState([]);
  const time = useMemo(() => timeFor(picked), [timeFor, picked]);
  const rows = needs?.list ?? [];
  const asks = requests.filter((q) => !rows.some((r) => r.stationId === q.stationId && r.itemId === q.itemId));
  return (
    <div className="pass">
      <PassHeader station={station} initials={initials} onChangeCook={onChangeCook}>
        <span className="pass__date">FROM THE LINE’S CLOSES</span>
        <h1 className="pass__title">Prep list</h1>
        <p className="pass__lede">No count for Prep. Your list is what the line stations closed short on. Tick any other recipes you want to make, then build your list.</p>
      </PassHeader>
      <main className="pass__main">
        <PrepTime time={time} />
        {lastNotes?.text && <div className="pass__note"><span className="pass__countlabel">NOTES FROM LAST SHIFT</span><p>{lastNotes.text}</p></div>}
        <section>
          <div className="pass__sectionhead">
            <h2>WHAT THE LINE NEEDS</h2>
            <span className="pass__mono pass__amber">{rows.length + asks.length}</span>
          </div>
          {rows.length + asks.length === 0 && <p className="pass__empty">No line station has closed short on anything Prep makes. Build your list and add recipes by hand.</p>}
          <ul className="pass__list">
            {[...rows, ...asks].map((r, i) => (
              <li key={i} className="pass__row">
                <span className="pass__rowtext">
                  <span className="pass__rowname">{r.name}</span>
                  <span className="pass__rowsub">{r.station}{r.closedBy ? ` close · ${r.closedBy}` : " asked today"}</span>
                </span>
                <span className="pass__mono">{Math.round(r.grams).toLocaleString()} g</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="pass__note">
          <RecipePicker items={items} picked={picked} onChange={setPicked} />
        </section>
      </main>
      <div className="pass__footer">
        <button type="button" className="pass__cta" onClick={() => onBuild(picked)}>BUILD MY LIST{picked.length ? ` (+${picked.length})` : ""} →</button>
      </div>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}

// Prep's end of shift: no count, just notes for the next shift.
function PrepEnd({ station, screen, setScreen, onOpenChef, initials, onChangeCook, notes, onChangeNotes, onEnd }) {
  return (
    <div className="pass">
      <PassHeader station={station} initials={initials} onChangeCook={onChangeCook}>
        <span className="pass__date">END OF SHIFT</span>
        <h1 className="pass__title">End shift</h1>
        <p className="pass__lede">Prep doesn’t count. Leave a note for the next shift if there’s anything to know.</p>
      </PassHeader>
      <main className="pass__main">
        <label className="pass__countlabel" htmlFor="prep-notes">NOTES FOR NEXT SHIFT</label>
        <textarea id="prep-notes" className="pass__input pass__notes" rows={4} value={notes} onChange={(e) => onChangeNotes(e.target.value)} />
      </main>
      <div className="pass__footer">
        <button type="button" className="pass__cta" onClick={onEnd}>END SHIFT</button>
      </div>
      <TabBar screen={screen} setScreen={setScreen} onOpenChef={onOpenChef} />
    </div>
  );
}

// Sign-in and station choice. Each station's counts and shift live in their
// own StationLine, which remounts when the station changes.
export default function LineCook(props) {
  const today = localDateKey();
  const [cook, setCook] = useState(() => loadCook());
  const [staff, setStaff] = useState(() => loadStaff());
  // The chef's station setup can change on another phone: re-read it.
  const [, setSetupVersion] = useState(0);
  useEffect(() => onRemoteChange((keys) => {
    if (keys.includes(KEYS.STAFF)) setStaff(loadStaff());
    if (keys.includes(KEYS.STATIONS)) setSetupVersion((v) => v + 1);
  }), []);
  const [stationId, setStationId] = useState(() => loadStation() ?? getStations()[0].id);
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
        roster={activeStaff(staff)}
        allowNew={!hasChef(staff)}
        extra={<button type="button" className="pass__ghost" onClick={props.onOpenChef}>Chef? Open the chef view ›</button>}
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
  const chefOnLine = isChef(person);
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
      isChef={chefOnLine}
      onSetupChanged={() => setSetupVersion((v) => v + 1)}
    />
  );
}

function StationLine({ station: st, stationTabs, by, opening, onOpened, onChangeCook, recipesById: libraryById, ingredients, onOpenChef, timers, onStartTimer, isChef: chefHere = false, onSetupChanged }) {
  const today = localDateKey();
  // Prep tasks (shaved garlic…) get one-step stand-in recipes (lib/prepTasks.js).
  const recipesById = useMemo(() => withTaskRecipes(libraryById, getStations()), [libraryById, st]);
  // A railed station (Garde: 5 hotel pans wide) counts slot 1 to 5.
  const items = useMemo(() => bySlot(st.items, st), [st]);
  const linePar = stationLinePar(st);
  const isBackup = holdsBackup(st);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [inventory, setInventory] = useState(() => loadInventory(st.id));
  const [shift, setShift] = useState(() => loadShift(st.id));
  const [waste, setWaste] = useState(() => loadWaste());
  const [flags, setFlags] = useState(() => loadEightySix());
  // Another phone (the chef, or a cook on the same station) changed this
  // station's shift or count, the waste log or the 86 board.
  useEffect(() => onRemoteChange((keys) => {
    if (keys.includes(shiftKeyFor(st.id))) setShift(loadShift(st.id));
    if (keys.includes(inventoryKeyFor(st.id))) setInventory(loadInventory(st.id));
    if (keys.includes(KEYS.WASTE)) setWaste(loadWaste());
    if (keys.includes(KEYS.EIGHTY_SIX)) setFlags(loadEightySix());
  }), [st.id]);
  // Prep: what line stations still need from its stock today. Re-read when
  // any station's shift changes.
  const [reqVersion, setReqVersion] = useState(0);
  // Line stations re-read too, for where their asks to Prep stand.
  useEffect(() => onRemoteChange((keys) => { if (keys.some((k) => k.startsWith("thePass.shift.v1") || k.startsWith("thePass.inventory.v1"))) setReqVersion((v) => v + 1); }), []);
  const requests = useMemo(() => (isBackup && reqVersion >= 0 ? lineRequests(st, getStations(), today).list : []), [isBackup, st, today, reqVersion]);
  // Prep doesn't count: its list comes from the line stations' closes.
  const needs = useMemo(() => (isBackup && reqVersion >= 0 ? closeNeeds(st, getStations()) : null), [isBackup, st, reqVersion]);
  // How each item is counted: Prep counts backup only; a line station's
  // collect-only item is just its line pan (Prep counts the backup).
  const cardMode = (item) => (isBackup ? "backup" : item.madeAt && backupFor(getStations())(item) ? "line" : "full");
  const [panReqs, setPanReqs] = useState(() => openRequests());
  useEffect(() => onRemoteChange((keys) => { if (keys.includes(KEYS.PAN_REQUESTS)) setPanReqs(openRequests()); }), []);
  // Pan size: the chef changes it, a cook asks for it.
  const panFor = (item) => ({
    isChef: chefHere,
    request: panReqs.find((r) => r.stationId === st.id && r.itemId === item.id) ?? null,
    onPick: (pan) => {
      if (chefHere) { setItemPan(st.id, item.id, pan); onSetupChanged?.(); }
      else requestPan({ stationId: st.id, stationName: st.name, item, pan, by });
      setPanReqs(openRequests());
    },
    onCancel: () => {
      const r = panReqs.find((x) => x.stationId === st.id && x.itemId === item.id);
      if (r) cancelRequest(r.id);
      setPanReqs(openRequests());
    },
    onAnswer: (approve) => {
      const r = panReqs.find((x) => x.stationId === st.id && x.itemId === item.id);
      if (r) answerRequest(r, approve, by);
      if (approve) onSetupChanged?.();
      setPanReqs(openRequests());
    },
  });
  const [screen, setScreen] = useState("today");
  const [openPrepId, setOpenPrepId] = useState(null);
  // Prep item just finished: offer its label, which the cook can skip.
  const [labelPromptId, setLabelPromptId] = useState(null);
  // Phone back: close an open recipe, then go back to Today.
  useBack(() => {
    if (openPrepId) { setOpenPrepId(null); return true; }
    if (screen !== "today") { setScreen("today"); return true; }
    return false;
  }, 2);

  useEffect(() => { if (inventory) saveInventory(inventory, st.id); }, [inventory, st.id]);
  useEffect(() => { if (shift) saveShift(shift, st.id); }, [shift, st.id]);
  useEffect(() => { saveWaste(waste); }, [waste]);
  useEffect(() => { saveEightySix(flags); }, [flags]);

  // Items the chef added since the last count start empty.
  const invItems = useMemo(() => ({ ...emptyInventory(items), ...(inventory?.items ?? {}) }), [inventory, items]);
  // Counts are taken at the end of every shift, not once a day. A shift runs
  // from confirming a count to the next close count; the close ends it, and
  // the next shift (same day or not) starts by confirming that count.
  const shiftIsToday = Boolean(shift && !shift.closedAt && shift.date === today);
  const unclosedShift = Boolean(shift && !shift.closedAt && shift.date !== today);
  useEffect(() => { if (isBackup && opening && shiftIsToday) onOpened(); }, [isBackup, opening, shiftIsToday, onOpened]);
  const meta = shiftIsToday ? shift.meta ?? {} : {};

  // Prep as planned from the count, and as scaled down by any short
  // ingredient (see lib/shortage.js).
  // Items the chef took off today's list are left out (shift.skip).
  const activePrep = useMemo(() => (shiftIsToday ? shift.prep.filter((p) => !shift.skip?.[p.id] && !shift.askPrep?.[p.id]) : []), [shift, shiftIsToday]);
  const fullPrep = useMemo(() => activePrep.filter((p) => p.makeG > 0), [activePrep]);
  const prepRows = useMemo(() => (shiftIsToday ? applyShortages(activePrep, shift.short) : []), [activePrep, shift, shiftIsToday]);
  const prepForPlan = useMemo(() => prepRows.filter((p) => p.makeG > 0), [prepRows]);
  const cantMake = useMemo(() => prepRows.filter((p) => p.plannedG > 0 && p.makeG === 0), [prepRows]);
  const bump = shiftIsToday ? shift.bump ?? null : null;
  // Planned at the cook's real speed when the chef has set one (lib/pace.js).
  const cookOnShift = shiftIsToday ? shift.confirmedBy : null;
  const pacedRecipes = useMemo(() => withPace(recipesById, paceFor(cookOnShift)), [recipesById, cookOnShift]);
  const plan = useMemo(() => buildPrepSteps(prepForPlan, pacedRecipes, { first: bump }), [prepForPlan, pacedRecipes, bump]);
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
    // The shift goes into the history the chef's Data tab learns from.
    if (shiftIsToday) recordShift(shiftRecord({ station: st, shift, plan, rows: prepRows, closedAt }));
    // Saved right away: signing the cook out below unmounts this station.
    saveInventory(nextInv, st.id);
    if (nextShift) saveShift(nextShift, st.id);
    setInventory(nextInv);
    setShift(nextShift);
    setScreen("today");
    // The shift is over: the next cook signs in and confirms this count.
    onChangeCook();
  }

  // Prep: build the list from the line closes (no count), plus anything the
  // line has already asked for today that the closes don't cover.
  function buildFromCloses(extra = []) {
    const fresh = closeNeeds(st, getStations());
    const asked = Object.fromEntries(fresh.list.map((q) => [`${q.stationId}:${q.itemId}`, q.grams]));
    const byItem = { ...fresh.byItem };
    for (const q of lineRequests(st, getStations(), today).list) {
      const key = `${q.stationId}:${q.itemId}`;
      const extra = Math.max(0, q.grams - (asked[key] ?? 0));
      if (!extra) continue;
      asked[key] = q.grams;
      byItem[q.itemId] = (byItem[q.itemId] ?? 0) + extra;
    }
    const prep = items
      .filter((i) => byItem[i.id] > 0)
      .map((i) => {
        const makeG = Math.ceil(byItem[i.id] / 50) * 50;
        return { id: i.id, recipeId: i.recipeId, name: i.name, makeG, toss: [], askedG: makeG };
      });
    setShift(withAdded({ date: today, collect: [], prep, done: {}, meta: {}, confirmedBy: by, confirmedAt: Date.now(), asked, fromCloses: fresh.list }, extra));
    setReqVersion((v) => v + 1);
    setScreen("today");
    onOpened();
  }

  // Prep: the optimized prep time (start to finish, hands-off overlapping)
  // and the hands-on part, for a list.
  const timeOf = (rows, progress = null) => prepTime(rows, pacedRecipes, progress);
  const previewTime = (picked) => {
    const byItem = { ...(needs?.byItem ?? {}) };
    for (const q of requests) if (!(needs?.list ?? []).some((r) => r.stationId === q.stationId && r.itemId === q.itemId)) byItem[q.itemId] = (byItem[q.itemId] ?? 0) + q.grams;
    const rows = items.filter((i) => byItem[i.id] > 0).map((i) => ({ id: i.id, recipeId: i.recipeId, name: i.name, makeG: Math.ceil(byItem[i.id] / 50) * 50, toss: [] }));
    return timeOf(withAdded({ prep: rows }, picked).prep);
  };

  // Prep: the cook adds recipes to the list by hand, one batch each.
  function batchFor(item) {
    const recipe = item.recipeId ? recipesById.get(item.recipeId) : null;
    return recipe ? Math.round(batchGrams(recipe, recipesById, ingredients).grams || recipe.yieldGrams || 1000) : 1000;
  }
  function withAdded(sh, picked) {
    let prep = sh.prep;
    const skip = { ...(sh.skip ?? {}) };
    for (const item of picked) {
      const batch = batchFor(item);
      delete skip[item.id];
      prep = prep.some((p) => p.id === item.id)
        ? prep.map((p) => (p.id === item.id ? { ...p, makeG: p.makeG + batch, addedG: (p.addedG ?? 0) + batch } : p))
        : [...prep, { id: item.id, recipeId: item.recipeId, name: item.name, makeG: batch, toss: [], addedG: batch, addedBy: by }];
    }
    return { ...sh, prep, skip };
  }
  function addRecipes(picked) {
    if (!picked.length) return;
    setShift(withAdded(shift, picked));
    window.scrollTo(0, 0);
  }

  function confirmCount() {
    if (isBackup) { buildFromCloses(); return; }
    const { collect, prep } = buildShift(items, invItems, linePar, today, shiftOptions(st, getStations(), today));
    const strip = (rows) => rows.map(({ item: _item, ...rest }) => rest);
    // Prep: the line requests this list already covers.
    const asked = isBackup ? Object.fromEntries(lineRequests(st, getStations(), today).list.map((q) => [`${q.stationId}:${q.itemId}`, q.grams])) : undefined;
    setShift({ date: today, collect: strip(collect), prep: strip(prep), done: {}, meta: {}, confirmedBy: by, confirmedAt: Date.now(), ...(asked ? { asked } : {}) });
    setReqVersion((v) => v + 1);
    setScreen("today");
    onOpened();
  }

  // Checking a row applies it to inventory; unchecking restores that item.
  function toggleDone(kind, row, stepsDone = shift.stepsDone) {
    const key = `${kind}:${row.id}`;
    // A one-off item the chef added: no pan or par, so just mark it done.
    if (row.extra) {
      const done = { ...shift.done };
      const nextMeta = { ...meta };
      if (done[key]) {
        delete done[key];
        delete nextMeta[key];
      } else {
        done[key] = true;
        nextMeta[key] = { by, at: Date.now(), labels: null };
      }
      setShift({ ...shift, stepsDone, done, meta: nextMeta });
      return;
    }
    const item = itemsById.get(row.id);
    if (shift.done[key]) {
      const snapshot = shift.done[key];
      if (kind === "c" && row.from) moveStock({ ...row, toLine: meta[key]?.pulled ?? row.toLine }, true);
      setInventory((inv) => ({ ...(inv ?? {}), items: { ...(inv?.items ?? emptyInventory(items)), [row.id]: snapshot } }));
      const done = { ...shift.done };
      const nextMeta = { ...meta };
      for (const k of [`c:${row.id}`, `p:${row.id}`]) {
        delete done[k];
        delete nextMeta[k];
      }
      setShift({ ...shift, stepsDone, done, meta: nextMeta });
      setWaste((w) => w.filter((e) => e.key !== `${today}:${row.id}`));
      if (labelPromptId === row.id) setLabelPromptId(null);
      return;
    }
    const before = invItems[row.id];
    const at = Date.now();
    let labels = null;
    let pulled;
    let shortAfter;
    let after;
    if (kind === "c") {
      if (row.from) {
        // Pull from Prep's stock as it is now: Prep may have made more since
        // this list was built.
        const live = buildShift([item], { [row.id]: before }, linePar, today, { backupFor: backupFor(getStations()) }).collect[0];
        pulled = live?.toLine ?? [];
        shortAfter = live?.shortG ?? 0;
        const liveRow = { ...row, toLine: pulled };
        after = applyCollect(before, liveRow, linePar);
        moveStock(liveRow);
      } else {
        after = applyCollect(before, { ...row, item, today }, linePar);
      }
    } else {
      after = applyPrep(item, before, row, linePar, today);
      const kept = before.lowboy.filter((c) => c.fill > 0 && !isLastDay(item, c.madeOn, today)).length;
      const added = after.lowboy.slice(kept).map((c) => ({ size: c.size, grams: gramsIn(item, c) }));
      const lineG = ((after.line - before.line) / 100) * item.panGrams;
      labels = [...(lineG > 0 ? [{ size: panName(item.pan), grams: lineG }] : []), ...added];
      if (row.toss.length) {
        const tossG = row.toss.reduce((s, t) => s + gramsIn(item, t), 0);
        setWaste((w) => [
          ...w,
          { key: `${today}:${row.id}`, date: today, itemId: row.id, name: item.name, grams: tossG, reason: "shelf life", by, at },
        ]);
      }
    }
    setInventory((inv) => ({ ...(inv ?? {}), items: { ...(inv?.items ?? emptyInventory(items)), [row.id]: after } }));
    setShift({ ...shift, stepsDone, done: { ...shift.done, [key]: before }, meta: { ...meta, [key]: { by, at, labels, ...(pulled ? { pulled, shortAfter } : {}) } } });
    if (labels?.length) setLabelPromptId(row.id);
  }

  // Prep: a line station asked for more after the list was built. Add it to
  // that item's batch (or a new row) without rebuilding the list.
  function addRequest(q) {
    const key = `${q.stationId}:${q.itemId}`;
    const extraG = Math.max(0, q.grams - (shift.asked?.[key] ?? 0));
    if (!extraG) return;
    const item = itemsById.get(q.itemId);
    const has = shift.prep.find((p) => p.id === q.itemId);
    const prep = has
      ? shift.prep.map((p) => (p.id === q.itemId ? { ...p, makeG: p.makeG + extraG, askedG: (p.askedG ?? 0) + extraG } : p))
      : [...shift.prep, { id: item.id, recipeId: item.recipeId, name: item.name, makeG: extraG, toss: [], askedG: extraG }];
    // A line cook's ask comes with what to bump to tomorrow to make room.
    const skip = { ...(shift.skip ?? {}) };
    const bumped = { ...(shift.bumped ?? {}) };
    for (const b of q.bump ?? []) {
      if (shift.done?.[`p:${b.id}`]) continue;
      skip[b.id] = true;
      bumped[b.id] = { name: b.name, for: q.station, item: q.name, at: Date.now() };
    }
    setShift({ ...shift, prep, skip, bumped, asked: { ...(shift.asked ?? {}), [key]: q.grams } });
  }

  // Line station: ask Prep to take one of this list's prep items.
  const canAsk = (row) => !isBackup && Boolean(prepItemFor(row, getStations()));
  const checkAsk = (row) => askCheck({ row, stations: getStations(), recipesById, today, prepDueAt: todayAt(loadChefSettings().prepDueAt) });
  function sendAsk(row, check) {
    setShift({ ...shift, askPrep: { ...(shift.askPrep ?? {}), [row.id]: { prepItemId: check.prepItem.id, name: row.name, grams: row.makeG, bump: check.bump, by, at: Date.now() } } });
  }
  function cancelAsk(id) {
    const askPrep = { ...(shift.askPrep ?? {}) };
    delete askPrep[id];
    setShift({ ...shift, askPrep });
  }
  // Where each ask stands, from Prep's shift.
  const prepSh = !isBackup && shiftIsToday && Object.keys(shift.askPrep ?? {}).length ? loadShift(prepStation(getStations())?.id) : null;
  const asks = shiftIsToday ? Object.entries(shift.askPrep ?? {}).map(([id, a]) => {
    const row = shift.prep.find((p) => p.id === id);
    const live = prepSh && !prepSh.closedAt && prepSh.date === today ? prepSh : null;
    const taken = (live?.asked?.[`${st.id}:${a.prepItemId}`] ?? 0) >= a.grams;
    const made = Boolean(live?.done?.[`p:${a.prepItemId}`]);
    return { id, row, ...a, taken, made, got: Boolean(shift.done[`p:${id}`]) };
  }).filter((a) => a.row) : [];

  function printPrepLabel(id) {
    const key = `p:${id}`;
    printLabel({ item: itemsById.get(id), madeOn: today, madeAt: meta[key]?.at, by: meta[key]?.by, containers: meta[key]?.labels ?? [] });
  }

  const promptItem = labelPromptId && shiftIsToday && shift.done[`p:${labelPromptId}`] ? itemsById.get(labelPromptId) : null;
  const labelSheet = promptItem ? (
    <LabelPrompt
      name={promptItem.name}
      count={meta[`p:${labelPromptId}`]?.labels?.length ?? 0}
      onPrint={() => { printPrepLabel(labelPromptId); setLabelPromptId(null); }}
      onSkip={() => setLabelPromptId(null)}
    />
  ) : null;

  // Prep's shift start (Bryan, 2026-11-27): START PREP on the time box, or,
  // if they skip it, the cook's first check-off, backdated to when that task
  // would have started (the tick minus its hands-on time; for a QUICK FINISH,
  // the item's whole hands-on time). The done-time math counts from it.
  useEffect(() => {
    if (!isBackup || !shiftIsToday || shift.startedAt) return;
    const minutesBefore = [];
    for (const [part, at] of Object.entries(shift.stepsDone ?? {})) {
      if (typeof at !== "number") continue;
      const step = plan.steps.find((s) => s.parts?.includes(part));
      minutesBefore.push(at - (step?.handsOn ?? 0) * 60000);
    }
    for (const k of Object.keys(shift.done ?? {})) {
      const at = shift.meta?.[k]?.at;
      if (!at || !k.startsWith("p:")) continue;
      const id = k.slice(2);
      const handsOn = plan.steps.filter((s) => s.item?.id === id && !s.parts?.some((p) => shift.stepsDone?.[p])).reduce((sum, s) => sum + (s.handsOn ?? 0), 0);
      minutesBefore.push(at - handsOn * 60000);
    }
    if (minutesBefore.length) setShift({ ...shift, startedAt: Math.round(Math.min(...minutesBefore)), startedBy: by, startedFrom: "first check-off" });
  }, [shift, isBackup, shiftIsToday, by, plan]);

  // Ticks one step of the prep list. Ticking an item's last step checks the
  // item off (restock + labels); unticking it undoes that.
  function toggleStep(step, isDone) {
    const row = step.item ? prepRows.find((p) => p.id === step.item.id) : null;
    const itemDone = Boolean(row && shift.done[`p:${row.id}`]);
    const stepsDone = { ...(shift.stepsDone ?? {}) };
    for (const p of step.parts) {
      if (isDone) delete stepsDone[p];
      else stepsDone[p] = Date.now(); // when it was ticked, for the chef's Data tab
    }
    const finishes = !isDone && step.lastForItem && !itemDone;
    const reopens = isDone && itemDone;
    if (row && (finishes || reopens)) toggleDone("p", row, stepsDone);
    else setShift({ ...shift, stepsDone });
  }

  function addFlag(name, kind) {
    setFlags((f) => [...f.filter((x) => x.name !== name), { name, kind, by, at: Date.now() }]);
    logFlag({ date: today, name, kind, by, at: Date.now(), station: st.id });
  }

  const shared = { station: stationTabs, onOpenChef, screen, setScreen, initials: by, onChangeCook, linePar };

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
            onPrintLabel={row.extra ? null : () => printPrepLabel(row.id)}
          />
          {labelSheet}
        </>
      );
    }
  }

  // Opening shift page for a shift that's already underway: check the
  // count, then carry on (or rebuild the list from a fresh count).
  if (opening && screen === "today" && shiftIsToday && !isBackup) {
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
        panFor={panFor}
        cardMode={cardMode}
        onSubmit={onOpened}
        onRestart={confirmCount}
      />
    );
  }

  // Before a shift starts, Today is the count: the last close carried over,
  // or, for a station that has never been closed, every item at zero so the
  // cook can count what's there and build the first list.
  if (isBackup && screen === "today" && !shiftIsToday) {
    return <PrepStart {...shared} station={stationTabs} needs={needs} requests={requests} lastNotes={inventory?.notes} items={items} onBuild={buildFromCloses} timeFor={previewTime} />;
  }
  if (isBackup && screen === "close") {
    return <PrepEnd {...shared} notes={inventory?.draftNotes ?? ""} onChangeNotes={changeNotes} onEnd={saveClose} />;
  }

  if (screen === "close" || (screen === "today" && !shiftIsToday)) {
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
          firstCount={mode === "confirm" && !inventory?.closedOn}
          closedBy={inventory?.closedBy}
          notes={mode === "close" ? inventory?.draftNotes ?? "" : null}
          lastNotes={inventory?.notes}
          onChangeNotes={changeNotes}
          onChangeItem={changeItem}
          panFor={panFor}
          cardMode={cardMode}
          onSubmit={mode === "close" ? saveClose : confirmCount}
        />
      </>
    );
  }

  return (
    <>
      <TodayScreen
        {...shared}
        lastNotes={inventory?.notes}
        flags={flags}
        onAddFlag={addFlag}
        onRemoveFlag={(name) => setFlags((f) => f.filter((x) => x.name !== name))}
        items={items}
        itemsById={itemsById}
        today={today}
        collect={shiftIsToday ? shift.collect : []}
        tossOnly={activePrep.filter((p) => p.makeG === 0)}
        chefNotes={shiftIsToday ? shift.chef ?? [] : []}
        bump={shiftIsToday ? shift.bump ?? null : null}
        onAckChef={(id) => setShift({ ...shift, chef: (shift.chef ?? []).map((m) => (m.id === id ? { ...m, seenAt: Date.now() } : m)) })}
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
        lineRequests={requests}
        asked={shiftIsToday ? shift.asked ?? {} : {}}
        onAddRequest={(q) => addRequest(q)}
        canAsk={canAsk}
        checkAsk={checkAsk}
        onSendAsk={sendAsk}
        onCancelAsk={cancelAsk}
        asks={asks}
        bumped={isBackup && shiftIsToday ? shift.bumped ?? {} : {}}
        madeToday={(id) => Boolean(shiftIsToday && shift.done[`p:${id}`])}
        addable={isBackup && shiftIsToday ? items : null}
        onAddRecipe={addRecipes}
        timeWith={(picked) => timeOf(withAdded({ prep: prepRows }, picked).prep)}
        prepTime={isBackup ? timeOf(prepRows, shiftIsToday ? { done: shift.done ?? {}, stepsDone: shift.stepsDone ?? {} } : null) : null}
        prepStartAt={shiftIsToday ? shift.startedAt ?? null : null}
        prepStartNote={shiftIsToday && shift.startedFrom ? "backdated from first check-off" : null}
        onStartPrep={isBackup && shiftIsToday && !shift.startedAt ? () => setShift({ ...shift, startedAt: Date.now(), startedBy: by }) : null}
        isPrep={isBackup}
      />
      {labelSheet}
    </>
  );
}
