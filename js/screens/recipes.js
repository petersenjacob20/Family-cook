import { h, header, chip } from '../dom.js';
import { isBlocked } from '../rules.js';
import { recipeList, browseSections } from '../planner.js';
import { smallCard } from '../view.js';

// All recipes, in sections (Family dinners, Fitness meals, Game-day meals).
// The "High protein" chip (#/recipes/high-protein) lists recipes with 30 g or more per serving in the data.
export function render(ctx, params = []) {
  const { state, data } = ctx;
  const high = params[0] === 'high-protein';
  const sections = browseSections(state, data, { highProtein: high });
  const count = high ? sections.reduce((n, s) => n + s.recipes.length, 0) : recipeList(state, data).length;
  // Your own recipe with a nut or fish word: kept, shown with the warning, opens to Edit and Delete.
  const blockedCard = (r) => h('a', { class: 'cardlink', href: `#/custom/view/${r.id}`, 'data-blocked': r.id },
    smallCard(state, r, data.vocab),
    h('p', { class: 'customwarn', text: `Not in your plan: nut or fish word (${r.blocked.map((b) => `${b.where}: ${b.words.join(', ')}`).join('; ')}). Tap to edit or delete.` }));
  const card = (r) => (r.blocked ? blockedCard(r) : isBlocked(r, state.people, data.vocab)
    ? smallCard(state, r, data.vocab)
    : h('a', { class: 'cardlink', href: r.custom ? `#/custom/view/${r.id}` : `#/need/${r.id}` }, smallCard(state, r, data.vocab)));
  return [
    header('All recipes', { back: '#/family' }),
    h('a', { class: 'btn small', href: '#/custom/new', id: 'add-custom' }, 'Add your own recipe'),
    h('div', { class: 'chips', id: 'browse-chips' },
      chip('High protein', high, () => ctx.go(high ? '#/recipes' : '#/recipes/high-protein'), 'filter')),
    h('p', { class: 'sub', text: high
      ? `${count} meals with 30 g or more protein per serving.`
      : `${count} meals. Dimmed ones have a never food for someone in your family.` }),
    sections.map((s) => [
      h('p', { class: 'section-label browse', id: `section-${s.id}`, text: s.label }),
      s.recipes.map(card),
    ]),
  ];
}
