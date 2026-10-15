// "Choose protein option" (Grocery tab and Amazon Fresh screen): per meal of this week, Regular or one of the
// recipe's protein swaps. Kept on this phone under fc-protein-choices, by week start: { v: 1, weeks: { [weekId]: { [date]: swapId } } }.
// Regular = no entry. The options are rules.js visibleSwaps (the same list the "Show protein options" toggle shows on
// What you need), so a swap hidden for your family is never offered and never applied.
import { visibleSwaps } from './rules.js';
import { nightsForWeek, weekday } from './dates.js';

export const PROTEIN_KEY = 'fc-protein-choices';

function read(storage) {
  try {
    const raw = storage ? storage.getItem(PROTEIN_KEY) : null;
    const v = raw == null ? null : JSON.parse(raw);
    return v && typeof v === 'object' && v.weeks && typeof v.weeks === 'object' && !Array.isArray(v.weeks) ? v.weeks : {};
  } catch {
    return {};
  }
}

// This week's saved picks: { [date]: swapId }.
export function loadChoices(weekId, storage = globalThis.localStorage) {
  const w = read(storage)[weekId];
  const out = {};
  if (w && typeof w === 'object') for (const [d, id] of Object.entries(w)) if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof id === 'string') out[d] = id;
  return out;
}

// Save one meal's pick (null = Regular). Weeks before this one are dropped.
export function saveChoice(weekId, date, swapId, storage = globalThis.localStorage) {
  try {
    const weeks = read(storage);
    const keep = {};
    for (const [k, v] of Object.entries(weeks)) if (k >= weekId) keep[k] = v;
    const cur = { ...(keep[weekId] || {}) };
    if (swapId) cur[date] = swapId; else delete cur[date];
    if (Object.keys(cur).length) keep[weekId] = cur; else delete keep[weekId];
    if (Object.keys(keep).length) storage.setItem(PROTEIN_KEY, JSON.stringify({ v: 1, weeks: keep }));
    else storage.removeItem(PROTEIN_KEY);
    return true;
  } catch {
    return false;
  }
}

// The meals on the days that are on: [{ date, recipe, swaps }] in night order.
export function proteinMeals(state, data, recipeById, weekId, days) {
  const week = (state.weeks && state.weeks[weekId]) || { meals: {} };
  const out = [];
  for (const n of nightsForWeek(weekId, state.nights, week)) {
    if (Array.isArray(days) && !days.includes(weekday(n.date))) continue;
    const r = recipeById(week.meals ? week.meals[n.date] : null);
    if (r) out.push({ date: n.date, recipe: r, swaps: visibleSwaps(r, state, data.vocab) });
  }
  return out;
}

// The swaps in effect: { [date]: swap }, only for saved picks that are still offered for that day's meal.
export function activeSwaps(state, data, recipeById, weekId, days, storage = globalThis.localStorage) {
  const picks = loadChoices(weekId, storage);
  const out = {};
  for (const m of proteinMeals(state, data, recipeById, weekId, days)) {
    const w = picks[m.date] && m.swaps.find((s) => s.id === picks[m.date]);
    if (w) out[m.date] = w;
  }
  return out;
}

// The radio label for one option.
export function optionLabel(swap, recipe) {
  if (!swap) return 'Regular';
  const name = swap.use && swap.use.name;
  if (swap.type === 'add') return `Add ${name}`;
  const was = ((recipe && recipe.ingredients) || []).find((i) => i.key === swap.replaces);
  return was ? `${name} instead of ${was.name}` : name;
}
