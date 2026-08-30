export type TimedDeliveryRateRule = {
  daysOfWeek?: unknown;
  timeStart?: string | null;
  timeEnd?: string | null;
  timezone?: string | null;
};

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export function matchesDeliveryRateTime(rule: TimedDeliveryRateRule, at = new Date()): boolean {
  const timezone = normalizeTimezone(rule.timezone);
  const local = localParts(at, timezone);
  const allowedDays = normalizeDays(rule.daysOfWeek);
  const start = minutes(rule.timeStart);
  const end = minutes(rule.timeEnd);

  if (start == null || end == null) {
    return allowedDays.length === 0 || allowedDays.includes(local.weekday);
  }

  if (start === end) {
    return allowedDays.length === 0 || allowedDays.includes(local.weekday);
  }

  if (start < end) {
    const dayMatches = allowedDays.length === 0 || allowedDays.includes(local.weekday);
    return dayMatches && local.minutes >= start && local.minutes < end;
  }

  // Janela que atravessa meia-noite. O dia configurado representa o dia em que a faixa começa.
  if (local.minutes >= start) {
    return allowedDays.length === 0 || allowedDays.includes(local.weekday);
  }
  const previousDay = (local.weekday + 6) % 7;
  return local.minutes < end && (allowedDays.length === 0 || allowedDays.includes(previousDay));
}

export function deliveryRateTimeSignature(at = new Date(), timezone = DEFAULT_TIMEZONE): string {
  const local = localParts(at, normalizeTimezone(timezone));
  return `${local.date}:${String(local.minutes).padStart(4, '0')}`;
}

export function normalizeDeliveryRateDays(value: unknown): number[] {
  return normalizeDays(value);
}

function normalizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => Number(item)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
}

function minutes(value: unknown): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeTimezone(value: unknown): string {
  const timezone = String(value || DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function localParts(at: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(at).map((part) => [part.type, part.value]));
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[parts.weekday] ?? 0;
  const hour = Number(parts.hour || 0);
  const minute = Number(parts.minute || 0);
  return {
    weekday,
    minutes: hour * 60 + minute,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}
