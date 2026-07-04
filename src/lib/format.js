export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// startTime is an "HH:MM" (24h) string, offsetMinutes is minutes since schedule start.
export function formatClockTime(startTime, offsetMinutes) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const totalMinutes = startHours * 60 + startMinutes + offsetMinutes;
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
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
