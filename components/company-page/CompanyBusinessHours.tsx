import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Clock3 } from 'lucide-react';
import type { CompanyBusinessDay, CompanyPageConfig } from './CompanyPageExtensions';

const DAYS: Array<{ key: CompanyBusinessDay; label: string; jsDay: number }> = [
  { key: 'mon', label: 'Segunda', jsDay: 1 },
  { key: 'tue', label: 'Terça', jsDay: 2 },
  { key: 'wed', label: 'Quarta', jsDay: 3 },
  { key: 'thu', label: 'Quinta', jsDay: 4 },
  { key: 'fri', label: 'Sexta', jsDay: 5 },
  { key: 'sat', label: 'Sábado', jsDay: 6 },
  { key: 'sun', label: 'Domingo', jsDay: 0 },
];

export function CompanyBusinessHours({ config }: { config?: CompanyPageConfig['businessHours'] | null }) {
  const [now, setNow] = useState(Date.now());
  const [openDetails, setOpenDetails] = useState(false);
  const enabled = config?.enabled === true && config?.showOnPage !== false;
  const timezone = config?.timezone || 'America/Sao_Paulo';

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const status = useMemo(() => enabled ? businessStatus(config, new Date(now), timezone) : null, [config, enabled, now, timezone]);
  if (!enabled || !status) return null;

  return (
    <div className="pn-business-hours pointer-events-auto absolute right-3 top-3 z-[70] w-[min(90vw,310px)] font-sans sm:right-5 sm:top-5">
      <button type="button" onClick={() => setOpenDetails((value) => !value)} className="flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white/95 px-3.5 py-3 text-left text-stone-900 shadow-[0_12px_35px_rgba(0,0,0,.14)] backdrop-blur-xl">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${status.open ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}><Clock3 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1"><span className={`block text-[10px] font-black uppercase tracking-[.12em] ${status.open ? 'text-emerald-700' : 'text-stone-500'}`}>{status.open ? 'ABERTO agora' : 'FECHADO agora'}</span><span className="mt-0.5 block truncate text-[11px] font-bold text-stone-500">{status.caption}</span></span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition ${openDetails ? 'rotate-180' : ''}`} />
      </button>
      {openDetails && <div className="mt-2 rounded-2xl border border-black/10 bg-white/98 p-3.5 text-stone-700 shadow-[0_18px_45px_rgba(0,0,0,.16)] backdrop-blur-xl"><div className="space-y-2">{DAYS.map((day) => { const intervals = config?.days?.[day.key] || []; const today = day.jsDay === status.weekday; return <div key={day.key} className={`grid grid-cols-[82px_1fr] gap-3 rounded-lg px-2 py-1.5 text-[11px] ${today ? 'bg-stone-100 font-black' : ''}`}><span>{day.label}</span><span className="text-right text-stone-500">{intervals.length ? intervals.map((interval) => `${interval.open}–${interval.close}`).join(' · ') : 'Fechado'}</span></div>; })}</div>{config?.specialDates?.length ? <div className="mt-3 border-t border-stone-100 pt-3"><p className="mb-2 text-[9px] font-black uppercase tracking-[.12em] text-stone-400">Datas especiais</p><div className="space-y-1.5">{config.specialDates.slice(0,8).map((item) => <div key={`${item.date}-${item.label || ''}`} className="flex items-center justify-between gap-3 text-[10px]"><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')} {item.label ? `· ${item.label}` : ''}</span><b>{item.closed ? 'Fechado' : `${item.open}–${item.close}`}</b></div>)}</div></div> : null}<p className="mt-3 border-t border-stone-100 pt-2 text-[9px] font-semibold text-stone-400">Horários informados pela empresa · {timezone}</p></div>}
    </div>
  );
}

function businessStatus(config: NonNullable<CompanyPageConfig['businessHours']>, date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekdayText = parts.find((item) => item.type === 'weekday')?.value || 'Mon';
  const year = parts.find((item) => item.type === 'year')?.value || '';
  const month = parts.find((item) => item.type === 'month')?.value || '';
  const day = parts.find((item) => item.type === 'day')?.value || '';
  const isoDate = `${year}-${month}-${day}`;
  const hour = Number(parts.find((item) => item.type === 'hour')?.value || 0);
  const minute = Number(parts.find((item) => item.type === 'minute')?.value || 0);
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekdayText] ?? 1;
  const dayKey = DAYS.find((item) => item.jsDay === weekday)?.key || 'mon';
  const previousWeekday = (weekday + 6) % 7;
  const previousKey = DAYS.find((item) => item.jsDay === previousWeekday)?.key || 'sun';
  const minutes = hour * 60 + minute;
  const special = config.specialDates?.find((item) => item.date === isoDate);
  if (special?.closed) return { open: false, caption: special.label ? `Fechado · ${special.label}` : 'Fechado hoje', weekday };
  const todayIntervals = special?.open && special?.close ? [{ open: special.open, close: special.close }] : (config.days?.[dayKey] || []);
  const previousIntervals = config.days?.[previousKey] || [];

  for (const interval of todayIntervals) {
    const start = toMinutes(interval.open);
    const end = toMinutes(interval.close);
    if (start == null || end == null) continue;
    if (end > start && minutes >= start && minutes < end) return { open: true, caption: `Fecha às ${interval.close}`, weekday };
    if (end <= start && minutes >= start) return { open: true, caption: `Fecha amanhã às ${interval.close}`, weekday };
  }
  for (const interval of previousIntervals) {
    const start = toMinutes(interval.open);
    const end = toMinutes(interval.close);
    if (start == null || end == null || end > start) continue;
    if (minutes < end) return { open: true, caption: `Fecha às ${interval.close}`, weekday };
  }

  const next = nextOpening(config, weekday, minutes);
  return { open: false, caption: next || 'Confira os horários', weekday };
}

function nextOpening(config: NonNullable<CompanyPageConfig['businessHours']>, weekday: number, currentMinutes: number) {
  for (let offset = 0; offset < 8; offset += 1) {
    const targetWeekday = (weekday + offset) % 7;
    const key = DAYS.find((item) => item.jsDay === targetWeekday)?.key;
    if (!key) continue;
    const intervals = config.days?.[key] || [];
    const starts = intervals.map((item) => ({ text: item.open, minute: toMinutes(item.open) })).filter((item): item is { text: string; minute: number } => item.minute != null).sort((a, b) => a.minute - b.minute);
    const candidate = offset === 0 ? starts.find((item) => item.minute > currentMinutes) : starts[0];
    if (!candidate) continue;
    if (offset === 0) return `Abre hoje às ${candidate.text}`;
    if (offset === 1) return `Abre amanhã às ${candidate.text}`;
    const label = DAYS.find((item) => item.jsDay === targetWeekday)?.label || '';
    return `Abre ${label.toLowerCase()} às ${candidate.text}`;
  }
  return null;
}

function toMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
