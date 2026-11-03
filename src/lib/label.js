// Prep labels for a Brother QL-820NWB (or any label printer the phone can
// print to over AirPrint / Mopria). Sized for 62 mm continuous tape
// (DK-2205); the printer cuts to length.
import { addDays } from "./inventory";

const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function pretty(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY[date.getDay()]} ${m}/${d}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// The last day it can be used: matches the shelf-life countdown, which flags
// "last day · toss" on this date.
export function useByDate(item, madeOn) {
  return addDays(madeOn, item.shelfLifeDays - 1);
}

// One label per container: containers = [{ grams, size }].
export function labelHtml({ item, madeOn, madeAt, by, containers }) {
  const time = madeAt ? new Date(madeAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(item.name)} label</title>
<style>
@page { size: 62mm 40mm; margin: 0; }
html, body { margin: 0; }
.label { width: 62mm; height: 40mm; box-sizing: border-box; page-break-after: always; break-after: page; overflow: hidden; padding: 3mm 3.5mm; font-family: Helvetica, Arial, sans-serif; color: #000; display: flex; flex-direction: column; justify-content: space-between; }
.name { font-size: 15pt; font-weight: 700; line-height: 1.05; }
.row { display: flex; justify-content: space-between; font-size: 9pt; }
.useby { font-size: 13pt; font-weight: 700; border-top: 0.6mm solid #000; padding-top: 1mm; display: flex; justify-content: space-between; }
</style></head><body>
${containers
  .map(
    (c) => `<div class="label">
<div class="name">${escapeHtml(item.name)}</div>
<div>
<div class="row"><span>MADE ${pretty(madeOn)} ${escapeHtml(time)}</span><span>${escapeHtml(by || "")}</span></div>
<div class="row"><span>${Math.round(c.grams).toLocaleString()} g</span><span>${escapeHtml(c.size.toUpperCase())}</span></div>
</div>
<div class="useby"><span>USE BY</span><span>${pretty(useByDate(item, madeOn))}</span></div>
</div>`
  )
  .join("")}
</body></html>`;
}

// Prints through a hidden frame so the app page stays put.
export function printLabel(data) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(labelHtml(data));
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 100);
}
