// Local calendar dates as "YYYY-MM-DD" strings (build plan section 7).
// Day math uses Date.UTC(y, m, d) so daylight saving changes can't shift anything.

const DAY_MS = 86400000;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

export function mod(a, n) {
  return ((a % n) + n) % n;
}

// Build a local date string from the device's local Date fields (never UTC strings).
export function toISO(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parts(s);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function parts(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

function dayNumber(s) {
  const { y, m, d } = parts(s);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function fromDayNumber(n) {
  const t = new Date(n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(a, b) {
  return dayNumber(b) - dayNumber(a);
}

export function addDays(s, n) {
  return fromDayNumber(dayNumber(s) + n);
}

// 0 = Sun ... 6 = Sat
export function weekday(s) {
  return mod(dayNumber(s) + 4, 7); // 1970-01-01 was a Thursday
}

export function month(s) {
  return parts(s).m;
}

// The Thursday that starts the Thu..Wed block containing this date.
export function weekOf(s) {
  return addDays(s, -mod(weekday(s) - 4, 7));
}

// "This week": Tue/Wed look ahead to the coming Thursday; Thu..Mon show the current one.
export function weekIdFor(today) {
  const w = weekday(today);
  if (w === 2 || w === 3) return addDays(today, 4 - w);
  return weekOf(today);
}

// Thu, Fri, Sat, Sun, Mon
export function weekDates(weekId) {
  return [0, 1, 2, 3, 4].map((i) => addDays(weekId, i));
}

export function emptyWeek() {
  return { fridayOverride: null, gameday: null, meals: {}, confirmed: false, groceryChecked: [], swaps: {} };
}

// Is the Friday `d` a cooking night?
export function isFridayOn(d, nights, week) {
  const ov = week ? week.fridayOverride : null;
  if (ov === true) return true;
  if (ov === false) return false;
  return fridayDefault(d, nights);
}

// Friday state ignoring the per-week override.
export function fridayDefault(d, nights) {
  if (nights && Array.isArray(nights.weekly) && nights.weekly.includes(5)) return true;
  const fa = nights && nights.fridayAlt;
  if (!fa || !fa.on || !isISODate(fa.anchor)) return false;
  const diff = daysBetween(fa.anchor, d);
  if (mod(diff, 7) !== 0) return false;
  return mod(diff / 7, 2) === 0;
}

export function gamedayDefault(nights) {
  return Boolean(nights && nights.gamedayDefault);
}

export function isGamedayOn(nights, week) {
  const g = week ? week.gameday : null;
  if (g === true || g === false) return g;
  return gamedayDefault(nights);
}

// Active nights for a week, in date order.
// Each: { date, weekday, kind: 'family'|'gameday', weeknight: boolean }
export function nightsForWeek(weekId, nights, week) {
  const weekly = (nights && nights.weekly) || [];
  const out = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekId, i);
    const wd = weekday(date);
    let kind = null;
    if (wd === 5) {
      if (isFridayOn(date, nights, week)) kind = 'family';
    } else if (wd === 1) {
      // A Monday family night (kid is there) wins over the game-day meal.
      if (weekly.includes(1)) kind = 'family';
      else if (isGamedayOn(nights, week)) kind = 'gameday';
    } else if (weekly.includes(wd)) {
      kind = 'family';
    }
    if (kind) out.push({ date, weekday: wd, kind, weeknight: wd !== 6 && wd !== 0 });
  }
  return out;
}

export function isWeeknight(date) {
  const wd = weekday(date);
  return wd !== 6 && wd !== 0;
}

// "Thu Oct 1"
export function shortLabel(s) {
  const { m, d } = parts(s);
  return `${DAY_SHORT[weekday(s)]} ${MONTH_SHORT[m - 1]} ${d}`;
}

// "10/1"
export function slashLabel(s) {
  const { m, d } = parts(s);
  return `${m}/${d}`;
}

// A Friday on or before the given date.
export function fridayOnOrBefore(s) {
  return addDays(s, -mod(weekday(s) - 5, 7));
}
