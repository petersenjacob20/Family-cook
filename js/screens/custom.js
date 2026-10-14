// Your own recipes. Four screens, all on this phone (no form, no upload, no network):
//   #/custom/new              add a recipe
//   #/custom/edit/<id>        edit it
//   #/custom/view/<id>        the recipe, with Edit and Delete
//   #/custom/delete/<id>      "Delete this recipe?" confirmation
// The nut and fish guard checks the name, every ingredient and every step; a hit is shown and never saved.
// Warn-only words are shown and can still be saved. Save needs the label tick (customtick.js) each time.
// A stored recipe with a guard hit stays on the phone, marked blocked: shown here with the warning, Edit and Delete.
import { h, header, button, toast } from '../dom.js';
import { SECTIONS, ingredientAmount, LABEL_LINE } from '../grocery.js';
import { recipePhoto, cap } from '../view.js';
import { customTick } from './customtick.js';
import {
  UNITS, makeRecipe, guardHits, warnHits, guardMessage, upsertCustom, deleteCustom, customOf, resizePhoto, putPhoto, getPhoto, deletePhoto,
  MAX_INGREDIENTS, MAX_STEPS,
} from '../custom.js';

export const LABEL_NOTE = LABEL_LINE;
export const LABEL_MORE = 'Check every label for peanuts, tree nuts, may-contain warnings, and fish/seafood.';
export const PHOTO_NOTE = 'Your photo stays on this phone. It is made smaller first.';

export function labelNote(id) {
  return h('div', { class: 'card customnote', id, role: 'note' },
    h('p', { class: 'freshnote', text: LABEL_NOTE }),
    h('p', { class: 'meta', text: LABEL_MORE }));
}

const byIdCustom = (ctx, id) => customOf(ctx.data).find((r) => r.id === id) || null;
const newId = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function render(ctx, params = []) {
  if (params[0] === 'edit' && params[1]) return formScreen(ctx, byIdCustom(ctx, params[1]));
  if (params[0] === 'view' && params[1]) return viewScreen(ctx, byIdCustom(ctx, params[1]));
  if (params[0] === 'delete' && params[1]) return deleteScreen(ctx, byIdCustom(ctx, params[1]));
  return formScreen(ctx, null);
}

function notFound() {
  return [header('Recipe not found', { back: '#/recipes' }), h('div', { class: 'card' }, h('p', { class: 'meta', text: 'This recipe is not on this phone any more.' }))];
}

