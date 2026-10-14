// Your own recipes ("Add custom recipe"): pure helpers plus the on-phone photo store. Nothing here touches the
// network. Recipes live in localStorage under their own fc- key (fc.v1 is unchanged); photos live in IndexedDB
// (database fc-photos), as a resized JPEG data: URL (CSP img-src already allows data:, so it is unchanged).
import { normalizeText, guardList, guardWarnList } from './rules.js';
import { SECTIONS } from './grocery.js';

export const CUSTOM_KEY = 'fc-custom-recipes';
export const PHOTO_DB = 'fc-photos';
export const PHOTO_STORE = 'photos';
export const PHOTO_MAX = 1024;
export const PHOTO_QUALITY = 0.85;
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024; // a phone photo bigger than this is refused before decoding
export const ID_PREFIX = 'custom-';
export const MAX_RECIPES = 200;
export const MAX_INGREDIENTS = 40;
export const MAX_STEPS = 30;

// Units you can pick ('' = a plain count). The same units the grocery list already merges.
export const UNITS = [
  ['', 'count'], ['tsp', 'tsp'], ['tbsp', 'tbsp'], ['cup', 'cup'], ['oz', 'oz'], ['lb', 'lb'],
  ['can', 'can'], ['jar', 'jar'], ['bag', 'bag'], ['box', 'box'], ['pkg', 'pkg'], ['bunch', 'bunch'], ['clove', 'clove'], ['slice', 'slice'],
];
const UNIT_IDS = UNITS.map(([u]) => u);
const SECTION_IDS = SECTIONS.map(([id]) => id);

// The nut and fish guard lives in rules.js (guardScan): roots matched inside words, stems with any ending, short
// words whole-word only, an allowlist, and warn-only words. The same check drops items before the Amazon Fresh import.
export { GUARD_FISH, GUARD_NUT, GUARD_ALLOW, GUARD_ROOTS_FISH, GUARD_ROOTS_NUT, GUARD_WHOLE, GUARD_WARN } from './rules.js';

// Guard words in one piece of text. [] when clean.
export function guardWords(text, vocab = {}) {
  return guardList(text, vocab);
}

// Every guard hit in a draft or a saved recipe: [{ where, text, words }].
export function guardHits(r, vocab) {
  const hits = [];
  const check = (where, text) => { const words = guardWords(text, vocab); if (words.length) hits.push({ where, text: String(text), words }); };
  check('Name', r && r.title);
  ((r && r.ingredients) || []).forEach((i, n) => check(`Ingredient ${n + 1}`, i && i.name));
  ((r && r.steps) || []).forEach((s, n) => check(`Step ${n + 1}`, s && s.text));
  return hits;
}

// Warn-only words (mole, granola, biscotti ...): shown, the recipe can still be saved.
export function warnHits(r, vocab) {
  const hits = [];
  const check = (where, text) => { const words = guardWarnList(text, vocab); if (words.length) hits.push({ where, text: String(text), words }); };
  check('Name', r && r.title);
  ((r && r.ingredients) || []).forEach((i, n) => check(`Ingredient ${n + 1}`, i && i.name));
  ((r && r.steps) || []).forEach((s, n) => check(`Step ${n + 1}`, s && s.text));
  return hits;
}

export function guardMessage(hits) {
  if (!hits.length) return '';
  const words = [...new Set(hits.flatMap((h) => h.words))];
  return `Not saved: this has a nut or fish word (${words.join(', ')}) in ${hits.map((h) => h.where).join(', ')}. Your family plan is nut-free and fish-free, so take it out to save.`;
}

const slug = (s) => normalizeText(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt; };

