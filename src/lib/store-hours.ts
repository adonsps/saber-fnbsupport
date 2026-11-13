import { DaySchedule } from '@/types/schema';

export type NormalizedDaySchedule = {
  dayIndex: number; // 0 = Sunday ... 6 = Saturday
  dayLabelId: string;
  dayLabelEn: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

export interface StoreHoursEvaluation {
  hasSchedule: boolean;
  isWithinHours: boolean;
  nowTimeWib: string;
  today: NormalizedDaySchedule | null;
  statusLabelId: string;
  statusLabelEn: string;
  schedule: NormalizedDaySchedule[];
}

const WEEKDAY_META: Array<{
  dayIndex: number;
  dayLabelId: string;
  dayLabelEn: string;
  aliases: string[];
}> = [
  { dayIndex: 0, dayLabelId: 'Minggu', dayLabelEn: 'Sunday', aliases: ['minggu', 'ahad', 'sunday', 'sun'] },
  { dayIndex: 1, dayLabelId: 'Senin', dayLabelEn: 'Monday', aliases: ['senin', 'monday', 'mon'] },
  { dayIndex: 2, dayLabelId: 'Selasa', dayLabelEn: 'Tuesday', aliases: ['selasa', 'tuesday', 'tue'] },
  { dayIndex: 3, dayLabelId: 'Rabu', dayLabelEn: 'Wednesday', aliases: ['rabu', 'wednesday', 'wed'] },
  { dayIndex: 4, dayLabelId: 'Kamis', dayLabelEn: 'Thursday', aliases: ['kamis', 'thursday', 'thu'] },
  { dayIndex: 5, dayLabelId: 'Jumat', dayLabelEn: 'Friday', aliases: ['jumat', "jum'at", 'friday', 'fri'] },
  { dayIndex: 6, dayLabelId: 'Sabtu', dayLabelEn: 'Saturday', aliases: ['sabtu', 'saturday', 'sat'] },
];

function matchDayIndex(rawDay: string): number {
  const lower = String(rawDay || '').toLowerCase();
  for (const meta of WEEKDAY_META) {
    if (meta.aliases.some((alias) => lower.includes(alias))) {
      return meta.dayIndex;
    }
  }
  return -1;
}

function parseMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function getJakartaClock(now: Date): { dayIndex: number; minutes: number; timeStr: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekdayPart = (parts.find((p) => p.type === 'weekday')?.value || 'Mon').toLowerCase();
  const hourStr = parts.find((p) => p.type === 'hour')?.value || '12';
  const minStr = parts.find((p) => p.type === 'minute')?.value || '00';

  const hourNum = Number(hourStr) === 24 ? 0 : Number(hourStr);
  const minNum = Number(minStr);
  const dayIndex = matchDayIndex(weekdayPart);
  return {
    dayIndex: dayIndex >= 0 ? dayIndex : 1,
    minutes: hourNum * 60 + minNum,
    timeStr: `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`,
  };
}

export function parseOperationalHours(rawHours?: string): NormalizedDaySchedule[] {
  if (!rawHours || !rawHours.trim()) return [];
  try {
    const parsed = JSON.parse(rawHours) as Array<
      Partial<DaySchedule> & { isClosed?: boolean; open?: string; close?: string }
    >;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const normalized: NormalizedDaySchedule[] = [];
    for (const item of parsed) {
      const idx = matchDayIndex(String(item.day || ''));
      if (idx < 0) continue;
      const meta = WEEKDAY_META.find((w) => w.dayIndex === idx)!;
      const isOpen =
        typeof item.isOpen === 'boolean'
          ? item.isOpen
          : typeof item.isClosed === 'boolean'
            ? !item.isClosed
            : true;
      const openTime = String(item.openTime || item.open || '08:00').trim();
      const closeTime = String(item.closeTime || item.close || '22:00').trim();
      normalized.push({
        dayIndex: idx,
        dayLabelId: meta.dayLabelId,
        dayLabelEn: meta.dayLabelEn,
        isOpen,
        openTime,
        closeTime,
      });
    }
    return normalized;
  } catch {
    return [];
  }
}

export function evaluateStoreHours(rawHours?: string, now: Date = new Date()): StoreHoursEvaluation {
  const schedule = parseOperationalHours(rawHours);
  const clock = getJakartaClock(now);

  if (schedule.length === 0) {
    return {
      hasSchedule: false,
      isWithinHours: true,
      nowTimeWib: clock.timeStr,
      today: null,
      statusLabelId: 'Buka Setiap Hari',
      statusLabelEn: 'Open Daily',
      schedule: [],
    };
  }

  const today = schedule.find((s) => s.dayIndex === clock.dayIndex) || null;
  const yesterdayIdx = (clock.dayIndex + 6) % 7;
  const yesterday = schedule.find((s) => s.dayIndex === yesterdayIdx) || null;

  let isWithinHours = false;

  if (today?.isOpen) {
    const openMin = parseMinutes(today.openTime);
    const closeMin = parseMinutes(today.closeTime);
    if (openMin !== null && closeMin !== null) {
      if (closeMin > openMin) {
        isWithinHours = clock.minutes >= openMin && clock.minutes < closeMin;
      } else {
        // Overnight schedule (e.g., 17:00 - 02:00)
        isWithinHours = clock.minutes >= openMin;
      }
    } else {
      isWithinHours = true;
    }
  }

  if (!isWithinHours && yesterday?.isOpen) {
    const yOpen = parseMinutes(yesterday.openTime);
    const yClose = parseMinutes(yesterday.closeTime);
    if (yOpen !== null && yClose !== null && yClose <= yOpen) {
      isWithinHours = clock.minutes < yClose;
    }
  }

  const todayHoursText = today?.isOpen ? `${today.openTime}–${today.closeTime} WIB` : null;

  return {
    hasSchedule: true,
    isWithinHours,
    nowTimeWib: clock.timeStr,
    today,
    statusLabelId: today?.isOpen
      ? isWithinHours
        ? `Buka • Hari ini ${todayHoursText}`
        : `Tutup Sekarang • Jam buka ${today.dayLabelId} ${todayHoursText}`
      : `Tutup Hari Ini (${today?.dayLabelId || 'Jadwal Tutup'})`,
    statusLabelEn: today?.isOpen
      ? isWithinHours
        ? `Open • Today ${todayHoursText}`
        : `Closed Now • ${today.dayLabelEn} hours ${todayHoursText}`
      : `Closed Today (${today?.dayLabelEn || 'Scheduled Off'})`,
    schedule,
  };
}

export interface ScheduledValidationResult {
  valid: boolean;
  isoString?: string;
  errorId?: string;
  errorEn?: string;
}

/**
 * Formats a Date into `YYYY-MM-DDTHH:mm` in Asia/Jakarta (WIB) for `<input type="datetime-local" min=...>`.
 */
export function getNowLocalInputWib(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/**
 * Parses and validates a scheduled pickup/delivery datetime string in WIB (UTC+7):
 * - Rejects invalid/unparseable date strings
 * - Rejects timestamps in the past (with 2-minute grace window)
 * - Rejects timestamps more than 14 days in the future
 * - Rejects timestamps outside the branch operationalHours when configured
 */
export function validateScheduledDateTime(
  rawValue: string | undefined | null,
  rawHours?: string,
  now: Date = new Date()
): ScheduledValidationResult {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      errorId: 'Tanggal dan jam terjadwal wajib diisi.',
      errorEn: 'Scheduled date and time are required.',
    };
  }

  // If input is `YYYY-MM-DDTHH:mm` (no timezone), interpret as WIB (+07:00)
  const hasTz = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  const normalized = hasTz ? trimmed : `${trimmed.length === 16 ? `${trimmed}:00` : trimmed}+07:00`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return {
      valid: false,
      errorId: 'Format tanggal & jam tidak valid. Pilih ulang dari kalender.',
      errorEn: 'Invalid date & time format. Please select a valid date and time.',
    };
  }

  const minAllowedMs = now.getTime() - 2 * 60 * 1000;
  if (parsed.getTime() < minAllowedMs) {
    return {
      valid: false,
      errorId: 'Waktu jadwal tidak boleh di masa lalu. Pilih waktu setelah sekarang.',
      errorEn: 'Scheduled time cannot be in the past. Please choose a future time.',
    };
  }

  const maxAllowedMs = now.getTime() + 14 * 24 * 60 * 60 * 1000;
  if (parsed.getTime() > maxAllowedMs) {
    return {
      valid: false,
      errorId: 'Jadwal maksimal 14 hari ke depan.',
      errorEn: 'Scheduled orders can be placed up to 14 days ahead.',
    };
  }

  const evaluation = evaluateStoreHours(rawHours, parsed);
  if (evaluation.hasSchedule && !evaluation.isWithinHours) {
    const dayLabelId = evaluation.today?.dayLabelId || 'hari tersebut';
    const dayLabelEn = evaluation.today?.dayLabelEn || 'that day';
    const hrs = evaluation.today?.isOpen
      ? `${evaluation.today.openTime}–${evaluation.today.closeTime} WIB`
      : null;
    return {
      valid: false,
      errorId: hrs
        ? `Di luar jam operasional restoran pada ${dayLabelId} (${hrs}).`
        : `Restoran tutup pada hari ${dayLabelId}. Pilih hari/jam operasional lain.`,
      errorEn: hrs
        ? `Outside restaurant operating hours on ${dayLabelEn} (${hrs}).`
        : `Restaurant is closed on ${dayLabelEn}. Please pick another operating day/time.`,
    };
  }

  return {
    valid: true,
    isoString: parsed.toISOString(),
  };
}

export function formatScheduledWib(rawValue?: string | null, lang: 'id' | 'en' = 'id'): string {
  if (!rawValue) return '-';
  const hasTz = /(?:Z|[+-]\d{2}:\d{2})$/i.test(rawValue.trim());
  const normalized = hasTz ? rawValue.trim() : `${rawValue.trim()}+07:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return rawValue;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d) + ' WIB';
}