function select(options, value, attrs) {
  const sel = h('select', { class: 'input', ...attrs }, options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
  sel.value = value;
  return sel;
}

// ---------- add / edit ----------
function formScreen(ctx, r) {
  const vocab = ctx.data.vocab;
  const editing = Boolean(r);
  let photo = { url: null, changed: false, had: Boolean(r && r.hasPhoto) };

  const name = h('input', { class: 'input', id: 'custom-name', type: 'text', maxlength: '60', autocomplete: 'off', placeholder: 'Recipe name', 'aria-label': 'Recipe name', value: r ? r.title : '' });
  const serves = h('input', { class: 'input short', id: 'custom-serves', type: 'number', min: '1', max: '20', inputmode: 'numeric', 'aria-label': 'Serves', value: String(r ? r.serves : 4) });
  const mins = h('input', { class: 'input short', id: 'custom-mins', type: 'number', min: '1', max: '600', inputmode: 'numeric', 'aria-label': 'Total minutes', value: String(r ? r.total_min : 30) });

  const ings = h('div', { class: 'customrows', id: 'custom-ings' });
  const steps = h('div', { class: 'customrows', id: 'custom-steps' });
  const guard = h('div', { class: 'card accent-line customguard', id: 'custom-guard', role: 'alert', hidden: true });
  const warn = h('div', { class: 'card customguard', id: 'custom-warn', role: 'note', hidden: true });
  const err = h('p', { class: 'error', id: 'custom-error', role: 'alert' });
  let saveBtn = null;
  const tick = customTick((on) => { if (saveBtn) saveBtn.disabled = !on; });

  const ingRow = (i = {}) => {
    const n = ings.children.length;
    const row = h('div', { class: 'customrow ingrow', 'data-row': 'ing' },
      h('input', { class: 'input', type: 'text', maxlength: '80', autocomplete: 'off', placeholder: 'Ingredient', 'aria-label': `Ingredient ${n + 1}`, value: i.name || '', 'data-f': 'name', oninput: check }),
      h('div', { class: 'row customamt' },
        h('input', { class: 'input short', type: 'number', min: '0', step: 'any', inputmode: 'decimal', placeholder: 'Amount', 'aria-label': `Amount ${n + 1}`, value: i.qty == null ? '' : String(i.qty), 'data-f': 'qty' }),
        select(UNITS, i.unit || '', { 'aria-label': `Unit ${n + 1}`, 'data-f': 'unit' }),
        select(SECTIONS, i.section || 'other', { 'aria-label': `Store section ${n + 1}`, 'data-f': 'section' }),
        button('Remove', () => { row.remove(); check(); }, 'small', { 'aria-label': `Remove ingredient ${n + 1}` })));
    return row;
  };
  const stepRow = (text = '') => {
    const n = steps.children.length;
    const row = h('div', { class: 'customrow steprow', 'data-row': 'step' },
      h('textarea', { class: 'input', rows: '2', maxlength: '300', placeholder: `Step ${n + 1}`, 'aria-label': `Step ${n + 1}`, 'data-f': 'text', oninput: check }),
      button('Remove', () => { row.remove(); check(); }, 'small', { 'aria-label': `Remove step ${n + 1}` }));
    row.children[0].value = text;
    return row;
  };
  const field = (row, f) => findField(row, f);
  function findField(node, f) {
    for (const c of node.children || []) {
      if (c.getAttribute && c.getAttribute('data-f') === f) return c;
      const d = findField(c, f);
      if (d) return d;
    }
    return null;
  }
  const draft = () => ({
    title: name.value,
    serves: serves.value,
    total_min: mins.value,
    hasPhoto: photo.changed ? Boolean(photo.url) : photo.had,
    ingredients: [...ings.children].map((row) => ({
      name: field(row, 'name').value, qty: field(row, 'qty').value, unit: field(row, 'unit').value, section: field(row, 'section').value,
    })),
    steps: [...steps.children].map((row) => field(row, 'text').value),
  });
  // Live nut and fish check while typing (name, ingredients, steps).
  function check() {
    const d = draft();
    const hits = guardHits({ title: d.title, ingredients: d.ingredients, steps: d.steps.map((text) => ({ text })) }, vocab);
    guard.hidden = !hits.length;
    guard.replaceChildren(...(hits.length ? [
      h('h2', { text: 'Nut or fish word found' }),
      h('ul', { class: 'freshlist', id: 'custom-guard-list' }, hits.map((x) => h('li', null, h('strong', { text: `${x.where}: ` }), x.words.join(', ')))),
      h('p', { class: 'meta', text: 'Your family plan is nut-free and fish-free. Take these out to save this recipe.' }),
    ] : []));
    const soft = warnHits({ title: d.title, ingredients: d.ingredients, steps: d.steps.map((text) => ({ text })) }, vocab);
    warn.hidden = !soft.length;
    warn.replaceChildren(...(soft.length ? [
      h('h2', { text: 'Check this one' }),
      h('ul', { class: 'freshlist', id: 'custom-warn-list' }, soft.map((x) => h('li', null, h('strong', { text: `${x.where}: ` }), x.words.join(', ')))),
      h('p', { class: 'meta', text: 'These often have nuts or fish in them. You can still save if yours has none.' }),
    ] : []));
    return hits;
  }
  name.addEventListener('input', check);

  (r ? r.ingredients : [{}, {}]).forEach((i) => ings.appendChild(ingRow(i)));
  (r ? r.steps.map((s) => s.text) : ['']).forEach((t) => steps.appendChild(stepRow(t)));

  // Photo: a plain file picker (no form). Resized here to a JPEG data: URL, kept in IndexedDB on Save.
  const preview = h('div', { class: 'customphoto', id: 'custom-photo-preview' });
  const showPreview = (url) => preview.replaceChildren(url ? h('img', { class: 'photo hero', alt: '', width: 720, height: 540, src: url }) : h('p', { class: 'meta', text: 'No photo.' }));
  const fileIn = h('input', { type: 'file', accept: 'image/*', id: 'custom-photo-input', class: 'visually-hidden', 'aria-label': 'Choose a photo' });
  const photoMsg = h('p', { class: 'meta', id: 'custom-photo-msg', role: 'status' });
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files && fileIn.files[0];
    if (!file) return;
    photoMsg.textContent = 'Making it smaller\u2026';
    try {
      photo = { ...photo, url: await resizePhoto(file), changed: true };
      showPreview(photo.url);
      photoMsg.textContent = '';
    } catch {
      photoMsg.textContent = 'That photo could not be used. Try another one.';
    }
    fileIn.value = '';
  });
  const removePhoto = button('Remove photo', () => { photo = { ...photo, url: null, changed: true }; showPreview(null); }, 'small', { id: 'custom-photo-remove' });
  if (r && r.hasPhoto) getPhoto(r.id).then((url) => { if (!photo.changed) showPreview(url); }); else showPreview(null);

  const save = async () => {
    err.textContent = '';
    if (!tick.isTicked()) { err.textContent = 'Tick the box above to save.'; return; }
    if (check().length) { err.textContent = guardMessage(check()); return; }
    const res = makeRecipe(draft(), vocab, { id: r ? r.id : null, newId: newId() });
    if (!res.ok) { err.textContent = res.error; return; }
    try {
      if (photo.changed && photo.url) await putPhoto(res.recipe.id, photo.url);
      else if (photo.changed && !photo.url) await deletePhoto(res.recipe.id);
    } catch {
      delete res.recipe.hasPhoto; // the recipe still saves; the photo did not
      toast('The photo could not be kept on this phone.');
    }
    upsertCustom(ctx, res.recipe);
    toast('Saved.');
    ctx.go(`#/custom/view/${res.recipe.id}`);
  };

  return [
    header(editing ? 'Edit recipe' : 'Add your recipe', { back: editing ? `#/custom/view/${r.id}` : '#/recipes' }),
    labelNote('custom-label-note'),
    guard,
    warn,
    h('div', { class: 'card customcard' },
      h('p', { class: 'section-label', text: 'Name' }), name,
      h('div', { class: 'row customnums' },
        h('label', { class: 'meta' }, 'Serves ', serves),
        h('label', { class: 'meta' }, 'Minutes ', mins))),
    h('div', { class: 'card customcard' },
      h('p', { class: 'section-label', text: 'Ingredients' }),
      h('p', { class: 'meta', text: 'One per line, with an amount and unit.' }),
      ings,
      button('Add ingredient', () => { if (ings.children.length < MAX_INGREDIENTS) ings.appendChild(ingRow()); }, 'small', { id: 'custom-add-ing' })),
    h('div', { class: 'card customcard' },
      h('p', { class: 'section-label', text: 'Steps' }),
      steps,
      button('Add step', () => { if (steps.children.length < MAX_STEPS) steps.appendChild(stepRow()); }, 'small', { id: 'custom-add-step' })),
    h('div', { class: 'card customcard' },
      h('p', { class: 'section-label', text: 'Photo (optional)' }),
      h('p', { class: 'meta', text: PHOTO_NOTE }),
      preview,
      h('div', { class: 'row' },
        h('label', { class: 'btn small', for: 'custom-photo-input', id: 'custom-photo-pick' }, 'Choose photo'),
        removePhoto),
      fileIn,
      photoMsg),
    err,
    tick.el,
    (saveBtn = button(editing ? 'Save changes' : 'Save recipe', save, 'primary', { id: 'custom-save', disabled: true })),
    tick.reason,
    h('div', { class: 'spacer' }),
  ];
}

