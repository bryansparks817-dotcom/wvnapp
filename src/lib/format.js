export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatGrams(grams) {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${trimTrailingZeros(kg.toFixed(2))} kg`;
  }
  return `${Math.round(grams).toLocaleString()} g`;
}

function trimTrailingZeros(decimalString) {
  return decimalString.replace(/\.?0+$/, "");
}
