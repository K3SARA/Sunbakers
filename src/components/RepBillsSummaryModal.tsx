import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Bluetooth,
  Receipt,
  Check,
  Loader2,
  Filter
} from 'lucide-react';
import { Order, Lorry, User, SystemSettings, Expense } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { SettingsService } from '../services/api';
import {
  printBillsSummaryToBluetooth,
  RepBillsSummaryData
} from '../utils/bluetoothPrinter';

interface RepBillsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  allBills: Order[];
  filteredBills?: Order[];
  activeFilter?: string;
  dateRangeLabel?: string;
  lorry?: Lorry | null;
  user?: User | null;
  routeExpenses?: Expense[];
}

export const RepBillsSummaryModal: React.FC<RepBillsSummaryModalProps> = ({
  isOpen,
  onClose,
  allBills,
  filteredBills,
  activeFilter = 'ALL',
  dateRangeLabel,
  lorry,
  user,
  routeExpenses = []
}) => {
  const { formatMoney } = useCurrency();
  const [companySettings, setCompanySettings] = useState<SystemSettings | null>(null);

  // Filter mode: 'ALL' or 'FILTERED'
  const hasFilter = Boolean(
    filteredBills &&
    filteredBills.length !== allBills.length &&
    (activeFilter !== 'ALL')
  );
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'FILTERED'>(
    hasFilter ? 'FILTERED' : 'ALL'
  );

  // Bluetooth printing state
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [btLoading, setBtLoading] = useState<boolean>(false);
  const [btSuccess, setBtSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      SettingsService.get()
        .then((s) => setCompanySettings(s))
        .catch(() => {});
    }
  }, [isOpen]);

  // Determine active bills to summarize
  const activeBills = useMemo(() => {
    if (selectedScope === 'FILTERED' && filteredBills) {
      return filteredBills;
    }
    return allBills;
  }, [selectedScope, filteredBills, allBills]);

  // Aggregate financial metrics
  const summaryMetrics = useMemo(() => {
    const totalBills = activeBills.length;
    const totalValue = activeBills.reduce((acc: number, b: Order) => acc + (b.netTotal || 0), 0);
    const totalCash = activeBills.reduce((acc: number, b: Order) => acc + (b.cashReceived || 0), 0);

    const cashBills = activeBills.filter((b: Order) => b.paymentMethod === 'CASH');
    const creditBills = activeBills.filter((b: Order) => b.paymentMethod === 'CREDIT');
    const chequeBills = activeBills.filter((b: Order) => b.paymentMethod === 'CHEQUE');

    const totalCheque = chequeBills.reduce((acc: number, b: Order) => acc + (b.netTotal || 0), 0);
    const totalCredit = activeBills.reduce((acc: number, b: Order) => {
      if (b.paymentMethod === 'CHEQUE') return acc;
      return acc + (b.balanceAmount !== undefined ? b.balanceAmount : Math.max(0, (b.netTotal || 0) - (b.cashReceived || 0)));
    }, 0);

    return {
      totalBills,
      totalValue,
      totalCash,
      totalCredit,
      totalCheque,
      cashCount: cashBills.length,
      creditCount: creditBills.length,
      chequeCount: chequeBills.length
    };
  }, [activeBills]);

  const totalExpenses = useMemo(() => {
    return (routeExpenses || []).reduce((acc: number, e: Expense) => acc + (e.amount || 0), 0);
  }, [routeExpenses]);

  // Consolidated product units sold
  const productSummary = useMemo(() => {
    const map = new Map<
      string,
      { name: string; unit: string; quantity: number; freeQuantity: number; totalValue: number }
    >();

    activeBills.forEach((bill: Order) => {
      bill.items?.forEach((item) => {
        const prodName = item.product?.name || 'Unknown Product';
        const unit = item.product?.unit || 'pcs';
        const existing = map.get(prodName);

        if (existing) {
          existing.quantity += item.quantity;
          existing.freeQuantity += item.freeQuantity || 0;
          existing.totalValue += item.lineTotal || 0;
        } else {
          map.set(prodName, {
            name: prodName,
            unit,
            quantity: item.quantity,
            freeQuantity: item.freeQuantity || 0,
            totalValue: item.lineTotal || 0
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }, [activeBills]);

  const totalProductUnits = useMemo(() => {
    return productSummary.reduce((acc, p) => acc + p.quantity, 0);
  }, [productSummary]);

  const totalFreeUnits = useMemo(() => {
    return productSummary.reduce((acc, p) => acc + p.freeQuantity, 0);
  }, [productSummary]);

  if (!isOpen) return null;

  const handleSystemPrint = () => {
    const styleId = 'print-page-size-style';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      @page {
        size: 80mm auto !important;
        margin: 0mm !important;
      }
    `;
    window.print();
  };

  const handleBluetoothPrint = async () => {
    setBtLoading(true);
    setBtStatus('Initializing Bluetooth...');
    setBtSuccess(false);

    const summaryData: RepBillsSummaryData = {
      repName: user?.fullName || 'Sales Rep',
      repPhone: user?.phone || undefined,
      vehicleNumber: lorry?.vehicleNumber || 'Route Lorry',
      routeName: lorry?.route?.name || lorry?.route?.code || undefined,
      driverName: lorry?.driverName || undefined,
      filterLabel: selectedScope === 'FILTERED' ? activeFilter : 'ALL',
      bills: activeBills,
      summary: summaryMetrics,
      productSummary
    };

    try {
      const result = await printBillsSummaryToBluetooth(
        summaryData,
        companySettings,
        (status) => setBtStatus(status)
      );

      if (result.success) {
        setBtSuccess(true);
        setTimeout(() => {
          setBtStatus(null);
          setBtLoading(false);
          setBtSuccess(false);
        }, 3500);
      } else {
        setBtLoading(false);
        setTimeout(() => setBtStatus(null), 4000);
      }
    } catch (err: any) {
      setBtLoading(false);
      setBtStatus(err?.message || 'Bluetooth printing failed');
      setTimeout(() => setBtStatus(null), 4000);
    }
  };

  const currentDateStr = new Date().toLocaleDateString();
  const currentTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:m-0 print:bg-white print:static print:inset-auto print:block print:h-auto print:min-h-0 print:overflow-visible print:shadow-none animate-in fade-in"
      style={{ zIndex: 100 }}
    >
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none print:p-0 print:m-0 print:overflow-visible print:block">
        {/* Modal Controls Toolbar */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                Rep's Bills Summary Slip
              </h3>
              <p className="text-[10px] text-slate-400">
                {lorry?.vehicleNumber || 'Route Lorry'} • {activeBills.length} Bills
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick 80mm Print Actions */}
            <button
              type="button"
              onClick={handleSystemPrint}
              className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer"
              title="Print via System Print (80mm Thermal / PDF)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btLoading}
              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition shadow-2xs active:scale-95 cursor-pointer ${
                btSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
              title="Print via Bluetooth Thermal Printer"
            >
              {btLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Bluetooth</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scope Selector (If active filter exists) */}
        {hasFilter && (
          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/60 flex items-center justify-between text-xs print:hidden shrink-0">
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Print Scope:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedScope('ALL')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                  selectedScope === 'ALL'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                All Bills ({allBills.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedScope('FILTERED')}
                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                  selectedScope === 'FILTERED'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Filtered ({activeFilter}: {filteredBills?.length})
              </button>
            </div>
          </div>
        )}

        {/* Live Bluetooth Status Banner */}
        {btStatus && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-b print:hidden transition-all shrink-0 ${
              btSuccess
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : btStatus.includes('failed') ||
                  btStatus.includes('not supported') ||
                  btStatus.includes('cancelled')
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200 animate-pulse'
            }`}
          >
            {btSuccess ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Bluetooth className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="truncate">{btStatus}</span>
          </div>
        )}

        {/* 80mm Thermal Printable Slip Area */}
        <div
          id="printable-summary"
          className="flex-1 overflow-y-auto bg-slate-100/60 p-3 sm:p-5 print:p-0 print:m-0 print:bg-white print:overflow-visible print:max-h-none print:h-auto print:w-full print:border-none print:shadow-none"
        >
          <div className="receipt-80mm max-w-[340px] w-full mx-auto bg-white p-4 shadow-sm border border-slate-200 rounded-2xl text-black font-mono text-[13px] sm:text-[13.5px] leading-snug select-text print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full print:w-full print:rounded-none print:bg-white">
            {/* Header: Logo & Company details */}
            <div className="text-center space-y-1 pb-2">
              <div className="flex justify-center mb-1">
                <img
                  src="/sun-bakers-logo.png"
                  alt="Sunbakers & confectionary"
                  className="w-16 h-16 object-contain mx-auto rounded-full border border-slate-200/60 shadow-2xs print:border-none"
                />
              </div>

              <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-black leading-tight">
                {companySettings?.companyName || 'Sunbakers & confectionary'}
              </h2>
              <p className="text-[11.5px] sm:text-[12px] text-black font-semibold leading-tight">
                {companySettings?.address || '239,kurukutthala ,kadugannawa'}
              </p>
              <p className="text-[11.5px] sm:text-[12px] text-black font-bold">
                Tel: {companySettings?.phone || '+94 77 254 9414'}
              </p>
              {companySettings?.registrationNumber && (
                <p className="text-[10.5px] text-black font-medium">
                  Reg/VAT: {companySettings.registrationNumber}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="border-t-2 border-black my-1.5" />
            <div className="text-center font-black text-xs sm:text-[13px] py-0.5 tracking-wider uppercase">
              *** SALES REP BILLS SUMMARY ***
            </div>
            <div className="border-t border-black border-dashed my-1.5" />

            {/* Rep & Lorry Metadata */}
            <div className="space-y-0.5 text-[11.5px] sm:text-[12px]">
              <div className="flex justify-between">
                <span>Date: {currentDateStr}</span>
                <span>Time: {currentTimeStr}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Rep: {user?.fullName || 'Sales Rep'}</span>
                <span>Van: {lorry?.vehicleNumber || 'Route Lorry'}</span>
              </div>
              {dateRangeLabel && (
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Period: {dateRangeLabel}</span>
                  <span>({activeBills.length} Bills)</span>
                </div>
              )}
              {lorry?.route && (
                <div className="flex justify-between text-slate-700">
                  <span>Route: {lorry.route.name || lorry.route.code}</span>
                  {lorry.driverName && <span>Driver: {lorry.driverName}</span>}
                </div>
              )}
              {selectedScope === 'FILTERED' && activeFilter !== 'ALL' && (
                <div className="text-center font-bold text-[11px] py-0.5 text-blue-700">
                  [Filter: {activeFilter} BILLS ONLY]
                </div>
              )}
            </div>

            {/* KPI Summary Block */}
            <div className="border-t border-black border-dashed my-2" />
            <div className="space-y-1.5 text-xs sm:text-[12.5px]">
              <div className="flex justify-between font-black text-base sm:text-lg">
                <span>TOTAL SALES:</span>
                <span>{formatMoney(summaryMetrics.totalValue)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                <span>Total Bills Issued:</span>
                <span className="font-bold">{summaryMetrics.totalBills} bills</span>
              </div>

              <div className="border-t border-slate-300 my-1" />

              <div className="flex justify-between text-xs font-bold">
                <span>Cash Collected ({summaryMetrics.cashCount}):</span>
                <span className="font-bold text-emerald-800">
                  {formatMoney(summaryMetrics.totalCash)}
                </span>
              </div>
              {totalExpenses > 0 && (
                <>
                  <div className="flex justify-between text-xs font-bold text-rose-800">
                    <span>Less Route Expenses ({routeExpenses.length}):</span>
                    <span>-{formatMoney(totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black pt-0.5 border-t border-black border-dashed">
                    <span>NET CASH TO HAND OVER:</span>
                    <span>{formatMoney(Math.max(0, summaryMetrics.totalCash - totalExpenses))}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-xs font-bold">
                <span>Credit Issued ({summaryMetrics.creditCount}):</span>
                <span className="font-bold text-rose-800">
                  {formatMoney(summaryMetrics.totalCredit)}
                </span>
              </div>
              {summaryMetrics.totalCheque > 0 && (
                <div className="flex justify-between text-xs font-bold">
                  <span>Cheques ({summaryMetrics.chequeCount}):</span>
                  <span className="font-bold text-orange-800">
                    {formatMoney(summaryMetrics.totalCheque)}
                  </span>
                </div>
              )}
            </div>

            {/* Itemized Bills Table */}
            <div className="border-t-2 border-black my-2" />
            <div className="text-center font-black text-xs sm:text-[12.5px] uppercase tracking-wider pb-1">
              BILLS BREAKDOWN ({activeBills.length})
            </div>
            <div className="border-t border-black border-dashed mb-1.5" />

            {activeBills.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">
                No bills recorded for this selection.
              </div>
            ) : (
              <div className="space-y-2 text-[11.5px] sm:text-xs">
                {activeBills.map((bill, idx) => {
                  const slipNo = bill.paperBillNumber || bill.orderNumber;
                  const time = new Date(bill.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const creditDue = Math.max(0, bill.netTotal - (bill.cashReceived || 0));
                  const isCash = bill.paymentMethod === 'CASH';
                  const isCheque = bill.paymentMethod === 'CHEQUE';

                  return (
                    <div
                      key={bill.id}
                      className="border-b border-slate-200/80 pb-1.5 last:border-b-0 space-y-0.5"
                    >
                      <div className="flex justify-between font-black">
                        <span>
                          {idx + 1}. #{slipNo} ({time})
                        </span>
                        <span className="font-mono">{formatMoney(bill.netTotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 font-medium">
                        <span className="truncate max-w-[190px]">
                          {bill.customer?.companyName || bill.customer?.name}
                        </span>
                        <span
                          className={`font-bold text-[10.5px] px-1 rounded ${
                            isCash
                              ? 'bg-emerald-50 text-emerald-800'
                              : isCheque
                              ? 'bg-orange-50 text-orange-800'
                              : creditDue > 0
                              ? 'bg-rose-50 text-rose-800 font-bold'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {bill.paymentMethod}
                          {creditDue > 0 ? ` (Due: ${creditDue.toFixed(0)})` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Product Sales Units Summary */}
            {productSummary.length > 0 && (
              <>
                <div className="border-t-2 border-black my-2.5" />
                <div className="text-center font-bold text-[10px] uppercase tracking-wider pb-1">
                  CONSOLIDATED PRODUCT SALES
                </div>
                <div className="border-t border-black border-dashed mb-1.5" />

                <div className="space-y-1.5 text-[10px]">
                  {productSummary.map((prod) => (
                    <div key={prod.name} className="flex justify-between items-start leading-tight">
                      <div className="min-w-0 pr-1">
                        <span className="font-semibold text-black block truncate">
                          {prod.name}
                        </span>
                        <span className="text-[9px] text-slate-600">
                          {prod.quantity} {prod.unit}
                          {prod.freeQuantity > 0 && (
                            <span className="text-emerald-700 font-bold ml-1">
                              (+{prod.freeQuantity} Free)
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-black shrink-0">
                        {formatMoney(prod.totalValue)}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-dashed border-black pt-1 mt-1 flex justify-between font-bold text-[10.5px]">
                    <span>Total Sold Units:</span>
                    <span>
                      {totalProductUnits} pcs
                      {totalFreeUnits > 0 ? ` (+${totalFreeUnits} Free)` : ''}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Route Expenses Breakdown on Print Receipt */}
            {routeExpenses.length > 0 && (
              <>
                <div className="border-t-2 border-black my-2" />
                <div className="text-center font-black text-xs sm:text-[12.5px] uppercase tracking-wider pb-1">
                  ROUTE EXPENSES & FUEL ({routeExpenses.length})
                </div>
                <div className="border-t border-black border-dashed mb-1.5" />
                <div className="space-y-1 text-[11.5px] sm:text-xs">
                  {routeExpenses.map((exp) => (
                    <div key={exp.id} className="flex justify-between leading-tight">
                      <div className="min-w-0 pr-1">
                        <span className="font-bold truncate block">[{exp.category}] {exp.title}</span>
                        {exp.paidTo && <span className="text-[10px] text-slate-600 block">To: {exp.paidTo}</span>}
                      </div>
                      <span className="font-bold text-rose-800 shrink-0">-{formatMoney(exp.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-black pt-1 border-t border-black border-dashed">
                    <span>TOTAL EXPENSES:</span>
                    <span>-{formatMoney(totalExpenses)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Signatures Tear-off */}
            <div className="border-t-2 border-black my-3" />
            <div className="pt-2 pb-1 space-y-4 text-[9.5px]">
              <div className="flex justify-between text-center pt-4">
                <div className="w-[45%]">
                  <div className="border-b border-black border-dashed mb-1" />
                  <span className="font-bold block">Sales Rep Sign</span>
                  <span className="text-[8.5px] text-slate-500">
                    {user?.fullName || 'Sales Rep'}
                  </span>
                </div>
                <div className="w-[45%]">
                  <div className="border-b border-black border-dashed mb-1" />
                  <span className="font-bold block">Cashier / Supervisor</span>
                  <span className="text-[8.5px] text-slate-500">Sign & Stamp</span>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-500 pt-1">
                <p>Goods and cash accounted for settlement.</p>
                <p>Keep for accounting and stock reconciliation.</p>
              </div>
            </div>

            {/* Bottom Thermal Margin */}
            <div className="pt-3 text-center text-[8px] text-slate-400 print:text-black">
              - - - - - - - - - - - - - - - - - -
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white print:hidden shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btLoading}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                btSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {btLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span>Bluetooth 80mm</span>
            </button>

            <button
              type="button"
              onClick={handleSystemPrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Summary Slip</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

