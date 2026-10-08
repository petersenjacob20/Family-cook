// Planner swap list (pub7): every dinner that fits the night, best first, with search and filter chips.
// Pure, no DOM. Tag data comes from Chef's recipe-tags.json, built into recipes.json as
// data.filterTags (id, label, group) and recipe.filter ({ tags, protein_g, fiber_g }).
import { normalizeText } from './rules.js';
import { getWeek, nightFor, usedInWeek, candidates, rank, eligible } from './planner.js';
import { proteinLine } from './grocery.js';

// Short chip text (Design: 1-2 words, 14 characters or fewer). Chef's full label is the fallback,
// and search matches Chef's labels and ids as well as these.
export const CHIP_LABELS = {
  'high-protein': 'High protein',
  'high-fiber': 'High fiber',
  'veggie-packed': 'Veggie-packed',
  quick: 'Quick',
  chicken: 'Chicken',
  beef: 'Beef',
  pork: 'Pork and ham',
  turkey: 'Turkey',
  meatless: 'No meat',
  pasta: 'Pasta',
  pizza: 'Pizza',
  'tacos-mexican': 'Tacos',
  'burgers-sliders': 'Burgers',
  'sandwiches-subs': 'Sandwiches',
  soups: 'Soup and chili', // Design suggested "Soups and chili" (15); trimmed to fit 14
  bowls: 'Bowls',
  'breakfast-for-dinner': 'Breakfast',
  'sheet-pan': 'Sheet pan',
  'one-pot': 'One pot',
  'game-day': 'Game day',
  'slow-cooker': 'Slow cooker',
};
export const CHIP_MAX = 14;

// The rule each "rule chip" adds to the count line, in plain words (Chef's definitions, shortened so the line fits
// on one row next to "Clear" at 360 px without growing the pinned block past 130 px).
export const RULE_TEXT = {
  'high-protein': '30 g+ protein per serving',
  'high-fiber': '5.6 g+ fiber per serving',
  'veggie-packed': '150 g+ veggies per serving',
  quick: '30 minutes or less',
};

// Rule chips sit before the divider and AND together (and with the food types).
// Food-type chips sit after it and OR with each other.
export const QUICK = 'quick';

export function chipLabel(tag) {
  return CHIP_LABELS[tag.id] || tag.label;
}

export function tagDefs(data) {
  return Array.isArray(data && data.filterTags) ? data.filterTags : [];
}

export function recipeTags(r) {
  return (r && r.filter && Array.isArray(r.filter.tags)) ? r.filter.tags : [];
}

export function isRuleTag(tag) {
  return tag.group === 'nutrition' || tag.id === QUICK;
}

// "About N g protein per serving" for a row, the same line as All recipes and the recipe page; null when there's no number.
export function rowProtein(r) {
  return proteinLine(r) || null;
}

// Chips for a list of recipes: rule chips in file order (nutrition, then Quick), then the food types by
// recipe count (most first, ties A-Z by chip text). Any tag with 0 recipes in the list is hidden.
export function chipsFor(list, data) {
  const count = new Map();
  for (const r of list) for (const t of recipeTags(r)) count.set(t, (count.get(t) || 0) + 1);
  const defs = tagDefs(data).filter((t) => (count.get(t.id) || 0) > 0)
    .map((t) => ({ id: t.id, label: chipLabel(t), group: t.group, rule: isRuleTag(t), count: count.get(t.id) }));
  const rules = [...defs.filter((t) => t.group === 'nutrition'), ...defs.filter((t) => t.id === QUICK && t.group !== 'nutrition')];
  const foods = defs.filter((t) => !t.rule).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { rules, foods };
}

const searchFold = (s) => normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim();

// Text a search can match: the title, plus each food tag's id, Chef's label and the short chip text.
export function searchText(r, data) {
  const defs = new Map(tagDefs(data).map((t) => [t.id, t]));
  const parts = [r.title || ''];
  for (const id of recipeTags(r)) {
    const t = defs.get(id);
    if (!t || t.group !== 'food') continue;
    parts.push(id, t.label, chipLabel(t));
  }
  return searchFold(parts.join(' | '));
}

