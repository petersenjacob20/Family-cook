// #/protein (from Grocery) and #/protein/fresh (from Send to Amazon cart): pick Regular or a protein swap for each
// meal on the days that are on. The pick changes the Grocery list, Share, and the Amazon Fresh items (js/protein.js).
import { h, header } from '../dom.js';
import { weekIdFor, weekday, DAY_LONG, shortLabel } from '../dates.js';
import { fillWeek, getWeek, byId } from '../planner.js';
import { plannedDays, pickDays } from '../grocery.js';
import { loadDays } from '../store.js';
import { proteinMeals, loadChoices, saveChoice, optionLabel } from '../protein.js';

export const PROTEIN_BUTTON = 'Choose protein option';

export function render(ctx, params = []) {
  const { state, data } = ctx;
  const back = params[0] === 'fresh' ? '#/fresh' : '#/grocery';
  const weekId = weekIdFor(ctx.today());
  fillWeek(state, data, weekId);
  getWeek(state, weekId);
  const recipe = (id) => (id ? byId(data, id) : null);
  const days = pickDays(loadDays(), plannedDays(state, recipe, weekId));
  const meals = proteinMeals(state, data, recipe, weekId, days);
  const picks = loadChoices(weekId);

  const group = (m) => {
    const cur = m.swaps.some((s) => s.id === picks[m.date]) ? picks[m.date] : null;
    const dayName = DAY_LONG[weekday(m.date)];
    const gid = `protein-${m.date}`;
    const radios = [null, ...m.swaps].map((s) => {
      const on = (s ? s.id : null) === cur;
      return h('button', {
        type: 'button', class: 'check radio', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'data-swap': s ? s.id : 'regular',
        onclick: () => { saveChoice(weekId, m.date, s ? s.id : null); if (typeof ctx.refresh === 'function') ctx.refresh(); },
      }, h('span', { class: 'box', 'aria-hidden': 'true' }), h('span', { class: 'txt' }, h('strong', { text: optionLabel(s, m.recipe) })));
    });
    return h('div', { class: 'card proteinmeal', id: gid },
      h('p', { class: 'section-label', id: `${gid}-label`, text: `${shortLabel(m.date)} · ${m.recipe.title}` }),
      h('div', { role: 'radiogroup', 'aria-label': `Protein for ${dayName}, ${m.recipe.title}` }, radios),
      m.swaps.length ? null : h('p', { class: 'meta', text: 'No protein options for this meal.' }));
  };

  return [
    header('Protein options', { back }),
    h('p', { class: 'sub', text: 'Pick one for each meal. Your grocery list and Amazon items follow your pick.' }),
    meals.length ? meals.map(group) : h('div', { class: 'card', id: 'protein-none' }, h('p', { class: 'meta', text: 'No meals on the days you are shopping for.' })),
    h('a', { class: 'btn primary', href: back, id: 'protein-done' }, 'Done'),
    h('div', { class: 'spacer' }),
  ];
}
