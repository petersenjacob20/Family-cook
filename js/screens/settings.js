import { h, header, button, linkButton } from '../dom.js';
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
  return [
    header('Settings', { back: '#/family' }),
    h('div', { class: 'card' },
      h('h3', { text: 'Your data' }),
      h('p', { class: 'meta', text: 'Everything you enter stays on this phone. Nothing is sent anywhere.' }),
      button('Delete my data', onDelete, 'danger', { id: 'delete-data' })),
    h('div', { class: 'card' },
      h('h3', { text: 'About' }),
      h('p', { class: 'meta', text: `Family Cook v${APP_VERSION}` }),
      h('p', { class: 'meta', text: 'No accounts. No tracking. We never order for you.' }),
      linkButton('Photo credits', '#/credits', 'small credits-link')),
  ];
}
