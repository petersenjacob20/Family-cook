// Planner rules (build plan section 9). Deterministic, no AI. Pure: works on plain objects.
// data = { recipes: [...], vocab: {...}, seasonal: { months: { "1": [...] } } }
import { daysBetween, nightsForWeek, emptyWeek, month, weekIdFor, weekOf, addDays, isWeeknight } from './dates.js';
import { isBlocked, likedBy, allergyConflict } from './rules.js';

export const MAX_HANDS_ON = 45;

// FNV-1a string hash -> uint32
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(a) {
  let t = a >>> 0;
  return function next() {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function getWeek(state, weekId) {
  if (!state.weeks[weekId]) state.weeks[weekId] = emptyWeek();
  const w = state.weeks[weekId];
  if (!w.meals) w.meals = {};
  if (!w.swaps) w.swaps = {};
  if (!Array.isArray(w.groceryChecked)) w.groceryChecked = [];
  return w;
}

export function byId(data, id) {
  return (data.recipes || []).find((r) => r.id === id) || null;
}

function cookedWithin(state, id, date, days) {
  return (state.history || []).some((h) => {
    if (h.id !== id) return false;
    const d = daysBetween(h.date, date);
    return d >= 0 && d < days;
  });
}

// Household allergies are a hard exclude: a conflicting recipe is never planned, swapped in or listed.
export function allergyExcluded(r, state, data) {
  return allergyConflict(r, state.allergies, data.vocab);
}

// Rules 1-3: right kind, not blocked, no allergy conflict, hands-on <= 45, not rated not_again.
export function eligible(r, kind, state, data) {
  return r.kind === kind
    && Number(r.hands_on_min) <= MAX_HANDS_ON
    && state.ratings[r.id] !== 'not_again'
    && !isBlocked(r, state.people, data.vocab)
    && !allergyExcluded(r, state, data);
}

// A planned meal stays put unless it vanished, changed kind, or became blocked or an allergy conflict.
export function stillValid(state, data, id, kind) {
  const r = byId(data, id);
  return Boolean(r && r.kind === kind && Number(r.hands_on_min) <= MAX_HANDS_ON
    && !isBlocked(r, state.people, data.vocab) && !allergyExcluded(r, state, data));
}

// All recipes list: family first, then game-day, by title. Allergy conflicts are hidden (not dimmed).
export function recipeList(state, data) {
  return (data.recipes || [])
    .filter((r) => !allergyExcluded(r, state, data))
    .sort((a, b) => (a.kind === b.kind ? a.title.localeCompare(b.title) : a.kind === 'family' ? -1 : 1));
}

// Meals on the week's other active nights.
export function usedInWeek(state, weekId, exceptDate) {
  const week = getWeek(state, weekId);
  return nightsForWeek(weekId, state.nights, week)
    .filter((n) => n.date !== exceptDate)
    .map((n) => week.meals[n.date])
    .filter(Boolean);
}

// Candidates with rules 4 and 5, relaxing 5 first, then 4.
export function candidates(state, data, { date, kind, used = [], exclude = [] }) {
  const base = (data.recipes || []).filter((r) => eligible(r, kind, state, data) && !exclude.includes(r.id));
  const strict = base.filter((r) => !used.includes(r.id) && !cookedWithin(state, r.id, date, 14));
  if (strict.length) return { list: strict, relaxed: 0 };
  const noWeekRepeat = base.filter((r) => !used.includes(r.id));
  if (noWeekRepeat.length) return { list: noWeekRepeat, relaxed: 1 };
  return { list: base, relaxed: base.length ? 2 : 3 };
}

export function score(r, state, data, date, weeknight = isWeeknight(date)) {
  let s = 0;
  if (likedBy(r, state.people, data.vocab)) s += 3;
  if (state.ratings[r.id] === 'liked') s += 2;
  const months = (data.seasonal && data.seasonal.months) || {};
  const inSeason = months[String(month(date))] || [];
  if ((r.ingredients || []).some((i) => inSeason.includes(i.key))) s += 1;
  if (weeknight) {
    if (r.effort === 'easy' && Number(r.total_min) <= 40) s += 2;
  } else if (r.effort === 'fun') {
    s += 1;
  }
  if (cookedWithin(state, r.id, date, 28)) s -= 1;
  return s;
}

// Score, then a seeded shuffle for ties. Highest first.
export function rank(list, state, data, date, seed, weeknight) {
  const rnd = mulberry32(hashString(seed));
  return list
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((r) => ({ recipe: r, score: score(r, state, data, date, weeknight), tie: rnd() }))
    .sort((a, b) => b.score - a.score || a.tie - b.tie);
}

// Among candidates within 1 point of the top, choose with a seeded generator.
export function pickFrom(list, state, data, date, seed, weeknight) {
  if (!list.length) return null;
  const scored = list.map((r) => ({ r, s: score(r, state, data, date, weeknight) }));
  const top = Math.max(...scored.map((x) => x.s));
  const pool = scored.filter((x) => x.s >= top - 1).map((x) => x.r).sort((a, b) => (a.id < b.id ? -1 : 1));
  const rnd = mulberry32(hashString(seed));
  return pool[Math.floor(rnd() * pool.length)];
}

export function pickForNight(state, data, weekId, night) {
  const week = getWeek(state, weekId);
  const used = usedInWeek(state, weekId, night.date);
  const { list } = candidates(state, data, { date: night.date, kind: night.kind, used });
  const swapCount = week.swaps[night.date] || 0;
  return pickFrom(list, state, data, night.date, `${weekId}${night.date}${swapCount}`, night.weeknight);
}

// Fill only the empty nights, Thursday first. Filled nights are never re-shuffled.
// Returns true when something changed.
export function fillWeek(state, data, weekId) {
  const week = getWeek(state, weekId);
  let changed = false;
  for (const night of nightsForWeek(weekId, state.nights, week)) {
    const id = week.meals[night.date];
    if (id && stillValid(state, data, id, night.kind)) continue;
    const r = pickForNight(state, data, weekId, night);
    if (r) {
      if (week.meals[night.date] !== r.id) { week.meals[night.date] = r.id; changed = true; }
    } else if (id) {
      delete week.meals[night.date];
      changed = true;
    }
  }
  return changed;
}

export function nightFor(state, weekId, date) {
  return nightsForWeek(weekId, state.nights, getWeek(state, weekId)).find((n) => n.date === date) || null;
}

// Swap: the other candidates for that night, best first, `count` at a time.
export function swapOptions(state, data, weekId, date, { offset = 0, count = 3 } = {}) {
  const week = getWeek(state, weekId);
  const night = nightFor(state, weekId, date);
  if (!night) return { options: [], total: 0 };
  const current = week.meals[date];
  const used = usedInWeek(state, weekId, date);
  const { list } = candidates(state, data, { date, kind: night.kind, used, exclude: current ? [current] : [] });
  const ranked = rank(list, state, data, date, `${weekId}${date}${week.swaps[date] || 0}swap`, night.weeknight);
  return { options: ranked.slice(offset, offset + count).map((x) => x.recipe), total: ranked.length };
}

export function applySwap(state, weekId, date, id) {
  const week = getWeek(state, weekId);
  week.meals[date] = id;
  week.swaps[date] = (week.swaps[date] || 0) + 1;
}

// Tonight: today's planned meal, or "Next up" with that meal.
export function tonight(state, data, today) {
  const weeks = [...new Set([weekOf(today), weekIdFor(today)])];
  for (const wid of weeks) {
    fillWeek(state, data, wid);
    const night = nightFor(state, wid, today);
    if (night) {
      return { mode: 'tonight', date: today, weekId: wid, night, recipe: byId(data, getWeek(state, wid).meals[today]) };
    }
  }
  const planWeek = weekIdFor(today);
  for (const wid of [planWeek, addDays(planWeek, 7)]) {
    fillWeek(state, data, wid);
    const week = getWeek(state, wid);
    const next = nightsForWeek(wid, state.nights, week).find((n) => n.date > today);
    if (next) return { mode: 'next', date: next.date, weekId: wid, night: next, recipe: byId(data, week.meals[next.date]) };
  }
  return { mode: 'none' };
}

// "Cook something tonight anyway": a family meal with weeknight scoring. Never changes the plan.
export function anyway(state, data, today, n = 0, exclude = []) {
  const used = usedInWeek(state, weekIdFor(today), null);
  const { list } = candidates(state, data, { date: today, kind: 'family', used, exclude });
  return pickFrom(list, state, data, today, `anyway${today}${n}`, true);
}

// Recent history row writer: once per date + recipe.
export function recordCooked(state, date, id) {
  const h = state.history || (state.history = []);
  if (!h.some((r) => r.date === date && r.id === id)) h.push({ date, id });
}
