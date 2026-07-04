// ============================================
// ROSTER SOLVER WEB WORKER
// Runs entirely client-side to avoid Vercel timeout
// ============================================

import type {
  SolverInputData, SolverProgress, SolverResult, SolverAssignment,
  SolverSlot, SolverState, MonthlyRuleStats, AnnualCounters, SolverObjective,
  Employee, Holiday, AEAssignment, Preselection, Unavailability, RosterArchive,
  DayType, EmployeeRole,
} from '../types';

let cancelled = false;

self.onmessage = (e: MessageEvent) => {
  if (e.data.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (e.data.type === 'start') {
    cancelled = false;
    solve(e.data.data as SolverInputData);
  }
};

function postProgress(p: SolverProgress) {
  self.postMessage(p);
}

function postResult(r: SolverResult) {
  self.postMessage(r);
}

// ============================================
// DAY CLASSIFICATION
// ============================================
function classifyDay(dateStr: string, holidayDates: Set<string>): DayType {
  if (holidayDates.has(dateStr)) return 'holiday';
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday';
}

function classifyDayKind(dateStr: string, allHolidays: Set<string>): string {
  if (allHolidays.has(dateStr)) return 'holiday';
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return 'weekend';
  return 'weekday';
}

function getDOW(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getDay();
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getDaysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const days: string[] = [];
  for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
    days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function getDayName(dateStr: string): string {
  const names = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  return names[new Date(dateStr + 'T00:00:00').getDay()];
}

// ============================================
// AE HOURS CALCULATION
// ============================================
function calcAEHours(dateStr: string, dayType: DayType, allHolidays: Set<string>): number {
  const dow = getDOW(dateStr);
  if (dow >= 1 && dow <= 4) return 0; // Mon-Thu
  if (dow === 5) return 9; // Friday
  if (dow === 6) return 9; // Saturday
  // Sunday or Holiday
  const nextDay = addDays(dateStr, 1);
  const nextDow = getDOW(nextDay);
  const nextIsHoliday = allHolidays.has(nextDay);
  if (dayType === 'sunday') return nextIsHoliday ? 9 : 2;
  // Holiday
  const nextIsFriSatSunHol = (nextDow === 5 || nextDow === 6 || nextDow === 0 || nextIsHoliday);
  return nextIsFriSatSunHol ? 9 : 2;
}

function getAECategory(dateStr: string, allHolidays: Set<string>): string {
  const tomorrow = addDays(dateStr, 1);
  if (allHolidays.has(tomorrow)) return 'friSatHol';
  const dow = getDOW(dateStr);
  if (dow === 5) return 'friSatHol';
  if (dow === 6) return 'friSatHol';
  return 'sunThu';
}

// ============================================
// SLOT TEMPLATES
// ============================================
function getSlotsForDay(dateStr: string, dayType: DayType, aeMap: Map<string, string>, allHolidays: Set<string>, holidayDates: Set<string>): SolverSlot[] {
  const slots: SolverSlot[] = [];
  const aeDept = aeMap.get(dateStr);

  // AE slot - only if department assigned AND day has AE hours > 0
  if (aeDept) {
    const aeHours = calcAEHours(dateStr, dayType, allHolidays);
    if (aeHours > 0) {
      slots.push({ slotType: 'AE', department: aeDept, role: 'PPF', hours: aeHours, date: dateStr, dayType });
    }
  }

  if (dayType === 'weekday') {
    slots.push({ slotType: 'IPP_1', department: 'IPP', role: 'PPF', hours: 4, date: dateStr, dayType });
    // Weekday OPD mix: 3 OPD slots, mix mode
    slots.push({ slotType: 'OPD_1', department: 'OPD', role: 'PPF', hours: 4, date: dateStr, dayType });
    slots.push({ slotType: 'OPD_2', department: 'OPD', role: 'PPF', hours: 4, date: dateStr, dayType });
    slots.push({ slotType: 'OPD_3', department: 'OPD', role: 'PPF', hours: 4, date: dateStr, dayType });
  } else {
    // Saturday/Sunday/Holiday
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
  return {
    ippOffdayIpp: 0, ippWeekdayIpp: 0, ippWeekdayOpd: 0,
    opdOffdayOpd: 0, opdWeekdayOpd: 0,
    holidaySlotsAll: 0, aeSlotsAll: 0, aePaidSlotsAll: 0, aeUnpaidSlotsAll: 0,
  };
}

function updateMonthlyRuleStats(stats: MonthlyRuleStats, emp: Employee, slotType: string, dateStr: string, holidayDates: Set<string>, allHolidays: Set<string>): void {
  const dayType = classifyDay(dateStr, holidayDates);
  const isWeekday = dayType === 'weekday';
  const isHoliday = dayType === 'holiday';

  if (slotType === 'AE') {
    stats.aeSlotsAll++;
    const cat = getAECategory(dateStr, allHolidays);
    if (cat === 'friSatHol') stats.aePaidSlotsAll++;
    else stats.aeUnpaidSlotsAll++;
    return;
  }

  if (isHoliday) stats.holidaySlotsAll++;

  if (emp.department === 'IPP' && emp.role === 'PPF') {
    if (slotType.startsWith('IPP_')) {
      if (isWeekday) stats.ippWeekdayIpp++;
      else stats.ippOffdayIpp++;
    } else if (slotType.startsWith('OPD_')) {
      if (isWeekday) stats.ippWeekdayOpd++;
    }
  }

  if (emp.department === 'OPD' && emp.role === 'PPF') {
    if (slotType.startsWith('OPD_')) {
      if (isWeekday) stats.opdWeekdayOpd++;
      else stats.opdOffdayOpd++;
    }
  }
}

// ============================================
// ELIGIBILITY ENGINE (18 CONSTRAINTS)
// ============================================
function isEligible(
  emp: Employee, slot: SolverSlot, state: SolverState,
  holidayDates: Set<string>, allHolidays: Set<string>, config: Record<string, string>
): { eligible: boolean; reason: string } {
  const empId = emp.employeeId;
  const dateStr = slot.date;

  // CHECK 1: ROLE MATCH
  if (slot.slotType === 'PP_PRA_1' || slot.slotType === 'PP_PRA_2') {
    if (emp.role !== 'PRA') return { eligible: false, reason: 'Jawatan tidak sepadan' };
  } else {
    if (emp.role !== 'PPF') return { eligible: false, reason: 'Jawatan tidak sepadan' };
  }

  // CHECK 2: DEPARTMENT MATCH
  if (slot.slotType === 'AE') {
    // AE: employee department must match ae assignment
  } else if (slot.slotType.startsWith('IPP_')) {
    if (emp.department !== 'IPP') return { eligible: false, reason: 'Unit tidak sepadan' };
  } else if (slot.slotType.startsWith('OPD_') && classifyDay(dateStr, holidayDates) !== 'weekday') {
    if (emp.department !== 'OPD') return { eligible: false, reason: 'Unit tidak sepadan' };
  }

  // CHECK 3: ONE SLOT PER DAY
  if (state.assignedToday[dateStr]?.[empId]) return { eligible: false, reason: 'Sudah ditugaskan pada hari ini' };

  // CHECK 4: UNAVAILABILITY
  if (state.unavailSet?.has(`${dateStr}_${empId}`)) return { eligible: false, reason: 'Memohon untuk tidak OT' };

  // CHECK 5: POST-AE NEXT-DAY BLOCK
  if (state.postAEBlock[empId]?.[dateStr]) return { eligible: false, reason: 'Sudah bertugas AE semalam' };

  // CHECK 6 & 7: CONSECUTIVE DAY / SAME SLOT
  const lastDay = state.lastWorkedDay[empId];
  if (lastDay) {
    const yesterday = addDays(dateStr, -1);
    if (lastDay === yesterday) {
      if (!state.lastWorkedWasAE[empId]) {
        const yDow = getDOW(yesterday);
        if (yDow >= 1 && yDow <= 4 && classifyDay(dateStr, holidayDates) !== 'holiday' && slot.slotType !== 'AE') {
          return { eligible: false, reason: 'Peraturan berturutan: kerja Isnin-Khamis semalam' };
        }
      }
      if (state.lastSlotType[empId] === slot.slotType) {
        return { eligible: false, reason: 'Tidak boleh slot sama dua hari berturutan' };
      }
    }
  }

  // CHECK 8: MONTHLY MAX HOURS
  const maxHours = emp.maxHoursPerMonth || 40;
  if ((state.hoursUsed[empId] || 0) + slot.hours > maxHours) {
    return { eligible: false, reason: 'Melebihi jam maksimum bulanan' };
  }

  // CHECK 9: WEEKLY WEEKDAY CAP
  if (slot.dayType === 'weekday' && slot.slotType !== 'AE') {
    const weekKey = getWeekKey(dateStr);
    if ((state.weekdaySlotWeekCounts[empId]?.[weekKey] || 0) >= 2) {
      return { eligible: false, reason: 'Had maksimum 2 hari weekday' };
    }
  }

  // CHECK 10: MONTHLY DEPT DISTRIBUTION
  const stats = state.monthlyRuleStats[empId];
  if (emp.role === 'PPF' && slot.dayType === 'weekday' && slot.slotType.startsWith('OPD_')) {
    if (emp.department === 'IPP' && stats.ippWeekdayOpd >= parseInt(config.RULE_MAX_IPP_WEEKDAY_OPD || '4')) {
      return { eligible: false, reason: 'Had OPD weekday IPP (4)' };
    }
    if (emp.department === 'OPD' && stats.opdWeekdayOpd >= parseInt(config.RULE_MAX_OPD_WEEKDAY_OPD || '7')) {
      return { eligible: false, reason: 'Had OPD weekday OPD (7)' };
    }
  }

  // CHECK 11: HOLIDAY SLOT CAP
  if (classifyDay(dateStr, holidayDates) === 'holiday' && slot.slotType !== 'AE') {
    if (stats.holidaySlotsAll >= parseInt(config.RULE_MAX_HOLIDAY_SLOTS_ALL || '2')) {
      return { eligible: false, reason: 'Had slot Cuti Umum (2)' };
    }
  }

  // CHECK 12: AE MONTHLY CAP
  if (slot.slotType === 'AE') {
    if (stats.aeSlotsAll >= parseInt(config.RULE_MAX_AE_SLOTS_ALL || '2')) {
      return { eligible: false, reason: 'Had AE bulanan (2)' };
    }
  }

  // CHECK 13: AE SPECIFIC
  if (slot.slotType === 'AE') {
    const aeCount = state.aeCountThisMonth[empId] || 0;
    if (aeCount >= 2) return { eligible: false, reason: 'Had AE bulanan (2)' };

    const cat = getAECategory(dateStr, allHolidays);
    const cats = state.aeCategories[empId] || {};
    if (aeCount === 1) {
      // Second AE must be opposite category
      if (cats.sunThu && cat === 'sunThu') return { eligible: false, reason: 'Kategori AE sama' };
      if (cats.friSatHol && cat === 'friSatHol') return { eligible: false, reason: 'Kategori AE sama' };
    }

    // Paid/Unpaid cap
    if (cat === 'friSatHol' && stats.aePaidSlotsAll >= parseInt(config.RULE_MAX_AE_PAID_PER_MONTH || '1')) {
      return { eligible: false, reason: 'Had AE bergaji (1)' };
    }
    if (cat === 'sunThu' && stats.aeUnpaidSlotsAll >= parseInt(config.RULE_MAX_AE_UNPAID_PER_MONTH || '1')) {
      return { eligible: false, reason: 'Had AE tidak bergaji (1)' };
    }

    // 10-day gap
    const aeDays = state.aeDays[empId] || [];
    for (const prevDate of aeDays) {
      const diff = Math.abs(new Date(dateStr + 'T00:00:00').getTime() - new Date(prevDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24);
      if (diff < 10) return { eligible: false, reason: 'Jurang AE kurang 10 hari' };
    }
  }

  return { eligible: true, reason: '' };
}

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ============================================
// CANDIDATE RANKING
// ============================================
function rankCandidates(candidates: Employee[], slot: SolverSlot, state: SolverState, allHolidays: Set<string>): Employee[] {
  return [...candidates].sort((a, b) => {
    const aStats = state.monthlyRuleStats[a.employeeId];
    const bStats = state.monthlyRuleStats[b.employeeId];
    const aHours = state.hoursUsed[a.employeeId] || 0;
    const bHours = state.hoursUsed[b.employeeId] || 0;
    const aMax = a.maxHoursPerMonth || 40;
    const bMax = b.maxHoursPerMonth || 40;

    // TIER 1: Annual Priority (lower count = higher priority)
    if (slot.slotType === 'AE') {
      const aAE = (a.annualAE || 0) + (a.annualPaidAE || 0);
      const bAE = (b.annualAE || 0) + (b.annualPaidAE || 0);
      if (aAE !== bAE) return aAE - bAE;
    }
    if (classifyDay(slot.date, new Set()) === 'holiday') {
      if ((a.annualPH || 0) !== (b.annualPH || 0)) return (a.annualPH || 0) - (b.annualPH || 0);
    }

    // TIER 2: Role mean hours deficit
    const aRemaining = aMax - aHours;
    const bRemaining = bMax - bHours;
    if (aRemaining !== bRemaining) return bRemaining - aRemaining; // Higher remaining = higher priority

    // TIER 3: Employee ID lexical
    return a.employeeId.localeCompare(b.employeeId);
  });
}

// ============================================
// OBJECTIVE FUNCTION
// ============================================
function evaluateObjective(state: SolverState, employees: Employee[], allHolidays: Set<string>, config: Record<string, string>): SolverObjective {
  let hardPenalty = 0;
  let softPenalty = 0;
  let assignedHours = 0;
  let exceedOneThirdCount = 0;
  const utilizations: number[] = [];
  const roleHoursMap: Record<string, number[]> = {};

  for (const emp of employees) {
    if (!emp.active) continue;
    const stats = state.monthlyRuleStats[emp.employeeId];
    const maxHours = emp.maxHoursPerMonth || 40;
    const usedHours = state.hoursUsed[emp.employeeId] || 0;
    assignedHours += usedHours;
    utilizations.push(maxHours > 0 ? usedHours / maxHours : 0);

    if (!roleHoursMap[emp.role]) roleHoursMap[emp.role] = [];
    roleHoursMap[emp.role].push(usedHours);

    // Hard penalties
    const pHoliday = parseInt(config.PENALTY_WEIGHT_HARD_HOLIDAY || '80');
    const pAE = parseInt(config.PENALTY_WEIGHT_HARD_AE || '120');
    const pDept = parseInt(config.PENALTY_WEIGHT_HARD_DEPT_MAX || '70');

    hardPenalty += Math.max(0, stats.holidaySlotsAll - 2) * pHoliday;
    hardPenalty += Math.max(0, stats.aeSlotsAll - 2) * pAE;
    hardPenalty += Math.max(0, stats.aePaidSlotsAll - 1) * pAE;
    hardPenalty += Math.max(0, stats.aeUnpaidSlotsAll - 1) * pAE;

    if (emp.role === 'PPF' && emp.department === 'IPP') {
      hardPenalty += Math.max(0, stats.ippWeekdayOpd - 4) * pDept;
    }
    if (emp.role === 'PPF' && emp.department === 'OPD') {
      hardPenalty += Math.max(0, stats.opdWeekdayOpd - 7) * pDept;
    }

    // Soft penalties - monthly minimum deficits
    const pDeficit = parseInt(config.PENALTY_WEIGHT_SOFT_MIN_DEFICIT || '35');
    if (emp.role === 'PPF' && emp.department === 'IPP') {
      softPenalty += Math.max(0, 2 - stats.ippOffdayIpp) * pDeficit;
      softPenalty += Math.max(0, 2 - stats.ippWeekdayIpp) * pDeficit;
    }
    if (emp.role === 'PPF' && emp.department === 'OPD') {
      softPenalty += Math.max(0, 2 - stats.opdOffdayOpd) * pDeficit;
    }

    // Exceed 1/3 salary
    const hourlyRate = (emp.salary * 12) / (313 * 8);
    if (usedHours * hourlyRate * 1.5 > emp.salary / 3) {
      exceedOneThirdCount++;
    }
  }

  // Utilization deviation
  const avgUtil = utilizations.length > 0 ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length : 0;
  const utilSpread = utilizations.length > 0 ? utilizations.reduce((s, u) => s + Math.abs(u - avgUtil), 0) / utilizations.length : 0;
  softPenalty += Math.round(utilSpread * parseInt(config.PENALTY_WEIGHT_SOFT_UTIL_DEVIATION || '240'));

  // Role hours deviation
  let roleStdMax = 0;
  for (const hours of Object.values(roleHoursMap)) {
    if (hours.length < 2) continue;
    const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
    const variance = hours.reduce((s, h) => s + (h - mean) ** 2, 0) / hours.length;
    const std = Math.sqrt(variance);
    roleStdMax = Math.max(roleStdMax, std);
  }
  softPenalty += Math.round(roleStdMax * parseInt(config.PENALTY_WEIGHT_SOFT_ROLE_DEV || '10'));
  hardPenalty += Math.round(Math.max(0, roleStdMax - parseInt(config.TARGET_ROLE_STD_DEV || '7')) * parseInt(config.PENALTY_WEIGHT_HARD_ROLE_STD || '160'));
  softPenalty += Math.round(Math.max(0, roleStdMax - parseInt(config.TARGET_ROLE_STD_DEV || '7')) * parseInt(config.PENALTY_WEIGHT_SOFT_ROLE_STD_OVER || '900'));

  return {
    hardPenalty,
    exceedOneThirdCount,
    roleHoursDeviation: roleStdMax,
    roleStdMax,
    softPenalty,
    assignedHours,
    utilizationSpread: utilSpread,
    unfilledCount: state.unfilledCount,
  };
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

  // Add assignment
  state.assignments.push({
    date: slot.date,
    day: getDayName(slot.date),
    slotType: slot.slotType,
    employeeId: empId,
    employeeName: emp.name,
    department: emp.department,
    role: emp.role,
    hours: slot.hours,
  });

  // Update hours
  state.hoursUsed[empId] = (state.hoursUsed[empId] || 0) + slot.hours;

  // Update assigned today
  if (!state.assignedToday[slot.date]) state.assignedToday[slot.date] = {};
  state.assignedToday[slot.date][empId] = true;

  // Update last worked
  state.lastWorkedDay[empId] = slot.date;
  state.lastWorkedWasAE[empId] = slot.slotType === 'AE';
  state.lastSlotType[empId] = slot.slotType;

  // Update AE tracking
  if (slot.slotType === 'AE') {
    state.aeCountThisMonth[empId] = (state.aeCountThisMonth[empId] || 0) + 1;
    if (!state.aeCategories[empId]) state.aeCategories[empId] = {};
    const cat = getAECategory(slot.date, allHolidays);
    state.aeCategories[empId][cat] = true;
    if (!state.aeDays[empId]) state.aeDays[empId] = [];
    state.aeDays[empId].push(slot.date);

    // Post-AE block next day
    const nextDay = addDays(slot.date, 1);
    if (!state.postAEBlock[empId]) state.postAEBlock[empId] = {};
    state.postAEBlock[empId][nextDay] = true;
  }

  // Update weekday week counts
  if (slot.dayType === 'weekday' && slot.slotType !== 'AE') {
    const weekKey = getWeekKey(slot.date);
    if (!state.weekdaySlotWeekCounts[empId]) state.weekdaySlotWeekCounts[empId] = {};
    state.weekdaySlotWeekCounts[empId][weekKey] = (state.weekdaySlotWeekCounts[empId][weekKey] || 0) + 1;
  }

  // Update monthly rule stats
  if (!state.monthlyRuleStats[empId]) state.monthlyRuleStats[empId] = emptyMonthlyRuleStats();
  updateMonthlyRuleStats(state.monthlyRuleStats[empId], emp, slot.slotType, slot.date, holidayDates, allHolidays);
}

// ============================================
// POST-AE MARKERS
// ============================================
function appendPostAEMarkers(assignments: SolverAssignment[], month: string, archive: RosterArchive[]): SolverAssignment[] {
  const days = getDaysInMonth(month);
  const result = [...assignments];
  const aeAssignments = new Map<string, SolverAssignment>();

  // From current assignments
  for (const a of assignments) {
    if (a.slotType === 'AE') aeAssignments.set(a.date, a);
  }

  // Check each day for POST-AE
  for (const day of days) {
    const prevDate = addDays(day, -1);
    const aeAssign = aeAssignments.get(prevDate);
    
    if (!aeAssign) {
      // Check archive
      const archiveRow = archive.find(a => a.date === prevDate && a.slotType === 'AE');
      if (archiveRow) {
        const hasPostAE = result.some(r => r.date === day && r.slotType === 'POST-AE');
        if (!hasPostAE) {
          result.push({
            date: day,
            day: getDayName(day),
            slotType: 'POST-AE',
            employeeId: archiveRow.employeeId,
            employeeName: archiveRow.employeeId,
            department: '',
            role: 'PPF',
            hours: 0,
          });
        }
      }
      continue;
    }

    const hasPostAE = result.some(r => r.date === day && r.slotType === 'POST-AE');
    if (!hasPostAE) {
      result.push({
        date: day,
        day: getDayName(day),
        slotType: 'POST-AE',
        employeeId: aeAssign.employeeId,
        employeeName: aeAssign.employeeName,
        department: aeAssign.department,
        role: aeAssign.role,
        hours: 0,
      });
    }
  }
  return result;
}

// ============================================
// MAIN SOLVER
// ============================================
async function solve(data: SolverInputData) {
  const startTime = Date.now();
  const { month, employees, holidays, aeAssignments, preselections, unavailability, archive, config } = data;

  postProgress({ type: 'progress', percent: 0, stage: 'init', stageLabel: 'Menyediakan data...', message: 'Membina struktur data', attempt: 0, totalAttempts: 0, bestUnfilled: 0 });

  if (cancelled) { postResult({ type: 'result', success: false, warnings: ['Dibatalkan'], unfilledCount: 0, assignments: [], elapsedSeconds: 0, solverMode: 'Cancelled', objective: null as any }); return; }

  // Build lookup structures
  const holidayDates = new Set(holidays.map(h => h.date));
  const allHolidays = new Set(holidays.map(h => h.date));
  const aeMap = new Map<string, string>();
  aeAssignments.forEach(a => aeMap.set(a.date, a.department));
  
  const unavailSet = new Set<string>();
  unavailability.forEach(u => unavailSet.add(`${u.date}_${u.employeeId}`));

  const preMap = new Map<string, Map<string, string>>();
  preselections.forEach(p => {
    if (!preMap.has(p.date)) preMap.set(p.date, new Map());
    preMap.get(p.date)!.set(p.slotType, p.employeeId);
  });

  const empMap = new Map(employees.map(e => [e.employeeId, e]));
  const activeEmployees = employees.filter(e => e.active);

  const days = getDaysInMonth(month);

  // Build slot sequence
  const slotSequence: SolverSlot[] = [];
  for (const day of days) {
    const dayType = classifyDay(day, holidayDates);
    const slots = getSlotsForDay(day, dayType, aeMap, allHolidays, holidayDates);
    for (const slot of slots) {
      const pre = preMap.get(day)?.get(slot.slotType);
      if (pre) continue; // Skip preselected
      slotSequence.push(slot);
    }
  }

  postProgress({ type: 'progress', percent: 5, stage: 'solve', stageLabel: 'Menyelesaikan...', message: `${slotSequence.length} slot untuk diisi`, attempt: 0, totalAttempts: 0, bestUnfilled: slotSequence.length });

  // Initialize state
  const state: SolverState = {
    assignments: [],
    hoursUsed: {},
    assignedToday: {},
    lastWorkedDay: {},
    lastWorkedWasAE: {},
    lastSlotType: {},
    aeCountThisMonth: {},
    aeCategories: {},
    aeDays: {},
    weekdaySlotWeekCounts: {},
    monthlyRuleStats: {},
    annualRuleStats: {},
    domain: {},
    unfilledCount: 0,
    unfilledSlots: [],
    postAEBlock: {},
    unavailSet,
  };

  // Apply preselections
  for (const p of preselections) {
    const emp = empMap.get(p.employeeId);
    if (!emp) continue;
    const dayType = classifyDay(p.date, holidayDates);
    const aeHours = p.slotType === 'AE' ? calcAEHours(p.date, dayType, allHolidays) : 0;
    const hours = p.slotType === 'AE' ? aeHours : getSlotHours(p.slotType);
    const slot: SolverSlot = { slotType: p.slotType, department: getSlotDept(p.slotType, aeMap.get(p.date)), role: getSlotRole(p.slotType) as EmployeeRole, hours, date: p.date, dayType };
    applyAssignment(slot, emp, state, holidayDates, allHolidays);
  }

  // STRATEGY A: Constructive with best-candidate
  let bestAssignments: SolverAssignment[] = [...state.assignments];
  let bestObjective = evaluateObjective(state, activeEmployees, allHolidays, config);
  let bestUnfilled = slotSequence.length;
  let solverMode = 'Constructive';
  let warnings: string[] = [];
  let steps = 0;
  const maxSteps = parseInt(config.SOLVER_MAX_STEPS || '800000');
  const maxTime = parseInt(config.SOLVER_MAX_RUNTIME_MS || '120000');
  const progressInterval = parseInt(config.SOLVER_PROGRESS_INTERVAL || '500');

  // Try multiple constructive strategies
  const strategies = ['most-constrained', 'fairness-first', 'front-loaded', 'back-loaded'];
  const restarts = Math.floor(parseInt(config.SOLVER_CONSTRUCTIVE_RESTARTS || '100') / strategies.length);

  for (let si = 0; si < strategies.length; si++) {
    if (cancelled) break;
    const strategy = strategies[si];

    for (let restart = 0; restart < restarts; restart++) {
      if (cancelled) break;
      if (Date.now() - startTime > maxTime) { cancelled = true; break; }

      const s = deepCloneState(state);
      let unfilled = 0;
      const attempt = si * restarts + restart;
      const totalAttempts = strategies.length * restarts;

      // Sort slots based on strategy
      let orderedSlots = [...slotSequence];
      if (strategy === 'back-loaded') orderedSlots.reverse();
      if (strategy === 'most-constrained') {
        // Sort by number of eligible candidates (ascending)
        orderedSlots.sort((a, b) => {
          const aEligible = activeEmployees.filter(e => isEligible(e, a, s, holidayDates, allHolidays, config).eligible).length;
          const bEligible = activeEmployees.filter(e => isEligible(e, b, s, holidayDates, allHolidays, config).eligible).length;
          return aEligible - bEligible;
        });
      }

      for (const slot of orderedSlots) {
        if (cancelled) break;
        steps++;

        // Get eligible candidates
        const candidates = activeEmployees.filter(e => isEligible(e, slot, s, holidayDates, allHolidays, config).eligible);

        if (candidates.length === 0) {
          unfilled++;
          continue;
        }

        // Rank candidates
        const ranked = rankCandidates(candidates, slot, s, allHolidays);
        
        // Add slight randomization for diversity
        const pick = restart === 0 ? ranked[0] : ranked[Math.floor(Math.random() * Math.min(3, ranked.length))];
        
        applyAssignment(slot, pick, s, holidayDates, allHolidays);

        if (steps % progressInterval === 0) {
          const pct = Math.min(95, 5 + (attempt / totalAttempts) * 90);
          postProgress({ type: 'progress', percent: pct, stage: 'solve', stageLabel: `Strategi ${si + 1}/${strategies.length}`, message: `Cubaan ${attempt + 1}/${totalAttempts} — ${unfilled} tidak diisi`, attempt, totalAttempts, bestUnfilled: Math.min(bestUnfilled, unfilled) });
        }
      }

      // Evaluate this solution
      const obj = evaluateObjective(s, activeEmployees, allHolidays, config);
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

  // Append POST-AE markers
  const finalAssignments = appendPostAEMarkers(bestAssignments, month, archive);

  const elapsed = (Date.now() - startTime) / 1000;

  if (bestUnfilled > 0) {
    warnings.push(`${bestUnfilled} slot tidak dapat diisi`);
  }

  postProgress({ type: 'progress', percent: 100, stage: 'done', stageLabel: 'Selesai!', message: `${finalAssignments.length} tugasan, ${bestUnfilled} tidak diisi`, attempt: 0, totalAttempts: 0, bestUnfilled });

  postResult({
    type: 'result',
    success: bestUnfilled === 0,
    warnings,
    unfilledCount: bestUnfilled,
    assignments: finalAssignments,
    elapsedSeconds: elapsed,
    solverMode,
    objective: bestObjective,
  });
}

function getSlotHours(slotType: string): number {
  const h: Record<string, number> = {
    AE: 9, IPP_1: 4, IPP_2: 7, IPP_3: 7, IPP_4: 7,
    OPD_1: 4, OPD_2: 4, OPD_3: 4, OPD_4: 7, OPD_5: 7,
    PP_PPF: 6, PP_PRA_1: 6, PP_PRA_2: 6,
  };
  return h[slotType] || 4;
}

function getSlotDept(slotType: string, aeDept?: string): string | null {
  if (slotType === 'AE') return aeDept || null;
  if (slotType.startsWith('IPP_')) return 'IPP';
  if (slotType.startsWith('OPD_')) return 'OPD';
  return null; // PP slots
}

function getSlotRole(slotType: string): string {
  if (slotType === 'PP_PRA_1' || slotType === 'PP_PRA_2') return 'PRA';
  return 'PPF';
}