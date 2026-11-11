import React, { useRef } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { CustomerPayment, Customer } from '../types';
import samanthaLogo from '../assets/samantha-logo.png';
import { useCurrency } from '../context/CurrencyContext';

interface CustomerReceiptModalProps {
  payment: CustomerPayment | null;
  customer?: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerReceiptModal: React.FC<CustomerReceiptModalProps> = ({
  payment,
  customer,
  isOpen,
  onClose
}) => {
  const { formatMoney } = useCurrency();
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !payment) return null;

  const handlePrint = () => {
    window.print();
  };

  const cust = customer || payment.customer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 print:hidden">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Official Payment Receipt</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div ref={receiptRef} className="p-6 space-y-5 overflow-y-auto print:p-0">
          {/* Business Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-200">
            <div className="flex justify-center mb-1.5">
              <img
                src={samanthaLogo}
                alt="Sun Bakers & Confectionary"
                className="w-14 h-14 object-contain rounded-full border border-slate-100 shadow-2xs"
              />
            </div>
            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
              Sunbakers & confectionary
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              239,kurukutthala ,kadugannawa • Tel: +94 77 254 9414
            </p>
            <div className="mt-2 inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-mono font-bold text-xs rounded-full border border-emerald-200/60">
              Receipt: {payment.receiptNumber}
            </div>
          </div>

          {/* Amount Hero */}
          <div className="text-center py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Amount Received
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono">
              {formatMoney(payment.amount)}
            </span>
            <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 font-semibold">
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                {payment.paymentMethod}
              </span>
              <span>• PAID & SETTLED</span>
            </div>
          </div>

          {/* Customer & Payment Meta Details */}
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Customer / Client:</span>
              <span className="font-bold text-slate-900 text-right">
                {cust?.name || 'Customer'}
                {cust?.code ? ` (${cust.code})` : ''}
              </span>
            </div>

            {cust?.companyName && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Company / Store:</span>
                <span className="font-semibold text-slate-700 text-right">{cust.companyName}</span>
              </div>
            )}

            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-400 font-medium">Date & Time:</span>
              <span className="font-medium text-slate-800">
                {new Date(payment.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>

            {payment.chequeNumber && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Cheque Number:</span>
                <span className="font-mono font-bold text-blue-700">
                  {payment.chequeNumber} {payment.bankName ? `(${payment.bankName})` : ''}
                </span>
              </div>
            )}

            {payment.reference && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Reference Slip:</span>
                <span className="font-mono font-bold text-purple-700">{payment.reference}</span>
              </div>
            )}

            {payment.collectedBy && (
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium">Collected By:</span>
                <span className="font-semibold text-slate-800">{payment.collectedBy}</span>
              </div>
            )}

            {payment.notes && (
              <div className="py-1.5 border-b border-slate-100">
                <span className="text-slate-400 font-medium block mb-0.5">Remarks:</span>
                <span className="text-slate-700 italic">{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Footer acknowledgement */}
          <div className="pt-4 text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200">
            <p>Thank you for your business & prompt settlement.</p>
            <p className="font-mono mt-0.5">Authorized System Generated Voucher</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
