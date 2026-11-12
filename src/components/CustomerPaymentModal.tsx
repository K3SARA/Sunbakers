import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  Receipt,
  AlertCircle,
  CreditCard,
  FileText,
  ArrowRight
} from 'lucide-react';
import { Customer, CustomerPayment, Lorry, Order } from '../types';
import { CustomerService, LorryService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface CustomerPaymentModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: (payment: CustomerPayment) => void;
  defaultLorryId?: string;
  defaultCollectorName?: string;
}

export const CustomerPaymentModal: React.FC<CustomerPaymentModalProps> = ({
  customer,
  isOpen,
  onClose,
  onPaymentRecorded,
  defaultLorryId,
  defaultCollectorName
}) => {
  const { formatMoney, currencyConfig } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);

  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CHEQUE' | 'BANK_TRANSFER'>('CASH');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [collectedBy, setCollectedBy] = useState<string>('Office Counter');
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [unpaidBills, setUnpaidBills] = useState<Order[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && customer) {
      LorryService.getAll()
        .then(setLorries)
        .catch(() => {});

      CustomerService.getUnpaidBills(customer.id)
        .then(setUnpaidBills)
        .catch(() => setUnpaidBills([]));

      if (customer.outstandingBalance > 0) {
        setAmount(customer.outstandingBalance.toString());
      } else {
        setAmount('');
      }

      setPaymentMethod('CASH');
      setChequeNumber('');
      setBankName('');
      setChequeDate(new Date().toISOString().split('T')[0]);
      setReference('');
      setCollectedBy(defaultCollectorName || 'Office Counter');
      setSelectedLorryId(defaultLorryId || '');
      setNotes('');
      setError(null);
    }
  }, [isOpen, customer, defaultLorryId, defaultCollectorName]);

  if (!isOpen || !customer) return null;

  const outstanding = customer.outstandingBalance || 0;
  const numAmount = parseFloat(amount) || 0;
  const remainingBalance = outstanding - numAmount;

  const handleQuickAmount = (val: number) => {
    if (val < 0) val = 0;
    setAmount(val.toString());
  };

  const handleLorrySelect = (lorryId: string) => {
    setSelectedLorryId(lorryId);
    if (lorryId) {
      const lorry = lorries.find(l => l.id === lorryId);
      if (lorry) {
        setCollectedBy(`${lorry.driverName} (${lorry.vehicleNumber})`);
      }
    } else {
      setCollectedBy('Office Counter');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a valid positive payment amount.');
      return;
    }

    if (paymentMethod === 'CHEQUE' && !chequeNumber.trim()) {
      setError('Please provide the Cheque Number.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await CustomerService.recordPayment(customer.id, {
        amount: numAmount,
        paymentMethod,
        chequeNumber: chequeNumber.trim() || undefined,
        bankName: bankName.trim() || undefined,
        chequeDate: chequeDate || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        collectedBy: collectedBy.trim() || undefined,
        lorryId: selectedLorryId || undefined
      });

      onPaymentRecorded(res.payment);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to record customer payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Record Credit Payment</h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded-lg">
                  {customer.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[260px] sm:max-w-xs">
                {customer.name} {customer.companyName ? `• ${customer.companyName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Debt & Balance Preview Card */}
          <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/60 border border-slate-200/80 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Current Outstanding Balance
              </span>
              <span className="text-sm font-bold font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/60">
                {formatMoney(outstanding)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span>Payment Amount</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="font-mono font-bold text-emerald-600">
                - {formatMoney(numAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                New Balance After Payment
              </span>
              <span
                className={`text-base font-extrabold font-mono px-2.5 py-0.5 rounded-lg ${
                  remainingBalance <= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-white text-slate-900 border border-slate-200'
                }`}
              >
                {remainingBalance < 0
                  ? `+${formatMoney(Math.abs(remainingBalance))} (Advance)`
                  : formatMoney(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Bill-to-Bill Knock-off Breakdown (Ultra minimal) */}
          {unpaidBills.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span>Unsettled Bills ({unpaidBills.length})</span>
                <span className="text-blue-600 font-semibold normal-case">FIFO auto-cleared</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {unpaidBills.map((b) => {
                  const billDue: number = (b.balanceAmount !== undefined && b.balanceAmount > 0)
                    ? b.balanceAmount
                    : Math.max(0, b.netTotal - (b.paidAmount || 0));
                  return (
                    <div
                      key={b.id}
                      onClick={() => handleQuickAmount(billDue)}
                      className="cursor-pointer flex items-center justify-between px-2.5 py-1.5 bg-white rounded-xl border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/40 transition text-xs"
                      title="Click to fill this bill's due amount"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-slate-800 truncate">
                          {b.paperBillNumber || b.orderNumber}
                        </span>
                        {b.daysOpen !== undefined && (
                          <span className="text-[10px] text-slate-400">
                            • {b.daysOpen === 0 ? 'Today' : `${b.daysOpen}d ago`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold text-rose-600">
                          {formatMoney(billDue)}
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                          Settle
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Amount Input */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Payment Amount ({currencyConfig.symbol}) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 font-mono">
                {currencyConfig.symbol}
              </span>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-2.5 text-base font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Quick Amount Selection */}
            {outstanding > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleQuickAmount(outstanding)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition border border-blue-200/60"
                >
                  Pay Full ({formatMoney(outstanding)})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(Math.round(outstanding / 2))}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  50% ({formatMoney(Math.round(outstanding / 2))})
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAmount(Math.round(outstanding / 4))}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  25% ({formatMoney(Math.round(outstanding / 4))})
                </button>
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Payment Method *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                  paymentMethod === 'CASH'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('CHEQUE')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                  paymentMethod === 'CHEQUE'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Cheque</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                  paymentMethod === 'BANK_TRANSFER'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Bank Slip</span>
              </button>
            </div>
          </div>

          {/* Cheque Details Fields */}
          {paymentMethod === 'CHEQUE' && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-3 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-blue-900 block mb-1">
                    Cheque Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    placeholder="e.g. CHQ-889021"
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-blue-900 block mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Commercial Bank, BOC"
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-blue-900 block mb-1">
                  Cheque Maturity Date
                </label>
                <input
                  type="date"
                  value={chequeDate}
                  onChange={(e) => setChequeDate(e.target.value)}
                  className="w-full bg-white border border-blue-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Bank Transfer Reference */}
          {paymentMethod === 'BANK_TRANSFER' && (
            <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-2 animate-fadeIn">
              <label className="text-[11px] font-bold text-purple-900 block">
                Bank Deposit Slip / Reference Number
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. SLIP-99214 or Online Transfer Ref"
                className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Collection Lorry / Personnel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Collection Channel / Lorry
              </label>
              <select
                value={selectedLorryId}
                onChange={(e) => handleLorrySelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">🏢 Office Counter / Cash Desk</option>
                {lorries.map((l) => (
                  <option key={l.id} value={l.id}>
                    🚚 {l.vehicleNumber} ({l.driverName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Collected By
              </label>
              <input
                type="text"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                placeholder="e.g. Sunil Perera or Cashier"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Remarks / Settlement Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Settled outstanding for Bill #INV-102"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || numAmount <= 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
          >
            <Receipt className="w-4 h-4" />
            <span>{loading ? 'Recording Payment...' : 'Record Payment & Settle'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
