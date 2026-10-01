// Cook mode: one step per screen, kid job card, timers, wake lock.
import { h, header, button, placeholder } from '../dom.js';
import { fillKid, kidName, kidBadge } from '../people.js';
import { isBlocked, allergyConflict } from '../rules.js';
import { timerId, isDone, leftMs, fmt } from '../timers.js';
import { acquire, release, wakeLockSupported } from '../wakelock.js';

const LEARN = (w) => w.replace(/-/g, ' ');

function progress(i, n) {
  const bar = h('div');
  bar.style.width = `${Math.round(((i + 1) / n) * 100)}%`;
  return h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(n), 'aria-valuenow': String(i + 1) }, bar);
}

function timerBlock(ctx, r, i, step) {
  const id = timerId(r.id, i);
  const t = ctx.state.timers.find((x) => x.id === id);
  const label = step.text.length > 40 ? step.text.slice(0, 39) + '\u2026' : step.text;
  if (!t) {
    return button(`\u25B6  Start timer \u2014 ${step.timer_min} min`, () => ctx.timers.start(id, label, step.timer_min), 'primary timerbtn', { id: 'start-timer' });
  }
  const now = Date.now();
  const paused = t.pausedLeftMs != null;
  const done = isDone(t, now);
  return h('div', { class: done ? 'countdown done' : 'countdown', id: 'countdown', 'data-timer-big': id },
    h('span', { class: 'left', 'data-timer-left': id, text: done ? 'Done!' : fmt(leftMs(t, now)) }),
    done
      ? button('OK', () => ctx.timers.dismiss(id), 'small')
      : button(paused ? '\u25B6 Resume' : '\u275A\u275A Pause', () => (paused ? ctx.timers.resume(id) : ctx.timers.pause(id)), 'small', { id: 'pause-timer' }));
}

function adultStep(ctx, r, i, n, step, nav) {
  const hint = h('p', { class: 'hint center', id: 'wake-hint', text: wakeLockSupported() ? 'Screen stays on while you cook.' : 'Tip: keep your screen awake in phone settings while cooking.' });
  return [
    header(`Step ${i + 1} of ${n}`),
    progress(i, n),
    h('p', { class: step.text.length > 70 ? 'steptext long' : 'steptext', text: fillKid(step.text, ctx.state) }),
    step.minutes ? h('p', { class: 'about', text: `About ${step.minutes} minute${step.minutes === 1 ? '' : 's'}` }) : null,
    step.timer_min ? timerBlock(ctx, r, i, step) : null,
    step.safety ? h('p', { class: 'safety', text: '\u26A0 ' + fillKid(step.safety, ctx.state) }) : null,
    hint,
    h('div', { class: 'spacer' }),
    nav,
  ];
}

function kidStep(ctx, r, i, n, step, next, backHref) {
  const name = kidName(ctx.state);
  return [
    header(`${name} job`, { back: backHref }),
    h('p', { class: 'hint', text: `Step ${i + 1} of ${n}` }),
    progress(i, n),
    h('div', { class: 'card accent-line', id: 'kid-card' },
      h('span', { class: 'badge big', text: kidBadge(ctx.state) }),
      h('span', { class: 'badge outline', text: `${name} learns: ${(step.learns || []).map(LEARN).join(', ')}` }),
      placeholder('picture: ' + step.text.toLowerCase()),
      h('h2', { class: 'kidtitle', text: fillKid(step.text, ctx.state) }),
      h('ol', { class: 'howlist' }, (step.how || []).map((x) => h('li', { text: fillKid(x, ctx.state) })))),
    h('p', { class: 'safety' }, `\u2713 Safe for ${name}:`, h('br'), 'no knives, no heat'),
    h('div', { class: 'spacer' }),
    h('div', { class: 'btnstack' },
      button(`${name} did it!`, next, 'primary', { id: 'kid-did-it' }),
      button('Skip', next, '', { id: 'kid-skip' })),
  ];
}

export function render(ctx, params) {
  const r = ctx.recipe(params[0]);
  if (!r) return [header('Recipe not found', { back: '#/tonight' })];
  if (allergyConflict(r, ctx.state.allergies, ctx.data.vocab)) {
    return [header(r.title, { back: '#/recipes' }), h('div', { class: 'card' }, h('h2', { text: 'Not for your family' }), h('p', { class: 'meta', text: 'This meal has something on your Allergies list.' }))];
  }
  if (isBlocked(r, ctx.state.people, ctx.data.vocab)) {
    return [header(r.title, { back: '#/recipes' }), h('div', { class: 'card' }, h('h2', { text: 'Not for your family' }), h('p', { class: 'meta', text: 'This meal has a never food for someone in your family.' }))];
  }
  const n = r.steps.length;
  const i = Math.min(Math.max((parseInt(params[1], 10) || 1) - 1, 0), n - 1);
  const step = r.steps[i];
  const backHref = i === 0 ? `#/need/${r.id}` : `#/cook/${r.id}/${i}`;
  const nextHref = i === n - 1 ? `#/done/${r.id}` : `#/cook/${r.id}/${i + 2}`;
  const next = () => ctx.go(nextHref);

  acquire().then((ok) => {
    const el = document.getElementById('wake-hint');
    if (el && !ok && !wakeLockSupported()) el.textContent = 'Tip: keep your screen awake in phone settings while cooking.';
  });

  if (step.who === 'kid') return kidStep(ctx, r, i, n, step, next, backHref);
  const nav = h('div', { class: 'btnrow' },
    h('a', { class: 'btn', href: backHref, id: 'step-back' }, '\u2039 Back'),
    h('a', { class: 'btn primary', href: nextHref, id: 'step-next' }, i === n - 1 ? 'Done \u203A' : 'Next \u203A'));
  return adultStep(ctx, r, i, n, step, nav);
}

export function leave() {
  release();
}
