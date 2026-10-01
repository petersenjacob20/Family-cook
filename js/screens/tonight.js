import { h, header, button } from '../dom.js';
import { tonight, anyway, byId } from '../planner.js';
import { DAY_LONG, weekday } from '../dates.js';
import { mealCard } from '../view.js';

function noFit() {
  return h('div', { class: 'card' },
    h('h2', { text: 'No meal fits your family\u2019s list.' }),
    h('a', { class: 'btn small', href: '#/family' }, 'Edit family'));
}

function cookButtons(r, date, swapHref) {
  return h('div', { class: 'btnstack' },
    h('a', { class: 'btn primary', href: `#/cook/${r.id}/1`, id: 'lets-cook' }, 'Let\u2019s cook'),
    h('a', { class: 'btn', href: swapHref, id: 'pick-else' }, 'Pick something else'),
    h('a', { class: 'link', href: `#/need/${r.id}`, id: 'what-need' }, 'What you need'));
}

export function render(ctx) {
  const today = ctx.today();
  const { state, data } = ctx;

  // "Cook something tonight anyway" (kept in memory only, never changes the plan).
  if (ctx.anyway && ctx.anyway.date === today) {
    const r = byId(data, ctx.anyway.id);
    if (r) {
      return [
        header('Tonight\u2019s dinner'),
        h('p', { class: 'sub', text: `${DAY_LONG[weekday(today)]} · not a planned night` }),
        mealCard(state, r),
        h('div', { class: 'spacer' }),
        cookButtons(r, today, `#/swap/${today}/tonight`),
      ];
    }
  }

  const info = tonight(state, data, today);
  ctx.save();
  const cookAnyway = () => {
    const r = anyway(state, data, today, 0);
    if (r) { ctx.anyway = { date: today, id: r.id, n: 0 }; ctx.refresh(); }
  };

  if (info.mode === 'tonight') {
    const r = info.recipe;
    return [
      header('Tonight\u2019s dinner'),
      h('p', { class: 'sub', text: `${DAY_LONG[weekday(today)]} · eat around 6:00 PM` }),
      r ? mealCard(state, r) : noFit(),
      h('div', { class: 'spacer' }),
      r ? cookButtons(r, today, `#/swap/${today}/tonight`) : null,
    ];
  }

  if (info.mode === 'next') {
    const r = info.recipe;
    return [
      header(`Next up: ${DAY_LONG[weekday(info.date)]}`),
      h('p', { class: 'sub', text: 'No dinner planned tonight. Here\u2019s the next one.' }),
      r ? mealCard(state, r) : noFit(),
      h('div', { class: 'spacer' }),
      h('div', { class: 'btnstack' },
        h('a', { class: 'btn primary', href: '#/week', id: 'see-week' }, 'See this week'),
        button('Cook something tonight anyway', cookAnyway, '', { id: 'cook-anyway' }),
        r ? h('a', { class: 'link', href: `#/need/${r.id}`, id: 'what-need' }, 'What you need') : null),
    ];
  }

  return [
    header('Tonight\u2019s dinner'),
    h('div', { class: 'card' },
      h('h2', { text: 'No cooking nights yet' }),
      h('p', { class: 'meta', text: 'Pick the nights you cook and we\u2019ll plan them for you.' }),
      h('a', { class: 'btn small', href: '#/family/nights' }, 'Pick your nights')),
    h('div', { class: 'spacer' }),
    button('Cook something tonight anyway', cookAnyway, 'primary', { id: 'cook-anyway' }),
  ];
}
