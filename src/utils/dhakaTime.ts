import { Language } from '../types/quest';

const DHAKA_TZ = 'Asia/Dhaka';

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

const BENGALI_MONTHS = [
  'জানুয়ারি',
  'ফেব্রুয়ারি',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
];

const ENGLISH_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const BENGALI_WEEKDAYS_FULL = [
  'রবিবার',
  'সোমবার',
  'মঙ্গলবার',
  'বুধবার',
  'বৃহস্পতিবার',
  'শুক্রবার',
  'শনিবার',
];

const ENGLISH_WEEKDAYS_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const BENGALI_WEEKDAYS_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const ENGLISH_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toBengaliDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)] ?? d);
}

export function formatDigits(value: string | number, lang: Language): string {
  return lang === 'bn' ? toBengaliDigits(value) : String(value);
}

export function getDhakaTodayKey(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DHAKA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { year: y || 2026, month: m || 1, day: d || 1 };
}

export function formatDateKey(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const utc = Date.UTC(year, month - 1, day + deltaDays);
  const dt = new Date(utc);
  return formatDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function getWeekdayIndex(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCDay();
}

export function formatLocalizedDate(
  dateKey: string,
  lang: Language,
  includeWeekday = true
): string {
  const { year, month, day } = parseDateKey(dateKey);
  if (lang === 'en') {
    const monthName = ENGLISH_MONTHS[month - 1] ?? '';
    const shortMonth = monthName.slice(0, 3);
    if (!includeWeekday) {
      return `${day} ${shortMonth} ${year}`;
    }
    const weekday = ENGLISH_WEEKDAYS_FULL[getWeekdayIndex(dateKey)] ?? '';
    return `${weekday}, ${day} ${shortMonth} ${year}`;
  }

  const monthName = BENGALI_MONTHS[month - 1] ?? '';
  const dayBn = toBengaliDigits(day);
  const yearBn = toBengaliDigits(year);
  if (!includeWeekday) {
    return `${dayBn} ${monthName} ${yearBn}`;
  }
  const weekday = BENGALI_WEEKDAYS_FULL[getWeekdayIndex(dateKey)] ?? '';
  return `${weekday}, ${dayBn} ${monthName} ${yearBn}`;
}

export function formatBengaliDate(dateKey: string, includeWeekday = true): string {
  return formatLocalizedDate(dateKey, 'bn', includeWeekday);
}

export function formatLocalizedShortDate(dateKey: string, lang: Language): string {
  const { month, day } = parseDateKey(dateKey);
  if (lang === 'en') {
    const monthName = (ENGLISH_MONTHS[month - 1] ?? '').slice(0, 3);
    return `${day} ${monthName}`;
  }
  const monthName = BENGALI_MONTHS[month - 1] ?? '';
  return `${toBengaliDigits(day)} ${monthName.slice(0, 4)}`;
}

export function formatBengaliShortDate(dateKey: string): string {
  return formatLocalizedShortDate(dateKey, 'bn');
}

export function formatLocalizedShortDay(dateKey: string, lang: Language): string {
  const idx = getWeekdayIndex(dateKey);
  return lang === 'en'
    ? (ENGLISH_WEEKDAYS_SHORT[idx] ?? '')
    : (BENGALI_WEEKDAYS_SHORT[idx] ?? '');
}

export function formatBengaliShortDay(dateKey: string): string {
  return formatLocalizedShortDay(dateKey, 'bn');
}

export function getLocalizedWeekdays(lang: Language): string[] {
  return lang === 'en' ? ENGLISH_WEEKDAYS_SHORT : BENGALI_WEEKDAYS_SHORT;
}

export function formatLocalizedMonthYear(
  year: number,
  monthIndex0: number,
  lang: Language
): string {
  if (lang === 'en') {
    const monthName = ENGLISH_MONTHS[monthIndex0] ?? '';
    return `${monthName} ${year}`;
  }
  const monthName = BENGALI_MONTHS[monthIndex0] ?? '';
  return `${monthName} ${toBengaliDigits(year)}`;
}

export function formatBengaliMonthYear(year: number, monthIndex0: number): string {
  return formatLocalizedMonthYear(year, monthIndex0, 'bn');
}

export function getLastNDaysKeys(endDateKey: string, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(shiftDateKey(endDateKey, -i));
  }
  return keys;
}

export function getMonthCalendarCells(year: number, monthIndex0: number): (string | null)[] {
  const firstDay = new Date(Date.UTC(year, monthIndex0, 1));
  const startWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(formatDateKey(year, monthIndex0 + 1, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function formatLocalizedDuration(totalMinutes: number, lang: Language): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hrs = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (lang === 'en') {
    if (hrs > 0 && mins > 0) return `${hrs} hr ${mins} min`;
    if (hrs > 0) return `${hrs} hr`;
    return `${mins} min`;
  }
  if (hrs > 0 && mins > 0) {
    return `${toBengaliDigits(hrs)} ঘণ্টা ${toBengaliDigits(mins)} মিনিট`;
  }
  if (hrs > 0) {
    return `${toBengaliDigits(hrs)} ঘণ্টা`;
  }
  return `${toBengaliDigits(mins)} মিনিট`;
}

export function formatMinutesToBengaliDuration(totalMinutes: number): string {
  return formatLocalizedDuration(totalMinutes, 'bn');
}

export function getDhakaLocalizedTimeLabel(
  lang: Language,
  now: Date = new Date()
): string {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: DHAKA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  if (lang === 'en') {
    return formatted;
  }
  return toBengaliDigits(
    formatted.replace('AM', 'পূর্বাহ্ণ').replace('PM', 'অপরাহ্ণ')
  );
}

export function getDhakaCurrentTimeLabel(now: Date = new Date()): string {
  return getDhakaLocalizedTimeLabel('bn', now);
}
