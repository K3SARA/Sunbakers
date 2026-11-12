import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  AlertCircle,
  ShoppingBag,
  Layers,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Printer,
  Truck,
  CreditCard,
  LogOut,
  Check,
  RotateCcw,
  Target,
  Calendar,
  Award,
  X,
  Flame,
  Receipt,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Fuel,
  Percent,
  Tag,
  Wallet
} from 'lucide-react';
import { Customer, Product, Lorry, Order, User, RepTargetProgress, Expense, CustomerPayment } from '../types';
import { CustomerService, LorryService, ProductService, OrderService, AuthService, ExpenseService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { CustomerModal } from '../components/CustomerModal';
import { RepBillsSummaryModal } from '../components/RepBillsSummaryModal';
import { CustomerPaymentModal } from '../components/CustomerPaymentModal';
import { CustomerReceiptModal } from '../components/CustomerReceiptModal';

interface CartItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  originalUnitPrice: number;
  availableStock: number;
  quantity: number;
  freeQuantity: number;
  discountPercent: number;
}

export interface RepReturnItem {
  id: string;
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  returnType: 'DAMAGE' | 'RESALE';
  reason?: string;
}

interface RepBillingProps {
  onViewInvoice?: (order: Order) => void;
  onExitToMenu?: () => void;
  initialLorryId?: string;
  user?: User;
  onLogout?: () => void;
}