// One draft -> { ok, error, recipe }. The id is kept on edit; a new one is made from `newId` otherwise.
export function makeRecipe(draft, vocab, { id, newId } = {}) {
  const title = str(draft && draft.title, 60);
  if (!title) return { ok: false, error: 'Give your recipe a name.' };
  const ingredients = [];
  const seen = new Set();
  for (const i of (draft.ingredients || []).slice(0, MAX_INGREDIENTS)) {
    const name = str(i && i.name, 80);
    if (!name) continue;
    const key = slug(name) || 'item';
    const unit = UNIT_IDS.includes(i.unit) ? i.unit : '';
    const qty = num(i.qty, 0.01, 999, null);
    if (qty == null) return { ok: false, error: `Add an amount for ${name}.` };
    const section = SECTION_IDS.includes(i.section) ? i.section : 'other';
    const k = seen.has(`${key}|${unit}`) ? `${key}-${ingredients.length + 1}`.slice(0, 60) : key;
    seen.add(`${key}|${unit}`);
    ingredients.push({ key: k, name, qty, unit, section, check_label: true });
  }
  if (!ingredients.length) return { ok: false, error: 'Add at least one ingredient.' };
  const steps = (draft.steps || []).map((s) => str(typeof s === 'string' ? s : s && s.text, 300)).filter(Boolean).slice(0, MAX_STEPS)
    .map((text) => ({ who: 'adult', text }));
  if (!steps.length) return { ok: false, error: 'Add at least one step.' };
  const recipe = {
    id: id || `${ID_PREFIX}${newId || Date.now().toString(36)}`,
    title,
    kind: 'family',
    effort: 'easy',
    hands_on_min: num(draft.hands_on_min, 1, 45, 30),
    total_min: num(draft.total_min, 1, 600, 30),
    serves: num(draft.serves, 1, 20, 4),
    tags: ['custom'],
    contains: [],
    ingredients,
    steps,
    custom: true,
  };
  if (draft.hasPhoto) recipe.hasPhoto = true;
  const hits = guardHits(recipe, vocab);
  // A guard hit is never saved from the form; the built recipe comes back too, so a stored one can be kept (blocked).
  if (hits.length) return { ok: false, error: guardMessage(hits), hits, recipe };
  return { ok: true, error: '', recipe };
}

// Saved recipes, read on load. Nothing stored is ever dropped from storage: a recipe with a guard hit is kept and
// marked `blocked` (hidden from the plan, swaps, grocery and Fresh, shown in My recipes with the warning).
// Entries that can't be read at all stay in storage untouched (see saveCustom).
export function cleanCustom(list, vocab) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const ids = new Set();
  for (const r of list.slice(0, MAX_RECIPES)) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !/^custom-[a-z0-9-]{1,40}$/.test(r.id) || ids.has(r.id)) continue;
    const res = makeRecipe({ ...r, steps: r.steps }, vocab, { id: r.id });
    if (!res.recipe) continue;
    ids.add(r.id);
    out.push(res.ok ? res.recipe : { ...res.recipe, blocked: res.hits.map((h) => ({ where: h.where, words: h.words })) });
  }
  return out;
}

export function loadCustom(vocab, storage = globalThis.localStorage) {
  try {
    const raw = storage ? storage.getItem(CUSTOM_KEY) : null;
    if (raw == null) return [];
    const v = JSON.parse(raw);
    return cleanCustom(v && v.recipes, vocab);
  } catch {
    return [];
  }
}

export const UNREADABLE_KEY = 'fc-custom-recipes-unreadable';
const strip = (r) => { const { blocked, ...rest } = r; return rest; };

// Write the list. Never loses data: stored entries the app couldn't read (or doesn't know) are kept as they were,
// unless `removeId` names the one recipe you deleted. If the stored value isn't readable at all, it is kept under
// fc-custom-recipes-unreadable first.
export function saveCustom(list, storage = globalThis.localStorage, { removeId } = {}) {
  try {
    let keep = [];
    const raw = storage.getItem(CUSTOM_KEY);
    if (raw != null) {
      let v = null;
      try { v = JSON.parse(raw); } catch { v = null; }
      if (v && Array.isArray(v.recipes)) {
        const known = new Set(list.map((r) => r.id));
        keep = v.recipes.filter((r) => !(r && typeof r === 'object' && (known.has(r.id) || (removeId && r.id === removeId))));
      } else if (storage.getItem(UNREADABLE_KEY) == null) {
        storage.setItem(UNREADABLE_KEY, raw);
      }
    }
    const all = list.map(strip).concat(keep);
    if (!all.length) storage.removeItem(CUSTOM_KEY);
    else storage.setItem(CUSTOM_KEY, JSON.stringify({ v: 1, recipes: all }));
    return true;
  } catch {
    return false;
  }
}

// The recipe list the app uses: the built-in recipes, then yours. With none, it is the built-in list itself.
export function withCustom(recipes, custom) {
  const base = (recipes || []).filter((r) => !r.custom);
  return custom && custom.length ? base.concat(custom) : base;
}

export function customOf(data) {
  return ((data && data.recipes) || []).filter((r) => r.custom);
}

// Put a new or edited recipe in: storage and ctx.data.recipes both.
export function upsertCustom(ctx, recipe, storage) {
  const list = customOf(ctx.data).filter((r) => r.id !== recipe.id);
  const at = customOf(ctx.data).findIndex((r) => r.id === recipe.id);
  if (at >= 0) list.splice(at, 0, recipe); else list.push(recipe);
  saveCustom(list, storage);
  ctx.data.recipes = withCustom(ctx.data.recipes, list);
  return list;
}

