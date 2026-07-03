export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatQty(qty) {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
