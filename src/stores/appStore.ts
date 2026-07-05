import { create } from 'zustand';
import dayjs from 'dayjs';
import api from '../utils/api';
import type {
  Employee, Holiday, AEAssignment, Preselection,
  DashboardAdminData, DashboardEmployeeData, RosterReport,
  RosterSummaryItem, RosterPaymentItem, SolverInputData,
  SolverProgress, WorkspaceData, AnnualAllocationData, SolverMetric,
  RosterChangeLog, ConfigItem,
} from '../types';

interface AppState {
  // Global
  currentMonth: string;
  setCurrentMonth: (month: string) => void;
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // Admin Dashboard
  adminData: DashboardAdminData | null;
  loadAdminDashboard: (month: string) => Promise<void>;

  // Employee Dashboard
  employeeData: DashboardEmployeeData | null;
  loadEmployeeDashboard: (month: string) => Promise<void>;

  // Employees
  employees: Employee[];
  loadEmployees: () => Promise<void>;
  createEmployee: (data: Partial<Employee>) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  // Holidays
  holidays: Holiday[];
  loadHolidays: (month: string) => Promise<void>;
  addHoliday: (date: string, name: string) => Promise<void>;
  deleteHoliday: (date: string) => Promise<void>;

  // AE Assignments
  aeAssignments: AEAssignment[];
  loadAEAssignments: (month: string) => Promise<void>;
  saveAEAssignments: (month: string, assignments: { date: string; department: string }[]) => Promise<void>;

  // Preselections
  preselections: Preselection[];
  loadPreselections: (month: string) => Promise<void>;
  setPreselection: (month: string, date: string, slotType: string, employeeId: string) => Promise<void>;

  // Roster
  rosterReport: RosterReport | null;
  rosterSummary: RosterSummaryItem[];
  rosterPayment: RosterPaymentItem[];
  rosterExists: boolean;
  rosterCopyExists: boolean;
  loadRosterReport: (month: string, source?: string) => Promise<void>;
  loadRosterSummary: (month: string, source: string) => Promise<void>;
  loadRosterPayment: (month: string, source: string) => Promise<void>;
  checkRosterExists: (month: string) => Promise<boolean>;
  checkRosterCopyExists: (month: string) => Promise<boolean>;
  generateRosterData: (month: string) => Promise<SolverInputData | null>;
  saveRoster: (month: string, assignments: unknown[], objective: unknown, solverMode: string, elapsedSeconds: number, warnings: string[]) => Promise<void>;
  editRosterCell: (month: string, date: string, slot: string, employeeName: string) => Promise<void>;
  editRosterCopyCell: (month: string, date: string, slotType: string, employeeName: string) => Promise<void>;
  generateRosterCopy: (month: string) => Promise<void>;

  // Solver
  solverProgress: SolverProgress | null;
  setSolverProgress: (progress: SolverProgress | null) => void;

  // Workspace
  workspace: WorkspaceData | null;
  loadWorkspace: (month: string) => Promise<void>;

  // Annual Allocation
  annualData: AnnualAllocationData | null;
  loadAnnualAllocation: (month: string) => Promise<void>;

  // Solver Metrics
  solverMetrics: SolverMetric[];
  loadSolverMetrics: (monthFrom: string, monthTo: string) => Promise<void>;

  // Settings
  config: Record<string, string>;
  loadConfig: () => Promise<void>;
  saveSettings: (settings: Record<string, unknown>) => Promise<void>;

  // Change Log
  changeLog: RosterChangeLog[];