// ---------- view ----------
function viewScreen(ctx, r) {
  if (!r) return notFound();
  if (r.blocked) return blockedScreen(r);
  return [
    header(r.title, { back: '#/recipes' }),
    recipePhoto(r, 'hero'),
    h('p', { class: 'sub', text: `Your recipe \u00b7 feeds ${r.serves} \u00b7 about ${r.total_min} min` }),
    labelNote('custom-view-label-note'),
    h('div', { class: 'card' },
      h('p', { class: 'section-label', text: 'Ingredients' }),
      h('ul', { class: 'freshlist', id: 'custom-view-ings' }, r.ingredients.map((i) => h('li', null, h('strong', { text: cap(i.name) }), h('span', { class: 'meta', text: `${ingredientAmount(i)} \u00b7 ${LABEL_NOTE}` }))))),
    h('div', { class: 'card' },
      h('p', { class: 'section-label', text: 'Steps' }),
      h('ol', { class: 'freshlist', id: 'custom-view-steps' }, r.steps.map((s) => h('li', { text: s.text })))),
    h('div', { class: 'btnstack' },
      h('a', { class: 'btn primary', href: `#/need/${r.id}`, id: 'custom-cook' }, 'What you need'),
      h('a', { class: 'btn', href: `#/custom/edit/${r.id}`, id: 'custom-edit' }, 'Edit'),
      h('a', { class: 'btn danger', href: `#/custom/delete/${r.id}`, id: 'custom-delete' }, 'Delete')),
    h('div', { class: 'spacer' }),
  ];
}

