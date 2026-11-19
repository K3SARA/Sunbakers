import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Calendar,
  Download,
  Printer,
  Truck,
  Building2,
  Package,
  Search,
  RefreshCw,
  Gift
} from 'lucide-react';
import { ReportService } from '../services/api';
import { ProfitAndLossReport } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface ProfitAndLossProps {
  isActive?: boolean;
}

export const ProfitAndLoss: React.FC<ProfitAndLossProps> = ({ isActive }) => {
  const { formatMoney } = useCurrency();
  const [report, setReport] = useState<ProfitAndLossReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [searchProduct, setSearchProduct] = useState<string>('');

  useLiveRefresh(() => {
    loadReport();
  }, { isActive });

  useEffect(() => {
    loadReport();
  }, [dateRange]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await ReportService.getProfitAndLoss(dateRange.from, dateRange.to);
      setReport(data);
    } catch (err) {
      console.error('Failed to load Profit & Loss report', err);
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
        return 'Selected Period';
      default:
        return 'Period';
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const exportCSV = () => {
    if (!report) return;

    let csv = 'data:text/csv;charset=utf-8,';
    csv += '=== DISTRIBUTION PROFIT & LOSS STATEMENT ===\n';
    csv += `Period: ${new Date(report.period.from).toLocaleDateString()} to ${new Date(report.period.to).toLocaleDateString()}\n\n`;

    csv += 'FINANCIAL STATEMENT SUMMARY\n';
    csv += `Gross Invoiced Sales,${report.summary.grossRevenue}\n`;
    csv += `Trade Discounts,${report.summary.discounts}\n`;
    csv += `Net Sales Revenue,${report.summary.netRevenue}\n`;
    csv += `Cost of Goods Sold (Paid Units),${report.summary.cogs}\n`;
    csv += `Promotional Free Issues Cost,${report.summary.freeIssueCost}\n`;
    csv += `Total Cost of Sales,${report.summary.totalCostOfSales}\n`;
    csv += `Gross Profit,${report.summary.grossProfit}\n`;
    csv += `Gross Profit Margin %,${report.summary.grossProfitMargin.toFixed(2)}%\n`;
    csv += `Operating Expenditures (OPEX),${report.summary.totalExpenses || 0}\n`;
    csv += `  - Fleet Running Costs,${report.summary.fleetExpenses || 0}\n`;
    csv += `  - Warehouse Overhead,${report.summary.overheadExpenses || 0}\n`;
    csv += `Net Operating Profit,${report.summary.netOperatingProfit !== undefined ? report.summary.netOperatingProfit : report.summary.grossProfit}\n`;
    csv += `Net Profit Margin %,${(report.summary.netProfitMargin || 0).toFixed(2)}%\n`;
    csv += `Markup on Cost %,${report.summary.markupPercentage.toFixed(2)}%\n`;
    csv += `Cash Collected,${report.summary.cashCollected}\n`;
    if (report.summary.chequesCollected) {
      csv += `Cheques Collected,${report.summary.chequesCollected}\n`;
    }
    csv += `Credit Receivables,${report.summary.creditReceivables}\n\n`;

    csv += 'CHANNEL / FLEET PROFITABILITY\n';
    csv += 'Channel,Bills,Net Revenue,COGS,Promotional Cost,Total Cost,Expenses,Gross Profit,Net Profit,Margin %\n';
    report.channelBreakdown.forEach((c: any) => {
      csv += `"${c.channelName}",${c.billsCount},${c.netRevenue},${c.cogs},${c.freeIssueCost},${c.totalCost},${c.expenses || 0},${c.grossProfit},${c.netProfit !== undefined ? c.netProfit : c.grossProfit},${c.margin.toFixed(2)}%\n`;
    });
    csv += '\n';

    csv += 'PRODUCT PROFITABILITY BREAKDOWN\n';
    csv += 'Product Name,SKU,Category,Units Sold,Free Units,Selling Price,Cost Price,Revenue,Total Cost,Gross Profit,Margin %\n';
    report.productBreakdown.forEach((p: any) => {
      csv += `"${p.name}","${p.sku}","${p.category}",${p.unitsSold},${p.unitsFree},${p.unitPrice},${p.costPrice},${p.revenue},${p.totalCost},${p.grossProfit},${p.margin.toFixed(2)}%\n`;
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Profit_Loss_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = report?.productBreakdown.filter(
    (p: any) =>
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchProduct.toLowerCase()) ||
      p.category.toLowerCase().includes(searchProduct.toLowerCase())
  ) || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>Financial Performance & Audit</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Profit & Loss Statement (P&L)
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Minimalist full-stack accounting overview: Revenue, COGS, Promotional Schemes, and Net Gross Margins.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            disabled={!report || loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-2xl shadow-2xs transition text-xs disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={!report || loading}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white font-semibold rounded-2xl shadow-sm transition text-xs disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Print P&L</span>
          </button>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Accounting Period
            </span>
            <span className="text-sm font-bold text-slate-900">
              Showing {getPresetLabel()} Profit & Loss
            </span>
          </div>
        </div>

        <DateRangeFilter initialPreset="today" onRangeChange={handleDateRangeChange} />
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 font-medium">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span>Calculating Income, COGS & Scheme Profit Margins...</span>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Top 4 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Net Revenue */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Net Turnover / Revenue
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900">
                {formatMoney(report.summary.netRevenue)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Gross: {formatMoney(report.summary.grossRevenue)}</span>
                <span className="text-rose-500 font-semibold">
                  Disc: -{formatMoney(report.summary.discounts)}
                </span>
              </div>
            </div>

            {/* Cost of Sales */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Cost of Sales
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-slate-900">
                {formatMoney(report.summary.totalCostOfSales)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between pt-1 border-t border-slate-100">
                <span>COGS: {formatMoney(report.summary.cogs)}</span>
                <span className="text-amber-600 font-semibold">
                  Promos: {formatMoney(report.summary.freeIssueCost)}
                </span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Gross Profit
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    report.summary.grossProfit >= 0
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-rose-50 text-rose-600'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  report.summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatMoney(report.summary.grossProfit)}
              </div>
              <div className="text-[11px] text-slate-500 font-medium flex items-center justify-between pt-1 border-t border-slate-100">
                <span>Markup: {report.summary.markupPercentage.toFixed(1)}%</span>
                <span
                  className={`font-semibold ${
                    report.summary.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {report.summary.grossProfit >= 0 ? 'Net Positive' : 'Operating Loss'}
                </span>
              </div>
            </div>

            {/* Gross Margin % */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Gross Profit Margin
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-purple-700">
                {report.summary.grossProfitMargin.toFixed(1)}%
              </div>
              <div className="pt-1.5 border-t border-slate-100">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, report.summary.grossProfitMargin))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Minimal Financial Statement Columnar View */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
                  Distributor Income Statement
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standard GAAP single-tier profit breakdown for wholesale distribution operations.
                </p>
              </div>
              <span className="text-xs font-mono font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-xl">
                {report.summary.totalOrdersCount} Bills Audited
              </span>
            </div>

            <div className="divide-y divide-slate-100 font-mono text-sm">
              {/* Revenue Section */}
              <div className="py-2.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">
                  <span>1. Revenue & Invoiced Sales</span>
                </div>
                <div className="flex justify-between items-center pl-3 text-slate-700">
                  <span>Gross Invoiced Sales</span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(report.summary.grossRevenue)}
                  </span>
                </div>
                {report.summary.discounts > 0 && (
                  <div className="flex justify-between items-center pl-3 text-rose-600">
                    <span>Less: Customer Trade Discounts</span>
                    <span className="font-semibold">
                      -{formatMoney(report.summary.discounts)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pl-3 pt-1 border-t border-slate-100/80 font-bold text-slate-900">
                  <span className="font-sans text-xs uppercase tracking-wide">Net Sales Revenue (Turnover)</span>
                  <span className="text-base text-blue-600">
                    {formatMoney(report.summary.netRevenue)}
                  </span>
                </div>
              </div>

              {/* Cost of Sales Section */}
              <div className="py-2.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">
                  <span>2. Cost of Sales & Inventory Expenses</span>
                </div>
                <div className="flex justify-between items-center pl-3 text-slate-700">
                  <span>
                    Cost of Goods Sold (COGS - {report.summary.totalUnitsSold} Paid Units)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(report.summary.cogs)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3 text-amber-700">
                  <span className="flex items-center gap-1.5 font-sans text-xs">
                    <Gift className="w-3.5 h-3.5 text-amber-500" />
                    Promotional Trade Scheme Impact ({report.summary.totalFreeUnits} Free Units Given)
                  </span>
                  <span className="font-semibold">
                    {formatMoney(report.summary.freeIssueCost)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3 pt-1 border-t border-slate-100/80 font-bold text-slate-900">
                  <span className="font-sans text-xs uppercase tracking-wide">Total Cost of Goods Sold</span>
                  <span className="text-base text-slate-900">
                    {formatMoney(report.summary.totalCostOfSales)}
                  </span>
                </div>
              </div>

              {/* Gross Profit Section */}
              <div className="py-2.5 space-y-2 border-b border-slate-100">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400 font-sans">
                  <span>3. Gross Operating Margin</span>
                </div>
                <div className="flex justify-between items-center text-base sm:text-lg font-bold text-slate-900">
                  <span className="font-sans text-xs sm:text-sm uppercase tracking-wider">Gross Profit</span>
                  <span className="font-mono text-emerald-600 font-black">
                    {formatMoney(report.summary.grossProfit)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-0.5 font-sans">
                  <span>Gross Margin: <strong className="text-emerald-700 font-mono">{report.summary.grossProfitMargin.toFixed(2)}%</strong></span>
                  <span>Markup on Cost: <strong className="text-slate-800 font-mono">{report.summary.markupPercentage.toFixed(2)}%</strong></span>
                </div>
              </div>

              {/* Operating Expenses Section */}
              <div className="py-2.5 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-rose-500 font-sans">
                  <span>4. Operating Expenditures (OPEX)</span>
                </div>
                <div className="flex justify-between items-center pl-3 text-slate-700">
                  <span className="flex items-center gap-1.5 font-sans text-xs">
                    <Truck className="w-3.5 h-3.5 text-amber-500" />
                    Fleet Running Costs (Fuel, Driver Allowance, Repairs)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(report.summary.fleetExpenses || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3 text-slate-700">
                  <span className="flex items-center gap-1.5 font-sans text-xs">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                    Warehouse & Admin Overhead (Rent, Power, Salaries)
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatMoney(report.summary.overheadExpenses || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pl-3 pt-1 border-t border-slate-100/80 font-bold text-rose-600">
                  <span className="font-sans text-xs uppercase tracking-wide">Total Operating Expenses</span>
                  <span className="text-base font-mono">
                    -{formatMoney(report.summary.totalExpenses || 0)}
                  </span>
                </div>
              </div>

              {/* Net Profit Bottom Line Section */}
              <div className="py-3.5 space-y-2 bg-emerald-50/50 -mx-6 px-6 rounded-2xl border border-emerald-100/80">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-emerald-900 font-sans">
                  <span>5. Net Operating Profit (Bottom Line)</span>
                </div>
                <div className="flex justify-between items-center text-lg sm:text-2xl font-black text-emerald-700">
                  <span className="font-sans text-sm sm:text-base uppercase tracking-wider">Net Operating Profit</span>
                  <span className="font-mono">
                    {formatMoney(report.summary.netOperatingProfit !== undefined ? report.summary.netOperatingProfit : report.summary.grossProfit)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 pt-1 font-sans">
                  <span>
                    Net Profit Margin:{' '}
                    <strong className="text-emerald-700 font-mono text-sm">
                      {(report.summary.netProfitMargin || 0).toFixed(2)}%
                    </strong>
                  </span>
                  <span>
                    Cash Realized:{' '}
                    <strong className="text-emerald-700 font-mono text-sm">
                      {formatMoney(report.summary.cashCollected)}
                    </strong>
                  </span>
                  {Boolean(report.summary.chequesCollected && report.summary.chequesCollected > 0) && (
                    <span>
                      Cheques Received:{' '}
                      <strong className="text-blue-700 font-mono text-sm">
                        {formatMoney(report.summary.chequesCollected!)}
                      </strong>
                    </span>
                  )}
                  <span>
                    Outstanding Credit:{' '}
                    <strong className="text-rose-600 font-mono text-sm">
                      {formatMoney(report.summary.creditReceivables)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Channel Profitability Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-blue-600" />
                Fleet & Channel Profitability Breakdown
              </h2>
              <span className="text-xs text-slate-400">3 Lorries + Warehouse Counter</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {report.channelBreakdown.map((channel: any) => {
                const isCounter = channel.id === 'warehouse-counter';
                const displayName = isCounter ? 'Warehouse Counter' : channel.channelName;
                const displaySubtext = isCounter ? 'Direct Sales Desk' : channel.subtext;

                return (
                  <div
                    key={channel.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all space-y-4 flex flex-col justify-between"
                  >
                    {/* Card Top: Icon, Vehicle/Name, Driver/Route, Margin Pill */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                              isCounter ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            {isCounter ? (
                              <Building2 className="w-5 h-5 stroke-[2.2]" />
                            ) : (
                              <Truck className="w-5 h-5 stroke-[2.2]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-mono text-base font-black uppercase tracking-wide text-slate-900 block leading-tight truncate">
                              {displayName}
                            </span>
                            <span className="text-xs text-slate-500 font-semibold truncate block mt-0.5">
                              {displaySubtext}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-bold font-mono px-2.5 py-1 rounded-xl whitespace-nowrap shrink-0 shadow-2xs ${
                            channel.margin >= 20
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                              : channel.margin > 0
                                ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {channel.margin.toFixed(1)}% Margin
                        </span>
                      </div>

                      {/* Channel Sub-badges (Route/Bills) */}
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100/90 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600">
                          {channel.billsCount} {channel.billsCount === 1 ? 'Bill' : 'Bills'}
                        </span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="text-[11px] font-medium text-slate-500 truncate">
                          {isCounter ? 'Walk-in / Direct' : 'Route Distribution'}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Metrics Panel */}
                    <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Turnover Revenue</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatMoney(channel.netRevenue)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Cost of Goods Sold</span>
                        <span className="font-mono text-slate-600 font-semibold">
                          {formatMoney(channel.totalCost)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-700 font-medium flex items-center gap-1">
                          <Gift className="w-3 h-3 text-amber-500" />
                          Scheme Promo Cost
                        </span>
                        <span className="font-mono text-amber-700 font-bold">
                          {formatMoney(channel.freeIssueCost)}
                        </span>
                      </div>
                      {channel.expenses !== undefined && channel.expenses > 0 && (
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60">
                          <span className="text-rose-600 font-medium flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-rose-500" />
                            Route Running Costs
                          </span>
                          <span className="font-mono text-rose-600 font-bold">
                            -{formatMoney(channel.expenses)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Highlighted Profit Pill */}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 flex items-center justify-between transition-colors ${
                        (channel.netProfit !== undefined ? channel.netProfit : channel.grossProfit) >= 0
                          ? 'bg-emerald-50/90 border border-emerald-200/80'
                          : 'bg-rose-50/90 border border-rose-200/80'
                      }`}
                    >
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${
                          (channel.netProfit !== undefined ? channel.netProfit : channel.grossProfit) >= 0 ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        Net Channel Margin
                      </span>
                      <span
                        className={`font-mono text-base font-black ${
                          (channel.netProfit !== undefined ? channel.netProfit : channel.grossProfit) >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatMoney(channel.netProfit !== undefined ? channel.netProfit : channel.grossProfit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Profitability Contribution Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Product Profit & Margin Contribution
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed product-by-product revenue, inventory cost, free issue expense, and net margin.
                </p>
              </div>

              {/* Search filter */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Filter product or SKU..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                No product sales found matching the selected timeframe or search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3">Product & SKU</th>
                      <th className="py-3 px-2 text-center">Paid Units</th>
                      <th className="py-3 px-2 text-center">Free Units</th>
                      <th className="py-3 px-2 text-right">Selling Price</th>
                      <th className="py-3 px-2 text-right">Cost Price</th>
                      <th className="py-3 px-3 text-right">Revenue</th>
                      <th className="py-3 px-3 text-right">Total Cost</th>
                      <th className="py-3 px-3 text-right">Gross Profit</th>
                      <th className="py-3 px-3 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {filteredProducts.map((p: any) => {
                      const isProfitable = p.grossProfit >= 0;
                      return (
                        <tr key={p.productId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-sans">
                            <span className="font-semibold text-slate-900 block">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {p.sku} • {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-slate-800">
                            {p.unitsSold} {p.unit}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {p.unitsFree > 0 ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                                +{p.unitsFree} Free
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-600">
                            {formatMoney(p.unitPrice)}
                          </td>
                          <td className="py-3 px-2 text-right text-slate-500">
                            {formatMoney(p.costPrice)}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-slate-900">
                            {formatMoney(p.revenue)}
                          </td>
                          <td className="py-3 px-3 text-right text-slate-600">
                            {formatMoney(p.totalCost)}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-bold ${
                              isProfitable ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {formatMoney(p.grossProfit)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                p.margin >= 25
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : p.margin > 0
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {p.margin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white rounded-3xl border border-slate-200/80 text-slate-400 text-sm">
          No Profit & Loss data available for the selected timeframe.
        </div>
      )}
    </div>
  );
};
