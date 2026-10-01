// What you need: tap off what's already in the kitchen for one meal.
import { h, header, button, checkRow, toast } from '../dom.js';
import { isBlocked, allergyConflict } from '../rules.js';
import { ingredientAmount, unitFamily, itemText, toBase, LABEL_LINE, LABEL_SUFFIX } from '../grocery.js';
import { shareWithFallback } from '../share.js';
import { cap } from '../view.js';

function lineFor(ing) {
  if (ing.staple || ing.qty == null) return ing.name;
  const fam = unitFamily(ing.unit || '');
  return itemText(fam, toBase(ing.qty, ing.unit || ''), ing.unit || '', ing.name);
}

export function render(ctx, params) {
  const r = ctx.recipe(params[0]);
  if (!r) return [header('What you need', { back: '#/tonight' })];
  if (allergyConflict(r, ctx.state.allergies, ctx.data.vocab)) {
    return [header('What you need', { back: '#/recipes' }), h('div', { class: 'card' }, h('h2', { text: 'Not for your family' }), h('p', { class: 'meta', text: 'This meal has something on your Allergies list.' }))];
  }
  if (isBlocked(r, ctx.state.people, ctx.data.vocab)) {
    return [header('What you need', { back: '#/recipes' }), h('div', { class: 'card' }, h('h2', { text: 'Not for your family' }), h('p', { class: 'meta', text: 'This meal has a never food for someone in your family.' }))];
  }
  const st = ctx.state;
  const have = new Set(st.needChecked[r.id] || []);
  const rows = r.ingredients.map((ing) => {
    const amount = ingredientAmount(ing);
    const hint = ing.staple ? 'a pantry basic' : [amount, ing.optional ? '(optional)' : ''].filter(Boolean).join(' ');
    const row = checkRow(cap(ing.name), hint, have.has(ing.key), () => {
      if (have.has(ing.key)) have.delete(ing.key); else have.add(ing.key);
      st.needChecked[r.id] = [...have];
      ctx.save();
      row.setAttribute('aria-checked', have.has(ing.key) ? 'true' : 'false');
    }, ing.check_label === true ? LABEL_LINE : '');
    row.dataset.key = ing.key;
    return row;
  });
  const mount = h('div');
  const share = () => {
    const missing = r.ingredients.filter((i) => !have.has(i.key));
    const buy = missing.filter((i) => !i.staple).map((i) => `- ${lineFor(i)}${i.optional ? ' (optional)' : ''}${i.check_label === true ? LABEL_SUFFIX : ''}`);
    const basics = missing.filter((i) => i.staple).map((i) => i.name);
    const text = [`Shopping list: ${r.title}`, ...buy, ...(basics.length ? ['', `Check you have: ${basics.join(', ')}`] : [])].join('\n');
    shareWithFallback({ title: `Shopping list: ${r.title}`, text }, { toast, mount });
  };
  return [
    header('What you need', { back: '#/tonight' }),
    h('p', { class: 'sub', text: `${r.title} · feeds ${r.serves}` }),
    h('p', { class: 'sub', text: 'Tap what you already have.' }),
    h('div', { class: 'card checklist', id: 'need-list' }, rows),
    mount,
    h('div', { class: 'spacer' }),
    h('div', { class: 'btnstack' },
      button('Share as shopping list', share, '', { id: 'share-need' }),
      h('a', { class: 'btn primary', href: `#/cook/${r.id}/1`, id: 'start-cooking' }, 'Start cooking')),
    h('p', { class: 'footer-note', text: 'We never order for you.' }),
  ];
}
