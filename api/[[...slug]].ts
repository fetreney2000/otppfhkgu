import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import crypto from 'crypto';

// ============================================
// MONGODB CONNECTION (CACHED FOR SERVERLESS)
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/jadual-ot';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((m) => m);
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function sha256Hash(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================
// MONGOOSE MODELS
// ============================================
const { Schema } = mongoose;

const EmployeeSchema = new Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true, index: true },
  department: { type: String, enum: ['IPP', 'OPD'], required: true },
  role: { type: String, enum: ['PPF', 'PRA'], required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  maxHoursPerMonth: { type: Number, default: 40 },
  salary: { type: Number, required: true },
  active: { type: Boolean, default: true },
  password: { type: String, required: true },
  annualAE: { type: Number, default: 0 },
  annualHalfPaidAE: { type: Number, default: 0 },
  annualPaidAE: { type: Number, default: 0 },
  annualPHAE: { type: Number, default: 0 },
  annualPH: { type: Number, default: 0 },
}, { timestamps: true });
const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);

const ConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
});
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

const HolidaySchema = new Schema({
  date: { type: String, required: true, index: true },
  name: { type: String, required: true },
  month: { type: String, required: true, index: true },
});
HolidaySchema.index({ date: 1 }, { unique: true });
const Holiday = mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema);

const AEAssignmentSchema = new Schema({
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  department: { type: String, enum: ['IPP', 'OPD'], required: true },
});
AEAssignmentSchema.index({ month: 1, date: 1 }, { unique: true });
const AEAssignment = mongoose.models.AEAssignment || mongoose.model('AEAssignment', AEAssignmentSchema);

const PreselectionSchema = new Schema({
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  slotType: { type: String, required: true },
  employeeId: { type: String, required: true },
});
PreselectionSchema.index({ month: 1, date: 1, slotType: 1 }, { unique: true });
const Preselection = mongoose.models.Preselection || mongoose.model('Preselection', PreselectionSchema);

