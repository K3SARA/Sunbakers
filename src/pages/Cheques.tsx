import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  RotateCcw,
  X,
  Truck,
  User,
  AlertCircle,
  Edit2
} from 'lucide-react';
import { CustomerPayment, Order } from '../types';
import { ChequeService, ChequeStats } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface ChequesProps {
  onViewInvoice?: (order: Order) => void;
  isActive?: boolean;
}

export const Cheques: React.FC<ChequesProps> = ({ onViewInvoice, isActive }) => {
  const { formatMoney } = useCurrency();

  const [cheques, setCheques] = useState<CustomerPayment[]>([]);
  const [stats, setStats] = useState<ChequeStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED'>('ALL');
  const [maturityFilter, setMaturityFilter] = useState<'ALL' | 'DUE' | 'POST_DATED'>('ALL');

  // Action Modals
  const [selectedCheque, setSelectedCheque] = useState<CustomerPayment | null>(null);
  const [actionType, setActionType] = useState<'DEPOSIT' | 'CLEAR' | 'BOUNCE' | 'EDIT' | null>(null);
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Deposit Form State
  const [depositBank, setDepositBank] = useState<string>('Commercial Bank - Primary A/C');
  const [depositDate, setDepositDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Bounce Form State
  const [bounceReason, setBounceReason] = useState<string>('Insufficient Funds (Refer to Drawer)');
  const [bounceNotes, setBounceNotes] = useState<string>('');

  // Edit Form State
  const [editChequeNumber, setEditChequeNumber] = useState<string>('');
  const [editBankName, setEditBankName] = useState<string>('');
  const [editChequeDate, setEditChequeDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const loadData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const [chequesData, statsData] = await Promise.all([
        ChequeService.getAll(),
        ChequeService.getStats()
      ]);

      setCheques(chequesData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load cheques data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useLiveRefresh(() => {
    loadData(false);
  }, { isActive });

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Cheques
  const filteredCheques = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return cheques.filter(chq => {
      // 1. Status Filter
      const currentStatus = chq.chequeStatus || 'PENDING';
      if (statusFilter !== 'ALL' && currentStatus !== statusFilter) {
        return false;
      }

      // 2. Maturity Filter
      if (maturityFilter !== 'ALL' && chq.chequeDate) {
        const matDate = new Date(chq.chequeDate);
        if (maturityFilter === 'DUE' && matDate > today) return false;
        if (maturityFilter === 'POST_DATED' && matDate <= today) return false;
      }

      // 3. Search Filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const chqNum = (chq.chequeNumber || '').toLowerCase();
        const bank = (chq.bankName || '').toLowerCase();
        const custName = (chq.customer?.name || '').toLowerCase();
        const custCode = (chq.customer?.code || '').toLowerCase();
        const rcptNum = (chq.receiptNumber || '').toLowerCase();
        const rep = (chq.collectedBy || '').toLowerCase();
        const orderNums = (chq.allocations || []).map(a => a.order?.orderNumber?.toLowerCase() || '').join(' ');

        if (
          !chqNum.includes(q) &&
          !bank.includes(q) &&
          !custName.includes(q) &&
          !custCode.includes(q) &&
          !rcptNum.includes(q) &&
          !rep.includes(q) &&
          !orderNums.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [cheques, statusFilter, maturityFilter, search]);

  // Open Actions
  const openActionModal = (cheque: CustomerPayment, type: 'DEPOSIT' | 'CLEAR' | 'BOUNCE' | 'EDIT') => {
    setSelectedCheque(cheque);
    setActionType(type);
    setActionError(null);
    setActionSuccess(null);

    if (type === 'DEPOSIT') {
      setDepositBank(cheque.depositBank || 'Commercial Bank - Primary A/C');
      setDepositDate(new Date().toISOString().split('T')[0]);
    } else if (type === 'BOUNCE') {
      setBounceReason(cheque.bounceReason || 'Insufficient Funds (Refer to Drawer)');
      setBounceNotes('');
    } else if (type === 'EDIT') {
      setEditChequeNumber(cheque.chequeNumber || '');
      setEditBankName(cheque.bankName || '');
      setEditChequeDate(cheque.chequeDate ? cheque.chequeDate.split('T')[0] : '');
      setEditNotes(cheque.notes || '');
    }
  };

  const handleConfirmStatusChange = async (newStatus: 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED') => {
    if (!selectedCheque) return;

    try {
      setSubmittingAction(true);
      setActionError(null);

      const payload: any = { status: newStatus };

      if (newStatus === 'DEPOSITED') {
        payload.depositBank = depositBank.trim();
        payload.depositDate = depositDate;
      } else if (newStatus === 'BOUNCED') {
        payload.bounceReason = `${bounceReason}${bounceNotes.trim() ? ` — ${bounceNotes.trim()}` : ''}`;
      } else if (newStatus === 'CLEARED') {
        payload.clearedDate = new Date().toISOString();
      }

      await ChequeService.updateStatus(selectedCheque.id, payload);
      setActionSuccess(`Cheque #${selectedCheque.chequeNumber || 'N/A'} marked as ${newStatus}!`);

      setTimeout(() => {
        setActionType(null);
        setSelectedCheque(null);
        loadData();
      }, 700);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || 'Failed to update cheque status.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedCheque) return;

    try {
      setSubmittingAction(true);
      setActionError(null);

      await ChequeService.update(selectedCheque.id, {
        chequeNumber: editChequeNumber.trim() || undefined,
        bankName: editBankName.trim() || undefined,
        chequeDate: editChequeDate || undefined,
        notes: editNotes.trim() || undefined
      });

      setActionSuccess('Cheque details updated successfully!');
      setTimeout(() => {
        setActionType(null);
        setSelectedCheque(null);
        loadData();
      }, 700);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || 'Failed to update cheque details.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status: string | null | undefined, chequeDate?: string | null) => {
    const s = status || 'PENDING';
    const isMatured = chequeDate && new Date(chequeDate) <= new Date();

    switch (s) {
      case 'PENDING':
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isMatured ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            <Clock className="w-3.5 h-3.5" />
            <span>{isMatured ? 'In Hand (Due)' : 'In Hand (Post-Dated)'}</span>
          </span>
        );
      case 'DEPOSITED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Deposited</span>
          </span>
        );
      case 'CLEARED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Cleared / Realized</span>
          </span>
        );
      case 'BOUNCED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Bounced / Returned</span>
          </span>
        );
      default:
        return null;
    }
  };

  const formatMaturityLabel = (dateStr?: string | null) => {
    if (!dateStr) return 'No Date';
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Due Today';
    if (diffDays < 0) return `${Math.abs(diffDays)}d Overdue`;
    return `In ${diffDays} days`;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <CreditCard className="w-4 h-4" />
            <span>Finance & Banking Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Cheque Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track, deposit, realize, and reconcile customer cheques collected by sales reps and office counters.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl shadow-2xs transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total In Hand */}
        <div className="p-4 bg-white border border-blue-200/80 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
              In Hand (Pending)
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatMoney(stats?.pendingAmount || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{stats?.pendingCount || 0} cheques</span>
            {stats && stats.maturedCount > 0 && (
              <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                {stats.maturedCount} Matured!
              </span>
            )}
          </div>
        </div>

        {/* Deposited */}
        <div className="p-4 bg-white border border-indigo-200/80 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              In Bank (Deposited)
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatMoney(stats?.depositedAmount || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>{stats?.depositedCount || 0} cheques in transit</span>
          </div>
        </div>

        {/* Cleared */}
        <div className="p-4 bg-white border border-emerald-200/80 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              Realized & Cleared
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatMoney(stats?.clearedAmount || 0)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span>{stats?.clearedCount || 0} cleared into bank</span>
          </div>
        </div>

        {/* Bounced */}
        <div className="p-4 bg-white border border-rose-200/80 rounded-2xl shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
              Bounced / Returned
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-rose-600">
            {formatMoney(stats?.bouncedAmount || 0)}
          </div>
          <div className="text-[11px] text-rose-500 mt-1 font-semibold">
            <span>{stats?.bouncedCount || 0} unpaid / debt restored</span>
          </div>
        </div>

        {/* Total Registry */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-2xs col-span-2 lg:col-span-1 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Cheques
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white">
            {formatMoney(stats?.totalAmount || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>{stats?.totalCount || 0} registered cheques</span>
          </div>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Cheques', count: stats?.totalCount },
            { id: 'PENDING', label: 'In Hand (Pending)', count: stats?.pendingCount },
            { id: 'DEPOSITED', label: 'Deposited', count: stats?.depositedCount },
            { id: 'CLEARED', label: 'Cleared', count: stats?.clearedCount },
            { id: 'BOUNCED', label: 'Bounced', count: stats?.bouncedCount }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.id ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Maturity Toggle */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Cheque #, Bank, Customer, Route, Receipt #..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
            {(['ALL', 'DUE', 'POST_DATED'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMaturityFilter(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  maturityFilter === m
                    ? 'bg-white text-blue-600 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {m === 'ALL' ? 'All Dates' : m === 'DUE' ? 'Matured / Due' : 'Post-Dated'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Cheques Table / Cards */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading Cheques Registry...
          </div>
        ) : filteredCheques.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 text-sm">No cheques found</p>
            <p className="text-[11px] text-slate-400">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter.'
                : 'When reps or office billing enters cheques, they will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                  <th className="py-3 px-4">Cheque Details</th>
                  <th className="py-3 px-4">Customer & Route</th>
                  <th className="py-3 px-4">Maturity Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Collector / Lorry</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCheques.map(chq => {
                  const status = chq.chequeStatus || 'PENDING';
                  const isMatured = chq.chequeDate && new Date(chq.chequeDate) <= new Date();
                  const linkedOrder = chq.allocations?.[0]?.order;

                  return (
                    <tr key={chq.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Cheque Details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-mono font-bold text-slate-900 text-sm">
                              #{chq.chequeNumber || 'N/A'}
                            </div>
                            <div className="text-[11px] font-semibold text-slate-600">
                              {chq.bankName || 'Unknown Bank'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Rcpt: {chq.receiptNumber}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customer & Route */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {chq.customer?.name || 'Walk-in Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {chq.customer?.code} {chq.customer?.companyName ? `• ${chq.customer.companyName}` : ''}
                        </div>
                        {chq.customer?.route && (
                          <span className="inline-block text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-medium mt-0.5">
                            📍 {chq.customer.route.name}
                          </span>
                        )}
                      </td>

                      {/* Maturity Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-800">
                          {chq.chequeDate ? new Date(chq.chequeDate).toLocaleDateString('en-GB') : '—'}
                        </div>
                        <div className={`text-[10px] font-bold ${
                          isMatured ? 'text-amber-600' : 'text-blue-600'
                        }`}>
                          {formatMaturityLabel(chq.chequeDate)}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-slate-900 text-sm">
                          {formatMoney(chq.amount)}
                        </div>
                        {linkedOrder && (
                          <button
                            type="button"
                            onClick={() => onViewInvoice?.(linkedOrder)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-mono font-semibold underline cursor-pointer"
                            title="View Invoice"
                          >
                            Bill: {linkedOrder.paperBillNumber || linkedOrder.orderNumber}
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {getStatusBadge(status, chq.chequeDate)}
                        {status === 'DEPOSITED' && chq.depositBank && (
                          <div className="text-[10px] text-slate-500 font-medium mt-0.5 truncate max-w-[140px]">
                            Bank: {chq.depositBank}
                          </div>
                        )}
                        {status === 'BOUNCED' && chq.bounceReason && (
                          <div className="text-[10px] text-rose-600 font-semibold mt-0.5 truncate max-w-[140px]">
                            {chq.bounceReason}
                          </div>
                        )}
                      </td>

                      {/* Collector / Lorry */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{chq.collectedBy || 'Sales Rep'}</span>
                        </div>
                        {chq.lorry && (
                          <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span>{chq.lorry.vehicleNumber}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono">
                          Recv: {new Date(chq.createdAt).toLocaleDateString('en-GB')}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Deposit Button */}
                          {status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => openActionModal(chq, 'DEPOSIT')}
                              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200/70 transition cursor-pointer"
                              title="Deposit Cheque to Bank"
                            >
                              Deposit
                            </button>
                          )}

                          {/* Mark Cleared Button */}
                          {(status === 'PENDING' || status === 'DEPOSITED') && (
                            <button
                              type="button"
                              onClick={() => openActionModal(chq, 'CLEAR')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200/70 transition cursor-pointer"
                              title="Mark Cheque Cleared / Realized"
                            >
                              Clear
                            </button>
                          )}

                          {/* Mark Bounced Button */}
                          {(status === 'PENDING' || status === 'DEPOSITED') && (
                            <button
                              type="button"
                              onClick={() => openActionModal(chq, 'BOUNCE')}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200/70 transition cursor-pointer"
                              title="Mark Cheque as Bounced / Returned"
                            >
                              Bounce
                            </button>
                          )}

                          {/* Revert to Pending */}
                          {(status === 'DEPOSITED' || status === 'CLEARED' || status === 'BOUNCED') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCheque(chq);
                                handleConfirmStatusChange('PENDING');
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Revert to In Hand (Pending)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit Details */}
                          <button
                            type="button"
                            onClick={() => openActionModal(chq, 'EDIT')}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit Cheque Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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

      {/* 5. ACTION MODAL: DEPOSIT CHEQUE */}
      {actionType === 'DEPOSIT' && selectedCheque && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Deposit Cheque</h3>
                  <p className="text-[11px] text-slate-400">
                    Cheque #{selectedCheque.chequeNumber} • {formatMoney(selectedCheque.amount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Deposit Bank Account <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={depositBank}
                  onChange={(e) => setDepositBank(e.target.value)}
                  placeholder="e.g. Commercial Bank - Current A/C"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Deposit Date
                </label>
                <input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleConfirmStatusChange('DEPOSITED')}
                className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {submittingAction ? 'Depositing...' : 'Confirm Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ACTION MODAL: CLEAR CHEQUE */}
      {actionType === 'CLEAR' && selectedCheque && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base">Mark as Cleared</h3>
              <p className="text-xs text-slate-500 mt-1">
                Confirm that Cheque <span className="font-mono font-bold">#{selectedCheque.chequeNumber}</span> for{' '}
                <span className="font-mono font-bold text-slate-900">{formatMoney(selectedCheque.amount)}</span> from{' '}
                <span className="font-bold text-slate-800">{selectedCheque.customer?.name}</span> has cleared into your bank.
              </p>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-left">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs text-left">
                {actionSuccess}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleConfirmStatusChange('CLEARED')}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {submittingAction ? 'Updating...' : 'Yes, Realized'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. ACTION MODAL: BOUNCE CHEQUE */}
      {actionType === 'BOUNCE' && selectedCheque && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-rose-700 text-sm">Mark as Bounced / Returned</h3>
                  <p className="text-[11px] text-slate-400">
                    Cheque #{selectedCheque.chequeNumber} • {formatMoney(selectedCheque.amount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Alert */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Automatic Ledger Reversal</span>
              </div>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Marking this cheque as bounced will automatically restore{' '}
                <span className="font-mono font-bold">{formatMoney(selectedCheque.amount)}</span> onto{' '}
                <span className="font-bold">{selectedCheque.customer?.name}</span>'s credit balance and re-open the associated sales bill as UNPAID.
              </p>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
                {actionSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Return Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Insufficient Funds (Refer to Drawer)">Insufficient Funds (Refer to Drawer)</option>
                  <option value="Signature Differs / Incomplete">Signature Differs / Incomplete</option>
                  <option value="Post-Dated / Stale Cheque">Post-Dated / Stale Cheque</option>
                  <option value="Account Closed / Frozen">Account Closed / Frozen</option>
                  <option value="Payment Stopped by Drawer">Payment Stopped by Drawer</option>
                  <option value="Amount in Words & Figures Differ">Amount in Words & Figures Differ</option>
                  <option value="Other Bank Return">Other Bank Return</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Additional Notes (Optional)
                </label>
                <input
                  type="text"
                  value={bounceNotes}
                  onChange={(e) => setBounceNotes(e.target.value)}
                  placeholder="e.g. Bank slip reference, branch notice..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => handleConfirmStatusChange('BOUNCED')}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {submittingAction ? 'Processing...' : 'Confirm Bounce'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. ACTION MODAL: EDIT CHEQUE DETAILS */}
      {actionType === 'EDIT' && selectedCheque && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Edit Cheque Details</h3>
                  <p className="text-[11px] text-slate-400">
                    Fix typo in cheque number, bank, or maturity date
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {actionError}
              </div>
            )}

            {actionSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
                {actionSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Cheque Number
                </label>
                <input
                  type="text"
                  value={editChequeNumber}
                  onChange={(e) => setEditChequeNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={editBankName}
                  onChange={(e) => setEditBankName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Maturity / Cheque Date
                </label>
                <input
                  type="date"
                  value={editChequeDate}
                  onChange={(e) => setEditChequeDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleSaveEdit}
                className="py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
              >
                {submittingAction ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
