import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  FileCheck2,
  TrendingDown,
  Plus,
  X
} from 'lucide-react';
import { Lorry, LorryLoading, ExpenseCategory } from '../types';
import { LorryService, ExpenseService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface ReturnRow {
  productId: string;
  productName: string;
  unit: string;
  loadedQty: number;
  loadedFreeQty: number;
  soldQty: number;
  freeQty: number;
  expectedRemaining: number;
  returnedQty: number;
  returnedFreeQty: number;
}

interface LorrySettlementProps {
  isActive?: boolean;
}

export const LorrySettlement: React.FC<LorrySettlementProps> = ({ isActive }) => {
  const { formatMoney } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [activeLoading, setActiveLoading] = useState<LorryLoading | null>(null);
  const [returnRows, setReturnRows] = useState<ReturnRow[]>([]);
  const [cashHandover, setCashHandover] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Quick Route Expense Modal
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('FUEL');
  const [expTitle, setExpTitle] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expRef, setExpRef] = useState<string>('');
  const [expSaving, setExpSaving] = useState<boolean>(false);

  const [, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useLiveRefresh(() => {
    loadLorries();
    if (selectedLorryId) {
      fetchLoading(selectedLorryId);
    }
  }, { isActive });

  useEffect(() => {
    loadLorries();
  }, []);

  const loadLorries = async () => {
    try {
      setLoading(true);
      const list = await LorryService.getAll();
      setLorries(list);
      if (list.length > 0 && !selectedLorryId) {
        setSelectedLorryId(list[0].id);
        fetchLoading(list[0].id);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load lorries.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoading = async (lorryId: string) => {
    try {
      const active = await LorryService.getCurrentLoading(lorryId);
      setActiveLoading(active);

      if (active) {
        const rows: ReturnRow[] = active.items.map(item => {
          const totalOutflow = item.soldQty + (item.freeQty || 0);
          const totalLoaded = item.loadedQty + (item.loadedFreeQty || 0);
          const expected = Math.max(0, totalLoaded - totalOutflow);
          // Default: allocate remaining return to regular stock first, and free stock if remaining > loadedQty
          const retRegular = Math.min(expected, Math.max(0, item.loadedQty - item.soldQty));
          const retFree = Math.max(0, expected - retRegular);
          return {
            productId: item.productId,
            productName: item.product.name,
            unit: item.product.unit,
            loadedQty: item.loadedQty,
            loadedFreeQty: item.loadedFreeQty || 0,
            soldQty: item.soldQty,
            freeQty: item.freeQty || 0,
            expectedRemaining: expected,
            returnedQty: retRegular,
            returnedFreeQty: retFree
          };
        });
        const expSum = active.expenses?.reduce((acc, e) => acc + e.amount, 0) || 0;
        const netCash = Math.max(0, active.cashCollected - expSum);
        setReturnRows(rows);
        setCashHandover(netCash.toString());
      } else {
        setReturnRows([]);
        setCashHandover('');
      }
    } catch (err) {
      setActiveLoading(null);
      setReturnRows([]);
    }
  };

  const handleLorrySelect = (lorryId: string) => {
    setSelectedLorryId(lorryId);
    setSuccessMessage(null);
    setErrorMessage(null);
    fetchLoading(lorryId);
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);

  const updateReturnedQty = (index: number, val: number) => {
    const updated = [...returnRows];
    updated[index].returnedQty = val;
    setReturnRows(updated);
  };

  const calculateTotalDiscrepancy = () => {
    return returnRows.reduce((acc, r) => {
      const diff = r.expectedRemaining - (r.returnedQty || 0);
      return acc + (diff > 0 ? diff : 0);
    }, 0);
  };

  const totalDiscrepancy = calculateTotalDiscrepancy();
  const totalRouteExpenses = activeLoading?.expenses?.reduce((acc, e) => acc + e.amount, 0) || 0;
  const netExpectedCash = Math.max(0, (activeLoading?.cashCollected || 0) - totalRouteExpenses);
  const cashDifference = (parseFloat(cashHandover) || 0) - netExpectedCash;

  const handleAddRouteExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(expAmount);
    if (!expTitle.trim() || isNaN(amountVal) || amountVal <= 0) {
      setErrorMessage('Please enter a valid title and positive amount for the route expense.');
      return;
    }

    try {
      setExpSaving(true);
      await ExpenseService.create({
        category: expCategory,
        title: expTitle.trim(),
        amount: amountVal,
        date: activeLoading?.date || new Date().toISOString(),
        paymentMethod: 'CASH',
        referenceNumber: expRef.trim() || undefined,
        lorryId: selectedLorryId,
        loadingId: activeLoading?.id,
        paidTo: selectedLorry?.driverName || undefined,
        notes: `Route expense during trip ${activeLoading?.loadingNumber}`
      });

      setSuccessMessage(`Route expense "${expTitle}" recorded and deducted from cash handover.`);
      setIsExpenseModalOpen(false);
      setExpTitle('');
      setExpAmount('');
      setExpRef('');
      await fetchLoading(selectedLorryId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to record route expense.');
    } finally {
      setExpSaving(false);
    }
  };

  const handleCompleteSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoading) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setSubmitting(true);
      const payload = {
        loadingId: activeLoading.id,
        returns: returnRows.map(r => ({
          productId: r.productId,
          returnedQty: r.returnedQty || 0,
          returnedFreeQty: r.returnedFreeQty || 0
        })),
        cashHandover: parseFloat(cashHandover) || 0,
        notes: notes.trim() || undefined
      };

      await LorryService.settleLorry(selectedLorryId, payload);
      setSuccessMessage(
        `Lorry ${selectedLorry?.vehicleNumber} day settlement completed! Unsold stock credited back to Central Warehouse.`
      );

      // Refresh
      await loadLorries();
      await fetchLoading(selectedLorryId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Settlement failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F1F3F6] p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <RotateCcw className="w-4 h-4" />
            <span>Step 4: End-of-Day Reconciliation</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Lorry Day-End Settlement
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Compare morning loaded items against sales bills. Unsold items return to Central Warehouse.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lorry Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
        {lorries.map((lorry) => {
          const isSelected = lorry.id === selectedLorryId;
          return (
            <button
              key={lorry.id}
              onClick={() => handleLorrySelect(lorry.id)}
              className={`text-left p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all ${isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300'
                }`}
            >
              <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="font-mono text-xs font-bold uppercase">{lorry.vehicleNumber}</span>
              </div>
              <div className="text-sm font-bold">{lorry.driverName}</div>
              <div className={`text-xs mt-0.5 sm:mt-1 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                {lorry.route?.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Settlement Section */}
      {activeLoading ? (
        <form onSubmit={handleCompleteSettlement} className="space-y-4 sm:space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Morning Loaded
              </span>
              <span className="text-lg sm:text-2xl font-bold text-slate-900 mt-1 block font-mono">
                {activeLoading.totalLoadedItems} Units
              </span>
              <span className="text-xs text-slate-500 truncate block mt-0.5">Gate Pass: {activeLoading.loadingNumber}</span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Total Sold (Bills)
              </span>
              <span className="text-lg sm:text-2xl font-bold text-emerald-600 mt-1 block font-mono">
                {activeLoading.totalSoldItems} Units
              </span>
              <span className="text-xs text-slate-500 truncate block mt-0.5">
                {formatMoney(activeLoading.totalSalesAmount)} {activeLoading.totalFreeItems > 0 ? `(+${activeLoading.totalFreeItems} Free)` : ''}
              </span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Net Expected Cash
              </span>
              <span className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 block font-mono">
                {formatMoney(netExpectedCash)}
              </span>
              <span className="text-xs text-slate-500 truncate block mt-0.5">
                {totalRouteExpenses > 0
                  ? `Billed ${formatMoney(activeLoading.cashCollected)} - ${formatMoney(totalRouteExpenses)} exp`
                  : `Credit: ${formatMoney(activeLoading.creditGiven)}`}
              </span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Stock Discrepancy
              </span>
              <span
                className={`text-lg sm:text-2xl font-bold mt-1 block font-mono ${totalDiscrepancy > 0 ? 'text-rose-600' : 'text-slate-900'
                  }`}
              >
                {totalDiscrepancy} Units
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                {totalDiscrepancy === 0 ? 'Exact match' : 'Shortage'}
              </span>
            </div>
          </div>

          {/* Stock Reconciliation Table */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
                Item Reconciliation & Unsold Return
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Verify returned physical items. Returned units will be added back to warehouse stock.
              </p>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full text-left text-sm min-w-[620px]">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3.5">Product Name</th>
                    <th className="py-3 px-3.5 text-center">Loaded</th>
                    <th className="py-3 px-3.5 text-center">Paid Sold</th>
                    <th className="py-3 px-3.5 text-center">Free Issued</th>
                    <th className="py-3 px-3.5 text-center">Expected Left</th>
                    <th className="py-3 px-3.5 text-center">Actual Returned</th>
                    <th className="py-3 px-3.5 text-right">Shortage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnRows.map((row, index) => {
                    const diff = row.expectedRemaining - (row.returnedQty || 0);
                    return (
                      <tr key={row.productId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-medium text-slate-900">
                          {row.productName}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                          {row.loadedQty} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-emerald-600">
                          {row.soldQty} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-blue-600">
                          {row.freeQty > 0 ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                              +{row.freeQty} {row.unit}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-800">
                          {row.expectedRemaining} {row.unit}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={row.loadedQty}
                            value={row.returnedQty}
                            onChange={(e) => updateReturnedQty(index, parseInt(e.target.value, 10) || 0)}
                            className="w-20 sm:w-24 text-center bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {diff > 0 ? (
                            <span className="text-rose-600">-{diff} {row.unit}</span>
                          ) : diff < 0 ? (
                            <span className="text-amber-600">+{Math.abs(diff)}</span>
                          ) : (
                            <span className="text-emerald-600">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Route Expenses Reconciliation Panel */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                  Route Running Expenses & Fuel Slips
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fuel refills and driver meal allowances deducted from billed cash collections.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold border border-rose-200/80 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Route Slip</span>
              </button>
            </div>

            {activeLoading.expenses && activeLoading.expenses.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {activeLoading.expenses.map((exp) => (
                  <div key={exp.id} className="p-3 bg-slate-50/60 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">{exp.title}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {exp.expenseNumber} {exp.referenceNumber ? `• Ref #${exp.referenceNumber}` : ''}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-rose-600 text-sm">
                      -{formatMoney(exp.amount)}
                    </span>
                  </div>
                ))}
                <div className="p-3 bg-slate-100/80 flex items-center justify-between font-bold text-slate-900">
                  <span>Total Route Expenses Deducted</span>
                  <span className="font-mono text-rose-600 text-sm">
                    -{formatMoney(totalRouteExpenses)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-500 flex items-center justify-between">
                <span>No route fuel/meals recorded for this trip.</span>
                <span className="font-mono text-slate-400">Rs. 0.00</span>
              </div>
            )}
          </div>

          {/* Customer Returns & Stale Goods Collected on Route */}
          {activeLoading.customerReturns && activeLoading.customerReturns.length > 0 && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-amber-200/90 shadow-2xs p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Customer Market Returns & Stale Bread Unloaded ({activeLoading.customerReturns.length} items)
                  </h3>
                  <p className="text-xs text-amber-800/80 mt-0.5">
                    Goods collected from shops during route run. Quarantined in damage inventory and credited to customer accounts.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 block uppercase">Total Credit</span>
                  <span className="font-mono text-sm sm:text-base font-black text-amber-800">
                    {formatMoney(activeLoading.customerReturns.reduce((acc, r) => acc + (r.total || 0), 0))}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                {activeLoading.customerReturns.map((ret, idx) => (
                  <div key={ret.id || idx} className="p-3 bg-amber-50/30 hover:bg-amber-50/60 flex items-center justify-between gap-3 transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 truncate">
                          {ret.product?.name || 'Product'}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          ret.returnType === 'DAMAGE'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {ret.returnType === 'DAMAGE' ? '💥 Stale/Damage' : '✨ Resale'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">{ret.order?.customer?.name || 'Customer'}</span>
                        <span>•</span>
                        <span className="italic text-slate-400">{ret.reason || 'Customer Return'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 block">
                        {ret.quantity} {ret.product?.unit || 'pcs'} x {formatMoney(ret.unitPrice)}
                      </span>
                      <span className="font-mono font-bold text-amber-800 text-[11px]">
                        -{formatMoney(ret.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cash Handover & Closing Remarks */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-4 sm:p-6 space-y-4">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
              Cash Handover & Audit Confirmation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Total Cash Collections
                </label>
                <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl font-mono font-bold text-slate-800 text-sm">
                  {formatMoney(activeLoading.cashCollected)}
                </div>
                {activeLoading.routeCollections && activeLoading.routeCollections.length > 0 && (
                  <p className="text-[10px] text-emerald-700 font-medium mt-1">
                    Incl. {activeLoading.routeCollections.length} debt payment(s) ({formatMoney(activeLoading.routeCollections.reduce((s, p) => s + (p.amount || 0), 0))})
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 text-rose-600">
                  Less: Route Expenses
                </label>
                <div className="px-3.5 py-2.5 bg-rose-50 border border-rose-200/60 rounded-xl font-mono font-bold text-rose-700 text-sm">
                  -{formatMoney(totalRouteExpenses)}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5 text-blue-600">
                  Net Expected Handover
                </label>
                <div className="px-3.5 py-2.5 bg-blue-50 border border-blue-200/60 rounded-xl font-mono font-bold text-blue-700 text-sm">
                  {formatMoney(netExpectedCash)}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Driver Handover Cash *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={cashHandover}
                  onChange={(e) => setCashHandover(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <div
                className={`px-3.5 py-2.5 rounded-xl font-mono font-bold text-sm ${cashDifference < 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : cashDifference > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-800'
                  }`}
              >
                {cashDifference < 0
                  ? `Cash Shortage: -${formatMoney(Math.abs(cashDifference))}`
                  : cashDifference > 0
                    ? `Cash Excess: +${formatMoney(cashDifference)}`
                    : 'Exact Cash Handover ($0.00 Discrepancy)'}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Settlement Notes & Office Manager Sign-off
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Route 1 completed on time. Cash verified and deposited to safe."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Finalizing...' : 'Complete Settlement & Return Stock'}</span>
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs p-8 sm:p-12 text-center space-y-3">
          <FileCheck2 className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            No Active Loading Found for Lorry {selectedLorry?.vehicleNumber}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            This lorry has either not been loaded this morning, or has already completed and settled its daily run.
          </p>
        </div>
      )}

      {/* Quick Route Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Record Route Fuel / Expense
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lorry {selectedLorry?.vehicleNumber} • Gate Pass {activeLoading?.loadingNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRouteExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-500"
                >
                  <option value="FUEL">Fuel & Diesel Refill</option>
                  <option value="DRIVER_ALLOWANCE">Driver & Crew Meal Allowance</option>
                  <option value="VEHICLE_MAINTENANCE">Puncture / Urgent Repair</option>
                  <option value="OTHER">Tolls / Other Expense</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diesel 30L top-up"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (Cash) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Slip / Receipt #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PETRO-1234"
                    value={expRef}
                    onChange={(e) => setExpRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={expSaving}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition shadow-sm disabled:opacity-50"
                >
                  {expSaving ? 'Recording...' : 'Deduct from Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
