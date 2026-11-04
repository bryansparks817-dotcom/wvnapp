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

// What to pull from the walk-in and dry storage before starting Prep. If
// there isn't enough of something for a full production run, the cook taps
// SHORT: the chef gets an alert and the prep that needs it goes on hold.
// There is no making a smaller batch.
export default function GatherList({ gather, gathered, short, onToggle, onShort }) {
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
              const isShort = Boolean(short[key]);
              return (
                <li key={key}>
                  <div className={`pass__row pass__row--split pass__gatherrow${isDone ? " pass__row--done" : ""}${isShort ? " pass__row--short" : ""}`}>
                    <button type="button" className="pass__checkbtn" aria-pressed={isDone} aria-label={`${isDone ? "Undo" : "Got it"}: ${g.name}`} onClick={() => onToggle(key)}>
                      <CheckBox checked={isDone} tone="amber" />
                    </button>
                    <button type="button" className="pass__rowopen" onClick={() => onToggle(key)}>
                      <span className="pass__rowtext">
                        <span className="pass__rowname">{g.name}</span>
                        {isShort ? (
                          <span className="pass__shortnote">SHORT · CHEF ALERTED · {g.usedIn.join(", ")} on hold</span>
                        ) : (
                          !isDone && <span className="pass__rowsub">for {g.usedIn.join(", ")}</span>
                        )}
                      </span>
                      <span className="pass__mono pass__amber pass__gatheramt">{amount(g)}</span>
                    </button>
                    <button
                      type="button"
                      className={`pass__shortbtn${isShort ? " is-on" : ""}`}
                      aria-pressed={isShort}
                      aria-label={isShort ? `Undo short: ${g.name}` : `Not enough ${g.name} for a full batch. Alert the chef`}
                      onClick={() => onShort(g, !isShort)}
                    >
                      {isShort ? "UNDO" : "SHORT"}
                    </button>
                  </div>
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
