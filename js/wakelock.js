// Screen wake lock with re-acquire when the page becomes visible again (build plan section 11).
let sentinel = null;
let wanted = false;
let listening = false;

export function wakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator && typeof navigator.wakeLock.request === 'function';
}

async function request() {
  if (!wanted || !wakeLockSupported() || document.visibilityState !== 'visible') return false;
  if (sentinel && !sentinel.released) return true;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => { sentinel = null; });
    return true;
  } catch {
    sentinel = null;
    return false; // soft failure, not an error
  }
}

function onVisible() {
  if (wanted && document.visibilityState === 'visible') request();
}

export async function acquire() {
  wanted = true;
  if (!listening && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
    listening = true;
  }
  return request();
}

export async function release() {
  wanted = false;
  const s = sentinel;
  sentinel = null;
  if (s && !s.released) {
    try { await s.release(); } catch { /* ignore */ }
  }
}

export function isHeld() {
  return Boolean(sentinel && !sentinel.released);
}
