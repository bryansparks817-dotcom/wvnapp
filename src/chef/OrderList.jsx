import { useMemo } from "react";
import { getStations } from "../data/stations";
import { holdsBackup } from "../lib/backupStock";
import { buildShift, emptyInventory, formatG } from "../lib/inventory";
import { loadInventory, loadPrices } from "../lib/storage";

// Chef › Stock: the bought-in items (blue cheese crumbles…) the line stations
// closed under par, added up per product and rounded up to the vendor's case.
// The walk-in count isn't in the app yet, so it says to check what's already
// on the shelf before ordering.
export function boughtInNeeds(stations, today) {
  const byProduct = new Map();
  for (const st of stations) {
    if (holdsBackup(st)) continue;
    const bought = st.items.filter((i) => i.boughtIn);
    const inv = loadInventory(st.id);
    if (!bought.length || !inv?.closedAt) continue;
    const { collect } = buildShift(bought, { ...emptyInventory(bought), ...(inv.items ?? {}) }, st.linePar, today);
    for (const r of collect) {
      if (!(r.pullG > 0)) continue;
      const name = r.item.orderName ?? r.item.name;
      const key = name.toLowerCase();
      const cur = byProduct.get(key) ?? { name, grams: 0, stations: [], caseGrams: r.item.caseGrams, caseLabel: r.item.caseLabel, draft: Boolean(r.item.unconfirmed?.includes("caseGrams")) };
      cur.grams += r.pullG;
      cur.stations.push(`${st.name} ${formatG(r.pullG)}`);
      byProduct.set(key, cur);
    }
  }
  return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function OrderList({ today }) {
  const rows = useMemo(() => boughtInNeeds(getStations(), today), [today]);
  const prices = useMemo(() => loadPrices(), []);
  return (
    <section>
      <div className="pass__sectionhead"><h2>Order list · bought in</h2></div>
      <p className="pass__hint">What the line closed short on that comes from a vendor, added up and rounded to whole cases. Check what’s already in the walk-in and dry storage before you order.</p>
      {rows.length === 0 && <p className="pass__empty">Nothing bought-in is under par.</p>}
      <ul className="pass__list">
        {rows.map((r) => {
          const cases = r.caseGrams ? Math.ceil(r.grams / r.caseGrams) : null;
          const perKg = prices[r.name.toLowerCase()] ?? null;
          const cost = perKg != null && cases ? (cases * r.caseGrams * perKg) / 1000 : null;
          return (
            <li key={r.name} className="fz__pull">
              <span className="pass__rowtext">
                <span className="pass__rowname">{r.name} <span className="pass__mono">· {formatG(r.grams)}</span></span>
                <span className={`pass__rowsub${r.draft ? " fz__draft" : ""}`}>
                  {cases ? `${cases} × ${r.caseLabel || formatG(r.caseGrams)}${r.draft ? " (case size to confirm)" : ""}` : "No case size set: add it in Setup."}
                  {cost != null ? ` · about $${cost.toFixed(2)}` : ""}
                </span>
                <span className="pass__rowsub">{r.stations.join(" · ")}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
