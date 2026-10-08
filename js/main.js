// Router + screen mounting.
import { load, save, housekeep } from './store.js';
import { appTitle } from './people.js';
import { todayISO } from './dates.js';
import { byId } from './planner.js';
import * as tonight from './screens/tonight.js';
import * as week from './screens/week.js';
import * as grocery from './screens/grocery.js';
import * as family from './screens/family.js';
import * as settings from './screens/settings.js';
import * as setup from './screens/setup.js';
import * as swap from './screens/swap.js';
import * as recipes from './screens/recipes.js';
import * as cook from './screens/cook.js';
import * as done from './screens/done.js';
import * as need from './screens/need.js';
import * as credits from './screens/credits.js';
import { createTimerController, leftMs, isDone, fmt } from './timers.js';

const ROUTES = { tonight, week, grocery, family, settings, setup, swap, recipes, cook, done, need, credits };
const NO_TABS = new Set(['setup', 'cook']);
const TAB_FOR = { swap: 'week', recipes: 'family', settings: 'family', credits: 'family', need: 'tonight', done: 'tonight' };

const ctx = {
  state: load(),
  data: { recipes: [], filterTags: [], photoCredits: [], vocab: {}, seasonal: { months: {} } },
  anyway: null,
  swapped: null, // the Week night to highlight right after a swap
  save() { save(ctx.state); },
  today() { return todayISO(); },
  recipe(id) { return byId(ctx.data, id); },
  go(hash) { if (location.hash === hash) render(); else location.hash = hash; },
  refresh() { render(); },
  stopAll() {},
  onSetupDone() { registerSW(); },
  leaveHooks: [],
};

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
  const parts = raw.split('/').filter(Boolean).map(dec);
  return { name: parts[0] || 'tonight', params: parts.slice(1) };
}

let current = null;
function render() {
  const route = parseHash();
  if (!ctx.state.setupDone && route.name !== 'setup') {
    history.replaceState(null, '', '#/setup');
    route.name = 'setup';
    route.params = [];
  }
  const name = ROUTES[route.name] ? route.name : 'tonight';
  const mod = ROUTES[name];
  if (current && current.mod.leave && current.name !== name) current.mod.leave(ctx);
  current = { name, mod };
  document.body.classList.toggle('no-tabs', NO_TABS.has(name));
  const tab = TAB_FOR[name] || name;
  for (const a of document.querySelectorAll('#tabs a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.title = appTitle(ctx.state);
  const root = document.getElementById('app');
  const out = mod.render(ctx, route.params);
  root.replaceChildren(...[].concat(out).flat(Infinity).filter(Boolean));
  window.scrollTo(0, 0);
  drawTimerBar();
}

// Bottom bar for running timers that aren't the big button on this screen.
let barSig = '';
function drawTimerBar() {
  const bar = document.getElementById('timerbar');
  const now = Date.now();
  const list = ctx.state.timers.filter((t) => !isDone(t, now) && !document.querySelector(`[data-timer-big="${CSS.escape(t.id)}"]`));
  const sig = list.map((t) => t.id + (t.pausedLeftMs != null ? 'p' : 'r')).join('|') + location.hash;
  if (sig !== barSig) {
    barSig = sig;
    bar.replaceChildren(...list.map((t) => {
      const paused = t.pausedLeftMs != null;
      const label = document.createElement('span');
      label.className = 'tlabel';
      label.textContent = t.label;
      const left = document.createElement('span');
      left.className = 'tleft';
      left.dataset.timerLeft = t.id;
      left.textContent = fmt(leftMs(t, now));
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small';
      b.textContent = paused ? 'Resume' : 'Pause';
      b.addEventListener('click', () => (paused ? ctx.timers.resume(t.id) : ctx.timers.pause(t.id)));
      const row = document.createElement('div');
      row.className = 'trow';
      row.append(label, left, b);
      return row;
    }));
  }
  bar.hidden = list.length === 0;
  document.body.classList.toggle('has-timerbar', list.length > 0);
  syncBarHeight();
}

// Screens pad their bottom by the bar's real height (--timerbar-h, plus the safe area in CSS),
// so the last item and the main button always scroll clear of it. A ResizeObserver keeps it
// right when rows are added or removed, the text wraps, or the phone rotates.
let barH = -1;
function syncBarHeight() {
  const bar = document.getElementById('timerbar');
  const px = bar.hidden ? 0 : Math.ceil(bar.getBoundingClientRect().height);
  if (px === barH) return;
  barH = px;
  document.documentElement.style.setProperty('--timerbar-h', `${px}px`);
}
function watchBar() {
  const bar = document.getElementById('timerbar');
  if (bar && 'ResizeObserver' in window) new ResizeObserver(syncBarHeight).observe(bar);
}

// The service worker registers once setup is done (so "Delete my data" leaves none behind).
function registerSW() {
  if (!('serviceWorker' in navigator) || !ctx.state.setupDone) return;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => { /* offline mode unavailable */ });
}

async function loadJSON(name) {
  const res = await fetch(`./data/${name}`);
  if (!res.ok) throw new Error(`Could not load ${name}`);
  return res.json();
}

async function start() {
  try {
    const [r, vocab, seasonal] = await Promise.all([loadJSON('recipes.json'), loadJSON('vocab.json'), loadJSON('seasonal.json')]);
    ctx.data = { recipes: r.recipes || [], filterTags: r.filter_tags || [], photoCredits: r.photo_credits || [], vocab, seasonal };
  } catch (e) {
    const root = document.getElementById('app');
    root.textContent = 'Could not load the recipes. Check your connection and reload once.';
    return;
  }
  ctx.timers = createTimerController({
    getState: () => ctx.state,
    save: () => ctx.save(),
    banner: document.getElementById('banner'),
    onChange: () => { barSig = ''; if (current && current.name === 'cook') render(); else drawTimerBar(); },
  });
  ctx.timers.onTick(() => drawTimerBar());
  ctx.stopAll = () => ctx.timers.stopAll();
  housekeep(ctx.state, ctx.today());
  if (ctx.state.setupDone) ctx.save(); // nothing is written before setup starts
  window.addEventListener('hashchange', render);
  watchBar();
  render();
  registerSW();
}

start();
