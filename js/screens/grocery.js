// Grocery list for the whole week, by store section. Share, or fill your Amazon cart: we never order for you.
import { h, header, button, checkRow, toast } from '../dom.js';
import { weekIdFor } from '../dates.js';
import { fillWeek, getWeek, byId } from '../planner.js';
import { plannedDays, pickDays, buildList, pruneChecked, toggleChecked, shareText, pickedDates, daysLabel, ingredientNotes } from '../grocery.js';
import { shareWithFallback } from '../share.js';
import { loadDays } from '../store.js';
import { NO_DAYS } from './fresh.js';
import { activeSwaps } from '../protein.js';
import { PROTEIN_BUTTON } from './protein.js';

export function render(ctx) {
  const { state, data } = ctx;
  const weekId = weekIdFor(ctx.today());
  fillWeek(state, data, weekId);
  const week = getWeek(state, weekId);
  const recipe = (id) => (id ? byId(data, id) : null);
  // Checks are pruned against the whole week, so a day you untick keeps its checks for later.
  pruneChecked(week, buildList(state, recipe, weekId));
  // The Week tab's "Shop for this day" switches: only meals on days that are on feed this list.
  const planned = plannedDays(state, recipe, weekId);
  const days = pickDays(loadDays(), planned);
  const noDays = planned.length > 0 && days.length === 0;
  // Protein picks (#/protein) for the meals on those days; none = Regular, the list as before.
  const swaps = activeSwaps(state, data, recipe, weekId, days);
  let list = buildList(state, recipe, weekId, days, swaps);
  // The date line follows the picked days (all planned days picked = the same line as before).
  const allPicked = days.length === planned.length;
  const label = daysLabel(list, pickedDates(state, recipe, weekId, days), allPicked);
  ctx.save();

  const row = (item) => {
    const el = checkRow(item.text || item.name, item.hint || '', item.checked, () => {
      const on = toggleChecked(week, item.id);
      ctx.save();
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    }, ingredientNotes(item));
    el.dataset.line = item.id;
    return el;
  };

  const mount = h('div');
  const share = () => {
    list = buildList(state, recipe, weekId, days, swaps);
    shareWithFallback({ title: 'Grocery list', text: shareText(list, label || undefined) }, { toast, mount });
  };
  const empty = !list.sections.length && !list.staples.length;
  return [
    header('Grocery list \u2014 this week', { back: '#/week' }),
    noDays ? null : h('p', { class: 'sub', id: 'grocery-dates', text: empty ? label : `${label} · Tap what you already have.` }),
    noDays
      ? h('div', { class: 'card', id: 'grocery-no-days' }, h('p', { class: 'meta', text: NO_DAYS }))
      : empty
      ? h('div', { class: 'card' }, h('p', { class: 'meta', text: 'No meals planned this week yet.' }), h('a', { class: 'btn small', href: '#/week' }, 'Plan my week'))
      : h('div', { class: 'card checklist', id: 'grocery-list' },
        list.sections.map((s) => [h('p', { class: 'section-label', text: s.label }), s.lines.map(row)])),
    list.staples.length
      ? h('div', { class: 'card gray', id: 'check-you-have' },
        h('p', { class: 'section-label', text: 'Check you have' }),
        h('div', { class: 'staples' }, list.staples.map(row)))
      : null,
    mount,
    h('div', { class: 'stickyfoot' },
      empty ? null : h('a', { class: 'btn small', href: '#/protein', id: 'protein-open' }, PROTEIN_BUTTON),
      empty ? null : h('a', { class: 'btn', href: '#/fresh', id: 'send-fresh' }, 'Send to Amazon cart'),
      button('Share list', share, 'primary', { id: 'share-list', disabled: empty }),
      h('p', { class: 'footer-note', text: 'Send to Notes, a text, or your partner. We never order for you.' })),
  ];
}
