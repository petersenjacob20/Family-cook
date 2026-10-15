// Blocked-food rule (build plan section 8). Pure, no DOM.
// A word matches lowercase, as a whole word, ignoring a trailing "s" or "es".

// ---- The one text normalizer. Every match below (nut guard, allergy options, never words,
// vocab synonyms, likes) runs on text that went through normalizeText first:
//   1. Unicode NFKC (full-width letters -> plain ASCII, ligatures split, odd spaces -> space)
//   2. strip soft hyphens and zero-width characters (U+00AD, U+200B, U+200C, U+200D, U+2060, U+FEFF)
//   3. Unicode dashes (U+2010..U+2015, U+2212) -> "-"
//   4. tabs, NBSP and all remaining Unicode spaces -> " ", repeats collapsed, ends trimmed
//   5. accents dropped (jalapeño -> jalapeno), lowercase
const HIDDEN_RE = /[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g;
const DASH_RE = /[\u2010-\u2015\u2212]/g;
export function normalizeText(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .replace(HIDDEN_RE, '')
    .replace(DASH_RE, '-')
    .replace(/\s+/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}
export const fold = normalizeText;

// The normalized text, plus (only when it had a soft hyphen or zero-width character) a second
// reading where that character splits words instead of vanishing. A match in either counts, so
// "pine<zero-width>nut" is still caught as "pine nut" even though stripping gives "pinenut".
export function textVariants(s) {
  const raw = String(s == null ? '' : s);
  const a = normalizeText(raw);
  if (!/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/.test(raw)) return [a];
  const b = normalizeText(raw.replace(HIDDEN_RE, ' '));
  return a === b ? [a] : [a, b];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Base forms of a word: itself, minus a trailing "s", minus a trailing "es".
// A typed hyphen counts as a space, so "pine-nut" and "ground-nut" work like "pine nut".
export function bases(word) {
  const w = normalizeText(word).replace(/-/g, ' ').replace(/ +/g, ' ').trim();
  const out = new Set();
  if (!w) return out;
  out.add(w);
  if (w.length > 2 && w.endsWith('s')) out.add(w.slice(0, -1));
  if (w.length > 3 && w.endsWith('es')) out.add(w.slice(0, -2));
  return out;
}

// Every word that counts for this never/like word, including vocab synonyms.
export function expand(word, vocab = {}) {
  const terms = new Set(bases(word));
  for (const [tag, syns] of Object.entries(vocab || {})) {
    const group = [tag, ...(Array.isArray(syns) ? syns : [])];
    const hit = group.some((g) => [...bases(g)].some((b) => terms.has(b)));
    if (hit) for (const g of group) for (const b of bases(g)) terms.add(b);
  }
  return terms;
}

const caches = new WeakMap();
const NO_VOCAB = {};
export function matcher(word, vocab) {
  const v = vocab || NO_VOCAB;
  if (!caches.has(v)) caches.set(v, new Map());
  const c = caches.get(v);
  const key = fold(word);
  if (c.has(key)) return c.get(key);
  const terms = [...expand(word, v)].filter(Boolean).sort((a, b) => b.length - a.length);
  const re = terms.length
    ? new RegExp(`(?:^|[^a-z0-9])(?:${terms.map((t) => esc(t).replace(/ /g, '[^a-z0-9]+')).join('|')})(?:es|s)?(?=[^a-z0-9]|$)`)
    : null;
  c.set(key, re);
  return re;
}

export function wordMatches(word, text, vocab) {
  const re = matcher(word, vocab);
  return re ? textVariants(text).some((t) => re.test(t)) : false;
}

// Everything about a recipe a never word is checked against. Optional ingredients count too.
export function recipeTexts(recipe) {
  const out = [recipe.title || '', ...(recipe.contains || []), ...(recipe.tags || [])];
  for (const ing of recipe.ingredients || []) {
    out.push(ing.name || '');
    out.push(String(ing.key || '').replace(/-/g, ' '));
  }
  return out.filter(Boolean);
}

// The never words (from anyone) that block this recipe.
export function blockingWords(recipe, people, vocab) {
  const texts = recipeTexts(recipe);
  const hits = [];
  for (const p of people || []) {
    for (const w of p.never || []) {
      if (!fold(w)) continue;
      if (texts.some((t) => wordMatches(w, t, vocab)) && !hits.some((x) => fold(x) === fold(w))) hits.push(w);
    }
  }
  return hits;
}

export function isBlocked(recipe, people, vocab) {
  return blockingWords(recipe, people, vocab).length > 0;
}

// Likes matching: same whole-word matching against tags, title and ingredients.
// No vocab expansion here, so liking "Alfredo" doesn't boost every cheesy meal.
export function likedBy(recipe, people, vocab) {
  const texts = [recipe.title || '', ...(recipe.tags || []), ...(recipe.ingredients || []).flatMap((i) => [i.name || '', String(i.key || '').replace(/-/g, ' ')])];
  return (people || []).some((p) => (p.likes || []).some((w) => fold(w) && texts.some((t) => wordMatches(w, t, null))));
}

// "No fish. No asparagus." or "" when nobody has a never list.
export function neverSummary(people) {
  const seen = [];
  for (const p of people || []) for (const w of p.never || []) {
    const f = fold(w);
    if (f && !seen.includes(f)) seen.push(f);
  }
  return seen.map((w) => `No ${w}.`).join(' ');
}

// ---- Nut guard (always on) and the household Allergies hard exclude. ----
// Whole words / phrases only, case-insensitive, plurals allowed. Never a bare "nut" substring,
// so "minutes", "butternut squash" and "nutmeg" never match. "groundnut" / "ground nut" (another
// name for peanut) is caught in every form: groundnuts, ground nuts, ground-nut(s); "ground beef" is not.
// Also peanut's other names: arachis (oil) and goober (peas).
export const NUT_TERMS = [
  'peanut', 'groundnut', 'ground nut', 'arachis', 'arachis oil', 'goober', 'goober pea', 'almond', 'walnut', 'pecan', 'cashew', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut',
  'chestnut', 'filbert', 'coconut', 'pesto', 'nutella', 'praline', 'marzipan', 'nougat', 'satay', 'granola', 'trail mix',
  'nut butter', 'nut oil', 'nut flour', 'nut milk', 'nut',
];
export const NUT_ALLOW = ['butternut', 'nutmeg', 'doughnut'];

// No lookbehind (older iPhone Safari can't parse it): the leading boundary is a group instead.
const NUT_RE = new RegExp(
  `(^|[^a-z0-9])(${[...NUT_TERMS].sort((a, b) => b.length - a.length).map((t) => esc(t).replace(/ /g, '[^a-z0-9]+')).join('|')})(?:es|s)?(?=[^a-z0-9]|$)`,
  'g',
);
const ALLOW_RE = new RegExp(`(^|[^a-z0-9])(?:${NUT_ALLOW.join('|')})(?:es|s)?(?=[^a-z0-9]|$)`, 'g');

// The guard words found in one piece of text ([] when clean).
export function nutHits(text) {
  const out = [];
  textVariants(text).forEach((v, i) => {
    const t = v.replace(ALLOW_RE, '$1 ');
    for (const m of t.matchAll(NUT_RE)) {
      const w = m[0].slice(m[1].length);
      if (i === 0 || !out.includes(w)) out.push(w);
    }
  });
  return out;
}

// Every string anywhere in a recipe: title, tags, contains, every ingredient field, every step field.
export function recipeStrings(value, out = []) {
  if (typeof value === 'string') out.push(value.replace(/-/g, ' '));
  else if (Array.isArray(value)) for (const v of value) recipeStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) recipeStrings(v, out);
  return out;
}

export function recipeNutHits(recipe) {
  return recipeStrings(recipe).flatMap(nutHits);
}

// Household allergies: one set for everyone, stored on the phone only.
export const ALLERGIES = [
  { id: 'peanut', label: 'Peanut', line: 'No peanuts.' },
  { id: 'treenut', label: 'Tree nut', line: 'No tree nuts.' },
];

// A recipe conflicts with any picked allergy if it matches the vocab "nuts" group anywhere
// it is checked for never words, or if the nut guard finds a word anywhere in it.
// Strict on purpose: either chip excludes every nut word.
export function allergyConflict(recipe, allergies, vocab) {
  if (!Array.isArray(allergies) || !allergies.some((a) => ALLERGIES.some((x) => x.id === a))) return false;
  if (recipeTexts(recipe).some((t) => wordMatches('nuts', t, vocab))) return true;
  return recipeNutHits(recipe).length > 0;
}

// "No peanuts. No tree nuts." (only the picked ones), or "".
export function allergySummary(allergies) {
  return ALLERGIES.filter((a) => (allergies || []).includes(a.id)).map((a) => a.line).join(' ');
}

// ---- Optional protein swaps (recipe.protein_swaps). A swap is hidden when the item it brings in would be
// blocked for this household: never words (isBlocked) or a picked allergy (allergyConflict), run on a mini
// recipe made of just that swap. The nut guard part also reads the swap's note and basis (strict on purpose).
export function swapMiniRecipe(swap) {
  return {
    title: '', tags: [], contains: (swap && swap.contains) || [], ingredients: swap && swap.use ? [swap.use] : [],
    note: (swap && swap.note) || '', protein: (swap && swap.protein) || {},
  };
}

export function swapHidden(swap, state, vocab) {
  const mini = swapMiniRecipe(swap);
  return isBlocked(mini, (state && state.people) || [], vocab) || allergyConflict(mini, (state && state.allergies) || [], vocab);
}

// The swaps this household can see, in file order. Hidden swaps leave no trace.
export function visibleSwaps(recipe, state, vocab) {
  return ((recipe && recipe.protein_swaps) || []).filter((w) => w && w.optional === true && !swapHidden(w, state, vocab));
}

// ---------- Widened nut and fish guard (your own recipes, and the Amazon drop) ----------
// Text is accent-folded and lowercased first (normalizeText: crème -> creme). Then the allowlisted phrases are
// skipped (only those exact phrases, so 'nut-free peanut sauce' still blocks on peanut), and three kinds of match run:
//   roots   - matched anywhere, even inside another word (codfish, fishsticks, waterchestnut-cashew ...)
//   stems   - matched at the start of a word, any ending (pecan, pecans, praline, praliné ...)
//   whole   - short or ambiguous words, whole word only, plural s/es (uni not unit, sate not saute, cod not code)
// Any word ending in "nut"/"nuts" is a nut too (beechnut, kola nut ...). Coconut stays blocked (policy).
export const GUARD_ROOTS_FISH = ['fish', 'shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'clam', 'oyster', 'squid', 'octopus', 'anchov', 'sardin', 'salmon', 'tuna'];
export const GUARD_ROOTS_NUT = ['peanut', 'almond', 'cashew', 'pecan', 'walnut', 'pistachio', 'hazelnut', 'macadamia', 'noix', 'amand', 'noisette'];
export const GUARD_NUT = [...new Set([
  ...NUT_TERMS.filter((t) => t !== 'granola'),
  'peanut', 'groundnut', 'ground nut', 'goober', 'arachis', 'arachide', 'mandelonia', 'beer nut', 'mixed nut', 'monkey nut', 'nut butter',
  'nut milk', 'nut oil', 'nut meal', 'nut flour', 'almond', 'amande', 'mandel', 'mandorla', 'almendra', 'marcona', 'cashew', 'caju',
  'anacardo', 'pecan', 'walnut', 'noce', 'nuez', 'noix', 'hazelnut', 'filbert', 'nocciola', 'avellana', 'haselnuss', 'pistachio',
  'pistacchio', 'pistache', 'macadamia', 'brazil nut', 'pili nut', 'shea nut', 'chestnut', 'marron', 'castagna', 'beechnut', 'butternut',
  'hickory nut', 'ginkgo', 'lychee nut', 'pine nut', 'pignoli', 'pinon', 'pignon', 'nangai', 'cashew apple',
  'praline', 'pralin', 'nougat', 'torrone', 'turron', 'marzipan', 'almond paste', 'frangipane', 'gianduja', 'nutella', 'amaretti',
  'amaretto', 'frangelico', 'nocino', 'orgeat', 'orzata', 'romesco', 'dukkah', 'satay', 'sate', 'gado gado', 'kare kare', 'baklava',
  'financier', 'trail mix', 'nut extract', 'nut flavoring', 'coconut', 'copra', 'noisette', 'tree nut', 'pesto', 'muhammara', 'pad thai',
  // pub16 QA (da3d7d4): foreign names and common typos
  'pinoli', 'cacahuete', 'mani', 'erdnuss', 'badam', 'kaju', 'noci', 'pindakaas', 'akhrot', 'chironji', 'almnd', 'pistachoi',
])];
export const GUARD_FISH = ['saumon', ...new Set([
  'fish', 'shellfish', 'seafood', 'anchovy', 'anchovies', 'anchoa', 'acciughe', 'anchoi', 'sardine', 'mackerel', 'tuna', 'bonito',
  'katsuobushi', 'dashi', 'hondashi', 'salmon', 'smoked salmon', 'lox', 'trout', 'cod', 'codfish', 'bacalao', 'baccala', 'haddock', 'pollock',
  'pollack', 'tilapia', 'halibut', 'sole', 'flounder', 'snapper', 'herring', 'kipper', 'eel', 'unagi', 'caviar', 'roe', 'ikura', 'tobiko',
  'masago', 'surimi', 'kamaboko', 'imitation crab', 'crab', 'krab', 'lobster', 'langostino', 'langoustine', 'crawfish', 'crayfish',
  'shrimp', 'prawn', 'scampi', 'gamba', 'ebi', 'clam', 'mussel', 'oyster', 'scallop', 'squid', 'calamari', 'octopus', 'octopi',
  'cuttlefish', 'abalone', 'conch', 'whelk', 'sea urchin', 'uni', 'fish sauce', 'nam pla', 'nuoc mam', 'patis', 'colatura', 'garum',
  'oyster sauce', 'shrimp paste', 'anchovy paste', 'belacan', 'kapi', 'bagoong', 'xo sauce', 'worcestershire', 'caesar', 'caesar dressing',
  'tapenade', 'fish gelatin', 'fish oil', 'isinglass', 'branzino', 'whitefish', 'white fish', 'pike', 'carp', 'mullet', 'grouper',
  'tilefish', 'sea bream', 'bream', 'monkfish', 'hake', 'smelt', 'krill', 'swordfish', 'catfish', 'mahi', 'mahi mahi', 'perch', 'walleye',
  'bass', 'sea bass', 'fish stick',
  // pub16 QA (da3d7d4): more fish, fish products and dishes, foreign seafood, common typos
  'turbot', 'sturgeon', 'barramundi', 'yellowtail', 'sprat', 'pilchard', 'arctic char', 'hamachi', 'skate',
  'gravlax', 'taramasalata', 'bottarga', 'mentaiko', 'ikan bilis', 'furikake', 'ponzu',
  'sashimi', 'ceviche', 'cioppino', 'bouillabaisse', 'puttanesca', 'remoulade',
  'pulpo', 'calamar', 'camaron', 'marisco', 'moules', 'huitre', 'frutti di mare', 'tako', 'ika', 'kani', 'hokkigai',
  'shirmp', 'salmn',
])];
// Whole word only (plural s/es): short words and words that start other everyday words.
export const GUARD_WHOLE = ['uni', 'ebi', 'sate', 'kapi', 'patis', 'mole', 'cod', 'roe', 'eel', 'lox', 'sole', 'bass', 'carp', 'pike', 'hake',
  'smelt', 'perch', 'mullet', 'bream', 'mahi', 'krab', 'caju', 'noce', 'nuez', 'conch', 'scallop', 'dashi', 'hondashi', 'gamba', 'pinon', 'copra', 'macaron', 'macaroon',
  'mani', 'kaju', 'noci', 'badam', 'tako', 'ika', 'kani', 'skate', 'sprat', 'pulpo'];
// Warn only: shown, but the recipe can still be saved (with the tick).
export const GUARD_WARN = ['mole', 'biscotti', 'florentine', 'macaron', 'macaroon', 'muesli', 'granola', 'omega 3', 'fish shaped cracker'];
// Never a hit on their own (skipped before matching). Coconut aminos is NOT here.
export const GUARD_ALLOW = ['nutmeg', 'water chestnut', 'butternut squash', 'doughnut', 'donut', 'nutrition', 'nutritional yeast', 'nut free', 'fish free',
  'crabapple', 'crab apple', 'fortune', 'fortunate', 'fish shaped'];
const gesc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[^a-z0-9]*');
const WHOLE_SET = new Set(GUARD_WHOLE);
const stemRe = (list) => {
  const whole = list.filter((t) => WHOLE_SET.has(t) || t.length <= 3).sort((a, b) => b.length - a.length).map(gesc);
  const stem = list.filter((t) => !(WHOLE_SET.has(t) || t.length <= 3)).sort((a, b) => b.length - a.length).map(gesc);
  return [
    whole.length ? new RegExp(`(^|[^a-z0-9])(${whole.join('|')})(?:es|s)?(?=[^a-z0-9]|$)`, 'g') : null,
    stem.length ? new RegExp(`(^|[^a-z0-9])(${stem.join('|')})[a-z]*`, 'g') : null,
  ].filter(Boolean);
};
const rootRe = (list) => new RegExp(`()(${list.map(gesc).join('|')})`, 'g');
const G_FISH = [...stemRe(GUARD_FISH), rootRe(GUARD_ROOTS_FISH)];
const G_NUT = [...stemRe(GUARD_NUT), rootRe(GUARD_ROOTS_NUT), /(^|[^a-z0-9])([a-z]*nut)s?(?=[^a-z0-9]|$)/g,
  /(^|[^a-z0-9])(nut)(?:ty|tier|tiest|ter|ters)(?=[^a-z0-9]|$)/g]; // nutty, Nutter Butter
const G_WARN = stemRe(GUARD_WARN);
const G_ROOT_FISH = rootRe(GUARD_ROOTS_FISH);
const G_ROOT_NUT = rootRe(GUARD_ROOTS_NUT);
const G_ALLOW_RE = new RegExp(`(^|[^a-z0-9])(?:nutmegs?|water[^a-z0-9]*chestnuts?|butternut[^a-z0-9]*squash(?:es)?|doughnuts?|donuts?|nutrition[a-z]*(?:[^a-z0-9]*yeast)?|nut[^a-z0-9]*free|fish[^a-z0-9]*free|crab[^a-z0-9]*apples?|fortun[a-z]*|fish[^a-z0-9]*shaped)(?=[^a-z0-9]|$)`, 'g');

// The text with allowlisted phrases (fish-free, crab apple, nutmeg ...) taken out, for the older seafood check.
export function guardAllowStrip(text) {
  return normalizeText(String(text == null ? '' : text)).replace(G_ALLOW_RE, '$1 ');
}

const tidy = (w) => w.replace(/[^a-z0-9]+/g, ' ').trim();
// { fish, nut, warn } words found in one text. fish/nut block; warn only warns.
export function guardScan(text, vocab = {}) {
  const fish = []; const nut = []; const warn = [];
  const add = (arr, w) => { const k = tidy(w); if (k && !arr.includes(k)) arr.push(k); };
  const t = String(text == null ? '' : text);
  if (!t.trim()) return { fish, nut, warn };
  for (const v0 of textVariants(t)) {
    for (const re of G_WARN) for (const m of v0.matchAll(re)) add(warn, m[2]);
    const v = v0.replace(G_ALLOW_RE, '$1 ');
    for (const re of G_FISH) for (const m of v.matchAll(re)) add(fish, m[2]);
    for (const re of G_NUT) for (const m of v.matchAll(re)) add(nut, m[2]);
    // Spelled with gaps (p-e-a-n-u-t, al mond, sh rimp): the roots also run on each phrase with the gaps taken out.
    for (const part of v.split(/[,;:.()/&+]|\band\b|\bwith\b|\bor\b/)) {
      const squeezed = part.replace(/[^a-z0-9]+/g, '');
      if (!squeezed) continue;
      for (const m of squeezed.matchAll(G_ROOT_FISH)) add(fish, m[2]);
      for (const m of squeezed.matchAll(G_ROOT_NUT)) add(nut, m[2]);
    }
    for (const w of ['fish', 'shellfish']) for (const x of [w, ...((vocab && vocab[w]) || [])]) if (wordMatches(x, v, {})) add(fish, normalizeText(x));
  }
  return { fish, nut, warn };
}
// Blocking words (nut first, then fish).
export function guardList(text, vocab) {
  const { fish, nut } = guardScan(text, vocab);
  return [...nut, ...fish].filter((w, i, a) => a.indexOf(w) === i);
}
export function guardWarnList(text, vocab) {
  return guardScan(text, vocab).warn;
}
