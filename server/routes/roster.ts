import { Router, Response } from 'express';
import { 
  Employee, Holiday, AEAssignment, Preselection, Unavailability, 
  RosterArchive, RosterSheet, EligibilityLog, RosterChangeLog, 
  SolverMetric, Config 
} from '../models/index.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { SOLVER_DEFAULTS } from '../../src/types/index.js';

const router = Router();
router.use(authenticate);

// Helper: get days in month
function getDaysInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const daysCount = new Date(year, mon, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= daysCount; d++) {
    days.push(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

// GET /api/roster/generate - Prepare data for client-side solver
router.post('/generate', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.body;
    if (!month) {
      return res.status(400).json({ success: false, error: 'Bulan diperlukan' });
    }

    // Load all data needed for solver
    const [employees, holidays, aeAssignments, preselections, unavailability, archive, configItems] = await Promise.all([
      Employee.find({ active: true }),
      Holiday.find(),
      AEAssignment.find({ month }),
      Preselection.find({ month }),
      Unavailability.find(),
      RosterArchive.find(),
      Config.find(),
    ]);

    // Build config map with defaults
    const config: Record<string, string> = { ...SOLVER_DEFAULTS };
    for (const item of configItems) {
      config[item.key] = item.value;
    }

    return res.json({
      success: true,
      data: {
        month,
        employees,
        holidays,
        aeAssignments,
        preselections,
        unavailability,
        archive,
        config,
      }
    });
  } catch (error) {
    console.error('Generate data error:', error);
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/roster/save - Save completed roster from client-side solver
router.post('/save', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, assignments, objective, solverMode, elapsedSeconds, warnings } = req.body;
    
    if (!month || !assignments) {
      return res.status(400).json({ success: false, error: 'Bulan dan tugasan diperlukan' });
    }

    const rosterId = `Roster_${month}_${Date.now()}`;
    const generatedAt = new Date();
    const days = getDaysInMonth(month);
    const holidays = await Holiday.find();
    const holidayDates = new Set(holidays.map(h => h.date));

    // Build roster rows
    const rows = assignments.map((a: { date: string; day: string; slotType: string; employeeId: string; employeeName: string; department: string; role: string; hours: number }) => ({
      date: a.date,
      day: a.day,
      slotType: a.slotType,
      employeeId: a.employeeId,
      employeeName: a.employeeName,
      department: a.department,
      role: a.role,
      hours: a.hours,
    }));

    // 1. Remove existing roster sheet for this month
    await RosterSheet.deleteMany({ month, type: 'original' });
    
    // 2. Create new roster sheet
    await RosterSheet.create({ month, type: 'original', rows, createdAt: generatedAt });

    // 3. Archive assignments
    await RosterArchive.deleteMany({ month });
    const archiveRows = assignments
      .filter((a: { slotType: string }) => a.slotType !== 'POST-AE' && a.slotType !== 'PREV_MONTH_POST_AE')
      .map((a: { employeeId: string; slotType: string; date: string; hours: number }) => ({
        rosterId,
        month,
        date: a.date,
        slotType: a.slotType,
        employeeId: a.employeeId,
        hours: a.hours,
        generatedAt,
      }));
    if (archiveRows.length > 0) {
      await RosterArchive.insertMany(archiveRows);
    }

    // 4. Update employee annual counters
    const employees = await Employee.find();
    const allHolidaysSet = new Set(holidays.map(h => h.date));
    
    for (const emp of employees) {
      const empAssignments = assignments.filter((a: { employeeId: string }) => a.employeeId === emp.employeeId);
      let annualAE = 0, annualHalfPaidAE = 0, annualPaidAE = 0, annualPHAE = 0, annualPH = 0;

      // Count from prior months (archive)
      const priorArchive = await RosterArchive.find({ 
        employeeId: emp.employeeId, 
        month: { $ne: month } 
      });
      const empYear = month.split('-')[0];
      const priorInYear = priorArchive.filter(a => a.month.startsWith(empYear));
      
      for (const p of priorInYear) {
        const increments = buildAnnualIncrement(p.date, p.slotType, allHolidaysSet);
        annualAE += increments.AnnualAE;
        annualHalfPaidAE += increments.AnnualHalfPaidAE;
        annualPaidAE += increments.AnnualPaidAE;
        annualPHAE += increments.AnnualPHAE;
        annualPH += increments.AnnualPH;
      }

      // Count from current month
      for (const a of empAssignments) {
        const increments = buildAnnualIncrement(a.date, a.slotType, allHolidaysSet);
        annualAE += increments.AnnualAE;
        annualHalfPaidAE += increments.AnnualHalfPaidAE;
        annualPaidAE += increments.AnnualPaidAE;
        annualPHAE += increments.AnnualPHAE;
        annualPH += increments.AnnualPH;
      }

      await Employee.findByIdAndUpdate(emp._id, {
        annualAE, annualHalfPaidAE, annualPaidAE, annualPHAE, annualPH
      });
    }

    // 5. Log eligibility (simplified - store solver warnings as log)
    await EligibilityLog.deleteMany({ month });
    // Eligibility logs are generated during solver and can be saved separately

    // 6. Create change log entry for generation
    await RosterChangeLog.create({
      month,
      changedAt: generatedAt,
      changedByEmail: req.session?.name || '',
      changedByName: req.session?.name || '',
      changedByRole: req.session?.role || '',
      date: '',
      slot: 'GENERATE',
      oldEmployee: '',
      newEmployee: '',
      oldDept: '',
      newDept: '',
      oldRole: '',
      newRole: '',
      oldHours: 0,
      newHours: 0,
      action: 'ASSIGN',
    });

    // 7. Update config
    await Config.findOneAndUpdate(
      { key: 'LastGeneratedMonth' },
      { key: 'LastGeneratedMonth', value: month },
      { upsert: true }
    );

    // 8. Save solver metrics
    if (objective) {
      await SolverMetric.create({
        runId: rosterId,
        generatedAt,
        month,
        solverMode: solverMode || 'Adaptive',
        elapsedSeconds: elapsedSeconds || 0,
        searchSteps: objective.searchSteps || 0,
        searchStepLimit: parseInt(SOLVER_DEFAULTS.SOLVER_MAX_STEPS),
        timedOut: objective.timedOut || false,
        totalSlots: rows.length,
        assignedSlots: rows.filter((r: { slotType: string }) => r.slotType !== 'POST-AE').length,
        unfilledSlots: objective.unfilledCount || 0,
        coveragePct: rows.length > 0 ? ((rows.filter((r: { slotType: string }) => r.slotType !== 'POST-AE').length / rows.length) * 100) : 0,
        hardPenalty: objective.hardPenalty || 0,
        exceedOneThirdCount: objective.exceedOneThirdCount || 0,
        roleHoursDeviation: objective.roleHoursDeviation || 0,
        softPenalty: objective.softPenalty || 0,
        assignedHours: objective.assignedHours || 0,
        utilizationSpread: objective.utilizationSpread || 0,
        warningsCount: warnings?.length || 0,
        objectiveJson: JSON.stringify(objective),
      });
    }

    return res.json({ success: true, data: { rosterId, rowCount: rows.length } });
  } catch (error) {
    console.error('Save roster error:', error);
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// Helper for annual increment calculation
function buildAnnualIncrement(dateStr: string, slotType: string, allHolidaysSet: Set<string>) {
  const increments = { AnnualAE: 0, AnnualHalfPaidAE: 0, AnnualPaidAE: 0, AnnualPHAE: 0, AnnualPH: 0 };
  const dayKind = classifyDayKind(dateStr, allHolidaysSet);
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  
  if (slotType === 'AE') {
    increments.AnnualAE = 1;
    const nextDate = new Date(dateStr + 'T00:00:00');
    nextDate.setDate(nextDate.getDate() + 1);
    const nextStr = nextDate.toISOString().split('T')[0];
    const nextKind = classifyDayKind(nextStr, allHolidaysSet);
    const nextDow = nextDate.getDay();
    
    if (nextKind === 'weekday' && dayKind !== 'weekday') {
      increments.AnnualHalfPaidAE = 1;
    } else if (nextKind === 'weekend' || (nextKind === 'weekday' && dayKind === 'holiday')) {
      if (allHolidaysSet.has(nextStr)) {
        increments.AnnualPHAE = 1;
        increments.AnnualPH = 1;
        increments.AnnualPaidAE = 1;
      } else if (nextDow === 5 || nextDow === 6 || nextDow === 0) {
        increments.AnnualPaidAE = 1;
      }
    } else if (nextKind === 'holiday') {
      increments.AnnualPHAE = 1;
      increments.AnnualPH = 1;
      increments.AnnualPaidAE = 1;
    }
    return increments;
  }

  if (dayKind === 'holiday' && slotType !== 'POST-AE' && slotType !== 'PREV_MONTH_POST_AE') {
    increments.AnnualPH = 1;
  }
  
  return increments;
}

function classifyDayKind(dateStr: string, allHolidaysSet: Set<string>): string {
  if (allHolidaysSet.has(dateStr)) return 'holiday';
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return 'weekend';
  return 'weekday';
}

// GET /api/roster/exists
router.get('/exists', async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const sheet = await RosterSheet.findOne({ month: month as string, type: 'original' });
    return res.json({ success: true, exists: !!sheet });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/roster/report
router.get('/report', async (req: AuthRequest, res: Response) => {
  try {
    const { month, source } = req.query;
    const monthStr = month as string;
    const type = (source as string) === 'copy' ? 'copy' : 'original';
    
    const [roster, log] = await Promise.all([
      RosterSheet.findOne({ month: monthStr, type }),
      EligibilityLog.find({ month: monthStr }),
    ]);

    const rows = roster?.rows || [];
    
    // Build summary
    const summaryMap: Record<string, { employeeId: string; name: string; department: string; role: string; totalHours: number; slotCount: number; aeCount: number; holidayCount: number; weekendCount: number; weekdayCount: number }> = {};
    const holidays = await Holiday.find();
    const holidayDates = new Set(holidays.map(h => h.date));

    for (const row of rows) {
      if (row.slotType === 'POST-AE') continue;
      
      if (!summaryMap[row.employeeId]) {
        summaryMap[row.employeeId] = {
          employeeId: row.employeeId,
          name: row.employeeName,
          department: row.department,
          role: row.role,
          totalHours: 0,
          slotCount: 0,
          aeCount: 0,
          holidayCount: 0,
          weekendCount: 0,
          weekdayCount: 0,
        };
      }
      const s = summaryMap[row.employeeId];
      s.totalHours += row.hours;
      s.slotCount++;
      
      if (row.slotType === 'AE') s.aeCount++;
      else if (holidayDates.has(row.date)) s.holidayCount++;
      else {
        const dow = new Date(row.date + 'T00:00:00').getDay();
        if (dow === 0 || dow === 6) s.weekendCount++;
        else s.weekdayCount++;
      }
    }

    // Unfilled: find slots without assignments (simplified - return empty for now)
    const unfilled: typeof rows = [];

    return res.json({
      success: true,
      data: {
        roster,
        summary: Object.values(summaryMap),
        log,
        unfilled,
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/roster/summary
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { month, source } = req.query;
    const type = (source as string) === 'copy' ? 'copy' : 'original';
    
    const roster = await RosterSheet.findOne({ month: month as string, type });
    if (!roster) {
      return res.json({ success: true, data: [] });
    }

    const holidays = await Holiday.find();
    const holidayDates = new Set(holidays.map(h => h.date));
    const summaryMap: Record<string, { employeeId: string; name: string; department: string; role: string; totalHours: number; slotCount: number; aeCount: number; holidayCount: number; weekendCount: number; weekdayCount: number }> = {};

    for (const row of roster.rows) {
      if (row.slotType === 'POST-AE') continue;
      
      if (!summaryMap[row.employeeId]) {
        summaryMap[row.employeeId] = {
          employeeId: row.employeeId,
          name: row.employeeName,
          department: row.department,
          role: row.role,
          totalHours: 0,
          slotCount: 0,
          aeCount: 0,
          holidayCount: 0,
          weekendCount: 0,
          weekdayCount: 0,
        };
      }
      const s = summaryMap[row.employeeId];
      s.totalHours += row.hours;
      s.slotCount++;
      
      if (row.slotType === 'AE') s.aeCount++;
      else if (holidayDates.has(row.date)) s.holidayCount++;
      else {
        const dow = new Date(row.date + 'T00:00:00').getDay();
        if (dow === 0 || dow === 6) s.weekendCount++;
        else s.weekdayCount++;
      }
    }

    return res.json({ success: true, data: Object.values(summaryMap) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/roster/payment
router.get('/payment', async (req: AuthRequest, res: Response) => {
  try {
    const { month, source } = req.query;
    const type = (source as string) === 'copy' ? 'copy' : 'original';
    
    const [roster, employees, holidays] = await Promise.all([
      RosterSheet.findOne({ month: month as string, type }),
      Employee.find(),
      Holiday.find(),
    ]);

    if (!roster) {
      return res.json({ success: true, data: [] });
    }

    const holidaySet = new Set(holidays.map(h => h.date));
    const empMap = new Map(employees.map(e => [e.employeeId, e]));
    const paymentMap: Record<string, { employeeId: string; name: string; department: string; role: string; salary: number; hourlyRate: number; totalOTPay: number; exceedsOneThird: boolean; slotDetails: { date: string; slotType: string; hours: number; multiplier: number; payAmount: number; dayType: string }[] }> = {};

    for (const row of roster.rows) {
      if (row.slotType === 'POST-AE') continue;
      
      const emp = empMap.get(row.employeeId);
      if (!emp) continue;

      if (!paymentMap[row.employeeId]) {
        const hourlyRate = (emp.salary * 12) / (313 * 8);
        paymentMap[row.employeeId] = {
          employeeId: row.employeeId,
          name: row.employeeName,
          department: row.department,
          role: row.role,
          salary: emp.salary,
          hourlyRate,
          totalOTPay: 0,
          exceedsOneThird: false,
          slotDetails: [],
        };
      }

      const p = paymentMap[row.employeeId];
      const multiplier = getSlotMultiplier(row.slotType, row.date, holidaySet);
      const payAmount = Math.round(p.hourlyRate * multiplier * 100) / 100;
      
      p.slotDetails.push({
        date: row.date,
        slotType: row.slotType,
        hours: row.hours,
        multiplier,
        payAmount,
        dayType: getDayTypeLabel(row.date, holidaySet),
      });
      
      p.totalOTPay += payAmount;
    }

    // Check one-third rule
    for (const p of Object.values(paymentMap)) {
      p.totalOTPay = Math.round(p.totalOTPay * 100) / 100;
      p.exceedsOneThird = p.totalOTPay > (p.salary / 3);
    }

    return res.json({ success: true, data: Object.values(paymentMap) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

function getDayTypeLabel(dateStr: string, holidaySet: Set<string>): string {
  if (holidaySet.has(dateStr)) return 'Cuti Umum';
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (dow === 0) return 'Ahad';
  if (dow === 6) return 'Sabtu';
  return 'Hari Bekerja';
}

function getSlotMultiplier(slotType: string, dateStr: string, holidaySet: Set<string>): number {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  const isHoliday = holidaySet.has(dateStr);
  const nextDate = new Date(dateStr + 'T00:00:00');
  nextDate.setDate(nextDate.getDate() + 1);
  const nextDow = nextDate.getDay();
  const nextStr = nextDate.toISOString().split('T')[0];
  const nextIsHoliday = holidaySet.has(nextStr);
  const isWeekday = dow >= 1 && dow <= 5 && !isHoliday;
  const isWeekend = (dow === 0 || dow === 6) && !isHoliday;

  // AE slots
  if (slotType === 'AE') {
    if (isWeekday && dow <= 3) return 0; // Mon-Thu no AE hours normally
    if (isWeekday && dow === 4) { // Friday
      if (nextIsHoliday || nextDow === 5 || nextDow === 6 || nextDow === 0) {
        return (1.25 * 2 + 1.5 * 5 + 1.25 * 2) / 9; // ~1.36
      }
      return 9 * 1.25 / 9; // simplified
    }
    if (isWeekday && dow === 5) { // Saturday
      if (nextIsHoliday) return (1.5 * 2 + 2 * 5 + 1.75 * 2) / 9;
      if (nextDow === 0) return (1.5 * 7 + 1.25 * 2) / 9;
      return 1.5 * 2 / 2; // simplified 2h
    }
    if (dow === 0 || isHoliday) { // Sunday or Holiday
      if (nextIsHoliday || nextDow === 5 || nextDow === 6 || nextDow === 0) {
        if (isHoliday) return (2 * 2 + 1.5 * 5 + 1.25 * 2) / 9;
        return (2 * 7 + 1.75 * 2) / 9; // Sunday → Holiday
      }
      return 2 * 2 / 2; // 2h
    }
    return 1.0;
  }

  // PP slots (6h)
  if (slotType === 'PP_PPF' || slotType === 'PP_PRA_1' || slotType === 'PP_PRA_2') {
    if (isHoliday) return 1.75;
    if (isWeekend) return 1.25;
    return 1.125;
  }

  // IPP/OPD slots
  if (isHoliday) return 1.75;
  if (isWeekend) return 1.25;
  return 1.125;
}

// POST /api/roster/cell-edit
router.post('/cell-edit', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, date, slot, employeeName } = req.body;
    
    const roster = await RosterSheet.findOne({ month, type: 'original' });
    if (!roster) {
      return res.status(404).json({ success: false, error: 'Jadual tidak dijumpai' });
    }

    const rowIndex = roster.rows.findIndex(r => r.date === date && r.slotType === slot);
    const oldRow = rowIndex >= 0 ? roster.rows[rowIndex] : null;
    
    let employee = null;
    if (employeeName && employeeName.trim()) {
      employee = await Employee.findOne({ name: { $regex: new RegExp(`^${employeeName.trim()}$`, 'i') }, active: true });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
      }
    }

    // Log the change
    await RosterChangeLog.create({
      month,
      changedAt: new Date(),
      changedByEmail: req.session?.name || '',
      changedByName: req.session?.name || '',
      changedByRole: req.session?.role || '',
      date,
      slot,
      oldEmployee: oldRow?.employeeName || '',
      newEmployee: employee?.name || '',
      oldDept: oldRow?.department || '',
      newDept: employee?.department || '',
      oldRole: oldRow?.role || '',
      newRole: employee?.role || '',
      oldHours: oldRow?.hours || 0,
      newHours: employee ? (oldRow?.hours || 0) : 0,
      action: employee ? (oldRow?.employeeId ? 'UPDATE' : 'ASSIGN') : 'CLEAR',
    });

    if (employee && oldRow) {
      oldRow.employeeId = employee.employeeId;
      oldRow.employeeName = employee.name;
      oldRow.department = employee.department;
      oldRow.role = employee.role;
    } else if (!employee && rowIndex >= 0) {
      roster.rows.splice(rowIndex, 1);
    }

    await roster.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// POST /api/roster/copy-edit
router.post('/copy-edit', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, date, slotType, employeeName } = req.body;
    
    let roster = await RosterSheet.findOne({ month, type: 'copy' });
    if (!roster) {
      // Create copy from original
      const original = await RosterSheet.findOne({ month, type: 'original' });
      if (!original) {
        return res.status(404).json({ success: false, error: 'Jadual asal tidak dijumpai' });
      }
      roster = await RosterSheet.create({
        month,
        type: 'copy',
        rows: [...original.rows],
        createdAt: new Date(),
      });
    }

    const rowIndex = roster.rows.findIndex(r => r.date === date && r.slotType === slotType);
    
    let employee = null;
    if (employeeName && employeeName.trim()) {
      employee = await Employee.findOne({ name: { $regex: new RegExp(`^${employeeName.trim()}$`, 'i') }, active: true });
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
      }
    }

    if (employee) {
      if (rowIndex >= 0) {
        roster.rows[rowIndex].employeeId = employee.employeeId;
        roster.rows[rowIndex].employeeName = employee.name;
        roster.rows[rowIndex].department = employee.department;
        roster.rows[rowIndex].role = employee.role;
      } else {
        // Add new row
        const dow = new Date(date + 'T00:00:00').getDay();
        const dayNames = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
        roster.rows.push({
          date,
          day: dayNames[dow],
          slotType,
          employeeId: employee.employeeId,
          employeeName: employee.name,
          department: employee.department,
          role: employee.role,
          hours: getHoursForSlot(slotType),
        });
      }
    } else if (rowIndex >= 0) {
      roster.rows.splice(rowIndex, 1);
    }

    await roster.save();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

function getHoursForSlot(slotType: string): number {
  const hours: Record<string, number> = {
    AE: 9, IPP_1: 4, IPP_2: 7, IPP_3: 7, IPP_4: 7,
    OPD_1: 4, OPD_2: 4, OPD_3: 4, OPD_4: 7, OPD_5: 7,
    PP_PPF: 6, PP_PRA_1: 6, PP_PRA_2: 6,
  };
  return hours[slotType] || 4;
}

// POST /api/roster/copy/generate
router.post('/copy/generate', requireRole('admin', 'superadmin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.body;
    const original = await RosterSheet.findOne({ month, type: 'original' });
    if (!original) {
      return res.status(404).json({ success: false, error: 'Jadual asal tidak dijumpai' });
    }

    await RosterSheet.deleteMany({ month, type: 'copy' });
    await RosterSheet.create({
      month,
      type: 'copy',
      rows: [...original.rows],
      createdAt: new Date(),
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

// GET /api/roster/copy/exists
router.get('/copy/exists', async (req: AuthRequest, res: Response) => {
  try {
    const { month } = req.query;
    const sheet = await RosterSheet.findOne({ month: month as string, type: 'copy' });
    return res.json({ success: true, exists: !!sheet });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

export default router;