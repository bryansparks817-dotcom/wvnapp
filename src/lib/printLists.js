// Paper prep lists. The chef assigns each station's items to cooks, then
// prints one letter-size sheet per cook, so cooks can work the shift off a
// clipboard instead of a phone.
//
// Who does what lives on each station's shift:
//   shift.printCook: the cook the whole station goes to (falls back to the
//     cook who confirmed the count)
//   shift.assign:    { [itemId]: initials } for items the chef handed to
//     someone else
//   shift.printedAt: { [initials]: ms } when each cook's sheet last printed
import { loadShift, saveShift } from "./storage";
import { buildShift, containerLabel, formatG } from "./inventory";
import { applyShortages } from "./shortage";
import { madeAtName } from "../data/stations";
import { buildPrepSteps } from "./lineList";
import { withPace, paceFor } from "./pace";
import { batchGrams, scaleRecipe } from "./recipeScale";
import { gatherForPrep, groupByZone } from "./gatherList";
import { formatMinutes, formatTimeOfDay } from "./format";
import zoneData from "../data/storageZones.json";

const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function stationCook(shift) {
  return shift?.printCook ?? shift?.confirmedBy ?? null;
}

export function cookFor(shift, itemId) {
  return shift?.assign?.[itemId] ?? stationCook(shift);
}

// No one confirmed a count on a phone today: the chef starts the shift from
// the last close count, the same way the cook's CONFIRM would.
export function startShiftFromCount(st, inventoryItems, today, cook, chef) {
  const { collect, prep } = buildShift(st.items, inventoryItems, st.linePar, today);
  const strip = (rows) => rows.map(({ item: _item, ...rest }) => rest);
  const shift = {
    date: today, collect: strip(collect), prep: strip(prep), done: {}, meta: {},
    confirmedBy: cook, confirmedAt: Date.now(), startedByChef: chef, printCook: cook,
  };
  saveShift(shift, st.id);
  return shift;
}

export function setStationCook(stationId, initials) {
  const shift = loadShift(stationId);
  if (!shift) return;
  saveShift({ ...shift, printCook: initials, assign: {} }, stationId);
}

export function setItemCook(stationId, itemId, initials) {
  const shift = loadShift(stationId);
  if (!shift) return;
  const assign = { ...(shift.assign ?? {}) };
  if (initials === stationCook(shift)) delete assign[itemId];
  else assign[itemId] = initials;
  saveShift({ ...shift, assign }, stationId);
}

export function markPrinted(stationIds, initials) {
  for (const id of stationIds) {
    const shift = loadShift(id);
    if (shift) saveShift({ ...shift, printedAt: { ...(shift.printedAt ?? {}), [initials]: Date.now() } }, id);
  }
}

// One cook's whole day across every station they were given.
// openStations: [{ st, shift }] for today's open shifts.
export function buildCookSheet(initials, openStations, recipesById, ingredients) {
  const collect = [];
  const toss = [];
  const prep = [];
  const stations = [];
  let first = null;
  for (const { st, shift } of openStations) {
    const mine = (id) => cookFor(shift, id) === initials;
    const rows = applyShortages(shift.prep.filter((p) => !shift.skip?.[p.id]), shift.short);
    const nameOf = (id) => st.items.find((i) => i.id === id)?.name ?? id;
    const c = shift.collect.filter((r) => mine(r.id)).map((r) => ({ ...r, name: nameOf(r.id), station: st.name, madeAtName: madeAtName(r) }));
    const p = rows.filter((r) => mine(r.id)).map((r) => ({ ...r, station: st.name }));
    if (c.length || p.length) stations.push({ id: st.id, name: st.name });
    collect.push(...c);
    for (const r of p) {
      if (r.makeG > 0) prep.push(r);
      else if (r.toss?.length) toss.push(r);
    }
    if (shift.bump && p.some((r) => r.id === shift.bump)) first ??= shift.bump;
  }
  const paced = withPace(recipesById, paceFor(initials));
  const plan = buildPrepSteps(prep, paced, { first });
  const gather = gatherForPrep(prep, recipesById, ingredients, (r) => batchGrams(r, recipesById, ingredients).grams);
  const recipes = prep
    .filter((r) => r.recipeId && recipesById.has(r.recipeId))
    .map((r) => {
      const recipe = recipesById.get(r.recipeId);
      return { row: r, recipe, scaled: scaleRecipe(recipe, r.makeG, recipesById, ingredients) };
    });
  return { initials, stations, collect, toss, prep, plan, gather, recipes };
}

