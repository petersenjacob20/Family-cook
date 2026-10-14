import { h, header, button, linkButton, toggle } from '../dom.js';
import { deleteAll } from '../store.js';

export const APP_VERSION = '1.0.0';

export function render(ctx) {
  const onDelete = async () => {
    const ok = window.confirm("This erases your family, plans and lists from this phone. It can't be undone.");
    if (!ok) return;
    ctx.stopAll();
    await deleteAll(window);
    location.hash = '#/setup';
    location.reload();
  };
  let freshT = null;
  const drawFresh = () => {
    const on = Boolean(ctx.state && ctx.state.freshTest === true);
    const t = toggle('Amazon Fresh test', 'Shows Amazon Fresh search links on Send to Amazon cart. You pick each product.', on, (v) => {
      if (!ctx.state) return;
      ctx.state.freshTest = v;
      if (ctx.save) ctx.save();
      drawFresh();
    });
    t.id = 'fresh-test-toggle';
    if (freshT) freshT.replaceWith(t);
    freshT = t;
    return t;
  };
  return [
    header('Settings', { back: '#/family' }),
    h('div', { class: 'card' },
      h('h3', { text: 'Try out' }),
      drawFresh()),
    h('div', { class: 'card' },
      h('h3', { text: 'Your data' }),
      h('p', { class: 'meta', text: 'Everything you enter stays on this phone. When you tap an Amazon button, only product numbers, item names and amounts go to amazon.com, never names of people or allergies.' }),
      button('Delete my data', onDelete, 'danger', { id: 'delete-data' })),
    h('div', { class: 'card' },
      h('h3', { text: 'About' }),
      h('p', { class: 'meta', text: `Family Cook v${APP_VERSION}` }),
      h('p', { class: 'meta', text: 'No accounts. No tracking. We never order for you.' }),
      linkButton('Photo credits', '#/credits', 'small credits-link')),
  ];
}
