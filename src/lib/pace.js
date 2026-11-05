// Cook pace: the chef can plan a cook's prep list at their real speed.
// A pace of 1.2 means the cook's hands-on work takes 20% longer than the
// recipe says, so every hands-on step on their list is planned 20% longer.
// Hands-off steps (simmer, chill) don't depend on the cook and stay as they are.
import { loadChefSettings } from "./storage";

export function paceFor(initials) {
  const p = loadChefSettings().cookPace?.[initials];
  return typeof p === "number" && p > 0 ? p : 1;
}

export function withPace(recipesById, pace) {
  if (!pace || pace === 1) return recipesById;
  const out = new Map();
  for (const [id, r] of recipesById) {
    out.set(id, {
      ...r,
      steps: r.steps.map((s) => (s.type === "active" ? { ...s, duration_minutes: Math.max(1, Math.round(s.duration_minutes * pace)) } : s)),
    });
  }
  return out;
}