export function hasWork(sheet) {
  return sheet.collect.length + sheet.toss.length + sheet.prep.length > 0;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${DAY[new Date(y, m - 1, d).getDay()]} ${m}/${d}`;
}

const madeTag = (c) => (c.madeOn ? ` · made ${prettyDate(c.madeOn)}` : "");
const pulls = (takes) => takes.map((t) => `${containerLabel(t)} from ${t.where}${madeTag(t)}`).join(", ");
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function stepTag(s) {
  if (s.kind === "start") return s.handsOff.length ? "START FIRST · LONGEST HANDS-OFF" : "START HERE";
  if (s.kind === "fill") return `WHILE ${s.during.name.toUpperCase()} ${s.during.step ? `· ${lower(s.during.step)}` : ""}`;
  if (s.kind === "back") return `BACK TO ${s.name.toUpperCase()}`;
  return "NEXT";
}

function gatherAmount(g) {
  const parts = [];
  if (g.grams > 0) parts.push(formatG(g.grams));
  for (const o of g.other) parts.push(`${Math.round(o.qty * 100) / 100} ${o.unit}`);
  return parts.join(" + ");
}

const box = '<span class="box"></span>';

// The printed page(s) for one cook. startMin: minutes since midnight the
// list starts at, so each step gets a clock time.
function sheetHtml(sheet, { name, today, startMin, serviceLabel, chefName, withRecipes }) {
  const { plan } = sheet;
  const finish = startMin + plan.totalMinutes;
  const head = `
<header>
  <div class="brand">WANDERING VINE · PREP LIST</div>
  <div class="who">${esc(name)}</div>
  <div class="meta">
    <span>${esc(prettyDate(today))}</span>
    <span>${esc(sheet.stations.map((s) => s.name).join(" + "))}</span>
    <span>Start ${formatTimeOfDay(startMin)}</span>
    ${plan.totalMinutes ? `<span>Done ~${formatTimeOfDay(finish)} (${formatMinutes(plan.totalMinutes)})</span>` : ""}
    ${serviceLabel ? `<span>Service ${esc(serviceLabel)}</span>` : ""}
    ${chefName ? `<span>Chef ${esc(chefName)}</span>` : ""}
  </div>
</header>`;

  const tossRows = [
    ...sheet.toss.map((r) => ({ name: r.name, station: r.station, what: r.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", "), note: "Enough backup left, no prep." })),
    ...sheet.prep.filter((r) => r.toss?.length).map((r) => ({ name: r.name, station: r.station, what: r.toss.map((t) => `${containerLabel(t)} (${t.where})`).join(", "), note: "Then make fresh below." })),
  ];
  const tossHtml = tossRows.length ? `
<section>
  <h2>1 · TOSS FIRST <small>last day, write it on the waste log</small></h2>
  <table>${tossRows.map((t) => `<tr><td class="cb">${box}</td><td><b>${esc(t.name)}</b> <span class="mut">${esc(t.station)}</span></td><td>${esc(t.what)}</td><td class="mut">${esc(t.note)}</td></tr>`).join("")}</table>
</section>` : "";

  const collectHtml = sheet.collect.length ? `
<section>
  <h2>${tossRows.length ? 2 : 1} · COLLECT <small>backup is already made, just restock</small></h2>
  <table>${sheet.collect.map((c) => `<tr><td class="cb">${box}</td><td><b>${esc(c.name)}</b> <span class="mut">${esc(c.station)}</span></td><td>${[
    c.toLine?.length ? `<div>To the line: ${esc(pulls(c.toLine))}</div>` : "",
    c.toLowboy?.length ? `<div>To the lowboy: ${esc(pulls(c.toLowboy))}</div>` : "",
    c.shortG > 0 ? `<div>Short ${esc(formatG(c.shortG))}: ${esc(c.madeAtName ?? "another station")} makes this, ask them.</div>` : "",
  ].join("")}</td></tr>`).join("")}</table>
</section>` : "";

  let n = (tossRows.length ? 1 : 0) + (sheet.collect.length ? 1 : 0);

  const zones = groupByZone(sheet.gather.items, zoneData);
  const gatherHtml = sheet.gather.items.length ? `
<section>
  <h2>${++n} · GATHER <small>pull it all before you start, then the clock starts</small></h2>
  <div class="zones">${zones.map((z) => `
    <div class="zone"><div class="zonehead">${esc(z.name.toUpperCase())} <span class="mut">${esc(z.area)}</span></div>
    <table>${z.items.map((g) => `<tr><td class="cb">${box}</td><td>${esc(g.name)}</td><td class="num">${esc(gatherAmount(g))}</td></tr>`).join("")}</table></div>`).join("")}
  </div>
</section>` : "";

  let k = 0;
  const steps = plan.steps.map((s) => {
    if (s.kind === "wait") {
      return `<tr class="wait"><td></td><td class="time">${formatTimeOfDay(startMin + s.at)}</td><td colspan="2">WAIT ~${formatMinutes(s.minutes)}${s.on ? ` · ${esc(s.on.name)} still on “${esc(lower(s.on.step))}”` : ""}. Clean down, restock, help the line.</td></tr>`;
    }
    k += 1;
    const row = s.item;
    const make = s.firstForItem && row ? ` <span class="make">MAKE ${esc(formatG(row.makeG))}</span>` : "";
    const scaled = s.firstForItem && row?.limitedBy ? `<div class="warn">SCALED DOWN · short on ${esc(row.limitedBy.map((l) => l.name).join(", "))}. Making ${esc(formatG(row.makeG))}, not ${esc(formatG(row.plannedG))}.</div>` : "";
    const actions = s.actions.length ? s.actions : s.handsOff.map((h) => h.step);
    const off = s.handsOff.length ? `<div class="off">Then hands-off: ${esc(s.handsOff.map((h) => (h.minutes >= 1 ? `${lower(h.step)} (${formatMinutes(Math.round(h.minutes))})` : lower(h.step))).join(" → "))}${s.handsOff.some((h) => h.minutes >= 1) ? ". Set a timer." : ""}</div>` : "";
    const last = s.lastForItem ? '<div class="mut">LAST STEP · label it, date it, put it away</div>' : "";
    return `<tr><td class="cb">${box}</td><td class="time">${formatTimeOfDay(startMin + s.at)}<div class="mut">${k}</div></td><td>
      <div class="tag">${esc(stepTag(s))}</div>
      <div><b>${esc(s.name)}</b>${make}</div>${scaled}
      <ol class="acts">${actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>${off}${last}
    </td><td class="num">${s.handsOn ? formatMinutes(Math.round(s.handsOn)) : ""}</td></tr>`;
  });
  const untimed = plan.untimed.map((r) => `<tr><td class="cb">${box}</td><td class="time">—</td><td><div class="tag">NO RECIPE TIMES YET · ask the chef</div><b>${esc(r.name)}</b> <span class="make">MAKE ${esc(formatG(r.makeG))}</span></td><td></td></tr>`);
  const prepHtml = steps.length || untimed.length ? `
<section>
  <h2>${++n} · PREP, IN THIS ORDER <small>longest hands-off first, fill the waiting with the rest</small></h2>
  <table class="steps"><tr class="th"><th></th><th>AT</th><th>DO</th><th>HANDS-ON</th></tr>${steps.join("")}${untimed.join("")}</table>
</section>` : "";

  const foot = `
<section class="foot">
  <div><b>SHORT ON ANYTHING? 86 OR LOW?</b> Write it here and tell the chef right away.</div>
  <div class="lines"><span></span><span></span><span></span></div>
  <div class="sign"><span>Finished at ________</span><span>Cook ________</span><span>Chef check ________</span></div>
</section>`;

  const recipePages = withRecipes && sheet.recipes.length ? sheet.recipes.map(({ row, recipe, scaled }) => `
<div class="page recipe">
  <header><div class="brand">WANDERING VINE · RECIPE FOR ${esc(name.toUpperCase())}</div>
  <div class="who">${esc(recipe.name)}</div>
  <div class="meta"><span>MAKE ${esc(formatG(row.makeG))}</span><span>×${scaled.factor.toFixed(2)} of a batch</span><span>${esc(row.station)}</span></div></header>
  ${scaled.basis === "ingredients" ? `<p class="mut">Scaled from the ingredient total (${esc(formatG(scaled.batchGrams))}).</p>` : ""}
  <h2>INGREDIENTS</h2>
  <table>${scaled.lines.map((l) => `<tr><td class="cb">${box}</td><td>${esc(l.name)}${l.note ? ` <span class="mut">${esc(l.note)}</span>` : ""}</td><td class="num">${esc(l.amount)}</td></tr>`).join("")}</table>
  <h2>METHOD</h2>
  <ol class="method">${recipe.steps.map((st) => `<li>${esc(st.name)} <span class="mut">${st.type === "passive" ? "hands-off" : "hands-on"} · ${formatMinutes(Math.round(st.duration_minutes))}</span></li>`).join("")}</ol>
</div>`).join("") : "";

  return `<div class="page">${head}${tossHtml}${collectHtml}${gatherHtml}${prepHtml}${foot}</div>${recipePages}`;
}

const CSS = `
@page { size: letter; margin: 0.45in; }
* { box-sizing: border-box; }
html, body { margin: 0; color: #000; background: #fff; font: 10pt/1.3 Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
header { border-bottom: 2pt solid #000; padding-bottom: 4pt; margin-bottom: 8pt; }
.brand { font-size: 8pt; letter-spacing: 0.12em; font-weight: 700; }
.who { font-size: 22pt; font-weight: 800; line-height: 1.1; }
.meta { display: flex; flex-wrap: wrap; gap: 4pt 14pt; font-size: 9.5pt; font-weight: 600; }
h2 { font-size: 10.5pt; letter-spacing: 0.06em; margin: 10pt 0 3pt; border-bottom: 0.75pt solid #000; padding-bottom: 2pt; }
h2 small { font-weight: 400; letter-spacing: 0; font-size: 8.5pt; color: #444; margin-left: 6pt; }
section { break-inside: auto; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; page-break-inside: avoid; }
td, th { padding: 3pt 4pt; vertical-align: top; border-bottom: 0.5pt solid #bbb; text-align: left; }
th { font-size: 7.5pt; letter-spacing: 0.08em; border-bottom: 0.75pt solid #000; }
.cb { width: 16pt; }
.box { display: inline-block; width: 10pt; height: 10pt; border: 1pt solid #000; margin-top: 1pt; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.time { width: 52pt; white-space: nowrap; font-weight: 700; font-variant-numeric: tabular-nums; }
.mut { color: #555; font-size: 8.5pt; font-weight: 400; }
.tag { font-size: 7.5pt; letter-spacing: 0.06em; font-weight: 700; color: #444; }
.make { font-weight: 800; border: 1pt solid #000; padding: 0 3pt; margin-left: 4pt; font-size: 9pt; white-space: nowrap; }
.acts { margin: 2pt 0 0; padding-left: 14pt; }
.off { margin-top: 2pt; font-style: italic; }
.warn { font-weight: 700; margin-top: 2pt; }
tr.wait td { background: #eee; font-size: 9pt; font-style: italic; }
.zones { columns: 2; column-gap: 14pt; }
.zone { break-inside: avoid; margin-bottom: 6pt; }
.zonehead { font-size: 8pt; font-weight: 700; letter-spacing: 0.08em; border-bottom: 0.75pt solid #000; padding: 2pt 0; }
.foot { margin-top: 12pt; border: 1pt solid #000; padding: 6pt 8pt; break-inside: avoid; }
.lines span { display: block; border-bottom: 0.5pt solid #888; height: 16pt; }
.sign { display: flex; justify-content: space-between; margin-top: 8pt; font-weight: 600; }
.method { padding-left: 16pt; }
.method li { margin-bottom: 4pt; }
`;

export function printListsHtml(sheets, opts) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Prep lists ${esc(opts.today)}</title><style>${CSS}</style></head><body>
${sheets.map((s) => sheetHtml(s, { ...opts, name: opts.nameOf(s.initials) })).join("")}
</body></html>`;
}

// Prints through a hidden frame so the app page stays put (same as labels).
export function printSheets(sheets, opts) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(printListsHtml(sheets, opts));
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 150);
}
