import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Phone, 
  MapPin, 
  Edit3, 
  ShoppingBag, 
  Building2,
  Compass,
  X,
  Wallet,
  Receipt,
  Printer,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { CustomerService, RouteService } from '../services/api';
import { Customer, Order, Route, CustomerPayment } from '../types';
import { CustomerModal } from '../components/CustomerModal';
import { CustomerPaymentModal } from '../components/CustomerPaymentModal';
import { CustomerReceiptModal } from '../components/CustomerReceiptModal';
import { useCurrency } from '../context/CurrencyContext';

export const Customers: React.FC<{ onViewInvoice?: (order: Order) => void }> = ({ onViewInvoice: _onViewInvoice }) => {
  const { formatMoney } = useCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals & History drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Credit Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);

  // Printable Receipt Modal
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<CustomerPayment | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // History Drawer
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [historyTab, setHistoryTab] = useState<'ORDERS' | 'PAYMENTS'>('ORDERS');
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [unassignedCount, setUnassignedCount] = useState<number>(0);

  const loadData = async () => {
    try {
      const [custList, routeList, unassignedList] = await Promise.all([
        CustomerService.getAll(search, selectedRouteId !== 'ALL' ? selectedRouteId : undefined),
        RouteService.getAll(),
        CustomerService.getAll(undefined, 'UNASSIGNED').catch(() => [])
      ]);
      setCustomers(custList);
      setRoutes(routeList);
      setUnassignedCount(Array.isArray(unassignedList) ? unassignedList.length : 0);
    } catch (err) {
      console.error('Failed to load customers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedRouteId]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setIsModalOpen(true);
  };

  const openPaymentModal = (cust: Customer) => {
    setPaymentCustomer(cust);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentRecorded = async (payment: CustomerPayment) => {
    setSuccessNotification(`Payment of ${formatMoney(payment.amount)} recorded! Receipt: ${payment.receiptNumber}`);
    setActiveReceiptPayment(payment);
    setIsReceiptModalOpen(true);
    await loadData();

    if (historyCustomer && historyCustomer.id === payment.customerId) {
      try {
        const payments = await CustomerService.getPayments(historyCustomer.id);
        setCustomerPayments(payments);
      } catch (err) {}
    }
  };

  const openHistory = async (cust: Customer, defaultTab: 'ORDERS' | 'PAYMENTS' = 'ORDERS') => {
    setHistoryCustomer(cust);
    setHistoryTab(defaultTab);
    setLoadingHistory(true);
    try {
      const [orders, payments] = await Promise.all([
        CustomerService.getOrderHistory(cust.id),
        CustomerService.getPayments(cust.id)
      ]);
      setCustomerOrders(orders);
      setCustomerPayments(payments);
    } catch (err) {
      console.error('Failed to load customer history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleVoidPayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to void this payment receipt? The customer debt will be restored.')) {
      return;
    }

    try {
      await CustomerService.deletePayment(paymentId);
      setSuccessNotification('Payment receipt voided. Customer balance restored.');
      if (historyCustomer) {
        const payments = await CustomerService.getPayments(historyCustomer.id);
        setCustomerPayments(payments);
      }
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to void payment.');
    }
  };

  const totalOutstandingAll = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const customersWithDebt = customers.filter(c => (c.outstandingBalance || 0) > 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Building2 className="w-4 h-4" />
            <span>Accounts & Debt Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Retail Accounts & Routes
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Manage store credit, collect customer balances, and issue official settlement receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="bg-white px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Total Market Debt:</span>
            <span className="text-sm font-bold font-mono text-amber-600">
              {formatMoney(totalOutstandingAll)}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60">
              {customersWithDebt.length} accounts
            </span>
          </div>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm transition text-xs shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Register Client
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successNotification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>{successNotification}</span>
          </div>
          <button
            onClick={() => setSuccessNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Legacy / Unassigned Route Warning Banner */}
      {unassignedCount > 0 && (
        <div className="p-3.5 sm:p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 text-xs sm:text-sm animate-fadeIn shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-700 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-amber-950 block sm:inline">
                {unassignedCount} Retail Account{unassignedCount > 1 ? 's' : ''} Missing an Assigned Route!
              </span>{' '}
              <span className="text-amber-800 text-xs font-normal">
                Lorries only display customers matching their route. Please assign a route to each account.
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedRouteId('UNASSIGNED')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-2xs ${
              selectedRouteId === 'UNASSIGNED'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            Review Unassigned ({unassignedCount})
          </button>
        </div>
      )}

      {/* Search & Route Filter Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client name, code, phone, shop..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedRouteId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedRouteId === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Routes ({customers.length})
          </button>
          {unassignedCount > 0 && (
            <button
              onClick={() => setSelectedRouteId('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                selectedRouteId === 'UNASSIGNED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>Needs Route ({unassignedCount})</span>
            </button>
          )}
          {routes.map(r => (
            <button
              key={r.id}
              onClick={() => setSelectedRouteId(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedRouteId === r.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {r.code}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {customers.map((c) => {
          const hasDebt = (c.outstandingBalance || 0) > 0;
          return (
            <div
              key={c.id}
              className={`bg-white border rounded-3xl p-6 shadow-2xs hover:shadow-sm transition flex flex-col justify-between ${
                hasDebt ? 'border-amber-200/90' : 'border-slate-200/80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-mono font-bold text-slate-500 px-2.5 py-0.5 bg-slate-100 rounded-lg">
                    {c.code}
                  </span>
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      c.pricingTier === 'VIP'
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : c.pricingTier === 'WHOLESALE'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {c.pricingTier} ({c.discountPercentage}%)
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 leading-snug">{c.name}</h3>
                {c.companyName && (
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> {c.companyName}
                  </p>
                )}

                {c.route ? (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-lg">
                    <Compass className="w-3 h-3" />
                    <span>{c.route.name}</span>
                  </div>
                ) : (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg">
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    <span>⚠️ No Route Assigned</span>
                  </div>
                )}

                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{c.phone}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{c.deliveryAddress}, {c.city}</span>
                  </p>
                </div>
              </div>

              {/* Card Footer with Balance Due & Quick Actions */}
              <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Balance Due
                  </span>
                  <span
                    className={`text-base font-bold font-mono ${
                      hasDebt ? 'text-amber-600' : 'text-slate-900'
                    }`}
                  >
                    {formatMoney(c.outstandingBalance || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openPaymentModal(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-[0.98] ${
                      hasDebt
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80'
                    }`}
                    title="Record Credit Payment / Settlement"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Settle</span>
                  </button>

                  <button
                    onClick={() => openHistory(c, 'ORDERS')}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                    title="View History (Bills & Receipts)"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>History</span>
                  </button>

                  <button
                    onClick={() => openEditModal(c)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
                    title="Edit Client"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* History Drawer Modal (Bills & Payment Receipts) */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-end animate-fadeIn">
          <div className="bg-white h-full w-full max-w-xl p-5 sm:p-7 overflow-y-auto space-y-4 shadow-2xl flex flex-col justify-between">
            <div>
              {/* Drawer Top Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-md">
                      {historyCustomer.code}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900">{historyCustomer.name}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {historyCustomer.deliveryAddress}, {historyCustomer.city}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Outstanding Debt:</span>
                    <span
                      className={`text-sm font-mono font-bold px-2.5 py-0.5 rounded-lg ${
                        (historyCustomer.outstandingBalance || 0) > 0
                          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {formatMoney(historyCustomer.outstandingBalance || 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openPaymentModal(historyCustomer)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Pay</span>
                  </button>
                  <button
                    onClick={() => setHistoryCustomer(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="mt-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onClick={() => setHistoryTab('ORDERS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                    historyTab === 'ORDERS'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Sales Bills ({customerOrders.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHistoryTab('PAYMENTS')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                    historyTab === 'PAYMENTS'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Payment Receipts ({customerPayments.length})</span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="py-4">
                {loadingHistory ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading history records...</div>
                ) : historyTab === 'ORDERS' ? (
                  /* Orders Tab */
                  customerOrders.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No sales orders logged for this client yet.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customerOrders.map((order) => (
                        <div
                          key={order.id}
                          className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/70 transition flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono font-bold text-xs text-slate-900">{order.orderNumber}</p>
                              {order.paperBillNumber && (
                                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.5 rounded font-mono font-semibold">
                                  Slip: {order.paperBillNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                              {order.lorry ? ` • Lorry ${order.lorry.vehicleNumber}` : ' • Warehouse Direct'}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-xs text-slate-900 font-mono">
                              {formatMoney(order.netTotal)}
                            </p>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              {order.paymentStatus !== 'PAID' && (order.balanceAmount !== undefined ? order.balanceAmount : (order.netTotal - (order.paidAmount || 0))) > 0 && (
                                <span className="text-[10px] font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                                  Due: {formatMoney(order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, order.netTotal - (order.paidAmount || 0)))}
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                                  order.paymentStatus === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : order.paymentStatus === 'PARTIAL'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {order.paymentStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  /* Payments Tab */
                  customerPayments.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className="text-xs text-slate-400">No payment receipts recorded for this client yet.</p>
                      <button
                        onClick={() => openPaymentModal(historyCustomer)}
                        className="px-3.5 py-2 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-xl hover:bg-emerald-100 transition inline-flex items-center gap-1.5"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Record First Payment</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {customerPayments.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-2xl border border-slate-200/80 bg-emerald-50/30 hover:bg-emerald-50/60 transition flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-emerald-800">
                                {p.receiptNumber}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 font-mono">
                                {p.paymentMethod}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1">
                              {new Date(p.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                              {p.collectedBy ? ` • By ${p.collectedBy}` : ''}
                            </p>

                            {p.chequeNumber && (
                              <p className="text-[10px] font-mono text-blue-700 mt-0.5">
                                Cheque: {p.chequeNumber} {p.bankName ? `(${p.bankName})` : ''}
                              </p>
                            )}
                            {p.reference && (
                              <p className="text-[10px] font-mono text-purple-700 mt-0.5">
                                Ref: {p.reference}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex items-center gap-2">
                            <div>
                              <p className="font-extrabold text-sm text-emerald-600 font-mono">
                                + {formatMoney(p.amount)}
                              </p>
                              <span className="text-[10px] text-slate-400 font-medium">Settled</span>
                            </div>

                            <div className="flex items-center gap-1 pl-2">
                              <button
                                onClick={() => {
                                  setActiveReceiptPayment(p);
                                  setIsReceiptModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-white transition"
                                title="Print Receipt Voucher"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleVoidPayment(p.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition"
                                title="Void / Cancel Payment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Add/Edit Modal */}
      <CustomerModal
        isOpen={isModalOpen}
        customer={editingCustomer}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
      />

      {/* Customer Credit Payment Modal */}
      <CustomerPaymentModal
        isOpen={isPaymentModalOpen}
        customer={paymentCustomer}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Customer Printable Receipt Voucher Modal */}
      <CustomerReceiptModal
        isOpen={isReceiptModalOpen}
        payment={activeReceiptPayment}
        customer={paymentCustomer || historyCustomer}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
};
