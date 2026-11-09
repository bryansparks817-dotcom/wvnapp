// The staff roster: each person's full name is linked to their own initials,
// so the same cook always signs the same way and two cooks never share
// initials. The chef screens will manage this list; for now a new name is
// added the first time someone signs in.

export function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function findByName(roster, name) {
  const key = normalizeName(name).toLowerCase();
  return roster.find((p) => p.name.toLowerCase() === key) ?? null;
}

// First + last initial; if someone already has those, add letters from the
// last name until it's unique (Bryan Sparks → BS, then BSP, BSPA…).
export function initialsFor(name, roster) {
  const parts = normalizeName(name).toUpperCase().replace(/[^A-Z ]/g, "").split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  const last = parts.length > 1 ? parts[parts.length - 1] : first.slice(1);
  const taken = new Set(roster.map((p) => p.initials));
  let candidate = first[0] + (last[0] ?? "");
  for (let i = 1; taken.has(candidate) && i < last.length; i++) candidate += last[i];
  let n = 2;
  const base = candidate;
  while (taken.has(candidate)) candidate = `${base}${n++}`;
  return candidate;
}

// Returns the person for this name, adding them to the roster if new.
export function signIn(name, roster) {
  const existing = findByName(roster, name);
  if (existing) return { person: existing, roster };
  const person = { name: normalizeName(name), initials: initialsFor(name, roster) };
  return { person, roster: [...roster, person] };
}

export function previewInitials(name, roster) {
  if (!normalizeName(name)) return "";
  return findByName(roster, name)?.initials ?? initialsFor(name, roster);
}

// ---- Profiles (Setup → Staff) ----
// A person: { name, initials, role: "cook" | "chef", stations?: [stationId]
// (none = every station), pinHash?, active? (false = removed; kept so old
// counts and history still show their name) }.
//
// The PIN only keeps one cook from signing in as another on a shared phone.
// It is hashed so it isn't readable at a glance, but real security comes
// with proper accounts in the shared database.
export function hashPin(pin) {
  let h = 2166136261;
  for (const c of `thepass:${pin}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

export const validPin = (pin) => /^\d{4}$/.test(pin);
export const checkPin = (person, pin) => !person?.pinHash || person.pinHash === hashPin(pin);
export const activeStaff = (roster) => roster.filter((p) => p.active !== false);
export const isChef = (p) => p?.role === "chef";
export const hasChef = (roster) => activeStaff(roster).some(isChef);

// Initials must be 1–4 letters/digits and not used by anyone else.
export function initialsProblem(initials, roster, self = null) {
  const v = initials.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,4}$/.test(v)) return "Use 1 to 4 letters.";
  if (roster.some((p) => p !== self && p.initials === v)) return "Someone already signs with those.";
  return null;
}
