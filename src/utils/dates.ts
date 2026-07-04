import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { WEEKDAY_NAMES, MONTH_NAMES_MS } from '../types';

dayjs.extend(isoWeek);

export function formatDate(dateStr: string): string {
  const d = dayjs(dateStr);
  return d.format('DD-MM-YYYY');
}

export function formatDateShort(dateStr: string): string {
  const d = dayjs(dateStr);
  return d.format('DD/MM');
}

export function getDayName(dateStr: string): string {
  const dow = dayjs(dateStr).day();
  return WEEKDAY_NAMES[dow] || '';
}

export function getDayNameShort(dateStr: string): string {
  const names: Record<number, string> = {
    0: 'Ahd', 1: 'Isn', 2: 'Sel', 3: 'Rab', 4: 'Kha', 5: 'Jum', 6: 'Sab',
  };
  return names[dayjs(dateStr).day()] || '';
}

export function getMonthName(monthStr: string): string {
  const [, mon] = monthStr.split('-').map(Number);
  return MONTH_NAMES_MS[mon - 1] || '';
}

export function getDisplayMonth(monthStr: string): string {
  const [year, mon] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES_MS[mon - 1]} ${year}`;
}

export function getDaysInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const daysCount = dayjs(`${year}-${String(mon).padStart(2, '0')}`).daysInMonth();
  const days: string[] = [];
  for (let d = 1; d <= daysCount; d++) {
    days.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

export function getCurrentMonth(): string {
  return dayjs().format('YYYY-MM');
}

export function getDayOfWeek(dateStr: string): number {
  return dayjs(dateStr).day();
}

export function getWeekNumber(dateStr: string): string {
  return `${dayjs(dateStr).year()}-W${String(dayjs(dateStr).isoWeek()).padStart(2, '0')}`;
}

export function getCalendarDays(month: string): (string | null)[] {
  const [year, mon] = month.split('-').map(Number);
  const firstDay = dayjs(`${year}-${String(mon).padStart(2, '0')}-01`);
  const daysInMonth = firstDay.daysInMonth();
  const startDow = firstDay.day(); // 0=Sun
  
  // Monday-first calendar
  const offset = startDow === 0 ? 6 : startDow - 1;
  
  const calendar: (string | null)[] = [];
  for (let i = 0; i < offset; i++) {
    calendar.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendar.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  
  // Pad to complete rows
  while (calendar.length % 7 !== 0) {
    calendar.push(null);
  }
  
  return calendar;
}

export function isHoliday(dateStr: string, holidayDates: Set<string>): boolean {
  return holidayDates.has(dateStr);
}

export function isWeekend(dateStr: string): boolean {
  const dow = dayjs(dateStr).day();
  return dow === 0 || dow === 6;
}

export function isWeekday(dateStr: string): boolean {
  return !isWeekend(dateStr);
}

export function addDays(dateStr: string, days: number): string {
  return dayjs(dateStr).add(days, 'day').format('YYYY-MM-DD');
}

export function getWeekKey(dateStr: string): string {
  const d = dayjs(dateStr);
  return `${d.year()}-W${String(d.isoWeek()).padStart(2, '0')}`;
}

export function formatCurrency(amount: number): string {
  return `RM ${amount.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}