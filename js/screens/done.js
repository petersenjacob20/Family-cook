import { h, header, button, toast } from '../dom.js';
import { recordCooked } from '../planner.js';

export function render(ctx, params) {
  const r = ctx.recipe(params[0]);
  if (!r) return [header('Nice work!', { back: '#/tonight' })];
  // History is written when the cook reaches Done, not when the meal is planned.
  recordCooked(ctx.state, ctx.today(), r.id);
  ctx.save();
  const cur = ctx.state.ratings[r.id] || null;
  const rate = (v) => {
    ctx.state.ratings[r.id] = v;
    ctx.save();
    toast(v === 'liked' ? 'Saved. We\u2019ll plan it again.' : 'Saved. We won\u2019t plan it again.');
    ctx.refresh();
  };
  return [
    header('Nice work!'),
    h('p', { class: 'sub', text: `You made ${r.title}.` }),
    h('div', { class: 'card accent' }, h('h2', { text: 'How was it?' }), h('p', { class: 'meta', text: 'Tap again any time to change it.' })),
    h('div', { class: 'spacer' }),
    h('div', { class: 'btnstack' },
      button((cur === 'liked' ? '\u2713 ' : '') + 'We liked this', () => rate('liked'), cur === 'liked' ? 'primary' : '', { id: 'rate-liked', 'aria-pressed': cur === 'liked' ? 'true' : 'false' }),
      button((cur === 'not_again' ? '\u2713 ' : '') + 'Not again', () => rate('not_again'), cur === 'not_again' ? 'primary' : '', { id: 'rate-not-again', 'aria-pressed': cur === 'not_again' ? 'true' : 'false' }),
      h('a', { class: 'link', href: '#/tonight', id: 'back-tonight' }, 'Back to tonight')),
  ];
}
