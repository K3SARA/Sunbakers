import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  AlertCircle,
  PackageMinus,
  Check,
  Plus,
  Trash2,
  Printer,
  Search,
  ArrowLeft,
  Store,
  Layers,
  ChevronDown,
  Loader2
} from 'lucide-react';
import { Customer, Product, Order, Lorry, CustomerBilledProduct } from '../types';
import { LorryService, CustomerService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

export interface DirectReturnLine {
  productId: string;
  productName: string;
  productUnit: string;
  productSku?: string;
  quantity: number;
  unitPrice: number;
  returnType: 'DAMAGE' | 'RESALE';
  reason: string;
  total: number;
}

interface RepDirectReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  availableCustomers: Customer[];
  products: Product[];
  lorryId: string;
  lorry?: Lorry | null;
  onReturnRecorded: (order: Order, creditAmount: number, customerId: string) => void;
}

const COMMON_REASONS = [
  'Stale / Expired Bread',
  'Packaging Damaged',
  'Customer Overstock',
  'Mould / Quality Issue',
  'Wrong Item Delivered'
];

export const RepDirectReturnModal: React.FC<RepDirectReturnModalProps> = ({
  isOpen,
  onClose,
  customer,
  availableCustomers,
  products,
  lorryId,
  lorry,
  onReturnRecorded
}) => {
  const { formatMoney } = useCurrency();

  // Active customer state (allows selection if opened without pre-selected customer or changing)
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(customer);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isChangingCustomer, setIsChangingCustomer] = useState<boolean>(false);

  // Return Items List
  const [returnLines, setReturnLines] = useState<DirectReturnLine[]>([]);

  // Item Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [productSearch, setProductSearch] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [returnType, setReturnType] = useState<'DAMAGE' | 'RESALE'>('DAMAGE');
  const [reason, setReason] = useState<string>('Stale / Expired Bread');
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Customer Billed Products state (enforces returns only for previously billed products)
  const [billedProducts, setBilledProducts] = useState<CustomerBilledProduct[]>([]);
  const [loadingBilledProducts, setLoadingBilledProducts] = useState<boolean>(false);

  // UI / Submission state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync incoming customer prop
  useEffect(() => {
    if (isOpen) {
      setActiveCustomer(customer);
      setIsChangingCustomer(!customer);
      setReturnLines([]);
      setQuantity(1);
      setReturnType('DAMAGE');
      setReason('Stale / Expired Bread');
      setCustomReason('');
      setNotes('');
      setError(null);
      setCustomerSearch('');
      setProductSearch('');
    }
  }, [isOpen, customer]);

  // Load customer's billed products when activeCustomer changes
  useEffect(() => {
    if (!isOpen || !activeCustomer) {
      setBilledProducts([]);
      setSelectedProductId('');
      setUnitPrice('');
      return;
    }
    let isCurrent = true;
    setLoadingBilledProducts(true);
    CustomerService.getBilledProducts(activeCustomer.id)
      .then(prods => {
        if (!isCurrent) return;
        const validProds = prods || [];
        setBilledProducts(validProds);
        if (validProds.length > 0) {
          setSelectedProductId(validProds[0].id);
          setUnitPrice((validProds[0].lastBilledPrice ?? validProds[0].unitPrice).toString());
        } else {
          setSelectedProductId('');
          setUnitPrice('');
        }
      })
      .catch(err => {
        if (!isCurrent) return;
        console.error('Failed to load customer billed products:', err);
        setBilledProducts([]);
        setSelectedProductId('');
        setUnitPrice('');
      })
      .finally(() => {
        if (isCurrent) setLoadingBilledProducts(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, activeCustomer?.id]);

  // Set default unit price when selected product changes (using last billed price if available)
  useEffect(() => {
    if (selectedProductId) {
      const p = billedProducts.find(prod => prod.id === selectedProductId);
      if (p) {
        setUnitPrice((p.lastBilledPrice ?? p.unitPrice).toString());
      }
    }
  }, [selectedProductId, billedProducts]);

  // Filtered customers for selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return availableCustomers;
    const q = customerSearch.toLowerCase();
    return availableCustomers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.companyName && c.companyName.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  }, [availableCustomers, customerSearch]);

  // Filtered products for dropdown (restricted to customer's billed products)
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return billedProducts;
    const q = productSearch.toLowerCase();
    return billedProducts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [billedProducts, productSearch]);

  const selectedProduct = useMemo(() => {
    return billedProducts.find(p => p.id === selectedProductId) || null;
  }, [billedProducts, selectedProductId]);

  // Summary calculations
  const totalReturnCredit = useMemo(() => {
    return returnLines.reduce((sum, item) => sum + item.total, 0);
  }, [returnLines]);

  const totalReturnUnits = useMemo(() => {
    return returnLines.reduce((sum, item) => sum + item.quantity, 0);
  }, [returnLines]);

  if (!isOpen) return null;

  // Add Item to Return List
  const handleAddReturnLine = () => {
    if (!activeCustomer) {
      setError('Please select a customer first.');
      return;
    }
    if (billedProducts.length === 0) {
      setError(`Cannot collect returns: ${activeCustomer.name} has no billed products on record.`);
      return;
    }
    if (!selectedProduct) {
      setError('Please select an eligible billed product to return.');
      return;
    }
    const qty = Math.max(1, parseInt(quantity.toString(), 10) || 1);
    const parsedPrice = parseFloat(unitPrice) >= 0 ? parseFloat(unitPrice) : selectedProduct.unitPrice;
    const finalReason = customReason.trim() || reason;

    const newLine: DirectReturnLine = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      productUnit: selectedProduct.unit || 'pcs',
      productSku: selectedProduct.sku,
      quantity: qty,
      unitPrice: parsedPrice,
      returnType,
      reason: finalReason,
      total: qty * parsedPrice
    };

    setReturnLines(prev => [...prev, newLine]);
    setQuantity(1);
    setCustomReason('');
    setError(null);
  };

  // Remove Item
  const handleRemoveLine = (index: number) => {
    setReturnLines(prev => prev.filter((_, idx) => idx !== index));
  };

  // Submit Direct Return Collection
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeCustomer) {
      setError('Please select a customer before recording return.');
      return;
    }

    if (billedProducts.length === 0) {
      setError(`Cannot collect returns: ${activeCustomer.name} has no billed products on record.`);
      return;
    }

    if (returnLines.length === 0) {
      setError('Please add at least one return product item.');
      return;
    }

    if (!lorryId) {
      setError('No active lorry selected for return collection.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const returnItemsPayload = returnLines.map(line => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        returnType: line.returnType,
        reason: line.reason
      }));

      const payload = {
        customerId: activeCustomer.id,
        items: [], // Direct return collection has 0 sales items
        returnItems: returnItemsPayload,
        paymentMethod: 'CREDIT' as const,
        cashReceived: 0,
        notes: notes.trim()
          ? `Direct Return Collect: ${notes.trim()}`
          : `Direct Return Collect (${returnLines.length} items, ${totalReturnUnits} units)`
      };

      const createdOrder = await LorryService.enterDriverBill(lorryId, payload);

      onReturnRecorded(createdOrder, totalReturnCredit, activeCustomer.id);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to record direct return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-slate-100 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Direct Return Collect</h2>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg">
                  Stale / Returns
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Collect stale bread, expired or market returns without billing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-slate-100">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer Selection Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-600" />
                Customer / Bakery Store
              </span>
              {activeCustomer && !isChangingCustomer && (
                <button
                  type="button"
                  onClick={() => setIsChangingCustomer(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  Change Shop
                </button>
              )}
            </div>

            {/* If Customer is selected and not changing */}
            {activeCustomer && !isChangingCustomer ? (
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {activeCustomer.name}
                    </span>
                    {activeCustomer.code && (
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-white text-slate-700 rounded border border-amber-200">
                        {activeCustomer.code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {activeCustomer.companyName || activeCustomer.deliveryAddress || 'No address specified'}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                    Outstanding Due
                  </span>
                  <span className={`font-mono text-xs font-black ${
                    (activeCustomer.outstandingBalance || 0) > 0 ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {formatMoney(activeCustomer.outstandingBalance || 0)}
                  </span>
                </div>
              </div>
            ) : (
              /* Customer Search and Picker List */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={e => setCustomerSearch(e.target.value)}
                    placeholder="Search customer on route..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                  {filteredCustomers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">No customers found</p>
                  ) : (
                    filteredCustomers.map(c => {
                      const due = c.outstandingBalance || 0;
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setActiveCustomer(c);
                            setIsChangingCustomer(false);
                          }}
                          className="p-2 bg-white hover:bg-amber-50 border border-slate-100 hover:border-amber-200 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate">
                              {c.name}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate block">
                              {c.code ? `[${c.code}] ` : ''}{c.companyName || c.deliveryAddress || 'No shop name'}
                            </span>
                          </div>
                          <span className={`font-mono text-[11px] font-bold shrink-0 ${
                            due > 0 ? 'text-rose-600' : 'text-slate-400'
                          }`}>
                            {due > 0 ? `Due: ${formatMoney(due)}` : 'Clear'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Add Return Items Form */}
          {loadingBilledProducts ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs flex items-center justify-center gap-2.5 text-slate-500 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span>Verifying customer purchase history & billed items...</span>
            </div>
          ) : activeCustomer && billedProducts.length === 0 ? (
            <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Returns Restricted: Customer Has No Billed Products</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                <strong>{activeCustomer.name}</strong> has never been billed for any products. Under distribution policy, reps cannot collect returns from customers who have no purchase history.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <PackageMinus className="w-3.5 h-3.5 text-amber-600" />
                  Add Return / Stale Item
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {billedProducts.length} Billed Items Eligible
                </span>
              </div>

              {/* Product Selector with inline search */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">Select Billed Product</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {billedProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''} — Last Billed: {formatMoney(p.lastBilledPrice ?? p.unitPrice)}
                    </option>
                  ))}
                </select>
              </div>

            {/* Return Type Toggle: Damage vs Resale */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">Return Condition / Category</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setReturnType('DAMAGE');
                    setReason('Stale / Expired Bread');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    returnType === 'DAMAGE'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>💥 Stale / Expired (Damage)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReturnType('RESALE');
                    setReason('Customer Overstock');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                    returnType === 'RESALE'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>✨ Good Resale Return</span>
                </button>
              </div>
            </div>

            {/* Quantity Stepper & Unit Credit Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Quantity */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">
                  Return Quantity ({selectedProduct?.unit || 'pcs'})
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-black text-base flex items-center justify-center transition cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 text-center text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(prev => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-black text-base flex items-center justify-center transition cursor-pointer"
                  >
                    +
                  </button>
                </div>
                {/* Quick Add Pills */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {[5, 10, 20].map(addVal => (
                    <button
                      key={addVal}
                      type="button"
                      onClick={() => setQuantity(prev => prev + addVal)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      +{addVal}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setQuantity(1)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold transition cursor-pointer ml-auto"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Unit Credit Rate */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700">Credit Rate Per Unit</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={e => setUnitPrice(e.target.value)}
                    placeholder="Rate"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="text-[11px] text-slate-500 flex justify-between items-center pt-1 font-medium">
                  <span>Line Credit:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {formatMoney((quantity || 0) * (parseFloat(unitPrice) || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Reason Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700">Return Reason</label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_REASONS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setReason(r);
                      setCustomReason('');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      reason === r && !customReason
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddReturnLine}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add to Return Slip</span>
            </button>
          </div>
          )}

          {/* Section 3: Return Slip Items List */}
          {returnLines.length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-600" />
                  Return Slip Items ({returnLines.length})
                </span>
                <span className="text-xs font-mono font-bold text-amber-700">
                  {totalReturnUnits} units
                </span>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                {returnLines.map((line, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-2.5 bg-white">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {line.productName}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          line.returnType === 'DAMAGE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {line.returnType === 'DAMAGE' ? 'STALE/DMG' : 'RESALE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-mono">
                          {line.quantity} {line.productUnit} x {formatMoney(line.unitPrice)}
                        </span>
                        <span>•</span>
                        <span className="truncate italic text-slate-400">
                          {line.reason}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono text-xs font-bold text-amber-700">
                        {formatMoney(line.total)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Credit Summary & Account Impact Card */}
          <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Total Return Credit
              </span>
              <span className="font-mono text-xl font-black text-amber-700">
                {formatMoney(totalReturnCredit)}
              </span>
            </div>

            {activeCustomer && (
              <div className="pt-2 border-t border-amber-200/80 text-[11px] space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Customer Current Due:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatMoney(activeCustomer.outstandingBalance || 0)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>New Outstanding Due after Credit:</span>
                  <span className="font-mono font-bold">
                    {formatMoney(Math.max(0, (activeCustomer.outstandingBalance || 0) - totalReturnCredit))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmitReturn}
            disabled={loading || returnLines.length === 0 || !activeCustomer || billedProducts.length === 0}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer ${
              loading || returnLines.length === 0 || !activeCustomer || billedProducts.length === 0
                ? 'bg-amber-300 text-white cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 active:scale-95 text-white'
            }`}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Recording Return...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Save Return & Print Slip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

