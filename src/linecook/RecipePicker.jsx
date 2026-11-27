import { useState } from "react";
import { CheckBox } from "./Chrome";

// Prep: tick as many recipes as you like. Each one ticked is one batch.
export default function RecipePicker({ items, picked, onChange }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const ids = new Set(picked.map((i) => i.id));
  const sorted = items.slice().sort((a, b) => a.name.localeCompare(b.name));
  const shown = term ? sorted.filter((i) => i.name.toLowerCase().includes(term)) : sorted;
  const toggle = (i) => onChange(ids.has(i.id) ? picked.filter((p) => p.id !== i.id) : [...picked, i]);
  return (
    <>
      <span className="pass__countlabel">ADD RECIPES · ONE BATCH EACH{picked.length ? ` · ${picked.length} PICKED` : ""}</span>
      <input className="pass__input" type="search" placeholder={`Find a recipe… (${items.length})`} aria-label="Find a recipe" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="pass__list pass__pickerlist">
        {shown.map((i) => {
          const on = ids.has(i.id);
          return (
            <li key={i.id}>
              <button type="button" aria-pressed={on} className={`pass__row${on ? " pass__row--picked" : ""}`} onClick={() => toggle(i)}>
                <CheckBox checked={on} />
                <span className="pass__rowtext"><span className="pass__rowname">{i.name}</span></span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
