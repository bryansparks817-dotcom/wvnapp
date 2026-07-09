export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// Parses an "HH:MM" (24h) time input into minutes since midnight.
export function parseTimeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

// Formats absolute minutes (since midnight, may be negative or exceed 1440 —
// schedules can start before midnight or run past it) as a 12h clock time.
export function formatTimeOfDay(minutes) {
  const rounded = Math.round(minutes);
  const wrapped = ((rounded % 1440) + 1440) % 1440;
  const hours24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
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
