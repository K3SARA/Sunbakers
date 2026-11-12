import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  CreditCard,
  Eye,
  Building2,
  RotateCcw,
  Percent,
  Tag
} from 'lucide-react';
import { Lorry, Customer, Order, Product } from '../types';
import { LorryService, CustomerService, OrderService, ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { CustomerModal } from '../components/CustomerModal';

interface BillItemRow {
  productId: string;
  quantity: number;
  freeQuantity: number;
  unitPrice?: number;
  discountPercent?: number;
}

interface BillReturnRow {
  productId: string;
  quantity: number;
  unitPrice?: number;
  returnType: 'DAMAGE' | 'RESALE';
  reason?: string;
}

interface BillEntryProps {
  onViewInvoice?: (order: Order) => void;
}

export const BillEntry: React.FC<BillEntryProps> = ({ onViewInvoice }) => {
  const { formatMoney } = useCurrency();

  // Mode: LORRY (Evening driver paper slip entry) vs WALK_IN (Counter / Walk-in sale from warehouse)
  const [billMode, setBillMode] = useState<'LORRY' | 'WALK_IN'>('LORRY');

  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<Product[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);

  // Bill Form state
  const [paperBillNumber, setPaperBillNumber] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [billItems, setBillItems] = useState<BillItemRow[]>([{ productId: '', quantity: 1, freeQuantity: 0 }]);
  const [returnItems, setReturnItems] = useState<BillReturnRow[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  // Customer Unpaid Bills (for Bill-to-Bill clearance / knock-off)
  const [customerUnpaidBills, setCustomerUnpaidBills] = useState<Order[]>([]);
  const [, setLoadingUnpaidBills] = useState<boolean>(false);
  const [settlePreviousBill, setSettlePreviousBill] = useState<boolean>(false);
  const [settleAmount, setSettleAmount] = useState<string>('');

  const [, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);

  // Draft persistence in localStorage
  const DRAFT_KEY = 'distributor_bill_entry_draft';
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(DRAFT_KEY);
    } catch {
      return false;
    }
  });

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.billMode) setBillMode(d.billMode);
        if (d.selectedLorryId) setSelectedLorryId(d.selectedLorryId);
        if (d.paperBillNumber) setPaperBillNumber(d.paperBillNumber);
        if (d.selectedCustomerId) setSelectedCustomerId(d.selectedCustomerId);
        if (d.walkInName) setWalkInName(d.walkInName);
        if (d.walkInPhone) setWalkInPhone(d.walkInPhone);
        if (Array.isArray(d.billItems) && d.billItems.length > 0) {
          setBillItems(d.billItems);
        }
        if (Array.isArray(d.returnItems)) {
          setReturnItems(d.returnItems);
        }
        if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
        if (d.cashReceived) setCashReceived(d.cashReceived);
        if (d.notes) setNotes(d.notes);
        setHasDraft(true);
      }
    } catch (e) {
      console.warn('Failed to restore bill entry draft:', e);
    }
  }, []);

  // Auto-save draft on any input changes
  useEffect(() => {
    const hasContent =
      paperBillNumber.trim() !== '' ||
      walkInName.trim() !== '' ||
      walkInPhone.trim() !== '' ||
      notes.trim() !== '' ||
      (selectedCustomerId !== '' && selectedCustomerId !== 'walk-in') ||
      billItems.some(i => i.productId !== '') ||
      returnItems.some(r => r.productId !== '');

    if (hasContent) {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            billMode,
            selectedLorryId,
            paperBillNumber,
            selectedCustomerId,
            walkInName,
            walkInPhone,
            billItems,
            returnItems,
            paymentMethod,
            cashReceived,
            notes
          })
        );
        setHasDraft(true);
      } catch (e) {}
    }
  }, [
    billMode,
    selectedLorryId,
    paperBillNumber,
    selectedCustomerId,
    walkInName,
    walkInPhone,
    billItems,
    returnItems,
    paymentMethod,
    cashReceived,
    notes
  ]);

  const handleClearForm = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setPaperBillNumber('');
    setBillItems([{ productId: '', quantity: 1, freeQuantity: 0 }]);
    setReturnItems([]);
    setWalkInName('');
    setWalkInPhone('');
    setSelectedCustomerId(billMode === 'WALK_IN' ? 'walk-in' : '');
    setCashReceived('');
    setNotes('');
    setHasDraft(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lorryList, custList, orderList, prodList] = await Promise.all([
        LorryService.getAll(),
        CustomerService.getAll(),
        OrderService.getAll(undefined, undefined, undefined, 25),
        ProductService.getAll()
      ]);

      setLorries(lorryList);
      setCustomers(custList);
      setTodayOrders(orderList);
      setWarehouseProducts(prodList.filter((p: any) => !p.isRawMaterial));

      if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load system data.');
    } finally {
      setLoading(false);
    }
  };

  // Handle mode switch (preserve entered items without wiping)
  const handleModeSwitch = (mode: 'LORRY' | 'WALK_IN') => {
    setBillMode(mode);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (mode === 'WALK_IN') {
      setSelectedCustomerId('walk-in');
    } else {
      if (selectedCustomerId === 'walk-in') {
        setSelectedCustomerId('');
      }
    }
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);
  const availableLorryProducts = selectedLorry?.lorryStocks?.filter((s: any) => (s.quantity > 0) || (s.freeQuantity && s.freeQuantity > 0)) || [];
  const selectedCustomer = selectedCustomerId !== 'walk-in' ? customers.find(c => c.id === selectedCustomerId) : null;

  // Load unpaid bills when selected customer changes
  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId !== 'walk-in') {
      setLoadingUnpaidBills(true);
      CustomerService.getUnpaidBills(selectedCustomerId)
        .then((bills: any[]) => {
          setCustomerUnpaidBills(bills);
          const firstBill = bills[0];
          if (firstBill) {
            // Default to settling the oldest unpaid bill
            const oldestDue = (firstBill.balanceAmount !== undefined && firstBill.balanceAmount > 0)
              ? firstBill.balanceAmount
              : Math.max(0, firstBill.netTotal - (firstBill.paidAmount || 0));
            setSettlePreviousBill(true);
            setSettleAmount(oldestDue.toString());
          } else {
            setSettlePreviousBill(false);
            setSettleAmount('');
          }
        })
        .catch(() => {
          setCustomerUnpaidBills([]);
          setSettlePreviousBill(false);
          setSettleAmount('');
        })
        .finally(() => setLoadingUnpaidBills(false));
    } else {
      setCustomerUnpaidBills([]);
      setSettlePreviousBill(false);
      setSettleAmount('');
    }
  }, [selectedCustomerId]);

  // Auto-filter customers belonging to this lorry's route first, then rest
  const routeCustomers = customers.filter(c => selectedLorry?.routeId && c.routeId === selectedLorry.routeId);
  const otherCustomers = customers.filter(c => !selectedLorry?.routeId || c.routeId !== selectedLorry.routeId);

  // Available stock items depending on mode
  interface AvailableItem {
    id: string;
    productId: string;
    name: string;
    unit: string;
    unitPrice: number;
    stock: number;
    freeStock: number;
    freeRatioBuy?: number;
    freeRatioGet?: number;
  }

  const availableItems: AvailableItem[] = billMode === 'LORRY'
    ? availableLorryProducts.map((s: any) => ({
        id: s.id,
        productId: s.productId,
        name: s.product.name,
        unit: s.product.unit,
        unitPrice: s.product.unitPrice,
        stock: s.quantity,
        freeStock: s.freeQuantity || 0,
        freeRatioBuy: s.product.freeRatioBuy,
        freeRatioGet: s.product.freeRatioGet
      }))
    : warehouseProducts
        .filter(p => p.currentStock > 0 || (p.freeStock && p.freeStock > 0))
        .map(p => ({
          id: p.id,
          productId: p.id,
          name: p.name,
          unit: p.unit,
          unitPrice: p.unitPrice,
          stock: p.currentStock,
          freeStock: p.freeStock || 0,
          freeRatioBuy: p.freeRatioBuy,
          freeRatioGet: p.freeRatioGet
        }));

  const addItemRow = () => {
    setBillItems([...billItems, { productId: '', quantity: 1, freeQuantity: 0, discountPercent: 0 }]);
  };

  const addReturnRow = () => {
    setReturnItems([...returnItems, { productId: '', quantity: 1, returnType: 'DAMAGE', reason: '' }]);
  };

  const updateItemRow = (index: number, field: keyof BillItemRow, value: any) => {
    const updated = [...billItems];
    const currentRow = { ...updated[index], [field]: value };

    // Auto-calculate free issues if trade scheme exists and productId or quantity changed
    if (field === 'productId' || field === 'quantity') {
      const targetProdId = field === 'productId' ? value : currentRow.productId;
      const itemInfo = availableItems.find(s => s.productId === targetProdId);
      const buyRatio = itemInfo?.freeRatioBuy || 0;
      const getRatio = itemInfo?.freeRatioGet || 0;

      if (buyRatio > 0 && getRatio > 0 && currentRow.quantity > 0) {
        currentRow.freeQuantity = Math.floor(currentRow.quantity / buyRatio) * getRatio;
      } else if (field === 'productId') {
        currentRow.freeQuantity = 0;
      }

      if (field === 'productId' && itemInfo) {
        currentRow.unitPrice = itemInfo.unitPrice;
        currentRow.discountPercent = 0;
      }
    }

    if (field === 'discountPercent') {
      const itemInfo = availableItems.find(s => s.productId === currentRow.productId);
      const basePrice = itemInfo ? itemInfo.unitPrice : (currentRow.unitPrice || 0);
      const pct = Math.min(100, Math.max(0, parseFloat(value) || 0));
      currentRow.discountPercent = pct;
      currentRow.unitPrice = Math.max(0, basePrice * (1 - pct / 100));
    }

    if (field === 'unitPrice') {
      const itemInfo = availableItems.find(s => s.productId === currentRow.productId);
      const basePrice = itemInfo ? itemInfo.unitPrice : 0;
      const uPrice = Math.max(0, parseFloat(value) || 0);
      currentRow.unitPrice = uPrice;
      if (basePrice > 0) {
        currentRow.discountPercent = parseFloat((((basePrice - uPrice) / basePrice) * 100).toFixed(2));
      }
    }

    updated[index] = currentRow;
    setBillItems(updated);
  };

  const updateReturnRow = (index: number, field: keyof BillReturnRow, value: any) => {
    const updated = [...returnItems];
    const currentRow = { ...updated[index], [field]: value };
    if (field === 'productId') {
      const prod = warehouseProducts.find(p => p.id === value);
      if (prod) {
        currentRow.unitPrice = prod.unitPrice;
      }
    }
    updated[index] = currentRow;
    setReturnItems(updated);
  };

  const removeItemRow = (index: number) => {
    if (billItems.length === 1) {
      setBillItems([{ productId: '', quantity: 1, freeQuantity: 0, discountPercent: 0 }]);
      return;
    }
    setBillItems(billItems.filter((_, i) => i !== index));
  };

  const removeReturnRow = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  // Calculate bill totals
  const calculateGrossSubtotal = () => {
    return billItems.reduce((acc, item) => {
      const itemInfo = availableItems.find(s => s.productId === item.productId);
      const price = itemInfo ? itemInfo.unitPrice : 0;
      return acc + (price * (item.quantity || 0));
    }, 0);
  };

  const calculateSubtotal = () => {
    return billItems.reduce((acc, item) => {
      const itemInfo = availableItems.find(s => s.productId === item.productId);
      const basePrice = itemInfo ? itemInfo.unitPrice : 0;
      const effectivePrice = item.unitPrice !== undefined ? item.unitPrice : basePrice;
      return acc + (effectivePrice * (item.quantity || 0));
    }, 0);
  };

  const calculateReturnAmount = () => {
    return returnItems.reduce((acc, ret) => {
      if (!ret.productId || ret.quantity <= 0) return acc;
      const prod = warehouseProducts.find(p => p.id === ret.productId);
      const price = ret.unitPrice !== undefined ? ret.unitPrice : (prod ? prod.unitPrice : 0);
      return acc + (price * (ret.quantity || 0));
    }, 0);
  };

  const grossSubtotal = calculateGrossSubtotal();
  const subtotal = calculateSubtotal();
  const totalItemDiscounts = Math.max(0, grossSubtotal - subtotal);
  const returnAmount = calculateReturnAmount();
  const discountPercent = selectedCustomer?.discountPercentage || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const netTotal = Math.max(0, subtotal - discountAmount - returnAmount);
  const totalBilledUnits = billItems.reduce((acc, item) => acc + (item.quantity || 0), 0);
  const totalFreeUnits = billItems.reduce((acc, item) => acc + (item.freeQuantity || 0), 0);
  const totalReturnUnits = returnItems.reduce((acc, ret) => acc + (ret.productId && ret.quantity > 0 ? ret.quantity : 0), 0);

  // Auto set cash received if cash mode
  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setCashReceived(netTotal.toFixed(2));
    } else if (paymentMethod === 'CREDIT') {
      setCashReceived('0');
    }
  }, [paymentMethod, netTotal]);

  const handleSubmitBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (billMode === 'LORRY' && !selectedLorryId) {
      setErrorMessage('Please select an active lorry.');
      return;
    }
    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer for this bill.');
      return;
    }

    const validItems = billItems.filter(i => i.productId && i.quantity > 0);
    const validReturns = returnItems.filter(r => r.productId && r.quantity > 0);

    if (validItems.length === 0 && validReturns.length === 0) {
      setErrorMessage('Please add at least one line item or return item.');
      return;
    }

    // Validate floating lorry stock or central warehouse stock (paid + free units)
    for (const line of validItems) {
      const itemInfo = availableItems.find(s => s.productId === line.productId);
      const totalUnits = (line.quantity || 0) + (line.freeQuantity || 0);
      const totalAvailable = (itemInfo?.stock || 0) + (itemInfo?.freeStock || 0);
      if (!itemInfo || totalAvailable < totalUnits) {
        setErrorMessage(
          `Insufficient ${billMode === 'LORRY' ? `stock on Lorry ${selectedLorry?.vehicleNumber}` : 'Central Warehouse stock'} for "${itemInfo?.name || 'Selected Item'}". Only ${itemInfo?.stock || 0} paid + ${itemInfo?.freeStock || 0} free (${totalAvailable} total) units available, bill requires ${line.quantity} sold + ${line.freeQuantity || 0} free (${totalUnits} total).`
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const parsedCash = parseFloat(cashReceived) || 0;

      if (paymentMethod === 'CHEQUE') {
        if (!chequeNumber.trim()) {
          setErrorMessage('Please provide the Cheque Number for cheque payment.');
          setSubmitting(false);
          return;
        }
      }

      // Prepare previous bill clearance payload if toggled
      const previousBillsPayload =
        settlePreviousBill && customerUnpaidBills.length > 0 && parseFloat(settleAmount) > 0
          ? [
              {
                orderId: customerUnpaidBills[0].id,
                amount: parseFloat(settleAmount),
                paymentMethod: 'CASH'
              }
            ]
          : undefined;

      const formattedReturnsPayload = validReturns.map(r => ({
        productId: r.productId,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        returnType: r.returnType,
        reason: r.reason
      }));

      if (billMode === 'LORRY') {
        const createdOrder = await LorryService.enterDriverBill(selectedLorryId, {
          paperBillNumber: paperBillNumber.trim() || undefined,
          customerId: selectedCustomerId,
          items: validItems.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            freeQuantity: i.freeQuantity || 0,
            unitPrice: i.unitPrice !== undefined ? i.unitPrice : undefined
          })),
          returnItems: formattedReturnsPayload.length > 0 ? formattedReturnsPayload : undefined,
          paymentMethod,
          cashReceived: parsedCash,
          chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber.trim() : undefined,
          bankName: paymentMethod === 'CHEQUE' ? (bankName.trim() || undefined) : undefined,
          chequeDate: paymentMethod === 'CHEQUE' ? (chequeDate || undefined) : undefined,
          notes: notes.trim() || undefined,
          settlePreviousBills: previousBillsPayload
        });

        const settleNote = previousBillsPayload ? ` + Cleared Prev Bill (${formatMoney(previousBillsPayload[0].amount)})` : '';
        const returnNote = returnAmount > 0 ? ` (Deducted ${totalReturnUnits} returned units: -${formatMoney(returnAmount)})` : '';
        setSuccessMessage(
          `Lorry Bill #${paperBillNumber || createdOrder.orderNumber} successfully entered for ${createdOrder.customer.name}! (${totalBilledUnits} paid + ${totalFreeUnits} free units deducted from lorry)${returnNote}${settleNote}`
        );
      } else {
        // WALK_IN mode: deducts directly from warehouse stock
        const createdOrder = await OrderService.create({
          customerId: selectedCustomerId,
          walkInName: walkInName.trim() || undefined,
          walkInPhone: walkInPhone.trim() || undefined,
          paperBillNumber: paperBillNumber.trim() || undefined,
          items: validItems.map(i => ({
            productId: i.productId,
            quantity: i.quantity,
            freeQuantity: i.freeQuantity || 0,
            unitPrice: i.unitPrice !== undefined ? i.unitPrice : undefined
          })),
          returnItems: formattedReturnsPayload.length > 0 ? formattedReturnsPayload : undefined,
          paymentMethod,
          cashReceived: parsedCash,
          chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber.trim() : undefined,
          bankName: paymentMethod === 'CHEQUE' ? (bankName.trim() || undefined) : undefined,
          chequeDate: paymentMethod === 'CHEQUE' ? (chequeDate || undefined) : undefined,
          notes: notes.trim() || undefined,
          settlePreviousBills: previousBillsPayload
        });

        const customerDisplayName = walkInName.trim() || (createdOrder.customer ? createdOrder.customer.name : 'Walk-in Customer');
        const settleNote = previousBillsPayload ? ` + Cleared Prev Bill (${formatMoney(previousBillsPayload[0].amount)})` : '';
        const returnNote = returnAmount > 0 ? ` (Deducted ${totalReturnUnits} returned units: -${formatMoney(returnAmount)})` : '';
        setSuccessMessage(
          `Counter Bill #${paperBillNumber || createdOrder.orderNumber} successfully saved for ${customerDisplayName}! (${totalBilledUnits} paid + ${totalFreeUnits} free units deducted from Central Warehouse)${returnNote}${settleNote}`
        );
      }

      // Reset form & remove draft
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setHasDraft(false);
      setPaperBillNumber('');
      setBillItems([{ productId: '', quantity: 1, freeQuantity: 0 }]);
      setWalkInName('');
      setWalkInPhone('');
      setSelectedCustomerId(billMode === 'WALK_IN' ? 'walk-in' : '');
      setCashReceived('');
      setChequeNumber('');
      setBankName('');
      setChequeDate(new Date().toISOString().split('T')[0]);
      setNotes('');

      // Refresh list & stocks
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to submit bill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Receipt className="w-4 h-4" />
            <span>Billing Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Sales Bill Entry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Issue sales bills for driver lorry deliveries or direct walk-in / counter customers.
          </p>
        </div>

        <div className="self-start sm:self-auto flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-600 font-medium">
            Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Mode Selector Pill Banner */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row gap-1.5 border border-slate-200/80">
        <button
          type="button"
          onClick={() => handleModeSwitch('LORRY')}
          className={`flex-1 py-3 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
            billMode === 'LORRY'
              ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Truck className="w-4.5 h-4.5 shrink-0" />
          <div className="text-left">
            <div className="leading-tight">🚚 Lorry Route Delivery Bill</div>
            <div className="text-[10px] font-normal text-slate-400">Driver paper slip entry • Deducts from lorry floating stock</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleModeSwitch('WALK_IN')}
          className={`flex-1 py-3 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
            billMode === 'WALK_IN'
              ? 'bg-white text-emerald-600 shadow-xs border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Building2 className="w-4.5 h-4.5 shrink-0" />
          <div className="text-left">
            <div className="leading-tight">🏢 Walk-in / Counter Direct Sale</div>
            <div className="text-[10px] font-normal text-slate-400">Warehouse direct desk sale • Deducts directly from central warehouse</div>
          </div>
        </button>
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

      {/* Lorry Selector Bar (Only in Lorry Mode) */}
      {billMode === 'LORRY' ? (
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Active Driver Lorry
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold text-slate-900">{selectedLorry?.vehicleNumber}</span>
                <span className="text-xs text-slate-500">• {selectedLorry?.driverName}</span>
                <span className="text-xs text-blue-600 font-semibold truncate">({selectedLorry?.route?.name || 'No Route'})</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
            {lorries.map((lorry) => {
              const isSelected = lorry.id === selectedLorryId;
              return (
                <button
                  key={lorry.id}
                  onClick={() => setSelectedLorryId(lorry.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {lorry.vehicleNumber}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Walk-in Counter Notice Banner */
        <div className="bg-emerald-50/70 p-3.5 sm:p-4 rounded-3xl border border-emerald-200/80 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              Direct Warehouse Sales Counter
            </span>
            <p className="text-xs text-emerald-700">
              Items billed here are issued on-the-spot and deducted directly from the Central Warehouse stock (no lorry loading required).
            </p>
          </div>
        </div>
      )}

      {/* Bill Entry Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Entry Card (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <FileText className={`w-4.5 h-4.5 ${billMode === 'LORRY' ? 'text-blue-600' : 'text-emerald-600'}`} />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wider">
                {billMode === 'LORRY' ? 'Paper Bill Slip Details' : 'Walk-in Counter Sale Details'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addReturnRow}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/70"
                title="Add Returned or Damaged goods to deduct from bill total"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>+ Return / Damage</span>
              </button>
              <button
                type="button"
                onClick={addItemRow}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-colors ${
                  billMode === 'LORRY'
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                <Plus className="w-4 h-4" /> Add Item Line
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmitBill} className="space-y-4">
            {/* Top row: Paper Bill Number & Customer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  {billMode === 'LORRY' ? "Driver's Paper Bill # (Slip / Invoice No)" : 'Office / Counter Receipt # (Optional)'}
                </label>
                <input
                  type="text"
                  value={paperBillNumber}
                  onChange={(e) => setPaperBillNumber(e.target.value)}
                  placeholder={billMode === 'LORRY' ? 'e.g. SLIP-1082 or B-492' : 'e.g. COUNTER-101 (or leave blank)'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {billMode === 'LORRY' ? 'Retail Customer / Outlet *' : 'Customer Account *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomerModal(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition"
                    title="Register New Customer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>New Customer</span>
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {billMode === 'WALK_IN' ? (
                    <>
                      <option value="walk-in">⚡ Walk-in / Cash Customer (Direct Counter)</option>
                      <optgroup label="Registered Account Holders (Visiting Counter)">
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name} {c.discountPercentage > 0 ? `(${c.discountPercentage}% Disc)` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    <>
                      <option value="">-- Choose Retail Customer --</option>
                      {routeCustomers.length > 0 && (
                        <optgroup label={`Route Customers (${selectedLorry?.route?.name || 'Route'})`}>
                          {routeCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} - {c.name} {c.discountPercentage > 0 ? `(${c.discountPercentage}% Disc)` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherCustomers.length > 0 && (
                        <optgroup label="Other Customers">
                          {otherCustomers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.code} - {c.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Bill-to-Bill Knock-off: Previous Bill Clearance Banner */}
            {(() => {
              if (!selectedCustomerId || selectedCustomerId === 'walk-in' || customerUnpaidBills.length === 0) {
                return null;
              }
              const firstBill = customerUnpaidBills[0];
              if (!firstBill) return null;
              const dueAmount = (firstBill.balanceAmount !== undefined && firstBill.balanceAmount > 0)
                ? firstBill.balanceAmount
                : Math.max(0, firstBill.netTotal - (firstBill.paidAmount || 0));

              return (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-2xl animate-fadeIn space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 uppercase tracking-wide">
                        Bill-To-Bill Knock-off
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Unpaid Previous Delivery Bill Found
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settlePreviousBill}
                        onChange={(e) => setSettlePreviousBill(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-900">
                        Collect & Settle Previous Bill Now
                      </span>
                    </label>
                  </div>

                  {settlePreviousBill && (
                    <div className="p-2.5 bg-white rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">
                          Bill #{firstBill.paperBillNumber || firstBill.orderNumber}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">
                          Total {formatMoney(firstBill.netTotal)}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-mono font-bold text-rose-600">
                          Due: {formatMoney(dueAmount)}
                        </span>
                        {firstBill.daysOpen !== undefined && (
                          <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                            {firstBill.daysOpen === 0 ? 'Today' : `${firstBill.daysOpen}d ago`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-semibold text-slate-600">Settle Amount:</span>
                        <div className="relative w-28">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={dueAmount}
                            value={settleAmount}
                            onChange={(e) => setSettleAmount(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Walk-in Customer Optional Quick Name / Phone */}
            {billMode === 'WALK_IN' && selectedCustomerId === 'walk-in' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                <div>
                  <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Walk-in Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="e.g. Kasun Silva or City Stores"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                    Contact Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="e.g. 077 123 4567"
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Bill Line Items Table */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                {billMode === 'LORRY' ? 'Items Sold From Lorry Stock' : 'Items Sold From Central Warehouse Stock'}
              </span>

              {availableItems.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-800">
                  {billMode === 'LORRY'
                    ? '⚠️ This lorry has no floating stock loaded. Please perform a Morning Lorry Loading first.'
                    : '⚠️ Central Warehouse has 0 items in stock.'}
                </div>
              ) : (
                billItems.map((item, index) => {
                  const itemInfo = availableItems.find(s => s.productId === item.productId);
                  const basePrice = itemInfo ? itemInfo.unitPrice : 0;
                  const effectivePrice = item.unitPrice !== undefined ? item.unitPrice : basePrice;
                  const lineTotal = effectivePrice * (item.quantity || 0);
                  const hasDiscount = (item.discountPercent || 0) > 0;
                  const hasScheme = itemInfo && itemInfo.freeRatioBuy && itemInfo.freeRatioBuy > 0 && itemInfo.freeRatioGet;

                  return (
                    <div
                      key={index}
                      className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-2xl border transition ${
                        hasDiscount ? 'bg-emerald-50/20 border-emerald-200' : 'bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      {/* Product Selector */}
                      <div className="flex-1 w-full">
                        <select
                          value={item.productId}
                          onChange={(e) => updateItemRow(index, 'productId', e.target.value)}
                          required
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">
                            {billMode === 'LORRY' ? '-- Select Item on Lorry --' : '-- Select Item in Warehouse --'}
                          </option>
                          {availableItems.map((s) => (
                            <option key={s.productId} value={s.productId}>
                              {s.name} ({billMode === 'LORRY' ? 'Lorry' : 'Warehouse'}: {s.stock} paid + {s.freeStock} free)
                              {s.freeRatioBuy && s.freeRatioBuy > 0 && s.freeRatioGet
                                ? ` ★ Promo: Buy ${s.freeRatioBuy} get ${s.freeRatioGet} Free`
                                : ''} - {formatMoney(s.unitPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity & Discount Controls Grid */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        {/* Paid Qty */}
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            max={itemInfo ? (itemInfo.stock + itemInfo.freeStock) : 9999}
                            value={item.quantity || ''}
                            onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="Paid Qty"
                            title="Billed / Paid Quantity"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                          />
                        </div>

                        {/* Free Issue Qty */}
                        <div className="w-20 relative">
                          <input
                            type="number"
                            min="0"
                            max={itemInfo ? (itemInfo.stock + itemInfo.freeStock) : 9999}
                            value={item.freeQuantity !== undefined ? item.freeQuantity : ''}
                            onChange={(e) => updateItemRow(index, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="0 Free"
                            title="Promotional Free Issue (Cost: Rs. 0.00)"
                            className="w-full bg-emerald-50/70 border border-emerald-200 text-emerald-900 rounded-xl px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                          />
                          {hasScheme && item.quantity > 0 && (
                            <span className="hidden sm:inline-block absolute -top-2 right-1 px-1 bg-emerald-600 text-[8px] font-bold text-white rounded">
                              Auto
                            </span>
                          )}
                        </div>

                        {/* Item Discount (%) */}
                        <div className="w-20 relative" title="Item discount %">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={item.discountPercent !== undefined && item.discountPercent > 0 ? item.discountPercent : ''}
                            onChange={(e) => updateItemRow(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                            placeholder="0%"
                            className={`w-full border rounded-xl px-2 py-2 text-xs font-bold text-center focus:outline-none focus:ring-2 ${
                              hasDiscount
                                ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 focus:ring-emerald-500'
                                : 'bg-white border-slate-200 text-slate-700 focus:ring-blue-500'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold pointer-events-none">
                            %
                          </span>
                        </div>

                        {/* Line Total & Unit Price */}
                        <div className="w-24 text-right">
                          <span className="block font-mono text-xs font-bold text-slate-800">
                            {formatMoney(lineTotal)}
                          </span>
                          {hasDiscount && (
                            <span className="block font-mono text-[10px] text-emerald-700 font-semibold">
                              {formatMoney(effectivePrice)} <span className="line-through text-slate-400 font-normal">({formatMoney(basePrice)})</span>
                            </span>
                          )}
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Return Goods / Damage Goods (Credit Deductions) */}
            <div className="space-y-2 pt-3 border-t border-dashed border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Customer Returns / Damage Goods (Credit Deduction)
                  </span>
                  {returnItems.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {returnItems.length} {returnItems.length === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addReturnRow}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1 rounded-xl transition flex items-center gap-1 border border-amber-200/60"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Return / Damage
                </button>
              </div>

              {returnItems.length === 0 ? (
                <div className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-500">
                  <span>No returned or damaged items added for this bill.</span>
                  <button
                    type="button"
                    onClick={addReturnRow}
                    className="text-xs text-amber-700 font-semibold hover:underline"
                  >
                    + Add Return / Damage
                  </button>
                </div>
              ) : (
                returnItems.map((ret, index) => {
                  const prod = warehouseProducts.find(p => p.id === ret.productId);
                  const rate = ret.unitPrice !== undefined ? ret.unitPrice : (prod ? prod.unitPrice : 0);
                  const lineReturnTotal = rate * (ret.quantity || 0);

                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 bg-amber-50/40 border border-amber-200/70 rounded-2xl"
                    >
                      {/* Condition / Return Type */}
                      <div className="w-full sm:w-44 shrink-0">
                        <select
                          value={ret.returnType}
                          onChange={(e) => updateReturnRow(index, 'returnType', e.target.value as any)}
                          className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="DAMAGE">💥 Damaged / Expired</option>
                          <option value="RESALE">✨ Good Condition</option>
                        </select>
                      </div>

                      {/* Product Selector */}
                      <div className="flex-1 w-full">
                        <select
                          value={ret.productId}
                          onChange={(e) => updateReturnRow(index, 'productId', e.target.value)}
                          required
                          className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">-- Select Returned Product --</option>
                          {warehouseProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) - Price: {formatMoney(p.unitPrice)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Return Quantity */}
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={ret.quantity || ''}
                          onChange={(e) => updateReturnRow(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                          placeholder="Qty"
                          title="Return Quantity"
                          required
                          className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
                        />
                      </div>

                      {/* Credit Rate per unit */}
                      <div className="w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ret.unitPrice !== undefined ? ret.unitPrice : ''}
                          onChange={(e) => updateReturnRow(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          placeholder="Rate"
                          title="Return Credit Rate"
                          className="w-full bg-white border border-amber-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                        />
                      </div>

                      {/* Reason / Notes */}
                      <div className="flex-1 sm:max-w-44">
                        <input
                          type="text"
                          value={ret.reason || ''}
                          onChange={(e) => updateReturnRow(index, 'reason', e.target.value)}
                          placeholder="Reason (e.g. Expired, Stale)"
                          className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      {/* Line Credit Total */}
                      <div className="w-24 text-right font-mono text-xs font-bold text-rose-600">
                        -{formatMoney(lineReturnTotal)}
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => removeReturnRow(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Payment Details */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash Payment</option>
                    <option value="CREDIT">Credit (Pay Later)</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Cash Received ({formatMoney(0).split(' ')[0]})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Credit / Balance Unpaid
                  </label>
                  <div className="px-3.5 py-2.5 bg-slate-100 rounded-xl text-sm font-mono font-bold text-rose-600">
                    {formatMoney(Math.max(0, netTotal - (parseFloat(cashReceived) || 0)))}
                  </div>
                </div>
              </div>

              {/* Cheque Details when CHEQUE is selected */}
              {paymentMethod === 'CHEQUE' && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      Cheque Information (Tracked in Admin Cheque Management)
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 bg-white px-2.5 py-0.5 rounded-md border border-blue-200">
                      Auto-allocated to Cheque Registry
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">
                        Cheque Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="e.g. 049182"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">
                        Bank Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. Commercial Bank, BOC..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">
                        Cheque Maturity Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={chequeDate}
                        onChange={(e) => setChequeDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Total Driver Cash Handover Breakdown if previous bill is settled */}
              {settlePreviousBill && parseFloat(settleAmount) > 0 && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-xl flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-900">Total Cash Collected Today:</span>
                    <span className="text-slate-600">
                      Current Bill Cash ({formatMoney(parseFloat(cashReceived) || 0)}) + Previous Bill Settle ({formatMoney(parseFloat(settleAmount) || 0)})
                    </span>
                  </div>
                  <span className="font-mono font-extrabold text-sm text-emerald-700 bg-white px-2.5 py-1 rounded-lg border border-emerald-200">
                    {formatMoney((parseFloat(cashReceived) || 0) + (parseFloat(settleAmount) || 0))}
                  </span>
                </div>
              )}

              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional remarks, customer notes, receipt reference..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Calculations & Submit */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Units Outflow
                  </span>
                  <span className="text-sm font-mono font-semibold text-slate-700">
                    {totalBilledUnits} Paid {totalFreeUnits > 0 && <span className="text-emerald-600 font-bold">(+{totalFreeUnits} Free)</span>}
                    {totalReturnUnits > 0 && <span className="text-amber-700 font-bold ml-1">({totalReturnUnits} returned)</span>}
                  </span>
                </div>
                {totalItemDiscounts > 0 && (
                  <>
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Gross Subtotal
                      </span>
                      <span className="text-sm font-mono font-semibold text-slate-500">
                        {formatMoney(grossSubtotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                        Item Discounts
                      </span>
                      <span className="text-sm font-mono font-bold text-emerald-600">
                        -{formatMoney(totalItemDiscounts)}
                      </span>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    {totalItemDiscounts > 0 ? 'Net Subtotal' : 'Subtotal'}
                  </span>
                  <span className="text-sm font-mono font-semibold text-slate-700">
                    {formatMoney(subtotal)}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Customer Discount ({discountPercent}%)
                    </span>
                    <span className="text-sm font-mono font-semibold text-emerald-600">
                      -{formatMoney(discountAmount)}
                    </span>
                  </div>
                )}
                {returnAmount > 0 && (
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Returns / Damages
                    </span>
                    <span className="text-sm font-mono font-semibold text-rose-600">
                      -{formatMoney(returnAmount)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Bill Net Total
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600 font-mono">
                    {formatMoney(netTotal)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {hasDraft && (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors flex items-center gap-1.5"
                    title="Clear current draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting || availableItems.length === 0}
                  className={`flex-1 sm:flex-initial px-6 py-3.5 active:scale-[0.99] text-white text-sm font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                    billMode === 'LORRY'
                      ? 'bg-[#0071E3] hover:bg-blue-600'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Saving Bill...'
                      : billMode === 'LORRY'
                        ? 'Save Lorry Delivery Bill'
                        : 'Save Walk-in Bill'}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right-Side Stock Overview (1 Col) */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                {billMode === 'LORRY' ? (
                  <>
                    <Truck className="w-4 h-4 text-blue-600" />
                    Stock Left in {selectedLorry?.vehicleNumber || 'Lorry'}
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    Central Warehouse Stock
                  </>
                )}
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {availableItems.length} Items Available
              </span>
            </div>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {availableItems.length > 0 ? (
                availableItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl text-xs hover:bg-slate-100/70 transition-colors"
                  >
                    <div className="pr-2">
                      <span className="font-medium text-slate-800 block truncate max-w-[140px] sm:max-w-[180px]">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-slate-400">{formatMoney(item.unitPrice)}</span>
                        {item.freeRatioBuy && item.freeRatioBuy > 0 && item.freeRatioGet ? (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                            Buy {item.freeRatioBuy}+{item.freeRatioGet}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-xs">
                        {item.stock} {item.unit}
                      </span>
                      {item.freeStock > 0 && (
                        <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-1 rounded mt-0.5 border border-emerald-200/60">
                          +{item.freeStock} Free
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">
                  {billMode === 'LORRY' ? 'Lorry has 0 items remaining.' : 'Warehouse has 0 items in stock.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Recorded Bills Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Bills Recorded
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bills brought by drivers and direct counter sales saved in the system today.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-3.5">System Bill #</th>
                <th className="py-3 px-3.5">Paper / Receipt #</th>
                <th className="py-3 px-3.5">Channel / Source</th>
                <th className="py-3 px-3.5">Customer</th>
                <th className="py-3 px-3.5">Payment</th>
                <th className="py-3 px-3.5 text-right">Net Total</th>
                <th className="py-3 px-3.5 text-right">Cash Received</th>
                <th className="py-3 px-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-3.5 font-mono font-bold text-slate-900">
                    {order.orderNumber}
                  </td>
                  <td className="py-3.5 px-3.5 font-mono font-semibold text-blue-600">
                    {order.paperBillNumber || '—'}
                  </td>
                  <td className="py-3.5 px-3.5 text-slate-700">
                    {order.lorry ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <Truck className="w-3.5 h-3.5 text-blue-500" />
                        {order.lorry.vehicleNumber} ({order.lorry.driverName.split(' ')[0]})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                        Warehouse Counter
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3.5 font-semibold text-slate-900">
                    {order.customer?.name || 'Walk-in Customer'}
                  </td>
                  <td className="py-3.5 px-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : order.paymentStatus === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}
                    >
                      {order.paymentMethod} • {order.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono font-bold text-slate-900">
                    {formatMoney(order.netTotal)}
                  </td>
                  <td className="py-3.5 px-3.5 text-right font-mono font-semibold text-emerald-600">
                    {formatMoney(order.cashReceived)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {onViewInvoice && (
                      <button
                        onClick={() => onViewInvoice(order)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Delivery Receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      <CustomerModal
        customer={null}
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        defaultRouteId={selectedLorry?.routeId || undefined}
        onSaved={async (newCust: any) => {
          try {
            const updated = await CustomerService.getAll();
            setCustomers(updated);
            if (newCust?.id) {
              setSelectedCustomerId(newCust.id);
            }
          } catch (e) {
            console.error('Failed to reload customers', e);
          }
        }}
      />
    </div>
  );
};
