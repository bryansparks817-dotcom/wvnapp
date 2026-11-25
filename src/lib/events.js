// Private chef & catering mode: events instead of stations.
//
// An event is one BEO (banquet event order): who, where, when, how many
// guests, the timeline, and the menu by pieces. Each menu item is built from
// house recipes and/or raw ingredients in grams per piece, which gives its
// food cost per piece, the event's total food cost (the shopping budget),
// the shopping list, the prep list and the pack list. Sale prices and
// invoices stay out of the app on purpose.
import { gatherForPrep } from "./gatherList";
import { batchGrams } from "./recipeScale";

// ---- Kitchen type -------------------------------------------------------

export const KITCHEN_MODES = [
  { id: "restaurant", name: "Restaurant line", sub: "Stations, line counts, pans and pars." },
  { id: "private", name: "Private chef & catering", sub: "Events from a BEO: menu by pieces, food cost, shopping, prep and pack lists." },
];

// ---- Service spots and tags --------------------------------------------

export const TAGS = ["GF", "V", "VG", "DF", "NUTS", "SHELLFISH"];
export const TEMPS = [
  { id: "cold", label: "KEEP COLD" },
  { id: "hot", label: "KEEP HOT" },
  { id: "room", label: "ROOM TEMP" },
];

let counter = 0;
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

// ---- Pack list ----------------------------------------------------------

// The starting pack list for a new event. Food lines come from the menu, so
// they aren't in here. The chef adds and removes per event.
export const PACK_GROUPS = ["Service & display", "Cooking & holding", "Cleaning & safety", "Paper, labels & containers"];
const PACK_TEMPLATE = {
  "Service & display": [
    "Passing trays", "Platters & risers", "Chafers + sterno", "Serving tongs & spoons", "Cocktail napkins", "Picks & skewers",
  ],
  "Cooking & holding": [
    "Hotel pans + lids", "Hot boxes / Cambros", "Coolers + ice", "Sheet pans", "Cutting boards", "Knife roll",
    "Offset spatulas", "Piping bags & tips", "Squeeze bottles", "Probe thermometer", "Lighter", "Extension cord",
  ],
  "Cleaning & safety": [
    "Gloves (S / M / L)", "Side towels", "Sanitizer bucket + test strips", "Dish soap & scrubbers", "Trash bags",
    "Paper towels", "Plastic wrap & foil", "Hand soap", "First aid kit",
  ],
  "Paper, labels & containers": [
    "Copy of the BEO", "Label tape & Sharpies", "Deli containers & lids", "Zip bags",
  ],
};

export function defaultPack() {
  return PACK_GROUPS.flatMap((group) => PACK_TEMPLATE[group].map((name) => ({ id: newId("pk"), group, name, done: false })));
}

// ---- A new, empty event -------------------------------------------------

export const DEFAULT_SERVICES = [
  { id: "passed", name: "Passed", where: "" },
  { id: "warm", name: "Warm station", where: "" },
  { id: "dessert", name: "Dessert station", where: "" },
];

export function blankEvent() {
  return {
    id: newId("ev"),
    name: "New event",
    client: "",
    contact: "",
    date: "",
    venue: "",
    guests: 0,
    extraPct: 10,
    allergies: "",
    notes: "",
    timeline: [],
    services: DEFAULT_SERVICES.map((s) => ({ ...s })),
    items: [],
    pack: defaultPack(),
    createdAt: Date.now(),
  };
}

export function blankItem(serviceId) {
  return { id: newId("it"), name: "", pieces: 0, service: serviceId, tags: [], temp: "cold", components: [], notes: "" };
}

// ---- Costing -----------------------------------------------------------

// Pieces to make: what the BEO sold, plus the event's extra % for breakage,
// tasting and a little cushion. Rounded up to whole pieces.
export function piecesToMake(item, event) {
  const base = Number(item.pieces) || 0;
  const extra = Number(event.extraPct) || 0;
  return Math.ceil(base * (1 + extra / 100));
}

