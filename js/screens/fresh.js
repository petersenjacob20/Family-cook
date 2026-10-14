// Send to Amazon cart. Three screens:
//   #/fresh                  the required check screen, then "Add to Amazon cart"
//   #/fresh/products         this week's items and the product saved for each
//   #/fresh/product/<key>    save the one exact product for one ingredient
// "Search Amazon" opens Amazon's search for the ingredient name only (you pick the product).
// The app never picks a product or a swap for you, and never places an order.
import { h, append, header, button, checkRow, toast } from '../dom.js';
import { weekIdFor, todayISO } from '../dates.js';
import { fillWeek, getWeek, byId } from '../planner.js';
import { buildList, ingredientNotes } from '../grocery.js';
import { shareWithFallback } from '../share.js';
import { planSend, cartUrl, makeEntry, productUrl, sendSummary, blockReason, AMAZON_CART, freshPayload, freshForm } from '../fresh.js';

export const SUBS_LINE = 'Turn substitutions OFF and read every label.';
export const LABEL_BOX = "I read this exact label: no peanuts, no tree nuts, no \u201cmay contain\u201d or \u201csame facility\u201d nut warning, and no fish or seafood.";

function weekList(ctx) {
  const { state, data } = ctx;
  const weekId = weekIdFor(ctx.today());
  fillWeek(state, data, weekId);
  getWeek(state, weekId);
  return buildList(state, (id) => (id ? byId(data, id) : null), weekId);
}

// Ingredient name for a key, from the recipe file.
function ingredientFor(data, key) {
  for (const r of data.recipes || []) for (const i of r.ingredients || []) if (i.key === key) return i;
  return null;
}

