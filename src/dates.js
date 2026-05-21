// dates.js — Natural-language date parsing and label formatting.
// Vanilla JS only — no external date libraries. All dates are handled
// in the browser's local timezone and serialized as 'YYYY-MM-DD'.

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// ─── Internal helpers ─────────────────────────────────────

// Format a Date as a local-timezone 'YYYY-MM-DD' string.
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Parse a strict 'YYYY-MM-DD' string into a local Date at midnight.
// Returns null when the string is malformed or not a real calendar date.
function parseISO(iso) {
  if (typeof iso !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Construct in local time, then verify the components round-trip —
  // this rejects impossible dates like 2026-02-30 that JS would otherwise roll over.
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

// Today at local midnight — a stable anchor for all relative math.
function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Add a whole number of days to a Date, returning a new Date.
function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

// Whole-day difference (b - a). Both inputs are treated as local midnights.
function dayDiff(a, b) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((bMid - aMid) / MS_PER_DAY);
}

// Days to advance from `today` to reach the next given weekday.
// Same-weekday input always advances a full week (1..7), never returns 0.
function daysUntilWeekday(today, targetWeekday) {
  const delta = (targetWeekday - today.getDay() + 7) % 7;
  return delta === 0 ? 7 : delta;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Today's date as a 'YYYY-MM-DD' string in local time.
 * @returns {string}
 */
export function getTodayISO() {
  return toISO(startOfToday());
}

/**
 * The current Monday–Sunday week as ISO date strings.
 * @returns {{ start: string, end: string }} Monday start, Sunday end.
 */
export function getWeekRange() {
  const today = startOfToday();
  // getDay(): 0=Sun..6=Sat. Convert so Monday is the first day of the week.
  const offsetFromMonday = (today.getDay() + 6) % 7;
  const monday = addDays(today, -offsetFromMonday);
  const sunday = addDays(monday, 6);
  return { start: toISO(monday), end: toISO(sunday) };
}

/**
 * Parse a natural-language or ISO date string into a 'YYYY-MM-DD' string.
 * Case-insensitive. Returns null for anything unrecognized or invalid.
 *
 * Supported forms:
 *   - 'tod' / 'today'                 → today
 *   - 'tom' / 'tomorrow'              → tomorrow
 *   - 'mon'..'sun' (and full names)   → next occurrence of that weekday
 *   - 'next mon'..'next sun'          → the weekday in the following week
 *   - 'YYYY-MM-DD'                    → passed through if it is a real date
 *
 * @param {string} str
 * @returns {string|null}
 */
export function parseNaturalDate(str) {
  if (typeof str !== 'string') return null;
  const input = str.trim().toLowerCase();
  if (input === '') return null;

  const today = startOfToday();

  // Today.
  if (input === 'tod' || input === 'today') {
    return toISO(today);
  }

  // Tomorrow.
  if (input === 'tom' || input === 'tomorrow') {
    return toISO(addDays(today, 1));
  }

  // Explicit ISO date — pass through only if it is a real calendar date.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const parsed = parseISO(input);
    return parsed ? toISO(parsed) : null;
  }

  // "next <weekday>" — the weekday in the week after this one.
  const nextMatch = /^next\s+([a-z]+)$/.exec(input);
  if (nextMatch) {
    const weekday = matchWeekday(nextMatch[1]);
    if (weekday === -1) return null;
    const thisOccurrence = daysUntilWeekday(today, weekday); // 1..7
    return toISO(addDays(today, thisOccurrence + 7));
  }

  // Bare weekday — the next occurrence (same-day input rolls a full week).
  const weekday = matchWeekday(input);
  if (weekday !== -1) {
    return toISO(addDays(today, daysUntilWeekday(today, weekday)));
  }

  return null;
}

// Match a weekday token (3-letter prefix or full name) to a getDay() index.
// Returns -1 when the token is not a weekday.
function matchWeekday(token) {
  const key = token.slice(0, 3);
  return WEEKDAY_KEYS.indexOf(key);
}

/**
 * Human-readable label for a task's ISO date, relative to today.
 *   - today's date          → 'Today'
 *   - tomorrow's date       → 'Tomorrow'
 *   - within the next 7 days → short weekday name ('Mon', 'Tue', …)
 *   - anything else          → 'D MMM' (e.g. '21 May')
 *   - null / invalid         → '' (empty string)
 *
 * @param {string|null} iso
 * @returns {string}
 */
export function formatDateLabel(iso) {
  if (iso == null) return '';
  const date = parseISO(iso);
  if (!date) return '';

  const today = startOfToday();
  const diff = dayDiff(today, date);

  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';

  // Within the coming week (but not today/tomorrow) → weekday name.
  if (diff > 1 && diff < 7) {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  }

  // Everything else (further future, or any past date) → 'D MMM'.
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}
