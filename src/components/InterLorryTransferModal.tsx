import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Truck,
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileText,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { Lorry, LorryTransfer, LorryStock } from '../types';
import { LorryService } from '../services/api';

interface TransferRow {
  productId: string;
  quantity: string | number;
  freeQuantity?: string | number;
}

interface InterLorryTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (transfer: LorryTransfer) => void;
  defaultFromLorryId?: string;
  currentUserRole?: string;
}

export const InterLorryTransferModal: React.FC<InterLorryTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultFromLorryId
}) => {
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [fromLorryId, setFromLorryId] = useState<string>('');
  const [toLorryId, setToLorryId] = useState<string>('');
  const [paperSlipNumber, setPaperSlipNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Floating stock held by From Lorry
  const [sourceLorryStock, setSourceLorryStock] = useState<LorryStock[]>([]);
  const [loadingStock, setLoadingStock] = useState<boolean>(false);

  // Transfer item rows
  const [rows, setRows] = useState<TransferRow[]>([
    { productId: '', quantity: '', freeQuantity: '' }
  ]);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load lorries on open
  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage(null);
    LorryService.getAll()
      .then((list) => {
        setLorries(list);
        const initialFrom = defaultFromLorryId && list.some((l) => l.id === defaultFromLorryId)
          ? defaultFromLorryId
          : list[0]?.id || '';
        setFromLorryId(initialFrom);

        const possibleTo = list.find((l) => l.id !== initialFrom);
        if (possibleTo) setToLorryId(possibleTo.id);
      })
      .catch((err) => {
        console.error('Failed to load lorries for transfer', err);
        setErrorMessage('Failed to connect to fleet list.');
      });
  }, [isOpen, defaultFromLorryId]);

  // Load floating stock for From Lorry
  useEffect(() => {
    if (!fromLorryId) {
      setSourceLorryStock([]);
      return;
    }

    setLoadingStock(true);
    LorryService.getById(fromLorryId)
      .then((lorry) => {
        const stocks = (lorry.lorryStocks || []).filter(
          (s) => (s.quantity || 0) > 0 || (s.freeQuantity || 0) > 0
        );
        setSourceLorryStock(stocks);
        // Reset rows product selection if not available in new source lorry
        setRows((prev) =>
          prev.map((r) =>
            stocks.some((s) => s.productId === r.productId) ? r : { ...r, productId: '' }
          )
        );
      })
      .catch((err) => {
        console.error('Failed to load source lorry stocks', err);
        setSourceLorryStock([]);
      })
      .finally(() => setLoadingStock(false));
  }, [fromLorryId]);

  if (!isOpen) return null;

  const fromLorry = lorries.find((l) => l.id === fromLorryId);
  const toLorry = lorries.find((l) => l.id === toLorryId);

  // Available destination lorries (excluding source)
  const availableToLorries = lorries.filter((l) => l.id !== fromLorryId);

  const handleFromLorryChange = (newFromId: string) => {
    setFromLorryId(newFromId);
    if (toLorryId === newFromId) {
      const nextTo = lorries.find((l) => l.id !== newFromId);
      setToLorryId(nextTo?.id || '');
    }
  };

  const addRow = () => {
    setRows([...rows, { productId: '', quantity: '', freeQuantity: '' }]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ productId: '', quantity: '', freeQuantity: '' }]);
      return;
    }
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const updateRow = (index: number, field: keyof TransferRow, val: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: val };
    setRows(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fromLorryId || !toLorryId) {
      setErrorMessage('Please choose both the Giving (Source) and Receiving (Destination) lorries.');
      return;
    }

    if (fromLorryId === toLorryId) {
      setErrorMessage('Source and Destination lorry cannot be the same vehicle.');
      return;
    }

    // Filter valid items
    const validItems = rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: r.productId,
        quantity: parseInt(String(r.quantity), 10) || 0,
        freeQuantity: parseInt(String(r.freeQuantity), 10) || 0
      }))
      .filter((r) => r.quantity > 0 || r.freeQuantity > 0);

    if (validItems.length === 0) {
      setErrorMessage('Please add at least one product with a transfer quantity greater than 0.');
      return;
    }

    // Validate quantities against source stock
    for (const item of validItems) {
      const stock = sourceLorryStock.find((s) => s.productId === item.productId);
      const prodName = stock?.product?.name || 'Selected item';
      const availPaid = stock?.quantity || 0;
      const availFree = stock?.freeQuantity || 0;

      if (item.quantity > availPaid) {
        setErrorMessage(
          `Cannot transfer ${item.quantity} paid units of "${prodName}". ${fromLorry?.vehicleNumber} only has ${availPaid} paid units onboard.`
        );
        return;
      }

      if (item.freeQuantity > availFree) {
        setErrorMessage(
          `Cannot transfer ${item.freeQuantity} free units of "${prodName}". ${fromLorry?.vehicleNumber} only has ${availFree} free units onboard.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const createdTransfer = await LorryService.createTransfer({
        paperSlipNumber: paperSlipNumber.trim() || undefined,
        fromLorryId,
        toLorryId,
        notes: notes.trim() || undefined,
        items: validItems
      });

      // Dispatch global data refresh event
      window.dispatchEvent(
        new CustomEvent('app:data-changed', {
          detail: { source: 'inter-lorry-transfer', transferId: createdTransfer.id }
        })
      );

      onSuccess(createdTransfer);
      onClose();
    } catch (err: any) {
      console.error('Failed to create inter-lorry transfer', err);
      setErrorMessage(
        err.response?.data?.error || err.message || 'Failed to record on-route transfer.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-blue-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <RotateCcw className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                Record Route Stock Exchange Slip
              </h3>
              <p className="text-xs text-slate-500">
                Evening entry for physical inter-lorry transfer notes signed on route
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Reference Paper Slip Number & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Physical Paper Slip / Note # <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={paperSlipNumber}
                  onChange={(e) => setPaperSlipNumber(e.target.value)}
                  placeholder="e.g. SLIP-104 or EX-22"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Number from the handwritten slip brought by the driver
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Handover Location / Route Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Handed over at Matale Clock Tower Junction"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>
          </div>

          {/* Lorry Selector Card (Source -> Destination) */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
              Select Fleet Exchange Vehicles
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* Giving Lorry */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Handed Over From (Giving Lorry)
                </label>
                <select
                  value={fromLorryId}
                  onChange={(e) => handleFromLorryChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {lorries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.vehicleNumber} — {l.driverName} {l.route ? `(${l.route.name})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Floating items available on this lorry: {sourceLorryStock.length}
                </span>
              </div>

              {/* Receiving Lorry */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Received By (Receiving Lorry)
                </label>
                <select
                  value={toLorryId}
                  onChange={(e) => setToLorryId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  {availableToLorries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.vehicleNumber} — {l.driverName} {l.route ? `(${l.route.name})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 block">
                  Stock will be credited to this lorry's balance
                </span>
              </div>
            </div>
          </div>

          {/* Product Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  Exchanged Product Line(s)
                </label>
                <p className="text-[11px] text-slate-500">
                  Select items and enter units handed over according to the paper note
                </p>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/60 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {loadingStock ? (
              <div className="p-6 text-center text-xs text-slate-400 border border-slate-100 rounded-2xl">
                Checking live floating stock on {fromLorry?.vehicleNumber || 'source lorry'}...
              </div>
            ) : sourceLorryStock.length === 0 ? (
              <div className="p-5 text-center text-xs text-amber-700 bg-amber-50/60 border border-amber-200/60 rounded-2xl">
                <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                <span className="font-bold">No active floating stock found on {fromLorry?.vehicleNumber}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ensure this lorry has a Morning Lorry Loading session recorded.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {rows.map((row, idx) => {
                  const selectedStock = sourceLorryStock.find((s) => s.productId === row.productId);
                  const maxPaid = selectedStock?.quantity || 0;
                  const maxFree = selectedStock?.freeQuantity || 0;

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50/80 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row gap-2.5 sm:items-center"
                    >
                      {/* Product Selector */}
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Product ({fromLorry?.vehicleNumber || 'Source'})
                        </label>
                        <select
                          value={row.productId}
                          onChange={(e) => updateRow(idx, 'productId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500"
                        >
                          <option value="">-- Choose Floating Item --</option>
                          {sourceLorryStock.map((s) => (
                            <option key={s.productId} value={s.productId}>
                              {s.product.name} (Max: {s.quantity} paid + {s.freeQuantity || 0} free)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Paid Qty */}
                      <div className="w-full sm:w-28">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Paid Qty {row.productId && <span className="text-amber-700">(Max {maxPaid})</span>}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={maxPaid}
                          value={row.quantity}
                          onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      {/* Free Promo Qty */}
                      <div className="w-full sm:w-28">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Free Qty {row.productId && <span className="text-indigo-700">(Max {maxFree})</span>}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={maxFree}
                          value={row.freeQuantity}
                          onChange={(e) => updateRow(idx, 'freeQuantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-semibold text-indigo-700 focus:outline-hidden focus:border-indigo-500"
                        />
                      </div>

                      {/* Remove Button */}
                      <div className="sm:pt-5">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || sourceLorryStock.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Recording Transfer...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Exchange & Reconcile Lorries</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

