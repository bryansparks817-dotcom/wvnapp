// The restaurant's stations. Garde manger's first items are in lineItems.json;
// everything else came from the kitchen setup workbook (stationItems.json,
// built by scripts/setup-workbook/stations.py). Pastry and Prep get theirs
// when their recipes go in.
import garde from "./lineItems.json";
import fromSetup from "./stationItems.json";

const extra = (id) => fromSetup.stations[id] ?? [];

export const STATIONS = [
  { id: "garde-manger", name: "Garde manger", linePar: garde.linePar, items: [...garde.items, ...extra("garde-manger")] },
  { id: "grill", name: "Grill", linePar: 100, items: extra("grill") },
  { id: "saute", name: "Sauté", linePar: 100, items: extra("saute") },
  { id: "pastry", name: "Pastry", linePar: 100, items: extra("pastry") },
  { id: "prep", name: "Prep", linePar: 100, items: extra("prep") },
];
export function stationsFor(person) {
  const allowed = person?.stations;
  if (!Array.isArray(allowed)) return STATIONS;
  const list = STATIONS.filter((s) => allowed.includes(s.id));
  return list.length ? list : STATIONS;
}
