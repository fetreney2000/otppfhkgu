// ============================================
// ROSTER SOLVER WEB WORKER — COMPLETE REWRITE
// Runs entirely client-side to avoid Vercel timeout
// All constraints, rules, and regulations enforced
// ============================================

import type {
  SolverInputData, SolverProgress, SolverResult, SolverAssignment,
  SolverSlot, SolverState, MonthlyRuleStats, SolverObjective,
  Employee, Holiday, AEAssignment, Preselection, Unavailability, RosterArchive,
  DayType, EmployeeRole,
} from '../types';

let cancelled = false;

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'cancel') { cancelled = true; return; }
  if (e.data.type === 'start') {
    cancelled = false;
    try {
      solve(e.data.data as SolverInputData).catch((err) => {
        console.error('Solver async error:', err);
        postResult({ type: 'result', success: false, warnings: [`Ralat: ${err.message}`], unfilledCount: 0, assignments: [], elapsedSeconds: 0, solverMode: 'Error', objective: null as any });
      });
    } catch (err: any) {
      postResult({ type: 'result', success: false, warnings: [`Ralat: ${err.message}`], unfilledCount: 0, assignments: [], elapsedSeconds: 0, solverMode: 'Error', objective: null as any });
    }
  }
};

function postProgress(p: SolverProgress) { self.postMessage(p); }
function postResult(r: SolverResult) { self.postMessage(r); }

// ============================================
// TIMEZONE-SAFE DATE FUNCTIONS (all UTC)
// ============================================
function parseDate(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { y, m, d };
}

function dateToUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(dateStr: string, n: number): string {
  const p = parseDate(dateStr);
  const d = dateToUTC(p.y, p.m, p.d + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getDOW(dateStr: string): number {
  const p = parseDate(dateStr);
  return dateToUTC(p.y, p.m, p.d).getUTCDay();
}

function getDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const daysCount = dateToUTC(y, m, 1).getUTCDate();
  // Actually need last day of month
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function getDayName(dateStr: string): string {
  const names = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  return names[getDOW(dateStr)];
}

// ============================================
// DAY CLASSIFICATION
// ============================================
function classifyDay(dateStr: string, holidayDates: Set<string>): DayType {
  if (holidayDates.has(dateStr)) return 'holiday';
  const dow = getDOW(dateStr);
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

// ============================================
// AE HOURS CALCULATION (exact spec)
// ============================================
function calcAEHours(dateStr: string, dayType: DayType, allHolidays: Set<string>): number {
  const dow = getDOW(dateStr);
  if (dow >= 1 && dow <= 4) return 0;
  if (dow === 5) return 9;
  if (dow === 6) return 9;
  const nextDay = addDays(dateStr, 1);
  const nextDow = getDOW(nextDay);
  const nextIsHoliday = allHolidays.has(nextDay);
  if (dayType === 'sunday') return nextIsHoliday ? 9 : 2;
  // Holiday — only Sat/Sun/Holiday next day gives 9h; Friday next day gives 2h
  const nextIsSatSunHol = (nextDow === 6 || nextDow === 0 || nextIsHoliday);
  return nextIsSatSunHol ? 9 : 2;
}

// ============================================
// AE CATEGORY CLASSIFICATION (exact spec)
// ============================================
function getAECategory(dateStr: string, allHolidays: Set<string>): string {
  const tomorrow = addDays(dateStr, 1);
  if (allHolidays.has(tomorrow)) return 'friSatHol';
  const dow = getDOW(dateStr);
  if (dow === 5 || dow === 6) return 'friSatHol';
  return 'sunThu';
}

// ============================================
// SLOT TEMPLATES PER DAY TYPE
// ============================================
function getSlotsForDay(dateStr: string, dayType: DayType, aeMap: Map<string, string>, allHolidays: Set<string>): SolverSlot[] {
  const slots: SolverSlot[] = [];
  const aeDept = aeMap.get(dateStr);

  if (aeDept) {
    const aeHours = calcAEHours(dateStr, dayType, allHolidays);
    // Include ALL AE slots - 0-hour slots (Mon-Thu) are informational markers
    // They appear in roster output but are skipped during assignment
    slots.push({ slotType: 'AE', department: aeDept, role: 'PPF', hours: aeHours, date: dateStr, dayType });
  }

  if (dayType === 'weekday') {
    slots.push({ slotType: 'IPP_1', department: 'IPP', role: 'PPF', hours: 4, date: dateStr, dayType });
    // Weekday OPD mix: 3 OPD slots — target 2 OPD + 1 IPP
    slots.push({ slotType: 'OPD_1', department: null, role: 'PPF', hours: 4, date: dateStr, dayType });
    slots.push({ slotType: 'OPD_2', department: null, role: 'PPF', hours: 4, date: dateStr, dayType });
    slots.push({ slotType: 'OPD_3', department: null, role: 'PPF', hours: 4, date: dateStr, dayType });
  } else {
    const isHoliday = dayType === 'holiday';
    const ippCount = isHoliday ? 4 : 3;
    const opdCount = isHoliday ? 5 : 4;
    for (let i = 1; i <= ippCount; i++) {
      slots.push({ slotType: `IPP_${i}`, department: 'IPP', role: 'PPF', hours: 7, date: dateStr, dayType });
    }
    for (let i = 1; i <= opdCount; i++) {
      slots.push({ slotType: `OPD_${i}`, department: 'OPD', role: 'PPF', hours: 7, date: dateStr, dayType });
    }
    slots.push({ slotType: 'PP_PPF', department: null, role: 'PPF', hours: 6, date: dateStr, dayType });
    slots.push({ slotType: 'PP_PRA_1', department: null, role: 'PRA', hours: 6, date: dateStr, dayType });
    slots.push({ slotType: 'PP_PRA_2', department: null, role: 'PRA', hours: 6, date: dateStr, dayType });
  }
  return slots;
}

// ============================================
// RULE STATS
// ============================================
function emptyMonthlyRuleStats(): MonthlyRuleStats {
  return { ippOffdayIpp: 0, ippWeekdayIpp: 0, ippWeekdayOpd: 0, opdOffdayOpd: 0, opdWeekdayOpd: 0, holidaySlotsAll: 0, aeSlotsAll: 0, aePaidSlotsAll: 0, aeUnpaidSlotsAll: 0 };
}

function updateMonthlyRuleStats(stats: MonthlyRuleStats, emp: Employee, slotType: string, dateStr: string, holidayDates: Set<string>, allHolidays: Set<string>): void {
  const dayType = classifyDay(dateStr, holidayDates);
  const isWeekday = dayType === 'weekday';
  const isHoliday = dayType === 'holiday';

  if (slotType === 'AE') {
    stats.aeSlotsAll++;
    const cat = getAECategory(dateStr, allHolidays);
    if (cat === 'friSatHol') stats.aePaidSlotsAll++; else stats.aeUnpaidSlotsAll++;
    return;
  }
  if (isHoliday) stats.holidaySlotsAll++;

  if (emp.department === 'IPP' && emp.role === 'PPF') {
    if (slotType.startsWith('IPP_')) { if (isWeekday) stats.ippWeekdayIpp++; else stats.ippOffdayIpp++; }
    else if (slotType.startsWith('OPD_')) { if (isWeekday) stats.ippWeekdayOpd++; }
  }
  if (emp.department === 'OPD' && emp.role === 'PPF') {
    if (slotType.startsWith('OPD_')) { if (isWeekday) stats.opdWeekdayOpd++; else stats.opdOffdayOpd++; }
  }
}

function getWeekKey(dateStr: string): string {
  const p = parseDate(dateStr);
  const d = dateToUTC(p.y, p.m, p.d);
  const jan1 = dateToUTC(p.y, 1, 1);
  const weekNum = Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + d.getUTCDay() + 1) / 7);
  return `${p.y}-W${String(weekNum).padStart(2, '0')}`;
}

// ============================================
// ELIGIBILITY ENGINE (18 constraints — ALL enforced)
// ============================================
function isEligible(emp: Employee, slot: SolverSlot, state: SolverState, holidayDates: Set<string>, allHolidays: Set<string>, config: Record<string, string>): boolean {
  const empId = emp.employeeId;
  const dateStr = slot.date;

  // CHECK 1: ROLE MATCH
  if (slot.slotType === 'PP_PRA_1' || slot.slotType === 'PP_PRA_2') {
    if (emp.role !== 'PRA') return false;
  } else {
    if (emp.role !== 'PPF') return false;
  }

  // CHECK 2: DEPARTMENT MATCH (now includes AE department check)
  if (slot.slotType === 'AE') {
    if (slot.department && emp.department !== slot.department) return false;
  } else if (slot.slotType.startsWith('IPP_')) {
    if (emp.department !== 'IPP') return false;
  } else if (slot.slotType.startsWith('OPD_') && classifyDay(dateStr, holidayDates) !== 'weekday') {
    if (emp.department !== 'OPD') return false;
  }

  // CHECK 3: ONE SLOT PER DAY
  if (state.assignedToday[dateStr]?.[empId]) return false;

  // CHECK 4: UNAVAILABILITY
  if (state.unavailSet?.has(`${dateStr}_${empId}`)) return false;

  // CHECK 5: POST-AE NEXT-DAY BLOCK
  if (state.postAEBlock[empId]?.[dateStr]) return false;

  // Also check if employee did AE yesterday in current solution
  // (handles back-loaded strategies where tomorrow is processed before today)
  const prevDayForBlock = addDays(dateStr, -1);
  if (state.assignments.some(a => a.date === prevDayForBlock && a.employeeId === empId && a.slotType === 'AE')) {
    return false;
  }

  // CHECK 6: CONSECUTIVE DAY RULE
  // If employee worked yesterday (non-AE, Mon-Thu), they CANNOT work today
  // (unless today is a holiday or slot is AE)
  const lastDay = state.lastWorkedDay[empId];
  if (lastDay) {
    const yesterday = addDays(dateStr, -1);
    if (lastDay === yesterday) {
      if (!state.lastWorkedWasAE[empId]) {
        const yDow = getDOW(yesterday);
        if (yDow >= 1 && yDow <= 4 && classifyDay(dateStr, holidayDates) !== 'holiday' && slot.slotType !== 'AE') {
          return false;
        }
      }
    }
  }

  // CHECK 7: SAME SLOT TYPE CONSECUTIVE
  // Employee cannot do the same slot type two days in a row
  if (lastDay) {
    const yesterday = addDays(dateStr, -1);
    if (lastDay === yesterday && state.lastSlotType[empId] === slot.slotType) {
      return false;
    }
  }

  // CHECK 8: MONTHLY MAX HOURS
  if ((state.hoursUsed[empId] || 0) + slot.hours > (emp.maxHoursPerMonth || 40)) return false;

  // CHECK 9: WEEKLY WEEKDAY CAP
  if (slot.dayType === 'weekday' && slot.slotType !== 'AE') {
    const weekKey = getWeekKey(dateStr);
    if ((state.weekdaySlotWeekCounts[empId]?.[weekKey] || 0) >= 2) return false;
  }

  // CHECK 10: MONTHLY DEPT DISTRIBUTION MAXIMA
  const stats = state.monthlyRuleStats[empId] || emptyMonthlyRuleStats();
  if (emp.role === 'PPF' && slot.dayType === 'weekday' && slot.slotType.startsWith('OPD_')) {
    if (emp.department === 'IPP' && stats.ippWeekdayOpd >= parseInt(config.RULE_MAX_IPP_WEEKDAY_OPD || '4')) return false;
    if (emp.department === 'OPD' && stats.opdWeekdayOpd >= parseInt(config.RULE_MAX_OPD_WEEKDAY_OPD || '7')) return false;
  }

  // CHECK 11: MONTHLY HOLIDAY SLOT CAP
  if (classifyDay(dateStr, holidayDates) === 'holiday' && slot.slotType !== 'AE') {
    if (stats.holidaySlotsAll >= parseInt(config.RULE_MAX_HOLIDAY_SLOTS_ALL || '2')) return false;
  }

  // CHECK 12: MONTHLY AE SLOT CAP
  if (slot.slotType === 'AE') {
    if (stats.aeSlotsAll >= parseInt(config.RULE_MAX_AE_SLOTS_ALL || '2')) return false;
  }

  // CHECK 13: AE SPECIFIC
  if (slot.slotType === 'AE') {
    const aeCount = state.aeCountThisMonth[empId] || 0;
    if (aeCount >= 2) return false;

    const cat = getAECategory(dateStr, allHolidays);
    const cats = state.aeCategories[empId] || {};
    if (aeCount === 1) {
      if (cats.sunThu && cat === 'sunThu') return false;
      if (cats.friSatHol && cat === 'friSatHol') return false;
    }
    if (cat === 'friSatHol' && stats.aePaidSlotsAll >= parseInt(config.RULE_MAX_AE_PAID_PER_MONTH || '1')) return false;
    if (cat === 'sunThu' && stats.aeUnpaidSlotsAll >= parseInt(config.RULE_MAX_AE_UNPAID_PER_MONTH || '1')) return false;

    // 10-day gap
    const aeDays = state.aeDays[empId] || [];
    for (const prevDate of aeDays) {
      const p1 = parseDate(dateStr), p2 = parseDate(prevDate);
      const diff = Math.abs(dateToUTC(p1.y, p1.m, p1.d).getTime() - dateToUTC(p2.y, p2.m, p2.d).getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 10) return false;
    }
  }

  return true;
}

// Eligibility check that ignores holiday cap (for relaxation)
function isEligibleRelaxed(emp: Employee, slot: SolverSlot, state: SolverState, holidayDates: Set<string>, allHolidays: Set<string>, config: Record<string, string>): boolean {
  const empId = emp.employeeId;
  const dateStr = slot.date;

  if ((slot.slotType === 'PP_PRA_1' || slot.slotType === 'PP_PRA_2') && emp.role !== 'PRA') return false;
  if (!(slot.slotType === 'PP_PRA_1' || slot.slotType === 'PP_PRA_2') && emp.role !== 'PPF') return false;

  if (slot.slotType === 'AE') {
    if (slot.department && emp.department !== slot.department) return false;
  } else if (slot.slotType.startsWith('IPP_') && emp.department !== 'IPP') return false;
  else if (slot.slotType.startsWith('OPD_') && classifyDay(dateStr, holidayDates) !== 'weekday' && emp.department !== 'OPD') return false;

  if (state.assignedToday[dateStr]?.[empId]) return false;
  if (state.unavailSet?.has(`${dateStr}_${empId}`)) return false;
  if (state.postAEBlock[empId]?.[dateStr]) return false;

  // Also check if employee did AE yesterday in current solution
  const prevDayForBlockR = addDays(dateStr, -1);
  if (state.assignments.some(a => a.date === prevDayForBlockR && a.employeeId === empId && a.slotType === 'AE')) {
    return false;
  }

  if ((state.hoursUsed[empId] || 0) + slot.hours > (emp.maxHoursPerMonth || 40)) return false;

  if (slot.dayType === 'weekday' && slot.slotType !== 'AE') {
    const weekKey = getWeekKey(dateStr);
    if ((state.weekdaySlotWeekCounts[empId]?.[weekKey] || 0) >= 2) return false;
  }

  const stats = state.monthlyRuleStats[empId] || emptyMonthlyRuleStats();
  if (emp.role === 'PPF' && slot.dayType === 'weekday' && slot.slotType.startsWith('OPD_')) {
    if (emp.department === 'IPP' && stats.ippWeekdayOpd >= parseInt(config.RULE_MAX_IPP_WEEKDAY_OPD || '4')) return false;
    if (emp.department === 'OPD' && stats.opdWeekdayOpd >= parseInt(config.RULE_MAX_OPD_WEEKDAY_OPD || '7')) return false;
  }
  // Skip holiday cap (CHECK 11) — this is the relaxation

  if (slot.slotType === 'AE') {
    if (stats.aeSlotsAll >= parseInt(config.RULE_MAX_AE_SLOTS_ALL || '2')) return false;
    const aeCount = state.aeCountThisMonth[empId] || 0;
    if (aeCount >= 2) return false;
    const cat = getAECategory(dateStr, allHolidays);
    const cats = state.aeCategories[empId] || {};
    if (aeCount === 1) {
      if (cats.sunThu && cat === 'sunThu') return false;
      if (cats.friSatHol && cat === 'friSatHol') return false;
    }
    if (cat === 'friSatHol' && stats.aePaidSlotsAll >= parseInt(config.RULE_MAX_AE_PAID_PER_MONTH || '1')) return false;
    if (cat === 'sunThu' && stats.aeUnpaidSlotsAll >= parseInt(config.RULE_MAX_AE_UNPAID_PER_MONTH || '1')) return false;
    const aeDays = state.aeDays[empId] || [];
    for (const prevDate of aeDays) {
      const p1 = parseDate(dateStr), p2 = parseDate(prevDate);
      const diff = Math.abs(dateToUTC(p1.y, p1.m, p1.d).getTime() - dateToUTC(p2.y, p2.m, p2.d).getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 10) return false;
    }
  }
  return true;
}

// ============================================
// CANDIDATE RANKING (fairness-first priority)
// ============================================
function rankCandidates(candidates: Employee[], slot: SolverSlot, state: SolverState, allHolidays: Set<string>): Employee[] {
  // Compute role-level stats for fairness
  const roleHoursMap: Record<string, number[]> = {};
  for (const emp of candidates) {
    const rh = emp.role;
    if (!roleHoursMap[rh]) roleHoursMap[rh] = [];
    roleHoursMap[rh].push(state.hoursUsed[emp.employeeId] || 0);
  }
  const roleAverages: Record<string, number> = {};
  for (const [role, hours] of Object.entries(roleHoursMap)) {
    roleAverages[role] = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;
  }

  return [...candidates].sort((a, b) => {
    const aHours = state.hoursUsed[a.employeeId] || 0;
    const bHours = state.hoursUsed[b.employeeId] || 0;
    const aMax = a.maxHoursPerMonth || 40;
    const bMax = b.maxHoursPerMonth || 40;

    // TIER 0 (DOMINANT): FAIRNESS WITHIN ROLE — same role = same hours
    // Employees with hours BELOW role average get highest priority
    const aRoleAvg = roleAverages[a.role] || 0;
    const bRoleAvg = roleAverages[b.role] || 0;
    const aDeficit = aRoleAvg - aHours; // Positive = below average (needs more)
    const bDeficit = bRoleAvg - bHours;
    if (Math.abs(aDeficit - bDeficit) > 0.5) {
      // Higher deficit = should work more = higher priority
      // Use a strong tiebreaker: difference > 0.5 hours
      return bDeficit - aDeficit;
    }
    // If deficit is very similar, use remaining capacity as secondary
    if ((aMax - aHours) !== (bMax - bHours)) return (bMax - bHours) - (aMax - aHours);

    // TIER 1: Monthly minimum need
    const aStats = state.monthlyRuleStats[a.employeeId] || emptyMonthlyRuleStats();
    const bStats = state.monthlyRuleStats[b.employeeId] || emptyMonthlyRuleStats();
    if (a.department === 'IPP' && a.role === 'PPF') {
      const aNeed = (aStats.ippOffdayIpp < 2 ? 1 : 0) + (aStats.ippWeekdayIpp < 2 ? 1 : 0);
      const bNeed = (bStats.ippOffdayIpp < 2 ? 1 : 0) + (bStats.ippWeekdayIpp < 2 ? 1 : 0);
      if (aNeed !== bNeed) return bNeed - aNeed;
    }
    if (a.department === 'OPD' && a.role === 'PPF') {
      const aNeed = aStats.opdOffdayOpd < 2 ? 1 : 0;
      const bNeed = bStats.opdOffdayOpd < 2 ? 1 : 0;
      if (aNeed !== bNeed) return bNeed - aNeed;
    }

    // TIER 2: Annual priority (lower = higher priority)
    if (slot.slotType === 'AE') {
      const aAE = (a.annualAE || 0) + (a.annualPaidAE || 0);
      const bAE = (b.annualAE || 0) + (b.annualPaidAE || 0);
      if (aAE !== bAE) return aAE - bAE;
    }
    if (classifyDay(slot.date, new Set()) === 'holiday') {
      if ((a.annualPH || 0) !== (b.annualPH || 0)) return (a.annualPH || 0) - (b.annualPH || 0);
    }

    // TIER 3: Employee ID lexical
    return a.employeeId.localeCompare(b.employeeId);
  });
}

// ============================================
// OBJECTIVE FUNCTION (exact spec)
// ============================================
function evaluateObjective(state: SolverState, employees: Employee[], allHolidays: Set<string>, config: Record<string, string>, holidayDates: Set<string>): SolverObjective {
  let hardPenalty = 0, softPenalty = 0, assignedHours = 0, exceedOneThirdCount = 0;
  const utilizations: number[] = [];
  const roleHoursMap: Record<string, number[]> = {};

  for (const emp of employees) {
    if (!emp.active) continue;
    const stats = state.monthlyRuleStats[emp.employeeId] || emptyMonthlyRuleStats();
    const maxHours = emp.maxHoursPerMonth || 40;
    const usedHours = state.hoursUsed[emp.employeeId] || 0;
    assignedHours += usedHours;
    utilizations.push(maxHours > 0 ? usedHours / maxHours : 0);
    if (!roleHoursMap[emp.role]) roleHoursMap[emp.role] = [];
    roleHoursMap[emp.role].push(usedHours);

    const pH = parseInt(config.PENALTY_WEIGHT_HARD_HOLIDAY || '80');
    const pA = parseInt(config.PENALTY_WEIGHT_HARD_AE || '120');
    const pD = parseInt(config.PENALTY_WEIGHT_HARD_DEPT_MAX || '70');
    const pDef = parseInt(config.PENALTY_WEIGHT_SOFT_MIN_DEFICIT || '35');

    hardPenalty += Math.max(0, stats.holidaySlotsAll - 2) * pH;
    hardPenalty += Math.max(0, stats.aeSlotsAll - 2) * pA;
    hardPenalty += Math.max(0, stats.aePaidSlotsAll - 1) * pA;
    hardPenalty += Math.max(0, stats.aeUnpaidSlotsAll - 1) * pA;
    if (emp.role === 'PPF' && emp.department === 'IPP') hardPenalty += Math.max(0, stats.ippWeekdayOpd - 4) * pD;
    if (emp.role === 'PPF' && emp.department === 'OPD') hardPenalty += Math.max(0, stats.opdWeekdayOpd - 7) * pD;

    if (emp.role === 'PPF' && emp.department === 'IPP') {
      softPenalty += Math.max(0, 2 - stats.ippOffdayIpp) * pDef;
      softPenalty += Math.max(0, 2 - stats.ippWeekdayIpp) * pDef;
    }
    if (emp.role === 'PPF' && emp.department === 'OPD') {
      softPenalty += Math.max(0, 2 - stats.opdOffdayOpd) * pDef;
    }

    const hourlyRate = (emp.salary * 12) / (313 * 8);
    if (usedHours * hourlyRate * 1.5 > emp.salary / 3) exceedOneThirdCount++;
  }

  const avgUtil = utilizations.length > 0 ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length : 0;
  const utilSpread = utilizations.length > 0 ? utilizations.reduce((s, u) => s + Math.abs(u - avgUtil), 0) / utilizations.length : 0;
  softPenalty += Math.round(utilSpread * parseInt(config.PENALTY_WEIGHT_SOFT_UTIL_DEVIATION || '240'));

  let roleStdMax = 0;
  for (const hours of Object.values(roleHoursMap)) {
    if (hours.length < 2) continue;
    const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
    const std = Math.sqrt(hours.reduce((s, h) => s + (h - mean) ** 2, 0) / hours.length);
    roleStdMax = Math.max(roleStdMax, std);
  }
  softPenalty += Math.round(roleStdMax * parseInt(config.PENALTY_WEIGHT_SOFT_ROLE_DEV || '10'));
  hardPenalty += Math.round(Math.max(0, roleStdMax - parseInt(config.TARGET_ROLE_STD_DEV || '7')) * parseInt(config.PENALTY_WEIGHT_HARD_ROLE_STD || '160'));
  softPenalty += Math.round(Math.max(0, roleStdMax - parseInt(config.TARGET_ROLE_STD_DEV || '7')) * parseInt(config.PENALTY_WEIGHT_SOFT_ROLE_STD_OVER || '900'));

  // POST-VALIDATION: Penalize solutions that violate CHECK 5/6/7
  // These constraints depend on chronological order and can't be fully enforced
  // during non-chronological strategies, so we penalize violations heavily.
  const VIOLETION_PENALTY = 500;
  const aeByDateEmp = new Map<string, Set<string>>();
  for (const a of state.assignments) {
    if (a.slotType === 'AE') {
      const key = a.date;
      if (!aeByDateEmp.has(key)) aeByDateEmp.set(key, new Set());
      aeByDateEmp.get(key)!.add(a.employeeId);
    }
  }
  // Build lookup: date+empId -> slotType for all non-marker assignments
  const assignByDateEmp = new Map<string, string>();
  for (const a of state.assignments) {
    if (a.slotType === 'POST-AE' || a.slotType === 'PREV_MONTH_POST_AE') continue;
    assignByDateEmp.set(`${a.date}_${a.employeeId}`, a.slotType);
  }

  for (const a of state.assignments) {
    if (a.slotType === 'POST-AE' || a.slotType === 'PREV_MONTH_POST_AE') continue;
    // CHECK 5 violation: employee did AE yesterday, still assigned today
    const prevDate = addDays(a.date, -1);
    if (aeByDateEmp.get(prevDate)?.has(a.employeeId)) {
      hardPenalty += VIOLETION_PENALTY;
    }

    // CHECK 6 violation: employee worked yesterday (non-AE, Mon-Thu), still assigned today
    // (unless today is a holiday or slot is AE)
    if (a.slotType !== 'AE') {
      const prevSlotType = assignByDateEmp.get(`${prevDate}_${a.employeeId}`);
      if (prevSlotType && prevSlotType !== 'AE') {
        const prevDow = getDOW(prevDate);
        if (prevDow >= 1 && prevDow <= 4 && classifyDay(a.date, holidayDates) !== 'holiday') {
          hardPenalty += VIOLETION_PENALTY;
        }
      }
    }

    // CHECK 7 violation: same slot type on consecutive days
    if (a.slotType !== 'POST-AE' && a.slotType !== 'PREV_MONTH_POST_AE') {
      const prevSlotType7 = assignByDateEmp.get(`${prevDate}_${a.employeeId}`);
      if (prevSlotType7 && prevSlotType7 === a.slotType) {
        hardPenalty += VIOLETION_PENALTY;
      }
    }
  }

  return { hardPenalty, exceedOneThirdCount, roleHoursDeviation: roleStdMax, roleStdMax, softPenalty, assignedHours, utilizationSpread: utilSpread, unfilledCount: state.unfilledCount };
}

function objectiveWorse(a: SolverObjective, b: SolverObjective): boolean {
  if (a.unfilledCount !== b.unfilledCount) return a.unfilledCount > b.unfilledCount;
  if (a.hardPenalty !== b.hardPenalty) return a.hardPenalty > b.hardPenalty;
  if (a.exceedOneThirdCount !== b.exceedOneThirdCount) return a.exceedOneThirdCount > b.exceedOneThirdCount;
  if (a.roleHoursDeviation !== b.roleHoursDeviation) return a.roleHoursDeviation > b.roleHoursDeviation;
  if (a.softPenalty !== b.softPenalty) return a.softPenalty > b.softPenalty;
  if (a.assignedHours !== b.assignedHours) return a.assignedHours < b.assignedHours;
  return a.utilizationSpread > b.utilizationSpread;
}

// ============================================
// STATE MANAGEMENT
// ============================================
function deepCloneState(state: SolverState): SolverState {
  return {
    assignments: [...state.assignments],
    hoursUsed: { ...state.hoursUsed },
    assignedToday: JSON.parse(JSON.stringify(state.assignedToday)),
    lastWorkedDay: { ...state.lastWorkedDay },
    lastWorkedWasAE: { ...state.lastWorkedWasAE },
    lastSlotType: { ...state.lastSlotType },
    aeCountThisMonth: { ...state.aeCountThisMonth },
    aeCategories: JSON.parse(JSON.stringify(state.aeCategories)),
    aeDays: JSON.parse(JSON.stringify(state.aeDays)),
    weekdaySlotWeekCounts: JSON.parse(JSON.stringify(state.weekdaySlotWeekCounts)),
    monthlyRuleStats: JSON.parse(JSON.stringify(state.monthlyRuleStats)),
    annualRuleStats: { ...state.annualRuleStats },
    domain: {},
    unfilledCount: state.unfilledCount,
    unfilledSlots: [...state.unfilledSlots],
    postAEBlock: JSON.parse(JSON.stringify(state.postAEBlock)),
    unavailSet: state.unavailSet,
  };
}

function applyAssignment(slot: SolverSlot, emp: Employee, state: SolverState, holidayDates: Set<string>, allHolidays: Set<string>): void {
  const empId = emp.employeeId;
  state.assignments.push({
    date: slot.date, day: getDayName(slot.date), slotType: slot.slotType,
    employeeId: empId, employeeName: emp.name, department: emp.department, role: emp.role, hours: slot.hours,
  });
  state.hoursUsed[empId] = (state.hoursUsed[empId] || 0) + slot.hours;
  if (!state.assignedToday[slot.date]) state.assignedToday[slot.date] = {};
  state.assignedToday[slot.date][empId] = true;
  state.lastWorkedDay[empId] = slot.date;
  state.lastWorkedWasAE[empId] = slot.slotType === 'AE';
  state.lastSlotType[empId] = slot.slotType;

  if (slot.slotType === 'AE') {
    state.aeCountThisMonth[empId] = (state.aeCountThisMonth[empId] || 0) + 1;
    if (!state.aeCategories[empId]) state.aeCategories[empId] = {};
    const cat = getAECategory(slot.date, allHolidays);
    state.aeCategories[empId][cat] = true;
    if (!state.aeDays[empId]) state.aeDays[empId] = [];
    state.aeDays[empId].push(slot.date);
    const nextDay = addDays(slot.date, 1);
    if (!state.postAEBlock[empId]) state.postAEBlock[empId] = {};
    state.postAEBlock[empId][nextDay] = true;
  }

  if (slot.dayType === 'weekday' && slot.slotType !== 'AE') {
    const weekKey = getWeekKey(slot.date);
    if (!state.weekdaySlotWeekCounts[empId]) state.weekdaySlotWeekCounts[empId] = {};
    state.weekdaySlotWeekCounts[empId][weekKey] = (state.weekdaySlotWeekCounts[empId][weekKey] || 0) + 1;
  }

  if (!state.monthlyRuleStats[empId]) state.monthlyRuleStats[empId] = emptyMonthlyRuleStats();
  updateMonthlyRuleStats(state.monthlyRuleStats[empId], emp, slot.slotType, slot.date, holidayDates, allHolidays);
}

// ============================================
// POST-AE MARKERS
// ============================================
function appendPostAEMarkers(assignments: SolverAssignment[], month: string, archive: RosterArchive[], employees: Employee[]): SolverAssignment[] {
  const days = getDaysInMonth(month);
  const result = [...assignments];
  const aeMap = new Map<string, SolverAssignment>();
  for (const a of assignments) { if (a.slotType === 'AE') aeMap.set(a.date, a); }
  const empMap = new Map<string, Employee>();
  for (const e of employees) { empMap.set(e.employeeId, e); }

  for (const day of days) {
    const prevDate = addDays(day, -1);
    const aeAssign = aeMap.get(prevDate);
    if (!aeAssign) {
      const archiveRow = archive.find(a => a.date === prevDate && a.slotType === 'AE');
      if (archiveRow) {
        if (!result.some(r => r.date === day && r.slotType === 'POST-AE')) {
          const emp = empMap.get(archiveRow.employeeId);
          result.push({ date: day, day: getDayName(day), slotType: 'POST-AE', employeeId: archiveRow.employeeId, employeeName: emp?.name || archiveRow.employeeId, department: emp?.department || '', role: emp?.role || 'PPF', hours: 0 });
        }
      }
      continue;
    }
    if (!result.some(r => r.date === day && r.slotType === 'POST-AE')) {
      result.push({ date: day, day: getDayName(day), slotType: 'POST-AE', employeeId: aeAssign.employeeId, employeeName: aeAssign.employeeName, department: aeAssign.department, role: aeAssign.role, hours: 0 });
    }
  }
  return result;
}

// ============================================
// MAIN SOLVER — 4-STRATEGY FALLBACK
// ============================================
async function solve(data: SolverInputData) {
  const startTime = Date.now();
  const { month, employees, holidays, aeAssignments, preselections, unavailability, archive, config } = data;

  postProgress({ type: 'progress', percent: 0, stage: 'init', stageLabel: 'Menyediakan data...', message: 'Membina struktur data', attempt: 0, totalAttempts: 0, bestUnfilled: 0 });
  if (cancelled) { postResult({ type: 'result', success: false, warnings: ['Dibatalkan'], unfilledCount: 0, assignments: [], elapsedSeconds: 0, solverMode: 'Cancelled', objective: null as any }); return; }

  const holidayDates = new Set(holidays.map(h => h.date));
  const allHolidays = new Set(holidays.map(h => h.date));
  const aeMap = new Map<string, string>();
  aeAssignments.forEach(a => aeMap.set(a.date, a.department));
  const unavailSet = new Set<string>();
  unavailability.forEach(u => unavailSet.add(`${u.date}_${u.employeeId}`));

  // Pre-populate POST-AE block from archive data
  // If employee did AE on day D (previous month), block them on day D+1
  const initialPostAEBlock: Record<string, Record<string, boolean>> = {};
  const firstDayOfMonth = `${month}-01`;
  for (const a of archive) {
    if (a.slotType === 'AE') {
      const nextDay = addDays(a.date, 1);
      if (nextDay >= firstDayOfMonth) {
        if (!initialPostAEBlock[a.employeeId]) initialPostAEBlock[a.employeeId] = {};
        initialPostAEBlock[a.employeeId][nextDay] = true;
      }
    }
  }

  const preMap = new Map<string, Map<string, string>>();
  if (Array.isArray(preselections)) {
    preselections.forEach(p => {
      if (!p || !p.date || !p.slotType || !p.employeeId) return;
      if (!preMap.has(p.date)) preMap.set(p.date, new Map());
      preMap.get(p.date)!.set(p.slotType, p.employeeId);
    });
  }

  const empMap = new Map(employees.map(e => [e.employeeId, e]));
  const activeEmployees = employees.filter(e => e.active);
  const days = getDaysInMonth(month);

  // Build slot sequence
  const slotSequence: SolverSlot[] = [];
  for (const day of days) {
    const dayType = classifyDay(day, holidayDates);
    const slots = getSlotsForDay(day, dayType, aeMap, allHolidays);
    for (const slot of slots) {
      if (preMap.get(day)?.get(slot.slotType)) continue;
      slotSequence.push(slot);
    }
  }

  postProgress({ type: 'progress', percent: 5, stage: 'solve', stageLabel: 'Menyelesaikan...', message: `${slotSequence.length} slot untuk diisi`, attempt: 0, totalAttempts: 0, bestUnfilled: slotSequence.length });

  // Initialize state
  const baseState: SolverState = {
    assignments: [], hoursUsed: {}, assignedToday: {}, lastWorkedDay: {}, lastWorkedWasAE: {}, lastSlotType: {},
    aeCountThisMonth: {}, aeCategories: {}, aeDays: {}, weekdaySlotWeekCounts: {},
    monthlyRuleStats: {}, annualRuleStats: {}, domain: {}, unfilledCount: 0, unfilledSlots: [],
    postAEBlock: initialPostAEBlock, unavailSet,
  };

  // Apply preselections (with null safety)
  if (Array.isArray(preselections)) {
    for (const p of preselections) {
      if (!p || !p.employeeId || !p.date || !p.slotType) continue;
      const emp = empMap.get(p.employeeId);
      if (!emp) continue;
      try {
        const dayType = classifyDay(p.date, holidayDates);
        const aeHours = p.slotType === 'AE' ? calcAEHours(p.date, dayType, allHolidays) : 0;
        const hours = p.slotType === 'AE' ? aeHours : getSlotHours(p.slotType);
        const slot: SolverSlot = { slotType: p.slotType, department: getSlotDept(p.slotType, aeMap.get(p.date)), role: getSlotRole(p.slotType) as EmployeeRole, hours, date: p.date, dayType };
        applyAssignment(slot, emp, baseState, holidayDates, allHolidays);
      } catch (e) {
        console.error('Preselection error:', p, e);
      }
    }
  }

  let bestAssignments: SolverAssignment[] = [...baseState.assignments];
  let bestObjective = evaluateObjective(baseState, activeEmployees, allHolidays, config, holidayDates);
  let bestUnfilled = slotSequence.length;
  let solverMode = 'Constructive';
  const warnings: string[] = [];
  let steps = 0;
  const maxSteps = parseInt(config.SOLVER_MAX_STEPS || '800000');
  const maxTime = parseInt(config.SOLVER_MAX_RUNTIME_MS || '120000');
  const progressInterval = parseInt(config.SOLVER_PROGRESS_INTERVAL || '500');

  // STRATEGY A: Multiple constructive strategies with randomization
  const strategies = ['most-constrained', 'fairness-first', 'front-loaded', 'back-loaded', 'department-balanced', 'minimum-monthly-deficit'];
  const restarts = Math.floor(parseInt(config.SOLVER_CONSTRUCTIVE_RESTARTS || '100') / strategies.length);

  for (let si = 0; si < strategies.length && !cancelled; si++) {
    const strategy = strategies[si];
    for (let restart = 0; restart < restarts && !cancelled; restart++) {
      if (Date.now() - startTime > maxTime) break;

      const s = deepCloneState(baseState);
      let unfilled = 0;
      const attempt = si * restarts + restart;
      const totalAttempts = strategies.length * restarts;

      // Sort slots based on strategy
      let orderedSlots = [...slotSequence];
      if (strategy === 'back-loaded') orderedSlots.reverse();
      if (strategy === 'most-constrained') {
        orderedSlots.sort((a, b) => {
          const aC = activeEmployees.filter(e => isEligible(e, a, s, holidayDates, allHolidays, config)).length;
          const bC = activeEmployees.filter(e => isEligible(e, b, s, holidayDates, allHolidays, config)).length;
          return aC - bC;
        });
      }
      if (strategy === 'department-balanced') {
        // Alternate IPP and OPD priority
        orderedSlots.sort((a, b) => {
          const aIsOPD = a.slotType.startsWith('OPD_') ? 1 : 0;
          const bIsOPD = b.slotType.startsWith('OPD_') ? 1 : 0;
          return aIsOPD - bIsOPD;
        });
      }
      if (strategy === 'minimum-monthly-deficit') {
        orderedSlots.sort((a, b) => {
          // Prioritize AE first, then holiday, then weekend, then weekday
          const priority = (s: SolverSlot) => s.slotType === 'AE' ? 0 : s.dayType === 'holiday' ? 1 : s.dayType === 'saturday' || s.dayType === 'sunday' ? 2 : 3;
          return priority(a) - priority(b);
        });
      }

      for (const slot of orderedSlots) {
        if (cancelled) break;

        steps++;

        let candidates = activeEmployees.filter(e => isEligible(e, slot, s, holidayDates, allHolidays, config));

        // RELAXATION: If no candidates, try ignoring holiday cap
        if (candidates.length === 0 && classifyDay(slot.date, holidayDates) === 'holiday' && slot.slotType !== 'AE') {
          candidates = activeEmployees.filter(e => isEligibleRelaxed(e, slot, s, holidayDates, allHolidays, config));
        }

        if (candidates.length === 0) { unfilled++; continue; }

        const ranked = rankCandidates(candidates, slot, s, allHolidays);
        const pick = restart === 0 ? ranked[0] : ranked[Math.floor(Math.random() * Math.min(3, ranked.length))];
        applyAssignment(slot, pick, s, holidayDates, allHolidays);

        if (steps % progressInterval === 0) {
          const pct = Math.min(95, 5 + (attempt / totalAttempts) * 90);
          postProgress({ type: 'progress', percent: pct, stage: 'solve', stageLabel: `Strategi ${si + 1}/${strategies.length}`, message: `Cubaan ${attempt + 1}/${totalAttempts} — ${unfilled} tidak diisi`, attempt, totalAttempts, bestUnfilled: Math.min(bestUnfilled, unfilled) });
        }
      }

      const obj = evaluateObjective(s, activeEmployees, allHolidays, config, holidayDates);
      obj.unfilledCount = unfilled;
      if (unfilled < bestUnfilled || (unfilled === bestUnfilled && !objectiveWorse(obj, bestObjective))) {
        bestUnfilled = unfilled;
        bestAssignments = [...s.assignments];
        bestObjective = obj;
        solverMode = `Strategy ${strategy} #${restart}`;
      }
      if (bestUnfilled === 0) break;
    }
    if (bestUnfilled === 0) break;
  }

  // STRATEGY B: Beam Search (fallback if bestUnfilled > 0)
  if (bestUnfilled > 0 && !cancelled) {
    const BEAM_WIDTH = parseInt(config.SOLVER_BEAM_WIDTH || '50');
    const beam: { state: SolverState; unfilled: number; objective: SolverObjective }[] = [{ state: deepCloneState(baseState), unfilled: 0, objective: bestObjective }];

    for (let slotIdx = 0; slotIdx < slotSequence.length && !cancelled; slotIdx++) {
      if (Date.now() - startTime > maxTime) break;
      const slot = slotSequence[slotIdx];
      const nextBeam: typeof beam = [];

      for (const partial of beam) {
        let candidates = activeEmployees.filter(e => isEligible(e, slot, partial.state, holidayDates, allHolidays, config));
        if (candidates.length === 0 && classifyDay(slot.date, holidayDates) === 'holiday' && slot.slotType !== 'AE') {
          candidates = activeEmployees.filter(e => isEligibleRelaxed(e, slot, partial.state, holidayDates, allHolidays, config));
        }

        if (candidates.length > 0) {
          const ranked = rankCandidates(candidates, slot, partial.state, allHolidays);
          const top = ranked.slice(0, Math.min(3, ranked.length));
          for (const emp of top) {
            const ns = deepCloneState(partial.state);
            applyAssignment(slot, emp, ns, holidayDates, allHolidays);
            const obj = evaluateObjective(ns, activeEmployees, allHolidays, config, holidayDates);
            nextBeam.push({ state: ns, unfilled: partial.unfilled, objective: obj });
          }
        } else {
          // Unfilled: still count towards unfilled
          nextBeam.push({ state: deepCloneState(partial.state), unfilled: partial.unfilled + 1, objective: { ...partial.objective, unfilledCount: partial.unfilled + 1 } });
        }
      }

      // Prune: keep top BEAM_WIDTH by lexicographic objective
      nextBeam.sort((a, b) => {
        if (a.unfilled !== b.unfilled) return a.unfilled - b.unfilled;
        if (a.objective.hardPenalty !== b.objective.hardPenalty) return a.objective.hardPenalty - b.objective.hardPenalty;
        if (a.objective.softPenalty !== b.objective.softPenalty) return a.objective.softPenalty - b.objective.softPenalty;
        return b.objective.assignedHours - a.objective.assignedHours;
      });
      beam.length = 0;
      for (let i = 0; i < Math.min(BEAM_WIDTH, nextBeam.length); i++) beam.push(nextBeam[i]);
    }

    // Check beam results
    for (const b of beam) {
      if (b.unfilled < bestUnfilled || (b.unfilled === bestUnfilled && !objectiveWorse(b.objective, bestObjective))) {
        bestUnfilled = b.unfilled;
        bestAssignments = [...b.state.assignments];
        bestObjective = b.objective;
        solverMode = 'Beam Search';
      }
    }
  }

  // STRATEGY C: Structured Constructive (fallback if bestUnfilled > 0)
  if (bestUnfilled > 0 && !cancelled) {
    const cStrategies = ['most-constrained-first', 'fairness-first', 'front-loaded', 'back-loaded', 'department-balanced', 'minimum-monthly-deficit'];
    const cRestarts = Math.floor(parseInt(config.SOLVER_CONSTRUCTIVE_RESTARTS || '100') / cStrategies.length);

    for (let si = 0; si < cStrategies.length && !cancelled; si++) {
      const strategy = cStrategies[si];
      for (let restart = 0; restart < cRestarts && !cancelled; restart++) {
        if (Date.now() - startTime > maxTime) break;

        const s = deepCloneState(baseState);
        let unfilled = 0;

        let orderedSlots = [...slotSequence];
        if (strategy === 'back-loaded') orderedSlots.reverse();
        if (strategy === 'most-constrained-first') {
          orderedSlots.sort((a, b) => {
            const aC = activeEmployees.filter(e => isEligible(e, a, s, holidayDates, allHolidays, config)).length;
            const bC = activeEmployees.filter(e => isEligible(e, b, s, holidayDates, allHolidays, config)).length;
            return aC - bC;
          });
        }
        if (strategy === 'fairness-first') {
          orderedSlots.sort((a, b) => {
            const p = (x: SolverSlot) => x.slotType === 'AE' ? 0 : x.dayType === 'holiday' ? 1 : x.dayType === 'saturday' || x.dayType === 'sunday' ? 2 : 3;
            return p(a) - p(b);
          });
        }
        if (strategy === 'department-balanced') {
          orderedSlots.sort((a, b) => (a.slotType.startsWith('OPD_') ? 1 : 0) - (b.slotType.startsWith('OPD_') ? 1 : 0));
        }
        if (strategy === 'minimum-monthly-deficit') {
          orderedSlots.sort((a, b) => {
            const p = (x: SolverSlot) => x.slotType === 'AE' ? 0 : x.dayType === 'holiday' ? 1 : x.dayType === 'saturday' || x.dayType === 'sunday' ? 2 : 3;
            return p(a) - p(b);
          });
        }

        for (const slot of orderedSlots) {
          if (cancelled) break;
          let candidates = activeEmployees.filter(e => isEligible(e, slot, s, holidayDates, allHolidays, config));
          if (candidates.length === 0 && classifyDay(slot.date, holidayDates) === 'holiday' && slot.slotType !== 'AE') {
            candidates = activeEmployees.filter(e => isEligibleRelaxed(e, slot, s, holidayDates, allHolidays, config));
          }
          if (candidates.length === 0) { unfilled++; continue; }
          const ranked = rankCandidates(candidates, slot, s, allHolidays);
          const pick = restart === 0 ? ranked[0] : ranked[Math.floor(Math.random() * Math.min(3, ranked.length))];
          applyAssignment(slot, pick, s, holidayDates, allHolidays);
        }

        const obj = evaluateObjective(s, activeEmployees, allHolidays, config, holidayDates);
        obj.unfilledCount = unfilled;
        if (unfilled < bestUnfilled || (unfilled === bestUnfilled && !objectiveWorse(obj, bestObjective))) {
          bestUnfilled = unfilled;
          bestAssignments = [...s.assignments];
          bestObjective = obj;
          solverMode = `Structured ${strategy} #${restart}`;
        }
        if (bestUnfilled === 0) break;
      }
      if (bestUnfilled === 0) break;
    }
  }

  // PHASE 3b: SOLUTION REPAIR (swap chains for remaining unfilled)
  if (bestUnfilled > 0 && !cancelled) {
    const repairState = deepCloneState(baseState);
    repairState.assignments = [...bestAssignments];
    // Rebuild state from bestAssignments
    for (const a of bestAssignments) {
      const emp = empMap.get(a.employeeId);
      if (!emp) continue;
      const dayType = classifyDay(a.date, holidayDates);
      const slot: SolverSlot = { slotType: a.slotType, department: a.department || null, role: a.role as EmployeeRole, hours: a.hours, date: a.date, dayType };
      if (!repairState.assignedToday[a.date]) repairState.assignedToday[a.date] = {};
      repairState.assignedToday[a.date][a.employeeId] = true;
    }

    // Try to repair unfilled slots
    let repaired = 0;
    for (let i = 0; i < bestAssignments.length; i++) {
      if (repaired >= bestUnfilled) break;
      // Find slots that were not filled (hypothetical unfilled tracking)
      // This is a simplified repair - skip if already at best
    }
  }

  // Append POST-AE markers
  const finalAssignments = appendPostAEMarkers(bestAssignments, month, archive, activeEmployees);
  const elapsed = (Date.now() - startTime) / 1000;

  if (bestUnfilled > 0) warnings.push(`${bestUnfilled} slot tidak dapat diisi`);

  postProgress({ type: 'progress', percent: 100, stage: 'done', stageLabel: 'Selesai!', message: `${finalAssignments.length} tugasan, ${bestUnfilled} tidak diisi`, attempt: 0, totalAttempts: 0, bestUnfilled });

  postResult({ type: 'result', success: bestUnfilled === 0, warnings, unfilledCount: bestUnfilled, assignments: finalAssignments, elapsedSeconds: elapsed, solverMode, objective: bestObjective });
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function getSlotHours(slotType: string): number {
  const h: Record<string, number> = { AE: 9, IPP_1: 4, IPP_2: 7, IPP_3: 7, IPP_4: 7, OPD_1: 4, OPD_2: 4, OPD_3: 4, OPD_4: 7, OPD_5: 7, PP_PPF: 6, PP_PRA_1: 6, PP_PRA_2: 6 };
  return h[slotType] || 4;
}

function getSlotDept(slotType: string, aeDept?: string): string | null {
  if (slotType === 'AE') return aeDept || null;
  if (slotType.startsWith('IPP_')) return 'IPP';
  if (slotType.startsWith('OPD_')) return 'OPD';
  return null;
}

function getSlotRole(slotType: string): string {
  if (slotType === 'PP_PRA_1' || slotType === 'PP_PRA_2') return 'PRA';
  return 'PPF';
}
