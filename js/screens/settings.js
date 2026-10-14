import { h, header, button, linkButton } from '../dom.js';
import { deleteAll } from '../store.js';
import { customOf, exportText } from '../custom.js';
import { shareWithFallback } from '../share.js';
import { toast } from '../dom.js';

export const APP_VERSION = '1.0.0';

export function render(ctx) {
  const mount = h('div');
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
      h('p', { class: 'meta', text: 'Everything you enter stays on this phone. When you tap an Amazon button, only product numbers, item names and amounts go to amazon.com, never names of people or allergies.' }),
      // Export: only when you have saved at least one recipe of your own (plain text, through your phone's share sheet).
      customOf(ctx.data).length
        ? button('Share my recipes', () => shareWithFallback({ title: 'My recipes', text: exportText(customOf(ctx.data)) }, { toast, mount }), 'small', { id: 'export-custom' })
        : null,
      mount,
      button('Delete my data', onDelete, 'danger', { id: 'delete-data' })),
    h('div', { class: 'card' },
      h('h3', { text: 'About' }),
      h('p', { class: 'meta', text: `Family Cook v${APP_VERSION}` }),
      h('p', { class: 'meta', text: 'No accounts. No tracking. We never order for you.' }),
      linkButton('Photo credits', '#/credits', 'small credits-link')),
  ];
}
