/**
 * Achievements register: the set of milestone ids already celebrated.
 * Mirrors upstream-providers.js (KEY + load/save + sanitize + try/catch).
 * loadAchievements returns null when the key was never stored -- the caller
 * treats that as FIRST RUN and seeds the already-passed milestones
 * SILENTLY (no toasts); returning null instead of seeding here keeps the
 * "toast or not" decision in exactly one place (app.js). A corrupt value
 * returns an empty set (the crossings then toast once -- harmless, and
 * corruption is not a normal path). Unknown ids are dropped on save/load
 * (a hand-edited or stale register never re-celebrates a dead rung).
 */
import { ACHIEVEMENT_MILESTONES } from './dashboard-pnl.js';

export const ACHIEVEMENTS_KEY = 'shahdara_achievements_v1';

const KNOWN_IDS = new Set(ACHIEVEMENT_MILESTONES.map((m) => m.id));

function sanitizeAchievements(data) {
  const ids = Array.isArray(data?.achieved) ? data.achieved : [];
  return { achieved: ids.filter((id) => typeof id === 'string' && KNOWN_IDS.has(id)) };
}

export function loadAchievements() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw === null || raw === undefined) return null;
    if (!raw) return { achieved: [] };
    return sanitizeAchievements(JSON.parse(raw));
  } catch {
    return { achieved: [] };
  }
}

export function saveAchievements(data) {
  const cleaned = sanitizeAchievements(data);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(cleaned));
  } catch { /* storage unavailable -- the caller still gets the cleaned data back */ }
  return cleaned;
}
