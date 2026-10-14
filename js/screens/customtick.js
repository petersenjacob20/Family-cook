// The "I checked every label" tick above Save on the add/edit recipe form. A reminder only: it never marks a recipe.
// Save stays off until it is ticked; it starts unticked on every add and every edit.
import { h, checkRow } from '../dom.js';

export const TICK_TEXT = 'I checked every ingredient and label: no peanuts, tree nuts, coconut, or fish/seafood, including may-contain warnings.';
export const TICK_REASON = 'Tick the box above to save.';

// onChange(ticked) runs after each tap. Returns { el, reason, isTicked }.
export function customTick(onChange = () => {}) {
  let ticked = false;
  const reason = h('p', { class: 'meta customreason', id: 'custom-save-reason', role: 'status', text: TICK_REASON });
  const el = checkRow(TICK_TEXT, '', false, () => {
    ticked = !ticked;
    el.setAttribute('aria-checked', ticked ? 'true' : 'false');
    reason.textContent = ticked ? '' : TICK_REASON;
    onChange(ticked);
  });
  el.setAttribute('id', 'custom-tick');
  return { el, reason, isTicked: () => ticked };
}
