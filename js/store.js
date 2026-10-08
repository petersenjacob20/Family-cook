// On-device storage (build plan section 5). One localStorage key holding one JSON object.
// Pure helpers are importable from Node; browser APIs are only touched inside functions.

export const KEY = 'fc.v1';
export const SCHEMA = 1;

export function defaults() {
  return {
    schema: SCHEMA,
    setupDone: false,
    people: [{ id: 'p1', name: 'You', role: 'adult', likes: [], never: [] }],
    allergies: [],
    nights: { weekly: [], fridayAlt: { on: false, anchor: null }, gamedayDefault: false },
    weeks: {},
    history: [],
    ratings: {},
    timers: [],
    needChecked: {},
    showProtein: false, // "Show protein options" on recipe screens. Off by default; stays on this phone.
  };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Household allergy ids (one set for everyone). Anything else is dropped on load.
export const ALLERGY_IDS = ['peanut', 'treenut'];

// schema bumps get a step here. v1 has none; additive fields are filled in here so
// state saved before they existed still loads (allergies came later: start with none).
export function migrate(obj) {
  if (!('allergies' in obj)) return { ...obj, allergies: [] };
  return obj;
}

function cleanPerson(p, i) {
  if (!isObj(p)) return null;
  const words = (a) => (Array.isArray(a) ? a.filter((w) => typeof w === 'string' && w.trim()).map((w) => w.trim()) : []);
  const out = {
    id: typeof p.id === 'string' && p.id ? p.id : 'p' + (i + 1),
    name: typeof p.name === 'string' ? p.name : '',
    role: p.role === 'kid' ? 'kid' : 'adult',
    likes: words(p.likes),
    never: words(p.never),
  };
  if (Number.isFinite(p.age)) out.age = p.age;
  return out;
}

// Merge a parsed object over the defaults. Never throws.
export function normalize(obj) {
  const d = defaults();
  if (!isObj(obj)) return d;
  const o = migrate(obj);
  const s = { ...d };
  s.setupDone = o.setupDone === true;
  if (Array.isArray(o.people)) {
    const ppl = o.people.map(cleanPerson).filter(Boolean);
    if (ppl.length) s.people = ppl;
  }
  if (Array.isArray(o.allergies)) s.allergies = ALLERGY_IDS.filter((id) => o.allergies.includes(id));
  if (isObj(o.nights)) {
    const n = o.nights;
    s.nights = {
      weekly: Array.isArray(n.weekly) ? [...new Set(n.weekly.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))] : [],
      fridayAlt: {
        on: isObj(n.fridayAlt) && n.fridayAlt.on === true,
        anchor: isObj(n.fridayAlt) && typeof n.fridayAlt.anchor === 'string' ? n.fridayAlt.anchor : null,
      },
      gamedayDefault: n.gamedayDefault === true,
    };
  }
  if (isObj(o.weeks)) {
    s.weeks = {};
    for (const [id, w] of Object.entries(o.weeks)) {
      if (!isObj(w)) continue;
      s.weeks[id] = {
        fridayOverride: typeof w.fridayOverride === 'boolean' ? w.fridayOverride : null,
        gameday: typeof w.gameday === 'boolean' ? w.gameday : null,
        meals: isObj(w.meals) ? { ...w.meals } : {},
        confirmed: w.confirmed === true,
        groceryChecked: Array.isArray(w.groceryChecked) ? w.groceryChecked.filter((x) => typeof x === 'string') : [],
        swaps: isObj(w.swaps) ? { ...w.swaps } : {},
      };
    }
  }
  if (Array.isArray(o.history)) s.history = o.history.filter((r) => isObj(r) && typeof r.date === 'string' && typeof r.id === 'string');
  if (isObj(o.ratings)) {
    s.ratings = {};
    for (const [k, v] of Object.entries(o.ratings)) if (v === 'liked' || v === 'not_again') s.ratings[k] = v;
  }
  if (Array.isArray(o.timers)) s.timers = o.timers.filter((t) => isObj(t) && typeof t.id === 'string');
  if (isObj(o.needChecked)) s.needChecked = { ...o.needChecked };
  s.showProtein = o.showProtein === true;
  return s;
}

export function parse(raw) {
  if (typeof raw !== 'string' || !raw) return defaults();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function load(storage = globalThis.localStorage) {
  try {
    return parse(storage ? storage.getItem(KEY) : null);
  } catch {
    return defaults();
  }
}

export function save(state, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

// Delete my data: remove the key, clear service worker caches, unregister, reload to setup.
export async function deleteAll(env = globalThis) {
  try { env.localStorage.removeItem(KEY); } catch { /* ignore */ }
  try {
    if (env.caches) {
      const keys = await env.caches.keys();
      await Promise.all(keys.filter((k) => String(k).startsWith('fc-')).map((k) => env.caches.delete(k)));
    }
  } catch { /* ignore */ }
  try {
    const sw = env.navigator && env.navigator.serviceWorker;
    if (sw) {
      // Only this app's registration: other sites on the same origin keep theirs.
      const scope = new URL('./', env.location.href).href;
      const regs = await sw.getRegistrations();
      await Promise.all(regs.filter((r) => r.scope === scope).map((r) => r.unregister()));
    }
  } catch { /* ignore */ }
}

// Housekeeping: drop weeks older than 8 weeks, history older than 120 days, keep last 200 rows.
export function housekeep(state, today) {
  const dayNum = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  };
  const t = dayNum(today);
  const weeks = {};
  for (const [id, w] of Object.entries(state.weeks || {})) {
    const n = dayNum(id);
    if (Number.isFinite(n) && t - n <= 56) weeks[id] = w;
  }
  state.weeks = weeks;
  state.history = (state.history || []).filter((r) => {
    const n = dayNum(r.date);
    return Number.isFinite(n) && t - n <= 120;
  }).slice(-200);
  return state;
}
