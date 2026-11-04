import { useEffect, useState } from "react";
import { loadDailyNumbers, saveDailyNumbers } from "../lib/storage";
import { rolling, sampleWeek } from "../lib/numbers";

const pct = (v) => (v == null ? "—" : `${v.toFixed(1)}%`);
const money = (v) => `$${Math.round(v).toLocaleString()}`;

// Change vs the 7 days before. For costs, down is good.
function Delta({ now, before }) {
  if (now == null || before == null) return <span className="chef__delta">&nbsp;</span>;
  const d = now - before;
  if (Math.abs(d) < 0.05) return <span className="chef__delta">even w/w</span>;
  return (
    <span className={`chef__delta ${d > 0 ? "is-up" : "is-down"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)} pts w/w
    </span>
  );
}

const FIELDS = [
  ["sales", "SALES $"],
  ["food", "FOOD PURCHASES $"],
  ["labor", "LABOR $"],
];

// The chef's numbers: 7-day rolling food and labor cost as % of sales.
export default function Numbers({ today }) {
  const [daily, setDaily] = useState(() => loadDailyNumbers());
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(today);
  useEffect(() => { saveDailyNumbers(daily); }, [daily]);

  const week = rolling(daily, today);
  const prior = rolling(daily, today, 7, 7);
  const entry = daily[day] ?? {};
  const setField = (f, v) => setDaily({ ...daily, [day]: { ...entry, [f]: v === "" ? undefined : Number(v) } });

  return (
    <section className="chef__numbers" aria-label="7-day numbers">
      <div className="pass__sectionhead">
        <h2>Last 7 days</h2>
        <span className="pass__countlabel">
          {week.days ? `${week.days} DAY${week.days === 1 ? "" : "S"} IN · ${money(week.sales)} SALES` : "NO NUMBERS YET"}
        </span>
      </div>
      <div className="chef__tiles">
        {[["FOOD", "foodPct"], ["LABOR", "laborPct"], ["PRIME", "primePct"]].map(([label, k]) => (
          <div key={k} className="chef__tile">
            <span className="pass__countlabel">{label}</span>
            <span className="chef__big">{pct(week[k])}</span>
            <Delta now={week[k]} before={prior[k]} />
          </div>
        ))}
      </div>
      <button type="button" className="pass__flagbtn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Done" : "+ Enter a day’s numbers"}
      </button>
      {open && (
        <div className="chef__entry">
          <label className="chef__coverfield">
            <span className="pass__countlabel">DAY</span>
            <input className="pass__input" type="date" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
          {FIELDS.map(([f, label]) => (
            <label key={f} className="chef__coverfield">
              <span className="pass__countlabel">{label}</span>
              <input className="pass__input" type="number" inputMode="decimal" min="0" value={entry[f] ?? ""} onChange={(e) => setField(f, e.target.value)} />
            </label>
          ))}
        </div>
      )}
      {week.days === 0 && (
        <button type="button" className="pass__ghost" onClick={() => setDaily({ ...sampleWeek(today), ...daily })}>
          Try it with two sample weeks
        </button>
      )}
      <p className="pass__hint">Prime = food + labor. Typed in daily until the POS and payroll are connected. Food is purchases ÷ sales for now.</p>
    </section>
  );
}
