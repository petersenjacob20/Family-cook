// Shared view bits built from the Design 4.4 parts. DOM is only touched inside functions.
import { h } from './dom.js';
import { kidName, kidBadge, kidPerson } from './people.js';
import { neverSummary, blockingWords, allergySummary } from './rules.js';
import { cardProteinLine } from './grocery.js';

// Recipe photos: app/photos/<id>.webp, all 720x540 (4:3). Width and height are always set (plus a 4:3 box in CSS),
// so nothing moves while a photo loads. loading/decoding are set before src so lazy loading applies.
export const PHOTO_W = 720;
export const PHOTO_H = 540;
const PHOTO_SRC_RE = /^photos\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/;

// The plain tile shown when a recipe has no photo or its photo fails to load. Same box as the photo.
export function photoFallback(cls) {
  return h('div', { class: `photo-fallback ${cls}`, 'aria-hidden': 'true', 'data-photo-fallback': '' });
}

export function recipePhoto(r, cls) {
  const p = r && r.photo;
  if (!p || typeof p.src !== 'string' || !PHOTO_SRC_RE.test(p.src)) return photoFallback(cls);
  const img = h('img', {
    loading: 'lazy', decoding: 'async', width: PHOTO_W, height: PHOTO_H, class: `photo ${cls}`, alt: p.alt || '', src: `./${p.src}`,
  });
  img.addEventListener('error', () => img.replaceWith(photoFallback(cls)), { once: true });
  return img;
}

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

export function longMeta(r) {
  return `About ${r.total_min} min · ${cap(r.effort)}`;
}

export function shortMeta(r) {
  return `~${r.total_min} min · ${r.effort}`;
}

export function firstKidStep(r) {
  return (r.steps || []).find((s) => s.who === 'kid') || null;
}

export function hasKidName(state) {
  const p = kidPerson(state);
  return Boolean(p && p.name && p.name.trim());
}

// "Friday is a Sam night" / "Friday is a family night" when no name is set.
export function nightWord(state) {
  return hasKidName(state) ? kidName(state) : 'family';
}

export function kidJobMini(state, r) {
  const k = firstKidStep(r);
  if (!k) return null;
  return h('div', { class: 'kidjob-mini' },
    h('span', { class: 'badge', text: kidBadge(state) }),
    h('strong', { text: `${kidName(state)} job: ${lowerFirst(k.text)}` }));
}

export function safeLine(state) {
  // Allergies first ("No peanuts. No tree nuts."), then the never words ("No fish.").
  const s = [allergySummary(state.allergies), neverSummary(state.people)].filter(Boolean).join(' ');
  return [h('p', { class: 'safe' }, h('strong', { text: '\u2713 Everyone can eat this' })), s ? h('p', { class: 'meta', text: s }) : null];
}

// The big meal card on Tonight.
export function mealCard(state, r, { photo = true } = {}) {
  return h('div', { class: 'card', id: 'meal-card' },
    photo ? recipePhoto(r, 'hero') : null,
    h('h2', { text: r.title }),
    h('p', { class: 'meta', text: longMeta(r) }),
    h('hr', { class: 'divider' }),
    safeLine(state),
    r.kind === 'gameday' ? h('span', { class: 'badge gray', text: 'Game-day meal · no kid job' }) : kidJobMini(state, r));
}

// A compact card for Swap and the Recipe list.
export function smallCard(state, r, vocab, extra = []) {
  const blocked = blockingWords(r, state.people, vocab);
  // The text comes first in the DOM (screen readers read the title first); CSS shows the photo on the left.
  return h('div', { class: blocked.length ? 'card has-photo dim' : 'card has-photo' },
    h('div', { class: 'cardbody' },
      h('h3', { text: r.title }),
      h('p', { class: 'meta', text: shortMeta(r) + (r.kind === 'gameday' ? ' · game-day' : '') }),
      cardProteinLine(r) ? h('p', { class: 'meta protein', text: cardProteinLine(r) }) : null,
      firstKidStep(r) ? h('span', { class: 'badge', text: kidBadge(state) }) : null,
      blocked.length ? h('p', { class: 'meta' }, h('strong', { text: 'Not for your family' }), ` (never: ${blocked.join(', ')})`) : null,
      extra),
    recipePhoto(r, 'thumb cardthumb'));
}