// A saved recipe that now trips the nut and fish guard: kept on the phone, never planned. Fix it or delete it.
export function blockedText(r) {
  return (r.blocked || []).map((b) => `${b.where}: ${b.words.join(', ')}`).join('; ');
}
function blockedScreen(r) {
  return [
    header(r.title, { back: '#/recipes' }),
    h('div', { class: 'card accent-line customguard', id: 'custom-blocked', role: 'alert' },
      h('h2', { text: 'Nut or fish word found' }),
      h('ul', { class: 'freshlist', id: 'custom-blocked-list' }, r.blocked.map((b) => h('li', null, h('strong', { text: `${b.where}: ` }), b.words.join(', ')))),
      h('p', { class: 'meta', text: 'This recipe is kept on this phone but left out of your plan, swaps and grocery list. Edit it to take the word out, or delete it.' })),
    h('div', { class: 'btnstack' },
      h('a', { class: 'btn primary', href: `#/custom/edit/${r.id}`, id: 'custom-edit' }, 'Edit'),
      h('a', { class: 'btn danger', href: `#/custom/delete/${r.id}`, id: 'custom-delete' }, 'Delete')),
    h('div', { class: 'spacer' }),
  ];
}

// ---------- delete (confirmation step) ----------
function deleteScreen(ctx, r) {
  if (!r) return notFound();
  const yes = button('Delete recipe', async () => {
    yes.disabled = true;
    await deleteCustom(ctx, r.id);
    toast('Deleted.');
    ctx.go('#/recipes');
  }, 'danger', { id: 'custom-delete-yes' });
  return [
    header('Delete recipe?', { back: `#/custom/view/${r.id}` }),
    h('div', { class: 'card accent-line', id: 'custom-delete-card', role: 'alertdialog', 'aria-labelledby': 'custom-delete-title' },
      h('h2', { id: 'custom-delete-title', text: `Delete \u201c${r.title}\u201d?` }),
      h('p', { text: 'This removes the recipe and its photo from this phone and takes it out of your week plan. It can\u2019t be undone.' })),
    h('div', { class: 'btnstack' },
      yes,
      h('a', { class: 'btn', href: `#/custom/view/${r.id}`, id: 'custom-delete-no' }, 'Keep it')),
  ];
}
