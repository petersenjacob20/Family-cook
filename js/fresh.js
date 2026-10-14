// Send to Amazon cart: pure helpers, no DOM.
// The app never picks a product for you: "Search Amazon" only opens Amazon's own search for the
// ingredient name (nothing else is sent), and you choose. Only products you saved yourself
// (one exact product per ingredient, label checked) are put in the cart. The app never places an order.
import { nutHits, wordMatches } from './rules.js';

// Amazon's add-to-cart form. Items land in the regular Amazon cart, after you confirm.
export const CART_ADD = 'https://www.amazon.com/gp/aws/cart/add.html';
export const AMAZON_CART = 'https://www.amazon.com/gp/cart/view.html';
// Product links are only read from these hosts (https or http). Anything else is refused.
export const AMAZON_HOSTS = ['www.amazon.com', 'amazon.com'];
export const MAX_ITEMS = 50;

const ASIN_RE = /^[A-Z0-9]{10}$/;
const KEY_RE = /^[a-z0-9-]{1,60}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// An ASIN typed in, or the ASIN out of a pasted Amazon product link. '' when there isn't one.
export function parseAsin(input) {
  const s = String(input == null ? '' : input).trim();
  if (!s) return '';
  const bare = s.toUpperCase();
  if (ASIN_RE.test(bare)) return bare;
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`); } catch { return ''; }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password || u.port) return '';
  if (!AMAZON_HOSTS.includes(u.hostname.toLowerCase())) return '';
  const m = (u.pathname + u.search).match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/exec\/obidos\/asin\/|[?&]asin=)([A-Za-z0-9]{10})(?=[/?&#]|$)/i);
  return m ? m[1].toUpperCase() : '';
}

// Fish and seafood are never sent, whatever the product.
export function seafoodHit(text, vocab) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (wordMatches('seafood', t, {})) return true;
  return wordMatches('fish', t, vocab) || wordMatches('shellfish', t, vocab);
}

// Why this text can't go in the cart ('' when it's fine).
export function blockReason(text, vocab) {
  if (seafoodHit(text, vocab)) return 'fish or seafood';
  if (nutHits(text).length) return 'nut word';
  return '';
}

// Saved products, cleaned on load. Anything malformed is dropped.
export function cleanFresh(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [key, v] of Object.entries(obj)) {
    if (!KEY_RE.test(key) || !v || typeof v !== 'object') continue;
    const asin = typeof v.asin === 'string' ? v.asin.toUpperCase() : '';
    if (!ASIN_RE.test(asin) || v.labelRead !== true) continue;
    out[key] = {
      asin,
      label: typeof v.label === 'string' ? v.label.slice(0, 80) : '',
      qty: Number.isInteger(v.qty) && v.qty >= 1 && v.qty <= 9 ? v.qty : 1,
      labelRead: true,
      checkedOn: typeof v.checkedOn === 'string' && DATE_RE.test(v.checkedOn) ? v.checkedOn : '',
    };
  }
  return out;
}

// Save one product. Returns { ok, error, entry }. Nothing is saved unless the label was read.
export function makeEntry({ asinInput, label, qty, labelRead, today }, ingredientName, vocab) {
  const asin = parseAsin(asinInput);
  if (!asin) return { ok: false, error: 'Paste the Amazon product link or the 10-character product number (ASIN).' };
  if (labelRead !== true) return { ok: false, error: 'Tick the box once you have read this exact label.' };
  const why = blockReason(ingredientName, vocab) || blockReason(label, vocab);
  if (why) return { ok: false, error: `Not saved: this has a ${why}. It can't go in the cart.` };
  const n = Number.parseInt(qty, 10);
  return {
    ok: true,
    error: '',
    entry: { asin, label: String(label || '').trim().slice(0, 80), qty: n >= 1 && n <= 9 ? n : 1, labelRead: true, checkedOn: today || '' },
  };
}

// Split this week's unchecked grocery lines into: send (saved product), manual (no saved product),
// blocked (fish/seafood or nut word in the ingredient or the saved label). Staples are never sent.
export function planSend(list, fresh, vocab) {
  const send = [];
  const manual = [];
  const blocked = [];
  const seen = new Set();
  for (const s of (list && list.sections) || []) {
    for (const line of s.lines) {
      if (line.checked) continue;
      const entry = fresh && fresh[line.key];
      const why = blockReason(line.text, vocab) || (entry ? blockReason(entry.label, vocab) : '');
      if (why) { blocked.push({ ...line, why }); continue; }
      if (!entry) { manual.push(line); continue; }
      if (seen.has(entry.asin)) continue; // two lines, one product: add it once
      seen.add(entry.asin);
      send.push({ ...line, asin: entry.asin, label: entry.label, qty: entry.qty || 1 });
    }
  }
  const over = send.splice(MAX_ITEMS);
  return { send, manual: manual.concat(over), blocked };
}

