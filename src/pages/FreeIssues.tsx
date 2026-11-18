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
  FileText,
  Sparkles,
  Zap,
  Save,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { ReportService, LorryService, ProductService } from '../services/api';
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
  const [extraFilter, setExtraFilter] = useState<'ALL' | 'EXTRA_ONLY'>('ALL');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Local ratio overrides map (e.g. Yogurt buy 48 -> 4 free)
  const [ratioOverrides, setRatioOverrides] = useState<Record<string, { buy: number; get: number }>>({});
  const [savingRatioId, setSavingRatioId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);

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

      // Pre-fill local ratio overrides from product catalog if not already customized
      if (data?.items) {
        setRatioOverrides((prev) => {
          const next = { ...prev };
          data.items.forEach((item) => {
            if (!next[item.productId]) {
              next[item.productId] = {
                buy: item.freeRatioBuy || 0,
                get: item.freeRatioGet || 0
              };
            }
          });
          return next;
        });
      }
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
    if (!processedItems.length) return;
    if (expandedProductIds.size === processedItems.length) {
      setExpandedProductIds(new Set());
    } else {
      setExpandedProductIds(new Set(processedItems.map((i) => i.productId)));
    }
  };

  const handleRatioChange = (productId: string, field: 'buy' | 'get', val: number) => {
    const num = Math.max(0, val || 0);
    setRatioOverrides((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { buy: 0, get: 0 }),
        [field]: num
      }
    }));
  };

  const handleSaveRatioToProduct = async (productId: string) => {
    const ratio = ratioOverrides[productId];
    if (!ratio) return;
    try {
      setSavingRatioId(productId);
      await ProductService.update(productId, {
        freeRatioBuy: ratio.buy,
        freeRatioGet: ratio.get
      });
      setSavedSuccessId(productId);
      setTimeout(() => setSavedSuccessId(null), 3000);
    } catch (err) {
      console.error('Failed to save promotional ratio to product', err);
    } finally {
      setSavingRatioId(null);
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

  // Dynamically recomputed items based on live ratio overrides
  const processedItems = useMemo(() => {
    if (!report?.items) return [];

    return report.items
      .map((item) => {
        const ratio = ratioOverrides[item.productId] || {
          buy: item.freeRatioBuy || 0,
          get: item.freeRatioGet || 0
        };

        const activeBuy = ratio.buy;
        const activeGet = ratio.get;
        const hasRatio = activeBuy > 0 && activeGet > 0;

        let totalStandardFree = 0;
        let totalExtraFree = 0;

        const recalculatedBills = item.bills.map((bill) => {
          const standardEligible = hasRatio ? Math.floor(bill.paidQty / activeBuy) * activeGet : 0;
          const standardGiven = Math.min(bill.freeQty, standardEligible);
          const extraGiven = Math.max(0, bill.freeQty - standardEligible);
          const extraVal = extraGiven * item.unitPrice;

          totalStandardFree += standardGiven;
          totalExtraFree += extraGiven;

          return {
            ...bill,
            standardFreeQty: standardGiven,
            extraFreeQty: extraGiven,
            hasExtraFree: extraGiven > 0,
            extraFreeValue: extraVal
          };
        });

        const extraFreeRetailValue = totalExtraFree * item.unitPrice;
        const extraBillsCount = recalculatedBills.filter((b) => b.extraFreeQty > 0).length;

        return {
          ...item,
          freeRatioBuy: activeBuy,
          freeRatioGet: activeGet,
          standardFreeQuantity: totalStandardFree,
          extraFreeQuantity: totalExtraFree,
          extraFreeRetailValue,
          extraBillsCount,
          bills: recalculatedBills
        };
      })
      .filter((item) => {
        if (onlyWithFree && item.freeQuantity <= 0) return false;
        if (extraFilter === 'EXTRA_ONLY' && item.extraFreeQuantity <= 0) return false;
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
  }, [report, ratioOverrides, onlyWithFree, extraFilter, selectedCategory, searchQuery]);

  // Dynamic summary based on filtered processed items
  const dynamicSummary = useMemo(() => {
    const totalFreeUnits = processedItems.reduce((acc, i) => acc + i.freeQuantity, 0);
    const totalStandardFreeUnits = processedItems.reduce((acc, i) => acc + i.standardFreeQuantity, 0);
    const totalExtraFreeUnits = processedItems.reduce((acc, i) => acc + i.extraFreeQuantity, 0);
    const totalPaidUnits = processedItems.reduce((acc, i) => acc + i.paidQuantity, 0);
    const totalUnits = totalFreeUnits + totalPaidUnits;
    const totalFreeRetailValue = processedItems.reduce((acc, i) => acc + i.freeRetailValue, 0);
    const totalExtraFreeRetailValue = processedItems.reduce((acc, i) => acc + i.extraFreeRetailValue, 0);
    const freeRatioPercent = totalUnits > 0 ? Math.round((totalFreeUnits / totalUnits) * 1000) / 10 : 0;

    const billsWithFree = new Set<string>();
    const billsWithExtraFree = new Set<string>();

    processedItems.forEach((i) => {
      i.bills.forEach((b) => {
        if (b.freeQty > 0) billsWithFree.add(b.orderId);
        if (b.extraFreeQty > 0) billsWithExtraFree.add(b.orderId);
      });
    });

    return {
      totalFreeUnits,
      totalStandardFreeUnits,
      totalExtraFreeUnits,
      totalPaidUnits,
      totalUnits,
      totalFreeRetailValue,
      totalExtraFreeRetailValue,
      freeRatioPercent,
      billsCount: billsWithFree.size,
      extraBillsCount: billsWithExtraFree.size,
      itemsCount: processedItems.filter((i) => i.freeQuantity > 0).length,
      extraItemsCount: processedItems.filter((i) => i.extraFreeQuantity > 0).length
    };
  }, [processedItems]);

  const handleExportCSV = () => {
    if (!processedItems.length) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent +=
      'SKU,Product Name,Category,Policy Ratio,Unit Price,Paid Units Sold,Standard Policy Free,Extra/Special Free,Total Free Given,Extra Free Retail Value,Total Free Retail Value,Invoices With Extra Free\n';

    processedItems.forEach((item) => {
      const ratioStr =
        item.freeRatioBuy > 0 && item.freeRatioGet > 0
          ? `Buy ${item.freeRatioBuy} + ${item.freeRatioGet} Free`
          : 'None Set';
      csvContent += `"${item.sku}","${item.productName.replace(/"/g, '""')}","${item.category || ''}","${ratioStr}",${item.unitPrice},${item.paidQuantity},${item.standardFreeQuantity},${item.extraFreeQuantity},${item.freeQuantity},${item.extraFreeRetailValue},${item.freeRetailValue},${item.extraBillsCount}\n`;
    });

    // Bill-by-bill breakdown section
    csvContent += '\n\nDetailed Customer Invoices Breakdown (Standard vs Extra Free Issues)\n';
    csvContent +=
      'SKU,Product Name,Date,System Bill #,Paper Slip #,Customer Code,Customer Name,Lorry / Source,Paid Qty,Standard Free,Extra Free Given,Total Free Given,Extra Free Value,Total Free Value\n';

    processedItems.forEach((item) => {
      item.bills.forEach((bill) => {
        csvContent += `"${item.sku}","${item.productName.replace(/"/g, '""')}","${new Date(bill.date).toLocaleString()}","${bill.orderNumber}","${bill.paperBillNumber || '—'}","${bill.customerCode || ''}","${bill.customerName.replace(/"/g, '""')}","${bill.lorryNumber || 'Warehouse'}",${bill.paidQty},${bill.standardFreeQty},${bill.extraFreeQty},${bill.freeQty},${bill.extraFreeValue},${bill.freeValue}\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `free_issues_extra_audit_${new Date().toISOString().slice(0, 10)}.csv`
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
      {/* Top Header (Standalone) */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
                Billed Free Issues
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Item-Wise Audit
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Standard vs Extra Promo Tracker
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Audit standard promotional free issues vs extra/excess quantities issued on special occasions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handleExportCSV}
              disabled={loading || !processedItems.length}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !processedItems.length}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>
      )}

      {/* Embedded Action Bar (inside Reports page) */}
      {embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600" />
              Item-Wise Free Issues & Extra Promo Audit
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks normal promotional free issue ratio vs excess/extra units issued on special occasions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={loading || !processedItems.length}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || !processedItems.length}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards: Ultra Clean 4-Metric Grid (With Extra Free Issue Focus) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Free Units Given */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Free Units Given
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
            Standard: {dynamicSummary.totalStandardFreeUnits.toLocaleString()} • Extra: {dynamicSummary.totalExtraFreeUnits.toLocaleString()}
          </p>
        </div>

        {/* Card 2: Extra / Special Free Units (Highlighted) */}
        <div className="bg-amber-50/70 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-amber-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Extra / Excess Free Units
            </span>
            <span className="p-1.5 rounded-xl bg-amber-100 text-amber-700">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-amber-900">
              {loading ? '—' : `+${dynamicSummary.totalExtraFreeUnits.toLocaleString()}`}
            </span>
            <span className="text-xs text-amber-700 font-semibold">excess</span>
          </div>
          <p className="text-[11px] text-amber-800 font-medium">
            Beyond standard ratio policy (e.g. 48:4)
          </p>
        </div>

        {/* Card 3: Value of Extra Free Issues */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Extra Free Retail Value
            </span>
            <span className="p-1.5 rounded-xl bg-rose-50 text-rose-600">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 truncate">
            {loading ? '—' : formatMoney(dynamicSummary.totalExtraFreeRetailValue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Cost value of excess complimentary stock
          </p>
        </div>

        {/* Card 4: Total Free Retail Value */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Free Retail Value
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 truncate">
            {loading ? '—' : formatMoney(dynamicSummary.totalFreeRetailValue)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            Across {dynamicSummary.billsCount} billed customer invoices
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
            {/* View Mode Toggle: All vs Extra Only */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setExtraFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  extraFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Free Issues
              </button>
              <button
                type="button"
                onClick={() => setExtraFilter('EXTRA_ONLY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  extraFilter === 'EXTRA_ONLY'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-800 hover:text-amber-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Extra / Excess Only ({dynamicSummary.extraItemsCount})
              </button>
            </div>

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
                placeholder="Search item (e.g. Yogurt) or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* Secondary Toggles Row & Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={onlyWithFree}
                onChange={(e) => setOnlyWithFree(e.target.checked)}
                className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
              />
              <span>Show only items with free issues ({dynamicSummary.itemsCount})</span>
            </label>

            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              You can adjust any product's policy ratio (e.g. Buy 48 : 4 Free) directly in the table to audit standard vs extra free units.
            </span>
          </div>

          {processedItems.length > 0 && (
            <button
              onClick={expandAll}
              className="text-purple-600 hover:text-purple-700 font-semibold transition flex items-center gap-1 shrink-0"
            >
              {expandedProductIds.size === processedItems.length ? 'Collapse All Slips' : 'Expand All Slips'}
            </button>
          )}
        </div>
      </div>

      {/* The Ultra Clean & Minimal Table */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[880px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200/80">
                <th className="py-3 px-3 w-8 text-center"></th>
                <th className="py-3 px-3">Item & SKU</th>
                <th className="py-3 px-3">Promo Policy Ratio</th>
                <th className="py-3 px-3 text-right">Paid Units</th>
                <th className="py-3 px-3 text-right">Standard Free</th>
                <th className="py-3 px-3 text-right">Extra / Special Free</th>
                <th className="py-3 px-3 text-right">Total Free</th>
                <th className="py-3 px-3 text-right">Extra Value</th>
                <th className="py-3 px-3 text-right">Total Free Value</th>
                <th className="py-3 px-3 text-center">Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 font-medium">
                    <div className="inline-block animate-spin w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full mr-2 align-middle"></div>
                    Calculating standard vs extra free issues...
                  </td>
                </tr>
              ) : processedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <Gift className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">No Matching Free Issues Found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {extraFilter === 'EXTRA_ONLY'
                        ? 'No bills with extra/excess free issues beyond the standard promotion ratio found.'
                        : 'No promotional free items recorded for this filter selection.'}
                    </p>
                  </td>
                </tr>
              ) : (
                processedItems.map((item) => {
                  const isExpanded = expandedProductIds.has(item.productId);
                  const ratio = ratioOverrides[item.productId] || {
                    buy: item.freeRatioBuy || 0,
                    get: item.freeRatioGet || 0
                  };
                  const isSaving = savingRatioId === item.productId;
                  const isSaved = savedSuccessId === item.productId;
                  const hasExtra = item.extraFreeQuantity > 0;

                  return (
                    <React.Fragment key={item.productId}>
                      {/* Main Item Row */}
                      <tr
                        className={`transition-colors ${
                          hasExtra
                            ? 'bg-amber-50/20 hover:bg-amber-50/40'
                            : isExpanded
                            ? 'bg-purple-50/30'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Expand Chevron */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-center text-slate-400 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-purple-600 mx-auto" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mx-auto" />
                          )}
                        </td>

                        {/* Item Name & SKU */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{item.productName}</span>
                            {hasExtra && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                Extra Free Issued
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                            SKU: {item.sku} • {item.category || 'General'}
                          </span>
                        </td>

                        {/* Policy Ratio (Interactive: Buy X -> Get Y Free) */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] text-slate-400 font-medium">Buy</span>
                            <input
                              type="number"
                              min={0}
                              value={ratio.buy === 0 ? '' : ratio.buy}
                              placeholder="48"
                              onChange={(e) =>
                                handleRatioChange(item.productId, 'buy', parseInt(e.target.value, 10))
                              }
                              className="w-12 px-1.5 py-1 text-center font-mono text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 outline-none"
                              title="Buy Quantity Threshold (e.g. 48 for Yogurt)"
                            />
                            <span className="text-[11px] text-slate-400 font-medium">+</span>
                            <input
                              type="number"
                              min={0}
                              value={ratio.get === 0 ? '' : ratio.get}
                              placeholder="4"
                              onChange={(e) =>
                                handleRatioChange(item.productId, 'get', parseInt(e.target.value, 10))
                              }
                              className="w-10 px-1.5 py-1 text-center font-mono text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-purple-500 outline-none"
                              title="Free Issue Quantity (e.g. 4 for Yogurt)"
                            />
                            <span className="text-[11px] text-slate-400 font-medium">Free</span>

                            {/* Save Ratio Button */}
                            <button
                              type="button"
                              onClick={() => handleSaveRatioToProduct(item.productId)}
                              disabled={isSaving}
                              title="Save this promotion policy ratio to product"
                              className={`p-1.5 rounded-lg border text-xs transition ${
                                isSaved
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isSaved ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Paid Units Sold */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-right font-mono font-medium text-slate-700 cursor-pointer"
                        >
                          {item.paidQuantity.toLocaleString()}
                        </td>

                        {/* Standard Policy Free */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-right font-mono font-semibold text-slate-600 cursor-pointer"
                        >
                          {item.standardFreeQuantity.toLocaleString()}
                        </td>

                        {/* Extra / Special Free Given */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-right cursor-pointer"
                        >
                          {hasExtra ? (
                            <span className="font-mono font-bold px-2 py-0.5 rounded-lg text-xs bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-3 h-3 text-amber-700" />
                              +{item.extraFreeQuantity.toLocaleString()} Extra
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 text-xs">0</span>
                          )}
                        </td>

                        {/* Total Free Issued */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-right cursor-pointer"
                        >
                          <span className="font-mono font-bold px-2.5 py-1 rounded-lg text-xs bg-purple-50 text-purple-800 border border-purple-200 inline-block">
                            +{item.freeQuantity.toLocaleString()}
                          </span>
                        </td>

                        {/* Extra Free Retail Value */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-right font-mono text-xs font-bold text-amber-900 cursor-pointer"
                        >
                          {item.extraFreeRetailValue > 0 ? formatMoney(item.extraFreeRetailValue) : '—'}
                        </td>

                        {/* Total Free Retail Value */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 cursor-pointer"
                        >
                          {formatMoney(item.freeRetailValue)}
                        </td>

                        {/* Invoices Count */}
                        <td
                          onClick={() => toggleExpand(item.productId)}
                          className="py-3.5 px-3 text-center cursor-pointer"
                        >
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                              hasExtra
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {item.billsCount} {item.billsCount === 1 ? 'bill' : 'bills'}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Bill Breakdown Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={10} className="px-4 sm:px-8 py-3.5">
                            <div className="bg-white rounded-xl border border-purple-200/80 p-3 sm:p-4 shadow-2xs space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-100 gap-2">
                                <span className="flex items-center gap-1.5 text-purple-700 uppercase tracking-wider text-[11px]">
                                  <FileText className="w-3.5 h-3.5" />
                                  Customer Slips Audit: Standard Free vs Extra Given ({item.bills.length} Invoices)
                                </span>
                                <div className="text-[11px] font-normal text-slate-500">
                                  Ratio Applied: <strong className="font-semibold text-slate-800">Buy {ratio.buy} + {ratio.get} Free</strong>
                                  {ratio.buy === 0 && <span className="text-amber-600 ml-1">(Enter ratio above to calculate standard vs extra)</span>}
                                </div>
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
                                        <th className="py-2 px-3">Channel / Lorry</th>
                                        <th className="py-2 px-3 text-right">Paid Qty</th>
                                        <th className="py-2 px-3 text-right">Standard Free</th>
                                        <th className="py-2 px-3 text-right text-amber-800">Extra / Special Free</th>
                                        <th className="py-2 px-3 text-right font-bold text-purple-800">Total Free</th>
                                        <th className="py-2 px-3 text-right">Extra Value</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {item.bills.map((bill, idx) => {
                                        const billHasExtra = bill.extraFreeQty > 0;
                                        return (
                                          <tr
                                            key={idx}
                                            className={`transition-colors ${
                                              billHasExtra ? 'bg-amber-50/40 font-medium' : 'hover:bg-slate-50/50'
                                            }`}
                                          >
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
                                            <td className="py-2 px-3 text-slate-600">
                                              {bill.lorryNumber || 'Warehouse Counter'}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-700">
                                              {bill.paidQty}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                                              {bill.standardFreeQty}
                                            </td>
                                            <td className="py-2 px-3 text-right">
                                              {billHasExtra ? (
                                                <span className="font-mono font-bold px-2 py-0.5 rounded-md text-[11px] bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                                  <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                                                  +{bill.extraFreeQty} Extra
                                                </span>
                                              ) : (
                                                <span className="font-mono text-slate-400 text-xs">0</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-purple-700">
                                              +{bill.freeQty}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-amber-900">
                                              {bill.extraFreeValue > 0 ? formatMoney(bill.extraFreeValue) : '—'}
                                            </td>
                                          </tr>
                                        );
                                      })}
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
