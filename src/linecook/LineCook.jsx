import { useEffect, useMemo, useState } from "react";
import lineData from "../data/lineItems.json";
import { loadEightySix, loadInventory, saveInventory, loadShift, saveShift } from "../lib/storage";
import { applyCollect, applyPrep, buildShift, emptyInventory, sampleInventory } from "../lib/inventory";
import { buildPrepPlan } from "../lib/lineList";
import TodayScreen from "./TodayScreen";
import CountScreen from "./CountScreen";
import "./pass.css";

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
function dayName(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

export default function LineCook({ recipesById, onOpenChef }) {
  const today = localDateKey();
  const { items, linePar, station } = lineData;
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [inventory, setInventory] = useState(() => loadInventory());
  const [shift, setShift] = useState(() => loadShift());
  const [screen, setScreen] = useState("today");
  const eightySix = useMemo(() => loadEightySix(), []);

  useEffect(() => {
    if (inventory) saveInventory(inventory);
  }, [inventory]);
  useEffect(() => {
    if (shift) saveShift(shift);
  }, [shift]);

  const invItems = inventory?.items ?? emptyInventory(items);
  const shiftIsToday = shift?.date === today;

  const prepForPlan = useMemo(
    () => (shiftIsToday ? shift.prep.filter((p) => p.makeG > 0) : []),
    [shift, shiftIsToday]
  );
  const plan = useMemo(() => buildPrepPlan(prepForPlan, recipesById), [prepForPlan, recipesById]);

  function changeItem(id, next) {
    setInventory((inv) => ({ closedOn: inv?.closedOn ?? null, items: { ...(inv?.items ?? emptyInventory(items)), [id]: next } }));
  }

  function saveClose() {
    setInventory((inv) => ({ ...inv, items: inv?.items ?? emptyInventory(items), closedOn: today }));
    setScreen("today");
  }

  function confirmCount() {
    const { collect, prep } = buildShift(items, invItems, linePar, today);
    // Plain data only, so it survives a reload.
    const strip = (rows) => rows.map(({ item: _item, ...rest }) => rest);
    setShift({ date: today, collect: strip(collect), prep: strip(prep), done: {} });
    setScreen("today");
  }

  function loadSample() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setInventory({ closedOn: localDateKey(yesterday), items: sampleInventory(items, today) });
    setShift(null);
  }

  // Checking a row applies it to inventory; unchecking restores that item.
  function toggleDone(kind, row) {
    const key = `${kind}:${row.id}`;
    const item = itemsById.get(row.id);
    if (shift.done[key]) {
      const snapshot = shift.done[key];
      setInventory((inv) => ({ ...inv, items: { ...inv.items, [row.id]: snapshot } }));
      const done = { ...shift.done };
      delete done[`c:${row.id}`];
      delete done[`p:${row.id}`];
      setShift({ ...shift, done });
      return;
    }
    const before = invItems[row.id];
    const after = kind === "c" ? applyCollect(before, row, linePar) : applyPrep(item, before, row, linePar, today);
    setInventory((inv) => ({ ...inv, items: { ...inv.items, [row.id]: after } }));
    setShift({ ...shift, done: { ...shift.done, [key]: before } });
  }

  const shared = { station, onOpenChef, screen, setScreen };

  if (screen === "close" || (screen === "today" && inventory?.closedOn && !shiftIsToday)) {
    const mode = screen === "close" ? "close" : "confirm";
    return (
      <CountScreen
        {...shared}
        mode={mode}
        items={items}
        inventory={invItems}
        today={today}
        closedOnLabel={inventory?.closedOn ? dayName(inventory.closedOn) : ""}
        onChangeItem={changeItem}
        onSubmit={mode === "close" ? saveClose : confirmCount}
      />
    );
  }

  return (
    <TodayScreen
      {...shared}
      hasClose={Boolean(inventory?.closedOn)}
      eightySix={eightySix}
      itemsById={itemsById}
      today={today}
      collect={shiftIsToday ? shift.collect : []}
      tossOnly={shiftIsToday ? shift.prep.filter((p) => p.makeG === 0) : []}
      plan={plan}
      done={shiftIsToday ? shift.done : {}}
      onToggle={toggleDone}
      onLoadSample={loadSample}
    />
  );
}
