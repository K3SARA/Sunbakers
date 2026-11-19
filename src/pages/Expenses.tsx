import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Fuel,
  Wrench,
  Coffee,
  Building,
  Zap,
  Briefcase,
  Package,
  Wallet,
  Truck,
  Calendar,
  Search,
  Download,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Building2
} from 'lucide-react';
import { ExpenseService, LorryService } from '../services/api';
import { Expense, ExpenseCategory, ExpenseSummary, Lorry } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface CategoryConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  iconClass: string;
}

const CATEGORY_MAP: Record<ExpenseCategory, CategoryConfig> = {
  FUEL: {
    label: 'Fuel & Diesel',
    icon: Fuel,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    iconClass: 'text-amber-600 bg-amber-50'
  },
  VEHICLE_MAINTENANCE: {
    label: 'Vehicle Repair',
    icon: Wrench,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
    iconClass: 'text-blue-600 bg-blue-50'
  },
  DRIVER_ALLOWANCE: {
    label: 'Crew Allowance',
    icon: Coffee,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    iconClass: 'text-emerald-600 bg-emerald-50'
  },
  RENT: {
    label: 'Warehouse Rent',
    icon: Building,
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80',
    iconClass: 'text-violet-600 bg-violet-50'
  },
  UTILITIES: {
    label: 'Utilities & Power',
    icon: Zap,
    badgeClass: 'bg-yellow-50 text-yellow-800 border-yellow-200/80',
    iconClass: 'text-yellow-600 bg-yellow-50'
  },
  SALARIES: {
    label: 'Staff Salaries',
    icon: Briefcase,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    iconClass: 'text-indigo-600 bg-indigo-50'
  },
  PACKAGING: {
    label: 'Packaging & Supplies',
    icon: Package,
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    iconClass: 'text-sky-600 bg-sky-50'
  },
  PETTY_CASH: {
    label: 'Petty Cash',
    icon: Wallet,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80',
    iconClass: 'text-teal-600 bg-teal-50'
  },
  OTHER: {
    label: 'Other Overhead',
    icon: Receipt,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/80',
    iconClass: 'text-slate-600 bg-slate-100'
  }
};

interface ExpensesProps {
  isActive?: boolean;
}

