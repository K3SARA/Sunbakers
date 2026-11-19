import React, { useState, useEffect, useMemo } from 'react';
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
  Tag,
  AlertTriangle,
  Gift,
  ChevronDown,
  ChevronRight,
  Hash,
  Users,
  ShoppingBag,
  Sparkles
} from 'lucide-react';
import { Lorry, Customer, Order, Product } from '../types';
import { LorryService, CustomerService, OrderService, ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { CustomerModal } from '../components/CustomerModal';
import { InfoTooltip } from '../components/Tooltip';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

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
  isActive?: boolean;
}

export const BillEntry: React.FC<BillEntryProps> = ({ onViewInvoice, isActive = true }) => {
  const { formatMoney } = useCurrency();

  // Mode: LORRY (Evening driver paper slip entry) vs WALK_IN (Counter / Walk-in sale from warehouse)
  const [billMode, setBillMode] = useState<'LORRY' | 'WALK_IN'>('LORRY');

  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouseProducts, setWarehouseProducts] = useState<Product[]>([]);
  const [todayOrders, setTodayOrders] = useState<Order[]>([]);
  const [recentViewMode, setRecentViewMode] = useState<'BILLS' | 'FREE_ISSUES'>('BILLS');
  const [expandedFreeProductIds, setExpandedFreeProductIds] = useState<Set<string>>(new Set());

  // Aggregate item-wise free issues from today's recorded orders
  const todayFreeIssuesItemWise = useMemo(() => {
    const map = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      category: string;
      unitPrice: number;
      freeRatioBuy: number;
      freeRatioGet: number;
      paidQty: number;
      freeQty: number;
      standardFreeQty: number;
      extraFreeQty: number;
      totalQty: number;
      freeRatioPercent: number;
      freeValue: number;
      extraFreeValue: number;
      billsCount: number;
      extraBillsCount: number;
      bills: Array<{
        orderNumber: string;
        paperBillNumber?: string | null;
        customerName: string;
        channel: string;
        paidQty: number;
        freeQty: number;
        standardFreeQty: number;
        extraFreeQty: number;
        freeValue: number;
        extraFreeValue: number;
      }>;
    }>();

    todayOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const prod = item.product;
        if (!prod) return;
        const paidQty = item.quantity || 0;
        const freeQty = item.freeQuantity || 0;
        const unitPrice = item.unitPrice || prod.unitPrice || 0;
        const buyRatio = prod.freeRatioBuy || 0;
        const getRatio = prod.freeRatioGet || 0;

        const stdEligible = (buyRatio > 0 && getRatio > 0)
          ? Math.floor(paidQty / buyRatio) * getRatio
          : 0;
        const stdGiven = Math.min(freeQty, stdEligible);
        const extraGiven = Math.max(0, freeQty - stdEligible);
        const freeVal = freeQty * unitPrice;
        const extraVal = extraGiven * unitPrice;

        let entry = map.get(prod.id);
        if (!entry) {
          entry = {
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            category: prod.category || 'General',
            unitPrice,
            freeRatioBuy: buyRatio,
            freeRatioGet: getRatio,
            paidQty: 0,
            freeQty: 0,
            standardFreeQty: 0,
            extraFreeQty: 0,
            totalQty: 0,
            freeRatioPercent: 0,
            freeValue: 0,
            extraFreeValue: 0,
            billsCount: 0,
            extraBillsCount: 0,
            bills: []
          };
          map.set(prod.id, entry);
        }

        entry.paidQty += paidQty;
        entry.freeQty += freeQty;
        entry.standardFreeQty += stdGiven;
        entry.extraFreeQty += extraGiven;
        entry.totalQty += (paidQty + freeQty);
        entry.freeValue += freeVal;
        entry.extraFreeValue += extraVal;

        if (freeQty > 0) {
          entry.billsCount += 1;
          if (extraGiven > 0) {
            entry.extraBillsCount += 1;
          }
          entry.bills.push({
            orderNumber: order.orderNumber,
            paperBillNumber: order.paperBillNumber,
            customerName: order.customer?.name || 'Walk-in Customer',
            channel: order.lorry?.vehicleNumber || 'Warehouse Counter',
            paidQty,
            freeQty,
            standardFreeQty: stdGiven,
            extraFreeQty: extraGiven,
            freeValue: freeVal,
            extraFreeValue: extraVal
          });
        }
      });
    });

    return Array.from(map.values())
      .filter((i) => i.freeQty > 0)
      .map((i) => {
        i.freeRatioPercent = i.totalQty > 0 ? Math.round((i.freeQty / i.totalQty) * 1000) / 10 : 0;
        return i;
      })
      .sort((a, b) => b.extraFreeQty - a.extraFreeQty || b.freeQty - a.freeQty);
  }, [todayOrders]);

  const toggleFreeItemExpand = (productId: string) => {
    setExpandedFreeProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

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

  // Duplicate item confirmation modal state
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    product: AvailableItem;
    targetIndex: number;
    existingRowIndex: number;
    existingQty: number;
    newQty: number;
  } | null>(null);

  // Bill-wide Discount State
  const [billDiscountType, setBillDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [billDiscountValue, setBillDiscountValue] = useState<string>('');

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
      } catch (e) { }
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
    } catch (e) { }
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

  useLiveRefresh(() => {
    loadData();
  }, { isActive });

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

  // Load unpaid bills and apply default customer discount when selected customer changes
  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId !== 'walk-in') {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust && cust.discountPercentage > 0) {
        setBillDiscountType('PERCENT');
        setBillDiscountValue(cust.discountPercentage.toString());
      } else {
        setBillDiscountValue('');
      }

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
      setBillDiscountValue('');
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
    category?: string;
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
      freeRatioGet: s.product.freeRatioGet,
      category: s.product.category
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
        freeRatioGet: p.freeRatioGet,
        category: p.category
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

  // Safe product selection with duplicate item detection
  const handleProductSelect = (index: number, selectedProductId: string) => {
    if (!selectedProductId) {
      updateItemRow(index, 'productId', '');
      return;
    }

    const existingIndex = billItems.findIndex(
      (it, i) => i !== index && it.productId === selectedProductId && it.productId !== ''
    );

    if (existingIndex !== -1) {
      const itemInfo = availableItems.find(s => s.productId === selectedProductId);
      if (itemInfo) {
        setDuplicateConfirm({
          product: itemInfo,
          targetIndex: index,
          existingRowIndex: existingIndex,
          existingQty: billItems[existingIndex].quantity || 1,
          newQty: billItems[index].quantity || 1
        });
        return;
      }
    }

    updateItemRow(index, 'productId', selectedProductId);
  };

  const handleReturnProductSelect = (index: number, selectedProductId: string) => {
    if (!selectedProductId) {
      updateReturnRow(index, 'productId', '');
      return;
    }

    const existingIndex = returnItems.findIndex(
      (it, i) => i !== index && it.productId === selectedProductId && it.productId !== ''
    );

    if (existingIndex !== -1) {
      const p = warehouseProducts.find(prod => prod.id === selectedProductId);
      if (p) {
        const confirmCombine = window.confirm(
          `⚠️ "${p.name}" is already in Return Line #${existingIndex + 1} with ${returnItems[existingIndex].quantity} units.\n\nClick OK to combine the return quantities, or Cancel to pick another item.`
        );
        if (confirmCombine) {
          updateReturnRow(existingIndex, 'quantity', (returnItems[existingIndex].quantity || 1) + (returnItems[index].quantity || 1));
          if (returnItems.length > 1) {
            removeReturnRow(index);
          } else {
            updateReturnRow(index, 'productId', '');
          }
        }
        return;
      }
    }

    updateReturnRow(index, 'productId', selectedProductId);
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

  const parsedBillDiscount = Math.max(0, parseFloat(billDiscountValue) || 0);
  const discountAmount = billDiscountType === 'PERCENT'
    ? (subtotal * Math.min(100, parsedBillDiscount)) / 100
    : Math.min(subtotal, parsedBillDiscount);
  const effectiveDiscountPercent = subtotal > 0
    ? parseFloat(((discountAmount / subtotal) * 100).toFixed(2))
    : 0;

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

    if (billMode === 'LORRY') {
      if (!selectedLorryId) {
        setErrorMessage('Please select an active lorry.');
        return;
      }
      if (!selectedLorry?.routeId) {
        setErrorMessage(`Lorry ${selectedLorry?.vehicleNumber || 'Selected'} has no assigned route. Please assign a route in Settings > Fleet before billing.`);
        return;
      }
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
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          discountPercentage: effectiveDiscountPercent > 0 ? effectiveDiscountPercent : undefined,
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
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          discountPercentage: effectiveDiscountPercent > 0 ? effectiveDiscountPercent : undefined,
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
      } catch (e) { }
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Sales Bill Entry
            </h1>
            <InfoTooltip text="Issue sales bills for driver lorry deliveries or direct walk-in / counter customers." />
          </div>
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
          className={`flex-1 py-2.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${billMode === 'LORRY'
            ? 'bg-white text-blue-600 shadow-xs border border-slate-200/60'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          <Truck className="w-4.5 h-4.5 shrink-0" />
          <span>🚚 Lorry Route Delivery Bill</span>
          <InfoTooltip text="Driver paper slip entry • Deducts from lorry floating stock" />
        </button>

        <button
          type="button"
          onClick={() => handleModeSwitch('WALK_IN')}
          className={`flex-1 py-2.5 px-4 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${billMode === 'WALK_IN'
            ? 'bg-white text-emerald-600 shadow-xs border border-slate-200/60'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          <Building2 className="w-4.5 h-4.5 shrink-0" />
          <span>🏢 Walk-in / Counter Direct Sale</span>
          <InfoTooltip text="Warehouse direct desk sale • Deducts directly from central warehouse" />
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
                <span className={`text-xs font-semibold truncate ${!selectedLorry?.routeId ? 'text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md font-bold' : 'text-blue-600'}`}>
                  ({selectedLorry?.route?.name || '⚠️ No Route Assigned'})
                </span>
              </div>
            </div>
          </div>

          {billMode === 'LORRY' && selectedLorry && !selectedLorry.routeId && (
            <div className="w-full mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center gap-2 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Warning:</strong> Lorry {selectedLorry.vehicleNumber} has no assigned route. Assign a route in Settings &gt; Fleet Management before creating lorry bills.
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
            {lorries.map((lorry) => {
              const isSelected = lorry.id === selectedLorryId;
              return (
                <button
                  key={lorry.id}
                  onClick={() => setSelectedLorryId(lorry.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${isSelected
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
        <div className="bg-emerald-50/70 p-3 sm:p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Direct Warehouse Sales Counter
              </span>
              <InfoTooltip text="Items billed here are issued on-the-spot and deducted directly from Central Warehouse stock (no lorry loading required)." />
            </div>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-lg border border-emerald-200/60 hidden sm:inline-block">
            Central Stock
          </span>
        </div>
      )}

      {/* Bill Entry Workspace (Full Width) */}
      <form onSubmit={handleSubmitBill} className="space-y-5">

        {/* SECTION 1: Paper Bill Slip & Customer Details */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold font-mono">
                1
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  <FileText className={`w-4 h-4 ${billMode === 'LORRY' ? 'text-blue-600' : 'text-emerald-600'} inline-block mr-1.5 -mt-0.5`} />
                  <span>{billMode === 'LORRY' ? 'Bill Details' : 'Walk-in Counter Sale Details'}</span>
                  <span className="inline-block ml-1.5 align-middle">
                    <InfoTooltip text={billMode === 'LORRY'
                      ? 'Paper bill slip reference number brought by driver & customer selection'
                      : 'Desk counter receipt & retail account selection'} />
                  </span>
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCustomerModal(true)}
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition border border-blue-200/60"
              title="Register New Customer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Customer</span>
            </button>
          </div>

          {/* Grid: Paper Bill Number & Customer Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                {billMode === 'LORRY' ? "Bill Number" : 'Office / Counter Receipt # (Optional)'}
              </label>
              <input
                type="text"
                value={paperBillNumber}
                onChange={(e) => setPaperBillNumber(e.target.value)}
                placeholder={billMode === 'LORRY' ? 'e.g. SLIP-1082 or B-492' : 'e.g. COUNTER-101 (or blank)'}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  {billMode === 'LORRY' ? 'Customer' : 'Customer Account *'}
                </label>
                {selectedCustomer && selectedCustomer.discountPercentage > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {selectedCustomer.discountPercentage}% Discount Active
                  </span>
                )}
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition"
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
                    {!selectedLorry?.routeId ? (
                      <option value="" disabled>⚠️ Selected lorry has no assigned route</option>
                    ) : routeCustomers.length === 0 ? (
                      <option value="" disabled>No customers registered on {selectedLorry?.route?.name || 'this route'}</option>
                    ) : (
                      <optgroup label={`Route Customers (${selectedLorry?.route?.name || 'Route'})`}>
                        {routeCustomers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name} {c.discountPercentage > 0 ? `(${c.discountPercentage}% Disc)` : ''}
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
        </div>

        {/* SECTION 2: Billed Items Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs font-bold font-mono">
                2
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  <ShoppingBag className="w-4 h-4 text-purple-600 inline-block mr-1.5 -mt-0.5" />
                  <span>{billMode === 'LORRY' ? 'Items Sold From Lorry Stock' : 'Items Sold From Central Warehouse'}</span>
                  <span className="inline-block ml-1.5 align-middle">
                    <InfoTooltip text="Line-by-line items, paid quantities, free promotional units, and item discounts" />
                  </span>
                </h3>
              </div>
            </div>
          </div>

          {availableItems.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-800 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                {billMode === 'LORRY'
                  ? 'This lorry has no floating stock loaded. Please perform a Morning Lorry Loading first.'
                  : 'Central Warehouse has 0 finished products in stock.'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[240px]">Product Item</th>
                    <th className="py-2.5 px-2 w-24 text-center">Paid Qty</th>
                    <th className="py-2.5 px-2 w-24 text-center">Free Promo</th>
                    <th className="py-2.5 px-2 w-20 text-center">Disc %</th>
                    <th className="py-2.5 px-3 w-32 text-right whitespace-nowrap">Line Total</th>
                    <th className="py-2.5 px-2 w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {billItems.map((item, index) => {
                    const itemInfo = availableItems.find(s => s.productId === item.productId);
                    const basePrice = itemInfo ? itemInfo.unitPrice : 0;
                    const effectivePrice = item.unitPrice !== undefined ? item.unitPrice : basePrice;
                    const lineTotal = effectivePrice * (item.quantity || 0);
                    const hasDiscount = (item.discountPercent || 0) > 0;
                    const hasScheme = Boolean(itemInfo && itemInfo.freeRatioBuy && itemInfo.freeRatioBuy > 0 && itemInfo.freeRatioGet);

                    return (
                      <tr
                        key={index}
                        className={`transition-colors ${hasDiscount ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/60'
                          }`}
                      >
                        {/* # */}
                        <td className="py-2 px-3 text-center font-mono text-xs font-bold text-slate-400">
                          {index + 1}
                        </td>

                        {/* Product Selector */}
                        <td className="py-2 px-3 min-w-[240px]">
                          <select
                            value={item.productId}
                            onChange={(e) => handleProductSelect(index, e.target.value)}
                            required
                            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate shadow-2xs transition cursor-pointer"
                          >
                            <option value="">
                              {billMode === 'LORRY' ? '-- Select Item on Lorry --' : '-- Select Item in Warehouse --'}
                            </option>
                            {availableItems.map((s) => (
                              <option key={s.productId} value={s.productId}>
                                {s.name} ({billMode === 'LORRY' ? 'Lorry' : 'Warehouse'}: {s.stock} paid + {s.freeStock} free)
                                {s.freeRatioBuy && s.freeRatioBuy > 0 && s.freeRatioGet
                                  ? ` ★ Buy ${s.freeRatioBuy}+${s.freeRatioGet} Free`
                                  : ''} - {formatMoney(s.unitPrice)}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Paid Qty */}
                        <td className="py-2 px-2 w-24">
                          <input
                            type="number"
                            min="1"
                            max={itemInfo ? (itemInfo.stock + itemInfo.freeStock) : 9999}
                            value={item.quantity || ''}
                            onChange={(e) => updateItemRow(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="1"
                            title="Billed / Paid Quantity"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono shadow-2xs"
                          />
                        </td>

                        {/* Free Promo */}
                        <td className="py-2 px-2 w-24">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max={itemInfo ? (itemInfo.stock + itemInfo.freeStock) : 9999}
                              value={item.freeQuantity !== undefined ? item.freeQuantity : ''}
                              onChange={(e) => updateItemRow(index, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                              placeholder="0"
                              title="Promotional Free Issue (Cost: Rs. 0.00)"
                              className="w-full bg-purple-50/70 border border-purple-200 text-purple-900 rounded-xl px-2 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-mono shadow-2xs"
                            />
                            {Boolean(hasScheme && item.quantity > 0) ? (
                              <span className="absolute -top-2 right-1 px-1 bg-purple-600 text-[8px] font-bold text-white rounded shadow-2xs pointer-events-none">
                                Auto
                              </span>
                            ) : null}
                          </div>
                        </td>

                        {/* Disc % */}
                        <td className="py-2 px-2 w-20">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={item.discountPercent !== undefined && item.discountPercent > 0 ? item.discountPercent : ''}
                            onChange={(e) => updateItemRow(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                            placeholder="0%"
                            title="Item discount percentage"
                            className={`w-full border rounded-xl px-2 py-2 text-xs font-bold text-center focus:outline-none focus:ring-2 font-mono shadow-2xs ${hasDiscount
                              ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 focus:ring-emerald-500'
                              : 'bg-white border-slate-200 text-slate-700 focus:ring-blue-500 placeholder:text-slate-400'
                              }`}
                          />
                        </td>

                        {/* Line Total */}
                        <td className="py-2 px-3 w-32 text-right whitespace-nowrap">
                          <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 block">
                            {formatMoney(lineTotal)}
                          </span>
                          {hasDiscount && (
                            <span className="font-mono text-[10px] text-emerald-700 font-semibold block">
                              @{formatMoney(effectivePrice)}
                            </span>
                          )}
                        </td>

                        {/* Row Actions: (+) Add Line & (Trash) Remove Line */}
                        <td className="py-2 px-2 w-16 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={addItemRow}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition shadow-2xs cursor-pointer ${billMode === 'LORRY'
                                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/60'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/60'
                                }`}
                              title="Add Item Line"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItemRow(index)}
                              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer"
                              title="Remove Line Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 3: Customer Returns & Damage Goods */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-bold font-mono">
                3
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  <RotateCcw className="w-4 h-4 text-amber-600 inline-block mr-1.5 -mt-0.5" />
                  <span>Customer Returns / Damaged Good</span>
                  <span className="inline-block ml-1.5 align-middle">
                    <InfoTooltip text="Record expired, market returns or damaged items returned by client to deduct credit" />
                  </span>
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={addReturnRow}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition border border-amber-200/70"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Return Item</span>
            </button>
          </div>

          {returnItems.length === 0 ? (
            <div className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-2xl flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                No returned or damaged items on this bill.
              </span>
              <button
                type="button"
                onClick={addReturnRow}
                className="text-xs text-amber-800 font-bold hover:underline"
              >
                + Add Return Item
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {returnItems.map((ret, index) => {
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
                        onChange={(e) => handleReturnProductSelect(index, e.target.value)}
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
                        className="w-full bg-white border border-amber-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center font-mono"
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
                        className="w-full bg-white border border-amber-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right font-mono"
                      />
                    </div>

                    {/* Reason / Notes */}
                    <div className="flex-1 sm:max-w-44">
                      <input
                        type="text"
                        value={ret.reason || ''}
                        onChange={(e) => updateReturnRow(index, 'reason', e.target.value)}
                        placeholder="Reason (Expired/Stale)"
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
              })}
            </div>
          )}
        </div>

        {/* SECTION 4: Payment Details & Customer Notes */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold font-mono">
                4
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  <CreditCard className="w-4 h-4 text-emerald-600 inline-block mr-1.5 -mt-0.5" />
                  <span>Payment Method & Cash Settlement</span>
                  <span className="inline-block ml-1.5 align-middle">
                    <InfoTooltip text="Record driver cash collections, cheque payments or client credit balances" />
                  </span>
                </h3>
              </div>
            </div>
          </div>

          {/* 3-Panel Payment Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* 1. Payment Method */}
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="CASH">💵 Cash Payment</option>
                <option value="CREDIT">📑 Credit (Pay Later)</option>
                <option value="CHEQUE">🏦 Bank Cheque</option>
              </select>
            </div>

            {/* 2. Cash Collected */}
            <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/70 space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Cash Received ({formatMoney(0).split(' ')[0]})
              </label>
              <input
                type="number"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
              />
            </div>

            {/* 3. Unpaid Balance Status */}
            {(() => {
              const unpaidBal = Math.max(0, netTotal - (parseFloat(cashReceived) || 0));
              const isPaid = unpaidBal <= 0.01 && netTotal > 0;
              return (
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isPaid
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900'
                  : unpaidBal > 0
                    ? 'bg-rose-50/60 border-rose-200/80 text-rose-900'
                    : 'bg-slate-50/80 border-slate-200/70 text-slate-800'
                  }`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider">
                      Unpaid Balance
                    </label>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                      {isPaid ? 'Fully Paid' : 'Credit Balance'}
                    </span>
                  </div>
                  <div className="font-mono text-base sm:text-lg font-bold text-right">
                    {formatMoney(unpaidBal)}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Cheque Details when CHEQUE is selected */}
          {paymentMethod === 'CHEQUE' && (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Cheque Information</span>
                  <InfoTooltip text="Cheque details are recorded and auto-tracked in Post-Dated Cheques (PDC) Management." />
                </span>
                <span className="text-[11px] font-semibold text-blue-600 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                  PDC Cheque
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
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
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
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
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
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
            <div className="p-3 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex items-center justify-between text-xs animate-fadeIn">
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

          {/* Remarks / Customer Notes */}
          <div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks, customer notes, receipt reference..."
              className="w-full bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SECTION 5: Checkout & Bill Summary Bar */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

            {/* Left: Financial Breakdown in Clean Structured Metrics */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Units Count */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Dispatched Units
                </span>
                <span className="text-sm font-mono font-bold text-slate-800">
                  {totalBilledUnits} Paid
                  {totalFreeUnits > 0 && <span className="text-purple-700 ml-1">(+{totalFreeUnits} Free)</span>}
                  {totalReturnUnits > 0 && <span className="text-amber-700 ml-1">(-{totalReturnUnits} Ret)</span>}
                </span>
              </div>

              {/* Subtotal */}
              <div className="border-l border-slate-200 pl-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Subtotal
                </span>
                <span className="text-sm font-mono font-semibold text-slate-800">
                  {formatMoney(subtotal)}
                </span>
              </div>

              {/* Bill Discount Widget */}
              <div className="border-l border-slate-200 pl-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3 text-emerald-600" /> Bill Discount
                  </span>
                  <div className="inline-flex bg-slate-100 border border-slate-200 rounded-md p-0.5 text-[9px] font-bold font-mono">
                    <button
                      type="button"
                      onClick={() => setBillDiscountType('PERCENT')}
                      className={`px-1.5 py-0.2 rounded transition ${billDiscountType === 'PERCENT' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillDiscountType('AMOUNT')}
                      className={`px-1.5 py-0.2 rounded transition ${billDiscountType === 'AMOUNT' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      Rs
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max={billDiscountType === 'PERCENT' ? 100 : subtotal}
                    step={billDiscountType === 'PERCENT' ? '0.5' : '1'}
                    value={billDiscountValue}
                    onChange={(e) => setBillDiscountValue(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 text-center font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {discountAmount > 0 && (
                    <span className="text-xs font-mono font-bold text-emerald-600">
                      -{formatMoney(discountAmount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Returns Deduction (if any) */}
              {returnAmount > 0 && (
                <div className="border-l border-slate-200 pl-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Returns Deduction
                  </span>
                  <span className="text-sm font-mono font-bold text-rose-600">
                    -{formatMoney(returnAmount)}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Net Total & Save Button */}
            <div className="flex items-center justify-between sm:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0">
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Bill Net Total
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono">
                  {formatMoney(netTotal)}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {hasDraft && (
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="h-12 px-4 rounded-2xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Reset Draft"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting || availableItems.length === 0}
                  className={`h-12 px-6 active:scale-[0.99] text-white text-sm font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer ${billMode === 'LORRY'
                    ? 'bg-[#0071E3] hover:bg-blue-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  <Receipt className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Saving Bill...'
                      : billMode === 'LORRY'
                        ? 'Save Bill'
                        : 'Save Walk-in Bill'}
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </form>

      {/* Current Floating Stock in Lorry / Central Warehouse Footer Tile */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3.5 gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${billMode === 'LORRY' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
              {billMode === 'LORRY' ? <Truck className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>{billMode === 'LORRY' ? `Stock Left in ${selectedLorry?.vehicleNumber || 'Lorry'}` : 'Central Warehouse Stock'}</span>
                <InfoTooltip text={billMode === 'LORRY'
                  ? 'Real-time floating stock currently loaded and remaining in this lorry.'
                  : 'Current available stock in the central warehouse.'} />
              </h3>
            </div>
          </div>

          <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 w-fit">
            {availableItems.length} {availableItems.length === 1 ? 'Item' : 'Items'} Available
          </span>
        </div>

        {availableItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto pr-1">
            {availableItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-100/80 rounded-2xl border border-slate-200/60 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <span className="font-semibold text-slate-800 text-xs block truncate" title={item.name}>
                    {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-[11px] text-slate-400 font-medium">
                      {formatMoney(item.unitPrice)}
                    </span>
                    {item.freeRatioBuy && item.freeRatioBuy > 0 && item.freeRatioGet ? (
                      <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/50">
                        Buy {item.freeRatioBuy}+{item.freeRatioGet}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-xl text-xs shadow-2xs">
                    {item.stock} {item.unit}
                  </span>
                  {item.freeStock > 0 && (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md mt-1 border border-emerald-200/70">
                      +{item.freeStock} Free
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            {billMode === 'LORRY' ? 'Lorry has 0 items remaining.' : 'Warehouse has 0 items in stock.'}
          </div>
        )}
      </div>

      {/* Today's Recorded Bills & Free Issues Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>{recentViewMode === 'BILLS' ? 'Recent Bills Recorded' : 'Billed Free Issues (Item-Wise)'}</span>
              <InfoTooltip text={recentViewMode === 'BILLS'
                ? 'Bills brought by drivers and direct counter sales saved in the system today.'
                : "Item-wise breakdown of promotional free issues given on today's bills."} />
            </h3>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl w-fit">
            <button
              type="button"
              onClick={() => setRecentViewMode('BILLS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${recentViewMode === 'BILLS'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Recent Bills ({todayOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setRecentViewMode('FREE_ISSUES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${recentViewMode === 'FREE_ISSUES'
                ? 'bg-white text-purple-700 shadow-2xs'
                : 'text-slate-600 hover:text-purple-700'
                }`}
            >
              <Gift className="w-3.5 h-3.5 text-purple-600" />
              Billed Free Issues ({todayFreeIssuesItemWise.length})
            </button>
          </div>
        </div>

        {recentViewMode === 'BILLS' ? (
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
                {todayOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                      No bills recorded today yet.
                    </td>
                  </tr>
                ) : (
                  todayOrders.map((order) => (
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${order.paymentStatus === 'PAID'
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Ultra Clean & Minimal Item-Wise Free Issues Table */
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3 w-8 text-center"></th>
                    <th className="py-3 px-3">Item & SKU</th>
                    <th className="py-3 px-3">Policy Ratio</th>
                    <th className="py-3 px-3 text-right">Paid Qty</th>
                    <th className="py-3 px-3 text-right">Standard Free</th>
                    <th className="py-3 px-3 text-right">Extra Free</th>
                    <th className="py-3 px-3 text-right">Total Free</th>
                    <th className="py-3 px-3 text-right">Extra Value</th>
                    <th className="py-3 px-3 text-right">Total Free Value</th>
                    <th className="py-3 px-3 text-center">Invoices</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayFreeIssuesItemWise.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center">
                        <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center mx-auto mb-2">
                          <Gift className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700">No promotional free issues given on today's bills</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          When free issue units are entered during billing, they will be tracked and aggregated here item-wise.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    todayFreeIssuesItemWise.map((item) => {
                      const isExpanded = expandedFreeProductIds.has(item.productId);
                      const hasExtra = item.extraFreeQty > 0;
                      return (
                        <React.Fragment key={item.productId}>
                          <tr
                            onClick={() => toggleFreeItemExpand(item.productId)}
                            className={`cursor-pointer transition-colors ${hasExtra
                              ? 'bg-amber-50/30 hover:bg-amber-50/50'
                              : isExpanded
                                ? 'bg-purple-50/30'
                                : 'hover:bg-slate-50/70'
                              }`}
                          >
                            <td className="py-3 px-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-purple-600 mx-auto" />
                              ) : (
                                <ChevronRight className="w-4 h-4 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 block">{item.productName}</span>
                              <span className="text-[10px] font-mono text-slate-400">SKU: {item.sku}</span>
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600">
                              {item.freeRatioBuy > 0 && item.freeRatioGet > 0
                                ? `Buy ${item.freeRatioBuy} + ${item.freeRatioGet} Free`
                                : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-700">
                              {item.paidQty.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-slate-600">
                              {item.standardFreeQty.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {hasExtra ? (
                                <span className="font-mono font-bold px-2 py-0.5 rounded-md text-xs bg-amber-100 text-amber-900 border border-amber-300 inline-block">
                                  +{item.extraFreeQty.toLocaleString()} Extra
                                </span>
                              ) : (
                                <span className="font-mono text-slate-400 text-xs">0</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className="font-mono font-bold px-2 py-0.5 rounded-lg text-xs bg-purple-100 text-purple-800 border border-purple-200 inline-block">
                                +{item.freeQty.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-amber-900 text-xs">
                              {item.extraFreeValue > 0 ? formatMoney(item.extraFreeValue) : '—'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {formatMoney(item.freeValue)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${hasExtra
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                              >
                                {item.billsCount} {item.billsCount === 1 ? 'bill' : 'bills'}
                              </span>
                            </td>
                          </tr>

                          {/* Expandable Slips Sub-table */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70">
                              <td colSpan={10} className="px-4 py-3">
                                <div className="bg-white rounded-xl border border-purple-200 p-3 shadow-2xs space-y-2">
                                  <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block">
                                    Customer Slips: Standard Free vs Extra Given ({item.bills.length})
                                  </span>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead>
                                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                          <th className="py-1.5 px-2">System Bill #</th>
                                          <th className="py-1.5 px-2">Paper Slip #</th>
                                          <th className="py-1.5 px-2">Customer</th>
                                          <th className="py-1.5 px-2">Lorry / Channel</th>
                                          <th className="py-1.5 px-2 text-right">Paid Qty</th>
                                          <th className="py-1.5 px-2 text-right">Standard Free</th>
                                          <th className="py-1.5 px-2 text-right text-amber-800">Extra Free</th>
                                          <th className="py-1.5 px-2 text-right font-bold text-purple-800">Total Free</th>
                                          <th className="py-1.5 px-2 text-right">Extra Value</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {item.bills.map((b, bIdx) => (
                                          <tr key={bIdx} className={`hover:bg-purple-50/20 ${b.extraFreeQty > 0 ? 'bg-amber-50/30' : ''}`}>
                                            <td className="py-1.5 px-2 font-mono font-bold text-slate-900">
                                              {b.orderNumber}
                                            </td>
                                            <td className="py-1.5 px-2 font-mono text-blue-600 font-semibold">
                                              {b.paperBillNumber || '—'}
                                            </td>
                                            <td className="py-1.5 px-2 font-semibold text-slate-800">
                                              {b.customerName}
                                            </td>
                                            <td className="py-1.5 px-2 text-slate-600">
                                              {b.channel}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                                              {b.paidQty}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                                              {b.standardFreeQty}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono font-bold text-amber-800">
                                              {b.extraFreeQty > 0 ? `+${b.extraFreeQty}` : '0'}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono font-bold text-purple-700">
                                              +{b.freeQty}
                                            </td>
                                            <td className="py-1.5 px-2 text-right font-mono font-semibold text-amber-900">
                                              {b.extraFreeValue > 0 ? formatMoney(b.extraFreeValue) : '—'}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
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
        )}
      </div>

      {/* DUPLICATE ITEM CONFIRMATION POPUP */}
      {duplicateConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Item Already in Bill</span>
                  <InfoTooltip text="This product has already been added to a line item in this bill slip." />
                </h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{duplicateConfirm.product.name}</h4>
                  {duplicateConfirm.product.category && (
                    <p className="text-[10px] text-slate-500 font-mono">Category: {duplicateConfirm.product.category}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-blue-600 font-mono">
                  {formatMoney(duplicateConfirm.product.unitPrice)}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                <span className="text-slate-500">Already in Line #{duplicateConfirm.existingRowIndex + 1}:</span>
                <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md font-mono">
                  {duplicateConfirm.existingQty} units
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-800">"{duplicateConfirm.product.name}"</span> is already entered in <span className="font-semibold text-slate-900">Line #{duplicateConfirm.existingRowIndex + 1}</span>. How would you like to proceed?
            </p>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const combinedQty = duplicateConfirm.existingQty + duplicateConfirm.newQty;
                  updateItemRow(duplicateConfirm.existingRowIndex, 'quantity', combinedQty);
                  if (billItems.length > 1) {
                    removeItemRow(duplicateConfirm.targetIndex);
                  } else {
                    updateItemRow(duplicateConfirm.targetIndex, 'productId', '');
                  }
                  setDuplicateConfirm(null);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Combine into Line #{duplicateConfirm.existingRowIndex + 1} ({duplicateConfirm.existingQty + duplicateConfirm.newQty} units)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  updateItemRow(duplicateConfirm.targetIndex, 'productId', duplicateConfirm.product.productId);
                  setDuplicateConfirm(null);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                Keep as a Separate Line Item
              </button>

              <button
                type="button"
                onClick={() => {
                  setDuplicateConfirm(null);
                }}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-500 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