  // Loading states
  loading: Record<string, boolean>;
  setLoading: (key: string, value: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentMonth: dayjs().format('YYYY-MM'),
  setCurrentMonth: (month) => set({ currentMonth: month }),
  isOnline: navigator.onLine,
  setOnline: (online) => set({ isOnline: online }),

  adminData: null,
  loadAdminDashboard: async (month) => {
    set({ loading: { ...get().loading, admin: true } });
    try {
      const res = await api.get<{ success: boolean; data: DashboardAdminData }>(`/dashboard/admin?month=${month}`);
      if (res.success) {
        set({
          adminData: res.data,
          employees: res.data.employees,
          holidays: res.data.holidays,
          aeAssignments: res.data.aeAssignments,
          preselections: res.data.preselections,
          rosterExists: res.data.rosterExists,
          rosterCopyExists: res.data.rosterCopyExists,
          changeLog: res.data.changeLog,
        });
      }
    } finally {
      set({ loading: { ...get().loading, admin: false } });
    }
  },

  employeeData: null,
  loadEmployeeDashboard: async (month) => {
    set({ loading: { ...get().loading, employee: true } });
    try {
      const res = await api.get<{ success: boolean; data: DashboardEmployeeData }>(`/dashboard/employee?month=${month}`);
      if (res.success) {
        set({ employeeData: res.data });
      }
    } finally {
      set({ loading: { ...get().loading, employee: false } });
    }
  },

  employees: [],
  loadEmployees: async () => {
    const res = await api.get<{ success: boolean; data: Employee[] }>('/employees');
    if (res.success) set({ employees: res.data });
  },
  createEmployee: async (data) => {
    await api.post('/employees', data);
    await get().loadEmployees();
  },
  updateEmployee: async (id, data) => {
    await api.put(`/employees/${id}`, data);
    await get().loadEmployees();
  },
  deleteEmployee: async (id) => {
    await api.delete(`/employees/${id}`);
    await get().loadEmployees();
  },

  holidays: [],
  loadHolidays: async (month) => {
    const res = await api.get<{ success: boolean; data: Holiday[] }>(`/holidays?month=${month}`);
    if (res.success) set({ holidays: res.data });
  },
  addHoliday: async (date, name) => {
    await api.post('/holidays', { date, name });
    const month = date.substring(0, 7);
    await get().loadHolidays(month);
  },
  deleteHoliday: async (date) => {
    await api.delete(`/holidays/${date}`);
  },

  aeAssignments: [],
  loadAEAssignments: async (month) => {
    const res = await api.get<{ success: boolean; data: AEAssignment[] }>(`/ae-assignments?month=${month}`);
    if (res.success) set({ aeAssignments: res.data });
  },
  saveAEAssignments: async (month, assignments) => {
    const res = await api.post<{ success: boolean; data: AEAssignment[] }>('/ae-assignments/bulk', { month, assignments });
    if (res.success) set({ aeAssignments: res.data });
  },

  preselections: [],
  loadPreselections: async (month) => {
    const res = await api.get<{ success: boolean; data: Preselection[] }>(`/preselections?month=${month}`);
    if (res.success) set({ preselections: res.data });
  },
  setPreselection: async (month, date, slotType, employeeId) => {
    await api.post('/preselections', { month, date, slotType, employeeId });
    await get().loadPreselections(month);
  },

  rosterReport: null,
  rosterSummary: [],
  rosterPayment: [],
  rosterExists: false,
  rosterCopyExists: false,
  loadRosterReport: async (month, source = 'original') => {
    const res = await api.get<{ success: boolean; data: RosterReport }>(`/roster/report?month=${month}&source=${source}`);
    if (res.success) set({ rosterReport: res.data });
  },
  loadRosterSummary: async (month, source) => {
    const res = await api.get<{ success: boolean; data: RosterSummaryItem[] }>(`/roster/summary?month=${month}&source=${source}`);
    if (res.success) set({ rosterSummary: res.data });
  },
  loadRosterPayment: async (month, source) => {
    const res = await api.get<{ success: boolean; data: RosterPaymentItem[] }>(`/roster/payment?month=${month}&source=${source}`);
    if (res.success) set({ rosterPayment: res.data });
  },
  checkRosterExists: async (month) => {
    const res = await api.get<{ success: boolean; exists: boolean }>(`/roster/exists?month=${month}`);
    set({ rosterExists: res.exists });
    return res.exists;
  },
  checkRosterCopyExists: async (month) => {
    const res = await api.get<{ success: boolean; exists: boolean }>(`/roster/copy/exists?month=${month}`);
    set({ rosterCopyExists: res.exists });
    return res.exists;
  },
  generateRosterData: async (month) => {
    const res = await api.post<{ success: boolean; data: SolverInputData }>('/roster/generate', { month });
    if (res.success) return res.data;
    return null;
  },
  saveRoster: async (month, assignments, objective, solverMode, elapsedSeconds, warnings) => {
    await api.post('/roster/save', { month, assignments, objective, solverMode, elapsedSeconds, warnings });
  },
  editRosterCell: async (month, date, slot, employeeName) => {
    await api.post('/roster/cell-edit', { month, date, slot, employeeName });
  },
  editRosterCopyCell: async (month, date, slotType, employeeName) => {
    await api.post('/roster/copy-edit', { month, date, slotType, employeeName });
  },
  generateRosterCopy: async (month) => {
    await api.post('/roster/copy/generate', { month });
  },

  solverProgress: null,
  setSolverProgress: (progress) => set({ solverProgress: progress }),

  workspace: null,
  loadWorkspace: async (month) => {
    const res = await api.get<{ success: boolean; data: WorkspaceData }>(`/workspace?month=${month}`);
    if (res.success) set({ workspace: res.data });
  },

  annualData: null,
  loadAnnualAllocation: async (month) => {
    const res = await api.get<{ success: boolean; data: AnnualAllocationData }>(`/annual-allocation?month=${month}`);
    if (res.success) set({ annualData: res.data });
  },

  solverMetrics: [],
  loadSolverMetrics: async (monthFrom, monthTo) => {
    const res = await api.get<{ success: boolean; data: SolverMetric[] }>(`/solver-metrics?monthFrom=${monthFrom}&monthTo=${monthTo}`);
    if (res.success) set({ solverMetrics: res.data });
  },

  config: {},
  loadConfig: async () => {
    const res = await api.get<{ success: boolean; data: Record<string, string> }>('/settings');
    if (res.success) set({ config: res.data });
  },
  saveSettings: async (settings) => {
    const res = await api.put<{ success: boolean; data: Record<string, string> }>('/settings/admin', settings);
    if (res.success) set({ config: res.data });
  },

  changeLog: [],
  loading: {},
  setLoading: (key, value) => set({ loading: { ...get().loading, [key]: value } }),
}));