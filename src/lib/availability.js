// Phase 15 — Tailor availability calendar helpers.
//
// Small, dependency-free date utilities shared by the tailor dashboard
// AVAILABILITY tab, the public /tailors/<id> calendar and the alteration-request
// preferred-date picker. All dates are handled as local-time "YYYY-MM-DD"
// strings to match the Postgres `date` column (no timezone shifting).

export const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

// A Date → "YYYY-MM-DD" in LOCAL time (never toISOString, which is UTC and can
// roll the day over near midnight).
export const toISODate = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// "YYYY-MM-DD" → a local Date at midnight.
export const parseISODate = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const todayStart = () => startOfDay(new Date());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const isSameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Weekday labels, Monday-first (UK convention).
export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
// JS getDay() is Sunday=0..Saturday=6; convert to Monday=0..Sunday=6.
export const mondayIndex = (d) => (d.getDay() + 6) % 7;

// The full month grid for (year, month): 6 weeks × 7 days, each cell a Date,
// with `inMonth` flagging leading/trailing days from the adjacent months.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = mondayIndex(first);
  const gridStart = addDays(first, -lead);
  const weeks = [];
  let cur = gridStart;
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cur, inMonth: cur.getMonth() === month });
      cur = addDays(cur, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export const MONTH_NAMES = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
export const monthLabel = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

// Build a Map of "YYYY-MM-DD" → availability row from the rows array.
export function rowsByDate(rows) {
  const m = new Map();
  (rows || []).forEach((r) => { if (r && r.date) m.set(String(r.date).slice(0, 10), r); });
  return m;
}

// Resolve a single day's state from the rows map + the tailor's settings.
// Returns { state, slots, note } where state is one of:
//   "past"        — before today (not actionable)
//   "unavailable" — explicitly off, or fully booked (0 slots)
//   "partial"     — available but fewer than the default slots remain
//   "available"   — available with full default slots (the default for any
//                   untouched day inside the booking window)
//   "outside"     — beyond the tailor's advance-booking window
export function dayState(date, map, tailor, opts = {}) {
  const today = opts.today || todayStart();
  const day = startOfDay(date);
  if (day < today) return { state: "past", slots: 0 };
  const defaultSlots = Number(tailor?.default_slots_per_day) || 3;
  // Vacation mode (kept in sync with the seller's profile flag) hides everything.
  if (opts.vacation || tailor?.vacation_mode) return { state: "unavailable", slots: 0, note: "On vacation" };
  // Outside the advance-booking window?
  if (opts.windowDays) {
    const maxDay = addDays(today, opts.windowDays);
    if (day > maxDay) return { state: "outside", slots: 0 };
  }
  const row = map.get(toISODate(day));
  if (!row) return { state: "available", slots: defaultSlots };
  if (row.available === false) return { state: "unavailable", slots: 0, note: row.note };
  const slots = row.slots_remaining == null ? defaultSlots : Number(row.slots_remaining);
  if (slots <= 0) return { state: "unavailable", slots: 0, note: row.note };
  if (slots < defaultSlots) return { state: "partial", slots, note: row.note };
  return { state: "available", slots, note: row.note };
}

// The advance-booking-days choices for the settings dropdown.
export const ADVANCE_BOOKING_OPTIONS = [
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 60, label: "2 months" },
  { days: 90, label: "3 months" },
];
