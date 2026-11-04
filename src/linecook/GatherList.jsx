import { useState } from "react";
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

const grams = (g) => `${Math.round(g).toLocaleString()} g`;

// Asks how much of a short ingredient is on hand.
function ShortForm({ entry, onSend, onCancel }) {
  const [have, setHave] = useState("");
  const value = Number(have);
  const ok = have !== "" && value >= 0 && value < entry.grams;
  return (
    <form
      className="pass__shortform"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSend(value);
      }}
    >
      <label className="pass__countlabel" htmlFor={`have-${entry.name}`}>HOW MUCH {entry.name.toUpperCase()} IS ON HAND? (needs {grams(entry.grams)})</label>
      <div className="pass__shortinputs">
        <input id={`have-${entry.name}`} className="pass__input" type="number" inputMode="decimal" min="0" step="1" value={have} placeholder="0" onChange={(e) => setHave(e.target.value)} autoFocus />
        <span className="pass__mono">g</span>
        <button type="submit" className="pass__shortsend" disabled={!ok}>SCALE DOWN &amp; ALERT CHEF</button>
        <button type="button" className="pass__ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// What to pull from the walk-in and dry storage before starting Prep. If
// there isn't enough of something for a full production run, the cook taps
// SHORT and enters what's on hand: The Pass scales every item that uses it
// down to match (the lowest ingredient sets the batch), the rest of this list
// shrinks with it, and the chef gets a message naming the ingredient.
export default function GatherList({ gather, gathered, short, onToggle, onShort }) {
  const [asking, setAsking] = useState(null);
  if (gather.items.length === 0 && gather.missing.length === 0 && Object.keys(short).length === 0) {
    return <p className="pass__empty">Nothing to gather.</p>;
  }
  // An ingredient so short that nothing can be made drops off the list; keep
  // it visible so the flag can be undone.
  const shown = [...gather.items];
  for (const [key, s] of Object.entries(short)) {
    if (!shown.some((g) => g.name.toLowerCase() === key)) shown.push({ name: s.name, grams: 0, other: [], usedIn: s.items });
  }
  return (
    <>
      {groupByZone(shown, zoneData).map((zone) => (
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
                          <span className="pass__shortnote">SHORT · {grams(short[key].haveG)} of {grams(short[key].needG)} · {short[key].items.join(", ")} scaled down · chef alerted</span>
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
                      aria-label={isShort ? `Undo short: ${g.name}` : `Not enough ${g.name} for a full batch`}
                      onClick={() => (isShort ? onShort(g, null) : setAsking(asking === key ? null : key))}
                    >
                      {isShort ? "UNDO" : "SHORT"}
                    </button>
                    {asking === key && !isShort && (
                      <ShortForm
                        entry={g}
                        onSend={(haveG) => {
                          onShort(g, haveG);
                          setAsking(null);
                        }}
                        onCancel={() => setAsking(null)}
                      />
                    )}
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
