import { h, header } from '../dom.js';
import { isBlocked } from '../rules.js';
import { recipeList } from '../planner.js';
import { smallCard } from '../view.js';

export function render(ctx) {
  const { state, data } = ctx;
  const sorted = recipeList(state, data);
  return [
    header('All recipes', { back: '#/family' }),
    h('p', { class: 'sub', text: `${sorted.length} meals. Dimmed ones have a never food for someone in your family.` }),
    sorted.map((r) => (isBlocked(r, state.people, data.vocab)
      ? smallCard(state, r, data.vocab)
      : h('a', { class: 'cardlink', href: `#/need/${r.id}` }, smallCard(state, r, data.vocab)))),
  ];
}
