import React, { useState, useEffect } from 'react';
import {
  Download,
  Printer,
  ArrowDownRight,
  DollarSign,
  Users,
  Boxes,
  Truck,
  Compass,
  RotateCcw,
  TrendingUp,
  Receipt,
  Search,
  AlertTriangle,
  Gift
} from 'lucide-react';
import { ReportService } from '../services/api';
import { StockMovement, Customer, LorryPerformanceReport, RepPerformanceReport, VehicleReturnsReport } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';
import { ProfitAndLoss } from './ProfitAndLoss';
import { FreeIssues } from './FreeIssues';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface ReportsProps {
  isActive?: boolean;
}

export const Reports: React.FC<ReportsProps> = ({ isActive }) => {
  const { formatMoney } = useCurrency();
  const [activeTab, setActiveTab] = useState<'PNL' | 'LORRIES' | 'RETURNS' | 'ROUTES' | 'SALES' | 'FREE_ISSUES' | 'STOCK' | 'BALANCES' | 'REPS'>('LORRIES');
  const [, setLoading] = useState(false);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  // Data
  const [lorryReport, setLorryReport] = useState<LorryPerformanceReport | null>(null);
  const [lorryLoadings, setLorryLoadings] = useState<any[]>([]);
  const [routeSummaries, setRouteSummaries] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any>(null);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [balancesData, setBalancesData] = useState<any>(null);
  const [repReport, setRepReport] = useState<RepPerformanceReport | null>(null);

  // Returns Report Data & Filters
  const [returnsReport, setReturnsReport] = useState<VehicleReturnsReport | null>(null);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('ALL');
  const [returnTypeFilter, setReturnTypeFilter] = useState<'ALL' | 'DAMAGE' | 'RESALE'>('ALL');
  const [returnSearch, setReturnSearch] = useState<string>('');

  useLiveRefresh(() => {
    loadActiveReport();
  }, { isActive });

  useEffect(() => {
    loadActiveReport();
  }, [activeTab, dateRange, selectedVehicleFilter]);

  const loadActiveReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'LORRIES') {
        const data = await ReportService.getLorryPerformance(dateRange.from, dateRange.to);
        if (data && 'summary' in data) {
          setLorryReport(data);
          setLorryLoadings(data.loadings || []);
        } else {
          setLorryReport(null);
          setLorryLoadings(Array.isArray(data) ? data : []);
        }
      } else if (activeTab === 'RETURNS') {
        const data = await ReportService.getVehicleReturns(dateRange.from, dateRange.to, selectedVehicleFilter !== 'ALL' ? selectedVehicleFilter : undefined);
        setReturnsReport(data);
      } else if (activeTab === 'ROUTES') {
        const data = await ReportService.getRouteSales(dateRange.from, dateRange.to);
        setRouteSummaries(data);
      } else if (activeTab === 'SALES') {
        const data = await ReportService.getSalesSummary(dateRange.from, dateRange.to);
        setSalesData(data);
      } else if (activeTab === 'STOCK') {
        const movements = await ReportService.getStockMovements(undefined, 100, dateRange.from, dateRange.to);
        setStockMovements(movements);
      } else if (activeTab === 'BALANCES') {
        const balances = await ReportService.getCustomerBalances();
        setBalancesData(balances);
      } else if (activeTab === 'REPS') {
        const data = await ReportService.getRepPerformance(dateRange.from, dateRange.to);
        setRepReport(data);
      }
    } catch (err) {
      console.error('Failed to load report data', err);
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
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        return 'Custom Date Range';
      default:
        return 'Period';
    }
  };

  const exportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';

    if (activeTab === 'LORRIES') {
      csvContent += 'Loading Number,Date,Lorry,Driver,Route,Status,Loaded Units,Paid Sold Units,Free Issue Units,Returned Units,Total All Sales,Cash Sales,Credit Sales\n';
      lorryLoadings.forEach((l) => {
        const allSales = l.totalAllSales ?? l.totalSalesAmount ?? 0;
        const cashSales = l.totalCashSales ?? l.cashCollected ?? 0;
        const creditSales = l.totalCreditSale ?? (l.creditGiven > 0 ? l.creditGiven : Math.max(0, allSales - cashSales));
        csvContent += `"${l.loadingNumber}","${new Date(l.date).toLocaleDateString()}","${l.lorry?.vehicleNumber || ''}","${l.lorry?.driverName || ''}","${l.lorry?.route?.name || ''}","${l.status}",${l.totalLoadedItems},${l.totalSoldItems},${l.totalFreeItems || 0},${l.totalReturnedItems},${allSales},${cashSales},${creditSales}\n`;
      });
    } else if (activeTab === 'RETURNS' && returnsReport) {
      csvContent += 'Vehicle Number,Driver,Route,Bill Number,Paper Slip,Date,Customer,Product Name,SKU,Unit,Condition,Returned Qty,Credit Rate,Total Credit,Reason\n';
      returnsReport.recentReturnItems.forEach((r) => {
        csvContent += `"${r.vehicleNumber || 'Warehouse'}","${r.driverName || 'Counter'}","${r.routeName || ''}","${r.orderNumber}","${r.paperBillNumber || ''}","${new Date(r.date).toLocaleDateString()}","${r.customerName}","${r.productName}","${r.sku}","${r.unit}","${r.returnType}",${r.quantity},${r.unitPrice},${r.total},"${r.reason || ''}"\n`;
      });
    } else if (activeTab === 'ROUTES') {
      csvContent += 'Route Code,Route Name,Driver / Lorry,Customers,Total Bills,Total Sales,Cash Collected,Credit Given\n';
      routeSummaries.forEach((r) => {
        csvContent += `"${r.code}","${r.name}","${r.lorry?.vehicleNumber || ''}",${r.customerCount},${r.totalBills},${r.totalSales},${r.totalCash},${r.totalCredit}\n`;
      });
    } else if (activeTab === 'SALES' && salesData?.orders) {
      csvContent += 'Bill Number,Paper Slip,Date,Client,Lorry,Subtotal,Discount,Net Total,Status\n';
      salesData.orders.forEach((o: any) => {
        csvContent += `"${o.orderNumber}","${o.paperBillNumber || ''}","${new Date(o.createdAt).toLocaleDateString()}","${o.customer.name}","${o.lorry?.vehicleNumber || 'Warehouse'}",${o.subtotal},${o.discountAmount},${o.netTotal},"${o.status}"\n`;
      });
    } else if (activeTab === 'STOCK') {
      csvContent += 'Date,SKU,Product Name,Type,Quantity,Reference ID,Notes\n';
      stockMovements.forEach((m) => {
        csvContent += `"${new Date(m.createdAt).toLocaleDateString()}","${m.product.sku}","${m.product.name}","${m.type}",${m.quantity},"${m.referenceId || ''}","${m.notes || ''}"\n`;
      });
    } else if (activeTab === 'BALANCES' && balancesData?.customers) {
      csvContent += 'Customer Code,Name,Phone,Pricing Tier,Credit Limit,Outstanding Balance\n';
      balancesData.customers.forEach((c: Customer) => {
        csvContent += `"${c.code}","${c.name}","${c.phone}","${c.pricingTier}",${c.creditLimit},${c.outstandingBalance}\n`;
      });
    } else if (activeTab === 'REPS' && repReport) {
      csvContent += 'Rep Name,Phone,Username,Status,Lorry,Route,Daily Target,Period Sales,Daily Target %,Month Sales,Monthly Target,Monthly Target %,Cash Sales,Credit Sales,Cash Ratio %,Bills Count\n';
      repReport.repSummaries.forEach((r) => {
        csvContent += `"${r.fullName}","${r.phone || ''}","${r.username || ''}","${r.status}","${r.vehicleNumber || ''}","${r.routeName || ''}",${r.dailyTarget},${r.periodSales},${r.dailyAchievementPercentage},${r.monthToDateSales},${r.monthlyTarget},${r.monthlyAchievementPercentage},${r.periodCash},${r.periodCredit},${Math.round(r.cashRatio)},${r.ordersCount}\n`;
      });
      csvContent += '\nOrder Number,Paper Bill,Date,Rep,Customer,Route,Lorry,Net Total,Cash Received,Payment Method,Payment Status\n';
      repReport.repOrders.forEach((o) => {
        csvContent += `"${o.orderNumber}","${o.paperBillNumber || ''}","${new Date(o.createdAt).toLocaleDateString()}","${o.repName}","${o.customerName}","${o.routeName || ''}","${o.vehicleNumber || ''}",${o.netTotal},${o.cashReceived},"${o.paymentMethod}","${o.paymentStatus}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `distributor_report_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-6 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Reports & Fleet Audit
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Reconciliation sheets for 3 lorries, route analysis, driver bills, and warehouse stock flow.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-2xs transition text-xs flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 sm:py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white font-semibold rounded-2xl shadow-sm transition text-xs flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      {/* Toolbar: Report Tabs & Date Range Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 print:hidden">
        {/* Report Tabs */}
        <div className="flex gap-1 sm:gap-1.5 bg-slate-200/60 p-1 sm:p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto pb-1 sm:pb-1.5">
          <button
            onClick={() => setActiveTab('PNL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'PNL' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Profit & Loss (P&L)
          </button>
          <button
            onClick={() => setActiveTab('LORRIES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'LORRIES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Truck className="w-3.5 h-3.5 text-blue-600" /> Lorry Audit
          </button>
          <button
            onClick={() => setActiveTab('RETURNS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'RETURNS' ? 'bg-white text-amber-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" /> Vehicle Returns
          </button>
          <button
            onClick={() => setActiveTab('REPS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'REPS' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" /> Sales Reps
          </button>
          <button
            onClick={() => setActiveTab('ROUTES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'ROUTES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Compass className="w-3.5 h-3.5 text-emerald-600" /> Routes
          </button>
          <button
            onClick={() => setActiveTab('SALES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'SALES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Driver Bills
          </button>
          <button
            onClick={() => setActiveTab('FREE_ISSUES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'FREE_ISSUES' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Gift className="w-3.5 h-3.5 text-purple-600" /> Billed Free Issues
          </button>
          <button
            onClick={() => setActiveTab('STOCK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'STOCK' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-600" /> Stock Movements
          </button>
          <button
            onClick={() => setActiveTab('BALANCES')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${activeTab === 'BALANCES' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-600" /> Receivables
          </button>
        </div>

        {/* Date Filter (Not applicable to static balances or standalone Free Issues view which has its own toolbar) */}
        {activeTab !== 'BALANCES' && activeTab !== 'FREE_ISSUES' && (
          <DateRangeFilter
            initialPreset="today"
            onRangeChange={handleDateRangeChange}
          />
        )}
      </div>

      {/* REPORT CONTENT AREA */}
      {activeTab === 'PNL' ? (
        <ProfitAndLoss />
      ) : activeTab === 'FREE_ISSUES' ? (
        <FreeIssues embedded={true} />
      ) : (
        <div className="bg-white border border-slate-200/70 rounded-2xl sm:rounded-3xl shadow-2xs p-4 sm:p-8 space-y-4 sm:space-y-6">
        {/* Printable Report Header */}
        <div className="border-b border-slate-100 pb-3 sm:pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                {activeTab === 'LORRIES' && 'Lorry Morning Load & Evening Settlement Audit'}
                {activeTab === 'RETURNS' && 'Vehicle-Wise Returns & Damage Goods Audit'}
                {activeTab === 'REPS' && 'Sales Reps Quota Performance & Route Distribution Audit'}
                {activeTab === 'ROUTES' && `${routeSummaries.length || 3} Routes Distribution Performance Analysis`}
                {activeTab === 'SALES' && 'Daily Driver Sales Bills Log'}
                {activeTab === 'STOCK' && 'Central Warehouse Stock Movements (Inbounds, Loads, Returns)'}
                {activeTab === 'BALANCES' && 'Route Retail Customer Credit Statements'}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                <span>Filter: <strong>{getPresetLabel()}</strong></span>
                <span>•</span>
                <span>Generated: {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. LORRIES REPORT */}
        {activeTab === 'LORRIES' && (() => {
          const fallbackAllSales = lorryLoadings.reduce((sum, l) => sum + (l.totalAllSales ?? l.totalSalesAmount ?? 0), 0);
          const fallbackCashSales = lorryLoadings.reduce((sum, l) => sum + (l.totalCashSales ?? l.cashCollected ?? 0), 0);
          const fallbackCreditSale = lorryLoadings.reduce((sum, l) => sum + (l.totalCreditSale ?? (l.creditGiven > 0 ? l.creditGiven : Math.max(0, (l.totalAllSales ?? l.totalSalesAmount ?? 0) - (l.totalCashSales ?? l.cashCollected ?? 0)))), 0);

          const summary = lorryReport?.summary || {
            totalAllSales: fallbackAllSales,
            totalCashSales: fallbackCashSales,
            totalCreditSale: fallbackCreditSale,
            totalLoadedItems: lorryLoadings.reduce((sum, l) => sum + (l.totalLoadedItems || 0), 0),
            totalSoldItems: lorryLoadings.reduce((sum, l) => sum + (l.totalSoldItems || 0), 0),
            totalFreeItems: lorryLoadings.reduce((sum, l) => sum + (l.totalFreeItems || 0), 0),
            totalReturnedItems: lorryLoadings.reduce((sum, l) => sum + (l.totalReturnedItems || 0), 0),
            activeLorriesCount: lorryReport?.lorrySummaries?.length || 3,
            totalLoadingsCount: lorryLoadings.length
          };

          const cashRatio = summary.totalAllSales > 0 ? Math.round((summary.totalCashSales / summary.totalAllSales) * 100) : 0;
          const creditRatio = summary.totalAllSales > 0 ? Math.round((summary.totalCreditSale / summary.totalAllSales) * 100) : 0;
          const lorrySummaries = lorryReport?.lorrySummaries || [];

          return (
            <div className="space-y-6">
              {/* Ultra Minimal 3-Card Unified Fleet Summary */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Fleet Sales & Settlement Summary ({getPresetLabel()})
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {summary.totalLoadingsCount} dispatches • {summary.totalSoldItems} units sold
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Card 1: Total All Sales */}
                  <div className="p-4 sm:p-5 bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Total All Sales
                      </span>
                      <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
                        <Receipt className="w-4 h-4" />
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                      {formatMoney(summary.totalAllSales)}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Gross dispatched turnover across all 3 lorries
                    </p>
                  </div>

                  {/* Card 2: Total Cash Sales */}
                  <div className="p-4 sm:p-5 bg-emerald-50/60 border border-emerald-200/70 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                        Total Cash Sales
                      </span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                        {cashRatio}%
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-700">
                      {formatMoney(summary.totalCashSales)}
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Actual physical cash collected & settled
                    </p>
                  </div>

                  {/* Card 3: Total Credit Sale */}
                  <div className="p-4 sm:p-5 bg-amber-50/60 border border-amber-200/70 rounded-2xl sm:rounded-3xl shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                        Total Credit Sale
                      </span>
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/60">
                        {creditRatio}%
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold font-mono text-amber-700">
                      {formatMoney(summary.totalCreditSale)}
                    </div>
                    <p className="text-[11px] text-amber-700 font-medium">
                      Unpaid balances & customer credit pending
                    </p>
                  </div>
                </div>

                {/* Cash vs Credit Fleet Split Bar */}
                <div className="mt-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3 font-medium text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Cash: <strong className="text-slate-900 font-mono">{formatMoney(summary.totalCashSales)}</strong> ({cashRatio}%)
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      Credit: <strong className="text-slate-900 font-mono">{formatMoney(summary.totalCreditSale)}</strong> ({creditRatio}%)
                    </span>
                  </div>

                  <div className="w-full sm:w-48 h-2 bg-slate-200 rounded-full overflow-hidden flex">
                    <div style={{ width: `${cashRatio}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Cash: ${cashRatio}%`} />
                    <div style={{ width: `${creditRatio}%` }} className="h-full bg-amber-400 transition-all duration-300" title={`Credit: ${creditRatio}%`} />
                  </div>
                </div>
              </div>

              {/* Lorry-Wise Reconciliation Cards */}
              {lorrySummaries.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Lorry-Wise Cash & Credit Reconciliation
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Individual vehicle breakdown
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {lorrySummaries.map((l) => (
                      <div key={l.lorryId} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-3 hover:border-slate-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-xl">
                            {l.vehicleNumber}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                            {l.routeName || 'Assigned Route'}
                          </span>
                        </div>

                        <div>
                          <div className="text-xs text-slate-500">
                            Driver: <strong className="text-slate-800">{l.driverName}</strong>
                          </div>
                          <div className="flex items-baseline justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Sales</span>
                            <span className="font-mono font-bold text-slate-900 text-base">
                              {formatMoney(l.totalAllSales)}
                            </span>
                          </div>
                        </div>

                        {/* Side-by-Side Cash vs Credit */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                          <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100/70">
                            <span className="text-[9px] uppercase font-bold text-emerald-800 block">Cash Sales</span>
                            <span className="font-mono font-bold text-emerald-700 text-xs block mt-0.5">
                              {formatMoney(l.totalCashSales)}
                            </span>
                            <span className="text-[9px] text-emerald-600 block mt-0.5 font-medium">
                              {Math.round(l.cashRatio)}% Cash
                            </span>
                          </div>

                          <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-100/70">
                            <span className="text-[9px] uppercase font-bold text-amber-800 block">Credit Sale</span>
                            <span className="font-mono font-bold text-amber-700 text-xs block mt-0.5">
                              {formatMoney(l.totalCreditSale)}
                            </span>
                            <span className="text-[9px] text-amber-600 block mt-0.5 font-medium">
                              {Math.round(100 - l.cashRatio)}% Credit
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lorry Loadings Detailed Ledger Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Morning Load & Evening Settlement Log
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {getPresetLabel()}
                  </span>
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-left border-collapse text-xs min-w-[840px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3 px-3.5">Gate Pass #</th>
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">Lorry / Driver</th>
                        <th className="py-3 px-3.5">Route</th>
                        <th className="py-3 px-3 text-center">Loaded</th>
                        <th className="py-3 px-3 text-center">Paid Sold</th>
                        <th className="py-3 px-3 text-center">Free</th>
                        <th className="py-3 px-3 text-center">Returned</th>
                        <th className="py-3 px-3.5 text-right">Total All Sales</th>
                        <th className="py-3 px-3.5 text-right text-emerald-700">Cash Sales</th>
                        <th className="py-3 px-3.5 text-right text-amber-700">Credit Sale</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {lorryLoadings.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-slate-400">
                            No lorry loadings recorded for {getPresetLabel().toLowerCase()}.
                          </td>
                        </tr>
                      ) : (
                        lorryLoadings.map((load) => {
                          const allSales = load.totalAllSales ?? load.totalSalesAmount ?? 0;
                          const cashSales = load.totalCashSales ?? load.cashCollected ?? 0;
                          const creditSales = load.totalCreditSale ?? (load.creditGiven > 0 ? load.creditGiven : Math.max(0, allSales - cashSales));

                          return (
                            <tr key={load.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{load.loadingNumber}</td>
                              <td className="py-3 px-3.5 text-slate-500 font-mono">
                                {new Date(load.date).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-3.5">
                                <span className="font-bold text-slate-800 block">{load.lorry?.vehicleNumber}</span>
                                <span className="text-slate-400 text-[11px]">{load.lorry?.driverName}</span>
                              </td>
                              <td className="py-3 px-3.5 font-medium text-slate-700">{load.lorry?.route?.name || '—'}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-900">{load.totalLoadedItems}</td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">{load.totalSoldItems}</td>
                              <td className="py-3 px-3 text-center font-mono font-semibold text-blue-600">
                                {load.totalFreeItems > 0 ? (
                                  <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded font-bold text-[11px]">
                                    +{load.totalFreeItems}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">0</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-blue-600">{load.totalReturnedItems}</td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(allSales)}</td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">{formatMoney(cashSales)}</td>
                              <td className="py-3 px-3.5 text-right font-mono font-bold text-amber-600 bg-amber-50/20">{formatMoney(creditSales)}</td>
                              <td className="py-3 px-3.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${load.status === 'SETTLED'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                    }`}
                                >
                                  {load.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
                      <tr>
                        <td colSpan={4} className="py-3.5 px-3.5 uppercase tracking-wider text-slate-600 font-extrabold text-[11px]">
                          All Dispatches Total
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono">{summary.totalLoadedItems}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-emerald-600">{summary.totalSoldItems}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-blue-600">{summary.totalFreeItems}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-blue-600">{summary.totalReturnedItems}</td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-slate-900">{formatMoney(summary.totalAllSales)}</td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-emerald-700 bg-emerald-100/40">{formatMoney(summary.totalCashSales)}</td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-amber-700 bg-amber-100/40">{formatMoney(summary.totalCreditSale)}</td>
                        <td className="py-3.5 px-3.5 text-center font-mono text-[11px] text-slate-700">{cashRatio}% Cash</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 1.5 VEHICLE WISE RETURNS & DAMAGES REPORT (Minimal, Clean & Clear) */}
        {activeTab === 'RETURNS' && returnsReport && (() => {
          const filteredItems = returnsReport.recentReturnItems.filter(item => {
            const matchesVehicle = selectedVehicleFilter === 'ALL'
              ? true
              : (selectedVehicleFilter === 'COUNTER' ? !item.lorryId : item.lorryId === selectedVehicleFilter);
            const matchesType = returnTypeFilter === 'ALL' ? true : item.returnType === returnTypeFilter;
            const searchLower = returnSearch.trim().toLowerCase();
            const matchesSearch = !searchLower ? true : (
              (item.productName && item.productName.toLowerCase().includes(searchLower)) ||
              (item.sku && item.sku.toLowerCase().includes(searchLower)) ||
              (item.customerName && item.customerName.toLowerCase().includes(searchLower)) ||
              (item.orderNumber && item.orderNumber.toLowerCase().includes(searchLower)) ||
              (item.paperBillNumber && item.paperBillNumber.toLowerCase().includes(searchLower)) ||
              (item.vehicleNumber && item.vehicleNumber.toLowerCase().includes(searchLower)) ||
              (item.reason && item.reason.toLowerCase().includes(searchLower))
            );
            return matchesVehicle && matchesType && matchesSearch;
          });

          const totalFilteredCredit = filteredItems.reduce((acc, i) => acc + i.total, 0);
          const totalFilteredQty = filteredItems.reduce((acc, i) => acc + i.quantity, 0);

          return (
            <div className="space-y-6">
              {/* Fleet Overview Cards (Minimal & Apple-Styled) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total Deductions */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Return Credit</span>
                    <RotateCcw className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                    {formatMoney(returnsReport.summary.totalReturnValue)}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{returnsReport.summary.totalBillsWithReturns} Bills with deductions</span>
                    <span className="font-semibold">{returnsReport.summary.totalDamageUnits + returnsReport.summary.totalResaleUnits} units</span>
                  </div>
                </div>

                {/* 2. Damage & Expired */}
                <div className="bg-rose-50/50 border border-rose-200/70 rounded-2xl p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-rose-800">
                    <span className="text-xs font-bold uppercase tracking-wider">Market Damage / Expired</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700">Deduction</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                    {formatMoney(returnsReport.summary.totalDamageValue)}
                  </div>
                  <div className="text-[11px] text-rose-800/80 flex items-center justify-between">
                    <span>{returnsReport.summary.totalDamageUnits} units quarantined</span>
                    <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded font-mono font-bold">Cost Rs. 0</span>
                  </div>
                </div>

                {/* 3. Good Resellable Returns */}
                <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-2xl p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-xs font-bold uppercase tracking-wider">Good Resale Returns</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700">Restocked</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
                    {formatMoney(returnsReport.summary.totalResaleValue)}
                  </div>
                  <div className="text-[11px] text-emerald-800/80 flex items-center justify-between">
                    <span>{returnsReport.summary.totalResaleUnits} units added back</span>
                    <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded font-mono font-bold">In Warehouse</span>
                  </div>
                </div>

                {/* 4. Fleet Vehicles Active */}
                <div className="bg-blue-50/50 border border-blue-200/70 rounded-2xl p-4 sm:p-5 space-y-2">
                  <div className="flex items-center justify-between text-blue-800">
                    <span className="text-xs font-bold uppercase tracking-wider">Fleet Coverage</span>
                    <Truck className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-blue-900 font-mono">
                    {returnsReport.summary.totalVehiclesWithReturns} Vehicles
                  </div>
                  <div className="text-[11px] text-blue-700 flex items-center justify-between">
                    <span>{returnsReport.summary.totalEveningUnsoldUnits} unsold route units</span>
                    <span className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded font-mono font-bold">Settled</span>
                  </div>
                </div>
              </div>

              {/* Vehicle Wise Summary Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Vehicle-Wise Return Summaries
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    Click a vehicle to filter its line items below
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {returnsReport.vehicles.map((v) => {
                    const isSelected = selectedVehicleFilter === (v.lorryId || 'COUNTER');
                    const totalVal = v.totalReturnsValue;
                    const damagePct = totalVal > 0 ? Math.round((v.damageValue / totalVal) * 100) : 0;
                    const resalePct = totalVal > 0 ? 100 - damagePct : 0;

                    return (
                      <div
                        key={v.lorryId || 'counter'}
                        onClick={() => setSelectedVehicleFilter(isSelected ? 'ALL' : (v.lorryId || 'COUNTER'))}
                        className={`cursor-pointer transition-all rounded-2xl p-4 border text-left space-y-3 ${
                          isSelected
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30 shadow-sm'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        {/* Vehicle Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Truck className={`w-4 h-4 ${v.lorryId ? 'text-blue-600' : 'text-slate-500'}`} />
                              <span className="font-bold text-sm text-slate-900 font-mono">
                                {v.vehicleNumber}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {v.driverName} {v.routeCode && <span className="font-mono text-slate-400">({v.routeCode})</span>}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-slate-900 font-mono block">
                              {formatMoney(v.totalReturnsValue)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {v.billsWithReturnsCount} {v.billsWithReturnsCount === 1 ? 'bill' : 'bills'}
                            </span>
                          </div>
                        </div>

                        {/* Breakdown Metrics */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                          <div className="bg-rose-50/60 rounded-xl p-2">
                            <span className="text-[10px] font-bold text-rose-700 block uppercase">
                              Damaged
                            </span>
                            <div className="font-mono font-bold text-rose-800 text-xs">
                              {v.damageCount} units
                            </div>
                            <div className="text-[10px] text-rose-600 font-mono">
                              {formatMoney(v.damageValue)}
                            </div>
                          </div>

                          <div className="bg-emerald-50/60 rounded-xl p-2">
                            <span className="text-[10px] font-bold text-emerald-700 block uppercase">
                              Resellable
                            </span>
                            <div className="font-mono font-bold text-emerald-800 text-xs">
                              {v.resaleCount} units
                            </div>
                            <div className="text-[10px] text-emerald-600 font-mono">
                              {formatMoney(v.resaleValue)}
                            </div>
                          </div>
                        </div>

                        {/* Visual Ratio Bar */}
                        {totalVal > 0 && (
                          <div className="space-y-1">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${damagePct}%` }}
                                className="bg-rose-500 h-full transition-all"
                                title={`Damage: ${damagePct}%`}
                              />
                              <div
                                style={{ width: `${resalePct}%` }}
                                className="bg-emerald-500 h-full transition-all"
                                title={`Resale: ${resalePct}%`}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-mono text-slate-400">
                              <span>Damage: {damagePct}%</span>
                              <span>Resale: {resalePct}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Line Items Filter & Detailed Table */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  {/* Left: Vehicle and Condition Filters */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Vehicle Quick Filter */}
                    <button
                      onClick={() => setSelectedVehicleFilter('ALL')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition ${
                        selectedVehicleFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      All Vehicles ({returnsReport.recentReturnItems.length})
                    </button>
                    {returnsReport.vehicles.map((v) => (
                      <button
                        key={v.lorryId || 'counter'}
                        onClick={() => setSelectedVehicleFilter(v.lorryId || 'COUNTER')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition ${
                          selectedVehicleFilter === (v.lorryId || 'COUNTER')
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                      >
                        {v.vehicleNumber} ({v.totalReturnsCount})
                      </button>
                    ))}
                  </div>

                  {/* Right: Search & Condition Filter */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={returnSearch}
                        onChange={(e) => setReturnSearch(e.target.value)}
                        placeholder="Search items, customer, slip..."
                        className="text-xs bg-transparent focus:outline-none w-36 sm:w-48 text-slate-800"
                      />
                    </div>
                    <select
                      value={returnTypeFilter}
                      onChange={(e) => setReturnTypeFilter(e.target.value as any)}
                      className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 font-semibold text-slate-700 focus:outline-none"
                    >
                      <option value="ALL">All Conditions</option>
                      <option value="DAMAGE">💥 Damaged Only</option>
                      <option value="RESALE">✨ Resellable Only</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs min-w-[800px]">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="p-3 pl-4">Date / Time</th>
                        <th className="p-3">Vehicle & Driver</th>
                        <th className="p-3">Bill / Slip #</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Product Name & SKU</th>
                        <th className="p-3 text-center">Condition</th>
                        <th className="p-3 text-center">Return Qty</th>
                        <th className="p-3 text-right">Credit Rate</th>
                        <th className="p-3 text-right">Deduction (Rs.)</th>
                        <th className="p-3 pr-4">Reason / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400">
                            No return or damage items found matching the selected vehicle and date filter.
                          </td>
                        </tr>
                      ) : (
                        filteredItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 pl-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {new Date(item.date).toLocaleDateString()}
                              <span className="block text-[10px] text-slate-400">
                                {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className="font-bold text-slate-900 font-mono block">
                                {item.vehicleNumber}
                              </span>
                              <span className="text-[10px] text-slate-500">{item.driverName}</span>
                            </td>
                            <td className="p-3 whitespace-nowrap font-mono">
                              <span className="font-semibold text-blue-600 block">
                                {item.paperBillNumber || item.orderNumber}
                              </span>
                              {item.paperBillNumber && (
                                <span className="text-[10px] text-slate-400">{item.orderNumber}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-semibold text-slate-900 block max-w-[140px] truncate" title={item.customerName}>
                                {item.customerName}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-slate-900 block">{item.productName}</span>
                              <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                item.returnType === 'DAMAGE'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200/80'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                              }`}>
                                {item.returnType === 'DAMAGE' ? '💥 Damaged' : '✨ Resellable'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-slate-900">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600">
                              {formatMoney(item.unitPrice)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                              -{formatMoney(item.total)}
                            </td>
                            <td className="p-3 pr-4 text-slate-500 italic max-w-[160px] truncate" title={item.reason || '—'}>
                              {item.reason || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {filteredItems.length > 0 && (
                      <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-900">
                        <tr>
                          <td colSpan={6} className="p-3 pl-4">
                            Total Filtered Returns ({filteredItems.length} records)
                          </td>
                          <td className="p-3 text-center font-mono font-black text-slate-900">
                            {totalFilteredQty}
                          </td>
                          <td className="p-3" />
                          <td className="p-3 text-right font-mono font-black text-rose-600">
                            -{formatMoney(totalFilteredCredit)}
                          </td>
                          <td className="p-3 pr-4" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. SALES REPS REPORT */}
        {activeTab === 'REPS' && (() => {
          if (!repReport) {
            return (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold">No Sales Rep data found for this period.</p>
              </div>
            );
          }

          const { summary, repSummaries, repOrders } = repReport;
          const cashRatio = summary.totalRepSales > 0 ? (summary.totalRepCash / summary.totalRepSales) * 100 : 0;
          const creditRatio = summary.totalRepSales > 0 ? (summary.totalRepCredit / summary.totalRepSales) * 100 : 0;

          return (
            <div className="space-y-6">
              {/* Team 4-Card Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Total Rep Field Sales
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xl sm:text-2xl font-bold text-slate-900">
                      {formatMoney(summary.totalRepSales)}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {summary.totalRepBills} Bills
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-200/70 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Cash Collected
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-700">
                      {formatMoney(summary.totalRepCash)}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {Math.round(cashRatio)}% Total
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 border border-amber-200/70 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">
                    Credit Given
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xl sm:text-2xl font-bold text-amber-700">
                      {formatMoney(summary.totalRepCredit)}
                    </span>
                    <span className="text-xs font-bold text-amber-600">
                      {Math.round(creditRatio)}% Total
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 border border-blue-200/70 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 block">
                    Avg Quota Attainment
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xl sm:text-2xl font-bold text-blue-700">
                      {summary.avgDailyAchievement}%
                    </span>
                    <span className="text-xs font-semibold text-blue-600">
                      {summary.activeRepsCount} Active Reps
                    </span>
                  </div>
                </div>
              </div>

              {/* Cash vs Credit Team Bar */}
              <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="text-emerald-700 flex items-center gap-1.5 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    Cash Collected: {formatMoney(summary.totalRepCash)} ({Math.round(cashRatio)}%)
                  </span>
                  <span className="text-amber-700 flex items-center gap-1.5 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    Credit Given: {formatMoney(summary.totalRepCredit)} ({Math.round(creditRatio)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${cashRatio}%` }}
                    className="bg-emerald-500 h-full transition-all duration-300"
                  />
                  <div
                    style={{ width: `${creditRatio}%` }}
                    className="bg-amber-500 h-full transition-all duration-300"
                  />
                </div>
              </div>

              {/* Rep-Wise Quota Performance Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Sales Reps Breakdown & Quota Achievement
                  </h3>
                  <span className="text-xs text-slate-400">
                    {repSummaries.length} Representatives
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {repSummaries.map((r) => {
                    const badgeStyles =
                      r.statusBadge === 'MET_TARGET'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                        : r.statusBadge === 'ON_TRACK'
                        ? 'bg-blue-50 text-blue-700 border-blue-200/60'
                        : 'bg-amber-50 text-amber-700 border-amber-200/60';

                    const badgeLabel =
                      r.statusBadge === 'MET_TARGET'
                        ? 'Target Met'
                        : r.statusBadge === 'ON_TRACK'
                        ? 'On Track'
                        : 'In Progress';

                    return (
                      <div key={r.repId} className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-3.5 hover:border-slate-300 transition">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">{r.fullName}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyles}`}>
                                {badgeLabel}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                {r.vehicleNumber || 'No Lorry'}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="text-slate-600 font-medium">{r.routeName || 'General Route'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Period Sales Header */}
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Period Sales</span>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 text-base">
                              {formatMoney(r.periodSales)}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              {r.ordersCount} bills
                            </span>
                          </div>
                        </div>

                        {/* Daily Target Progress */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="text-slate-500 font-medium">Daily Target</span>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                {r.dailyAchievementPercentage}%
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({formatMoney(r.dailyTarget)})
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                r.dailyAchievementPercentage >= 100 ? 'bg-emerald-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(r.dailyAchievementPercentage, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Month to Date Progress */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-baseline text-xs">
                            <span className="text-slate-500 font-medium">Month-to-Date</span>
                            <div className="text-right">
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                {r.monthlyAchievementPercentage}%
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({formatMoney(r.monthToDateSales)} / {formatMoney(r.monthlyTarget)})
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                r.monthlyAchievementPercentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${Math.min(r.monthlyAchievementPercentage, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Cash vs Credit Mini Cards */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                          <div className="p-2 bg-emerald-50/60 rounded-xl border border-emerald-100/70">
                            <span className="text-[9px] uppercase font-bold text-emerald-800 block">Cash Sales</span>
                            <span className="font-mono font-bold text-emerald-700 text-xs block mt-0.5">
                              {formatMoney(r.periodCash)}
                            </span>
                            <span className="text-[9px] text-emerald-600 block mt-0.5 font-medium">
                              {Math.round(r.cashRatio)}% Cash
                            </span>
                          </div>

                          <div className="p-2 bg-amber-50/60 rounded-xl border border-amber-100/70">
                            <span className="text-[9px] uppercase font-bold text-amber-800 block">Credit Sales</span>
                            <span className="font-mono font-bold text-amber-700 text-xs block mt-0.5">
                              {formatMoney(r.periodCredit)}
                            </span>
                            <span className="text-[9px] text-amber-600 block mt-0.5 font-medium">
                              {Math.round(100 - r.cashRatio)}% Credit
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rep Orders Detailed Ledger Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Sales Reps Orders & Invoices Log
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {repOrders.length} Invoices • {getPresetLabel()}
                  </span>
                </div>

                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-left border-collapse text-xs min-w-[840px]">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="py-3 px-3.5">Bill #</th>
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">Sales Rep</th>
                        <th className="py-3 px-3.5">Retail Client</th>
                        <th className="py-3 px-3.5">Route / Lorry</th>
                        <th className="py-3 px-3.5 text-right">Net Total</th>
                        <th className="py-3 px-3.5 text-right">Cash Received</th>
                        <th className="py-3 px-3.5">Method</th>
                        <th className="py-3 px-3.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {repOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            No bills found for the selected period.
                          </td>
                        </tr>
                      ) : (
                        repOrders.map((ord) => (
                          <tr key={ord.orderId} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-3.5 font-mono font-bold text-slate-900">
                              <div>{ord.orderNumber}</div>
                              {ord.paperBillNumber && (
                                <div className="text-[10px] text-blue-600 font-normal">Slip #{ord.paperBillNumber}</div>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              {new Date(ord.createdAt).toLocaleDateString()}
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>
                            <td className="py-3 px-3.5 font-semibold text-slate-900">
                              {ord.repName}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-slate-900 block">{ord.customerName}</span>
                              <span className="text-[10px] font-mono text-slate-400">{ord.customerCode}</span>
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              <span className="font-medium text-slate-800 block">{ord.routeName || 'General'}</span>
                              <span className="text-[10px] text-slate-400">{ord.vehicleNumber || 'Warehouse'}</span>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                              {formatMoney(ord.netTotal)}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-emerald-700 font-semibold">
                              {formatMoney(ord.cashReceived)}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="font-semibold text-slate-700">{ord.paymentMethod}</span>
                              {ord.chequeNumber && (
                                <span className="text-[10px] text-purple-600 block font-mono">
                                  #{ord.chequeNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  ord.paymentStatus === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                                }`}
                              >
                                {ord.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
                      <tr>
                        <td colSpan={5} className="py-3.5 px-3.5 uppercase tracking-wider text-slate-600 font-extrabold text-[11px]">
                          Total All Sales Reps Orders
                        </td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-slate-900">
                          {formatMoney(summary.totalRepSales)}
                        </td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-emerald-700 bg-emerald-100/40">
                          {formatMoney(summary.totalRepCash)}
                        </td>
                        <td colSpan={2} className="py-3.5 px-3.5 text-center font-mono text-[11px] text-slate-700">
                          {Math.round(cashRatio)}% Cash Collected
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 2. ROUTES REPORT */}
        {activeTab === 'ROUTES' && (() => {
          const totalSalesAll = routeSummaries.reduce((sum, r) => sum + (r.totalSales || 0), 0);
          const totalCashAll = routeSummaries.reduce((sum, r) => sum + (r.totalCash || 0), 0);
          const totalCreditAll = routeSummaries.reduce((sum, r) => sum + (r.totalCredit || 0), 0);
          const totalBillsAll = routeSummaries.reduce((sum, r) => sum + (r.totalBills || 0), 0);

          return (
            <div className="space-y-6">
              {/* Route Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {routeSummaries.map((route) => {
                  const cashRatio = route.totalSales > 0 ? (route.totalCash / route.totalSales) * 100 : 0;
                  const creditRatio = route.totalSales > 0 ? (route.totalCredit / route.totalSales) * 100 : 0;

                  return (
                    <div key={route.id} className="p-5 bg-slate-50/70 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3.5 hover:border-slate-300 transition">
                      {/* Top Header */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 shadow-3xs">
                          {route.code}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {route.customerCount} Outlets
                        </span>
                      </div>

                      {/* Route Name & Lorry */}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{route.name}</h3>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Lorry: <strong className="text-slate-800">{route.lorry?.vehicleNumber || 'Unassigned'}</strong> {route.lorry?.driverName ? `(${route.lorry.driverName})` : ''}
                        </div>
                      </div>

                      {/* Total Period Sales Header */}
                      <div className="pt-2 border-t border-slate-200/70 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                            Period Sales
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {route.totalBills} {route.totalBills === 1 ? 'bill' : 'bills'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-base">
                          {formatMoney(route.totalSales)}
                        </span>
                      </div>

                      {/* Separate Cash and Credit Sections */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Cash Collected Box */}
                        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Cash
                            </span>
                            <span className="text-[10px] font-mono font-bold text-emerald-700">
                              {Math.round(cashRatio)}%
                            </span>
                          </div>
                          <div className="font-mono font-bold text-emerald-700 text-sm">
                            {formatMoney(route.totalCash)}
                          </div>
                          <span className="text-[9px] text-emerald-600/80 block font-medium">
                            Collected cash
                          </span>
                        </div>

                        {/* Credit Given Box */}
                        <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Credit
                            </span>
                            <span className="text-[10px] font-mono font-bold text-amber-700">
                              {Math.round(creditRatio)}%
                            </span>
                          </div>
                          <div className="font-mono font-bold text-amber-700 text-sm">
                            {formatMoney(route.totalCredit)}
                          </div>
                          <span className="text-[9px] text-amber-600/80 block font-medium">
                            Pending credit
                          </span>
                        </div>
                      </div>

                      {/* Visual Cash vs Credit Ratio Bar */}
                      <div className="space-y-1 pt-0.5">
                        <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${cashRatio}%` }}
                            className="h-full bg-emerald-500 transition-all duration-300"
                            title={`Cash: ${Math.round(cashRatio)}%`}
                          />
                          <div
                            style={{ width: `${creditRatio}%` }}
                            className="h-full bg-amber-400 transition-all duration-300"
                            title={`Credit: ${Math.round(creditRatio)}%`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Route Breakdown & Settlement Audit Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Route-Wise Cash & Credit Settlement Audit
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                    {getPresetLabel()}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Route</th>
                        <th className="py-3 px-4">Lorry / Driver</th>
                        <th className="py-3 px-3 text-center">Outlets</th>
                        <th className="py-3 px-3 text-center">Bills</th>
                        <th className="py-3 px-4 text-right">Total Net Sales</th>
                        <th className="py-3 px-4 text-right text-emerald-700">Cash Collected</th>
                        <th className="py-3 px-4 text-right text-amber-700">Credit Given</th>
                        <th className="py-3 px-4 text-center">Collection Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {routeSummaries.map((route) => {
                        const cashRatio = route.totalSales > 0 ? (route.totalCash / route.totalSales) * 100 : 0;
                        return (
                          <tr key={route.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3 px-4">
                              <span className="font-mono font-bold text-blue-600 block">{route.code}</span>
                              <span className="font-semibold text-slate-900">{route.name}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-800 block">{route.lorry?.vehicleNumber || 'Unassigned'}</span>
                              <span className="text-[11px] text-slate-400">{route.lorry?.driverName || 'No driver assigned'}</span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono">{route.customerCount}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">{route.totalBills}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                              {formatMoney(route.totalSales)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">
                              {formatMoney(route.totalCash)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-amber-600 bg-amber-50/20">
                              {formatMoney(route.totalCredit)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                cashRatio >= 99
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                  : cashRatio >= 50
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                              }`}>
                                {Math.round(cashRatio)}% Cash
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
                      <tr>
                        <td colSpan={2} className="py-3.5 px-4 uppercase tracking-wider text-slate-600 font-extrabold text-[11px]">
                          All Routes Total
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-600">
                          {routeSummaries.reduce((sum, r) => sum + (r.customerCount || 0), 0)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-900">
                          {totalBillsAll}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-slate-900">
                          {formatMoney(totalSalesAll)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-700 bg-emerald-100/40">
                          {formatMoney(totalCashAll)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-amber-700 bg-amber-100/40">
                          {formatMoney(totalCreditAll)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono text-xs font-bold text-slate-700">
                            {totalSalesAll > 0 ? Math.round((totalCashAll / totalSalesAll) * 100) : 0}% Overall Cash
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 3. SALES REPORT */}
        {activeTab === 'SALES' && salesData && (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 bg-slate-50/70 p-4 sm:p-6 rounded-2xl border border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Total Bills ({getPresetLabel()})
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900">{salesData.ordersCount}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Gross Subtotal
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">{formatMoney(salesData.totalGross)}</span>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Net Dispatched Sales
                </span>
                <span className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono">{formatMoney(salesData.totalNet)}</span>
              </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-3.5">Bill #</th>
                    <th className="py-3 px-3.5">Paper Slip</th>
                    <th className="py-3 px-3.5">Lorry</th>
                    <th className="py-3 px-3.5">Retail Client</th>
                    <th className="py-3 px-3.5 text-right">Subtotal</th>
                    <th className="py-3 px-3.5 text-right">Net Total</th>
                    <th className="py-3 px-3.5 text-right">Cash Paid</th>
                    <th className="py-3 px-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.orders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No sales bills found for {getPresetLabel().toLowerCase()}.
                      </td>
                    </tr>
                  ) : (
                    salesData.orders.map((o: any) => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                        <td className="py-3 px-3.5 font-mono font-semibold text-blue-600">{o.paperBillNumber || '—'}</td>
                        <td className="py-3 px-3.5 text-slate-700 font-medium">{o.lorry?.vehicleNumber || 'Warehouse'}</td>
                        <td className="py-3 px-3.5 font-semibold text-slate-900">{o.customer.name}</td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-600">{formatMoney(o.subtotal)}</td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">{formatMoney(o.netTotal)}</td>
                        <td className="py-3 px-3.5 text-right font-mono font-semibold text-emerald-600">{formatMoney(o.cashReceived)}</td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                            {o.paymentMethod} • {o.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. STOCK MOVEMENTS REPORT */}
        {activeTab === 'STOCK' && (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full text-left border-collapse text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-3.5">Timestamp</th>
                  <th className="py-3 px-3.5">SKU</th>
                  <th className="py-3 px-3.5">Product Name</th>
                  <th className="py-3 px-3.5">Movement Type</th>
                  <th className="py-3 px-3.5 text-right">Qty Units</th>
                  <th className="py-3 px-3.5">Reference / Gate Pass</th>
                  <th className="py-3 px-3.5">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockMovements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No stock movements recorded for {getPresetLabel().toLowerCase()}.
                    </td>
                  </tr>
                ) : (
                  stockMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3.5 text-slate-500 font-mono text-xs">
                        {new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900">{m.product.sku}</td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">{m.product.name}</td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${m.type === 'INBOUND' || m.type === 'LORRY_RETURN'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : m.type === 'LORRY_LOAD' || m.type === 'OUTBOUND'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            }`}
                        >
                          {m.type === 'INBOUND' && <ArrowDownRight className="w-3.5 h-3.5" />}
                          {m.type === 'LORRY_RETURN' && <RotateCcw className="w-3.5 h-3.5" />}
                          {m.type === 'LORRY_LOAD' && <Truck className="w-3.5 h-3.5" />}
                          {m.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${m.quantity > 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{m.referenceId || '—'}</td>
                      <td className="p-3 text-slate-500">{m.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. CUSTOMER BALANCES REPORT */}
        {activeTab === 'BALANCES' && balancesData && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-slate-50/80 p-4 sm:p-6 rounded-2xl border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-0.5 sm:mb-1">
                  Total Outstanding Receivables Across All Accounts
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
                  {formatMoney(balancesData.totalOutstanding)}
                </span>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
                {balancesData.count} Accounts with Due Balance
              </span>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left border-collapse text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3">Client Code</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Assigned Route</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Pricing Tier</th>
                    <th className="p-3 text-right">Credit Limit</th>
                    <th className="p-3 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balancesData.customers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-bold text-slate-900">{c.code}</td>
                      <td className="p-3 font-semibold text-slate-900">{c.name}</td>
                      <td className="p-3 text-slate-600 font-medium">{c.route?.name || 'Local'}</td>
                      <td className="p-3 font-mono text-slate-600">{c.phone}</td>
                      <td className="p-3 font-semibold text-slate-700">{c.pricingTier}</td>
                      <td className="p-3 text-right text-slate-500 font-mono">{formatMoney(c.creditLimit)}</td>
                      <td className="p-3 text-right font-bold text-amber-700 text-sm font-mono">
                        {formatMoney(c.outstandingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
