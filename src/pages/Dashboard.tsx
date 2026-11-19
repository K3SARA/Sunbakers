import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Truck,
  AlertTriangle,
  Coins,
  Receipt,
  RotateCcw,
  Printer,
  ArrowRight,
  RefreshCw,
  Wallet,
  Calendar,
  Users
} from 'lucide-react';
import { ReportService } from '../services/api';
import { DashboardStats, Order } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface DashboardProps {
  onNavigateToLoading: () => void;
  onNavigateToBillEntry: () => void;
  onNavigateToSettlement: () => void;
  onNavigateToInventory: () => void;
  onNavigateToExpenses?: () => void;
  onViewInvoice: (order: Order) => void;
  isActive?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigateToLoading,
  onNavigateToBillEntry,
  onNavigateToSettlement,
  onNavigateToInventory,
  onNavigateToExpenses,
  onViewInvoice,
  isActive = true
}) => {
  const { formatMoney } = useCurrency();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  const activeRangeRef = useRef<{ from?: string; to?: string }>({});

  const fetchStats = async (from?: string, to?: string) => {
    try {
      const data = await ReportService.getDashboardStats(from, to);
      setStats(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(dateRange.from, dateRange.to);
    activeRangeRef.current = dateRange;

    // Periodic sync
    const interval = setInterval(() => {
      fetchStats(activeRangeRef.current.from, activeRangeRef.current.to);
    }, 12000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const handleDateRangeChange = (range: { from: string; to: string; preset: DatePreset }) => {
    setDatePreset(range.preset);
    const newRange = { from: range.from, to: range.to };
    setDateRange(newRange);
    activeRangeRef.current = newRange;
    fetchStats(range.from, range.to);
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
        return 'Selected Period';
      default:
        return 'Period';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Syncing with Offline Database...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-7">
      {/* Header & Quick Workflow Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Distribution Fleet Dashboard
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Fleet operations, route sales & inventory overview.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={onNavigateToLoading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Truck className="w-4 h-4" />
            <span className="truncate">Morning Load</span>
          </button>
          <button
            onClick={onNavigateToBillEntry}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-black text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Receipt className="w-4 h-4" />
            <span className="truncate">Enter Bills</span>
          </button>
          <button
            onClick={onNavigateToSettlement}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-semibold rounded-2xl shadow-2xs transition text-xs"
          >
            <RotateCcw className="w-4 h-4 text-emerald-600" />
            <span className="truncate">Settlement</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900">
              {getPresetLabel()} Overview
            </span>
          </div>
        </div>

        {/* Date Filter Component */}
        <DateRangeFilter
          initialPreset="today"
          onRangeChange={handleDateRangeChange}
        />
      </div>

      {/* 3 Lorries Live Fleet Widget */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            3-Lorry Fleet Dispatch Status
          </span>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
            Active Routes
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats?.fleetStatus?.map((lorry) => {
            const isSettled = lorry.status === 'SETTLED';
            const isActive = lorry.status === 'ACTIVE';

            return (
              <div
                key={lorry.id}
                className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-mono text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 block leading-tight">
                        {lorry.vehicleNumber}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-slate-800 block mt-0.5">
                        {lorry.driverName}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase shrink-0 ${isSettled
                        ? 'bg-slate-100 text-slate-600'
                        : isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                      }`}
                  >
                    {lorry.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Floating Stock
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {lorry.floatingStockUnits} Units
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Period Sales
                    </span>
                    <span className="font-mono font-bold text-blue-600 text-sm">
                      {formatMoney(lorry.todaySales)}
                    </span>
                  </div>
                  {lorry.todayExpenses !== undefined && lorry.todayExpenses > 0 && (
                    <div className="col-span-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                        Route Expenses
                      </span>
                      <span className="font-mono font-bold text-rose-600">
                        -{formatMoney(lorry.todayExpenses)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sales Reps Live Route & Target Performance */}
      {stats && stats.repLiveStatus && stats.repLiveStatus.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Sales Reps Live Performance & Route Tracking
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time route quota monitoring, daily run rates, and monthly targets across sales field reps.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl self-start sm:self-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {stats.repLiveStatus.filter(r => r.status === 'ACTIVE').length} Active Field Reps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.repLiveStatus.map((rep) => {
              const isMet = rep.dailyAchievementPercentage >= 100;
              return (
                <div key={rep.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-200 transition space-y-3.5 shadow-3xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{rep.fullName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rep.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {rep.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span className="font-medium text-slate-600">{rep.vehicleNumber || 'No Lorry'}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px]">{rep.routeName || 'General Route'}</span>
                      </div>
                    </div>
                    <span className={`font-mono text-xs font-bold px-2 py-1 rounded-lg ${
                      isMet ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                    }`}>
                      {rep.dailyAchievementPercentage}%
                    </span>
                  </div>

                  {/* Daily Target Progress */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline text-xs">
                      <span className="text-slate-500 font-medium">
                        Today: <strong className="text-slate-900 font-mono">{formatMoney(rep.todaySales)}</strong>
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Target: {formatMoney(rep.dailyTarget)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isMet ? 'bg-emerald-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min(rep.dailyAchievementPercentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metric Chips */}
                  <div className="p-2.5 bg-slate-50 rounded-xl grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today Bills</span>
                      <span className="font-mono font-bold text-slate-800">{rep.todayBillsCount} bills</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Month-to-Date</span>
                      <span className="font-mono font-bold text-slate-800">{formatMoney(rep.monthToDateSales)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Low Stock Urgent Banner */}
      {stats && stats.lowStockCount > 0 && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-100 rounded-2xl text-amber-800 shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-semibold text-amber-950">
                {stats.lowStockCount} Products Below Minimum Stock Threshold in Warehouse
              </p>
              <p className="text-xs text-amber-800/80 mt-0.5">
                {stats.lowStockItems.map(i => i.name).slice(0, 3).join(', ')}{stats.lowStockItems.length > 3 ? ` +${stats.lowStockItems.length - 3} more` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToInventory}
            className="px-4 py-2 bg-amber-900 hover:bg-black text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition self-start sm:self-auto shrink-0 shadow-2xs"
          >
            Manage Warehouse Stock <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clean Minimal Financial Metric Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {getPresetLabel()} Sales
              </span>
              <div className="flex items-center gap-2">
                {stats.ordersTodayCount > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                    {stats.ordersTodayCount} bills
                  </span>
                )}
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Coins className="w-4.5 h-4.5" />
                </div>
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono mt-1">
              {formatMoney(stats.revenueToday)}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {getPresetLabel()} Cash Handover
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Wallet className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 font-mono mt-1">
              {formatMoney(stats.cashToday)}
            </div>
            {stats.directCashCollections !== undefined && stats.directCashCollections > 0 && (
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                Incl. {formatMoney(stats.directCashCollections)} debt collected
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {getPresetLabel()} Expenses
              </span>
              {onNavigateToExpenses ? (
                <button
                  onClick={onNavigateToExpenses}
                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition"
                  title="View Expenses Ledger"
                >
                  <TrendingDown className="w-4.5 h-4.5" />
                </button>
              ) : (
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <TrendingDown className="w-4.5 h-4.5" />
                </div>
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 font-mono mt-1">
              {formatMoney(stats.expensesToday || 0)}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-2xs hover:shadow-sm transition">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Receivables
              </span>
              <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-mono mt-1">
              {formatMoney(stats.totalOutstanding)}
            </div>
            {stats.creditCollectionsToday !== undefined && stats.creditCollectionsToday > 0 && (
              <p className="text-[11px] text-purple-700 font-medium mt-1">
                {formatMoney(stats.creditCollectionsToday)} collected this period
              </p>
            )}
          </div>
        </div>
      )}

      {/* Orders Table */}
      {stats && (
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden">
          <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              {getPresetLabel()} Sales Bills
            </h2>
            <button
              onClick={onNavigateToBillEntry}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Enter More Bills <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-7 py-3.5">Bill #</th>
                  <th className="px-6 py-3.5">Paper Slip #</th>
                  <th className="px-6 py-3.5">Lorry / Driver</th>
                  <th className="px-6 py-3.5">Retail Client</th>
                  <th className="px-6 py-3.5">Net Total</th>
                  <th className="px-6 py-3.5">Payment</th>
                  <th className="px-7 py-3.5 text-right">Invoice Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stats.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-7 py-16 text-center text-slate-400">
                      <p className="text-base font-semibold text-slate-700">No driver bills found for {getPresetLabel().toLowerCase()}.</p>
                      <p className="text-xs text-slate-400 mt-1">Try selecting another date range or enter new bills.</p>
                    </td>
                  </tr>
                ) : (
                  stats.recentOrders.map((order) => {
                    const isReturnNote = order.netTotal === 0 && (order.returnAmount || 0) > 0;
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-7 py-4 font-mono font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{order.orderNumber}</span>
                            {isReturnNote && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                Return Note
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-semibold text-blue-600">
                          {order.paperBillNumber || '—'}
                        </td>
                        <td className="px-6 py-4 text-xs">
                          {order.lorry ? (
                            <div>
                              <span className="font-bold text-slate-800 block">{order.lorry.vehicleNumber}</span>
                              <span className="text-slate-400">{order.lorry.driverName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Warehouse Counter</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{order.customer.name}</p>
                          <p className="text-xs text-slate-400">{order.customer.city}</p>
                        </td>
                        <td className="px-6 py-4 font-mono">
                          {isReturnNote ? (
                            <span className="font-bold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-lg text-xs">
                              -{formatMoney(order.returnAmount || 0)}
                            </span>
                          ) : (
                            <span className="font-bold text-slate-900">
                              {formatMoney(order.netTotal)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                            isReturnNote
                              ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                              : order.paymentStatus === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {isReturnNote ? 'CREDIT ADJUSTED' : `${order.paymentMethod} • ${order.paymentStatus}`}
                          </span>
                        </td>
                        <td className="px-7 py-4 text-right">
                          <button
                            onClick={() => onViewInvoice(order)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                            title={isReturnNote ? 'View & Print Return Slip' : 'View & Print Bill Receipt'}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{isReturnNote ? 'Return Slip' : 'View Bill'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
