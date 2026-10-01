// Grocery list (build plan section 10): merge, units, sections, share text. Pure, no DOM.
import { nightsForWeek, addDays, shortLabel, weekday, DAY_SHORT } from './dates.js';

export const SECTIONS = [
  ['produce', 'Produce'],
  ['meat', 'Meat'],
  ['dairy', 'Dairy & cheese'],
  ['bakery', 'Bakery'],
  ['pantry', 'Pantry & dry goods'],
  ['frozen', 'Frozen'],
  ['other', 'Other'],
];
const SECTION_IDS = SECTIONS.map(([id]) => id);
const VOL = { tsp: 1, tbsp: 3, cup: 48 };
const WT = { oz: 1, lb: 16 };
const UNIT_PLURAL = { box: 'boxes', bunch: 'bunches', pinch: 'pinches', pkg: 'pkg', can: 'cans', jar: 'jars', bag: 'bags', clove: 'cloves', slice: 'slices' };

export function unitFamily(unit) {
  if (unit in VOL) return 'vol';
  if (unit in WT) return 'wt';
  return unit ? unit : 'count';
}

export function toBase(qty, unit) {
  const q = Number(qty) || 0;
  if (unit in VOL) return q * VOL[unit];
  if (unit in WT) return q * WT[unit];
  return q;
}

export function roundUpQuarter(x) {
  return Math.ceil(x * 4 - 1e-9) / 4;
}

const FRAC = { 0: '', 0.25: '\u00BC', 0.5: '\u00BD', 0.75: '\u00BE' };
export function fraction(x) {
  const whole = Math.floor(x + 1e-9);
  const f = FRAC[Math.round((x - whole) * 4) / 4] ?? '';
  if (whole && f) return `${whole} ${f}`;
  if (f) return f;
  return String(whole);
}

export function pluralUnit(unit, n) {
  if (n <= 1) return unit;
  return UNIT_PLURAL[unit] || unit + 's';
}

export function pluralName(name, n) {
  if (n <= 1) return singularName(name);
  const m = name.match(/^(\S+)( of .*)$/);
  if (m) return pluralWord(m[1]) + m[2];
  return pluralWord(name);
}

// Names in the recipe file are written the way you'd buy them ("eggs", "russet potatoes").
// For a count of exactly one, make the counted word singular ("1 egg"). Only simple, safe
// endings are handled; anything else is left alone.
export function singularName(name) {
  const m = name.match(/^(\S+)( of .*)$/);
  if (m) return singularWord(m[1]) + m[2];
  const i = name.lastIndexOf(' ');
  return name.slice(0, i + 1) + singularWord(name.slice(i + 1));
}

export function singularWord(w) {
  if (w.length < 4 || !/s$/i.test(w)) return w;
  if (/(ss|us|is)$/i.test(w) || /^fries$/i.test(w)) return w; // glass, hummus, fries
  if (/rries$/i.test(w)) return w.slice(0, -3) + 'y'; // berries -> berry
  if (/(oes|ches|shes|xes|sses)$/i.test(w)) return w.slice(0, -2); // potatoes, peaches, boxes
  return w.slice(0, -1); // eggs, apples, cookies
}

function pluralWord(w) {
  if (/s$/i.test(w)) return w;
  if (/loaf$/i.test(w)) return w.replace(/f$/i, 'ves');
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + 'ies';
  if (/(ch|sh|x|o)$/i.test(w)) return w + 'es';
  return w + 's';
}

// Amount for a merged total in base units ("1 ¾ lbs", "2 cups", "3 cans").
export function formatAmount(family, total, unit) {
  if (family === 'vol') {
    if (total >= 12) { const c = roundUpQuarter(total / 48); return `${fraction(c)} ${c > 1 ? 'cups' : 'cup'}`; }
    if (total >= 3) return `${fraction(roundUpQuarter(total / 3))} tbsp`;
    return `${fraction(roundUpQuarter(total))} tsp`;
  }
  if (family === 'wt') {
    if (total >= 16) { const lb = roundUpQuarter(total / 16); return `${fraction(lb)} ${lb > 1 ? 'lbs' : 'lb'}`; }
    return `${fraction(roundUpQuarter(total))} oz`;
  }
  const n = Math.max(1, Math.ceil(total - 1e-9));
  return family === 'count' ? String(n) : `${n} ${pluralUnit(unit, n)}`;
}

// Full line text: amount + name ("2 bell peppers", "2 jars of pasta sauce", "1 ¼ cups milk").
export function itemText(family, total, unit, name) {
  if (family === 'count') {
    const n = Math.max(1, Math.ceil(total - 1e-9));
    return `${n} ${pluralName(name, n)}`;
  }
  const amount = formatAmount(family, total, unit);
  const prefix = `${unit} of `;
  if (unit && name.toLowerCase().startsWith(prefix)) return `${amount} of ${name.slice(prefix.length)}`;
  return `${amount} ${name}`;
}