// The cart link. ASINs only (never names), quantity per saved product. No tag, no tracking.
export function cartUrl(items) {
  const p = [];
  let n = 0; // numbered over valid items only, so there are never gaps (ASIN.1, ASIN.2, ...)
  for (const it of items.slice(0, MAX_ITEMS)) {
    if (!it || !ASIN_RE.test(it.asin)) continue;
    n += 1;
    p.push(`ASIN.${n}=${it.asin}`, `Quantity.${n}=${Math.min(9, Math.max(1, it.qty || 1))}`);
  }
  if (!p.length) return '';
  return `${CART_ADD}?${p.join('&')}`;
}

// The product page for one saved ASIN (for re-checking a label).
export function productUrl(asin) {
  return ASIN_RE.test(asin) ? `https://www.amazon.com/dp/${asin}` : '';
}

// ---------- Amazon Fresh test (Settings > "Amazon Fresh test", off by default) ----------
// Amazon's Fresh ingredients page: a user-tapped form POST, field `ingredients`, value
// {"ingredients":[{name, quantityList:[{unit, amount}]}]}. Names only: AMAZON picks the products,
// so no ASIN (and no asinOverrides) is ever sent. Nut/fish names are dropped and shown instead.
export const FRESH_LANDING = 'https://www.amazon.com/afx/ingredients/landing';
export const FRESH_FIELD = 'ingredients';

const round2 = (x) => Math.round(x * 100) / 100;
// One grocery line -> one { unit, amount } in Amazon's upper-case units.
export function freshQuantity(line) {
  const t = Number(line.total) || 0;
  if (line.fam === 'vol') {
    if (t >= 12) return { unit: 'CUPS', amount: round2(t / 48) };
    if (t >= 3) return { unit: 'TABLESPOONS', amount: round2(t / 3) };
    return { unit: 'TEASPOONS', amount: round2(Math.max(t, 0.25)) };
  }
  if (line.fam === 'wt') {
    if (t >= 16) return { unit: 'POUNDS', amount: round2(t / 16) };
    return { unit: 'OUNCES', amount: round2(Math.max(t, 0.25)) };
  }
  return { unit: 'COUNT', amount: Math.max(1, Math.ceil(t - 1e-9)) }; // count, bag, box, can, jar, pkg ...
}

// This week's unchecked lines -> { payload, sent, blocked }. Staples are never sent.
export function freshPayload(list, vocab) {
  const ingredients = [];
  const sent = [];
  const blocked = [];
  for (const s of (list && list.sections) || []) {
    for (const line of s.lines) {
      if (line.checked) continue;
      const name = String(line.name || '').trim().slice(0, 80);
      if (!name) continue;
      const why = blockReason(name, vocab) || blockReason(line.text, vocab);
      if (why) { blocked.push({ ...line, why }); continue; }
      ingredients.push({ name, quantityList: [freshQuantity(line)] });
      sent.push(line);
    }
  }
  return { payload: { ingredients: ingredients.slice(0, MAX_ITEMS) }, sent: sent.slice(0, MAX_ITEMS), blocked };
}

// The one form, built only inside the user's tap. `doc` is the document.
export function freshForm(doc, payload) {
  const f = doc.createElement('form');
  f.setAttribute('method', 'post');
  f.setAttribute('action', FRESH_LANDING);
  f.setAttribute('target', '_blank');
  f.setAttribute('rel', 'noopener noreferrer');
  f.setAttribute('enctype', 'application/x-www-form-urlencoded');
  const i = doc.createElement('input');
  i.setAttribute('type', 'hidden');
  i.setAttribute('name', FRESH_FIELD);
  i.value = JSON.stringify(payload);
  f.appendChild(i);
  return f;
}

// Plain-text copy of what the app will and won't send.
export function sendSummary(plan) {
  const out = [];
  if (plan.send.length) out.push('IN THE AMAZON CART', ...plan.send.map((l) => `- ${l.text} -> ${l.label || l.asin} x${l.qty}`));
  if (plan.manual.length) out.push('', 'ADD YOURSELF', ...plan.manual.map((l) => `- ${l.text}`));
  if (plan.blocked.length) out.push('', 'NOT SENT', ...plan.blocked.map((l) => `- ${l.text} (${l.why})`));
  return out.join('\n').trim();
}