function openExternal(url) {
  if (!url) return;
  if (navigator.onLine === false) { toast('You\u2019re offline. Connect, then try again.'); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function render(ctx, params = []) {
  if (params[0] === 'products') return productsScreen(ctx);
  if (params[0] === 'product' && params[1]) return productScreen(ctx, params[1]);
  return sendScreen(ctx);
}

// ---------- #/fresh ----------
function sendScreen(ctx) {
  const vocab = ctx.data.vocab;
  const list = weekList(ctx);
  const plan = planSend(list, ctx.state.fresh, vocab);
  const url = cartUrl(plan.send);
  let agreed = false;

  const openBtn = button('Add to Amazon cart', () => {
    if (!agreed || !url) return;
    openExternal(url);
  }, 'primary', { id: 'fresh-open', disabled: true });

  const agree = checkRow('I\u2019ll turn substitutions off and read every label before I order.', '', false, () => {
    agreed = !agreed;
    agree.setAttribute('aria-checked', agreed ? 'true' : 'false');
    openBtn.disabled = !(agreed && url);
  });
  agree.id = 'fresh-agree';

  const mount = h('div');
  const line = (l, right) => h('li', null, h('strong', { text: l.text }), right ? h('span', { class: 'meta', text: right }) : null);

  // Amazon Fresh test: only when Settings > "Amazon Fresh test" is on. Nothing is built until tapped.
  let testArea = null;
  if (ctx.state.freshTest === true) {
    testArea = h('div', { id: 'fresh-test' });
    const tryBtn = button('Try Amazon Fresh (test)', () => {
      const { payload, sent, blocked } = freshPayload(list, vocab);
      let ticked = false;
      const go = button('Open Amazon Fresh (test)', () => {
        if (!ticked || !payload.ingredients.length) return;
        if (navigator.onLine === false) { toast('You\u2019re offline. Connect, then try again.'); return; }
        const form = freshForm(document, payload); // built here, inside the tap
        document.body.appendChild(form);
        form.submit();
        form.remove();
      }, 'danger', { id: 'fresh-test-open', disabled: true });
      const tick = checkRow('Amazon picks these products, not you. Check every label for peanuts, tree nuts and fish before you buy.', '', false, () => {
        ticked = !ticked;
        tick.setAttribute('aria-checked', ticked ? 'true' : 'false');
        go.disabled = !(ticked && payload.ingredients.length);
      });
      tick.id = 'fresh-test-agree';
      testArea.replaceChildren(h('div', { class: 'card freshtestwarn', id: 'fresh-test-warning', role: 'alert' },
        h('h2', { text: 'Test: Amazon picks the products' }),
        h('p', { class: 'meta', text: `Sends ${sent.length} item name${sent.length === 1 ? '' : 's'} and amounts to Amazon Fresh. No names of people, no allergies.` }),
        blocked.length ? h('div', null,
          h('p', { class: 'section-label', text: `Never sent (${blocked.length})` }),
          h('ul', { class: 'freshlist', id: 'fresh-test-blocked' }, blocked.map((l) => line(l, l.why)))) : null,
        h('div', { class: 'freshtestact' }, tick, go)));
      // Bring the card's button into view, clear of the sticky footer (see scroll-margin-bottom in the CSS).
      if (typeof requestAnimationFrame === 'function' && go.scrollIntoView) requestAnimationFrame(() => go.scrollIntoView({ block: 'end' }));
    }, 'small', { id: 'fresh-test-try' });
    testArea.appendChild(tryBtn);
  }

  // The tick box sits in the sticky footer, right above the button it unlocks, so it is always in view.
  const foot = h('div', { class: 'stickyfoot', id: 'fresh-foot' },
      agree,
      openBtn,
      h('div', { class: 'row' },
        button('Copy this list', () => shareWithFallback({ title: 'Amazon cart', text: sendSummary(plan) }, { toast, mount }), 'small', { id: 'fresh-copy' }),
        button('My cart', () => openExternal(AMAZON_CART), 'small', { id: 'fresh-cart' })),
      h('p', { class: 'footer-note', text: 'Amazon asks you to confirm, then adds the items to your cart. Nothing is ordered.' }));
  const body = h('div', { class: 'freshbody', id: 'fresh-body' });
  // Bottom padding = the footer's real height, kept in step if it changes.
  const syncFoot = () => body.style.setProperty('--freshfoot-h', `${Math.ceil(foot.getBoundingClientRect().height)}px`);
  if (typeof window !== 'undefined' && 'ResizeObserver' in window) new ResizeObserver(syncFoot).observe(foot);

  return [
    header('Send to Amazon cart', { back: '#/grocery' }),
    append(body,
    [h('div', { class: 'card accent-line freshwarn', id: 'fresh-warning', role: 'alert' },
      h('h2', { text: SUBS_LINE }),
      h('p', { text: 'Amazon can swap an out-of-stock item for something else. In your Amazon cart or at checkout, set every item to \u201cDon\u2019t substitute.\u201d Then open each item and read the whole label before you tap Place order.' }),
      h('p', { class: 'meta', text: 'This app only fills the cart. You place the order yourself.' })),
    plan.send.length
      ? h('div', { class: 'card' },
        h('p', { class: 'section-label', text: `Going to your Amazon cart (${plan.send.length})` }),
        h('ul', { class: 'freshlist', id: 'fresh-send' }, plan.send.map((l) => line(l, `${l.label || l.asin} \u00d7 ${l.qty}`))))
      : h('div', { class: 'card' },
        h('p', { class: 'meta', text: 'No saved products for this week\u2019s list yet. Choose the exact product for each item first.' })),
    plan.manual.length
      ? h('div', { class: 'card gray' },
        h('p', { class: 'section-label', text: `Not sent \u2014 no product saved (${plan.manual.length})` }),
        h('ul', { class: 'freshlist', id: 'fresh-manual' }, plan.manual.map((l) => line(l))),
        h('p', { class: 'meta', text: 'Add these yourself, or save a product for each one.' }))
      : null,
    plan.blocked.length
      ? h('div', { class: 'card gray' },
        h('p', { class: 'section-label', text: `Never sent (${plan.blocked.length})` }),
        h('ul', { class: 'freshlist', id: 'fresh-blocked' }, plan.blocked.map((l) => line(l, l.why))))
      : null,
    h('a', { class: 'btn', href: '#/fresh/products', id: 'fresh-products' }, 'Choose products'),
    testArea,
    mount]),
    foot,
  ];
}

// ---------- #/fresh/products ----------
function productsScreen(ctx) {
  const vocab = ctx.data.vocab;
  const fresh = ctx.state.fresh;
  const list = weekList(ctx);
  const lines = list.sections.flatMap((s) => s.lines.filter((l) => !l.checked));
  const thisWeek = new Set(lines.map((l) => l.key));
  const others = Object.keys(fresh).filter((k) => !thisWeek.has(k)).sort();

  const row = (key, title) => {
    const e = fresh[key];
    const why = blockReason(title, vocab);
    return h('a', { class: 'card freshrow', href: `#/fresh/product/${encodeURIComponent(key)}`, 'data-key': key },
      h('strong', { text: title }),
      h('span', { class: 'meta', text: why ? `Never sent (${why})` : e ? `${e.label || 'Saved product'} \u00b7 ${e.asin} \u00d7 ${e.qty}` : 'No product yet' }));
  };

  return [
    header('Amazon products', { back: '#/fresh' }),
    h('p', { class: 'sub', text: 'One exact product per item. Open it on Amazon, read the whole label, then save it here. Only these exact products are ever added. Saved on this phone only.' }),
    lines.length ? h('p', { class: 'section-label', text: 'This week' }) : h('p', { class: 'meta', text: 'Nothing on this week\u2019s list.' }),
    lines.map((l) => row(l.key, l.text)),
    others.length ? h('p', { class: 'section-label', text: 'Other saved products' }) : null,
    others.map((k) => {
      const ing = ingredientFor(ctx.data, k);
      return row(k, ing ? ing.name : k.replace(/-/g, ' '));
    }),
  ];
}

// ---------- #/fresh/product/<key> ----------
function productScreen(ctx, key) {
  const vocab = ctx.data.vocab;
  const ing = ingredientFor(ctx.data, key);
  const name = ing ? ing.name : key.replace(/-/g, ' ');
  const title = name.charAt(0).toUpperCase() + name.slice(1); // display only; stored data unchanged
  const saved = ctx.state.fresh[key];
  const blocked = blockReason(name, vocab);

  if (blocked) {
    return [
      header(title, { back: '#/fresh/products' }),
      h('div', { class: 'card gray' }, h('p', { text: `This item is never sent to Amazon (${blocked}).` })),
    ];
  }

  let labelRead = false;
  const linkIn = h('input', { class: 'input', id: 'fresh-asin', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'Paste Amazon link or ASIN', value: saved ? saved.asin : '', 'aria-label': 'Amazon product link or ASIN' });
  const labelIn = h('input', { class: 'input', id: 'fresh-label', type: 'text', maxlength: '80', placeholder: 'Brand, product, size', value: saved ? saved.label : '', 'aria-label': 'Product name' });
  const qtyIn = h('input', { class: 'input', id: 'fresh-qty', type: 'number', min: '1', max: '9', inputmode: 'numeric', value: String(saved ? saved.qty : 1), 'aria-label': 'How many to add' });
  const err = h('p', { class: 'error', id: 'fresh-error', role: 'alert' });
  const box = checkRow(LABEL_BOX, saved && saved.checkedOn ? `Last checked ${saved.checkedOn}. Tick again each time you save.` : 'Tick again each time you save.', false, () => {
    labelRead = !labelRead;
    box.setAttribute('aria-checked', labelRead ? 'true' : 'false');
  });
  box.id = 'fresh-labelread';

  const saveIt = () => {
    const res = makeEntry({ asinInput: linkIn.value, label: labelIn.value, qty: qtyIn.value, labelRead, today: todayISO() }, name, vocab);
    if (!res.ok) { err.textContent = res.error; return; }
    ctx.state.fresh[key] = res.entry;
    ctx.save();
    toast('Saved.');
    ctx.go('#/fresh/products');
  };
  const remove = () => {
    delete ctx.state.fresh[key];
    ctx.save();
    toast('Removed.');
    ctx.go('#/fresh/products');
  };
  const search = `https://www.amazon.com/s?k=${encodeURIComponent(name)}`;

  return [
    header(title, { back: '#/fresh/products' }),
    ingredientNotes(ing || { key }).map((n) => h('p', { class: 'meta', text: n })),
    h('div', { class: 'card' },
      h('p', { class: 'section-label', text: '1. Find it' }),
      h('p', { class: 'meta', text: 'Search Amazon yourself and open the product you want. Read the ingredients and the allergen statement on the product page and the package photos.' }),
      button('Search Amazon', () => openExternal(search), 'small', { id: 'fresh-search' }),
      saved ? button('Open saved product', () => openExternal(productUrl(saved.asin)), 'small', { id: 'fresh-recheck' }) : null),
    h('div', { class: 'card' },
      h('p', { class: 'section-label', text: '2. Save it' }),
      linkIn, labelIn,
      h('div', { class: 'row' }, h('span', { class: 'meta', text: 'How many to add' }), qtyIn),
      box,
      err,
      button('Save product', saveIt, 'primary', { id: 'fresh-save' }),
      saved ? button('Remove product', remove, 'danger small', { id: 'fresh-remove' }) : null),
    h('p', { class: 'footer-note', text: 'Labels change. Check again when the package looks different.' }),
  ];
}