// One ingredient on its own, for "What you need".
export function ingredientAmount(ing) {
  if (ing.staple || ing.qty == null) return '';
  const fam = unitFamily(ing.unit || '');
  return fam === 'count' ? String(Math.ceil(ing.qty)) : formatAmount(fam, toBase(ing.qty, ing.unit), ing.unit);
}

export function cutTitle(t, n = 18) {
  return t.length > n ? t.slice(0, n).trimEnd() + '\u2026' : t;
}

export function lineId(section, key, fam) {
  return `${section}|${key}|${fam}`;
}

// Build the week's list from the active nights. `recipeById(id)` returns a recipe or null.
export function buildList(state, recipeById, weekId) {
  const week = (state.weeks && state.weeks[weekId]) || { meals: {}, groceryChecked: [] };
  const checked = new Set(week.groceryChecked || []);
  const nights = nightsForWeek(weekId, state.nights, week);
  const merged = new Map();
  const staples = new Map();
  let last = addDays(weekId, 4);
  for (const night of nights) {
    const r = recipeById(week.meals ? week.meals[night.date] : null);
    if (!r) continue;
    if (night.date > last) last = night.date;
    const use = `${DAY_SHORT[weekday(night.date)]} ${cutTitle(r.title)}`;
    for (const ing of r.ingredients || []) {
      if (ing.optional) continue;
      if (ing.staple) {
        if (!staples.has(ing.key)) staples.set(ing.key, { id: lineId(ing.section || 'pantry', ing.key, 'staple'), key: ing.key, name: ing.name });
        continue;
      }
      const unit = ing.unit || '';
      const fam = unitFamily(unit);
      const mk = `${ing.key}|${fam}`;
      if (!merged.has(mk)) {
        const section = SECTION_IDS.includes(ing.section) ? ing.section : 'other';
        merged.set(mk, { id: lineId(section, ing.key, fam), key: ing.key, name: ing.name, section, fam, unit, total: 0, uses: [], checkLabel: false });
      }
      const m = merged.get(mk);
      if (ing.check_label === true) m.checkLabel = true; // flagged if ANY source is flagged
      m.total += toBase(ing.qty, unit);
      if (!m.uses.includes(use)) m.uses.push(use);
    }
  }
  const sections = SECTIONS.map(([id, label]) => ({
    id,
    label,
    lines: [...merged.values()]
      .filter((m) => m.section === id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({
        id: m.id,
        key: m.key,
        text: itemText(m.fam, m.total, m.unit, m.name),
        hint: `for: ${m.uses.join(', ')}`,
        checkLabel: m.checkLabel,
        checked: checked.has(m.id),
      })),
  })).filter((s) => s.lines.length);
  const stapleList = [...staples.values()].map((s) => ({ ...s, checked: checked.has(s.id) }));
  const ids = [...sections.flatMap((s) => s.lines.map((l) => l.id)), ...stapleList.map((s) => s.id)];
  return { weekId, from: weekId, to: last, sections, staples: stapleList, ids };
}

// A check goes away when its line goes away.
export function pruneChecked(week, list) {
  const keep = new Set(list.ids);
  week.groceryChecked = (week.groceryChecked || []).filter((id) => keep.has(id));
  return week.groceryChecked;
}

export function toggleChecked(week, id) {
  const set = new Set(week.groceryChecked || []);
  if (set.has(id)) set.delete(id); else set.add(id);
  week.groceryChecked = [...set];
  return set.has(id);
}

export function rangeLabel(list) {
  return `${shortLabel(list.from)} \u2013 ${shortLabel(list.to)}`;
}

// Design's label line for store-bought items that are often marked "may contain".
export const LABEL_LINE = 'Check the label for nut warnings.';
export const LABEL_SUFFIX = ' (check label for nut warnings)';

// Plain-text share. Checked lines are left out. Flagged lines get the label note.
export function shareText(list) {
  const out = [`Grocery list (${rangeLabel(list)})`];
  for (const s of list.sections) {
    const lines = s.lines.filter((l) => !l.checked);
    if (!lines.length) continue;
    out.push('', s.label.toUpperCase(), ...lines.map((l) => `- ${l.text}${l.checkLabel ? LABEL_SUFFIX : ''}`));
  }
  const st = list.staples.filter((s) => !s.checked);
  if (st.length) out.push('', 'CHECK YOU HAVE', `- ${st.map((s) => s.name).join(', ')}`);
  return out.join('\n');
}
