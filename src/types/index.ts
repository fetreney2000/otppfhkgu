// ============================================
// SHARED TYPES FOR JADUAL OT BERSEPADU
// ============================================

export type Department = 'IPP' | 'OPD';
export type EmployeeRole = 'PPF' | 'PRA';
export type SessionRole = 'admin' | 'employee' | 'superadmin';
export type DayType = 'weekday' | 'saturday' | 'sunday' | 'holiday';
export type DayKind = 'holiday' | 'weekend' | 'weekday';
export type RosterSheetType = 'original' | 'copy';
export type ChangeAction = 'ASSIGN' | 'UPDATE' | 'CLEAR' | 'SYNC_POST_AE';
export type AESlotCategory = 'sunThu' | 'friSatHol';
export type AEPaymentType = 'paid' | 'unpaid';

export interface Employee {
  _id: string;
  employeeId: string;
  name: string;
  department: Department;
  role: EmployeeRole;
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
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeInput {
  employeeId: string;
  name: string;
  department: Department;
  role: EmployeeRole;
  email: string;
  maxHoursPerMonth?: number;
  salary: number;
  active?: boolean;
  password?: string;
}

export interface ConfigItem {
  _id: string;
  key: string;
  value: string;
}

export interface Holiday {
  _id: string;
  date: string;
  name: string;
  month: string;
}

export interface AEAssignment {
  _id: string;
  month: string;
  date: string;
  department: Department;
}

export interface Preselection {
  _id: string;
  month: string;
  date: string;
  slotType: string;
  employeeId: string;
}

export interface Unavailability {
  _id: string;
  employeeId: string;
  date: string;
  createdAt: string;
}

export interface RosterArchive {
  _id: string;
  rosterId: string;
  month: string;
  date: string;
  slotType: string;
  employeeId: string;
  hours: number;
  generatedAt: string;
}

export interface RosterRow {
  date: string;
  day: string;
  slotType: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  hours: number;
}

export interface RosterSheet {
  _id: string;
  month: string;
  type: RosterSheetType;
  rows: RosterRow[];
  createdAt: string;
}

export interface EligibilityLog {
  _id: string;
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

export interface RosterChangeLog {
  _id: string;
  month: string;
  changedAt: string;
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
  action: ChangeAction;
}

export interface SolverMetric {
  _id: string;
  runId: string;
  generatedAt: string;
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

export interface Session {
  _id: string;
  token: string;
  name: string;
  role: SessionRole;
  createdAt: string;
  expiresAt: string;
}

// ============================================
// SOLVER TYPES
// ============================================

export interface SolverSlot {
  slotType: string;
  department: string | null;
  role: EmployeeRole;
  hours: number;
  date: string;
  dayType: DayType;
}

export interface SolverState {
  assignments: SolverAssignment[];
  hoursUsed: Record<string, number>;
  assignedToday: Record<string, Record<string, boolean>>;
  lastWorkedDay: Record<string, string | null>;
  lastWorkedWasAE: Record<string, boolean>;
  lastSlotType: Record<string, string | null>;
  aeCountThisMonth: Record<string, number>;
  aeCategories: Record<string, Record<string, boolean>>;
  aeDays: Record<string, string[]>;
  weekdaySlotWeekCounts: Record<string, Record<string, number>>;
  monthlyRuleStats: Record<string, MonthlyRuleStats>;
  annualRuleStats: Record<string, AnnualCounters>;
  domain: Record<number, Set<string>>;
  unfilledCount: number;
  unfilledSlots: SolverSlot[];
  postAEBlock: Record<string, Record<string, boolean>>;
  unavailSet?: Set<string>;
}

export interface SolverAssignment {
  date: string;
  day: string;
  slotType: string;
  employeeId: string;
  employeeName: string;
  department: string;
  role: string;
  hours: number;
}

export interface MonthlyRuleStats {
  ippOffdayIpp: number;
  ippWeekdayIpp: number;
  ippWeekdayOpd: number;
  opdOffdayOpd: number;
  opdWeekdayOpd: number;
  holidaySlotsAll: number;
  aeSlotsAll: number;
  aePaidSlotsAll: number;
  aeUnpaidSlotsAll: number;
}

export interface AnnualCounters {
  AnnualAE: number;
  AnnualHalfPaidAE: number;
  AnnualPaidAE: number;
  AnnualPHAE: number;
  AnnualPH: number;
}

export interface SolverObjective {
  hardPenalty: number;
  exceedOneThirdCount: number;
  roleHoursDeviation: number;
  roleStdMax: number;
  softPenalty: number;
  assignedHours: number;
  utilizationSpread: number;
  unfilledCount: number;
}

export interface SolverProgress {
  type: 'progress';
  percent: number;
  stage: string;
  stageLabel: string;
  message: string;
  attempt: number;
  totalAttempts: number;
  bestUnfilled: number;
  validationRound?: number;
  validationViolations?: number;
  validationMaxRounds?: number;
}

export interface SolverResult {
  type: 'result';
  success: boolean;
  warnings: string[];
  unfilledCount: number;
  assignments: SolverAssignment[];
  elapsedSeconds: number;
  solverMode: string;
  objective: SolverObjective;
}

export interface SolverMessage {
  type: 'cancel' | 'start';
  data?: SolverInputData;
}

export interface SolverInputData {
  month: string;
  employees: Employee[];
  holidays: Holiday[];
  aeAssignments: AEAssignment[];
  preselections: Preselection[];
  unavailability: Unavailability[];
  archive: RosterArchive[];
  config: Record<string, string>;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface LoginResponse {
  success: boolean;
  role?: SessionRole;
  token?: string;
  redirectUrl?: string;
  error?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardAdminData {
  employees: Employee[];
  holidays: Holiday[];
  aeAssignments: AEAssignment[];
  preselections: Preselection[];
  rosterExists: boolean;
  rosterCopyExists: boolean;
  changeLog: RosterChangeLog[];
  month: string;
}

export interface DashboardEmployeeData {
  profile: Employee;
  schedule: RosterRow[];
  unavailability: Unavailability[];
  month: string;
}

export interface RosterReport {
  roster: RosterSheet | null;
  summary: RosterSummaryItem[];
  log: EligibilityLog[];
  unfilled: RosterRow[];
}

export interface RosterSummaryItem {
  employeeId: string;
  name: string;
  department: string;
  role: string;
  totalHours: number;
  slotCount: number;
  aeCount: number;
  holidayCount: number;
  weekendCount: number;
  weekdayCount: number;
}

export interface RosterPaymentItem {
  employeeId: string;
  name: string;
  department: string;
  role: string;
  salary: number;
  hourlyRate: number;
  totalOTPay: number;
  exceedsOneThird: boolean;
  slotDetails: PaymentSlotDetail[];
}

export interface PaymentSlotDetail {
  date: string;
  slotType: string;
  hours: number;
  multiplier: number;
  payAmount: number;
  dayType: string;
}

export interface WorkspaceData {
  employee: Employee;
  roster: RosterRow[];
  unavailability: Unavailability[];
  holidays: Holiday[];
  month: string;
}

export interface AnnualAllocationData {
  employees: (Employee & {
    totalAssignments: number;
    annualAE: number;
    annualHalfPaidAE: number;
    annualPaidAE: number;
    annualPHAE: number;
    annualPH: number;
  })[];
  month: string;
}

// ============================================
// SOLVER CONFIG DEFAULTS
// ============================================

export const SOLVER_DEFAULTS: Record<string, string> = {
  SOLVER_MAX_STEPS: '800000',
  SOLVER_MAX_RUNTIME_MS: '120000',
  SOLVER_BEAM_WIDTH: '50',
  SOLVER_CONSTRUCTIVE_RESTARTS: '3000',
  SOLVER_PROGRESS_INTERVAL: '500',
  TARGET_ROLE_STD_DEV: '7',
  RULE_MIN_IPP_OFFDAY_IPP: '2',
  RULE_MIN_IPP_WEEKDAY_IPP: '2',
  RULE_MIN_OPD_OFFDAY_OPD: '2',
  RULE_MAX_IPP_WEEKDAY_OPD: '4',
  RULE_MAX_OPD_WEEKDAY_OPD: '7',
  RULE_MAX_HOLIDAY_SLOTS_ALL: '2',
  RULE_MAX_AE_SLOTS_ALL: '2',
  RULE_MAX_AE_PAID_PER_MONTH: '1',
  RULE_MAX_AE_UNPAID_PER_MONTH: '1',
  RULE_MAX_WEEKDAY_OPD_IPP_DAYS: '2',
  PENALTY_WEIGHT_HARD_HOLIDAY: '80',
  PENALTY_WEIGHT_HARD_AE: '120',
  PENALTY_WEIGHT_HARD_DEPT_MAX: '70',
  PENALTY_WEIGHT_SOFT_MIN_DEFICIT: '35',
  PENALTY_WEIGHT_SOFT_ANNUAL_SPREAD: '4',
  PENALTY_WEIGHT_SOFT_UTIL_DEVIATION: '240',
  PENALTY_WEIGHT_SOFT_ROLE_DEV: '10',
  PENALTY_WEIGHT_SOFT_EXCEED_SALARY: '300',
  PENALTY_WEIGHT_SOFT_ROLE_STD_OVER: '2000',
  PENALTY_WEIGHT_HARD_ROLE_STD: '500',
};

export const SLOT_HOURS: Record<string, number> = {
  AE: 9,
  IPP_1: 4,
  IPP_2: 7,
  IPP_3: 7,
  IPP_4: 7,
  OPD_1: 4,
  OPD_2: 4,
  OPD_3: 4,
  OPD_4: 7,
  OPD_5: 7,
  PP_PPF: 6,
  PP_PRA_1: 6,
  PP_PRA_2: 6,
};

export const WEEKDAY_NAMES: Record<number, string> = {
  0: 'Ahad',
  1: 'Isnin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Khamis',
  5: 'Jumaat',
  6: 'Sabtu',
};

export const MONTH_NAMES_MS: string[] = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember',
];