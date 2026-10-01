// Who's eating: display-name helpers. Pure (no DOM).

export const KID_FALLBACK = 'Your little one';

export function kidPerson(state) {
  return (state.people || []).find((p) => p.role === 'kid') || null;
}

// Display name for the child. Falls back to "Your little one" (or lowercase mid-sentence).
export function kidName(state, { midSentence = false } = {}) {
  const p = kidPerson(state);
  const n = p && typeof p.name === 'string' ? p.name.trim() : '';
  if (n) return n;
  return midSentence ? KID_FALLBACK.toLowerCase() : KID_FALLBACK;
}

export function kidBadge(state) {
  return kidName(state).toUpperCase();
}

export function personName(p, i = 0) {
  const n = p && typeof p.name === 'string' ? p.name.trim() : '';
  if (n) return n;
  if (p && p.role === 'kid') return KID_FALLBACK;
  return i === 0 ? 'You' : 'Partner';
}

// Fill the {kid} placeholder.
export function fillKid(text, state) {
  if (typeof text !== 'string') return '';
  return text.replace(/(^|[.!?]\s+)?\{kid\}/g, (m, lead) => {
    if (lead !== undefined) return lead + kidName(state);
    return kidName(state, { midSentence: true });
  });
}

// Screen title: "Cook with {name}" once a child name is set, otherwise "Family Cook".
export function appTitle(state) {
  const p = kidPerson(state);
  const n = p && typeof p.name === 'string' ? p.name.trim() : '';
  return n ? `Cook with ${n}` : 'Family Cook';
}
