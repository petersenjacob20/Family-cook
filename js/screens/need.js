// What you need: tap off what's already in the kitchen for one meal.
import { h, header, button, checkRow, toast, toggle } from '../dom.js';
import { isBlocked, allergyConflict, visibleSwaps } from '../rules.js';
import {
  ingredientAmount, unitFamily, itemText, toBase, LABEL_LINE, LABEL_SUFFIX, ingredientNotes,
  SWAP_LABEL_LINE, proteinInfoLines, swapHeading, swapClaimText,
} from '../grocery.js';
import { shareWithFallback } from '../share.js';
import { cap, recipePhoto } from '../view.js';

function lineFor(ing) {
  if (ing.staple || ing.qty == null) return ing.name;
  const fam = unitFamily(ing.unit || '');
  return itemText(fam, toBase(ing.qty, ing.unit || ''), ing.unit || '', ing.name);
}

// One optional swap: "Optional" badge, heading, note, the claim as written (first letter capitalised), then the label lines.
function swapCard(w, r) {
  return h('div', { class: 'swapcard', 'data-swap': w.id },
    h('span', { class: 'badge outline', text: 'Optional' }),
    h('strong', { class: 'swaphead', text: swapHeading(w, r) }),
    h('p', { class: 'swapnote', text: w.note }),
    h('p', { class: 'swapclaim', text: swapClaimText(w.protein.claim) }),
    w.check_label === true ? [
      h('p', { class: 'note', text: LABEL_LINE }),
      h('p', { class: 'hint labelline', text: SWAP_LABEL_LINE }),
    ] : null);
}

// "About 56 g protein per serving" plus the source line. With no number, only the note (if any).
function proteinInfo(r) {
  const p = proteinInfoLines(r);
  if (p.protein) {
    return h('div', { class: 'protein-info', id: 'protein-info' },
      h('p', { class: 'protein', text: p.protein }),
      h('p', { class: 'hint', text: p.source }));
  }
  if (p.note) return h('div', { class: 'protein-info', id: 'protein-info' }, h('p', { class: 'hint', text: p.note }));
  return null;
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
  const swaps = visibleSwaps(r, st, ctx.data.vocab);
  const rowFor = (ing) => {
    const amount = ingredientAmount(ing);
    const hint = ing.staple ? 'a pantry basic' : [amount, ing.optional ? '(optional)' : ''].filter(Boolean).join(' ');
    const row = checkRow(cap(ing.name), hint, have.has(ing.key), () => {
      if (have.has(ing.key)) have.delete(ing.key); else have.add(ing.key);
      st.needChecked[r.id] = [...have];
      ctx.save();
      row.setAttribute('aria-checked', have.has(ing.key) ? 'true' : 'false');
    }, ingredientNotes(ing));
    row.dataset.key = ing.key;
    return row;
  };
  // Swaps show under the ingredient they replace; "add" swaps go at the end. Only while the toggle is on.
  const rows = () => {
    const on = st.showProtein === true && swaps.length > 0;
    const out = [];
    for (const ing of r.ingredients) {
      out.push(rowFor(ing));
      if (on) for (const w of swaps) if (w.type === 'swap' && w.replaces === ing.key) out.push(swapCard(w, r));
    }
    if (on) for (const w of swaps) if (w.type === 'add') out.push(swapCard(w, r));
    return out;
  };
  const list = h('div', { class: 'card checklist', id: 'need-list' }, rows());
  // "Show protein options": only on recipes with at least one swap this household can use.
  let protToggle = null;
  const drawToggle = () => {
    const t = toggle('Show protein options', 'Optional swaps for more protein', st.showProtein === true, (v) => {
      st.showProtein = v;
      ctx.save();
      list.replaceChildren(...rows());
      drawToggle();
    });
    t.id = 'protein-toggle';
    if (protToggle) protToggle.replaceWith(t);
    protToggle = t;
    return t;
  };
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
    recipePhoto(r, 'hero'),
    h('p', { class: 'sub', text: `${r.title} · feeds ${r.serves}` }),
    proteinInfo(r),
    // The toggle sits above the instruction so "Tap what you already have." stays right over the checklist.
    swaps.length ? drawToggle() : null,
    h('p', { class: 'sub', text: 'Tap what you already have.' }),
    list,
    mount,
    h('div', { class: 'spacer' }),
    h('div', { class: 'btnstack' },
      button('Share as shopping list', share, '', { id: 'share-need' }),
      h('a', { class: 'btn primary', href: `#/cook/${r.id}/1`, id: 'start-cooking' }, 'Start cooking')),
    h('p', { class: 'footer-note', text: 'We never order for you.' }),
  ];
}
