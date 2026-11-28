// Line pan sizes. The chef sets an item's pan directly; a line cook can only
// ask for a different size, and the chef approves or declines the request.
import { getStations } from "../data/stations";
import { loadPanRequests, savePanRequests, saveStationSetup } from "./storage";

export const PANS = ["1/9", "1/6", "1/3", "1/2", "full", "bottle", "duster"];
// "1/9 pan", or "squeeze bottle" for the bottle rail.
export const panName = (p) => (p === "bottle" ? "squeeze bottle" : p === "duster" ? "duster" : `${p} pan`);
// Typical full-pan weights, for a new item or to rescale one that changes size.
export const PAN_GRAMS = { "1/9": 1000, "1/6": 2500, "1/3": 4000, "1/2": 6000, full: 12000, bottle: 375, duster: 250 };

// Same product, bigger or smaller pan: scale the item's own full-pan weight.
export function gramsForPan(item, pan) {
  const from = PAN_GRAMS[item.pan];
  const to = PAN_GRAMS[pan];
  if (!from || !to) return to ?? item.panGrams;
  return Math.round((item.panGrams * to) / from);
}

// Chef: change the item's line pan on every phone.
export function setItemPan(stationId, itemId, pan) {
  const stations = getStations().map((st) => {
    if (st.id !== stationId) return st;
    return {
      ...st,
      items: st.items.map((i) => {
        if (i.id !== itemId || i.pan === pan) return i;
        const next = { ...i, pan, panGrams: gramsForPan(i, pan) };
        if (next.unconfirmed) next.unconfirmed = next.unconfirmed.filter((f) => f !== "pan");
        return next;
      }),
    };
  });
  saveStationSetup(stations);
  // Any open request for this item is settled by the chef's change.
  resolveRequests((r) => r.stationId === stationId && r.itemId === itemId, pan, null);
}

export const openRequests = () => loadPanRequests().filter((r) => r.status === "open");

// Line cook: ask the chef for a different pan. One open request per item.
export function requestPan({ stationId, stationName, item, pan, by }) {
  const others = loadPanRequests().filter((r) => !(r.status === "open" && r.stationId === stationId && r.itemId === item.id));
  if (pan === item.pan) return savePanRequests(others);
  savePanRequests([
    ...others,
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, stationId, stationName, itemId: item.id, itemName: item.name, from: item.pan, to: pan, by, at: Date.now(), status: "open" },
  ]);
}

export function cancelRequest(id) {
  savePanRequests(loadPanRequests().filter((r) => r.id !== id));
}

function resolveRequests(match, pan, chefBy) {
  const list = loadPanRequests();
  if (!list.some((r) => r.status === "open" && match(r))) return;
  savePanRequests(list.map((r) => (r.status === "open" && match(r) ? { ...r, status: r.to === pan ? "approved" : "declined", by2: chefBy, doneAt: Date.now() } : r)));
}

// Chef: approve (changes the pan) or decline a cook's request.
export function answerRequest(req, approve, chefBy) {
  if (approve) setItemPan(req.stationId, req.itemId, req.to);
  else resolveRequests((r) => r.id === req.id, null, chefBy);
}
