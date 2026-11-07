import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  FileText,
  Plus,
  Search,
  CheckCircle2,
  Truck,
  Printer,
  X,
  UserCheck,
  Wallet,
  Check,
  Trash2,
  Edit,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { HrService, LorryService } from '../services/api';
import {
  Employee,
  SalaryAdvance,
  Payroll,
  HrPayrollSummary,
  EmployeeDepartment,
  EmploymentType,
  AttendanceStatus,
  Lorry
} from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { PayslipModal } from '../components/PayslipModal';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const HrPayroll: React.FC = () => {
  const { formatMoney } = useCurrency();

  // Active top tab
  const [activeTab, setActiveTab] = useState<'staff' | 'attendance' | 'advances' | 'payroll'>('staff');

  // Summary State
  const [summary, setSummary] = useState<HrPayrollSummary | null>(null);

  // Employees State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empSearch, setEmpSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [lorries, setLorries] = useState<Lorry[]>([]);

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [attendanceMap, setAttendanceMap] = useState<Record<string, { status: AttendanceStatus; otHours: number; notes: string }>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);

  // Advances State
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);

  // Payroll State
  const currentDate = new Date();
  const [payrollMonth, setPayrollMonth] = useState<number>(currentDate.getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(currentDate.getFullYear());
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [activePayslip, setActivePayslip] = useState<Payroll | null>(null);

  // Modals
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isRunPayrollModalOpen, setIsRunPayrollModalOpen] = useState(false);
  const [syncingStaff, setSyncingStaff] = useState(false);

  // Load summary and initial data
  const loadSummary = async () => {
    try {
      const sum = await HrService.getSummary();
      setSummary(sum);
    } catch (e) {
      console.error('Failed to load HR summary', e);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await HrService.getEmployees();
      setEmployees(data);
    } catch (e) {
      console.error('Failed to load employees', e);
    }
  };

  const handleSyncStaff = async () => {
    setSyncingStaff(true);
    try {
      await HrService.syncStaff();
      await loadEmployees();
      await loadSummary();
      alert('Staff directory synchronized! Sales Reps and Lorry Drivers auto-assigned from fleet.');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to sync staff');
    } finally {
      setSyncingStaff(false);
    }
  };

  const loadLorries = async () => {
    try {
      const data = await LorryService.getAll();
      setLorries(data);
    } catch (e) {
      console.error('Failed to load lorries', e);
    }
  };

  const loadAttendance = async (dateStr: string) => {
    try {
      const response: any = await HrService.getAttendance({ date: dateStr });
      const records: any[] = Array.isArray(response)
        ? response
        : Array.isArray(response?.attendances)
        ? response.attendances
        : [];

      const map: Record<string, { status: AttendanceStatus; otHours: number; notes: string }> = {};
      records.forEach((r: any) => {
        const rawStatus = r.status === 'PENDING' ? 'PRESENT' : r.status;
        map[r.employeeId] = {
          status: (rawStatus || 'PRESENT') as AttendanceStatus,
          otHours: Number(r.otHours) || 0,
          notes: r.notes || ''
        };
      });

      // Ensure all loaded active employees have an initialized slot in attendanceMap
      employees.forEach((emp) => {
        if (!map[emp.id]) {
          map[emp.id] = { status: 'PRESENT', otHours: 0, notes: '' };
        }
      });

      setAttendanceMap(map);
    } catch (e) {
      console.error('Failed to load attendance', e);
    }
  };

  const loadAdvances = async () => {
    try {
      const data = await HrService.getAdvances();
      setAdvances(data);
    } catch (e) {
      console.error('Failed to load advances', e);
    }
  };

  const loadPayrolls = async (m: number, y: number) => {
    try {
      const data = await HrService.getPayrolls({ month: m, year: y });
      setPayrolls(data);
    } catch (e) {
      console.error('Failed to load payrolls', e);
    }
  };

  useEffect(() => {
    loadSummary();
    loadEmployees();
    loadLorries();
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendance(attendanceDate);
    } else if (activeTab === 'advances') {
      loadAdvances();
    } else if (activeTab === 'payroll') {
      loadPayrolls(payrollMonth, payrollYear);
    }
  }, [activeTab, attendanceDate, payrollMonth, payrollYear, employees.length]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        !empSearch ||
        emp.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.employeeNumber.toLowerCase().includes(empSearch.toLowerCase()) ||
        emp.phone.includes(empSearch) ||
        (emp.designation && emp.designation.toLowerCase().includes(empSearch.toLowerCase()));

      const matchesDept = selectedDept === 'ALL' || emp.department === selectedDept;

      return matchesSearch && matchesDept;
    });
  }, [employees, empSearch, selectedDept]);

  // Attendance helpers
  const handleSetAttendanceStatus = (empId: string, status: AttendanceStatus) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: {
        status,
        otHours: prev[empId]?.otHours || 0,
        notes: prev[empId]?.notes || ''
      }
    }));
  };

  const handleSetOtHours = (empId: string, otHours: number) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [empId]: {
        status: prev[empId]?.status || 'PRESENT',
        otHours: Math.max(0, otHours),
        notes: prev[empId]?.notes || ''
      }
    }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, { status: AttendanceStatus; otHours: number; notes: string }> = {};
    employees.filter((e) => e.status === 'ACTIVE').forEach((emp) => {
      updated[emp.id] = {
        status: 'PRESENT',
        otHours: attendanceMap[emp.id]?.otHours || 0,
        notes: attendanceMap[emp.id]?.notes || ''
      };
    });
    setAttendanceMap(updated);
  };

  const handleSaveAttendance = async () => {
    setAttendanceSaving(true);
    try {
      const activeEmps = employees.filter((e) => e.status === 'ACTIVE');
      const records = activeEmps.map((emp) => {
        const data = attendanceMap[emp.id] || { status: 'PRESENT', otHours: 0, notes: '' };
        return {
          employeeId: emp.id,
          status: data.status,
          otHours: data.otHours,
          notes: data.notes
        };
      });

      await HrService.bulkAttendance({ records, date: attendanceDate });
      await loadAttendance(attendanceDate);
      await loadSummary();
      alert(`Attendance saved successfully for ${records.length} staff members on ${attendanceDate}!`);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save attendance');
    } finally {
      setAttendanceSaving(false);
    }
  };

  // Delete advance
  const handleDeleteAdvance = async (id: string) => {
    if (!window.confirm('Delete this advance record? If linked to an Expense, it will be removed.')) return;
    try {
      await HrService.deleteAdvance(id);
      loadAdvances();
      loadSummary();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete advance');
    }
  };

  // Update payroll status to PAID
  const handleMarkPayrollPaid = async (payrollId: string) => {
    try {
      await HrService.updatePayrollStatus(payrollId, {
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        paidAt: new Date().toISOString()
      });
      loadPayrolls(payrollMonth, payrollYear);
      loadSummary();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to update payroll status');
    }
  };

  const handleDeletePayroll = async (payrollId: string) => {
    if (!window.confirm('Delete this payslip? Any deducted advances will be unlinked back to PENDING.')) return;
    try {
      await HrService.deletePayroll(payrollId);
      loadPayrolls(payrollMonth, payrollYear);
      loadSummary();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete payroll');
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete staff member "${name}"?`)) return;
    try {
      await HrService.deleteEmployee(id);
      loadEmployees();
      loadSummary();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to delete employee');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Title & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Staff & Payroll
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              All-In-One HR
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage distribution employees, daily attendance, cash advances, and monthly salary payslips.
          </p>
        </div>

        {/* Action Buttons based on Tab */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'staff' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncStaff}
                disabled={syncingStaff}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                title="Automatically detect and import Sales Reps & Lorry Drivers from fleet"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${syncingStaff ? 'animate-spin' : ''}`} />
                <span>Sync Fleet & Reps</span>
              </button>

              <button
                onClick={() => {
                  setEditingEmployee(null);
                  setIsEmployeeModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Staff Member</span>
              </button>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllPresent}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Mark All Present</span>
              </button>
              <button
                onClick={handleSaveAttendance}
                disabled={attendanceSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {attendanceSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Save Attendance</span>
              </button>
            </div>
          )}

          {activeTab === 'advances' && (
            <button
              onClick={() => setIsAdvanceModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Give Cash Advance</span>
            </button>
          )}

          {activeTab === 'payroll' && (
            <button
              onClick={() => setIsRunPayrollModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Payslip</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Staff
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary?.activeEmployees ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                / {summary?.totalEmployees ?? 0} active
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Present Today
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {summary?.todayPresentCount ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                staff checked-in
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Active Advances
            </span>
            <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
              {formatMoney(summary?.pendingAdvancesTotal ?? 0)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Month Payroll Expense
            </span>
            <div className="text-xl font-bold text-indigo-600 mt-1 font-mono">
              {formatMoney(summary?.currentMonthPayrollTotal ?? 0)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Clean Segmented Tab Bar */}
      <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-2xl w-fit text-xs font-semibold">
        <button
          onClick={() => setActiveTab('staff')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'staff' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory</span>
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'attendance' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily Attendance</span>
        </button>

        <button
          onClick={() => setActiveTab('advances')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'advances' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Salary Advances</span>
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition cursor-pointer ${
            activeTab === 'payroll' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Payroll & Payslips</span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: STAFF DIRECTORY */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'staff' && (
        <div className="space-y-4">
          {/* Auto-Detection Notification Banner */}
          <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/90 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold block text-slate-900 text-[12.5px]">Auto-Synced Fleet & Reps</span>
                <span className="text-slate-600 text-[11px]">
                  Sales Reps and Lorry Drivers added in Fleet & Settings are automatically detected, linked to their lorries, and populated in this directory.
                </span>
              </div>
            </div>

            <button
              onClick={handleSyncStaff}
              disabled={syncingStaff}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${syncingStaff ? 'animate-spin' : ''}`} />
              <span>{syncingStaff ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search staff by name, ID, phone..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-medium">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                <option value="ALL">All Departments</option>
                <option value="SALES_FLEET">Sales Fleet</option>
                <option value="WAREHOUSE">Warehouse</option>
                <option value="MANUFACTURING">Manufacturing</option>
                <option value="ADMIN">Admin / Office</option>
              </select>
            </div>
          </div>

          {/* Staff Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Designation & Dept</th>
                    <th className="py-3 px-4">Salary Structure</th>
                    <th className="py-3 px-4">Assigned Fleet</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                        <p className="font-medium text-sm">No employees found</p>
                        <p className="text-xs">Click "Add Staff Member" above to create an employee.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const assignedLorry = lorries.find((l) => l.id === emp.lorryId);
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{emp.fullName}</span>
                              {emp.userId && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  Rep App User
                                </span>
                              )}
                              {!emp.userId && emp.designation?.toLowerCase().includes('driver') && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  Fleet Driver
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] font-mono mt-0.5">
                              {emp.employeeNumber} &bull; {emp.phone}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-800">{emp.designation}</span>
                            <div className="text-[11px] text-slate-400">
                              {emp.department === 'SALES_FLEET'
                                ? 'Sales Fleet'
                                : emp.department === 'MANUFACTURING'
                                ? 'Manufacturing'
                                : emp.department === 'WAREHOUSE'
                                ? 'Warehouse'
                                : 'Admin'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {emp.employmentType === 'DAILY_WAGE' ? (
                              <div>
                                <span className="font-semibold text-slate-900">{formatMoney(emp.dailyRate)}</span>
                                <span className="text-[10px] text-slate-400 block font-sans">Daily Wage Rate</span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-slate-900">{formatMoney(emp.basicSalary)}</span>
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  Basic + {formatMoney(emp.allowances)} Allow
                                </span>
                              </div>
                            )}
                            {emp.commissionRate > 0 && (
                              <div className="text-[10.5px] font-sans font-semibold text-blue-600 mt-0.5">
                                +{emp.commissionRate}% Sales Commission
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {assignedLorry ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg text-[11px] border border-blue-100">
                                  <Truck className="w-3 h-3" />
                                  {assignedLorry.vehicleNumber}
                                </span>
                                {assignedLorry.driverName && emp.designation?.toLowerCase().includes('rep') && (
                                  <span className="text-[10px] text-slate-400 block">
                                    Driver: {assignedLorry.driverName}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Not assigned</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
                                emp.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {emp.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingEmployee(emp);
                                  setIsEmployeeModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Edit Employee"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Employee"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: DAILY ATTENDANCE */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Date Selector & Status Helper */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600" /> Attendance Date:
              </span>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark All Present</span>
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={attendanceSaving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {attendanceSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Attendance</span>
              </button>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Status Toggle</th>
                    <th className="py-3 px-4 text-center">OT Hours</th>
                    <th className="py-3 px-4">Notes / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees
                    .filter((e) => e.status === 'ACTIVE')
                    .map((emp) => {
                      const entry = attendanceMap[emp.id] || { status: 'PRESENT', otHours: 0, notes: '' };
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 text-sm">{emp.fullName}</span>
                            <span className="text-slate-400 text-[11px] block font-mono">
                              {emp.employeeNumber} &bull; {emp.designation}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {emp.department === 'SALES_FLEET'
                              ? 'Sales Fleet'
                              : emp.department === 'MANUFACTURING'
                              ? 'Manufacturing'
                              : emp.department === 'WAREHOUSE'
                              ? 'Warehouse'
                              : 'Admin'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {(['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE'] as AttendanceStatus[]).map((status) => {
                                const isSelected = entry.status === status;
                                return (
                                  <button
                                    key={status}
                                    type="button"
                                    onClick={() => handleSetAttendanceStatus(emp.id, status)}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                                      isSelected
                                        ? status === 'PRESENT'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : status === 'HALF_DAY'
                                          ? 'bg-amber-500 text-white shadow-xs'
                                          : status === 'ABSENT'
                                          ? 'bg-rose-600 text-white shadow-xs'
                                          : 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {status === 'PRESENT'
                                      ? 'Present'
                                      : status === 'HALF_DAY'
                                      ? 'Half Day'
                                      : status === 'ABSENT'
                                      ? 'Absent'
                                      : 'Leave'}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                max="16"
                                step="0.5"
                                value={entry.otHours}
                                onChange={(e) => handleSetOtHours(emp.id, parseFloat(e.target.value) || 0)}
                                className="w-16 text-center py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                              />
                              <span className="text-[11px] text-slate-400">hrs</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              placeholder="Optional remarks..."
                              value={entry.notes}
                              onChange={(e) =>
                                setAttendanceMap((prev) => ({
                                  ...prev,
                                  [emp.id]: {
                                    ...entry,
                                    notes: e.target.value
                                  }
                                }))
                              }
                              className="w-full py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0071E3]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: SALARY ADVANCES */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'advances' && (
        <div className="space-y-4">
          {/* Helper Notice */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl flex items-center justify-between text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Cross-Wired Accounting:</strong> Cash advances granted here automatically record in{' '}
                <strong>Expenses & Opex</strong> under category <em>SALARIES</em>. When the monthly payslip is generated,
                advances are automatically deducted.
              </span>
            </div>
          </div>

          {/* Advances Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Advance Slip</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Date & Method</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Wallet className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                        <p className="font-medium text-sm">No salary advances recorded</p>
                        <p className="text-xs">Click "Give Cash Advance" above to issue a staff advance.</p>
                      </td>
                    </tr>
                  ) : (
                    advances.map((adv) => (
                      <tr key={adv.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {adv.advanceNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 text-sm">
                            {adv.employee?.fullName || 'Staff'}
                          </span>
                          <span className="text-slate-400 text-[11px] block font-mono">
                            {adv.employee?.employeeNumber}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-amber-600 text-sm">
                          {formatMoney(adv.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>{new Date(adv.date).toLocaleDateString()}</div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">
                            {adv.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {adv.reason || 'Staff Personal Advance'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
                              adv.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {adv.status === 'PENDING' ? 'Pending Deduction' : 'Deducted in Payslip'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {adv.status === 'PENDING' && (
                            <button
                              onClick={() => handleDeleteAdvance(adv.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Advance"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: PAYROLL & PAYSLIPS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Month & Year Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">Payroll Period:</span>
              <select
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={payrollYear}
                onChange={(e) => setPayrollYear(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500">
              Total Payslips Generated: <strong>{payrolls.length}</strong>
            </div>
          </div>

          {/* Payrolls Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
                    <th className="py-3 px-4">Payslip No</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">Gross Earnings</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Net Payable</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrolls.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                        <p className="font-medium text-sm">No payroll generated for {MONTH_NAMES[payrollMonth - 1]} {payrollYear}</p>
                        <p className="text-xs">Click "Generate Payslip" above to run staff payroll with auto-commission.</p>
                      </td>
                    </tr>
                  ) : (
                    payrolls.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {p.payslipNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 text-sm">
                            {p.employee?.fullName || 'Staff'}
                          </span>
                          <span className="text-slate-400 text-[11px] block font-mono">
                            {p.employee?.employeeNumber} &bull; {p.employee?.designation}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          <div>{p.workedDays} Days Worked</div>
                          <span className="text-[10px] text-slate-400">
                            {p.otHours}h OT &bull; {p.leaveDays} Leaves
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                          {formatMoney(p.grossEarnings)}
                          {p.salesCommission > 0 && (
                            <span className="text-[10.5px] text-blue-600 block font-sans">
                              (Comm: {formatMoney(p.salesCommission)})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-rose-600">
                          -{formatMoney(p.totalDeductions)}
                          {p.advancesDeducted > 0 && (
                            <span className="text-[10px] text-slate-400 block font-sans">
                              (Adv: {formatMoney(p.advancesDeducted)})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-blue-600">
                          {formatMoney(p.netPayable)}
                        </td>
                        <td className="py-3.5 px-4">
                          {p.paymentStatus === 'PAID' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Paid
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMarkPayrollPaid(p.id)}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setActivePayslip(p)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="View & Print Payslip"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {p.paymentStatus !== 'PAID' && (
                              <button
                                onClick={() => handleDeletePayroll(p.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Delete Payslip"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {/* ---------------------------------------------------- */}
      {isEmployeeModalOpen && (
        <AddEditEmployeeModal
          employee={editingEmployee}
          lorries={lorries}
          onClose={() => {
            setIsEmployeeModalOpen(false);
            setEditingEmployee(null);
          }}
          onSaved={() => {
            setIsEmployeeModalOpen(false);
            setEditingEmployee(null);
            loadEmployees();
            loadSummary();
          }}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CASH ADVANCE */}
      {/* ---------------------------------------------------- */}
      {isAdvanceModalOpen && (
        <AddSalaryAdvanceModal
          employees={employees.filter((e) => e.status === 'ACTIVE')}
          onClose={() => setIsAdvanceModalOpen(false)}
          onSaved={() => {
            setIsAdvanceModalOpen(false);
            loadAdvances();
            loadSummary();
          }}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: RUN PAYROLL / GENERATE PAYSLIP */}
      {/* ---------------------------------------------------- */}
      {isRunPayrollModalOpen && (
        <RunPayrollModal
          employees={employees.filter((e) => e.status === 'ACTIVE')}
          defaultMonth={payrollMonth}
          defaultYear={payrollYear}
          onClose={() => setIsRunPayrollModalOpen(false)}
          onGenerated={(newPayroll) => {
            setIsRunPayrollModalOpen(false);
            loadPayrolls(payrollMonth, payrollYear);
            loadSummary();
            setActivePayslip(newPayroll);
          }}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: PAYSLIP PREVIEW & THERMAL PRINT */}
      {/* ---------------------------------------------------- */}
      {activePayslip && (
        <PayslipModal
          payroll={activePayslip}
          onClose={() => setActivePayslip(null)}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// SUB-MODAL 1: ADD / EDIT EMPLOYEE
// ----------------------------------------------------------------------
interface AddEditEmployeeModalProps {
  employee: Employee | null;
  lorries: Lorry[];
  onClose: () => void;
  onSaved: () => void;
}

const AddEditEmployeeModal: React.FC<AddEditEmployeeModalProps> = ({
  employee,
  lorries,
  onClose,
  onSaved
}) => {
  const [formData, setFormData] = useState<Partial<Employee>>(() => {
    if (employee) return { ...employee };
    return {
      fullName: '',
      callingName: '',
      nicNumber: '',
      phone: '',
      address: '',
      designation: 'Sales Representative',
      department: 'SALES_FLEET',
      employmentType: 'FULL_TIME',
      joinDate: new Date().toISOString().slice(0, 10),
      status: 'ACTIVE',
      basicSalary: 45000,
      dailyRate: 1500,
      otHourlyRate: 350,
      allowances: 5000,
      commissionRate: 1.5,
      bankName: '',
      branchName: '',
      accountNumber: '',
      epfNumber: '',
      lorryId: ''
    };
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone || !formData.designation) {
      alert('Please fill in required fields (Full Name, Phone, Designation).');
      return;
    }

    setSaving(true);
    try {
      if (employee) {
        await HrService.updateEmployee(employee.id, formData);
      } else {
        await HrService.createEmployee(formData);
      }
      onSaved();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {employee ? 'Edit Staff Member' : 'New Staff Member'}
              </h2>
              <p className="text-xs text-slate-500">Employee profile & salary configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          {/* Personal Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName || ''}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Kamal Perera"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Calling / Nickname</label>
                <input
                  type="text"
                  value={formData.callingName || ''}
                  onChange={(e) => setFormData({ ...formData, callingName: e.target.value })}
                  placeholder="e.g. Kamal"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="077 123 4567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">NIC Number</label>
                <input
                  type="text"
                  value={formData.nicNumber || ''}
                  onChange={(e) => setFormData({ ...formData, nicNumber: e.target.value })}
                  placeholder="e.g. 199012345678"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>
            </div>
          </div>

          {/* Job & Fleet */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Job Role & Fleet Route</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Designation *</label>
                <input
                  type="text"
                  required
                  value={formData.designation || ''}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  placeholder="Sales Rep / Lorry Driver / Storekeeper"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as EmployeeDepartment })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  <option value="SALES_FLEET">Sales Fleet (Rep / Driver)</option>
                  <option value="WAREHOUSE">Warehouse / Logistics</option>
                  <option value="MANUFACTURING">Manufacturing / Bakery</option>
                  <option value="ADMIN">Admin / Management</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Employment Type</label>
                <select
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as EmploymentType })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  <option value="FULL_TIME">Full Time (Monthly Salary)</option>
                  <option value="DAILY_WAGE">Daily Wage Basis</option>
                  <option value="CONTRACT">Contract Basis</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned Lorry (For Commission)</label>
                <select
                  value={formData.lorryId || ''}
                  onChange={(e) => setFormData({ ...formData, lorryId: e.target.value || null })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                >
                  <option value="">No Lorry Assigned</option>
                  {lorries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.vehicleNumber} ({l.driverName})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Salary Structure */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salary & Rates (LKR)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Basic Salary</label>
                <input
                  type="number"
                  min="0"
                  value={formData.basicSalary ?? 0}
                  onChange={(e) => setFormData({ ...formData, basicSalary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Daily Rate</label>
                <input
                  type="number"
                  min="0"
                  value={formData.dailyRate ?? 0}
                  onChange={(e) => setFormData({ ...formData, dailyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">OT Rate / Hr</label>
                <input
                  type="number"
                  min="0"
                  value={formData.otHourlyRate ?? 0}
                  onChange={(e) => setFormData({ ...formData, otHourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Allowances</label>
                <input
                  type="number"
                  min="0"
                  value={formData.allowances ?? 0}
                  onChange={(e) => setFormData({ ...formData, allowances: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Sales Commission Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.commissionRate ?? 0}
                  onChange={(e) => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 1.5"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">EPF Number</label>
                <input
                  type="text"
                  value={formData.epfNumber || ''}
                  onChange={(e) => setFormData({ ...formData, epfNumber: e.target.value })}
                  placeholder="e.g. 1045"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// SUB-MODAL 2: CASH ADVANCE MODAL
// ----------------------------------------------------------------------
interface AddSalaryAdvanceModalProps {
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}

const AddSalaryAdvanceModal: React.FC<AddSalaryAdvanceModalProps> = ({
  employees,
  onClose,
  onSaved
}) => {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [amount, setAmount] = useState<number>(5000);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('Personal Emergency / Mid-month Advance');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || amount <= 0) {
      alert('Please select an employee and enter an amount.');
      return;
    }

    setSaving(true);
    try {
      await HrService.createAdvance({
        employeeId,
        amount,
        date,
        reason,
        paymentMethod
      });
      alert('Cash advance recorded and synced to OPEX expenses!');
      onSaved();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to issue advance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Issue Salary Advance</h2>
              <p className="text-xs text-slate-500">Auto-synced to Expenses & P&L</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Select Employee *</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeNumber} &bull; {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Advance Amount (LKR) *</label>
            <input
              type="number"
              min="100"
              step="100"
              required
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Disbursement Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                <option value="CASH">Cash Drawer</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">Reason / Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Festival Advance, Medical Emergency"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {saving ? 'Disbursing...' : 'Disburse Advance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// SUB-MODAL 3: RUN PAYROLL / GENERATE PAYSLIP MODAL
// ----------------------------------------------------------------------
interface RunPayrollModalProps {
  employees: Employee[];
  defaultMonth: number;
  defaultYear: number;
  onClose: () => void;
  onGenerated: (payroll: Payroll) => void;
}

const RunPayrollModal: React.FC<RunPayrollModalProps> = ({
  employees,
  defaultMonth,
  defaultYear,
  onClose,
  onGenerated
}) => {
  const { formatMoney } = useCurrency();
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [month, setMonth] = useState<number>(defaultMonth);
  const [year, setYear] = useState<number>(defaultYear);

  // Preview data fetched from server calculation engine
  const [preview, setPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Manual Overrides
  const [bonus, setBonus] = useState<number>(0);
  const [otherDeductions, setOtherDeductions] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [autoPayNow, setAutoPayNow] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  const fetchPreview = async () => {
    if (!employeeId) return;
    setLoadingPreview(true);
    try {
      const data = await HrService.getPayrollPreview(employeeId, {
        month,
        year,
        customBonus: bonus,
        customOtherDeductions: otherDeductions
      });
      setPreview(data);
    } catch (e: any) {
      console.error('Failed to preview payroll', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, [employeeId, month, year, bonus, otherDeductions]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview) return;

    setGenerating(true);
    try {
      const result = await HrService.generatePayroll({
        employeeId,
        month,
        year,
        workedDays: preview.workedDays,
        absentDays: preview.absentDays,
        leaveDays: preview.leaveDays,
        otHours: preview.otHours,
        basicSalary: preview.basicSalary,
        otAmount: preview.otAmount,
        allowances: preview.allowances,
        salesCommission: preview.salesCommission,
        performanceBonus: bonus,
        advancesDeducted: preview.advancesDeducted,
        epfDeduction: preview.epfDeduction,
        employerEpf: preview.employerEpf,
        employerEtf: preview.employerEtf,
        otherDeductions,
        paymentMethod,
        autoPayNow
      });
      onGenerated(result);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to generate payroll');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Generate Payslip</h2>
              <p className="text-xs text-slate-500">Auto-calculates attendance, route commission & deductions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleGenerate} className="overflow-y-auto p-6 space-y-4 flex-1">
          {/* Employee & Month Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Employee</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingPreview ? (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500 mb-2" />
              <p className="text-xs font-medium">Calculating payroll breakdown...</p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Attendance Quick Stats */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <span className="text-slate-400 text-[10.5px] block font-medium">Worked</span>
                  <span className="font-bold text-slate-800 text-sm">{preview.workedDays} Days</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10.5px] block font-medium">Absent</span>
                  <span className="font-bold text-rose-600 text-sm">{preview.absentDays} Days</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10.5px] block font-medium">Leave</span>
                  <span className="font-bold text-slate-700 text-sm">{preview.leaveDays} Days</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10.5px] block font-medium">OT Hours</span>
                  <span className="font-bold text-indigo-600 text-sm">{preview.otHours} hrs</span>
                </div>
              </div>

              {/* Earnings & Deductions Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Earnings */}
                <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <div className="font-bold text-slate-600 text-[10.5px] uppercase tracking-wider mb-2">
                    Gross Earnings
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Basic Salary:</span>
                    <span className="font-mono font-medium">{formatMoney(preview.basicSalary)}</span>
                  </div>
                  {preview.otAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">OT Pay:</span>
                      <span className="font-mono font-medium">{formatMoney(preview.otAmount)}</span>
                    </div>
                  )}
                  {preview.allowances > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Allowances:</span>
                      <span className="font-mono font-medium">{formatMoney(preview.allowances)}</span>
                    </div>
                  )}
                  {preview.salesCommission > 0 && (
                    <div className="flex justify-between text-blue-600 font-semibold">
                      <span>Route Commission:</span>
                      <span className="font-mono">{formatMoney(preview.salesCommission)}</span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-slate-200">
                    <label className="text-[10px] text-slate-400 block font-medium">Bonus (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={bonus}
                      onChange={(e) => setBonus(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Deductions */}
                <div className="bg-slate-50/50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5">
                  <div className="font-bold text-rose-500 text-[10.5px] uppercase tracking-wider mb-2">
                    Deductions
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>Salary Advances:</span>
                    <span className="font-mono font-medium">-{formatMoney(preview.advancesDeducted)}</span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>EPF (8%):</span>
                    <span className="font-mono font-medium">-{formatMoney(preview.epfDeduction)}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-200">
                    <label className="text-[10px] text-slate-400 block font-medium">Other Deductions</label>
                    <input
                      type="number"
                      min="0"
                      value={otherDeductions}
                      onChange={(e) => setOtherDeductions(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight Banner */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    Net Take-Home Pay
                  </span>
                  <div className="text-[11px] text-slate-500">
                    Employer EPF: {formatMoney(preview.employerEpf)} | ETF: {formatMoney(preview.employerEtf)}
                  </div>
                </div>
                <div className="text-xl font-black text-blue-700 font-mono">
                  {formatMoney(
                    preview.grossEarnings + bonus - (preview.totalDeductions + otherDeductions)
                  )}
                </div>
              </div>

              {/* Disburse options */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPayNow}
                    onChange={(e) => setAutoPayNow(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Mark as PAID immediately (Records in Cash Expenses)</span>
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>
          ) : null}

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || !preview}
              className="px-5 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {generating ? 'Finalizing Payslip...' : 'Generate & Save Payslip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

