// Photo credits: one card per recipe photo, from the build's photo_credits (Chef's recipe-photos files).
// Source and license links are plain links: nothing loads from outside until one is tapped.
import { h, header } from '../dom.js';
import { cap } from '../view.js';

// Only these pages are ever linked (the build checks the same hosts); anything else shows as plain text.
const LINK_RE = /^https:\/\/(commons\.wikimedia\.org\/wiki\/File:|www\.flickr\.com\/photos\/|creativecommons\.org\/(licenses|publicdomain)\/)[^\s"'<>]+$/;

export function creditLink(text, url) {
  if (typeof url !== 'string' || !LINK_RE.test(url)) return h('span', { text });
  return h('a', { class: 'creditlink', href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
}

function line(label, value) {
  return h('p', { class: 'creditline' }, h('span', { class: 'creditlabel', text: `${label}: ` }), value);
}

export function render(ctx) {
  const list = (ctx.data.photoCredits || []).slice().sort((a, b) => a.title.localeCompare(b.title));
  return [
    header('Photo credits', { back: '#/settings' }),
    h('p', { class: 'sub', text: 'Every photo is stored in the app. A link opens its source page in your browser.' }),
    h('div', { class: 'creditlist', id: 'credit-list' }, list.map((c) => h('div', { class: 'card credit', 'data-credit': c.id },
      h('h3', { text: c.title }),
      line('Photo by', h('span', { text: c.author })),
      line('Source', creditLink(cap(c.source), c.source_url)),
      line('License', creditLink(cap(c.license), c.license_url)),
      line('Changes', h('span', { text: c.changes }))))),
  ];
}