// Food cost of one piece. `costs` is costIndex() (recipe id → $/g), `prices`
// is the chef's $/kg by ingredient name. A component with no price is listed
// in `missing`; `partial` means a recipe used is only partly priced, so the
// real number is higher.
export function pieceCost(item, costs, prices, recipesById) {
  let cost = 0;
  const missing = [];
  let partial = false;
  for (const c of item.components ?? []) {
    const grams = Number(c.grams) || 0;
    if (c.kind === "recipe") {
      const co = costs.get(c.ref);
      const name = recipesById.get(c.ref)?.name ?? c.ref;
      if (!co || !co.priced) { missing.push(name); continue; }
      if (co.missing.length) partial = true;
      cost += co.perGram * grams;
    } else {
      const perKg = prices[(c.ref ?? "").toLowerCase()];
      if (perKg == null) { missing.push(c.ref); continue; }
      cost += (perKg / 1000) * grams;
    }
  }
  const linked = (item.components ?? []).length > 0;
  return { cost: linked ? cost : null, missing, partial: partial || missing.length > 0, linked };
}

// The whole event: cost per piece for each item, the total food cost
// (shopping budget) and per guest.
export function eventCost(event, costs, prices, recipesById) {
  const rows = event.items.map((item) => {
    const pc = pieceCost(item, costs, prices, recipesById);
    const make = piecesToMake(item, event);
    return { item, make, ...pc, total: pc.cost != null ? pc.cost * make : null };
  });
  const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const pieces = event.items.reduce((s, it) => s + (Number(it.pieces) || 0), 0);
  const unlinked = rows.filter((r) => !r.linked).length;
  const partial = rows.some((r) => r.linked && r.partial);
  const guests = Number(event.guests) || 0;
  return { rows, total, perGuest: guests > 0 ? total / guests : null, pieces, unlinked, partial };
}

// ---- Shopping and prep --------------------------------------------------

// What to make at the commissary: each house recipe's total grams across
// the menu (grams per piece × pieces to make), and which items use it.
export function prepForEvent(event, recipesById) {
  const map = new Map();
  for (const item of event.items) {
    const make = piecesToMake(item, event);
    for (const c of item.components ?? []) {
      if (c.kind !== "recipe" || !recipesById.has(c.ref)) continue;
      const row = map.get(c.ref) ?? { recipe: recipesById.get(c.ref), grams: 0, usedIn: [] };
      row.grams += (Number(c.grams) || 0) * make;
      if (!row.usedIn.includes(item.name)) row.usedIn.push(item.name);
      map.set(c.ref, row);
    }
  }
  return [...map.values()].sort((a, b) => a.recipe.name.localeCompare(b.recipe.name));
}

