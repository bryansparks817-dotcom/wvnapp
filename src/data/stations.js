// The restaurant's stations. Garde manger has its items; Grill, Sauté,
// Pastry and Prep get theirs when the real menu goes in.
import garde from "./lineItems.json";

export const STATIONS = [
  { id: "garde-manger", name: "Garde manger", linePar: garde.linePar, items: garde.items },
  { id: "grill", name: "Grill", linePar: 100, items: [] },
  { id: "saute", name: "Sauté", linePar: 100, items: [] },
  { id: "pastry", name: "Pastry", linePar: 100, items: [] },
  { id: "prep", name: "Prep", linePar: 100, items: [] },
];

// Which stations a cook can open. The chef will toggle these per cook in the
// cook's profile (person.stations = [stationId, ...]). In the beta every cook
// can open every station, so a profile without a list gets them all.
export function stationsFor(person) {
  const allowed = person?.stations;
  if (!Array.isArray(allowed)) return STATIONS;
  const list = STATIONS.filter((s) => allowed.includes(s.id));
  return list.length ? list : STATIONS;
}
