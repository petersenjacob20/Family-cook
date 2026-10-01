// Share chain: Web Share API, then clipboard, then a select-text box (build plan section 10).
// Returns 'shared' | 'cancelled' | 'copied' | 'fallback'.
export async function shareText({ title, text }, env = globalThis) {
  const nav = env && env.navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title, text });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
      return 'copied';
    } catch { /* fall through */ }
  }
  return 'fallback';
}

// Selectable text box shown when sharing and copying both fail.
export function showFallbackBox(text, mount) {
  const wrap = document.createElement('div');
  wrap.className = 'card sharecard';
  wrap.id = 'share-fallback';
  const p = document.createElement('p');
  p.className = 'meta';
  p.textContent = 'Select the text below and copy it into Notes or a text.';
  const area = document.createElement('textarea');
  area.className = 'input sharebox';
  area.readOnly = true;
  area.value = text;
  area.setAttribute('aria-label', 'List to copy');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn small';
  close.textContent = 'Close';
  close.addEventListener('click', () => wrap.remove());
  wrap.append(p, area, close);
  const old = document.getElementById('share-fallback');
  if (old) old.remove();
  mount.appendChild(wrap);
  area.focus();
  area.select();
  wrap.scrollIntoView({ block: 'center' });
  return wrap;
}

export async function shareWithFallback({ title, text }, { toast, mount }) {
  const res = await shareText({ title, text });
  if (res === 'copied') toast('Copied. Paste it into Notes or a text.');
  else if (res === 'fallback') showFallbackBox(text, mount);
  return res;
}
