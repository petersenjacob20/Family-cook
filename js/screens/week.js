import { h, header, button, toggle, toast } from '../dom.js';
import { weekIdFor, addDays, weekday, DAY_SHORT, slashLabel, nightsForWeek, isFridayOn, fridayDefault, isGamedayOn, gamedayDefault, shortLabel } from '../dates.js';
import { fillWeek, getWeek, byId } from '../planner.js';
import { shortMeta, nightWord, hasKidName } from '../view.js';
import { kidName } from '../people.js';

function nightRow(ctx, date, recipe) {
  return h('div', { class: ctx.swapped === date ? 'night hl' : 'night', 'data-date': date },
    h('div', { class: 'day' }, h('strong', { text: DAY_SHORT[weekday(date)] }), h('span', { text: slashLabel(date) })),
    recipe
      ? h('a', { class: 'meal', href: `#/need/${recipe.id}` }, h('strong', { text: recipe.title }), h('span', { text: shortMeta(recipe) }))
      : h('div', { class: 'meal' }, h('strong', { class: 'warn', text: 'No meal fits your family\u2019s list.' }), h('a', { href: '#/family', text: 'Edit family' })),
    button('Swap', () => ctx.go(`#/swap/${date}`), 'small', { 'aria-label': `Swap ${DAY_SHORT[weekday(date)]}` }));
}

// The highlight after a swap lasts until you leave Week.
export function leave(ctx) {
  ctx.swapped = null;
}

export function render(ctx) {
  const { state, data } = ctx;
  const weekId = weekIdFor(ctx.today());
  fillWeek(state, data, weekId);
  ctx.save();
  const week = getWeek(state, weekId);
  const active = new Map(nightsForWeek(weekId, state.nights, week).map((n) => [n.date, n]));
  const rows = [];
  const change = () => { fillWeek(state, data, weekId); ctx.save(); ctx.refresh(); };

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekId, i);
    const wd = weekday(date);
    if (wd === 5) {
      const on = isFridayOn(date, state.nights, week);
      rows.push(toggle(`Friday is a ${nightWord(state)} night`, `This week: ${on ? 'yes' : 'no'}`, on, (v) => {
        week.fridayOverride = v === fridayDefault(date, state.nights) ? null : v;
        change();
      }));
    } else if (wd === 1 && !state.nights.weekly.includes(1)) {
      const on = isGamedayOn(state.nights, week);
      rows.push(toggle('Monday game-day meal', hasKidName(state) ? `No ${kidName(state)} job` : 'Grown-ups only, no kid job', on, (v) => {
        week.gameday = v === gamedayDefault(state.nights) ? null : v;
        change();
      }));
    }
    if (active.has(date)) rows.push(nightRow(ctx, date, byId(data, week.meals[date])));
  }

  const who = hasKidName(state) ? `${kidName(state)} nights` : 'Your nights';
  return [
    header('This week'),
    h('p', { class: 'sub' }, `${who} · Week of ${shortLabel(weekId).replace(' ', ', ')}`, h('br'), 'Dinner 5\u20137 PM'),
    h('div', { class: 'card', id: 'week-card' }, rows),
    active.size === 0 ? h('div', { class: 'card' },
      h('p', { class: 'meta', text: 'No cooking nights this week.' }),
      h('a', { class: 'btn small', href: '#/family/nights' }, 'Pick your nights')) : null,
    button(week.confirmed ? 'Looks good \u2713' : 'Looks good', () => { week.confirmed = true; ctx.save(); toast('Week saved.'); ctx.refresh(); }, 'primary', { id: 'looks-good' }),
    h('a', { class: 'btn', href: '#/grocery', id: 'make-list' }, 'Make my grocery list'),
  ];
}
