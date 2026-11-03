import { CheckBox } from "./Chrome";
import zoneData from "../data/storageZones.json";
import { groupByZone } from "../lib/gatherList";

function amount(entry) {
  const parts = [];
  if (entry.grams > 0) {
    parts.push(entry.grams >= 1000 ? `${(entry.grams / 1000).toFixed(entry.grams >= 10000 ? 1 : 2).replace(/\.?0+$/, "")} kg` : `${Math.max(1, Math.round(entry.grams))} g`);
  }
  for (const o of entry.other) parts.push(`${Math.round(o.qty * 100) / 100} ${o.unit}`);
  return parts.join(" + ");
}

// What to pull from the walk-in and dry storage before starting Prep.
export default function GatherList({ gather, gathered, onToggle }) {
  if (gather.items.length === 0 && gather.missing.length === 0) return <p className="pass__empty">Nothing to gather.</p>;
  return (
    <>
      {groupByZone(gather.items, zoneData).map((zone) => (
        <div key={zone.id} className="pass__zone">
          <div className="pass__zonehead">
            <span className="pass__zonename">{zone.name.toUpperCase()}</span>
            <span className="pass__zonearea">{zone.area} · {zone.items.filter((g) => gathered[g.name.toLowerCase()]).length}/{zone.items.length}</span>
          </div>
          <ul className="pass__list pass__gatherlist">
            {zone.items.map((g) => {
              const key = g.name.toLowerCase();
              const isDone = Boolean(gathered[key]);
              return (
                <li key={key}>
                  <button type="button" aria-pressed={isDone} className={`pass__row pass__gatherrow${isDone ? " pass__row--done" : ""}`} onClick={() => onToggle(key)}>
                    <CheckBox checked={isDone} tone="amber" />
                    <span className="pass__rowtext">
                      <span className="pass__rowname">{g.name}</span>
                      {!isDone && <span className="pass__rowsub">for {g.usedIn.join(", ")}</span>}
                    </span>
                    <span className="pass__mono pass__amber pass__gatheramt">{amount(g)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {gather.missing.length > 0 && (
        <p className="pass__hint">No recipe in the app yet for {gather.missing.map((m) => m.name).join(", ")}. Gather for those from the recipe book.</p>
      )}
    </>
  );
}