export const RepBilling: React.FC<RepBillingProps> = ({
  onViewInvoice,
  onExitToMenu: _onExitToMenu,
  initialLorryId,
  user,
  onLogout
}) => {
  const { formatMoney } = useCurrency();

  // Current Step: 1 = Customer, 2 = Cart, 3 = Brand, 4 = Products, 5 = Checkout
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Global Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>(initialLorryId || '');
  const [loading, setLoading] = useState<boolean>(true);

  // Step 1: Customer
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [billingMethod, setBillingMethod] = useState<'NORMAL' | 'BILL_TO_BILL'>('NORMAL');
  const [customerUnpaidBills, setCustomerUnpaidBills] = useState<Order[]>([]);
  const [settlePrevAmount, setSettlePrevAmount] = useState<string>('');
  const [collectPrevBill, setCollectPrevBill] = useState<boolean>(false);

  // Step 2 & Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [returnItems, setReturnItems] = useState<RepReturnItem[]>([]);
  const [showAddReturnModal, setShowAddReturnModal] = useState<boolean>(false);
  const [returnSelectedProductId, setReturnSelectedProductId] = useState<string>('');
  const [returnType, setReturnType] = useState<'DAMAGE' | 'RESALE'>('DAMAGE');
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnUnitPrice, setReturnUnitPrice] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Stale / Expired');
  const [isReturnsExpanded, setIsReturnsExpanded] = useState<boolean>(false);

  // Step 3: Brand
  const [selectedBrand, setSelectedBrand] = useState<string>('');

  // Step 4: Product Search
  const [itemSearch, setItemSearch] = useState<string>('');

  // Step 5: Checkout
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT' | 'CHEQUE'>('CREDIT');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [globalDiscountPercent] = useState<number>(0);
  // Item-level Discount Editing State
  const [editingDiscountProductId, setEditingDiscountProductId] = useState<string | null>(null);
  const [discountInputMode, setDiscountInputMode] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountInputValue, setDiscountInputValue] = useState<string>('');
  const [notes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);

  // Finished Bills State & Filters
  type BillsDatePreset = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'all' | 'custom';
  const [finishedBills, setFinishedBills] = useState<Order[]>([]);
  const [loadingFinishedBills, setLoadingFinishedBills] = useState<boolean>(false);
  const [showFinishedBillsModal, setShowFinishedBillsModal] = useState<boolean>(false);
  const [billsSearch, setBillsSearch] = useState<string>('');
  const [billsFilter, setBillsFilter] = useState<'ALL' | 'CASH' | 'CREDIT' | 'CHEQUE'>('ALL');
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [showSummaryBillModal, setShowSummaryBillModal] = useState<boolean>(false);

  // Date Range Filter State for Finished Bills
  const [billsDatePreset, setBillsDatePreset] = useState<BillsDatePreset>('today');
  const [billsDateRange, setBillsDateRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start.toISOString(), to: end.toISOString() };
  });
  const [customBillsStart, setCustomBillsStart] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customBillsEnd, setCustomBillsEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Route Running Expenses State (Wired with Admin)
  const [repExpenses, setRepExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState<boolean>(false);
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('FUEL');
  const [expenseTitle, setExpenseTitle] = useState<string>('Diesel / Fuel Top-up');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expensePaidTo, setExpensePaidTo] = useState<string>('');
  const [expenseRef, setExpenseRef] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expenseSubmitting, setExpenseSubmitting] = useState<boolean>(false);
  const [expenseSuccessMsg, setExpenseSuccessMsg] = useState<string | null>(null);

  // Customer Outstanding Collections State (Collect without billing)
  const [customerFilterTab, setCustomerFilterTab] = useState<'ALL' | 'OUTSTANDING'>('ALL');
  const [showCollectModal, setShowCollectModal] = useState<boolean>(false);
  const [collectingCustomer, setCollectingCustomer] = useState<Customer | null>(null);
  const [recordedPayment, setRecordedPayment] = useState<CustomerPayment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Rep Daily Collections History
  const [repCollections, setRepCollections] = useState<CustomerPayment[]>([]);
  const [loadingCollections, setLoadingCollections] = useState<boolean>(false);
  const [showCollectionsModal, setShowCollectionsModal] = useState<boolean>(false);
  const [collectionsSearch, setCollectionsSearch] = useState<string>('');

  const getBillsRangeForPreset = (
    preset: BillsDatePreset,
    customS?: string,
    customE?: string
  ): { from: string; to: string } => {
    const now = new Date();
    if (preset === 'all') {
      return { from: '', to: '' };
    }
    if (preset === 'yesterday') {
      const yStart = new Date(now);
      yStart.setDate(yStart.getDate() - 1);
      yStart.setHours(0, 0, 0, 0);
      const yEnd = new Date(now);
      yEnd.setDate(yEnd.getDate() - 1);
      yEnd.setHours(23, 59, 59, 999);
      return { from: yStart.toISOString(), to: yEnd.toISOString() };
    }
    if (preset === 'thisWeek') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);
      return { from: weekStart.toISOString(), to: weekEnd.toISOString() };
    }
    if (preset === 'thisMonth') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now);
      monthEnd.setHours(23, 59, 59, 999);
      return { from: monthStart.toISOString(), to: monthEnd.toISOString() };
    }
    if (preset === 'custom') {
      const s = customS || customBillsStart;
      const e = customE || customBillsEnd;
      const cStart = new Date(s);
      cStart.setHours(0, 0, 0, 0);
      const cEnd = new Date(e);
      cEnd.setHours(23, 59, 59, 999);
      return { from: cStart.toISOString(), to: cEnd.toISOString() };
    }
    // Default 'today'
    const tStart = new Date(now);
    tStart.setHours(0, 0, 0, 0);
    const tEnd = new Date(now);
    tEnd.setHours(23, 59, 59, 999);
    return { from: tStart.toISOString(), to: tEnd.toISOString() };
  };

  const billsDateRangeLabel = useMemo(() => {
    if (billsDatePreset === 'today') return 'Today';
    if (billsDatePreset === 'yesterday') return 'Yesterday';
    if (billsDatePreset === 'thisWeek') return 'This Week';
    if (billsDatePreset === 'thisMonth') return 'This Month';
    if (billsDatePreset === 'all') return 'All Time';
    return `${customBillsStart} to ${customBillsEnd}`;
  }, [billsDatePreset, customBillsStart, customBillsEnd]);

  const loadFinishedBills = async (
    lorryIdToUse?: string,
    rangeToUse?: { from: string; to: string }
  ) => {
    try {
      setLoadingFinishedBills(true);
      const targetLorry = lorryIdToUse || selectedLorryId || initialLorryId;
      const activeRange = rangeToUse !== undefined ? rangeToUse : billsDateRange;
      const orders = await OrderService.getAll(
        undefined,
        targetLorry || undefined,
        undefined,
        activeRange.from || activeRange.to ? undefined : 300,
        activeRange.from || undefined,
        activeRange.to || undefined
      );
      setFinishedBills(orders);
    } catch (err) {
      console.error('Failed to load finished bills', err);
    } finally {
      setLoadingFinishedBills(false);
    }
  };

  const handleDatePresetChange = (newPreset: BillsDatePreset) => {
    setBillsDatePreset(newPreset);
    if (newPreset !== 'custom') {
      const range = getBillsRangeForPreset(newPreset);
      setBillsDateRange(range);
      loadFinishedBills(undefined, range);
    }
  };

  const handleApplyCustomDates = () => {
    if (!customBillsStart || !customBillsEnd) return;
    const range = getBillsRangeForPreset('custom', customBillsStart, customBillsEnd);
    setBillsDateRange(range);
    loadFinishedBills(undefined, range);
  };

  // Targets Modal State
  const [showTargetModal, setShowTargetModal] = useState<boolean>(false);
  const [targetProgress, setTargetProgress] = useState<RepTargetProgress | null>(null);
  const [loadingTargets, setLoadingTargets] = useState<boolean>(false);

  const loadTargets = async (lorryIdToUse?: string) => {
    try {
      setLoadingTargets(true);
      const userFromStorage = (() => {
        try {
          const s = localStorage.getItem('distributor_auth_user');
          return s ? JSON.parse(s) : null;
        } catch {
          return null;
        }
      })();
      const activeUser = user || userFromStorage;
      const data = await AuthService.getMyTargets({
        userId: activeUser?.id,
        lorryId: lorryIdToUse || selectedLorryId || initialLorryId || activeUser?.lorryId
      });
      setTargetProgress(data);
    } catch (err) {
      console.error('Failed to load rep targets', err);
    } finally {
      setLoadingTargets(false);
    }
  };

  const loadRepExpenses = async (lorryIdToUse?: string) => {
    try {
      setLoadingExpenses(true);
      const targetLorryId = lorryIdToUse || selectedLorryId;
      if (!targetLorryId) {
        setRepExpenses([]);
        return;
      }
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const list = await ExpenseService.getAll({
        lorryId: targetLorryId,
        from: startOfDay,
        to: endOfDay
      });
      setRepExpenses(list);
    } catch (err) {
      console.error('Failed to load rep route expenses', err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const totalRepExpensesToday = useMemo(() => {
    return repExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [repExpenses]);

  const handleSaveRouteExpense = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedAmt = parseFloat(expenseAmount);
    if (!expenseTitle.trim()) {
      alert('Please enter or select an expense title.');
      return;
    }
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert('Please enter a valid expense amount greater than 0.');
      return;
    }

    try {
      setExpenseSubmitting(true);
      const newExp = await ExpenseService.create({
        category: expenseCategory,
        title: expenseTitle.trim(),
        amount: parsedAmt,
        lorryId: selectedLorryId || undefined,
        paymentMethod: 'CASH',
        paidTo: expensePaidTo.trim() || undefined,
        referenceNumber: expenseRef.trim() || undefined,
        notes: expenseNotes.trim() ? `${expenseNotes.trim()} (Route Rep)` : `Route expense recorded via mobile rep billing`
      });

      setExpenseSuccessMsg(`✓ Expense ${newExp.expenseNumber} (Rs. ${parsedAmt.toLocaleString()}) recorded & wired to Admin!`);
      setExpenseAmount('');
      setExpensePaidTo('');
      setExpenseRef('');
      setExpenseNotes('');
      await loadRepExpenses(selectedLorryId);
      setTimeout(() => setExpenseSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to record expense.');
    } finally {
      setExpenseSubmitting(false);
    }
  };

  const handleDeleteRouteExpense = async (id: string, num: string) => {
    if (!window.confirm(`Delete expense ${num}? This will remove it from the Admin ledger.`)) return;
    try {
      await ExpenseService.delete(id);
      await loadRepExpenses(selectedLorryId);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete expense.');
    }
  };

  // Load customer debt payments collected today by this lorry/rep
  const loadRepCollections = async (lorryIdToUse?: string) => {
    try {
      setLoadingCollections(true);
      const targetLorry = lorryIdToUse || selectedLorryId || initialLorryId;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const payments = await CustomerService.getAllPayments({
        lorryId: targetLorry || undefined,
        from: today.toISOString()
      });
      setRepCollections(payments);
    } catch (err) {
      console.error('Failed to load rep collections', err);
    } finally {
      setLoadingCollections(false);
    }
  };

  // Callback when an outstanding payment is successfully recorded
  const handlePaymentRecorded = (payment: CustomerPayment) => {
    // 1. Immediately update customer balance in local customers list
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === payment.customerId) {
          const newBal = Math.max(0, (c.outstandingBalance || 0) - payment.amount);
          return { ...c, outstandingBalance: newBal };
        }
        return c;
      })
    );

    // 2. Refresh unpaid bills if this was the selected customer
    if (selectedCustomerId === payment.customerId) {
      CustomerService.getUnpaidBills(payment.customerId)
        .then(setCustomerUnpaidBills)
        .catch(() => {});
    }

    // 3. Refresh today's collections list
    loadRepCollections(selectedLorryId || undefined);

    // 4. Set recorded payment and open 80mm printable receipt
    setRecordedPayment(payment);
    setShowReceiptModal(true);
  };

  useEffect(() => {
    loadData();
    loadTargets();
    loadFinishedBills();
    loadRepExpenses();
    loadRepCollections();
  }, []);

  useEffect(() => {
    if (selectedLorryId) {
      loadRepExpenses(selectedLorryId);
      loadRepCollections(selectedLorryId);
    }
  }, [selectedLorryId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custList, prodList, lorryList] = await Promise.all([
        CustomerService.getAll(),
        ProductService.getAll(),
        LorryService.getAll()
      ]);

      setCustomers(custList);
      setProducts(prodList.filter(p => !p.isRawMaterial));
      setLorries(lorryList);

      if (initialLorryId && lorryList.some(l => l.id === initialLorryId)) {
        setSelectedLorryId(initialLorryId);
        loadTargets(initialLorryId);
      } else if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
        loadTargets(lorryList[0].id);
      } else {
        loadTargets();
      }
    } catch (err) {
      console.error('Failed to load rep billing data', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);
  const lorryStockMap = useMemo(() => {
    const map = new Map<string, { stock: number; freeStock: number }>();
    if (selectedLorry && Array.isArray(selectedLorry.lorryStocks)) {
      selectedLorry.lorryStocks.forEach(s => map.set(s.productId, { stock: s.quantity, freeStock: s.freeQuantity || 0 }));
    }
    return map;
  }, [selectedLorry]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // When customer changes, fetch unpaid bills
  useEffect(() => {
    if (selectedCustomerId) {
      CustomerService.getUnpaidBills(selectedCustomerId)
        .then(bills => {
          setCustomerUnpaidBills(bills);
          if (bills.length > 0 && bills[0]) {
            setBillingMethod('BILL_TO_BILL');
            const first = bills[0];
            const due = (first.balanceAmount ?? 0) > 0 ? (first.balanceAmount ?? 0) : Math.max(0, first.netTotal - (first.paidAmount || 0));
            setSettlePrevAmount(due.toString());
            setCollectPrevBill(true);
          } else {
            setBillingMethod('NORMAL');
            setSettlePrevAmount('');
            setCollectPrevBill(false);
          }
        })
        .catch(() => {
          setCustomerUnpaidBills([]);
          setBillingMethod('NORMAL');
          setSettlePrevAmount('');
          setCollectPrevBill(false);
        });

      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust && cust.creditLimit && cust.creditLimit > 0) {
        // Ready
      }
    }
  }, [selectedCustomerId]);

  // Filtered customers (supports All vs Has Outstanding filter)
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (customerFilterTab === 'OUTSTANDING') {
      list = list.filter(c => (c.outstandingBalance || 0) > 0);
    }
    if (!customerSearch.trim()) return list;
    const query = customerSearch.toLowerCase();
    return list.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query)) ||
      (c.code && c.code.toLowerCase().includes(query)) ||
      (c.companyName && c.companyName.toLowerCase().includes(query)) ||
      (c.deliveryAddress && c.deliveryAddress.toLowerCase().includes(query))
    );
  }, [customers, customerFilterTab, customerSearch]);

  const customersWithDebtCount = useMemo(() => {
    return customers.filter(c => (c.outstandingBalance || 0) > 0).length;
  }, [customers]);

  // Aggregate metrics for today's debt collections
  const totalRepCollectionsToday = useMemo(() => {
    return repCollections.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [repCollections]);

  const cashCollectionsToday = useMemo(() => {
    return repCollections
      .filter((p) => p.paymentMethod === 'CASH')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [repCollections]);

  const chequeCollectionsToday = useMemo(() => {
    return repCollections
      .filter((p) => p.paymentMethod === 'CHEQUE')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [repCollections]);

  const filteredRepCollections = useMemo(() => {
    if (!collectionsSearch.trim()) return repCollections;
    const q = collectionsSearch.toLowerCase();
    return repCollections.filter(
      (p) =>
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.customer?.name && p.customer.name.toLowerCase().includes(q)) ||
        (p.customer?.code && p.customer.code.toLowerCase().includes(q)) ||
        (p.chequeNumber && p.chequeNumber.toLowerCase().includes(q))
    );
  }, [repCollections, collectionsSearch]);

  // Distinct Brands
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        brands.add(p.category.trim());
      }
    });
    return Array.from(brands).sort();
  }, [products]);

  // Brand products
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return products.filter(p => {
      const matchBrand = p.category.toLowerCase() === selectedBrand.toLowerCase();
      if (!matchBrand) return false;
      if (!itemSearch.trim()) return true;
      const q = itemSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, selectedBrand, itemSearch]);

  // Cart Management
  const addToCart = (product: Product, qty: number = 1) => {
    const stockInfo = lorryStockMap.get(product.id);
    const lorryStock = stockInfo ? stockInfo.stock : product.currentStock;
    const buyRatio = product.freeRatioBuy || 0;
    const getRatio = product.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        const nextQty = existing.quantity + qty;
        if (nextQty <= 0) {
          return prev.filter(i => i.productId !== product.id);
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: nextQty, freeQuantity: calcFree(nextQty) } : i);
      }
      const initialQty = Math.max(1, qty);
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          category: product.category,
          unit: product.unit,
          unitPrice: product.unitPrice,
          originalUnitPrice: product.unitPrice,
          availableStock: lorryStock,
          quantity: initialQty,
          freeQuantity: calcFree(initialQty),
          discountPercent: 0
        }
      ];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    const buyRatio = product?.freeRatioBuy || 0;
    const getRatio = product?.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next, freeQuantity: calcFree(next) } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const setCartItemQty = (productId: string, qty: number) => {
    const product = products.find(p => p.id === productId);
    const buyRatio = product?.freeRatioBuy || 0;
    const getRatio = product?.freeRatioGet || 0;
    const calcFree = (q: number) => (buyRatio > 0 && getRatio > 0 && q > 0 ? Math.floor(q / buyRatio) * getRatio : 0);

    setCart(prev =>
      prev.map(i => {
        if (i.productId === productId) {
          const safeQty = Math.max(0, qty);
          return {
            ...i,
            quantity: safeQty,
            freeQuantity: calcFree(safeQty)
          };
        }
        return i;
      })
    );
  };

  const removeCartItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.productId !== productId));
    if (editingDiscountProductId === productId) {
      setEditingDiscountProductId(null);
    }
  };

  // Set discount percentage for a specific cart item
  const setCartItemDiscountPercent = (productId: string, percent: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const safePercent = Math.min(100, Math.max(0, percent || 0));
          const basePrice = item.originalUnitPrice || item.unitPrice;
          const discountedPrice = Math.max(0, basePrice * (1 - safePercent / 100));
          return {
            ...item,
            discountPercent: safePercent,
            unitPrice: discountedPrice
          };
        }
        return item;
      })
    );
  };

  // Set discount flat amount per unit for a specific cart item
  const setCartItemDiscountAmountPerUnit = (productId: string, amountOff: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const basePrice = item.originalUnitPrice || item.unitPrice;
          const safeAmount = Math.min(basePrice, Math.max(0, amountOff || 0));
          const discountedPrice = Math.max(0, basePrice - safeAmount);
          const percent = basePrice > 0 ? (safeAmount / basePrice) * 100 : 0;
          return {
            ...item,
            discountPercent: parseFloat(percent.toFixed(2)),
            unitPrice: discountedPrice
          };
        }
        return item;
      })
    );
  };

  const openItemDiscountEditor = (item: CartItem) => {
    setEditingDiscountProductId(item.productId);
    setDiscountInputMode('PERCENT');
    setDiscountInputValue(item.discountPercent > 0 ? item.discountPercent.toString() : '');
  };

  // Return Items Management
  const handleOpenAddReturnModal = () => {
    const defaultProduct = products[0];
    if (defaultProduct) {
      setReturnSelectedProductId(defaultProduct.id);
      setReturnUnitPrice(defaultProduct.unitPrice.toString());
    } else {
      setReturnSelectedProductId('');
      setReturnUnitPrice('');
    }
    setReturnType('DAMAGE');
    setReturnQty(1);
    setReturnReason('Stale / Expired');
    setShowAddReturnModal(true);
  };

  const handleSelectReturnProduct = (productId: string) => {
    setReturnSelectedProductId(productId);
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setReturnUnitPrice(prod.unitPrice.toString());
    }
  };

  const handleConfirmAddReturn = () => {
    const prod = products.find(p => p.id === returnSelectedProductId);
    if (!prod) {
      alert('Please select a product to return.');
      return;
    }
    const qty = parseInt(returnQty as any, 10) || 0;
    if (qty <= 0) {
      alert('Please enter a valid return quantity greater than 0.');
      return;
    }
    const price = parseFloat(returnUnitPrice);
    const safePrice = isNaN(price) || price < 0 ? prod.unitPrice : price;

    setReturnItems(prev => {
      const existingIndex = prev.findIndex(r => r.productId === prod.id && r.returnType === returnType);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + qty,
          unitPrice: safePrice,
          reason: returnReason.trim() || next[existingIndex].reason
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `${prod.id}-${returnType}-${Date.now()}`,
          productId: prod.id,
          name: prod.name,
          unit: prod.unit,
          quantity: qty,
          unitPrice: safePrice,
          returnType,
          reason: returnReason.trim() || (returnType === 'DAMAGE' ? 'Stale / Expired' : 'Good Resellable')
        }
      ];
    });

    setIsReturnsExpanded(true);
    setShowAddReturnModal(false);
  };

  const updateReturnQty = (id: string, delta: number) => {
    setReturnItems(prev =>
      prev
        .map(i => {
          if (i.id === id) {
            const next = i.quantity + delta;
            return next > 0 ? { ...i, quantity: next } : null;
          }
          return i;
        })
        .filter(Boolean) as RepReturnItem[]
    );
  };

  const setReturnItemQty = (id: string, qty: number) => {
    setReturnItems(prev =>
      prev.map(i => {
        if (i.id === id) {
          return { ...i, quantity: Math.max(1, qty) };
        }
        return i;
      })
    );
  };

  const removeReturnItem = (id: string) => {
    setReturnItems(prev => prev.filter(i => i.id !== id));
  };

  // Gross subtotal (using original base unit price)
  const cartGrossSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.originalUnitPrice || item.unitPrice) * item.quantity, 0);
  }, [cart]);

  // Net subtotal (after item-level discounts)
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  // Total discounts given on individual items
  const totalItemDiscounts = useMemo(() => {
    return Math.max(0, cartGrossSubtotal - cartSubtotal);
  }, [cartGrossSubtotal, cartSubtotal]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const totalReturnAmount = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [returnItems]);

  const totalReturnUnits = useMemo(() => {
    return returnItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [returnItems]);

  const finalTotal = useMemo(() => {
    const billDiscount = (cartSubtotal * (globalDiscountPercent || 0)) / 100;
    return Math.max(0, cartSubtotal - billDiscount - totalReturnAmount);
  }, [cartSubtotal, globalDiscountPercent, totalReturnAmount]);

  // Date-filtered bills (filtered by selected date range)
  const dateFilteredBills = useMemo(() => {
    return finishedBills.filter(bill => {
      if (billsDatePreset !== 'all' && billsDateRange.from && billsDateRange.to) {
        const billTime = new Date(bill.createdAt).getTime();
        const start = new Date(billsDateRange.from).getTime();
        const end = new Date(billsDateRange.to).getTime();
        if (billTime < start || billTime > end) {
          return false;
        }
      }
      return true;
    });
  }, [finishedBills, billsDatePreset, billsDateRange]);

  // Finished Bills Filter & Summary
  const filteredFinishedBills = useMemo(() => {
    return dateFilteredBills.filter(bill => {
      if (billsFilter !== 'ALL' && bill.paymentMethod !== billsFilter) {
        return false;
      }
      if (billsSearch.trim()) {
        const q = billsSearch.toLowerCase();
        const matchesSlip = (bill.paperBillNumber || '').toLowerCase().includes(q);
        const matchesOrder = bill.orderNumber.toLowerCase().includes(q);
        const matchesCust = (bill.customer?.name || '').toLowerCase().includes(q);
        const matchesShop = (bill.customer?.companyName || '').toLowerCase().includes(q);
        const matchesCode = (bill.customer?.code || '').toLowerCase().includes(q);
        const matchesPhone = (bill.customer?.phone || '').toLowerCase().includes(q);
        return matchesSlip || matchesOrder || matchesCust || matchesShop || matchesCode || matchesPhone;
      }
      return true;
    });
  }, [dateFilteredBills, billsFilter, billsSearch]);

  const finishedBillsSummary = useMemo(() => {
    const totalBills = filteredFinishedBills.length;
    const totalValue = filteredFinishedBills.reduce((acc: number, b: Order) => acc + (b.netTotal || 0), 0);
    const totalCash = filteredFinishedBills.reduce((acc: number, b: Order) => acc + (b.cashReceived || 0), 0);
    const cashBills = filteredFinishedBills.filter((b: Order) => b.paymentMethod === 'CASH');
    const creditBills = filteredFinishedBills.filter((b: Order) => b.paymentMethod === 'CREDIT');
    const chequeBills = filteredFinishedBills.filter((b: Order) => b.paymentMethod === 'CHEQUE');
    const totalCheque = chequeBills.reduce((acc: number, b: Order) => acc + (b.netTotal || 0), 0);
    const totalCredit = filteredFinishedBills.reduce((acc: number, b: Order) => {
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
  }, [filteredFinishedBills]);

  // Checkout submission
  const handleFinalCheckout = async () => {
    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer first.');
      setCurrentStep(1);
      return;
    }
    if (cart.length === 0 && returnItems.length === 0) {
      setErrorMessage('Please add at least one product or customer return item.');
      setCurrentStep(3);
      return;
    }

    if (paymentMethod === 'CHEQUE') {
      if (!chequeNumber.trim()) {
        setErrorMessage('Please enter the Cheque Number.');
        return;
      }
      if (!bankName.trim()) {
        setErrorMessage('Please enter or select the Bank Name.');
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const itemsPayload = cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity || 0,
        unitPrice: item.unitPrice
      }));

      const returnPayload = returnItems.map(ret => ({
        productId: ret.productId,
        quantity: ret.quantity,
        unitPrice: ret.unitPrice,
        returnType: ret.returnType,
        reason: ret.reason
      }));

      const previousBillsPayload =
        billingMethod === 'BILL_TO_BILL' && collectPrevBill && customerUnpaidBills.length > 0 && customerUnpaidBills[0]
          ? [
              {
                orderId: customerUnpaidBills[0].id,
                amount: parseFloat(settlePrevAmount) || 0,
                paymentMethod: paymentMethod === 'CREDIT' ? 'CASH' : paymentMethod
              }
            ]
          : [];

      const orderPayload: any = {
        customerId: selectedCustomerId,
        paymentMethod,
        items: itemsPayload,
        returnItems: returnPayload,
        discountAmount: (cartSubtotal * (globalDiscountPercent || 0)) / 100,
        discountPercentage: globalDiscountPercent,
        notes: notes.trim() || undefined,
        settlePreviousBills: previousBillsPayload
      };

      if (paymentMethod === 'CHEQUE') {
        orderPayload.chequeNumber = chequeNumber.trim();
        orderPayload.bankName = bankName.trim();
        orderPayload.chequeDate = chequeDate || undefined;
      }

      let createdOrder: Order;
      if (selectedLorryId) {
        createdOrder = await LorryService.enterDriverBill(selectedLorryId, orderPayload);
      } else {
        createdOrder = await OrderService.create(orderPayload);
      }

      setCheckoutSuccessOrder(createdOrder);
      await Promise.all([
        loadTargets(selectedLorryId || undefined),
        loadFinishedBills(selectedLorryId || undefined)
      ]);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to complete bill.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewBill = () => {
    setCart([]);
    setReturnItems([]);
    setSelectedCustomerId('');
    setBillingMethod('NORMAL');
    setCustomerUnpaidBills([]);
    setSettlePrevAmount('');
    setCollectPrevBill(false);
    setChequeNumber('');
    setBankName('');
    setChequeDate(new Date().toISOString().split('T')[0]);
    setCheckoutSuccessOrder(null);
    setEditingDiscountProductId(null);
    setDiscountInputValue('');
    setIsReturnsExpanded(false);
    setCurrentStep(1);
    setCustomerSearch('');
    setItemSearch('');
    loadTargets(selectedLorryId || undefined);
    loadFinishedBills(selectedLorryId || undefined);
  };

  const handleCancelCheckout = () => {
    if (window.confirm('Are you sure you want to cancel this bill? The current cart items will be cleared.')) {
      handleStartNewBill();
    }
  };

  const stepLabels = ['Customer', 'Cart', 'Brand', 'Items', 'Checkout'];

  if (loading) {
    return (
      <div className="flex-1 min-h-[80vh] flex items-center justify-center text-slate-400 text-xs">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#F8FAFC] text-slate-900 select-none pb-28 sm:pb-24">
      {/* 1. SINGLE UNIFIED SLIM HEADER (50px) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-slate-900 truncate">
              {user?.fullName || 'Route Rep'}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium truncate">
              {selectedLorry?.vehicleNumber || 'Route Lorry'} {selectedLorry?.route ? `• ${selectedLorry.route.code}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick Cart Button */}
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
              cart.length > 0 || returnItems.length > 0
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="View Cart & Returns"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cart</span>
            <span className={`font-mono text-xs font-bold px-1.5 py-0.2 rounded-md ${
              cart.length > 0 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {totalItemsCount}
            </span>
            {returnItems.length > 0 && (
              <span className="px-1 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[9px] font-black">
                -{totalReturnUnits} ret
              </span>
            )}
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* 2. MINIMAL SLIM PROGRESS BAR (24px) */}
      <div className="bg-white border-b border-slate-200/60 px-4 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
          <span className="text-blue-600 uppercase tracking-wider">
            {stepLabels[currentStep - 1]}
          </span>
          <span className="font-mono text-slate-400">Step {currentStep} / 5</span>
        </div>
        <div className="max-w-2xl mx-auto w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="max-w-2xl mx-auto w-full px-4 mt-3">
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-700 text-xs font-medium">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold ml-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 3. STEP VIEWS (Clean, Single Page, Minimal Text) */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-3">
        {/* ======================================================== */}
        {/* STEP 1: SELECT CUSTOMER */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="space-y-3">
            {/* Rep Sales Target Goal Widget */}
            {user?.monthlyTarget && user.monthlyTarget > 0 ? (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-2.5 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">Monthly Goal</span>
                    <span className="text-[10px] text-slate-500 font-medium">Daily: {formatMoney(user.dailyTarget || 0)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded-lg shadow-2xs border border-blue-100 text-xs inline-block">
                    {formatMoney(user.monthlyTarget)}
                  </span>
                  {user.targetNewClients ? (
                    <span className="block text-[9px] text-slate-400 font-medium mt-0.5">Target: {user.targetNewClients} new shops</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Search Input & Quick (+) Add Customer Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Search customer name or phone..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold w-4 h-4 flex items-center justify-center cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowAddCustomerModal(true)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition shrink-0 cursor-pointer"
                title="Add New Customer to Database"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="hidden sm:inline">Add Customer</span>
              </button>
            </div>

            {/* Quick Filter Tabs: All vs Has Outstanding */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setCustomerFilterTab('ALL')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerFilterTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>All Shops</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-mono">
                  {customers.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerFilterTab('OUTSTANDING')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  customerFilterTab === 'OUTSTANDING'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 hover:bg-rose-100/70'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Has Outstanding</span>
                {customersWithDebtCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    customerFilterTab === 'OUTSTANDING'
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-100 text-rose-700 border border-rose-200'
                  }`}>
                    {customersWithDebtCount}
                  </span>
                )}
              </button>
            </div>

            {/* Empty State when no customer matches */}
            {filteredCustomers.length === 0 && (
              <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2.5 my-2 shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No customer found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {customerSearch ? `No customer matches "${customerSearch}"` : 'Your customer list is empty'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Register New Customer</span>
                </button>
              </div>
            )}

            {/* Compact Customer List */}
            <div className="space-y-2 max-h-[58vh] overflow-y-auto pr-0.5">
              {filteredCustomers.map(customer => {
                const isSelected = customer.id === selectedCustomerId;
                const balance = customer.outstandingBalance || 0;
                const hasDue = balance > 0;

                return (
                  <div
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className={`cursor-pointer p-3 rounded-xl border transition flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {customer.name}
                        </span>
                        {customer.code && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {customer.code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {customer.phone || customer.deliveryAddress || 'No phone'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasDue ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg font-mono">
                            Due: {formatMoney(balance)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCollectingCustomer(customer);
                              setShowCollectModal(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-2xs transition shrink-0 cursor-pointer"
                            title="Collect Outstanding Payment without billing"
                          >
                            <Wallet className="w-3 h-3" />
                            <span>Collect</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                          Clear
                        </span>
                      )}

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs transition ${
                          isSelected ? 'bg-blue-600 text-white' : 'border border-slate-300'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Customer Inline Drawer (Only if selected) */}
            {selectedCustomer && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-xs animate-in fade-in">
                {/* Collect Outstanding Action Box (Direct without Billing) */}
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                      {selectedCustomer.outstandingBalance > 0 ? 'Outstanding Credit Due' : 'Account Balance'}
                    </span>
                    <span className={`font-mono text-sm font-black ${
                      selectedCustomer.outstandingBalance > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {formatMoney(selectedCustomer.outstandingBalance || 0)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCollectingCustomer(selectedCustomer);
                      setShowCollectModal(true);
                    }}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs transition shrink-0 cursor-pointer"
                  >
                    <Wallet className="w-4 h-4" />
                    <span>
                      {selectedCustomer.outstandingBalance > 0 ? 'Collect Outstanding (No Bill)' : 'Collect Advance / Due'}
                    </span>
                  </button>
                </div>

                {/* Method Switcher */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBillingMethod('NORMAL')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition ${
                      billingMethod === 'NORMAL'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Normal Bill
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillingMethod('BILL_TO_BILL')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                      billingMethod === 'BILL_TO_BILL'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Bill-to-Bill</span>
                    {customerUnpaidBills.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-white/20 text-[10px] rounded-full">
                        {customerUnpaidBills.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* If Bill-to-Bill: Simple Collection Row */}
                {billingMethod === 'BILL_TO_BILL' && customerUnpaidBills.length > 0 && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-xs">
                    <label className="flex items-center gap-1.5 font-bold text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectPrevBill}
                        onChange={e => setCollectPrevBill(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Collect Old Bill</span>
                    </label>

                    {collectPrevBill && (
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-slate-500 font-bold">Rs.</span>
                        <input
                          type="number"
                          value={settlePrevAmount}
                          onChange={e => setSettlePrevAmount(e.target.value)}
                          className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-right font-bold text-xs text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Next Step Button */}
                <button
                  type="button"
                  onClick={() => setCurrentStep(cart.length > 0 || returnItems.length > 0 ? 2 : 3)}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
                >
                  <span>{cart.length > 0 || returnItems.length > 0 ? 'Go to Cart & Returns' : 'Select Brand & Products'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: VIEW CART & CUSTOMER RETURNS */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="space-y-4">
            {/* Top Navigation & Fast Actions */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Customer</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddReturnModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                <span>+ Return / Damage</span>
              </button>
            </div>

            {/* SECTION 1: FRESH PRODUCTS IN CART */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    <ShoppingBag className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Fresh Delivery Products</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Billed to customer</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                >
                  + Add Products
                </button>
              </div>

              {cart.length === 0 ? (
                <div className="p-4 text-center bg-slate-50/70 border border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs font-medium text-slate-500">No fresh products added to cart</p>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Browse Products</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cart.map(item => {
                    const originalPrice = item.originalUnitPrice || item.unitPrice;
                    const hasDiscount = (item.discountPercent || 0) > 0;
                    const lineTotal = item.unitPrice * item.quantity;
                    const totalSavings = (originalPrice - item.unitPrice) * item.quantity;
                    const isEditingDiscount = editingDiscountProductId === item.productId;

                    return (
                      <div
                        key={item.productId}
                        className={`p-2.5 bg-slate-50/70 border rounded-xl transition ${
                          isEditingDiscount
                            ? 'border-blue-400 bg-blue-50/30 ring-2 ring-blue-500/10'
                            : hasDiscount
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                              {hasDiscount && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md font-mono">
                                  <Percent className="w-2.5 h-2.5 stroke-[2.5]" />
                                  <span>{item.discountPercent}% Off</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                              {hasDiscount ? (
                                <>
                                  <span className="line-through text-slate-400 text-[10px]">{formatMoney(originalPrice)}</span>
                                  <span className="font-bold text-emerald-600">{formatMoney(item.unitPrice)}</span>
                                </>
                              ) : (
                                <span>{formatMoney(item.unitPrice)}</span>
                              )}
                              <span>/ {item.unit}</span>
                              {item.freeQuantity > 0 && (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                  +{item.freeQuantity} Free
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Discount Toggle Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditingDiscount) {
                                  setEditingDiscountProductId(null);
                                } else {
                                  openItemDiscountEditor(item);
                                }
                              }}
                              className={`px-1.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                hasDiscount
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : isEditingDiscount
                                  ? 'bg-blue-600 text-white shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300'
                              }`}
                              title="Give discount on this item"
                            >
                              <Percent className="w-3 h-3" />
                              <span>{hasDiscount ? `${item.discountPercent}%` : 'Disc'}</span>
                            </button>

                            {/* Stepper */}
                            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.productId, -1)}
                                className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center font-bold text-slate-700 text-xs hover:bg-slate-100 active:scale-95 transition"
                                title="Decrease quantity"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                  setCartItemQty(item.productId, isNaN(val) ? 0 : Math.max(0, val));
                                }}
                                onBlur={() => {
                                  if (!item.quantity || item.quantity <= 0) {
                                    setCartItemQty(item.productId, 1);
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-10 h-6 bg-transparent text-center font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.productId, 1)}
                                className="w-6 h-6 bg-slate-50 rounded flex items-center justify-center font-bold text-slate-700 text-xs hover:bg-slate-100 active:scale-95 transition"
                                title="Increase quantity"
                              >
                                +
                              </button>
                            </div>

                            {/* Line Total */}
                            <div className="w-16 text-right">
                              <span className="block font-mono font-bold text-xs text-slate-900">
                                {formatMoney(lineTotal)}
                              </span>
                              {hasDiscount && totalSavings > 0 && (
                                <span className="block font-mono text-[9px] font-bold text-emerald-600">
                                  -{formatMoney(totalSavings)}
                                </span>
                              )}
                            </div>

                            {/* Trash */}
                            <button
                              type="button"
                              onClick={() => removeCartItem(item.productId)}
                              className="p-1 text-slate-300 hover:text-red-500 transition cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* INLINE DISCOUNT CONFIG PANEL */}
                        {isEditingDiscount && (
                          <div className="mt-2.5 pt-2.5 border-t border-blue-200/60 bg-white/90 rounded-xl p-2.5 space-y-2 animate-fadeIn shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-blue-950 flex items-center gap-1">
                                <Tag className="w-3 h-3 text-blue-600" />
                                <span>Discount on {item.name}</span>
                              </span>

                              {/* Toggle % vs Rs */}
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setDiscountInputMode('PERCENT')}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                    discountInputMode === 'PERCENT'
                                      ? 'bg-white text-blue-700 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  % Percent
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDiscountInputMode('AMOUNT')}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                    discountInputMode === 'AMOUNT'
                                      ? 'bg-white text-blue-700 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Rs. Off / Unit
                                </button>
                              </div>
                            </div>

                            {/* Preset quick discount buttons */}
                            {discountInputMode === 'PERCENT' ? (
                              <div className="flex flex-wrap gap-1">
                                {[0, 2, 3, 5, 7.5, 10, 15, 20].map(pct => {
                                  const isSelected = item.discountPercent === pct;
                                  return (
                                    <button
                                      key={pct}
                                      type="button"
                                      onClick={() => {
                                        setCartItemDiscountPercent(item.productId, pct);
                                        setDiscountInputValue(pct > 0 ? pct.toString() : '');
                                      }}
                                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : pct === 0
                                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                      }`}
                                    >
                                      {pct === 0 ? 'No Disc (0%)' : `${pct}%`}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {[0, 5, 10, 15, 20, 25, 50].map(amt => {
                                  const base = item.originalUnitPrice || item.unitPrice;
                                  const isSelected = amt === 0 ? item.discountPercent === 0 : Math.abs((base - item.unitPrice) - amt) < 0.01;
                                  return (
                                    <button
                                      key={amt}
                                      type="button"
                                      onClick={() => {
                                        setCartItemDiscountAmountPerUnit(item.productId, amt);
                                        setDiscountInputValue(amt > 0 ? amt.toString() : '');
                                      }}
                                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : amt === 0
                                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                      }`}
                                    >
                                      {amt === 0 ? 'No Disc (Rs. 0)' : `-Rs. ${amt}`}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Custom value input row */}
                            <div className="flex items-center gap-2 pt-1">
                              <div className="relative flex-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={discountInputValue}
                                  placeholder={discountInputMode === 'PERCENT' ? 'Custom % (e.g. 5)' : 'Custom Rs. off (e.g. 10)'}
                                  onChange={(e) => {
                                    setDiscountInputValue(e.target.value);
                                    const val = parseFloat(e.target.value) || 0;
                                    if (discountInputMode === 'PERCENT') {
                                      setCartItemDiscountPercent(item.productId, val);
                                    } else {
                                      setCartItemDiscountAmountPerUnit(item.productId, val);
                                    }
                                  }}
                                  className="w-full bg-white border border-slate-300 rounded-lg pl-2.5 pr-8 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] font-bold font-mono">
                                  {discountInputMode === 'PERCENT' ? '%' : 'Rs.'}
                                </span>
                              </div>

                              {hasDiscount && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCartItemDiscountPercent(item.productId, 0);
                                    setDiscountInputValue('');
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setEditingDiscountProductId(null)}
                                className="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition cursor-pointer"
                              >
                                Done
                              </button>
                            </div>

                            {/* Live calculation banner */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2 text-[11px] space-y-0.5">
                              <div className="flex justify-between text-slate-600">
                                <span>Original Base Price:</span>
                                <span className="font-mono">{formatMoney(originalPrice)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-emerald-700">
                                <span>Discounted Unit Price:</span>
                                <span className="font-mono">{formatMoney(item.unitPrice)} ({item.discountPercent}% off)</span>
                              </div>
                              {item.quantity > 0 && hasDiscount && (
                                <div className="flex justify-between font-bold text-blue-700 pt-0.5 border-t border-slate-200">
                                  <span>Total Savings on {item.quantity} units:</span>
                                  <span className="font-mono">{formatMoney(totalSavings)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Cart Subtotal Breakdown */}
                  <div className="pt-2 border-t border-slate-200/80 space-y-1 text-xs">
                    {totalItemDiscounts > 0 && (
                      <>
                        <div className="flex items-center justify-between text-slate-500 font-medium px-1">
                          <span>Gross Items Total:</span>
                          <span className="font-mono">{formatMoney(cartGrossSubtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-600 font-bold px-1">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5" />
                            <span>Total Item Discounts:</span>
                          </span>
                          <span className="font-mono">-{formatMoney(totalItemDiscounts)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between font-bold text-slate-800 px-1">
                      <span>Products Subtotal ({totalItemsCount} units):</span>
                      <span className="font-mono text-sm text-slate-900">{formatMoney(cartSubtotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 2: CUSTOMER RETURNS & DAMAGED GOODS (MINIMIZABLE / COLLAPSIBLE) */}
            <div className={`bg-white border rounded-2xl shadow-2xs transition-all duration-200 overflow-hidden ${
              returnItems.length > 0
                ? 'border-amber-300/90'
                : 'border-amber-200/70 hover:border-amber-300'
            }`}>
              {/* Header Bar - Clickable to toggle collapse/expand */}
              <div
                onClick={() => setIsReturnsExpanded(prev => !prev)}
                className={`p-3 flex items-center justify-between cursor-pointer select-none transition ${
                  isReturnsExpanded ? 'border-b border-amber-100 bg-amber-50/20' : 'hover:bg-amber-50/30'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    returnItems.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                      <span>Customer Returns & Damages</span>
                      {returnItems.length > 0 ? (
                        <span className="bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold">
                          {returnItems.length} items (-{formatMoney(totalReturnAmount)})
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600/80 font-medium">
                          (Optional)
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-amber-700/80 font-medium truncate">
                      {returnItems.length > 0
                        ? `${totalReturnUnits} units returned • Credits will be deducted`
                        : 'Stale bread, expired items & credits deducted'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReturnsExpanded(true);
                      handleOpenAddReturnModal();
                    }}
                    className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3 h-3 stroke-[3]" />
                    <span>Add Return</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsReturnsExpanded(prev => !prev)}
                    className="w-7 h-7 rounded-lg hover:bg-amber-100/70 text-amber-800 flex items-center justify-center transition cursor-pointer"
                    title={isReturnsExpanded ? 'Minimize / Collapse' : 'Expand Returns'}
                  >
                    {isReturnsExpanded ? (
                      <ChevronUp className="w-4 h-4 text-amber-800" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-amber-800" />
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Content Body */}
              {isReturnsExpanded && (
                <div className="p-3.5 space-y-3 animate-fadeIn">
                  {returnItems.length === 0 ? (
                    <div className="p-3.5 text-center bg-amber-50/40 border border-dashed border-amber-200 rounded-xl space-y-2">
                      <p className="text-xs text-amber-900/80 font-medium">
                        No customer returns or stale items recorded yet.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenAddReturnModal}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg shadow-2xs inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 text-slate-950" />
                        <span>Record Customer Return / Stale Bread</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {returnItems.map(ret => {
                        const lineCredit = ret.unitPrice * ret.quantity;
                        const isDamage = ret.returnType === 'DAMAGE';
                        return (
                          <div
                            key={ret.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                              isDamage ? 'bg-rose-50/50 border-rose-200/80' : 'bg-emerald-50/50 border-emerald-200/80'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  isDamage ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isDamage ? '💥 Damage / Expired' : '✨ Good Resale'}
                                </span>
                                {ret.reason && (
                                  <span className="text-[10px] text-slate-500 italic truncate">
                                    • {ret.reason}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-900 truncate">{ret.name}</h4>
                              <p className="text-[11px] text-slate-500 font-mono">
                                Credit rate: {formatMoney(ret.unitPrice)} / {ret.unit}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Stepper */}
                              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                                <button
                                  type="button"
                                  onClick={() => updateReturnQty(ret.id, -1)}
                                  className="w-7 h-7 bg-slate-50 rounded flex items-center justify-center font-bold text-slate-700 text-xs hover:bg-slate-100 active:scale-95 transition"
                                  title="Decrease return quantity"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={ret.quantity === 0 ? '' : ret.quantity}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    setReturnItemQty(ret.id, isNaN(val) ? 0 : Math.max(0, val));
                                  }}
                                  onBlur={() => {
                                    if (!ret.quantity || ret.quantity <= 0) {
                                      setReturnItemQty(ret.id, 1);
                                    }
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-11 h-7 bg-transparent text-center font-mono font-bold text-xs text-rose-600 focus:outline-none focus:ring-1 focus:ring-rose-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateReturnQty(ret.id, 1)}
                                  className="w-7 h-7 bg-slate-50 rounded flex items-center justify-center font-bold text-slate-700 text-xs hover:bg-slate-100 active:scale-95 transition"
                                  title="Increase return quantity"
                                >
                                  +
                                </button>
                              </div>

                              {/* Line Total */}
                              <span className="w-16 text-right font-mono font-bold text-xs text-rose-600">
                                -{formatMoney(lineCredit)}
                              </span>

                              {/* Trash */}
                              <button
                                type="button"
                                onClick={() => removeReturnItem(ret.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-1 flex items-center justify-between text-xs font-semibold text-rose-700 px-1">
                        <span>Total Return Deductions ({totalReturnUnits} units):</span>
                        <span className="font-mono font-bold text-rose-700">-{formatMoney(totalReturnAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECTION 3: NET SUMMARY & ACTIONS */}
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl space-y-2 shadow-sm">
              <div className="flex justify-between text-xs text-slate-300 font-medium">
                <span>Products Subtotal:</span>
                <span className="font-mono font-semibold text-white">{formatMoney(cartSubtotal)}</span>
              </div>
              {totalReturnAmount > 0 && (
                <div className="flex justify-between text-xs text-amber-300 font-medium">
                  <span>Less Returns / Damaged Credit:</span>
                  <span className="font-mono font-bold text-rose-400">-{formatMoney(totalReturnAmount)}</span>
                </div>
              )}
              <div className="border-t border-slate-700/80 pt-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Net Bill Amount
                  </span>
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    {formatMoney(finalTotal)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {cart.length} items • {returnItems.length} returns
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                + Add More Products
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                disabled={cart.length === 0 && returnItems.length === 0}
                className="py-2.5 bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs flex items-center justify-center gap-1 transition cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: SELECT BRAND */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {availableBrands.map(brand => {
                const count = products.filter(p => p.category.toLowerCase() === brand.toLowerCase()).length;
                return (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => {
                      setSelectedBrand(brand);
                      setItemSearch('');
                      setCurrentStep(4);
                    }}
                    className="p-3.5 bg-white border border-slate-200 hover:border-blue-500 rounded-xl text-left shadow-2xs flex flex-col justify-between h-24 active:scale-[0.98] transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 truncate">{brand}</h3>
                      <p className="text-[10px] text-slate-400 font-medium">{count} Items</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(cart.length > 0 || returnItems.length > 0 ? 2 : 1)}
                className="py-2 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
              >
                ← Back
              </button>

              {(cart.length > 0 || returnItems.length > 0) && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1"
                >
                  <span>Cart & Returns ({totalItemsCount + totalReturnUnits})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: SELECT ITEM FOR BRAND */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="space-y-3">
            {/* Top Bar with Brand Badge & Search */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="text-xs font-bold text-blue-600 flex items-center gap-1 shrink-0"
              >
                ← Brands
              </button>
              <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg truncate">
                {selectedBrand}
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder={`Search ${selectedBrand}...`}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            {/* Products List */}
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5">
              {brandProducts.map(product => {
                const stockInfo = lorryStockMap.get(product.id);
                const regularStock = stockInfo ? stockInfo.stock : product.currentStock;
                const freeStock = stockInfo ? stockInfo.freeStock : (product.freeStock || 0);
                const inCart = cart.find(i => i.productId === product.id);

                return (
                  <div
                    key={product.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{product.name}</h4>
                        {inCart && (inCart.discountPercent || 0) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded font-mono">
                            -{inCart.discountPercent}% Disc
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        <span className="font-bold text-blue-600">{formatMoney(inCart?.unitPrice ?? product.unitPrice)}</span>
                        {inCart && (inCart.discountPercent || 0) > 0 && (
                          <span className="ml-1 text-[10px] line-through text-slate-400">{formatMoney(product.unitPrice)}</span>
                        )}
                        <span className="ml-1 text-slate-500">• Stock: {regularStock}</span>
                        {freeStock > 0 && (
                          <span className="ml-1 text-emerald-700 font-bold bg-emerald-50 px-1 rounded">+{freeStock} Free</span>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {inCart ? (
                        <div className="flex items-center bg-blue-50 border border-blue-200 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(product.id, -1)}
                            className="w-7 h-7 bg-white rounded flex items-center justify-center font-bold text-blue-700 text-xs shadow-2xs hover:bg-blue-100 active:scale-95 transition"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={inCart.quantity === 0 ? '' : inCart.quantity}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              setCartItemQty(product.id, isNaN(val) ? 0 : Math.max(0, val));
                            }}
                            onBlur={() => {
                              if (!inCart.quantity || inCart.quantity <= 0) {
                                setCartItemQty(product.id, 1);
                              }
                            }}
                            onFocus={(e) => e.target.select()}
                            className="w-11 h-7 bg-transparent text-center font-mono font-bold text-xs text-blue-900 focus:outline-none focus:bg-white focus:rounded focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => addToCart(product, 1)}
                            className="w-7 h-7 bg-blue-600 text-white rounded flex items-center justify-center font-bold text-xs shadow-2xs hover:bg-blue-700 active:scale-95 transition"
                            title="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product, 1)}
                          className="py-1 px-3 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-xs hover:bg-blue-700 active:scale-95 transition"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sticky Bottom Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="py-2.5 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                ← Other Brands
              </button>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={cart.length === 0 && returnItems.length === 0}
                className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>View Cart & Returns ({totalItemsCount + totalReturnUnits})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: FINAL CHECKOUT */}
        {/* ======================================================== */}
        {currentStep === 5 && (
          <div className="space-y-3">
            {/* Top Navigation & Cancel Header */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Back to Cart</span>
              </button>

              <button
                type="button"
                onClick={handleCancelCheckout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>Cancel Bill</span>
              </button>
            </div>

            {/* Customer Pill */}
            <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Customer</p>
                <h3 className="text-xs font-bold text-slate-900">{selectedCustomer?.name}</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenAddReturnModal}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] rounded-lg border border-amber-200 transition cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3 text-amber-700" />
                  <span>+ Return</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition cursor-pointer"
                >
                  + Product
                </button>
              </div>
            </div>

            {/* Fresh Items Summary Table */}
            {cart.length > 0 ? (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase pb-1 border-b border-slate-100 flex justify-between">
                  <span>Fresh Delivery Items ({cart.length})</span>
                  <span>Price</span>
                </div>

                {cart.map(item => {
                  const hasDiscount = (item.discountPercent || 0) > 0;
                  const originalPrice = item.originalUnitPrice || item.unitPrice;
                  return (
                    <div key={item.productId} className="flex items-center justify-between text-xs py-0.5">
                      <div className="min-w-0 pr-2">
                        <span className="text-slate-800 font-medium truncate block">
                          {item.name} × {item.quantity}
                          {item.freeQuantity > 0 && (
                            <span className="text-[10px] text-emerald-600 font-bold ml-1">
                              (+{item.freeQuantity} free)
                            </span>
                          )}
                        </span>
                        {hasDiscount && (
                          <span className="text-[10px] font-mono font-bold text-emerald-600 block">
                            {formatMoney(item.unitPrice)} / {item.unit} <span className="line-through text-slate-400 font-normal">({formatMoney(originalPrice)})</span> • {item.discountPercent}% Off
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-slate-900 shrink-0">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium">
                No delivery items (Customer Return / Stale Bread Bill)
              </div>
            )}

            {/* Customer Returns Summary Table */}
            {returnItems.length > 0 && (
              <div className="p-3 bg-rose-50/40 border border-rose-200/90 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-rose-800 uppercase pb-1 border-b border-rose-200/60 flex justify-between">
                  <span>Customer Returns & Damages ({returnItems.length})</span>
                  <span>Deduction</span>
                </div>

                {returnItems.map(ret => (
                  <div key={ret.id} className="flex items-center justify-between text-xs py-0.5">
                    <div className="min-w-0 pr-2">
                      <span className="text-slate-800 font-medium truncate block">
                        [{ret.returnType === 'DAMAGE' ? 'DMG' : 'RESALE'}] {ret.name} × {ret.quantity}
                      </span>
                      {ret.reason && (
                        <span className="text-[10px] text-slate-400 italic block">{ret.reason}</span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-rose-600 shrink-0">
                      -{formatMoney(ret.unitPrice * ret.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['CASH', 'CREDIT', 'CHEQUE'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg text-xs font-bold transition ${
                      paymentMethod === m
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Cheque Details Card */}
            {paymentMethod === 'CHEQUE' && (
              <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 animate-fadeIn shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                    Customer Cheque Details
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded-md border border-blue-200">
                    Wired to Admin
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      Cheque Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={chequeNumber}
                      onChange={(e) => setChequeNumber(e.target.value)}
                      placeholder="e.g. 049182"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                      Cheque Maturity Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Enter or select bank..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 mb-1.5"
                  />
                  {/* Quick Bank Chips */}
                  <div className="flex flex-wrap gap-1">
                    {['Commercial Bank', 'BOC', 'Sampath Bank', 'HNB', "People's Bank", 'Seylan Bank', 'NDB'].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBankName(b)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                          bankName === b
                            ? 'bg-blue-600 text-white font-bold'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Calculation Breakdown */}
            {(totalReturnAmount > 0 || totalItemDiscounts > 0 || (globalDiscountPercent || 0) > 0) && (
              <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs">
                {totalItemDiscounts > 0 && (
                  <>
                    <div className="flex justify-between text-slate-500">
                      <span>Gross Items Value:</span>
                      <span className="font-mono">{formatMoney(cartGrossSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>Item Discounts Savings:</span>
                      </span>
                      <span className="font-mono">-{formatMoney(totalItemDiscounts)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-700 font-semibold">
                  <span>Net Delivery Subtotal:</span>
                  <span className="font-mono font-bold text-slate-900">{formatMoney(cartSubtotal)}</span>
                </div>
                {(globalDiscountPercent || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Customer Discount ({globalDiscountPercent}%):</span>
                    <span className="font-mono">- {formatMoney((cartSubtotal * (globalDiscountPercent || 0)) / 100)}</span>
                  </div>
                )}
                {totalReturnAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-slate-100">
                    <span>Customer Returns / Damage Credit:</span>
                    <span className="font-mono">-{formatMoney(totalReturnAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Final Total Card */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Final Amount</span>
                <span className="font-mono text-xl font-bold text-white">{formatMoney(finalTotal)}</span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-800 rounded text-blue-400">
                {paymentMethod}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinalCheckout}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing Bill...</span>
                </span>
              ) : (
                <>
                  <span>Confirm & Issue Bill</span>
                  <Check className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Bottom Actions: Back to Cart & Cancel Bill */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setCurrentStep(2)}
                className="py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>Back to Cart</span>
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleCancelCheckout}
                className="py-2.5 px-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
                <span>Cancel Bill</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SUCCESS MODAL POPUP */}
      {checkoutSuccessOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 text-center border border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-0.5">Bill Issued Successfully!</h3>
            <p className="text-xs text-slate-500 font-mono mb-2">
              #{checkoutSuccessOrder.paperBillNumber || checkoutSuccessOrder.orderNumber} • {formatMoney(checkoutSuccessOrder.netTotal)}
            </p>
            {checkoutSuccessOrder.paymentMethod === 'CHEQUE' && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-xl text-left text-[11px] text-blue-900 font-mono flex items-center justify-between">
                <span>Cheque: #{checkoutSuccessOrder.chequeNumber || 'N/A'}</span>
                <span className="font-sans font-bold text-blue-700">{checkoutSuccessOrder.bankName || 'Cheque Payment'}</span>
              </div>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onViewInvoice?.(checkoutSuccessOrder)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print 80mm Receipt Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  loadFinishedBills();
                  setShowFinishedBillsModal(true);
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>View All Finished Bills ({finishedBills.length})</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewBill}
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Next Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REP TARGETS & GOALS MODAL POPUP */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center shadow-2xs">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Sales Targets & Performance
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {targetProgress?.repName || user?.fullName || 'Sales Rep'} • {selectedLorry?.vehicleNumber || 'Route Van'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowTargetModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingTargets && !targetProgress ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Calculating performance...
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* 1. TODAY'S DAILY TARGET CARD */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/70 to-orange-50/50 border border-amber-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-xs text-amber-950 uppercase tracking-wider">
                        Today's Target
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-900 bg-white px-2 py-0.5 rounded-lg border border-amber-200 shadow-2xs">
                      Goal: {formatMoney(targetProgress?.dailyTarget || 0)}
                    </span>
                  </div>

                  {/* Daily Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-amber-200/70 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (targetProgress?.dailyPercentage || 0) >= 100
                            ? 'bg-emerald-500'
                            : 'bg-gradient-to-r from-amber-500 to-orange-500'
                        }`}
                        style={{ width: `${Math.min(100, targetProgress?.dailyPercentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>
                        Achieved Today: <strong className="text-slate-900">{formatMoney(targetProgress?.achievedToday || 0)}</strong>
                      </span>
                      <span className={(targetProgress?.dailyPercentage || 0) >= 100 ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                        {targetProgress?.dailyPercentage || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Daily Sub-stats */}
                  <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Today's Bills: <strong className="text-slate-800">{targetProgress?.todayBillsCount || 0}</strong></span>
                    {(targetProgress?.dailyRemaining || 0) > 0 ? (
                      <span className="text-amber-700 font-medium">To Goal: <strong>{formatMoney(targetProgress?.dailyRemaining || 0)}</strong></span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> Target Reached!
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. MONTHLY TARGET CARD */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/50 border border-indigo-200/80 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-xs text-indigo-950 uppercase tracking-wider">
                        Monthly Target
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-900 bg-white px-2 py-0.5 rounded-lg border border-indigo-200 shadow-2xs">
                      Goal: {formatMoney(targetProgress?.monthlyTarget || 0)}
                    </span>
                  </div>

                  {/* Monthly Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-indigo-200/70 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (targetProgress?.monthlyPercentage || 0) >= 100
                            ? 'bg-emerald-500'
                            : (targetProgress?.monthlyPercentage || 0) >= 50
                            ? 'bg-indigo-600'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, targetProgress?.monthlyPercentage || 0)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>
                        Billed This Month: <strong className="text-slate-900">{formatMoney(targetProgress?.achievedMonth || 0)}</strong>
                      </span>
                      <span className={(targetProgress?.monthlyPercentage || 0) >= 100 ? 'text-emerald-700 font-bold' : 'text-indigo-800 font-bold'}>
                        {targetProgress?.monthlyPercentage || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Monthly Sub-stats */}
                  <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Month Invoices: <strong className="text-slate-800">{targetProgress?.monthBillsCount || 0}</strong></span>
                    {(targetProgress?.monthlyRemaining || 0) > 0 ? (
                      <span className="text-indigo-700 font-medium">To Goal: <strong>{formatMoney(targetProgress?.monthlyRemaining || 0)}</strong></span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-emerald-600" /> Target Smashed!
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. NEW CLIENTS TARGET (IF CONFIGURED) */}
                {Boolean(targetProgress?.targetNewClients && targetProgress.targetNewClients > 0) && (
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-700">New Retail Outlets Target</span>
                    </div>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-mono text-[11px]">
                      {targetProgress?.targetNewClients} shops / month
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowTargetModal(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
            >
              Close & Return to Billing
            </button>
          </div>
        </div>
      )}

      {/* RECORD CUSTOMER RETURN / DAMAGE MODAL */}
      {showAddReturnModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 space-y-4 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Return / Damage</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Deduct credit from customer bill</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddReturnModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-3.5">
              {/* Product Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Select Bakery Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={returnSelectedProductId}
                  onChange={(e) => handleSelectReturnProduct(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="" disabled>-- Select Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — {formatMoney(p.unitPrice)} / {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition / Return Type */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Item Condition / Return Classification
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReturnType('DAMAGE');
                      if (returnReason === 'Good Condition Return') setReturnReason('Stale / Expired');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      returnType === 'DAMAGE'
                        ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-rose-700 flex items-center gap-1.5">
                      <span>💥 Damaged / Expired</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Unsellable / Stale bread. Sent to damage stock.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReturnType('RESALE');
                      if (returnReason === 'Stale / Expired') setReturnReason('Good Condition Return');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      returnType === 'RESALE'
                        ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-emerald-700 flex items-center gap-1.5">
                      <span>✨ Good Condition</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Fresh / Sealed. Restocks back into sellable inventory.
                    </p>
                  </button>
                </div>
              </div>

              {/* Quantity Stepper & Direct Input */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Return Qty <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setReturnQty(Math.max(1, returnQty - 1))}
                      className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-slate-700 text-sm shadow-2xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={returnQty === 0 ? '' : returnQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setReturnQty(isNaN(val) ? 1 : Math.max(1, val));
                      }}
                      className="w-full bg-transparent text-center font-mono font-bold text-sm text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setReturnQty(returnQty + 1)}
                      className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-bold text-slate-700 text-sm shadow-2xs hover:bg-slate-50 active:scale-95 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Credit Unit Price (Rs.)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={returnUnitPrice}
                    onChange={(e) => setReturnUnitPrice(e.target.value)}
                    placeholder="Rate..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Reason Chips */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Reason for Return
                </label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {[
                    'Stale / Expired',
                    'Crushed / Damaged',
                    'Mold / Spoilage',
                    'Overstock Return',
                    'Wrong Item Delivered'
                  ].map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReturnReason(reason)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        returnReason === reason
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Or enter custom reason..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Total Deduction Preview Box */}
              <div className="p-3 bg-rose-50 border border-rose-200/90 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block">
                    Calculated Return Credit
                  </span>
                  <span className="text-xs text-slate-600">
                    {returnQty} × Rs. {parseFloat(returnUnitPrice) || 0}
                  </span>
                </div>
                <span className="font-mono text-base font-bold text-rose-700">
                  -{formatMoney((parseFloat(returnUnitPrice) || 0) * (returnQty || 0))}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddReturnModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAddReturn}
                className="py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer active:scale-98"
              >
                Add to Returns List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROUTE RUNNING EXPENSES MODAL (WIRED TO ADMIN) */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100 my-auto">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
                  <Fuel className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Route Running Expenses</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {selectedLorry?.vehicleNumber || 'Route Lorry'} • Live Wired to Admin Ledger
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Live Summary Card */}
              <div className="p-3.5 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Today's Route Expenses
                  </span>
                  <span className="font-mono text-xl font-bold text-amber-400">
                    {formatMoney(totalRepExpensesToday)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {repExpenses.length} voucher{repExpenses.length === 1 ? '' : 's'} recorded today
                  </span>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Wired to Admin</span>
                  </span>
                </div>
              </div>

              {/* Success Feedback Alert */}
              {expenseSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between animate-fadeIn">
                  <span>{expenseSuccessMsg}</span>
                  <button onClick={() => setExpenseSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 text-xs font-bold">
                    ✕
                  </button>
                </div>
              )}

              {/* Form to Record New Expense */}
              <form onSubmit={handleSaveRouteExpense} className="space-y-3.5 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />
                    Record New Route Expense
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Deducted from Cash</span>
                </div>

                {/* 1. Category Quick Selector */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Expense Category
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'FUEL', label: '⛽ Fuel / Diesel', defaultTitle: 'Diesel / Fuel Top-up' },
                      { id: 'VEHICLE_MAINTENANCE', label: '🔧 Vehicle / Puncture', defaultTitle: 'Puncture / Vehicle Repair' },
                      { id: 'DRIVER_ALLOWANCE', label: '🍛 Food / Allowance', defaultTitle: 'Driver & Helper Food Allowance' },
                      { id: 'OTHER', label: '🛣️ Toll / Other', defaultTitle: 'Highway Toll / Parking' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setExpenseCategory(cat.id);
                          setExpenseTitle(cat.defaultTitle);
                        }}
                        className={`py-2 px-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                          expenseCategory === cat.id
                            ? 'bg-amber-50 border-amber-300 text-amber-900 ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Amount Input & Quick Chips */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Amount (Rs.) <span className="text-red-500">*</span>
                    </label>
                    {/* Quick Amount Chips */}
                    <div className="flex items-center gap-1">
                      {[500, 1000, 2000, 5000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            const cur = parseFloat(expenseAmount) || 0;
                            setExpenseAmount((cur + amt).toString());
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-[10px] font-mono font-bold text-slate-700 transition"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2 font-mono font-bold text-slate-400 text-xs">
                      Rs.
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      placeholder="e.g. 2500"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 3. Title / Description */}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Description / Purpose <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {[
                      'Diesel / Fuel Top-up',
                      'Lorry Puncture Repair',
                      'Engine Oil / Coolant',
                      'Highway Toll / Expressway',
                      'Driver & Helper Lunch',
                      'Police Inspection / Fine'
                    ].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setExpenseTitle(preset)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                          expenseTitle === preset
                            ? 'bg-amber-600 text-white font-bold'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={expenseTitle}
                    onChange={(e) => setExpenseTitle(e.target.value)}
                    placeholder="e.g. Diesel for journey"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 4. Optional Vendor & Receipt Ref */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Paid To / Station
                    </label>
                    <input
                      type="text"
                      value={expensePaidTo}
                      onChange={(e) => setExpensePaidTo(e.target.value)}
                      placeholder="e.g. Ceypetco Station"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Slip / Bill #
                    </label>
                    <input
                      type="text"
                      value={expenseRef}
                      onChange={(e) => setExpenseRef(e.target.value)}
                      placeholder="e.g. REC-9412"
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Submit Expense Button */}
                <button
                  type="submit"
                  disabled={expenseSubmitting || !expenseAmount || !expenseTitle}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition active:scale-[0.99] cursor-pointer"
                >
                  {expenseSubmitting ? (
                    <span>Recording & Wiring to Admin...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Record Route Expense</span>
                    </>
                  )}
                </button>
              </form>

              {/* Today's Expense List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pt-1">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Today's Recorded Vouchers ({repExpenses.length})
                  </h4>
                  {loadingExpenses && (
                    <span className="text-[10px] text-slate-400 font-mono">Syncing...</span>
                  )}
                </div>

                {repExpenses.length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No route expenses recorded today for {selectedLorry?.vehicleNumber || 'this vehicle'}.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {repExpenses.map(exp => (
                      <div
                        key={exp.id}
                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9px] uppercase tracking-wider">
                              {exp.category}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              #{exp.expenseNumber}
                            </span>
                            {exp.referenceNumber && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                • Ref: {exp.referenceNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {exp.title}
                          </p>
                          {exp.paidTo && (
                            <p className="text-[10px] text-slate-500">
                              Paid to: {exp.paidTo}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-xs text-rose-600">
                            -{formatMoney(exp.amount)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRouteExpense(exp.id, exp.expenseNumber)}
                            className="p-1 text-slate-300 hover:text-red-500 transition cursor-pointer"
                            title="Delete this expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">
                Live synced with Admin Settlement
              </span>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="py-1.5 px-4 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL FOR REP */}
      <CustomerModal
        customer={null}
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        defaultRouteId={selectedLorry?.routeId || user?.lorry?.routeId || undefined}
        onSaved={async (newCust) => {
          try {
            const updatedList = await CustomerService.getAll();
            setCustomers(updatedList);
            if (newCust?.id) {
              setSelectedCustomerId(newCust.id);
              setCustomerSearch('');
            }
            loadTargets();
          } catch (e) {
            console.error('Failed to reload customers', e);
          }
        }}
      />

      {/* FINISHED BILLS HISTORY MODAL (MINIMAL, NEAT, CLEAN) */}
      {showFinishedBillsModal && (
        <div className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in ${showSummaryBillModal ? 'print:hidden' : ''}`}>
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Finished Sales Bills
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedLorry?.vehicleNumber || 'Route Lorry'} • {filteredFinishedBills.length} Bills ({billsDateRangeLabel})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSummaryBillModal(true)}
                  disabled={filteredFinishedBills.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition shadow-2xs active:scale-95 cursor-pointer"
                  title="Print Summary Bill (80mm Thermal Receipt)"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Summary</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadFinishedBills()}
                  disabled={loadingFinishedBills}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                  title="Refresh bills"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFinishedBills ? 'animate-spin text-blue-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFinishedBillsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Top KPI Metrics Strip (Minimal, clean, neat) */}
            <div className="p-3 sm:px-5 bg-slate-50/80 border-b border-slate-100 shrink-0 space-y-2">
              <div className={`grid ${finishedBillsSummary.totalCheque > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 text-center`}>
                <div className="p-2 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Sales</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900">{formatMoney(finishedBillsSummary.totalValue)}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Cash Collected</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-emerald-800">{formatMoney(finishedBillsSummary.totalCash)}</span>
                </div>
                {finishedBillsSummary.totalCheque > 0 && (
                  <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-200/80 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">Cheques ({finishedBillsSummary.chequeCount})</span>
                    <span className="font-mono font-bold text-xs sm:text-sm text-blue-800">{formatMoney(finishedBillsSummary.totalCheque)}</span>
                  </div>
                )}
                <div className="p-2 rounded-xl bg-rose-50/70 border border-rose-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">Credit Given</span>
                  <span className="font-mono font-bold text-xs sm:text-sm text-rose-800">{formatMoney(finishedBillsSummary.totalCredit)}</span>
                </div>
              </div>

              {/* Route Running Expenses Deductions Banner */}
              {totalRepExpensesToday > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-200/60 text-amber-800 flex items-center justify-center font-bold shrink-0">
                      <Fuel className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-amber-950">Route Expenses Deducted:</span>
                      <span className="text-[10px] text-amber-700 ml-1">({repExpenses.length} vouchers wired to Admin)</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-rose-700 text-xs sm:text-sm">
                      -{formatMoney(totalRepExpensesToday)}
                    </span>
                    <span className="block text-[10px] text-slate-600 font-mono font-bold">
                      Net Cash Handover: {formatMoney(Math.max(0, finishedBillsSummary.totalCash - totalRepExpensesToday))}
                    </span>
                  </div>
                </div>
              )}

              {filteredFinishedBills.length > 0 && (
                <div className="flex items-center justify-between px-2 pt-0.5 text-xs text-slate-500">
                  <span className="text-[11px] font-medium">
                    Showing {filteredFinishedBills.length} of {dateFilteredBills.length} bills ({billsDateRangeLabel})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSummaryBillModal(true)}
                    className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    <span>View 80mm Summary Slip</span>
                  </button>
                </div>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 sm:px-5 border-b border-slate-100 space-y-2.5 bg-white shrink-0">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={billsSearch}
                  onChange={(e) => setBillsSearch(e.target.value)}
                  placeholder="Search by customer, shop, slip #, or amount..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {billsSearch && (
                  <button
                    onClick={() => setBillsSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Date Range Filter Row */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 pr-0.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Date:</span>
                  </div>

                  {(
                    [
                      { id: 'today', label: 'Today' },
                      { id: 'yesterday', label: 'Yesterday' },
                      { id: 'thisWeek', label: 'This Week' },
                      { id: 'thisMonth', label: 'This Month' },
                      { id: 'all', label: 'All Time' },
                      { id: 'custom', label: 'Custom' }
                    ] as const
                  ).map(dp => {
                    const isActive = billsDatePreset === dp.id;
                    return (
                      <button
                        key={dp.id}
                        type="button"
                        onClick={() => handleDatePresetChange(dp.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {dp.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Pickers */}
                {billsDatePreset === 'custom' && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/80 animate-in fade-in text-xs">
                    <input
                      type="date"
                      value={customBillsStart}
                      onChange={(e) => setCustomBillsStart(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-slate-400 text-xs font-medium">to</span>
                    <input
                      type="date"
                      value={customBillsEnd}
                      onChange={(e) => setCustomBillsEnd(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCustomDates}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ml-auto sm:ml-0"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <span className="text-[11px] font-bold text-slate-500 pr-0.5 shrink-0">
                  Payment:
                </span>
                {(['ALL', 'CASH', 'CREDIT', 'CHEQUE'] as const).map(tab => {
                  const count = tab === 'ALL'
                    ? dateFilteredBills.length
                    : dateFilteredBills.filter(b => b.paymentMethod === tab).length;

                  const activeStyles =
                    tab === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : tab === 'CREDIT'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : tab === 'CHEQUE'
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-slate-900 text-white shadow-2xs';

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setBillsFilter(tab)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer ${
                        billsFilter === tab
                          ? activeStyles
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>{tab === 'ALL' ? 'All' : tab}</span>
                      <span className={`text-[10px] font-mono px-1 rounded-full ${
                        billsFilter === tab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Finished Bills Scrollable List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5 bg-slate-50/50">
              {loadingFinishedBills && finishedBills.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading finished bills...</span>
                </div>
              ) : filteredFinishedBills.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No finished bills found</p>
                  <p className="text-[11px] text-slate-400">
                    {billsSearch || billsFilter !== 'ALL'
                      ? 'No bills match your active search or filter.'
                      : 'Completed sales bills will appear here with full line details and reprint options.'}
                  </p>
                </div>
              ) : (
                filteredFinishedBills.map(bill => {
                  const isExpanded = expandedBillId === bill.id;
                  const totalItemsQty = bill.items.reduce((acc, i) => acc + i.quantity, 0);
                  const totalFreeQty = bill.items.reduce((acc, i) => acc + (i.freeQuantity || 0), 0);
                  const creditDue = Math.max(0, bill.netTotal - (bill.cashReceived || 0));

                  // Color Themes:
                  // Cash bills: Light Green
                  // Cheque bills & Partial Credit bills: Light Orange
                  // Pure Credit bills: Light Red
                  const isCash = bill.paymentMethod === 'CASH';
                  const isCheque = bill.paymentMethod === 'CHEQUE';
                  const isPartialCredit = bill.paymentMethod === 'CREDIT' && bill.paymentStatus === 'PARTIAL';

                  const theme = isCash
                    ? {
                        container: 'bg-emerald-50/70 border-emerald-200/90 hover:border-emerald-300',
                        badge: 'bg-emerald-100 text-emerald-800 border-emerald-300/80',
                        tag: 'bg-white text-emerald-950 border-emerald-200',
                        itemsBox: 'bg-emerald-100/40 border border-emerald-200/60 text-emerald-900',
                        button: 'bg-emerald-100/70 hover:bg-emerald-200/80 text-emerald-800 border-emerald-300/60',
                        divider: 'border-emerald-200/60',
                        expandedBox: 'bg-white border-emerald-200',
                        label: 'CASH'
                      }
                    : isCheque || isPartialCredit
                    ? {
                        container: 'bg-orange-50/70 border-orange-200/90 hover:border-orange-300',
                        badge: 'bg-orange-100 text-orange-900 border-orange-300/80',
                        tag: 'bg-white text-orange-950 border-orange-200',
                        itemsBox: 'bg-orange-100/40 border border-orange-200/60 text-orange-900',
                        button: 'bg-orange-100/70 hover:bg-orange-200/80 text-orange-900 border-orange-300/60',
                        divider: 'border-orange-200/60',
                        expandedBox: 'bg-white border-orange-200',
                        label: isCheque ? 'CHEQUE' : 'PARTIAL CREDIT'
                      }
                    : {
                        container: 'bg-rose-50/70 border-rose-200/90 hover:border-rose-300',
                        badge: 'bg-rose-100 text-rose-900 border-rose-300/80',
                        tag: 'bg-white text-rose-950 border-rose-200',
                        itemsBox: 'bg-rose-100/40 border border-rose-200/60 text-rose-900',
                        button: 'bg-rose-100/70 hover:bg-rose-200/80 text-rose-900 border-rose-300/60',
                        divider: 'border-rose-200/60',
                        expandedBox: 'bg-white border-rose-200',
                        label: 'CREDIT'
                      };

                  return (
                    <div
                      key={bill.id}
                      className={`rounded-2xl border p-3.5 shadow-2xs transition space-y-2.5 ${theme.container}`}
                    >
                      {/* Top Row: Slip #, Time & Net Total */}
                      <div className={`flex items-start justify-between gap-2 border-b pb-2 ${theme.divider}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-lg border shadow-3xs ${theme.tag}`}>
                              #{bill.paperBillNumber || bill.orderNumber}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${theme.badge}`}>
                              {theme.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">
                            {new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(bill.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-mono font-bold text-sm sm:text-base text-slate-900 block">
                            {formatMoney(bill.netTotal)}
                          </span>
                          {creditDue > 0 ? (
                            <span className="text-[10px] font-bold text-rose-600 font-mono">
                              Due: {formatMoney(creditDue)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-600">
                              Paid in full
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Customer Row */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 truncate">
                            {bill.customer.name}
                            {bill.customer.code ? (
                              <span className="text-[10px] text-slate-400 font-mono font-normal ml-1">
                                [{bill.customer.code}]
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {bill.customer.companyName || bill.customer.deliveryAddress || bill.customer.city || 'Standard Outlet'}
                          </p>
                        </div>
                      </div>

                      {/* Items Summary & Expand Trigger */}
                      <div className={`rounded-xl p-2 flex items-center justify-between text-[11px] ${theme.itemsBox}`}>
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-slate-800">{bill.items.length} Products</span>
                          <span>•</span>
                          <span>{totalItemsQty} units</span>
                          {totalFreeQty > 0 && (
                            <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.2 rounded text-[10px]">
                              +{totalFreeQty} Free
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                          className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-0.5 shrink-0 ml-2 cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide' : 'Items'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Expanded Items Breakdown */}
                      {isExpanded && (
                        <div className={`border rounded-xl p-2.5 space-y-1.5 text-xs animate-in fade-in ${theme.expandedBox}`}>
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                            <span>Item Name</span>
                            <span>Line Total</span>
                          </div>
                          {bill.items.map(item => (
                            <div key={item.id} className="flex justify-between text-[11px] leading-tight">
                              <div className="min-w-0 pr-2">
                                <span className="font-medium text-slate-800 block truncate">{item.product.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {item.quantity} {item.product.unit || 'pcs'} x {formatMoney(item.unitPrice)}
                                  {item.freeQuantity > 0 && (
                                    <span className="text-emerald-600 font-bold ml-1">+{item.freeQuantity} Free</span>
                                  )}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-slate-800 shrink-0">
                                {formatMoney(item.lineTotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action Buttons: 1-Tap 80mm Print */}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onViewInvoice?.(bill);
                          }}
                          className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-3xs ${theme.button}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>View & Print 80mm Receipt</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-100 bg-white shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFinishedBillsModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Close & Return
              </button>

              <button
                type="button"
                onClick={() => setShowSummaryBillModal(true)}
                disabled={filteredFinishedBills.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Summary Bill</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT BOTTOM NAVIGATION DOCK (TARGETS, BILLS, COLLECTIONS, EXPENSES) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 sm:px-3 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] print:hidden">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-1.5 sm:gap-2">
          {/* 1. Daily Sales Target */}
          <button
            type="button"
            onClick={() => {
              loadTargets();
              setShowTargetModal(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-900 border border-indigo-200/60 transition shadow-2xs active:scale-95 cursor-pointer"
            title="Daily & Monthly Sales Target Progress"
          >
            <div className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
                (targetProgress?.dailyPercentage || 0) >= 100
                  ? 'bg-emerald-600 text-white'
                  : (targetProgress?.dailyPercentage || 0) > 0
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {targetProgress?.dailyPercentage ?? 0}%
              </span>
            </div>
            <span className="text-[10px] font-bold text-indigo-800 tracking-tight mt-0.5">
              Target
            </span>
          </button>

          {/* 2. Finished Bills History */}
          <button
            type="button"
            onClick={() => {
              loadFinishedBills();
              setShowFinishedBillsModal(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl bg-blue-50/70 hover:bg-blue-100/70 text-blue-900 border border-blue-200/60 transition shadow-2xs active:scale-95 cursor-pointer"
            title="Finished Bills History & Daily Summary"
          >
            <div className="flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              {finishedBills.length > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                  {finishedBills.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-blue-800 tracking-tight mt-0.5">
              Bills
            </span>
          </button>

          {/* 3. Debt Collections (No Bill) */}
          <button
            type="button"
            onClick={() => {
              loadRepCollections();
              setShowCollectionsModal(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-950 border border-emerald-200/60 transition shadow-2xs active:scale-95 cursor-pointer"
            title="Customer Debt & Outstanding Collections History"
          >
            <div className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {totalRepCollectionsToday > 0 ? (
                <span className="bg-emerald-600 text-white text-[9px] font-mono font-bold px-1 py-0.2 rounded-full truncate max-w-[65px]">
                  {formatMoney(totalRepCollectionsToday)}
                </span>
              ) : (
                <span className="text-emerald-700 text-[10px] font-bold font-mono">
                  {repCollections.length > 0 ? repCollections.length : '+ Due'}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold text-emerald-900 tracking-tight mt-0.5">
              Collections
            </span>
          </button>

          {/* 4. Route Running Expenses */}
          <button
            type="button"
            onClick={() => {
              loadRepExpenses();
              setShowExpenseModal(true);
            }}
            className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl bg-amber-50/70 hover:bg-amber-100/70 text-amber-950 border border-amber-200/60 transition shadow-2xs active:scale-95 cursor-pointer"
            title="Record Route Fuel & Running Expenses (Wired to Admin)"
          >
            <div className="flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              {totalRepExpensesToday > 0 ? (
                <span className="bg-amber-600 text-white text-[9px] font-mono font-bold px-1 py-0.2 rounded-full truncate max-w-[65px]">
                  {formatMoney(totalRepExpensesToday)}
                </span>
              ) : (
                <span className="text-amber-700 text-[10px] font-bold font-mono">+ Log</span>
              )}
            </div>
            <span className="text-[10px] font-bold text-amber-900 tracking-tight mt-0.5">
              Expenses
            </span>
          </button>
        </div>
      </nav>

      {/* TODAY'S COLLECTIONS HISTORY MODAL */}
      {showCollectionsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-100">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Today's Debt Collections
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {selectedLorry?.vehicleNumber || 'Route Lorry'} • {repCollections.length} Payment Receipts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => loadRepCollections()}
                  disabled={loadingCollections}
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                  title="Refresh collections"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingCollections ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCollectionsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* KPI Cards Strip */}
            <div className="p-3 sm:px-5 bg-slate-50/80 border-b border-slate-100 shrink-0">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-tight">
                    Total Collected
                  </span>
                  <span className="font-mono text-sm sm:text-base font-black text-emerald-600">
                    {formatMoney(totalRepCollectionsToday)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-tight">
                    Cash In Hand
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-black text-slate-800">
                    {formatMoney(cashCollectionsToday)}
                  </span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-tight">
                    Cheques
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-black text-blue-700">
                    {formatMoney(chequeCollectionsToday)}
                  </span>
                </div>
              </div>
            </div>

            {/* Search filter */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={collectionsSearch}
                  onChange={(e) => setCollectionsSearch(e.target.value)}
                  placeholder="Search receipt #, customer name..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Scrollable Receipts List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-50/50">
              {loadingCollections && repCollections.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Loading collections...</span>
                </div>
              ) : filteredRepCollections.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No collections found</p>
                  <p className="text-[11px] text-slate-400">
                    Collect money directly from any customer card on Step 1 without creating a bill.
                  </p>
                </div>
              ) : (
                filteredRepCollections.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center justify-between gap-3 hover:border-emerald-200 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {p.customer?.name || 'Customer'}
                        </span>
                        <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.2 rounded-md">
                          {p.receiptNumber}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-700">
                          {p.paymentMethod}
                          {p.chequeNumber ? ` • ${p.chequeNumber}` : ''}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {p.notes && <span className="italic truncate max-w-[120px]">({p.notes})</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-black text-xs sm:text-sm text-emerald-600">
                        +{formatMoney(p.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecordedPayment(p);
                          setShowReceiptModal(true);
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-slate-600 transition cursor-pointer"
                        title="Re-print 80mm Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-medium">
                {repCollections.length} collections recorded today
              </span>
              <button
                type="button"
                onClick={() => setShowCollectionsModal(false)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLLECT OUTSTANDING PAYMENT MODAL */}
      <CustomerPaymentModal
        isOpen={showCollectModal}
        customer={collectingCustomer}
        onClose={() => {
          setShowCollectModal(false);
          setCollectingCustomer(null);
        }}
        onPaymentRecorded={handlePaymentRecorded}
        defaultLorryId={selectedLorryId || user?.lorryId || undefined}
        defaultCollectorName={
          user?.fullName
            ? `${user.fullName}${selectedLorry ? ` (${selectedLorry.vehicleNumber})` : ''}`
            : selectedLorry
            ? `${selectedLorry.driverName} (${selectedLorry.vehicleNumber})`
            : undefined
        }
      />

      {/* OFFICIAL 80MM PAYMENT RECEIPT MODAL */}
      <CustomerReceiptModal
        isOpen={showReceiptModal}
        payment={recordedPayment}
        customer={recordedPayment?.customer || customers.find(c => c.id === recordedPayment?.customerId) || collectingCustomer || null}
        onClose={() => {
          setShowReceiptModal(false);
          setRecordedPayment(null);
        }}
      />

      {/* REP'S BILLS SUMMARY PRINT MODAL (80mm Thermal & Bluetooth) */}
      <RepBillsSummaryModal
        isOpen={showSummaryBillModal}
        onClose={() => setShowSummaryBillModal(false)}
        allBills={finishedBills}
        filteredBills={filteredFinishedBills}
        activeFilter={billsFilter}
        dateRangeLabel={billsDateRangeLabel}
        lorry={selectedLorry}
        user={user}
        routeExpenses={repExpenses}
      />
    </div>
  );
};