export const Expenses: React.FC<ExpensesProps> = ({ isActive }) => {
  const { formatMoney } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLorryId, setSelectedLorryId] = useState<string>('ALL');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  // Modals & Feedback
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('FUEL');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formPaymentMethod, setFormPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE'>('CASH');
  const [formLorryId, setFormLorryId] = useState<string>('');
  const [formPaidTo, setFormPaidTo] = useState<string>('');
  const [formReferenceNumber, setFormReferenceNumber] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');

  useLiveRefresh(() => {
    loadLorries();
    loadData();
  }, { isActive });

  useEffect(() => {
    loadLorries();
  }, []);

  useEffect(() => {
    loadData();
  }, [dateRange, selectedCategory, selectedLorryId, selectedPaymentMethod, search]);

  const loadLorries = async () => {
    try {
      const list = await LorryService.getAll();
      setLorries(list);
    } catch (err) {
      console.error('Failed to load lorries for expenses', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([
        ExpenseService.getAll({
          from: dateRange.from,
          to: dateRange.to,
          category: selectedCategory,
          lorryId: selectedLorryId,
          paymentMethod: selectedPaymentMethod,
          search: search.trim() || undefined
        }),
        ExpenseService.getSummary(dateRange.from, dateRange.to)
      ]);
      setExpenses(list);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (range: { from: string; to: string; preset: DatePreset }) => {
    setDatePreset(range.preset);
    setDateRange({ from: range.from, to: range.to });
  };

  const getPresetLabel = () => {
    switch (datePreset) {
      case 'today':
        return "Today's";
      case 'yesterday':
        return "Yesterday's";
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        return 'Period';
      default:
        return 'Period';
    }
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormCategory('FUEL');
    setFormTitle('');
    setFormAmount('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormPaymentMethod('CASH');
    setFormLorryId('');
    setFormPaidTo('');
    setFormReferenceNumber('');
    setFormNotes('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setEditingExpense(exp);
    setFormCategory(exp.category);
    setFormTitle(exp.title);
    setFormAmount(exp.amount.toString());
    setFormDate(exp.date ? new Date(exp.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormPaymentMethod(exp.paymentMethod || 'CASH');
    setFormLorryId(exp.lorryId || '');
    setFormPaidTo(exp.paidTo || '');
    setFormReferenceNumber(exp.referenceNumber || '');
    setFormNotes(exp.notes || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(formAmount);
    if (!formTitle.trim()) {
      setErrorMessage('Expense title is required.');
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      setErrorMessage('Please enter a valid expense amount.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        category: formCategory,
        title: formTitle.trim(),
        amount: amountVal,
        date: formDate,
        paymentMethod: formPaymentMethod,
        lorryId: formLorryId || undefined,
        paidTo: formPaidTo.trim() || undefined,
        referenceNumber: formReferenceNumber.trim() || undefined,
        notes: formNotes.trim() || undefined
      };

      if (editingExpense) {
        await ExpenseService.update(editingExpense.id, payload);
        setSuccessMessage(`Expense ${editingExpense.expenseNumber} updated successfully.`);
      } else {
        const created = await ExpenseService.create(payload);
        setSuccessMessage(`Expense ${created.expenseNumber} recorded successfully.`);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, expenseNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete expense ${expenseNumber}?`)) {
      return;
    }
    try {
      await ExpenseService.delete(id);
      setSuccessMessage(`Expense ${expenseNumber} deleted.`);
      loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to delete expense.');
    }
  };

  const exportCSV = () => {
    if (expenses.length === 0) return;
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'EXPENSES & OPERATING EXPENDITURE REPORT\n';
    csv += `Period: ${dateRange.from || 'Start'} to ${dateRange.to || 'Present'}\n\n`;
    csv += 'Expense #,Date,Category,Title,Vehicle,Paid To,Payment Method,Reference #,Amount,Notes\n';

    expenses.forEach((e) => {
      const vPlate = e.lorry ? e.lorry.vehicleNumber : 'Warehouse Overhead';
      const cleanTitle = (e.title || '').replace(/"/g, '""');
      const cleanPaidTo = (e.paidTo || '').replace(/"/g, '""');
      const cleanRef = (e.referenceNumber || '').replace(/"/g, '""');
      const cleanNotes = (e.notes || '').replace(/"/g, '""');
      csv += `"${e.expenseNumber}","${new Date(e.date).toLocaleDateString()}","${e.category}","${cleanTitle}","${vPlate}","${cleanPaidTo}","${e.paymentMethod}","${cleanRef}",${e.amount},"${cleanNotes}"\n`;
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expenses_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-7 pb-24 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span>Operating Expenditures (OPEX)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Expenses & Cash Outflow
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Track fleet fuel, driver allowances, maintenance & warehouse overhead linked to Net Profit.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={exportCSV}
            disabled={expenses.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-2xs transition text-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-2xl shadow-sm transition text-xs shadow-rose-600/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date Range Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900">
              {getPresetLabel()} Expense Breakdown
            </span>
          </div>
        </div>

        <DateRangeFilter
          initialPreset="today"
          onRangeChange={handleDateRangeChange}
        />
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total {getPresetLabel()} Expenses
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <TrendingDown className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 font-mono mt-1">
            {formatMoney(summary?.totalAmount || 0)}
          </div>
          <span className="text-xs text-slate-400 font-medium block mt-1">
            {summary?.totalCount || 0} expense vouchers recorded
          </span>
        </div>

        {/* Fleet Running Costs */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Fleet & Route Running Costs
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Truck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono mt-1">
            {formatMoney(summary?.fleetExpenses || 0)}
          </div>
          <span className="text-xs text-slate-400 font-medium block mt-1">
            Fuel, driver meal allowances & repairs
          </span>
        </div>

        {/* Warehouse Overhead */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Warehouse & Admin Overhead
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono mt-1">
            {formatMoney(summary?.overheadExpenses || 0)}
          </div>
          <span className="text-xs text-slate-400 font-medium block mt-1">
            Rent, utilities, staff salaries & petty cash
          </span>
        </div>

        {/* Cash vs Bank Outflow */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cash Outflow vs Bank
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="space-y-1 mt-1">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
              <span className="text-xs text-slate-500 font-normal">Cash Paid:</span>
              <span className="font-mono text-emerald-600">
                {formatMoney(summary?.byPaymentMethod.find(p => p.paymentMethod === 'CASH')?.amount || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
              <span className="text-xs text-slate-500 font-normal">Bank / Cheque:</span>
              <span className="font-mono text-blue-600">
                {formatMoney(
                  (summary?.byPaymentMethod.find(p => p.paymentMethod === 'BANK_TRANSFER')?.amount || 0) +
                  (summary?.byPaymentMethod.find(p => p.paymentMethod === 'CHEQUE')?.amount || 0)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, receipt #, payee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl text-xs outline-none transition"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl text-xs outline-none transition text-slate-700"
            >
              <option value="ALL">All Categories</option>
              {Object.entries(CATEGORY_MAP).map(([catKey, config]) => (
                <option key={catKey} value={catKey}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* Lorry / Fleet Filter */}
          <div>
            <select
              value={selectedLorryId}
              onChange={(e) => setSelectedLorryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl text-xs outline-none transition text-slate-700"
            >
              <option value="ALL">All Fleet & Overhead</option>
              <option value="OVERHEAD">General Warehouse Overhead Only</option>
              {lorries.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.vehicleNumber} ({l.driverName})
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 focus:border-blue-500 rounded-xl text-xs outline-none transition text-slate-700"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-rose-600" />
            <span>Expense Ledger</span>
            <span className="text-xs font-medium text-slate-400">
              ({expenses.length} records)
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            Syncing expense records...
          </div>
        ) : expenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">No expenses recorded for this period</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Record fuel refills, vehicle maintenance, crew allowances, or warehouse bills to track net profitability.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-rose-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Expense</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Voucher / Date</th>
                  <th className="py-3.5 px-4">Title & Description</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Fleet / Allocation</th>
                  <th className="py-3.5 px-4">Payee & Slip #</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 sm:px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => {
                  const catConfig = CATEGORY_MAP[exp.category] || CATEGORY_MAP.OTHER;
                  const CatIcon = catConfig.icon;

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Voucher & Date */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-800 block">
                          {exp.expenseNumber}
                        </span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {new Date(exp.date).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Title & Notes */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="font-semibold text-slate-900 block truncate">
                          {exp.title}
                        </span>
                        {exp.notes && (
                          <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                            {exp.notes}
                          </span>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${catConfig.badgeClass}`}
                        >
                          <CatIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{catConfig.label}</span>
                        </span>
                      </td>

                      {/* Lorry / Allocation */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {exp.lorry ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-md">
                              {exp.lorry.vehicleNumber}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              {exp.lorry.driverName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">
                            Warehouse Overhead
                          </span>
                        )}
                      </td>

                      {/* Payee & Ref Slip */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {exp.paidTo && (
                          <span className="text-slate-800 font-medium block">
                            {exp.paidTo}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="uppercase font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                            {exp.paymentMethod}
                          </span>
                          {exp.referenceNumber && (
                            <span className="font-mono">#{exp.referenceNumber}</span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-mono text-sm font-bold text-rose-600 block">
                          {formatMoney(exp.amount)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(exp)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Expense"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(exp.id, exp.expenseNumber)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record / Edit Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingExpense ? 'Edit Expense Record' : 'Record Operating Expense'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record fleet or warehouse costs to reconcile cash and calculate net profit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
              {/* Category Selector Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Expense Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CATEGORY_MAP).map(([catKey, config]) => {
                    const isSelected = formCategory === catKey;
                    const Icon = config.icon;
                    return (
                      <button
                        type="button"
                        key={catKey}
                        onClick={() => setFormCategory(catKey as ExpenseCategory)}
                        className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                          isSelected
                            ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold ring-2 ring-rose-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-rose-600' : 'text-slate-500'}`} />
                        <span className="text-[11px] leading-tight truncate">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diesel Fuel, Meal Allowance"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs font-mono font-bold outline-none transition"
                  />
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expense Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Assigned Lorry / Fleet */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign to Fleet Lorry (Optional)
                </label>
                <select
                  value={formLorryId}
                  onChange={(e) => setFormLorryId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition"
                >
                  <option value="">General Overhead (Not vehicle specific)</option>
                  {lorries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.vehicleNumber} — {l.driverName} ({l.route?.name || 'Assigned Route'})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Assigning to a lorry attributes this expense directly to that vehicle's route settlement and margin.
                </span>
              </div>

              {/* Payee & Reference # */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Paid To / Vendor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ceypetco, Sunil Perera, CEB"
                    value={formPaidTo}
                    onChange={(e) => setFormPaidTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt / Slip #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PETRO-9481, CHQ-001"
                    value={formReferenceNumber}
                    onChange={(e) => setFormReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details or reason..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 rounded-xl text-xs outline-none transition resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
