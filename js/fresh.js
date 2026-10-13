// Send to Amazon Fresh: pure helpers, no DOM.
// The app never searches Amazon by name and never picks a product. Only products you saved yourself
// (one exact product per ingredient, label checked) are put in the cart. The app never places an order.
import { nutHits, wordMatches } from './rules.js';

// "Amazon Fresh" in base64. Amazon's own Fresh cart links use this brand id.
export const FRESH_BRAND = 'QW1hem9uIEZyZXNo';
export const CART_ADD = 'https://www.amazon.com/gp/aws/cart/add.html';
export const FRESH_CART = `https://www.amazon.com/cart/localmarket?almBrandId=${FRESH_BRAND}`;
export const FRESH_HOME = `https://www.amazon.com/alm/storefront?almBrandId=${FRESH_BRAND}`;
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
  const m = s.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/exec\/obidos\/asin\/|[?&]asin=)([A-Za-z0-9]{10})(?=[/?&#]|$)/i);
  return m ? m[1].toUpperCase() : '';
}

// Fish and seafood are never sent, whatever the product.
export function seafoodHit(text, vocab) {
  const t = String(text || '');
  if (!t.trim()) return false;
  if (wordMatches('seafood', t, {})) return true;
  return wordMatches('fish', t, vocab) || wordMatches('shellfish', t, vocab);
}

// Why this text can't go in the Fresh cart ('' when it's fine).
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
  if (why) return { ok: false, error: `Not saved: this has a ${why}. It can't go in the Fresh cart.` };
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
  items.slice(0, MAX_ITEMS).forEach((it, i) => {
    if (!ASIN_RE.test(it.asin)) return;
    p.push(`ASIN.${i + 1}=${it.asin}`, `Quantity.${i + 1}=${Math.min(9, Math.max(1, it.qty || 1))}`);
  });
  if (!p.length) return '';
  p.push(`almBrandId=${FRESH_BRAND}`);
  return `${CART_ADD}?${p.join('&')}`;
}

// The product page for one saved ASIN (for re-checking a label).
export function productUrl(asin) {
  return ASIN_RE.test(asin) ? `https://www.amazon.com/dp/${asin}` : '';
}

// Plain-text copy of what the app will and won't send.
export function sendSummary(plan) {
  const out = [];
  if (plan.send.length) out.push('IN THE FRESH CART', ...plan.send.map((l) => `- ${l.text} -> ${l.label || l.asin} x${l.qty}`));
  if (plan.manual.length) out.push('', 'ADD YOURSELF', ...plan.manual.map((l) => `- ${l.text}`));
  if (plan.blocked.length) out.push('', 'NOT SENT', ...plan.blocked.map((l) => `- ${l.text} (${l.why})`));
  return out.join('\n').trim();
}