// Every word typed must appear (case and accents ignored; punctuation counts as a space).
export function matchesQuery(r, query, data) {
  const words = searchFold(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = searchText(r, data);
  return words.every((w) => hay.includes(w));
}

// filters = { query: string, on: Set|array of tag ids }. Order is kept.
export function applyFilters(list, filters, data) {
  const on = new Set((filters && filters.on) || []);
  const defs = new Map(tagDefs(data).map((t) => [t.id, t]));
  const rules = [...on].filter((id) => defs.has(id) && isRuleTag(defs.get(id)));
  const foods = [...on].filter((id) => defs.has(id) && !isRuleTag(defs.get(id)));
  const q = (filters && filters.query) || '';
  return list.filter((r) => {
    const tags = recipeTags(r);
    if (!rules.every((id) => tags.includes(id))) return false;
    if (foods.length && !foods.some((id) => tags.includes(id))) return false;
    return matchesQuery(r, q, data);
  });
}

// The count line (Design, 6a257b8 glance): "67 dinners" with no chip on; with exactly one rule chip on, its rule in
// plain words ("29 dinners · 30 g or more protein per serving"); with a single food chip or 2+ chips, the short chip
// names in chip-row order ("10 dinners · High fiber, Chicken"). Typed text alone is not named.
// `order` is the chip-row order of tag ids (defaults to rule chips, then Chef's file order).
export function countLine(n, on, data, order = null) {
  const ids = [...new Set(on || [])];
  const head = `${n} ${n === 1 ? 'dinner' : 'dinners'}`;
  if (!ids.length) return head;
  const defs = new Map(tagDefs(data).map((t) => [t.id, t]));
  if (ids.length === 1 && RULE_TEXT[ids[0]]) return `${head} \u00b7 ${RULE_TEXT[ids[0]]}`;
  const seq = order || [...tagDefs(data).filter(isRuleTag), ...tagDefs(data).filter((t) => !isRuleTag(t))].map((t) => t.id);
  const pos = (id) => { const i = seq.indexOf(id); return i < 0 ? seq.length : i; };
  const names = ids.filter((id) => defs.has(id)).sort((x, y) => pos(x) - pos(y)).map((id) => chipLabel(defs.get(id)));
  return names.length ? `${head} \u00b7 ${names.join(', ')}` : head;
}

// The count line's "Clear" shows once a chip is on or text is typed; it resets both (same as the empty-state button).
export function hasFilters(f) {
  return Boolean(f && ((f.on && f.on.length) || (f.query && f.query.trim())));
}
export function resetFilters(f) {
  f.query = '';
  f.on = [];
  return f;
}

// The full swap list for a night, best first. The planner's ranked candidates come first, in the same
// order as the old 3-at-a-time picker, then every other eligible dinner (on another night this week or
// cooked lately), ranked the same way. The current dinner and blocked dinners never appear.
export function swapList(state, data, weekId, date) {
  const night = nightFor(state, weekId, date);
  if (!night) return { night: null, current: null, list: [] };
  const week = getWeek(state, weekId);
  const current = week.meals[date] || null;
  const used = usedInWeek(state, weekId, date);
  const exclude = current ? [current] : [];
  const seed = `${weekId}${date}${week.swaps[date] || 0}swap`;
  const { list } = candidates(state, data, { date, kind: night.kind, used, exclude });
  return { night, current, list: withRest(list, state, data, night.kind, exclude, date, seed, night.weeknight) };
}

// Not a planned night ("cook anyway"): every family dinner except the one showing, best first.
export function anywayList(state, data, date, currentId) {
  const exclude = currentId ? [currentId] : [];
  const seed = `anyway${date}swap`;
  const { list } = candidates(state, data, { date, kind: 'family', used: [], exclude });
  return withRest(list, state, data, 'family', exclude, date, seed, true);
}

function withRest(first, state, data, kind, exclude, date, seed, weeknight) {
  const head = rank(first, state, data, date, seed, weeknight).map((x) => x.recipe);
  const seen = new Set(head.map((r) => r.id));
  const rest = (data.recipes || []).filter((r) => !seen.has(r.id) && !exclude.includes(r.id) && eligible(r, kind, state, data));
  return head.concat(rank(rest, state, data, date, seed, weeknight).map((x) => x.recipe));
}
