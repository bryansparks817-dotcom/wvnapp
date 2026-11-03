import { useEffect, useMemo, useState } from "react";
import lineData from "../data/lineItems.json";
import { loadEightySix, loadLineDay, saveLineDay } from "../lib/storage";
import { buildPrepPlan, splitCount } from "../lib/lineList";
import TodayScreen from "./TodayScreen";
import CountScreen from "./CountScreen";
import "./pass.css";

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function LineCook({ recipesById, onOpenChef }) {
  const today = localDateKey();
  const [day, setDay] = useState(() => loadLineDay(today));
  const [screen, setScreen] = useState("today");
  const eightySix = useMemo(() => loadEightySix(), []);

  useEffect(() => {
    saveLineDay(day);
  }, [day]);

  const items = lineData.items;
  const { collect, prep } = useMemo(() => splitCount(items, day.entries), [items, day.entries]);
  const plan = useMemo(() => buildPrepPlan(prep, recipesById), [prep, recipesById]);

  function setEntry(itemId, patch) {
    setDay((d) => ({ ...d, entries: { ...d.entries, [itemId]: { ...d.entries[itemId], ...patch } } }));
  }

  function toggleIn(listKey, itemId) {
    setDay((d) => {
      const list = new Set(d[listKey]);
      if (list.has(itemId)) list.delete(itemId);
      else list.add(itemId);
      return { ...d, [listKey]: Array.from(list) };
    });
  }

  const shared = { station: lineData.station, onOpenChef, screen, setScreen };

  if (screen === "count") {
    return (
      <CountScreen
        {...shared}
        items={items}
        entries={day.entries}
        setEntry={setEntry}
        collectCount={collect.length}
        prepCount={prep.length}
        onFinish={() => {
          setDay((d) => ({ ...d, countDone: true }));
          setScreen("today");
        }}
      />
    );
  }

  return (
    <TodayScreen
      {...shared}
      countDone={day.countDone}
      totalItems={items.length}
      eightySix={eightySix}
      collect={collect}
      plan={plan}
      collected={new Set(day.collected)}
      prepped={new Set(day.prepped)}
      onToggleCollected={(id) => toggleIn("collected", id)}
      onTogglePrepped={(id) => toggleIn("prepped", id)}
    />
  );
}
