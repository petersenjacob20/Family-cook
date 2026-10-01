// Grocery list for the whole week, by store section. Share-only: we never order for you.
import { h, header, button, checkRow, toast } from '../dom.js';
import { weekIdFor } from '../dates.js';
import { fillWeek, getWeek, byId } from '../planner.js';
import { buildList, pruneChecked, toggleChecked, shareText, rangeLabel, LABEL_LINE } from '../grocery.js';
import { shareWithFallback } from '../share.js';

export function render(ctx) {
  const { state, data } = ctx;
  const weekId = weekIdFor(ctx.today());
  fillWeek(state, data, weekId);
  const week = getWeek(state, weekId);
  const recipe = (id) => (id ? byId(data, id) : null);
  let list = buildList(state, recipe, weekId);
  pruneChecked(week, list);
  ctx.save();

  const row = (item) => {
    const el = checkRow(item.text || item.name, item.hint || '', item.checked, () => {
      const on = toggleChecked(week, item.id);
      ctx.save();
      el.setAttribute('aria-checked', on ? 'true' : 'false');
    }, item.checkLabel ? LABEL_LINE : '');
    el.dataset.line = item.id;
    return el;
  };

  const mount = h('div');
  const share = () => {
    list = buildList(state, recipe, weekId);
    shareWithFallback({ title: 'Grocery list', text: shareText(list) }, { toast, mount });
  };
  const empty = !list.sections.length && !list.staples.length;
  return [
    header('Grocery list \u2014 this week', { back: '#/week' }),
    h('p', { class: 'sub', text: empty ? rangeLabel(list) : `${rangeLabel(list)} · Tap what you already have.` }),
    empty
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
      button('Share list', share, 'primary', { id: 'share-list', disabled: empty }),
      h('p', { class: 'footer-note', text: 'Send to Notes, a text, or your partner. We never order for you.' })),
  ];
}
