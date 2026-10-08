// Tiny DOM helpers. Text is always set with textContent (never innerHTML).
// Nothing here touches the DOM at import time.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

export function header(title, { back } = {}) {
  const wrap = h('header', { class: back ? 'header has-back' : 'header' });
  if (back) {
    wrap.appendChild(h('button', {
      class: 'back', type: 'button', 'aria-label': 'Back', text: '\u2039',
      onclick: () => (typeof back === 'function' ? back() : (location.hash = back)),
    }));
  }
  wrap.appendChild(h('div', { class: 'titlewrap' }, h('h1', { text: title })));
  return wrap;
}

export function button(label, onClick, kind = '', extra = {}) {
  return h('button', { type: 'button', class: ('btn ' + kind).trim(), onclick: onClick, ...extra }, label);
}

export function linkButton(label, href, kind = '') {
  return h('a', { class: ('btn ' + kind).trim(), href }, label);
}

export function toggle(label, sub, on, onChange) {
  const sw = h('button', {
    type: 'button', class: 'switch', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label,
    onclick: () => onChange(!on),
  });
  return h('div', { class: 'toggle' },
    h('div', { class: 'tl' }, h('strong', { text: label }), sub ? h('span', { text: sub }) : null),
    sw);
}

export function chip(label, pressed, onClick, extraClass = '') {
  return h('button', {
    type: 'button', class: ('chip ' + extraClass).trim(), 'aria-pressed': pressed ? 'true' : 'false', onclick: onClick,
  }, label);
}

// `note` is an optional extra hint-size line in body color (the label line), or a list of them.
export function checkRow(title, hintText, checked, onClick, note = '') {
  return h('button', {
    type: 'button', class: 'check', role: 'checkbox', 'aria-checked': checked ? 'true' : 'false', onclick: onClick,
  },
  h('span', { class: 'box', 'aria-hidden': 'true' }),
  h('span', { class: 'txt' },
    h('strong', { text: title }),
    hintText ? h('span', { text: hintText }) : null,
    [].concat(note || []).filter(Boolean).map((n) => h('span', { class: 'note', text: n }))));
}

export function placeholder(label) {
  return h('div', { class: 'ph', 'aria-hidden': 'true' }, h('span', { text: label }));
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}
