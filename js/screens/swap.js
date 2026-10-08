import { h, header, toastAction, append } from '../dom.js';
import { weekOf, weekday, DAY_SHORT, isISODate } from '../dates.js';
import { applySwap, restoreSwap, byId, nightFor } from '../planner.js';
import { swapList, anywayList, chipsFor, applyFilters, countLine, rowProtein, hasFilters, resetFilters } from '../swaplist.js';
import { shortMeta, firstKidStep } from '../view.js';
import { kidBadge } from '../people.js';

// Search and chips are kept per night while the app is open, so Back and forth keeps them.
const filtersFor = new Map();
let offScroll = null;

// One row: the whole card is the tap target.
function row(state, r, onPick) {
  const protein = rowProtein(r);
  return h('button', { type: 'button', class: 'card swaprow', 'data-pick': r.id, onclick: () => onPick(r) },
    h('span', { class: 'rtitle', text: r.title }),
    h('span', { class: 'rmeta' },
      h('span', { text: shortMeta(r) + (r.kind === 'gameday' ? ' \u00b7 game-day' : '') }),
      firstKidStep(r) ? h('span', { class: 'badge', text: kidBadge(state) }) : null),
    protein ? h('span', { class: 'rprotein', text: protein }) : null);
}

export function leave() {
  if (offScroll) { offScroll(); offScroll = null; }
}

export function render(ctx, params) {
  const { state, data } = ctx;
  const date = params[0];
  const fromTonight = params[1] === 'tonight';
  const back = fromTonight ? '#/tonight' : '#/week';
  if (!isISODate(date)) return [header('Pick a dinner', { back })];
  const key = date + back;
  const f = filtersFor.get(key) || { query: '', on: [] };
  filtersFor.set(key, f);
  const weekId = weekOf(date);
  const night = nightFor(state, weekId, date);
  let list; let current; let pick;

  if (night) {
    ({ list } = swapList(state, data, weekId, date));
    current = byId(data, state.weeks[weekId] && state.weeks[weekId].meals[date]);
    pick = (r) => {
      const before = applySwap(state, weekId, date, r.id);
      ctx.save();
      filtersFor.delete(key);
      ctx.swapped = date;
      ctx.go(back);
      toastAction(`Swapped to ${r.title}.`, 'Undo', () => {
        restoreSwap(state, weekId, date, before);
        ctx.save();
        ctx.refresh();
      });
    };
  } else {
    // Not a planned night: re-pick the "cook anyway" meal without touching the plan.
    current = ctx.anyway && ctx.anyway.date === date ? byId(data, ctx.anyway.id) : null;
    list = anywayList(state, data, date, current ? current.id : null);
    pick = (r) => {
      const before = ctx.anyway;
      ctx.anyway = { date, id: r.id, n: 0 };
      filtersFor.delete(key);
      ctx.go(back);
      toastAction(`Swapped to ${r.title}.`, 'Undo', () => { ctx.anyway = before; ctx.refresh(); });
    };
  }

  const { rules, foods } = chipsFor(list, data);
  const order = [...rules, ...foods].map((t) => t.id);
  let timer = null;
  const listBox = h('div', { class: 'swaplist', id: 'swap-list' });
  const countText = h('span', { class: 'swapcounttext', id: 'swap-count', 'aria-live': 'polite' });
  const countClear = h('button', { type: 'button', class: 'countclear', id: 'swap-count-clear', text: 'Clear', 'aria-label': 'Clear search and filters' });
  const count = h('div', { class: 'swapcount' }, countText, countClear);
  const top = h('div', { class: 'swaptop', id: 'swap-top' });
  const input = h('input', {
    class: 'searchinput', id: 'swap-search', type: 'search', enterkeyhint: 'search', placeholder: 'Search dinners',
    'aria-label': 'Search dinners', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', value: f.query,
  });
  const clearX = h('button', { type: 'button', class: 'searchclear', id: 'swap-search-clear', 'aria-label': 'Clear search', text: '\u00d7', hidden: !f.query });
  const chipRow = h('div', { class: 'chiprow', id: 'swap-chips' });
  const blur = () => { if (document.activeElement === input) input.blur(); };

  function drawChips() {
    const on = new Set(f.on);
    const chipEl = (t) => h('button', {
      type: 'button', class: 'chip filter', 'data-tag': t.id, 'aria-pressed': on.has(t.id) ? 'true' : 'false',
      onclick: () => { f.on = on.has(t.id) ? f.on.filter((x) => x !== t.id) : [...f.on, t.id]; update(); },
    }, t.label);
    chipRow.replaceChildren(
      ...rules.map(chipEl),
      rules.length && foods.length ? h('span', { class: 'chipdivider', 'aria-hidden': 'true' }) : null,
      ...foods.map(chipEl),
    );
  }

  function drawList() {
    const shown = applyFilters(list, f, data);
    countText.textContent = countLine(shown.length, f.on, data, order);
    countClear.hidden = !hasFilters(f);
    listBox.replaceChildren(...(shown.length
      ? shown.map((r) => row(state, r, (x) => { blur(); pick(x); }))
      : [h('div', { class: 'card swapempty', id: 'swap-empty' },
        h('p', { class: 'emptytitle', text: list.length ? 'No dinners match.' : 'No other dinner fits your family\u2019s list.' }),
        list.length ? h('p', { class: 'hint', text: 'Try fewer filters or a different word.' }) : null,
        list.length
          ? h('button', { type: 'button', class: 'btn', id: 'swap-clear-all', text: 'Clear search and filters', onclick: clearAll })
          : h('a', { class: 'btn', href: '#/family' }, 'Edit family'))]));
  }

  function update() { drawChips(); drawList(); }
  // "Clear" in the count line and the empty-state button do the same: no text, no chips.
  function clearAll() { resetFilters(f); input.value = ''; clearX.hidden = true; clearTimeout(timer); update(); }
  countClear.addEventListener('click', () => { blur(); clearAll(); });

  input.addEventListener('input', () => {
    clearX.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(() => { f.query = input.value; drawList(); }, 150);
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); f.query = input.value; drawList(); blur(); } });
  clearX.addEventListener('click', () => { input.value = ''; f.query = ''; clearX.hidden = true; clearTimeout(timer); drawList(); input.focus(); });

  // Scrolling the page closes the keyboard (user scrolls only, so typing never loses focus).
  leave();
  const onUserScroll = () => blur();
  // While the pinned block is stuck it gets a bottom border, so rows don't slide under it unmarked.
  const onScroll = () => { top.classList.toggle('stuck', top.isConnected && top.getBoundingClientRect().top <= 0.5 && window.scrollY > 0); };
  window.addEventListener('touchmove', onUserScroll, { passive: true });
  window.addEventListener('wheel', onUserScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  offScroll = () => {
    window.removeEventListener('touchmove', onUserScroll); window.removeEventListener('wheel', onUserScroll); window.removeEventListener('scroll', onScroll);
  };

  update();
  return [
    header(`Pick a dinner for ${DAY_SHORT[weekday(date)]}`, { back }),
    current ? h('p', { class: 'hint swapnow', text: `Now: ${current.title}` }) : null,
    append(top, [
      h('div', { class: 'searchbox' }, h('span', { class: 'searchicon', 'aria-hidden': 'true' }), input, clearX),
      h('div', { class: 'chipscroll' }, chipRow),
      count]),
    listBox,
  ];
}