const UnavailabilitySchema = new Schema({
  employeeId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
UnavailabilitySchema.index({ employeeId: 1, date: 1 }, { unique: true });
const Unavailability = mongoose.models.Unavailability || mongoose.model('Unavailability', UnavailabilitySchema);

const RosterArchiveSchema = new Schema({
  rosterId: { type: String, required: true },
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  slotType: { type: String, required: true },
  employeeId: { type: String, required: true },
  hours: { type: Number, required: true },
  generatedAt: { type: Date, default: Date.now },
});
const RosterArchive = mongoose.models.RosterArchive || mongoose.model('RosterArchive', RosterArchiveSchema);

const RosterRowSchema = new Schema({
  date: String, day: String, slotType: String, employeeId: String,
  employeeName: String, department: String, role: String, hours: Number,
}, { _id: false });
const RosterSheetSchema = new Schema({
  month: { type: String, required: true, index: true },
  type: { type: String, enum: ['original', 'copy'], required: true },
  rows: [RosterRowSchema],
  createdAt: { type: Date, default: Date.now },
});
RosterSheetSchema.index({ month: 1, type: 1 });
const RosterSheet = mongoose.models.RosterSheet || mongoose.model('RosterSheet', RosterSheetSchema);

const EligibilityLogSchema = new Schema({
  month: { type: String, required: true, index: true },
  date: String, day: String, slot: String, employeeId: String, name: String,
  department: String, role: String, hoursUsed: Number, maxHours: Number,
  remaining: Number, eligible: Boolean, reasons: String,
});
const EligibilityLog = mongoose.models.EligibilityLog || mongoose.model('EligibilityLog', EligibilityLogSchema);

const RosterChangeLogSchema = new Schema({
  month: { type: String, required: true, index: true },
  changedAt: { type: Date, default: Date.now },
  changedByEmail: String, changedByName: String, changedByRole: String,
  date: String, slot: String, oldEmployee: String, newEmployee: String,
  oldDept: String, newDept: String, oldRole: String, newRole: String,
  oldHours: Number, newHours: Number,
  action: { type: String, enum: ['ASSIGN', 'UPDATE', 'CLEAR', 'SYNC_POST_AE'], required: true },
});
const RosterChangeLog = mongoose.models.RosterChangeLog || mongoose.model('RosterChangeLog', RosterChangeLogSchema);

const SolverMetricSchema = new Schema({
  runId: { type: String, required: true, unique: true },
  generatedAt: { type: Date, default: Date.now },
  month: { type: String, required: true, index: true },
  solverMode: String, elapsedSeconds: Number, searchSteps: Number,
  searchStepLimit: Number, timedOut: Boolean, totalSlots: Number,
  assignedSlots: Number, unfilledSlots: Number, coveragePct: Number,
  hardPenalty: Number, exceedOneThirdCount: Number, roleHoursDeviation: Number,
  softPenalty: Number, assignedHours: Number, utilizationSpread: Number,
  warningsCount: Number, objectiveJson: String,
});
const SolverMetric = mongoose.models.SolverMetric || mongoose.model('SolverMetric', SolverMetricSchema);

const SessionSchema = new Schema({
  token: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee', 'superadmin'], required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);

// ============================================
// SOLVER DEFAULTS
// ============================================
const SOLVER_DEFAULTS: Record<string, string> = {
  SOLVER_MAX_STEPS: '800000', SOLVER_MAX_RUNTIME_MS: '120000',
  SOLVER_BEAM_WIDTH: '50', SOLVER_CONSTRUCTIVE_RESTARTS: '100',
  SOLVER_PROGRESS_INTERVAL: '500', TARGET_ROLE_STD_DEV: '7',
  RULE_MIN_IPP_OFFDAY_IPP: '2', RULE_MIN_IPP_WEEKDAY_IPP: '2',
  RULE_MIN_OPD_OFFDAY_OPD: '2', RULE_MAX_IPP_WEEKDAY_OPD: '4',
  RULE_MAX_OPD_WEEKDAY_OPD: '7', RULE_MAX_HOLIDAY_SLOTS_ALL: '2',
  RULE_MAX_AE_SLOTS_ALL: '2', RULE_MAX_AE_PAID_PER_MONTH: '1',
  RULE_MAX_AE_UNPAID_PER_MONTH: '1', RULE_MAX_WEEKDAY_OPD_IPP_DAYS: '2',
  PENALTY_WEIGHT_HARD_HOLIDAY: '80', PENALTY_WEIGHT_HARD_AE: '120',
  PENALTY_WEIGHT_HARD_DEPT_MAX: '70', PENALTY_WEIGHT_SOFT_MIN_DEFICIT: '35',
  PENALTY_WEIGHT_SOFT_ANNUAL_SPREAD: '4', PENALTY_WEIGHT_SOFT_UTIL_DEVIATION: '240',
  PENALTY_WEIGHT_SOFT_ROLE_DEV: '10', PENALTY_WEIGHT_SOFT_EXCEED_SALARY: '300',
  PENALTY_WEIGHT_SOFT_ROLE_STD_OVER: '900', PENALTY_WEIGHT_HARD_ROLE_STD: '160',
};

// ============================================
// AUTH MIDDLEWARE
// ============================================
interface AuthReq extends express.Request {
  session?: { name: string; role: string; token: string };
}

async function authenticate(req: AuthReq, res: express.Response, next: express.NextFunction) {
  try {
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.cookies) token = req.cookies.token;
    if (!token) return res.status(401).json({ success: false, error: 'Tidak dibenarkan' });
    
    const session = await Session.findOne({ token });
    if (!session) return res.status(401).json({ success: false, error: 'Sesi tidak sah' });
    if (session.expiresAt < new Date()) {
      await Session.deleteOne({ _id: session._id });
      return res.status(401).json({ success: false, error: 'Sesi telah tamat tempoh' });
    }
    req.session = { name: session.name, role: session.role, token: session.token };
    next();
  } catch {
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
}

function requireRole(...roles: string[]) {
  return (req: AuthReq, res: express.Response, next: express.NextFunction) => {
    if (!req.session) return res.status(401).json({ success: false, error: 'Tidak dibenarkan' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ success: false, error: 'Akses ditolak' });
    next();
  };
}

// ============================================
// EXPRESS APP
// ============================================
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Strip /api prefix for Vercel serverless routing
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/')) {
    req.url = req.url.substring(4);
  } else if (req.url === '/api') {
    req.url = '/';
  }
  next();
});

// Ensure DB connection for all routes
app.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// ---- AUTH ROUTES ----
app.post('/auth/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ success: false, error: 'Nama dan kata laluan diperlukan' });
    const hashedPassword = sha256Hash(password);
    const nameTrimmed = name.trim();

    // Superadmin
    const superAdminName = (process.env.SUPERADMIN_NAME || 'superadmin').toLowerCase();
    const superAdminHash = process.env.SUPERADMIN_PASSWORD_HASH || '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
    if (nameTrimmed.toLowerCase() === superAdminName && hashedPassword === superAdminHash) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await Session.create({ token, name: nameTrimmed, role: 'superadmin', expiresAt });
      return res.json({ success: true, role: 'superadmin', token, redirectUrl: '/admin' });
    }

    // Admin
    const adminNameConfig = await Config.findOne({ key: 'AdminName' });
    const adminPassConfig = await Config.findOne({ key: 'AdminPassword' });
    const adminName = adminNameConfig?.value || 'admin';
    const adminPassHash = adminPassConfig?.value || sha256Hash('admin');
    if (nameTrimmed.toLowerCase() === adminName.toLowerCase() && hashedPassword === adminPassHash) {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await Session.create({ token, name: nameTrimmed, role: 'admin', expiresAt });
      return res.json({ success: true, role: 'admin', token, redirectUrl: '/admin' });
    }

    // Employee
    const employee = await Employee.findOne({
      name: { $regex: new RegExp(`^${nameTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      active: true,
    });
    if (!employee || employee.password !== hashedPassword) {
      return res.status(401).json({ success: false, error: 'Nama atau kata laluan salah' });
    }
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await Session.create({ token, name: employee.name, role: 'employee', expiresAt });
    return res.json({ success: true, role: 'employee', token, redirectUrl: '/my-schedule' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Ralat pelayan' });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const token = req.body.token || req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
    if (token) await Session.deleteOne({ token });
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.get('/auth/me', authenticate, async (req: AuthReq, res) => {
  try {
    if (!req.session) return res.status(401).json({ success: false, error: 'Tidak dibenarkan' });
    let profile = null;
    if (req.session.role === 'employee') {
      profile = await Employee.findOne({ name: req.session.name, active: true }).select('-password');
    }
    return res.json({ success: true, data: { name: req.session.name, role: req.session.role, profile } });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- EMPLOYEES ----
app.get('/employees', authenticate, requireRole('admin', 'superadmin'), async (_req, res) => {
  try { return res.json({ success: true, data: await Employee.find().sort({ employeeId: 1 }) }); }
  catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.post('/employees', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { employeeId, name, department, role, email, maxHoursPerMonth, salary, password } = req.body;
    if (!employeeId || !name || !department || !role || !email || !salary || !password) return res.status(400).json({ success: false, error: 'Semua medan diperlukan' });
    const existing = await Employee.findOne({ $or: [{ employeeId }, { email: email.toLowerCase() }] });
    if (existing) return res.status(400).json({ success: false, error: 'ID kakitangan atau e-mel sudah wujud' });
    const employee = await Employee.create({ employeeId, name, department, role, email: email.toLowerCase(), maxHoursPerMonth: maxHoursPerMonth || 40, salary, password: sha256Hash(password), active: true });
    return res.json({ success: true, data: employee });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.put('/employees/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.password) updates.password = sha256Hash(updates.password); else delete updates.password;
    if (updates.email) updates.email = updates.email.toLowerCase();
    const employee = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!employee) return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
    return res.json({ success: true, data: employee });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.delete('/employees/:id', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- HOLIDAYS ----
app.get('/holidays', authenticate, async (req, res) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.month) filter.month = req.query.month as string;
    return res.json({ success: true, data: await Holiday.find(filter).sort({ date: 1 }) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.post('/holidays', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) return res.status(400).json({ success: false, error: 'Tarikh dan nama diperlukan' });
    const existing = await Holiday.findOne({ date });
    if (existing) return res.status(400).json({ success: false, error: 'Cuti umum sudah wujud pada tarikh ini' });
    return res.json({ success: true, data: await Holiday.create({ date, name, month: date.substring(0, 7) }) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.delete('/holidays/:date', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await Holiday.deleteOne({ date: req.params.date });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Cuti umum tidak dijumpai' });
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- AE ASSIGNMENTS ----
app.get('/ae-assignments', authenticate, async (req, res) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.month) filter.month = req.query.month as string;
    return res.json({ success: true, data: await AEAssignment.find(filter).sort({ date: 1 }) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.post('/ae-assignments/bulk', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { month, assignments } = req.body;
    if (!month || !Array.isArray(assignments)) return res.status(400).json({ success: false, error: 'Bulan dan tugasan diperlukan' });
    await AEAssignment.deleteMany({ month });
    if (assignments.length > 0) await AEAssignment.insertMany(assignments.map((a: { date: string; department: string }) => ({ month, date: a.date, department: a.department })));
    return res.json({ success: true, data: await AEAssignment.find({ month }).sort({ date: 1 }) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- PRESELECTIONS ----
app.get('/preselections', authenticate, async (req, res) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.month) filter.month = req.query.month as string;
    return res.json({ success: true, data: await Preselection.find(filter).sort({ date: 1 }) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.post('/preselections', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { month, date, slotType, employeeId } = req.body;
    if (!month || !date || !slotType || !employeeId) return res.status(400).json({ success: false, error: 'Semua medan diperlukan' });
    const p = await Preselection.findOneAndUpdate({ month, date, slotType }, { month, date, slotType, employeeId }, { upsert: true, new: true });
    return res.json({ success: true, data: p });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- UNAVAILABILITY ----
app.get('/unavailability', authenticate, async (req, res) => {
  try {
    const filter: Record<string, string> = {};
    if (req.query.employeeId) filter.employeeId = req.query.employeeId as string;
    let unavail = await Unavailability.find(filter).sort({ date: 1 });
    if (req.query.month) unavail = unavail.filter(u => u.date.startsWith(req.query.month as string));
    return res.json({ success: true, data: unavail });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.post('/unavailability/bulk', authenticate, async (req: AuthReq, res) => {
  try {
    const { month, dates, employeeId } = req.body;
    if (!month || !Array.isArray(dates)) return res.status(400).json({ success: false, error: 'Bulan dan tarikh diperlukan' });
    const empId = employeeId || req.session?.name;
    if (!empId) return res.status(400).json({ success: false, error: 'ID kakitangan diperlukan' });
    const monthDates = await Unavailability.find({ employeeId: empId });
    for (const d of monthDates.filter(u => u.date.startsWith(month))) await Unavailability.deleteOne({ _id: d._id });
    if (dates.length > 0) await Unavailability.insertMany(dates.map((date: string) => ({ employeeId: empId, date, createdAt: new Date() })));
    const result = await Unavailability.find({ employeeId: empId }).sort({ date: 1 });
    return res.json({ success: true, data: result.filter(u => u.date.startsWith(month)) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER GENERATE (prepare data for client solver) ----
app.post('/roster/generate', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ success: false, error: 'Bulan diperlukan' });
    const [employees, holidays, aeAssignments, preselections, unavailability, archive, configItems] = await Promise.all([
      Employee.find({ active: true }), Holiday.find(), AEAssignment.find({ month }),
      Preselection.find({ month }), Unavailability.find(), RosterArchive.find(), Config.find(),
    ]);
    const config: Record<string, string> = { ...SOLVER_DEFAULTS };
    for (const item of configItems) config[item.key] = item.value;
    return res.json({ success: true, data: { month, employees, holidays, aeAssignments, preselections, unavailability, archive, config } });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER SAVE ----
app.post('/roster/save', authenticate, requireRole('admin', 'superadmin'), async (req: AuthReq, res) => {
  try {
    const { month, assignments, objective, solverMode, elapsedSeconds, warnings } = req.body;
    if (!month || !assignments) return res.status(400).json({ success: false, error: 'Bulan dan tugasan diperlukan' });
    const rosterId = `Roster_${month}_${Date.now()}`;
    const generatedAt = new Date();
    const holidays = await Holiday.find();
    const allHolidaysSet = new Set(holidays.map((h: { date: string }) => h.date));

    const rows = assignments.map((a: { date: string; day: string; slotType: string; employeeId: string; employeeName: string; department: string; role: string; hours: number }) => ({
      date: a.date, day: a.day, slotType: a.slotType, employeeId: a.employeeId,
      employeeName: a.employeeName, department: a.department, role: a.role, hours: a.hours,
    }));

    await RosterSheet.deleteMany({ month, type: 'original' });
    await RosterSheet.create({ month, type: 'original', rows, createdAt: generatedAt });

    await RosterArchive.deleteMany({ month });
    const archiveRows = assignments.filter((a: { slotType: string }) => a.slotType !== 'POST-AE').map((a: { employeeId: string; slotType: string; date: string; hours: number }) => ({
      rosterId, month, date: a.date, slotType: a.slotType, employeeId: a.employeeId, hours: a.hours, generatedAt,
    }));
    if (archiveRows.length > 0) await RosterArchive.insertMany(archiveRows);

    // Update annual counters
    const employees = await Employee.find();
    for (const emp of employees) {
      const empAssignments = assignments.filter((a: { employeeId: string }) => a.employeeId === emp.employeeId);
      const priorArchive = await RosterArchive.find({ employeeId: emp.employeeId, month: { $ne: month } });
      const empYear = month.split('-')[0];
      const priorInYear = priorArchive.filter((a: { month: string }) => a.month.startsWith(empYear));
      let annualAE = 0, annualHalfPaidAE = 0, annualPaidAE = 0, annualPHAE = 0, annualPH = 0;
      for (const p of [...priorInYear, ...empAssignments]) {
        const dayKind = allHolidaysSet.has(p.date) ? 'holiday' : [0, 6].includes(new Date(p.date + 'T00:00:00').getDay()) ? 'weekend' : 'weekday';
        if (p.slotType === 'AE') {
          annualAE++;
          const nextDate = new Date(p.date + 'T00:00:00'); nextDate.setDate(nextDate.getDate() + 1);
          const nextStr = nextDate.toISOString().split('T')[0];
          const nextKind = allHolidaysSet.has(nextStr) ? 'holiday' : [0, 6].includes(nextDate.getDay()) ? 'weekend' : 'weekday';
          if (nextKind === 'holiday') { annualPHAE++; annualPH++; annualPaidAE++; }
          else if (nextKind === 'weekend' || (dayKind === 'holiday' && nextKind === 'weekday')) annualPaidAE++;
          else if (dayKind !== 'weekday') annualHalfPaidAE++;
        } else if (dayKind === 'holiday' && p.slotType !== 'POST-AE') {
          annualPH++;
        }
      }
      await Employee.findByIdAndUpdate(emp._id, { annualAE, annualHalfPaidAE, annualPaidAE, annualPHAE, annualPH });
    }

    await EligibilityLog.deleteMany({ month });
    await RosterChangeLog.create({
      month, changedAt: generatedAt, changedByEmail: req.session?.name || '',
      changedByName: req.session?.name || '', changedByRole: req.session?.role || '',
      date: '', slot: 'GENERATE', oldEmployee: '', newEmployee: '',
      oldDept: '', newDept: '', oldRole: '', newRole: '', oldHours: 0, newHours: 0, action: 'ASSIGN',
    });

    await Config.findOneAndUpdate({ key: 'LastGeneratedMonth' }, { key: 'LastGeneratedMonth', value: month }, { upsert: true });

    if (objective) {
      await SolverMetric.create({
        runId: rosterId, generatedAt, month, solverMode: solverMode || 'Adaptive',
        elapsedSeconds: elapsedSeconds || 0, searchSteps: 0, searchStepLimit: 800000,
        timedOut: false, totalSlots: rows.length, assignedSlots: rows.filter((r: { slotType: string }) => r.slotType !== 'POST-AE').length,
        unfilledSlots: objective.unfilledCount || 0, coveragePct: rows.length > 0 ? (rows.filter((r: { slotType: string }) => r.slotType !== 'POST-AE').length / rows.length * 100) : 0,
        hardPenalty: objective.hardPenalty || 0, exceedOneThirdCount: objective.exceedOneThirdCount || 0,
        roleHoursDeviation: objective.roleHoursDeviation || 0, softPenalty: objective.softPenalty || 0,
        assignedHours: objective.assignedHours || 0, utilizationSpread: objective.utilizationSpread || 0,
        warningsCount: warnings?.length || 0, objectiveJson: JSON.stringify(objective),
      });
    }

    return res.json({ success: true, data: { rosterId, rowCount: rows.length } });
  } catch (error) { console.error(error); return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER EXISTS ----
app.get('/roster/exists', authenticate, async (req, res) => {
  try {
    const sheet = await RosterSheet.findOne({ month: req.query.month as string, type: 'original' });
    return res.json({ success: true, exists: !!sheet });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.get('/roster/copy/exists', authenticate, async (req, res) => {
  try {
    const sheet = await RosterSheet.findOne({ month: req.query.month as string, type: 'copy' });
    return res.json({ success: true, exists: !!sheet });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER REPORT ----
app.get('/roster/report', authenticate, async (req, res) => {
  try {
    const monthStr = req.query.month as string;
    const [roster, log] = await Promise.all([
      RosterSheet.findOne({ month: monthStr, type: 'original' }),
      EligibilityLog.find({ month: monthStr }),
    ]);
    const rows = roster?.rows || [];
    const holidays = await Holiday.find();
    const holidayDates = new Set(holidays.map((h: { date: string }) => h.date));
    const summaryMap: Record<string, { employeeId: string; name: string; department: string; role: string; totalHours: number; slotCount: number; aeCount: number; holidayCount: number; weekendCount: number; weekdayCount: number }> = {};
    for (const row of rows) {
      if (row.slotType === 'POST-AE') continue;
      if (!summaryMap[row.employeeId]) summaryMap[row.employeeId] = { employeeId: row.employeeId, name: row.employeeName, department: row.department, role: row.role, totalHours: 0, slotCount: 0, aeCount: 0, holidayCount: 0, weekendCount: 0, weekdayCount: 0 };
      const s = summaryMap[row.employeeId]; s.totalHours += row.hours; s.slotCount++;
      if (row.slotType === 'AE') s.aeCount++; else if (holidayDates.has(row.date)) s.holidayCount++;
      else { const dow = new Date(row.date + 'T00:00:00').getDay(); if (dow === 0 || dow === 6) s.weekendCount++; else s.weekdayCount++; }
    }
    return res.json({ success: true, data: { roster, summary: Object.values(summaryMap), log, unfilled: [] } });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER SUMMARY ----
app.get('/roster/summary', authenticate, async (req, res) => {
  try {
    const type = (req.query.source as string) === 'copy' ? 'copy' : 'original';
    const roster = await RosterSheet.findOne({ month: req.query.month as string, type });
    if (!roster) return res.json({ success: true, data: [] });
    const holidays = await Holiday.find();
    const holidayDates = new Set(holidays.map((h: { date: string }) => h.date));
    const summaryMap: Record<string, { employeeId: string; name: string; department: string; role: string; totalHours: number; slotCount: number; aeCount: number; holidayCount: number; weekendCount: number; weekdayCount: number }> = {};
    for (const row of roster.rows) {
      if (row.slotType === 'POST-AE') continue;
      if (!summaryMap[row.employeeId]) summaryMap[row.employeeId] = { employeeId: row.employeeId, name: row.employeeName, department: row.department, role: row.role, totalHours: 0, slotCount: 0, aeCount: 0, holidayCount: 0, weekendCount: 0, weekdayCount: 0 };
      const s = summaryMap[row.employeeId]; s.totalHours += row.hours; s.slotCount++;
      if (row.slotType === 'AE') s.aeCount++; else if (holidayDates.has(row.date)) s.holidayCount++;
      else { const dow = new Date(row.date + 'T00:00:00').getDay(); if (dow === 0 || dow === 6) s.weekendCount++; else s.weekdayCount++; }
    }
    return res.json({ success: true, data: Object.values(summaryMap) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER PAYMENT ----
app.get('/roster/payment', authenticate, async (req, res) => {
  try {
    const type = (req.query.source as string) === 'copy' ? 'copy' : 'original';
    const [roster, employees, holidays] = await Promise.all([
      RosterSheet.findOne({ month: req.query.month as string, type }), Employee.find(), Holiday.find(),
    ]);
    if (!roster) return res.json({ success: true, data: [] });
    const holidaySet = new Set(holidays.map((h: { date: string }) => h.date));
    const empMap = new Map(employees.map((e: { employeeId: string; salary: number }) => [e.employeeId, e]));
    const paymentMap: Record<string, { employeeId: string; name: string; department: string; role: string; salary: number; hourlyRate: number; totalOTPay: number; exceedsOneThird: boolean; slotDetails: { date: string; slotType: string; hours: number; multiplier: number; payAmount: number; dayType: string }[] }> = {};
    for (const row of roster.rows) {
      if (row.slotType === 'POST-AE') continue;
      const emp = empMap.get(row.employeeId) as { employeeId: string; salary: number } | undefined;
      if (!emp) continue;
      if (!paymentMap[row.employeeId]) {
        const hourlyRate = (emp.salary * 12) / (313 * 8);
        paymentMap[row.employeeId] = { employeeId: row.employeeId, name: row.employeeName, department: row.department, role: row.role, salary: emp.salary, hourlyRate, totalOTPay: 0, exceedsOneThird: false, slotDetails: [] };
      }
      const p = paymentMap[row.employeeId];
      const dow = new Date(row.date + 'T00:00:00').getDay();
      const isHol = holidaySet.has(row.date);
      const isWe = (dow === 0 || dow === 6) && !isHol;
      let mult = 1.125;
      if (isHol) mult = 1.75; else if (isWe) mult = 1.25;
      const payAmount = Math.round(p.hourlyRate * mult * 100) / 100;
      const dayType = isHol ? 'Cuti Umum' : dow === 0 ? 'Ahad' : dow === 6 ? 'Sabtu' : 'Hari Bekerja';
      p.slotDetails.push({ date: row.date, slotType: row.slotType, hours: row.hours, multiplier: mult, payAmount, dayType });
      p.totalOTPay += payAmount;
    }
    for (const p of Object.values(paymentMap)) { p.totalOTPay = Math.round(p.totalOTPay * 100) / 100; p.exceedsOneThird = p.totalOTPay > (p.salary / 3); }
    return res.json({ success: true, data: Object.values(paymentMap) });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER CELL EDIT ----
app.post('/roster/cell-edit', authenticate, requireRole('admin', 'superadmin'), async (req: AuthReq, res) => {
  try {
    const { month, date, slot, employeeName } = req.body;
    const roster = await RosterSheet.findOne({ month, type: 'original' });
    if (!roster) return res.status(404).json({ success: false, error: 'Jadual tidak dijumpai' });
    const rowIndex = roster.rows.findIndex((r: { date: string; slotType: string }) => r.date === date && r.slotType === slot);
    const oldRow = rowIndex >= 0 ? roster.rows[rowIndex] : null;
    let employee = null;
    if (employeeName && employeeName.trim()) {
      employee = await Employee.findOne({ name: { $regex: new RegExp(`^${employeeName.trim()}$`, 'i') }, active: true });
      if (!employee) return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
    }
    await RosterChangeLog.create({
      month, changedAt: new Date(), changedByEmail: req.session?.name || '', changedByName: req.session?.name || '',
      changedByRole: req.session?.role || '', date, slot, oldEmployee: oldRow?.employeeName || '',
      newEmployee: employee?.name || '', oldDept: oldRow?.department || '', newDept: employee?.department || '',
      oldRole: oldRow?.role || '', newRole: employee?.role || '', oldHours: oldRow?.hours || 0,
      newHours: employee ? (oldRow?.hours || 0) : 0, action: employee ? (oldRow?.employeeId ? 'UPDATE' : 'ASSIGN') : 'CLEAR',
    });
    if (employee && oldRow) { oldRow.employeeId = employee.employeeId; oldRow.employeeName = employee.name; oldRow.department = employee.department; oldRow.role = employee.role; }
    else if (!employee && rowIndex >= 0) roster.rows.splice(rowIndex, 1);
    await roster.save();
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ROSTER COPY ----
app.post('/roster/copy/generate', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { month } = req.body;
    const original = await RosterSheet.findOne({ month, type: 'original' });
    if (!original) return res.status(404).json({ success: false, error: 'Jadual asal tidak dijumpai' });
    await RosterSheet.deleteMany({ month, type: 'copy' });
    await RosterSheet.create({ month, type: 'copy', rows: [...original.rows], createdAt: new Date() });
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.post('/roster/copy-edit', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { month, date, slotType, employeeName } = req.body;
    let roster = await RosterSheet.findOne({ month, type: 'copy' });
    if (!roster) {
      const original = await RosterSheet.findOne({ month, type: 'original' });
      if (!original) return res.status(404).json({ success: false, error: 'Jadual asal tidak dijumpai' });
      roster = await RosterSheet.create({ month, type: 'copy', rows: [...original.rows], createdAt: new Date() });
    }
    const rowIndex = roster.rows.findIndex((r: { date: string; slotType: string }) => r.date === date && r.slotType === slotType);
    let employee = null;
    if (employeeName && employeeName.trim()) {
      employee = await Employee.findOne({ name: { $regex: new RegExp(`^${employeeName.trim()}$`, 'i') }, active: true });
      if (!employee) return res.status(404).json({ success: false, error: 'Kakitangan tidak dijumpai' });
    }
    if (employee) {
      const hours: Record<string, number> = { AE: 9, IPP_1: 4, IPP_2: 7, IPP_3: 7, IPP_4: 7, OPD_1: 4, OPD_2: 4, OPD_3: 4, OPD_4: 7, OPD_5: 7, PP_PPF: 6, PP_PRA_1: 6, PP_PRA_2: 6 };
      if (rowIndex >= 0) { roster.rows[rowIndex].employeeId = employee.employeeId; roster.rows[rowIndex].employeeName = employee.name; roster.rows[rowIndex].department = employee.department; roster.rows[rowIndex].role = employee.role; }
      else { const dow = new Date(date + 'T00:00:00').getDay(); const dn = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu']; roster.rows.push({ date, day: dn[dow], slotType, employeeId: employee.employeeId, employeeName: employee.name, department: employee.department, role: employee.role, hours: hours[slotType] || 4 }); }
    } else if (rowIndex >= 0) roster.rows.splice(rowIndex, 1);
    await roster.save();
    return res.json({ success: true });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- DASHBOARD ----
app.get('/dashboard/admin', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const [employees, holidays, aeAssignments, preselections, roster, rosterCopy, changeLog] = await Promise.all([
      Employee.find().sort({ employeeId: 1 }), Holiday.find({ month }).sort({ date: 1 }),
      AEAssignment.find({ month }).sort({ date: 1 }), Preselection.find({ month }).sort({ date: 1 }),
      RosterSheet.findOne({ month, type: 'original' }), RosterSheet.findOne({ month, type: 'copy' }),
      RosterChangeLog.find({ month }).sort({ changedAt: -1 }).limit(50),
    ]);
    return res.json({ success: true, data: { employees, holidays, aeAssignments, preselections, rosterExists: !!roster, rosterCopyExists: !!rosterCopy, changeLog, month } });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.get('/dashboard/employee', authenticate, async (req: AuthReq, res) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const empName = req.session?.name || '';
    const [profile, roster, unavailability] = await Promise.all([
      Employee.findOne({ name: empName, active: true }).select('-password'),
      RosterSheet.findOne({ month, type: 'original' }), Unavailability.find({ employeeId: empName }),
    ]);
    const schedule = roster?.rows.filter((r: { employeeName: string }) => r.employeeName.toLowerCase() === empName.toLowerCase()) || [];
    return res.json({ success: true, data: { profile, schedule, unavailability: unavailability.filter(u => u.date.startsWith(month)), month } });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- WORKSPACE ----
app.get('/workspace', authenticate, async (req: AuthReq, res) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const empName = req.session?.name || '';
    const [employee, roster, unavail, holidays] = await Promise.all([
      Employee.findOne({ name: empName, active: true }).select('-password'),
      RosterSheet.findOne({ month, type: 'original' }), Unavailability.find({ employeeId: empName }), Holiday.find(),
    ]);
    const empRows = roster?.rows.filter((r: { employeeName: string }) => r.employeeName.toLowerCase() === empName.toLowerCase()) || [];
    return res.json({ success: true, data: { employee, roster: empRows, unavailability: unavail.filter(u => u.date.startsWith(month)), holidays, month } });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- PROFILE ----
app.get('/profile', authenticate, async (req: AuthReq, res) => {
  try {
    const employee = await Employee.findOne({ name: req.session?.name, active: true }).select('-password');
    if (!employee) return res.json({ success: true, data: null });
    return res.json({ success: true, data: employee });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.put('/profile', authenticate, async (req: AuthReq, res) => {
  try {
    const { Name, Email, Department, Salary } = req.body;
    const updates: Record<string, unknown> = {};
    if (Name) updates.name = Name;
    if (Email) updates.email = Email.toLowerCase();
    if (Department) updates.department = Department;
    if (Salary !== undefined) updates.salary = Salary;
    const employee = await Employee.findOneAndUpdate({ name: req.session?.name, active: true }, updates, { new: true }).select('-password');
    if (!employee) return res.status(404).json({ success: false, error: 'Profil tidak dijumpai' });
    return res.json({ success: true, data: employee });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- SETTINGS ----
app.get('/settings', authenticate, requireRole('admin', 'superadmin'), async (_req, res) => {
  try {
    const configs = await Config.find();
    const configMap: Record<string, string> = {};
    for (const c of configs) configMap[c.key] = c.value;
    return res.json({ success: true, data: configMap });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

app.put('/settings/admin', authenticate, requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { cutoffDay, adminName, adminPassword, ...otherSettings } = req.body;
    if (cutoffDay !== undefined) await Config.findOneAndUpdate({ key: 'UnavailabilityCutoffDay' }, { key: 'UnavailabilityCutoffDay', value: String(cutoffDay) }, { upsert: true });
    if (adminName) await Config.findOneAndUpdate({ key: 'AdminName' }, { key: 'AdminName', value: adminName }, { upsert: true });
    if (adminPassword) await Config.findOneAndUpdate({ key: 'AdminPassword' }, { key: 'AdminPassword', value: sha256Hash(adminPassword) }, { upsert: true });
    for (const [key, value] of Object.entries(otherSettings)) {
      if (value !== undefined && value !== null) await Config.findOneAndUpdate({ key }, { key, value: String(value) }, { upsert: true });
    }
    const configs = await Config.find();
    const configMap: Record<string, string> = {};
    for (const c of configs) configMap[c.key] = c.value;
    return res.json({ success: true, data: configMap });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- ANNUAL ALLOCATION ----
app.get('/annual-allocation', authenticate, async (req, res) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
    const employees = await Employee.find({ active: true }).sort({ employeeId: 1 });
    return res.json({ success: true, data: { employees: employees.map(e => ({ ...e.toObject(), totalAssignments: 0 })), month } });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- SOLVER METRICS ----
app.get('/solver-metrics', authenticate, requireRole('superadmin'), async (req, res) => {
  try {
    const filter: Record<string, Record<string, string>> = {};
    if (req.query.monthFrom || req.query.monthTo) {
      filter.month = {};
      if (req.query.monthFrom) filter.month.$gte = req.query.monthFrom as string;
      if (req.query.monthTo) filter.month.$lte = req.query.monthTo as string;
    }
    const metrics = await SolverMetric.find(filter).sort({ generatedAt: -1 }).limit(parseInt(req.query.limit as string) || 200);
    return res.json({ success: true, data: metrics });
  } catch { return res.status(500).json({ success: false, error: 'Ralat pelayan' }); }
});

// ---- HEALTH ----
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ============================================
// VERCEL SERVERLESS HANDLER
// ============================================
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDB();
  return app(req as any, res as any);
}