// Take one recipe out of the plan and every per-recipe record. Planned nights it held are refilled next time
// the week is shown (fillWeek), and its swap count for that night is cleared.
export function removeFromState(state, id) {
  for (const week of Object.values(state.weeks || {})) {
    if (!week || !week.meals) continue;
    for (const [date, rid] of Object.entries(week.meals)) {
      if (rid !== id) continue;
      delete week.meals[date];
      if (week.swaps) delete week.swaps[date];
    }
  }
  if (state.needChecked) delete state.needChecked[id];
  if (state.ratings) delete state.ratings[id];
  if (Array.isArray(state.history)) state.history = state.history.filter((h) => h.id !== id);
  return state;
}

export async function deleteCustom(ctx, id, { storage, idb } = {}) {
  const list = customOf(ctx.data).filter((r) => r.id !== id);
  saveCustom(list, storage, { removeId: id });
  ctx.data.recipes = withCustom(ctx.data.recipes, list);
  removeFromState(ctx.state, id);
  ctx.save();
  await deletePhoto(id, idb);
  return list;
}

// Export ("Share my recipes" in Settings): plain text of your recipes. '' when there are none (nothing is shown).
export function exportText(custom) {
  if (!custom || !custom.length) return '';
  const amount = (i) => [i.qty, i.unit].filter((x) => x !== '' && x != null).join(' ');
  return custom.map((r) => [
    r.title.toUpperCase(),
    `Serves ${r.serves} \u00b7 about ${r.total_min} min`,
    'Ingredients:', ...r.ingredients.map((i) => `- ${amount(i)} ${i.name}`.replace(/\s+/g, ' ')),
    'Steps:', ...r.steps.map((s, n) => `${n + 1}. ${s.text}`),
  ].join('\n')).join('\n\n');
}

// ---------- Photo resize (client side, no network) ----------
// Longest side at most `max`, never upscaled, whole pixels, never 0.
export function fitSize(w, h, max = PHOTO_MAX) {
  const W = Math.max(1, Math.round(Number(w) || 0)); const H = Math.max(1, Math.round(Number(h) || 0));
  const s = Math.min(1, max / Math.max(W, H));
  return { width: Math.max(1, Math.round(W * s)), height: Math.max(1, Math.round(H * s)) };
}

export const PHOTO_URL_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

// A picked file -> a JPEG data: URL, longest side <= 1024. deps let tests run without a browser.
export async function resizePhoto(file, deps = {}) {
  const decode = deps.createImageBitmap || globalThis.createImageBitmap;
  const makeCanvas = deps.makeCanvas || ((w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; });
  if (!file || !/^image\//.test(file.type || '')) throw new Error('not-image');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('too-big');
  if (typeof decode !== 'function') throw new Error('no-decoder');
  const bmp = await decode(file, { imageOrientation: 'from-image' });
  const { width, height } = fitSize(bmp.width, bmp.height);
  const canvas = makeCanvas(width, height);
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, width, height); // JPEG has no transparency
  g.drawImage(bmp, 0, 0, width, height);
  if (typeof bmp.close === 'function') bmp.close();
  const url = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
  if (!PHOTO_URL_RE.test(url)) throw new Error('encode-failed');
  return url;
}

// ---------- Photo store: IndexedDB fc-photos / photos, key = recipe id, value = data: URL ----------
function openDb(idb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!idb) { reject(new Error('no-idb')); return; }
    const req = idb.open(PHOTO_DB, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb'));
  });
}
async function withStore(mode, fn, idb) {
  const db = await openDb(idb);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, mode);
      const req = fn(tx.objectStore(PHOTO_STORE));
      let out;
      if (req) req.onsuccess = () => { out = req.result; };
      tx.oncomplete = () => resolve(out);
      tx.onerror = () => reject(tx.error || new Error('idb'));
      tx.onabort = () => reject(tx.error || new Error('idb'));
    });
  } finally { if (db.close) db.close(); }
}
export async function putPhoto(id, url, idb) {
  if (!PHOTO_URL_RE.test(url)) throw new Error('bad-photo');
  await withStore('readwrite', (s) => s.put(url, id), idb);
  return true;
}
export async function getPhoto(id, idb) {
  try { const v = await withStore('readonly', (s) => s.get(id), idb); return typeof v === 'string' && PHOTO_URL_RE.test(v) ? v : null; } catch { return null; }
}
export async function deletePhoto(id, idb) {
  try { await withStore('readwrite', (s) => s.delete(id), idb); return true; } catch { return false; }
}
