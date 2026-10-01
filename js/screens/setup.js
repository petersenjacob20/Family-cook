// First-run setup (build plan section 6) plus the person and cooking-night editors reused by Family.
import { h, header, button, toggle, chip } from '../dom.js';
import { DAY_SHORT, weekday, isISODate, fridayOnOrBefore, addDays, todayISO } from '../dates.js';
import { personName, KID_FALLBACK } from '../people.js';
import { ALLERGIES } from '../rules.js';

export const SUGGESTIONS = ['pizza', 'pasta', 'Alfredo', 'fries', 'chicken', 'tacos', 'burgers', 'mac and cheese', 'fish', 'asparagus', 'mushrooms', 'spicy'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun chips

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function nextId(state) {
  let i = 1;
  while (state.people.some((p) => p.id === 'p' + i)) i++;
  return 'p' + i;
}

// One chip list (likes or never) that edits `list` in place.
export function chipGroup(list, cls, onChange) {
  const box = h('div', { class: 'chips' });
  const draw = () => {
    const words = [...SUGGESTIONS];
    for (const w of list) if (!words.some((s) => same(s, w))) words.push(w);
    box.replaceChildren(...words.map((w) => {
      const on = list.some((x) => same(x, w));
      return chip(w, on, () => {
        const i = list.findIndex((x) => same(x, w));
        if (i >= 0) list.splice(i, 1); else list.push(w);
        draw();
        onChange();
      }, cls);
    }));
  };
  draw();
  return { el: box, redraw: draw };
}

// Likes + never chips + typed chip for one person.
export function prefsEditor(person, onChange) {
  const likes = chipGroup(person.likes, '', onChange);
  const never = chipGroup(person.never, 'never', onChange);
  const input = h('input', { class: 'input', type: 'text', maxlength: '40', placeholder: 'Type a food', 'aria-label': `Type a food for ${personName(person)}` });
  const add = (list, group) => {
    const w = input.value.trim();
    if (!w) return;
    if (!list.some((x) => same(x, w))) list.push(w);
    input.value = '';
    group.redraw();
    onChange();
  };
  return h('div', { class: 'btnstack' },
    h('strong', { text: 'Likes' }), likes.el,
    h('strong', { text: 'Never' }), never.el,
    input,
    h('div', { class: 'btnrow' },
      button('+ Likes', () => add(person.likes, likes), 'small'),
      button('+ Never', () => add(person.never, never), 'small')));
}

// Household Allergies chips (Peanut, Tree nut) in the never chip style. Taps save right away.
export function allergyChips(ctx, onChange) {
  const box = h('div', { class: 'chips', id: 'allergy-chips' });
  const draw = () => {
    const st = ctx.state;
    if (!Array.isArray(st.allergies)) st.allergies = [];
    box.replaceChildren(...ALLERGIES.map((a) => chip(a.label, st.allergies.includes(a.id), () => {
      const on = st.allergies.includes(a.id);
      st.allergies = on ? st.allergies.filter((x) => x !== a.id) : ALLERGIES.map((x) => x.id).filter((x) => x === a.id || st.allergies.includes(x));
      ctx.save();
      draw();
      if (onChange) onChange();
    }, 'never')));
  };
  draw();
  return box;
}

export function allergySummaryText(state) {
  const picked = ALLERGIES.filter((a) => (state.allergies || []).includes(a.id)).map((a) => a.label);
  return picked.length ? picked.join(', ') : 'None';
}

export const ALLERGY_SUB = 'Tap any that apply. Meals with these never show up.';

// Cooking nights: day chips, every-other-Friday + date, Monday game-day.
export function nightsEditor(ctx) {
  const n = ctx.state.nights;
  const wrap = h('div', { class: 'btnstack' });
  const draw = () => {
    const chips = DAY_ORDER.map((d) => chip(DAY_SHORT[d], n.weekly.includes(d), () => {
      if (n.weekly.includes(d)) n.weekly = n.weekly.filter((x) => x !== d);
      else {
        n.weekly = [...n.weekly, d];
        if (d === 5) n.fridayAlt.on = false; // every Friday replaces every other Friday
      }
      ctx.save();
      draw();
    }));
    const today = todayISO();
    const minFri = fridayOnOrBefore(addDays(today, -364));
    const err = h('p', { class: 'error', hidden: true, text: 'Please pick a Friday.' });
    const date = h('input', {
      class: 'input', type: 'date', id: 'fri-anchor', step: '7', min: minFri,
      'aria-label': 'Pick a Friday you have them', value: n.fridayAlt.anchor || '',
      onchange: (e) => {
        const v = e.target.value;
        if (isISODate(v) && weekday(v) === 5) {
          n.fridayAlt.anchor = v;
          err.hidden = true;
          ctx.save();
        } else {
          err.hidden = false;
        }
      },
    });
    wrap.replaceChildren(...[
      h('strong', { text: 'Which nights do you cook?' }),
      h('div', { class: 'chips', id: 'day-chips' }, chips),
      toggle('Every other Friday', 'Pick a Friday you have them', n.fridayAlt.on, (on) => {
        n.fridayAlt.on = on;
        if (on) n.weekly = n.weekly.filter((x) => x !== 5);
        ctx.save();
        draw();
      }),
      n.fridayAlt.on ? h('div', { class: 'field' }, h('label', { for: 'fri-anchor', text: 'Pick a Friday you have them' }), date, err) : null,
      toggle('Monday game-day meal', 'A grown-up dinner. No kid job.', n.gamedayDefault, (on) => {
        n.gamedayDefault = on;
        ctx.save();
        draw();
      }),
    ].filter(Boolean));
  };
  draw();
  return wrap;
}

export function nightsSummary(nights) {
  const order = [4, 5, 6, 0, 1, 2, 3];
  const days = order.filter((d) => nights.weekly.includes(d)).map((d) => DAY_SHORT[d]);
  let s = days.length ? days.join(', ') : 'No nights picked yet';
  if (nights.fridayAlt.on && !nights.weekly.includes(5)) s += ' (+ every other Fri)';
  if (nights.gamedayDefault && !nights.weekly.includes(1)) s += ' · Mon game-day';
  return s;
}

function ensurePeople(state) {
  if (!state.people.some((p) => p.role === 'kid')) {
    state.people.push({ id: nextId(state), name: '', role: 'kid', likes: [], never: [] });
  }
}

function dots(n) {
  return h('div', { class: 'dots', 'aria-hidden': 'true' }, [1, 2, 3, 4].map((i) => h('i', { class: i === n ? 'on' : '' })));
}

function step1(ctx) {
  const s = ctx.state;
  const me = s.people[0];
  const kid = s.people.find((p) => p.role === 'kid');
  const partner = s.people.find((p, i) => i > 0 && p.role === 'adult');
  const meIn = h('input', { class: 'input', id: 'name-me', type: 'text', maxlength: '30', placeholder: 'You', value: me.name === 'You' ? '' : me.name });
  const kidIn = h('input', { class: 'input', id: 'name-kid', type: 'text', maxlength: '30', placeholder: KID_FALLBACK, value: kid ? kid.name : '' });
  const ageIn = h('input', { class: 'input', id: 'age-kid', type: 'number', min: '0', max: '17', inputmode: 'numeric', placeholder: 'Age (optional)', value: kid && kid.age != null ? String(kid.age) : '' });
  const partnerIn = h('input', { class: 'input', id: 'name-partner', type: 'text', maxlength: '30', placeholder: 'Partner', value: partner ? partner.name : '' });
  const partnerField = h('div', { class: 'field', hidden: !partner },
    h('label', { for: 'name-partner', text: "Partner's name" }), partnerIn);
  const addPartner = button('+ Add a partner', () => { partnerField.hidden = false; addPartner.hidden = true; partnerIn.focus(); }, '', { hidden: Boolean(partner), id: 'add-partner' });

  const next = () => {
    me.name = meIn.value.trim() || 'You';
    ensurePeople(s);
    const k = s.people.find((p) => p.role === 'kid');
    k.name = kidIn.value.trim();
    const age = parseInt(ageIn.value, 10);
    if (Number.isFinite(age) && age >= 0 && age < 18) k.age = age; else delete k.age;
    if (!partnerField.hidden) {
      const nm = partnerIn.value.trim() || 'Partner';
      if (partner) partner.name = nm;
      else s.people.push({ id: nextId(s), name: nm, role: 'adult', likes: [], never: [] });
    }
    ctx.save();
    ctx.go('#/setup/2');
  };
  const skip = () => { ensurePeople(s); ctx.save(); ctx.go('#/setup/2'); };
  return [
    dots(1),
    header("Who's eating?"),
    h('p', { class: 'sub', text: 'Names stay on this phone. They are only used on screen.' }),
    h('div', { class: 'field' }, h('label', { for: 'name-me', text: 'Your name' }), meIn),
    h('div', { class: 'field' }, h('label', { for: 'name-kid', text: "Your little one's name" }), kidIn, ageIn),
    partnerField,
    addPartner,
    h('div', { class: 'spacer' }),
    button('Next', next, 'primary', { id: 'setup-next' }),
    h('button', { type: 'button', class: 'link', onclick: skip, text: 'Skip' }),
  ];
}

function step2(ctx) {
  const s = ctx.state;
  ensurePeople(s);
  const save = () => ctx.save();
  return [
    dots(2),
    header('Likes and never foods', { back: '#/setup/1' }),
    h('p', { class: 'sub', text: 'Tap what each person loves, and anything they never eat. A meal with a never food never shows up.' }),
    h('div', { class: 'card', id: 'allergies-card' },
      h('h3', { text: 'Allergies' }),
      h('p', { class: 'meta', text: ALLERGY_SUB }),
      allergyChips(ctx)),
    s.people.map((p, i) => h('div', { class: 'card' }, h('h3', { text: personName(p, i) }), prefsEditor(p, save))),
    button('Next', () => ctx.go('#/setup/3'), 'primary', { id: 'setup-next' }),
    h('button', { type: 'button', class: 'link', onclick: () => ctx.go('#/setup/3'), text: 'Skip' }),
  ];
}

function step3(ctx) {
  return [
    dots(3),
    header('Cooking nights', { back: '#/setup/2' }),
    h('p', { class: 'sub', text: 'Pick the nights you cook dinner. You can change this any time.' }),
    nightsEditor(ctx),
    h('div', { class: 'spacer' }),
    button('Next', () => ctx.go('#/setup/4'), 'primary', { id: 'setup-next' }),
    h('button', { type: 'button', class: 'link', onclick: () => ctx.go('#/setup/4'), text: 'Skip' }),
  ];
}

function step4(ctx) {
  ensurePeople(ctx.state);
  ctx.state.setupDone = true;
  ctx.save();
  ctx.onSetupDone && ctx.onSetupDone();
  return [
    dots(4),
    header('All set!'),
    h('p', { class: 'sub', text: "Here's tonight's dinner." }),
    h('p', { class: 'hint', text: 'Everything stays editable later under Family.' }),
    h('div', { class: 'spacer' }),
    button("Show tonight's dinner", () => ctx.go('#/tonight'), 'primary', { id: 'setup-done' }),
  ];
}

export function render(ctx, params) {
  const n = Number(params[0]) || 1;
  return [step1, step2, step3, step4][Math.min(Math.max(n, 1), 4) - 1](ctx);
}