// Everything to buy for this one event: house recipes broken down to their
// raw ingredients, plus raw ingredients used straight on a piece, summed by
// name, with what each costs at the chef's prices.
export function shoppingForEvent(event, recipesById, ingredients, prices) {
  const prep = prepForEvent(event, recipesById);
  const rows = prep.map((p) => ({ id: p.recipe.id, name: p.recipe.name, recipeId: p.recipe.id, makeG: p.grams }));
  const { items } = gatherForPrep(rows, recipesById, ingredients, (r) => batchGrams(r, recipesById, ingredients).grams);
  const map = new Map(items.map((it) => [it.name.toLowerCase(), { ...it, usedIn: [...it.usedIn] }]));
  for (const item of event.items) {
    const make = piecesToMake(item, event);
    for (const c of item.components ?? []) {
      if (c.kind !== "ingredient" || !c.ref) continue;
      const key = c.ref.toLowerCase();
      const row = map.get(key) ?? { name: c.ref, grams: 0, other: [], usedIn: [] };
      row.grams += (Number(c.grams) || 0) * make;
      if (!row.usedIn.includes(item.name)) row.usedIn.push(item.name);
      map.set(key, row);
    }
  }
  return [...map.values()]
    .map((r) => {
      const perKg = prices[r.name.toLowerCase()];
      return { ...r, cost: perKg != null && r.grams > 0 ? (r.grams / 1000) * perKg : null };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Transport labels ---------------------------------------------------

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function labelsHtml(event) {
  const svc = new Map(event.services.map((s) => [s.id, s]));
  const date = event.date ? new Date(`${event.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "";
  const labels = event.items.map((it) => {
    const s = svc.get(it.service);
    const temp = TEMPS.find((t) => t.id === it.temp)?.label ?? "";
    return `<div class="lb">
      <div class="ev">${esc(event.name)}${event.venue ? ` · ${esc(event.venue)}` : ""}${date ? ` · ${esc(date)}` : ""}</div>
      <div class="nm">${esc(it.name)}</div>
      <div class="row"><b>${piecesToMake(it, event)} pc</b>${s ? ` · ${esc(s.name)}${s.where ? ` (${esc(s.where)})` : ""}` : ""}</div>
      ${it.tags.length ? `<div class="tags">${it.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="temp">${esc(temp)}</div>
      <div class="foot">Made ________ by ____ · Box ___ of ___</div>
    </div>`;
  });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(event.name)} labels</title>
  <style>
    @page { size: letter; margin: 0.4in; }
    body { font-family: Helvetica, Arial, sans-serif; margin: 0; color: #111; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.15in; }
    .lb { border: 1.5px solid #111; border-radius: 6px; padding: 10px 12px; break-inside: avoid; display: flex; flex-direction: column; gap: 4px; min-height: 1.9in; box-sizing: border-box; }
    .ev { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #444; }
    .nm { font-size: 18px; font-weight: 700; line-height: 1.15; }
    .row { font-size: 13px; }
    .tags span { display: inline-block; border: 1.5px solid #111; border-radius: 3px; padding: 1px 6px; margin-right: 4px; font-size: 12px; font-weight: 700; }
    .temp { font-size: 16px; font-weight: 800; letter-spacing: 0.08em; margin-top: auto; }
    .foot { font-size: 10px; color: #444; }
  </style></head><body><div class="grid">${labels.join("")}</div></body></html>`;
}

export function printHtml(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 150);
}

// ---- The test event: Bryan's holiday BEO at the castle ------------------

// Page 2 of a real BEO, typed in as the test case. Piece counts, tags,
// stations and times are from the sheet. The recipe and ingredient links
// (grams per piece) are Claude's drafts, marked `draft`, to show the costing
// working; most items still need their own recipes in The Pass.
// Bump when castleItems() changes, so a phone with the older test event can
// update it.
export const CASTLE_SAMPLE_REV = 4;

// The menu, linked to the Castle Catering Recipe & Production Book
// (src/data/cateringLibrary.json) in grams per piece, from each item's build
// guide. Links to Claude's own guesses (no book recipe yet) are drafts.
export function castleItems() {
  const rc = (ref, grams, draft = false) => ({ kind: "recipe", ref, grams, draft });
  const ing = (ref, grams, draft = false) => ({ kind: "ingredient", ref, grams, draft });
  const item = (name, pieces, service, temp, tags = [], components = [], notes = "", build = null) =>
    ({ ...blankItem(service), name, pieces, temp, tags, components, notes, ...(build ? { buildId: build } : {}) });
  const crostini = rc("castle-baguette-crostini", 5.5);
  return [
    item("Country ham & aged cheddar scone", 60, "passed", "room", [], [
      rc("castle-ham-cheddar-scone-dough", 45), rc("castle-whipped-cultured-honey-butter", 4),
    ], "Brush warm with honey butter, flaky salt", "castle-ham-cheddar-scone-build"),
    item("Steak tartare crostini", 50, "passed", "cold", [], [
      crostini, rc("castle-smoked-mussel-aioli", 5), rc("castle-beef-tartare", 20), rc("castle-fine-mirepoix", 2.5),
    ], "Replaces the BEO's Kansas City strip crostini (Bryan)", "castle-steak-tartare-crostini-build"),
    item("Mini New England lobster roll", 50, "dessert", "cold", ["SHELLFISH"], [
      rc("castle-japanese-milk-bread", 127.5), rc("castle-new-england-lobster-salad", 60), ing("Unsalted butter", 3, true),
    ], "Moved from passed to a station (hand note on the BEO)", "castle-mini-lobster-roll-build"),
    item("Spinach, artichoke & cheese stuffed mushrooms", 75, "passed", "hot", ["GF", "V"]),
    item("Bacon-wrapped scallop crostini", 60, "passed", "hot", ["SHELLFISH"], [
      crostini, rc("caramelized-miso-aioli", 9), rc("castle-bacon-wrapped-scallop-halves", 32.5), ing("sage", 0.5, true),
    ], "GF option: on a cracker", "castle-bacon-scallop-crostini-build"),
    item("Mini flank steak slider, pickled red onion", 60, "passed", "hot", [], [
      ing("Mini slider bun", 35, true), rc("castle-grilled-flank-steak", 47.5), ing("Pickled red onion", 9), rc("castle-lemon-dijon-arugula", 5),
    ], "GF option: on a cracker", "castle-flank-steak-slider-build"),
    item("Mini lump crab cake", 60, "passed", "hot", ["SHELLFISH"], [
      rc("castle-celery-root-remoulade", 11), rc("castle-mini-lump-crab-cake", 50), rc("castle-preserved-lemon-gel", 4),
    ], "", "castle-mini-crab-cake-build"),
    item("Hot honey chicken pizzetta", 75, "warm", "hot", [], [rc("house-made-hot-honey-glaze", 5, true)]),
    item("Coconut shrimp lollipop", 75, "warm", "hot", ["SHELLFISH"], [ing("p/d shrimp", 25, true)]),
    item("Fresh fruit skewers", 60, "dessert", "cold", ["GF", "VG"]),
    item("Hummus-stuffed snacking peppers", 60, "dessert", "cold", ["GF", "V"]),
    item("Chocolate decadence bites", 60, "dessert", "room"),
    item("Cappuccino cream in phyllo cup", 60, "dessert", "cold"),
    item("Pumpkin cheesecake bites", 60, "dessert", "cold"),
    item("White chocolate madeleines", 60, "dessert", "room"),
  ];
}

export function castleSampleEvent() {
  const ev = blankEvent();
  return {
    ...ev,
    name: "Holiday mix & mingle",
    venue: "The Castle",
    guests: 60,
    allergies: "",
    notes: "Partitions removed. Heavy apps, mixed passed and stations. High tops in the Great Hall for mix & mingle. Ivory tablecloths, classic holiday décor, holiday background music. No seated meal or plated dessert. Mocktails by consumption (bar, not food cost).",
    timeline: [
      { id: newId("tl"), time: "17:15", what: "Host arrives" },
      { id: newId("tl"), time: "17:30", what: "Guests arrive: signature drinks, wine or beer" },
      { id: newId("tl"), time: "17:45", what: "Start passed apps" },
      { id: newId("tl"), time: "21:30", what: "Last pass; guests start to leave" },
      { id: newId("tl"), time: "22:00", what: "Guests gone" },
    ],
    services: [
      { id: "passed", name: "Passed", where: "Great Hall" },
      { id: "warm", name: "Warm station", where: "Next to the steps" },
      { id: "dessert", name: "Cold & dessert station", where: "Between the fireplaces" },
    ],
    items: castleItems(),
    sampleRev: CASTLE_SAMPLE_REV,
    pack: [
      ...defaultPack(),
      { id: newId("pk"), group: "Service & display", name: "Champagne brocade tablecloths (special order)", done: false },
      { id: newId("pk"), group: "Service & display", name: "Cream high-top tablecloths (special order)", done: false },
      { id: newId("pk"), group: "Paper, labels & containers", name: "Food description place cards", done: false },
    ],
  };
}
