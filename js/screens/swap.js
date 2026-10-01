import { h, header, button } from '../dom.js';
import { weekOf, weekday, DAY_SHORT, slashLabel, isISODate } from '../dates.js';
import { swapOptions, applySwap, getWeek, byId, nightFor, candidates, rank } from '../planner.js';
import { smallCard } from '../view.js';

const offsets = new Map();

export function render(ctx, params) {
  const { state, data } = ctx;
  const date = params[0];
  const back = params[1] === 'tonight' ? '#/tonight' : '#/week';
  if (!isISODate(date)) return [header('Pick something else', { back })];
  const key = date + back;
  const offset = offsets.get(key) || 0;
  const weekId = weekOf(date);
  const night = nightFor(state, weekId, date);
  let options; let total; let current;
  let pick;

  if (night) {
    current = byId(data, getWeek(state, weekId).meals[date]);
    ({ options, total } = swapOptions(state, data, weekId, date, { offset, count: 3 }));
    pick = (r) => { applySwap(state, weekId, date, r.id); ctx.save(); offsets.delete(key); ctx.go(back); };
  } else {
    // Not a planned night: re-pick the "cook anyway" meal without touching the plan.
    current = ctx.anyway && ctx.anyway.date === date ? byId(data, ctx.anyway.id) : null;
    const { list } = candidates(state, data, { date, kind: 'family', used: [], exclude: current ? [current.id] : [] });
    const ranked = rank(list, state, data, date, `anyway${date}swap`, true);
    total = ranked.length;
    options = ranked.slice(offset, offset + 3).map((x) => x.recipe);
    pick = (r) => { ctx.anyway = { date, id: r.id, n: 0 }; offsets.delete(key); ctx.go(back); };
  }

  const more = () => { offsets.set(key, offset + 3 >= total ? 0 : offset + 3); ctx.refresh(); };
  return [
    header('Pick something else', { back }),
    h('p', { class: 'sub', text: `For ${DAY_SHORT[weekday(date)]} ${slashLabel(date)}${current ? ` · now: ${current.title}` : ''}` }),
    options.length
      ? options.map((r) => smallCard(state, r, data.vocab, [button('Pick this', () => pick(r), 'primary small', { 'data-pick': r.id })]))
      : h('div', { class: 'card' }, h('p', { class: 'meta', text: 'No other meal fits your family\u2019s list.' }), h('a', { class: 'btn small', href: '#/family' }, 'Edit family')),
    total > 3 ? button(offset + 3 >= total ? 'Start over' : 'Show 3 more', more, '', { id: 'show-more' }) : null,
  ];
}
