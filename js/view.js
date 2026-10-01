// Shared view bits built from the Design 4.4 parts. DOM is only touched inside functions.
import { h, placeholder } from './dom.js';
import { kidName, kidBadge, kidPerson } from './people.js';
import { neverSummary, blockingWords, allergySummary } from './rules.js';

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
    photo ? placeholder('photo of the meal') : null,
    h('h2', { text: r.title }),
    h('p', { class: 'meta', text: longMeta(r) }),
    h('hr', { class: 'divider' }),
    safeLine(state),
    r.kind === 'gameday' ? h('span', { class: 'badge gray', text: 'Game-day meal · no kid job' }) : kidJobMini(state, r));
}

// A compact card for Swap and the Recipe list.
export function smallCard(state, r, vocab, extra = []) {
  const blocked = blockingWords(r, state.people, vocab);
  return h('div', { class: blocked.length ? 'card dim' : 'card' },
    h('h3', { text: r.title }),
    h('p', { class: 'meta', text: shortMeta(r) + (r.kind === 'gameday' ? ' · game-day' : '') }),
    firstKidStep(r) ? h('span', { class: 'badge', text: kidBadge(state) }) : null,
    blocked.length ? h('p', { class: 'meta' }, h('strong', { text: 'Not for your family' }), ` (never: ${blocked.join(', ')})`) : null,
    extra);
}
