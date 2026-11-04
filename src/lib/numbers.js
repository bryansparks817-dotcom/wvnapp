// 7-day rolling food and labor cost, as a share of sales.
// Food cost here is food purchases ÷ sales: a quick read, not a full
// inventory-adjusted food cost (that needs the walk-in count and pricing).

export function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBack(today, n) {
  const [y, m, d] = today.split("-").map(Number);
  const out = [];
  for (let i = 0; i < n; i++) out.push(dateKey(new Date(y, m - 1, d - i)));
  return out;
}

// Totals over `days` days ending `offset` days before today (offset 0 = the
// window that ends today).
export function rolling(daily, today, days = 7, offset = 0) {
  const keys = daysBack(today, days + offset).slice(offset);
  const rows = keys.map((k) => daily[k]).filter((r) => r && r.sales > 0);
  const sum = (f) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);
  const sales = sum("sales");
  const food = sum("food");
  const labor = sum("labor");
  return {
    days: rows.length,
    sales,
    foodPct: sales ? (food / sales) * 100 : null,
    laborPct: sales ? (labor / sales) * 100 : null,
    primePct: sales ? ((food + labor) / sales) * 100 : null,
  };
}

// Two believable weeks of numbers so the strip can be tried before real ones.
export function sampleWeek(today) {
  const out = {};
  daysBack(today, 14).forEach((k, i) => {
    const sales = 6800 + ((i * 937) % 2400);
    out[k] = {
      sales,
      // This week runs a little higher on food and lower on labor than last.
      food: Math.round(sales * (0.29 + ((i * 7) % 6) / 100 + (i < 7 ? 0.012 : 0))),
      labor: Math.round(sales * (0.3 + ((i * 5) % 5) / 100 - (i < 7 ? 0.008 : 0))),
    };
  });
  return out;
}
