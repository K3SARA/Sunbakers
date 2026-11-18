import React, { useState, useEffect, useMemo } from 'react';
import {
  Gift,
  Search,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  Truck,
  Filter,
  CheckCircle2,
  Package,
  Layers,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { ReportService, LorryService } from '../services/api';
import { FreeIssuesReport, FreeIssueItem, Lorry } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { DateRangeFilter, DatePreset } from '../components/DateRangeFilter';

interface FreeIssuesProps {
  embedded?: boolean;
}

export const FreeIssues: React.FC<FreeIssuesProps> = ({ embedded = false }) => {
  const { formatMoney } = useCurrency();

  const [report, setReport] = useState<FreeIssuesReport | null>(null);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [dateRange, setDateRange] = useState<{ from: string; to: string; preset: DatePreset }>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    return {
      from: todayStart.toISOString(),
      to: todayEnd.toISOString(),
      preset: 'today'
    };
  });
  const [selectedLorryId, setSelectedLorryId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyWithFree, setOnlyWithFree] = useState<boolean>(true);
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Load Lorries on mount
  useEffect(() => {
    LorryService.getAll()
      .then(setLorries)
      .catch((err) => console.error('Failed to load lorries', err));
  }, []);

  // Fetch Report Data when date range or lorry filter changes
  useEffect(() => {
    fetchReport();
  }, [dateRange, selectedLorryId]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await ReportService.getFreeIssuesReport(
        dateRange.from,
        dateRange.to,
        selectedLorryId === 'ALL' ? undefined : selectedLorryId
      );
      setReport(data);
    } catch (err) {
      console.error('Failed to load free issues report', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (productId: string) => {
    setExpandedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!filteredItems.length) return;
    if (expandedProductIds.size === filteredItems.length) {
      setExpandedProductIds(new Set());
    } else {
      setExpandedProductIds(new Set(filteredItems.map((i) => i.productId)));
    }
  };

  // Extract unique categories
  const categories = useMemo(() => {
    if (!report?.items) return [];
    const cats = new Set<string>();
    report.items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats).sort();
  }, [report]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    if (!report?.items) return [];

    return report.items.filter((item) => {
      if (onlyWithFree && item.freeQuantity <= 0) return false;
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.productName.toLowerCase().includes(query);
        const matchSku = item.sku.toLowerCase().includes(query);
        const matchCategory = item.category?.toLowerCase().includes(query);
        if (!matchName && !matchSku && !matchCategory) return false;
      }
      return true;
    });
  }, [report, onlyWithFree, selectedCategory, searchQuery]);

  // Dynamic summary based on filtered items
  const dynamicSummary = useMemo(() => {
    const totalFreeUnits = filteredItems.reduce((acc, i) => acc + i.freeQuantity, 0);
    const totalPaidUnits = filteredItems.reduce((acc, i) => acc + i.paidQuantity, 0);
    const totalUnits = totalFreeUnits + totalPaidUnits;
    const totalFreeRetailValue = filteredItems.reduce((acc, i) => acc + i.freeRetailValue, 0);
    const freeRatioPercent = totalUnits > 0 ? Math.round((totalFreeUnits / totalUnits) * 1000) / 10 : 0;
    const billsWithFree = new Set<string>();
    filteredItems.forEach((i) => {
      i.bills.forEach((b) => billsWithFree.add(b.orderId));
    });

    return {
      totalFreeUnits,
      totalPaidUnits,
      totalUnits,
      totalFreeRetailValue,
      freeRatioPercent,
      billsCount: billsWithFree.size,
      itemsCount: filteredItems.filter((i) => i.freeQuantity > 0).length
    };
  }, [filteredItems]);

  const handleExportCSV = () => {
    if (!filteredItems.length) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'SKU,Product Name,Category,Unit Price,Paid Units Sold,Free Issues Given,Total Units Moved,Free Ratio %,Free Retail Value,Total Invoices\n';

    filteredItems.forEach((item) => {
      csvContent += `"${item.sku}","${item.productName.replace(/"/g, '""')}","${item.category || ''}",${item.unitPrice},${item.paidQuantity},${item.freeQuantity},${item.totalQuantity},${item.freeRatioPercent}%,${item.freeRetailValue},${item.billsCount}\n`;
    });

    // Also include bill drilldown sheet section
    csvContent += '\n\nDetailed Bill-by-Bill Free Issue Slips\n';
    csvContent += 'SKU,Product Name,Date,System Bill #,Paper Slip #,Customer Code,Customer Name,Lorry / Source,Paid Qty,Free Qty,Free Value\n';

    filteredItems.forEach((item) => {
      item.bills.forEach((bill) => {
        csvContent += `"${item.sku}","${item.productName.replace(/"/g, '""')}","${new Date(bill.date).toLocaleString()}","${bill.orderNumber}","${bill.paperBillNumber || '—'}","${bill.customerCode || ''}","${bill.customerName.replace(/"/g, '""')}","${bill.lorryNumber || 'Warehouse'}",${bill.paidQty},${bill.freeQty},${bill.freeValue}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `billed_free_issues_report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`space-y-6 ${embedded ? '' : 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto'}`}>
      {/* Top Header (Only if standalone, or minimal if embedded) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Billed Free Issues
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Item-Wise Audit
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Audit of promotional bonus units issued across driver bills and counter sales.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportCSV}
              disabled={loading || !filteredItems.length}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !filteredItems.length}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>
      )}

      {/* Embedded Action Bar (when inside Reports page) */}
      {embedded && (
        <div className="flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600" />
              Item-Wise Billed Free Issues Audit
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of promotional bonus quantities issued against sales bills.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={loading || !filteredItems.length}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !filteredItems.length}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards: Ultra Clean 4-Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Free Units */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Free Issues Given
            </span>
            <span className="p-1.5 rounded-xl bg-purple-50 text-purple-600">
              <Gift className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-purple-700">
              {loading ? '—' : dynamicSummary.totalFreeUnits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-medium">units</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Across {dynamicSummary.itemsCount} promotional items
          </p>
        </div>

        {/* Card 2: Total Paid Sold Units */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Paid Units Billed
            </span>
            <span className="p-1.5 rounded-xl bg-blue-50 text-blue-600">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
              {loading ? '—' : dynamicSummary.totalPaidUnits.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-medium">units</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Total commercial volume sold
          </p>
        </div>

        {/* Card 3: Free Ratio % */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Promo Free Ratio
            </span>
            <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-indigo-700">
              {loading ? '—' : `${dynamicSummary.freeRatioPercent}%`}
            </span>
            <span className="text-xs text-slate-400 font-medium">of volume</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Free units out of total movement
          </p>
        </div>

        {/* Card 4: Free Retail Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Free Retail Value
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 truncate">
            {loading ? '—' : formatMoney(dynamicSummary.totalFreeRetailValue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Commercial retail value of free stock
          </p>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Date Preset & Range Filter */}
          {!embedded && (
            <DateRangeFilter
              initialPreset="today"
              onRangeChange={(range) => setDateRange(range)}
            />
          )}

          {/* Right: Channel / Lorry Selector & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Lorry Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={selectedLorryId}
                onChange={(e) => setSelectedLorryId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All Lorries & Counter</option>
                {lorries.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.vehicleNumber} ({l.driverName})
                  </option>
                ))}
                <option value="COUNTER">Direct Warehouse Counter</option>
              </select>
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fast Search */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search item or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Secondary Toggles Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={onlyWithFree}
              onChange={(e) => setOnlyWithFree(e.target.checked)}
              className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
            />
            <span>Show only items with free issues issued ({dynamicSummary.itemsCount})</span>
          </label>

          {filteredItems.length > 0 && (
            <button
              onClick={expandAll}
              className="text-purple-600 hover:text-purple-700 font-semibold transition flex items-center gap-1"
            >
              {expandedProductIds.size === filteredItems.length ? 'Collapse All Details' : 'Expand All Details'}
            </button>
          )}
        </div>
      </div>

      {/* The Ultra Clean & Minimal Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[760px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80">
                <th className="py-3 px-4 w-10 text-center"></th>
                <th className="py-3 px-4">Item & Code</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3 text-right">Paid Qty</th>
                <th className="py-3 px-3 text-right">Free Issues</th>
                <th className="py-3 px-3 text-right">Total Units</th>
                <th className="py-3 px-3 text-right">Free %</th>
                <th className="py-3 px-4 text-right">Free Value</th>
                <th className="py-3 px-4 text-center">Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 font-medium">
                    <div className="inline-block animate-spin w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full mr-2 align-middle"></div>
                    Loading billed free issues...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No Billed Free Issues Found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {onlyWithFree
                        ? 'No promotional free items were issued during the selected date range and filter.'
                        : 'No sales recorded matching your search query.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isExpanded = expandedProductIds.has(item.productId);
                  const hasPromoRatio = item.freeRatioBuy > 0 && item.freeRatioGet > 0;

                  return (
                    <React.Fragment key={item.productId}>
                      {/* Main Item Row */}
                      <tr
                        onClick={() => toggleExpand(item.productId)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-purple-50/40' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Expand Chevron */}
                        <td className="py-3.5 px-4 text-center text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-purple-600 mx-auto" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mx-auto" />
                          )}
                        </td>

                        {/* Item Name & SKU */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {hasPromoRatio && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                Promo: Buy {item.freeRatioBuy} + {item.freeRatioGet} Free
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                            SKU: {item.sku}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-3">
                          <span className="text-xs text-slate-600 font-medium">
                            {item.category || 'General'}
                          </span>
                        </td>

                        {/* Unit Price */}
                        <td className="py-3.5 px-3 text-right font-mono text-slate-600 text-xs">
                          {formatMoney(item.unitPrice)}
                        </td>

                        {/* Paid Qty */}
                        <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-700">
                          {item.paidQuantity.toLocaleString()}
                        </td>

                        {/* Free Issues (Promotional Highlight) */}
                        <td className="py-3.5 px-3 text-right">
                          <span
                            className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs inline-block ${
                              item.freeQuantity > 0
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'text-slate-400'
                            }`}
                          >
                            +{item.freeQuantity.toLocaleString()}
                          </span>
                        </td>

                        {/* Total Units */}
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                          {item.totalQuantity.toLocaleString()}
                        </td>

                        {/* Free % */}
                        <td className="py-3.5 px-3 text-right font-mono text-xs">
                          <span
                            className={`font-semibold ${
                              item.freeRatioPercent > 15
                                ? 'text-amber-600'
                                : item.freeRatioPercent > 0
                                ? 'text-purple-700'
                                : 'text-slate-400'
                            }`}
                          >
                            {item.freeRatioPercent}%
                          </span>
                        </td>

                        {/* Free Retail Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatMoney(item.freeRetailValue)}
                        </td>

                        {/* Bills Count Badge */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {item.billsCount} {item.billsCount === 1 ? 'bill' : 'bills'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Bill Breakdown Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={10} className="px-4 sm:px-8 py-3.5">
                            <div className="bg-white rounded-xl border border-purple-200/80 p-3 sm:p-4 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-100">
                                <span className="flex items-center gap-1.5 text-purple-700 uppercase tracking-wider text-[11px]">
                                  <FileText className="w-3.5 h-3.5" />
                                  Customer Invoices Issued With Free Promotional Units ({item.bills.length})
                                </span>
                                <span className="text-slate-400 font-normal">
                                  Clicking an invoice reveals its delivery slip details
                                </span>
                              </div>

                              {item.bills.length === 0 ? (
                                <p className="text-xs text-slate-400 py-2">
                                  No bills recorded with free issues for this item.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <th className="py-2 px-3">Date</th>
                                        <th className="py-2 px-3">System Bill #</th>
                                        <th className="py-2 px-3">Paper Slip #</th>
                                        <th className="py-2 px-3">Customer Client</th>
                                        <th className="py-2 px-3">Lorry / Channel</th>
                                        <th className="py-2 px-3 text-right">Paid Qty</th>
                                        <th className="py-2 px-3 text-right">Free Given</th>
                                        <th className="py-2 px-3 text-right">Free Value</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {item.bills.map((bill, idx) => (
                                        <tr key={idx} className="hover:bg-purple-50/30">
                                          <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                            {new Date(bill.date).toLocaleDateString()}
                                          </td>
                                          <td className="py-2 px-3 font-mono font-bold text-slate-900">
                                            {bill.orderNumber}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-blue-600 font-semibold">
                                            {bill.paperBillNumber || '—'}
                                          </td>
                                          <td className="py-2 px-3">
                                            <span className="font-semibold text-slate-800">
                                              {bill.customerName}
                                            </span>
                                            {bill.customerCode && (
                                              <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                                                ({bill.customerCode})
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-slate-600 font-medium">
                                            {bill.lorryNumber || 'Warehouse Counter'}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                                            {bill.paidQty}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                                            +{bill.freeQty}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                            {formatMoney(bill.freeValue)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
