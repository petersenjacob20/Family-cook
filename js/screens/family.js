// Our family: people cards, cooking nights card, add/edit person, nights editor.
import { h, header, button } from '../dom.js';
import { personName } from '../people.js';
import { prefsEditor, nightsEditor, nightsSummary, allergyChips, allergySummaryText, ALLERGY_SUB } from './setup.js';

const list = (words, empty) => (words.length ? words.join(', ') : empty);

// Household Allergies card: summary + Edit, which opens the same chips inline.
function allergiesCard(ctx) {
  const card = h('div', { class: 'card', id: 'allergies-card' });
  const draw = (editing) => {
    const summary = h('p', { class: 'meta', id: 'allergies-summary' }, h('strong', { text: allergySummaryText(ctx.state) }));
    card.replaceChildren(...[
      h('div', { class: 'row' },
        h('h2', { class: 'spacer', text: 'Allergies' }),
        button(editing ? 'Done' : 'Edit', () => draw(!editing), 'small', { id: 'allergies-edit', 'aria-label': editing ? 'Done editing allergies' : 'Edit allergies', 'aria-expanded': editing ? 'true' : 'false' })),
      editing ? h('p', { class: 'meta', text: ALLERGY_SUB }) : summary,
      editing ? allergyChips(ctx) : null,
    ].filter(Boolean)); // never hand null to replaceChildren (it would print "null")
  };
  draw(false);
  return card;
}

function overview(ctx) {
  const s = ctx.state;
  const cards = s.people.map((p, i) => h('div', { class: 'card' },
    h('div', { class: 'row' },
      h('h2', { class: 'spacer', text: personName(p, i) + (p.age != null ? ` (${p.age})` : '') }),
      button('Edit', () => ctx.go(`#/family/person/${p.id}`), 'small', { 'aria-label': `Edit ${personName(p, i)}` })),
    h('p', { class: 'meta', text: 'Likes: ' + list(p.likes, 'tap Edit to add') }),
    h('p', { class: 'meta' }, h('strong', { text: 'Never: ' + list(p.never, 'nothing yet') }))));
  return [
    header('Our family'),
    allergiesCard(ctx),
    cards,
    h('div', { class: 'card accent' },
      h('div', { class: 'row' },
        h('h2', { class: 'spacer', text: 'Cooking nights' }),
        button('Edit', () => ctx.go('#/family/nights'), 'small', { 'aria-label': 'Edit cooking nights' })),
      h('p', { class: 'meta', text: nightsSummary(s.nights) }),
      h('p', { class: 'hint', text: 'Dinner between 5 and 7 PM' })),
    button('+ Add a person', () => ctx.go('#/family/add'), '', { id: 'add-person' }),
    h('div', { class: 'btnrow' },
      h('a', { class: 'btn small', href: '#/recipes' }, 'All recipes'),
      h('a', { class: 'btn small', href: '#/settings' }, 'Settings')),
  ];
}

function personScreen(ctx, person, isNew) {
  const s = ctx.state;
  const idx = s.people.indexOf(person);
  const nameIn = h('input', { class: 'input', id: 'person-name', type: 'text', maxlength: '30', placeholder: personName(person, isNew ? 1 : idx), value: person.name === 'You' ? '' : person.name });
  const ageIn = h('input', { class: 'input', type: 'number', min: '0', max: '17', inputmode: 'numeric', placeholder: 'Age (optional)', value: person.age != null ? String(person.age) : '' });
  const kidBox = h('input', { type: 'checkbox', id: 'is-kid', checked: person.role === 'kid' });
  const save = () => {
    const nm = nameIn.value.trim();
    person.name = nm || (person.role === 'kid' ? '' : (idx === 0 ? 'You' : 'Partner'));
    if (person.role === 'kid') {
      const age = parseInt(ageIn.value, 10);
      if (Number.isFinite(age) && age >= 0 && age < 18) person.age = age; else delete person.age;
    }
    if (isNew) {
      person.role = kidBox.checked ? 'kid' : 'adult';
      if (!person.name && person.role === 'adult') person.name = 'Partner';
      s.people.push(person);
    }
    ctx.save();
    ctx.go('#/family');
  };
  const remove = () => {
    if (!window.confirm(`Remove ${personName(person, idx)}?`)) return;
    s.people.splice(idx, 1);
    ctx.save();
    ctx.go('#/family');
  };
  return [
    header(isNew ? 'Add a person' : 'Edit ' + personName(person, idx), { back: '#/family' }),
    h('div', { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: 'person-name', text: 'Name' }), nameIn),
      person.role === 'kid' && !isNew ? ageIn : null,
      isNew ? h('label', { class: 'row' }, kidBox, h('span', { text: 'This is the little one who helps cook' })) : null,
      prefsEditor(person, () => { if (!isNew) ctx.save(); })),
    button('Save', save, 'primary', { id: 'person-save' }),
    !isNew && idx > 0 ? button('Remove this person', remove, 'danger') : null,
  ];
}

export function render(ctx, params) {
  const [sub, id] = params;
  if (sub === 'nights') {
    return [
      header('Cooking nights', { back: '#/family' }),
      nightsEditor(ctx),
      h('p', { class: 'hint', text: 'You can switch a Friday or the Monday game-day meal on or off for one week on the Week tab.' }),
      button('Done', () => ctx.go('#/family'), 'primary'),
    ];
  }
  if (sub === 'add') {
    return personScreen(ctx, { id: 'p' + Date.now().toString(36), name: '', role: 'adult', likes: [], never: [] }, true);
  }
  if (sub === 'person') {
    const p = ctx.state.people.find((x) => x.id === id);
    if (p) return personScreen(ctx, p, false);
  }
  return overview(ctx);
}
