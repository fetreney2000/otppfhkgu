import mongoose, { Schema, Document } from 'mongoose';

// ============================================
// EMPLOYEE MODEL
// ============================================
export interface IEmployee extends Document {
  employeeId: string;
  name: string;
  department: 'IPP' | 'OPD';
  role: 'PPF' | 'PRA';
  email: string;
  maxHoursPerMonth: number;
  salary: number;
  active: boolean;
  password: string;
  annualAE: number;
  annualHalfPaidAE: number;
  annualPaidAE: number;
  annualPHAE: number;
  annualPH: number;
}

const EmployeeSchema = new Schema<IEmployee>({
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

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);

// ============================================
// CONFIG MODEL
// ============================================
export interface IConfig extends Document {
  key: string;
  value: string;
}

const ConfigSchema = new Schema<IConfig>({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
});

export const Config = mongoose.model<IConfig>('Config', ConfigSchema);

// ============================================
// HOLIDAY MODEL
// ============================================
export interface IHoliday extends Document {
  date: string;
  name: string;
  month: string;
}

const HolidaySchema = new Schema<IHoliday>({
  date: { type: String, required: true, index: true },
  name: { type: String, required: true },
  month: { type: String, required: true, index: true },
});

HolidaySchema.index({ date: 1 }, { unique: true });

export const Holiday = mongoose.model<IHoliday>('Holiday', HolidaySchema);

// ============================================
// AE ASSIGNMENT MODEL
// ============================================
export interface IAEAssignment extends Document {
  month: string;
  date: string;
  department: 'IPP' | 'OPD';
}

const AEAssignmentSchema = new Schema<IAEAssignment>({
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  department: { type: String, enum: ['IPP', 'OPD'], required: true },
});

AEAssignmentSchema.index({ month: 1, date: 1 }, { unique: true });

export const AEAssignment = mongoose.model<IAEAssignment>('AEAssignment', AEAssignmentSchema);

// ============================================
// PRESELECTION MODEL
// ============================================
export interface IPreselection extends Document {
  month: string;
  date: string;
  slotType: string;
  employeeId: string;
}

const PreselectionSchema = new Schema<IPreselection>({
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  slotType: { type: String, required: true },
  employeeId: { type: String, required: true },
});

PreselectionSchema.index({ month: 1, date: 1, slotType: 1 }, { unique: true });

export const Preselection = mongoose.model<IPreselection>('Preselection', PreselectionSchema);

// ============================================
// UNAVAILABILITY MODEL
// ============================================
export interface IUnavailability extends Document {
  employeeId: string;
  date: string;
  createdAt: Date;
}

const UnavailabilitySchema = new Schema<IUnavailability>({
  employeeId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

UnavailabilitySchema.index({ employeeId: 1, date: 1 }, { unique: true });

export const Unavailability = mongoose.model<IUnavailability>('Unavailability', UnavailabilitySchema);

// ============================================
// ROSTER ARCHIVE MODEL
// ============================================
export interface IRosterArchive extends Document {
  rosterId: string;
  month: string;
  date: string;
  slotType: string;
  employeeId: string;
  hours: number;
  generatedAt: Date;
}

const RosterArchiveSchema = new Schema<IRosterArchive>({
  rosterId: { type: String, required: true },
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  slotType: { type: String, required: true },
  employeeId: { type: String, required: true },
  hours: { type: Number, required: true },
  generatedAt: { type: Date, default: Date.now },
});

RosterArchiveSchema.index({ month: 1, date: 1 });
RosterArchiveSchema.index({ month: 1, employeeId: 1 });

export const RosterArchive = mongoose.model<IRosterArchive>('RosterArchive', RosterArchiveSchema);

// ============================================
// ROSTER SHEET MODEL
// ============================================
export interface IRosterRow {
  date: string;
  day: string;
  slotType: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  hours: number;
}

export interface IRosterSheet extends Document {
  month: string;
  type: 'original' | 'copy';
  rows: IRosterRow[];
  createdAt: Date;
}

const RosterRowSchema = new Schema({
  date: String,
  day: String,
  slotType: String,
  employeeId: String,
  employeeName: String,
  department: String,
  role: String,
  hours: Number,
}, { _id: false });

const RosterSheetSchema = new Schema<IRosterSheet>({
  month: { type: String, required: true, index: true },
  type: { type: String, enum: ['original', 'copy'], required: true },
  rows: [RosterRowSchema],
  createdAt: { type: Date, default: Date.now },
});

RosterSheetSchema.index({ month: 1, type: 1 });

export const RosterSheet = mongoose.model<IRosterSheet>('RosterSheet', RosterSheetSchema);

// ============================================
// ELIGIBILITY LOG MODEL
// ============================================
export interface IEligibilityLog extends Document {
  month: string;
  date: string;
  day: string;
  slot: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  hoursUsed: number;
  maxHours: number;
  remaining: number;
  eligible: boolean;
  reasons: string;
}

const EligibilityLogSchema = new Schema<IEligibilityLog>({
  month: { type: String, required: true, index: true },
  date: { type: String, required: true },
  day: { type: String, required: true },
  slot: { type: String, required: true },
  employeeId: { type: String, required: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, required: true },
  hoursUsed: { type: Number, required: true },
  maxHours: { type: Number, required: true },
  remaining: { type: Number, required: true },
  eligible: { type: Boolean, required: true },
  reasons: { type: String, default: '' },
});

export const EligibilityLog = mongoose.model<IEligibilityLog>('EligibilityLog', EligibilityLogSchema);

// ============================================
// ROSTER CHANGE LOG MODEL
// ============================================
export interface IRosterChangeLog extends Document {
  month: string;
  changedAt: Date;
  changedByEmail: string;
  changedByName: string;
  changedByRole: string;
  date: string;
  slot: string;
  oldEmployee: string;
  newEmployee: string;
  oldDept: string;
  newDept: string;
  oldRole: string;
  newRole: string;
  oldHours: number;
  newHours: number;
  action: 'ASSIGN' | 'UPDATE' | 'CLEAR' | 'SYNC_POST_AE';
}

const RosterChangeLogSchema = new Schema<IRosterChangeLog>({
  month: { type: String, required: true, index: true },
  changedAt: { type: Date, default: Date.now },
  changedByEmail: { type: String, default: '' },
  changedByName: { type: String, default: '' },
  changedByRole: { type: String, default: '' },
  date: { type: String, required: true },
  slot: { type: String, required: true },
  oldEmployee: { type: String, default: '' },
  newEmployee: { type: String, default: '' },
  oldDept: { type: String, default: '' },
  newDept: { type: String, default: '' },
  oldRole: { type: String, default: '' },
  newRole: { type: String, default: '' },
  oldHours: { type: Number, default: 0 },
  newHours: { type: Number, default: 0 },
  action: { type: String, enum: ['ASSIGN', 'UPDATE', 'CLEAR', 'SYNC_POST_AE'], required: true },
});

export const RosterChangeLog = mongoose.model<IRosterChangeLog>('RosterChangeLog', RosterChangeLogSchema);

// ============================================
// SOLVER METRICS MODEL
// ============================================
export interface ISolverMetric extends Document {
  runId: string;
  generatedAt: Date;
  month: string;
  solverMode: string;
  elapsedSeconds: number;
  searchSteps: number;
  searchStepLimit: number;
  timedOut: boolean;
  totalSlots: number;
  assignedSlots: number;
  unfilledSlots: number;
  coveragePct: number;
  hardPenalty: number;
  exceedOneThirdCount: number;
  roleHoursDeviation: number;
  softPenalty: number;
  assignedHours: number;
  utilizationSpread: number;
  warningsCount: number;
  objectiveJson: string;
}

const SolverMetricSchema = new Schema<ISolverMetric>({
  runId: { type: String, required: true, unique: true },
  generatedAt: { type: Date, default: Date.now },
  month: { type: String, required: true, index: true },
  solverMode: { type: String, required: true },
  elapsedSeconds: { type: Number, required: true },
  searchSteps: { type: Number, required: true },
  searchStepLimit: { type: Number, required: true },
  timedOut: { type: Boolean, required: true },
  totalSlots: { type: Number, required: true },
  assignedSlots: { type: Number, required: true },
  unfilledSlots: { type: Number, required: true },
  coveragePct: { type: Number, required: true },
  hardPenalty: { type: Number, required: true },
  exceedOneThirdCount: { type: Number, required: true },
  roleHoursDeviation: { type: Number, required: true },
  softPenalty: { type: Number, required: true },
  assignedHours: { type: Number, required: true },
  utilizationSpread: { type: Number, required: true },
  warningsCount: { type: Number, required: true },
  objectiveJson: { type: String, required: true },
});

export const SolverMetric = mongoose.model<ISolverMetric>('SolverMetric', SolverMetricSchema);

// ============================================
// SESSION MODEL
// ============================================
export interface ISession extends Document {
  token: string;
  name: string;
  role: 'admin' | 'employee' | 'superadmin';
  createdAt: Date;
  expiresAt: Date;
}

const SessionSchema = new Schema<ISession>({
  token: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee', 'superadmin'], required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);