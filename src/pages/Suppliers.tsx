import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  Eye,
  Package,
  Phone,
  Mail,
  MapPin,
  X,
  Wallet,
  MoreHorizontal
} from 'lucide-react';
import { SupplierService, PurchaseOrderService, ProductService } from '../services/api';
import { Supplier, PurchaseOrder, Product } from '../types';
import { useCurrency } from '../context/CurrencyContext';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface InboundItemRow {
  productId: string;
  quantity: number;
  freeQuantity?: number;
  costPrice: number;
}

interface SuppliersProps {
  isActive?: boolean;
}

export const Suppliers: React.FC<SuppliersProps> = ({ isActive }) => {
  const { formatMoney } = useCurrency();

  // Active view: 'SUPPLIERS' or 'INBOUND_GRN'
  const [activeTab, setActiveTab] = useState<'SUPPLIERS' | 'INBOUND_GRN'>('SUPPLIERS');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<string>>(new Set());

  const toggleExpandSupplier = (id: string) => {
    setExpandedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Modals state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [isGRNModalOpen, setIsGRNModalOpen] = useState<boolean>(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'CHEQUE'>('BANK_TRANSFER');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const [viewingGRN, setViewingGRN] = useState<PurchaseOrder | null>(null);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Supplier Form State
  const [supplierCode, setSupplierCode] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [city, setCity] = useState<string>('Colombo');
  const [paymentTerms, setPaymentTerms] = useState<string>('NET 30');

  // Inbound GRN Form State
  const [grnSupplierId, setGrnSupplierId] = useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [grnDate, setGrnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [grnPaymentStatus, setGrnPaymentStatus] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID');
  const [grnPaymentMethod, setGrnPaymentMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'CHEQUE'>('BANK_TRANSFER');
  const [grnPaidAmount, setGrnPaidAmount] = useState<string>('');
  const [grnNotes, setGrnNotes] = useState<string>('');
  const [grnItems, setGrnItems] = useState<InboundItemRow[]>([
    { productId: '', quantity: 50, costPrice: 0 }
  ]);

  useLiveRefresh(() => {
    loadData();
  }, { isActive });

  useEffect(() => {
    loadData();
  }, [search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [supList, poList, prodList] = await Promise.all([
        SupplierService.getAll(search || undefined),
        PurchaseOrderService.getAll(),
        ProductService.getAll()
      ]);
      setSuppliers(supList);
      setPurchaseOrders(poList);
      setProducts(prodList);
    } catch (err: any) {
      console.error('Failed to load supplier management data', err);
      setErrorMessage('Failed to connect to supplier database.');
    } finally {
      setLoading(false);
    }
  };

  // Open Add/Edit Supplier Modal
  const handleOpenSupplierModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierCode(supplier.code);
      setSupplierName(supplier.name);
      setContactPerson(supplier.contactPerson || '');
      setPhone(supplier.phone);
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setCity(supplier.city || 'Colombo');
      setPaymentTerms(supplier.paymentTerms || 'NET 30');
    } else {
      setEditingSupplier(null);
      setSupplierCode(`SUP-${String(suppliers.length + 1).padStart(3, '0')}`);
      setSupplierName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCity('Colombo');
      setPaymentTerms('NET 30');
    }
    setIsSupplierModalOpen(true);
  };

  // Submit Supplier Add / Edit
  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      setSubmitting(true);
      if (editingSupplier) {
        await SupplierService.update(editingSupplier.id, {
          name: supplierName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim(),
          paymentTerms: paymentTerms.trim()
        });
        setSuccessMessage(`Supplier "${supplierName}" updated successfully.`);
      } else {
        await SupplierService.create({
          code: supplierCode.trim() || undefined,
          name: supplierName.trim(),
          contactPerson: contactPerson.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim(),
          paymentTerms: paymentTerms.trim()
        });
        setSuccessMessage(`Supplier "${supplierName}" registered successfully.`);
      }

      setIsSupplierModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to save supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete supplier "${name}"? Only suppliers with no purchase orders can be deleted.`)) {
      try {
        await SupplierService.delete(id);
        setSuccessMessage(`Supplier "${name}" deleted.`);
        await loadData();
      } catch (err: any) {
        setErrorMessage(err.response?.data?.error || 'Failed to delete supplier.');
      }
    }
  };

  // Open GRN Inbound Stock Modal
  const handleOpenGRNModal = (preselectedSupplierId?: string) => {
    const targetSupId = preselectedSupplierId || (suppliers.length > 0 ? suppliers[0].id : '');
    setGrnSupplierId(targetSupId);
    setSupplierInvoiceNumber('');
    setGrnDate(new Date().toISOString().slice(0, 10));
    setGrnPaymentStatus('PAID');
    setGrnPaymentMethod('BANK_TRANSFER');
    setGrnNotes('');

    // Pre-populate with first product if available
    const initialProd = products.length > 0 ? products[0] : null;
    setGrnItems([
      {
        productId: initialProd?.id || '',
        quantity: 50,
        freeQuantity: 0,
        costPrice: initialProd?.costPrice || 0
      }
    ]);
    setGrnPaidAmount('');
    setIsGRNModalOpen(true);
  };

  // Item rows in GRN form
  const addGRNItemRow = () => {
    const firstUnselected = products.find(p => !grnItems.some(item => item.productId === p.id));
    const target = firstUnselected || products[0];
    setGrnItems([
      ...grnItems,
      {
        productId: target?.id || '',
        quantity: 50,
        freeQuantity: 0,
        costPrice: target?.costPrice || 0
      }
    ]);
  };

  const updateGRNItemRow = (index: number, field: keyof InboundItemRow, value: any) => {
    const updated = [...grnItems];
    const current = { ...updated[index], [field]: value };

    // When product changes, auto-fill standard cost price
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        current.costPrice = prod.costPrice;
      }
    }

    updated[index] = current;
    setGrnItems(updated);
  };

  const removeGRNItemRow = (index: number) => {
    if (grnItems.length === 1) return;
    setGrnItems(grnItems.filter((_, i) => i !== index));
  };

  // Calculations for GRN: Cost is strictly calculated on purchased quantity; free issues cost Rs. 0.00
  const grnTotalAmount = grnItems.reduce((acc, item) => {
    return acc + (item.quantity * item.costPrice);
  }, 0);
  const grnTotalUnits = grnItems.reduce((acc, item) => acc + (item.quantity || 0) + (item.freeQuantity || 0), 0);
  const grnTotalFreeUnits = grnItems.reduce((acc, item) => acc + (item.freeQuantity || 0), 0);

  // Auto set paid amount when total or payment status changes
  useEffect(() => {
    if (grnPaymentStatus === 'PAID') {
      setGrnPaidAmount(grnTotalAmount.toFixed(2));
    } else if (grnPaymentStatus === 'UNPAID') {
      setGrnPaidAmount('0');
    }
  }, [grnPaymentStatus, grnTotalAmount]);

  // Submit Inbound GRN (Wired to Warehouse Stock!)
  const handleSubmitGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!grnSupplierId) {
      setErrorMessage('Please select a supplier.');
      return;
    }

    const validItems = grnItems.filter(i => i.productId && ((i.quantity || 0) > 0 || (i.freeQuantity || 0) > 0));
    if (validItems.length === 0) {
      setErrorMessage('Please add at least one line item with quantity > 0.');
      return;
    }

    try {
      setSubmitting(true);
      const parsedPaid = parseFloat(grnPaidAmount) || 0;

      const created = await PurchaseOrderService.create({
        supplierId: grnSupplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        date: grnDate,
        paymentStatus: grnPaymentStatus,
        paymentMethod: grnPaymentMethod,
        paidAmount: parsedPaid,
        notes: grnNotes.trim() || undefined,
        items: validItems.map(i => ({
          productId: i.productId,
          quantity: i.quantity || 0,
          freeQuantity: i.freeQuantity || 0,
          costPrice: i.costPrice
        }))
      });

      setSuccessMessage(
        `Inbound Goods Receipt ${created.orderNumber} successfully received! Added ${grnTotalUnits} total units (${grnTotalUnits - grnTotalFreeUnits} paid + ${grnTotalFreeUnits} free issue @ Rs. 0.00) directly into Central Warehouse Stock.`
      );

      setIsGRNModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to receive inbound stock.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Supplier Settle / Payment Modal
  const handleOpenPaymentModal = (supplier: Supplier) => {
    setPayingSupplier(supplier);
    setPaymentAmount(supplier.outstandingBalance > 0 ? supplier.outstandingBalance.toFixed(2) : '');
    setPaymentMethod('BANK_TRANSFER');
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // Submit Supplier Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid positive payment amount.');
      return;
    }

    try {
      setSubmitting(true);
      await SupplierService.recordPayment(payingSupplier.id, {
        amount: parsedAmount,
        paymentMethod,
        notes: paymentNotes.trim() || undefined
      });

      setSuccessMessage(`Payment of ${formatMoney(parsedAmount)} recorded for ${payingSupplier.name}.`);
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to record supplier payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Top Summary Metrics
  const totalSuppliersCount = suppliers.length;
  const totalOutstandingPayable = suppliers.reduce((acc, s) => acc + s.outstandingBalance, 0);
  const totalGRNsCount = purchaseOrders.length;
  const totalProcurementSpend = purchaseOrders.reduce((acc, p) => acc + p.totalAmount, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Building2 className="w-4 h-4" />
            <span>Procurement & Inbound Supply Chain</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Supplier Management & Inward Stock
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Manage wholesale manufacturers, record inbound goods receipts (GRN), and wire directly to central warehouse stock.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenGRNModal()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Package className="w-4 h-4" />
            <span>+ Receive Inbound Stock (GRN)</span>
          </button>
          <button
            onClick={() => handleOpenSupplierModal()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register Supplier</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Suppliers */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Active Suppliers
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {totalSuppliersCount} Partners
          </div>
          <div className="text-xs text-slate-400">
            FMCG Brands & Refineries
          </div>
        </div>

        {/* Total Inward Shipments */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Inbound GRNs Processed
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {totalGRNsCount} Inward Receipts
          </div>
          <div className="text-xs text-emerald-600 font-semibold">
            Wired to Warehouse Inventory
          </div>
        </div>

        {/* Total Procurement Spend */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Inward Procurement
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {formatMoney(totalProcurementSpend)}
          </div>
          <div className="text-xs text-slate-400">
            All-time Stock Purchases
          </div>
        </div>

        {/* Outstanding Payables */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding Payables
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-600">
            {formatMoney(totalOutstandingPayable)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Owed to suppliers for credit terms
          </div>
        </div>
      </div>

      {/* Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex gap-1.5 bg-slate-200/70 p-1.5 rounded-2xl w-full sm:w-fit">
          <button
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'SUPPLIERS'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Suppliers Directory</span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-xs font-mono">
              {suppliers.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('INBOUND_GRN')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition ${
              activeTab === 'INBOUND_GRN'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Inward Stock Receipts (GRN)</span>
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-xs font-mono">
              {purchaseOrders.length}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'SUPPLIERS' ? 'Search supplier or phone...' : 'Search GRN or invoice...'}
            className="w-full bg-white border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>
      </div>

      {/* 1. SUPPLIERS DIRECTORY TAB */}
      {activeTab === 'SUPPLIERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {suppliers.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-sm">
              No suppliers found. Click "+ Register Supplier" to add your first partner.
            </div>
          ) : (
            suppliers.map((supplier) => {
              const hasBalance = supplier.outstandingBalance > 0;
              const isExpanded = expandedSupplierIds.has(supplier.id);
              return (
                <div
                  key={supplier.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header: Code, Name, Terms & Three-Dots Toggle Button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-mono text-xs font-extrabold text-blue-600 block">
                            {supplier.code}
                          </span>
                          <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate" title={supplier.name}>
                            {supplier.name}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                          {supplier.paymentTerms || 'NET 30'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpandSupplier(supplier.id)}
                          className={`p-1.5 rounded-xl border transition-all duration-150 flex items-center justify-center ${
                            isExpanded
                              ? 'bg-blue-50 text-blue-600 border-blue-200/80 shadow-2xs'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-transparent'
                          }`}
                          title={isExpanded ? 'Hide contact details' : 'Show contact details'}
                          aria-label="Toggle contact details"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Contact & Location Details */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs text-slate-600 animate-fadeIn">
                        {supplier.contactPerson && (
                          <div className="font-semibold text-slate-800">
                            Rep: {supplier.contactPerson}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{supplier.phone}</span>
                        </div>
                        {supplier.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 truncate">
                            <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{supplier.email}</span>
                          </div>
                        )}
                        {supplier.address && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="truncate">{supplier.address}, {supplier.city}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Balance & Stats Box */}
                    <div className="p-3 bg-slate-50 rounded-2xl space-y-1.5 border border-slate-100">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Outstanding Payable</span>
                        <span
                          className={`font-mono font-bold text-sm ${
                            hasBalance ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatMoney(supplier.outstandingBalance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                        <span>Supplied Products: {supplier._count?.products || 0}</span>
                        <span>GRNs: {supplier._count?.purchaseOrders || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenGRNModal(supplier.id)}
                      className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      title="Receive Inward Stock from this supplier"
                    >
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Receive Stock</span>
                    </button>

                    {hasBalance && (
                      <button
                        onClick={() => handleOpenPaymentModal(supplier)}
                        className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition"
                        title="Record payment made to supplier"
                      >
                        <Wallet className="w-3.5 h-3.5 text-amber-600" />
                        <span>Pay</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenSupplierModal(supplier)}
                      className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                      title="Edit Supplier"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Delete Supplier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. INBOUND GOODS RECEIPTS (GRN) TAB */}
      {activeTab === 'INBOUND_GRN' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Inbound Goods Received Notes (GRN Ledger)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every record automatically incremented central warehouse stock and logged an Inbound Stock Movement.
              </p>
            </div>

            <button
              onClick={() => handleOpenGRNModal()}
              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition self-start sm:self-auto"
            >
              <Package className="w-4 h-4" /> + Receive New Inward Shipment
            </button>
          </div>

          {purchaseOrders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No Goods Received Notes (GRN) recorded yet. Receive a shipment to replenish warehouse stock.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3">GRN Number</th>
                    <th className="py-3 px-3">Supplier Invoice #</th>
                    <th className="py-3 px-3">Supplier</th>
                    <th className="py-3 px-3">Date Received</th>
                    <th className="py-3 px-3 text-center">Items Received</th>
                    <th className="py-3 px-3 text-right">Total Invoice</th>
                    <th className="py-3 px-3 text-center">Payment</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map((po) => {
                    const totalUnits = po.items.reduce((acc, i) => acc + i.quantity, 0);
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900">
                          {po.orderNumber}
                        </td>
                        <td className="py-3 px-3 font-mono text-blue-600 font-semibold">
                          {po.supplierInvoiceNumber || '—'}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {po.supplier.name}
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {new Date(po.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-lg text-slate-800 text-xs">
                            {totalUnits} Units ({po.items.length} SKUs)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatMoney(po.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                              po.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : po.paymentStatus === 'PARTIAL'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {po.paymentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => setViewingGRN(po)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View GRN Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: RECEIVE INBOUND GOODS (GRN)                     */}
      {/* ======================================================== */}
      {isGRNModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Receive Inward Goods (GRN Entry)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Received items are added directly into Central Warehouse Stock.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsGRNModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitGRN} className="p-6 space-y-4 overflow-y-auto">
              {/* Top row: Supplier & Supplier Physical Invoice # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Wholesale Supplier *
                  </label>
                  <select
                    value={grnSupplierId}
                    onChange={(e) => setGrnSupplierId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Choose Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name} ({s.paymentTerms || 'NET 30'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Supplier Invoice / Bill #
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-90412"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Shipment Arrival Date
                  </label>
                  <input
                    type="date"
                    value={grnDate}
                    onChange={(e) => setGrnDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Received Products & Purchase Unit Costs
                  </span>
                  <button
                    type="button"
                    onClick={addGRNItemRow}
                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product Line
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {grnItems.map((item, index) => {
                    const lineTotal = (item.quantity || 0) * (item.costPrice || 0);
                    return (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-200/70"
                      >
                        {/* Product Selector */}
                        <div className="flex-1">
                          <select
                            value={item.productId}
                            onChange={(e) => updateGRNItemRow(index, 'productId', e.target.value)}
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Select Product --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Current Stock: {p.currentStock} {p.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Paid Quantity */}
                        <div className="w-24">
                          <input
                            type="number"
                            min="0"
                            value={item.quantity !== undefined ? item.quantity : ''}
                            onChange={(e) => updateGRNItemRow(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="Paid Qty"
                            title="Paid Quantity purchased"
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                          />
                        </div>

                        {/* Free Issue Quantity */}
                        <div className="w-24">
                          <input
                            type="number"
                            min="0"
                            value={item.freeQuantity !== undefined && item.freeQuantity !== 0 ? item.freeQuantity : ''}
                            onChange={(e) => updateGRNItemRow(index, 'freeQuantity', parseInt(e.target.value, 10) || 0)}
                            placeholder="+Free"
                            title="Supplier Promotional Free Issue (Cost: Rs. 0.00)"
                            className="w-full bg-emerald-50/70 border border-emerald-300 rounded-xl px-2 py-1.5 text-xs font-bold font-mono text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                          />
                        </div>

                        {/* Cost Price */}
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.costPrice || ''}
                            onChange={(e) => updateGRNItemRow(index, 'costPrice', parseFloat(e.target.value) || 0)}
                            placeholder="Cost Price"
                            title="Purchase Cost Price (per unit)"
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                          />
                        </div>

                        {/* Line Total */}
                        <div className="w-24 text-right font-mono font-bold text-xs text-slate-800">
                          {formatMoney(lineTotal)}
                        </div>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => removeGRNItemRow(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Settlement for GRN */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Supplier Payment & Credit Terms
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      Payment Status
                    </label>
                    <select
                      value={grnPaymentStatus}
                      onChange={(e) => setGrnPaymentStatus(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="PAID">Paid in Full</option>
                      <option value="PARTIAL">Partially Paid</option>
                      <option value="UNPAID">Unpaid (Credit Term)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      Payment Method
                    </label>
                    <select
                      value={grnPaymentMethod}
                      onChange={(e) => setGrnPaymentMethod(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                      Amount Paid Now
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={grnPaidAmount}
                      onChange={(e) => setGrnPaidAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={grnNotes}
                    onChange={(e) => setGrnNotes(e.target.value)}
                    placeholder="Optional memo, batch reference, container number..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Total & Submit */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Inward Units
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-800">
                      +{grnTotalUnits} Units
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Total Invoice Amount
                    </span>
                    <span className="font-mono text-xl font-bold text-emerald-600">
                      {formatMoney(grnTotalAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsGRNModalOpen(false)}
                    className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || grnItems.length === 0}
                    className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <Package className="w-4 h-4" />
                    <span>{submitting ? 'Receiving Stock...' : 'Confirm Inward Goods (GRN)'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: REGISTER / EDIT SUPPLIER                        */}
      {/* ======================================================== */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingSupplier ? 'Edit Supplier Details' : 'Register Wholesale Supplier'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Partner profile for procurement & inbound warehouse supply.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSupplier} className="p-6 space-y-3.5 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={supplierCode}
                    onChange={(e) => setSupplierCode(e.target.value)}
                    required
                    placeholder="SUP-001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Company / Brand Name *
                  </label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    required
                    placeholder="e.g. Ceylon Tea Mills Ltd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rohan De Silva"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="e.g. +94 11 234 5678"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orders@supplier.lk"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Factory / Warehouse Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street or Industrial Zone"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Colombo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Default Payment Terms
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NET 15">NET 15 Days</option>
                  <option value="NET 30">NET 30 Days</option>
                  <option value="NET 45">NET 45 Days</option>
                  <option value="CASH ON DELIVERY">Cash on Delivery (COD)</option>
                  <option value="ADVANCE PAYMENT">Advance Payment</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: PAY SUPPLIER (SETTLE OUTSTANDING BALANCE)       */}
      {/* ======================================================== */}
      {isPaymentModalOpen && payingSupplier && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Pay Supplier
                  </h3>
                  <p className="text-xs text-slate-500">
                    Settle balance owed to {payingSupplier.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="p-6 space-y-3.5">
              <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-amber-800 font-medium">Current Balance Due:</span>
                <span className="font-mono font-black text-amber-700 text-base">
                  {formatMoney(payingSupplier.outstandingBalance)}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payingSupplier.outstandingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="BANK_TRANSFER">Bank Transfer (Online / Slip)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Reference / Memo
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Bank Ref #TXN-9021 or Cheque #10291"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: VIEW GRN DETAILS                                */}
      {/* ======================================================== */}
      {viewingGRN && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Goods Received Note: {viewingGRN.orderNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Supplier: {viewingGRN.supplier.name} • {new Date(viewingGRN.date).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setViewingGRN(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Supplier Invoice</span>
                  <span className="font-mono font-bold text-slate-800">{viewingGRN.supplierInvoiceNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold uppercase text-[10px]">Payment Status</span>
                  <span className="font-semibold text-emerald-700">{viewingGRN.paymentStatus} ({viewingGRN.paymentMethod})</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5 text-center">Inward Qty</th>
                      <th className="p-2.5 text-right">Cost Price</th>
                      <th className="p-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {viewingGRN.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2.5 font-sans font-medium text-slate-900">
                          {item.product.name}
                        </td>
                        <td className="p-2.5 text-center font-bold text-emerald-700">
                          +{item.quantity} {item.product.unit}
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          {formatMoney(item.costPrice)}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {formatMoney(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase">Total Invoice:</span>
                <span className="font-mono text-lg font-bold text-slate-900">
                  {formatMoney(viewingGRN.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
