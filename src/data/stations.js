// The restaurant's stations. Garde manger has sample items. Grill, Sauté,
// Pastry and Prep have made-up items (sampleStations.json) so every station
// can be tried out until the real menu goes in.
import garde from "./lineItems.json";
import made from "./sampleStations.json";

export const STATIONS = [
  { id: "garde-manger", name: "Garde manger", linePar: garde.linePar, items: garde.items },
  { id: "grill", name: "Grill", linePar: made.stations["grill"].linePar, items: made.stations["grill"].items },
  { id: "saute", name: "Sauté", linePar: made.stations["saute"].linePar, items: made.stations["saute"].items },
  { id: "pastry", name: "Pastry", linePar: made.stations["pastry"].linePar, items: made.stations["pastry"].items },
  { id: "prep", name: "Prep", linePar: made.stations["prep"].linePar, items: made.stations["prep"].items },
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
