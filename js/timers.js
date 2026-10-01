// Multi-timer + sound + vibrate (build plan section 11).
// Timers store `endsAt` (a timestamp), so they survive sleep and reloads.
// Pure helpers first; the browser controller only touches window/document when created.

export function timerId(recipeId, stepIndex) {
  return `${recipeId}#${stepIndex}`;
}

export function startTimer(timers, { id, label, minutes, now }) {
  const t = { id, label, endsAt: now + Math.round(minutes * 60000), pausedLeftMs: null };
  return [...timers.filter((x) => x.id !== id), t];
}

export function leftMs(t, now) {
  if (t.pausedLeftMs != null) return Math.max(0, t.pausedLeftMs);
  return Math.max(0, t.endsAt - now);
}

export function isDone(t, now) {
  return t.pausedLeftMs == null && t.endsAt <= now;
}

export function pauseTimer(t, now) {
  if (t.pausedLeftMs == null) t.pausedLeftMs = Math.max(0, t.endsAt - now);
  return t;
}

export function resumeTimer(t, now) {
  if (t.pausedLeftMs != null) {
    t.endsAt = now + t.pausedLeftMs;
    t.pausedLeftMs = null;
  }
  return t;
}

export function fmt(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Browser controller: ticking display, done banner, Web Audio beeps, vibration.
export function createTimerController({ getState, save, banner, onChange }) {
  let interval = null;
  let audioCtx = null;
  let beepLoop = null;
  let showing = null; // id of the timer shown in the banner
  const listeners = new Set();

  function unlockAudio() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch { /* no sound available */ }
  }

  function beepOnce() {
    if (!audioCtx) unlockAudio();
    if (!audioCtx) return;
    try {
      const t0 = audioCtx.currentTime + 0.02;
      for (let i = 0; i < 6; i++) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = i % 2 ? 660 : 880;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.5, t0 + i * 0.5 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.5 + 0.32);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + i * 0.5);
        osc.stop(t0 + i * 0.5 + 0.34);
      }
    } catch { /* ignore */ }
  }

  function startRinging() {
    if (beepLoop) return;
    beepOnce();
    beepLoop = setInterval(beepOnce, 3200);
    try { if (navigator.vibrate) navigator.vibrate([400, 200, 400]); } catch { /* ignore */ }
  }

  function stopRinging() {
    clearInterval(beepLoop);
    beepLoop = null;
  }

  function showBanner(t) {
    showing = t.id;
    banner.replaceChildren();
    const span = document.createElement('span');
    span.textContent = `Timer done: ${t.label}`;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn';
    ok.id = 'timer-ok';
    ok.textContent = 'OK';
    ok.addEventListener('click', () => dismiss(t.id));
    banner.append(span, ok);
    banner.hidden = false;
    startRinging();
  }

  function dismiss(id) {
    const s = getState();
    s.timers = s.timers.filter((x) => x.id !== id);
    save();
    showing = null;
    banner.hidden = true;
    stopRinging();
    tick();
    onChange && onChange();
  }

  function tick() {
    const s = getState();
    const now = Date.now();
    for (const el of document.querySelectorAll('[data-timer-left]')) {
      const t = s.timers.find((x) => x.id === el.dataset.timerLeft);
      if (t) el.textContent = isDone(t, now) ? 'Done!' : fmt(leftMs(t, now));
    }
    for (const fn of listeners) fn(now);
    const done = s.timers.find((t) => isDone(t, now));
    if (done && showing !== done.id && document.visibilityState === 'visible') showBanner(done);
    if (!done && showing) { showing = null; banner.hidden = true; stopRinging(); }
  }

  function run() {
    clearInterval(interval);
    interval = null;
    if (document.visibilityState === 'visible') {
      tick();
      interval = setInterval(tick, 250);
    }
  }

  document.addEventListener('visibilitychange', run);
  run();

  return {
    unlockAudio,
    start(id, label, minutes) {
      unlockAudio();
      const s = getState();
      s.timers = startTimer(s.timers, { id, label, minutes, now: Date.now() });
      save();
      tick();
      onChange && onChange();
    },
    pause(id) {
      const t = getState().timers.find((x) => x.id === id);
      if (t) { pauseTimer(t, Date.now()); save(); tick(); onChange && onChange(); }
    },
    resume(id) {
      unlockAudio();
      const t = getState().timers.find((x) => x.id === id);
      if (t) { resumeTimer(t, Date.now()); save(); tick(); onChange && onChange(); }
    },
    dismiss,
    tick,
    onTick(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    stopAll() { stopRinging(); clearInterval(interval); interval = null; banner.hidden = true; },
  };
}
