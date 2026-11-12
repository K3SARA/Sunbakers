import React, { useRef } from 'react';
import { X, Printer, CheckCircle2 } from 'lucide-react';
import { CustomerPayment, Customer } from '../types';
import samanthaLogo from '../assets/samantha-logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { printReceiptElement } from '../utils/printHelper';

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
    printReceiptElement(
      'printable-payment-receipt',
      '80mm',
      `Payment-Receipt-${payment.receiptNumber}`
    );
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
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body (Optimized for 80mm Thermal Receipt) */}
        <div className="p-4 overflow-y-auto bg-slate-50/50 print:bg-white print:p-0">
          <div
            id="printable-payment-receipt"
            ref={receiptRef}
            className="receipt-80mm w-full max-w-[360px] mx-auto bg-white p-3.5 sm:p-4 shadow-sm border border-slate-300 rounded-xl text-black font-mono text-[13px] leading-snug select-text font-bold print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0"
          >
            {/* Business Header */}
            <div className="text-center pb-2">
              <div className="flex justify-center mb-1.5">
                <img
                  src={samanthaLogo}
                  alt="Sun Bakers & Confectionary"
                  className="w-14 h-14 object-contain rounded-full border border-black/10 shadow-2xs"
                />
              </div>
              <h2 className="text-base font-black text-black uppercase tracking-tight leading-tight">
                Sunbakers & confectionary
              </h2>
              <p className="text-[11px] text-black font-semibold leading-tight mt-0.5">
                239,kurukutthala ,kadugannawa
              </p>
              <p className="text-[11px] text-black font-bold">
                Tel: +94 77 254 9414
              </p>
            </div>

            {/* Receipt Banner */}
            <div className="border-t-2 border-black my-1.5" />
            <div className="text-center font-black text-xs py-0.5 tracking-wider text-black">
              *** PAYMENT RECEIPT / CREDIT SETTLEMENT ***
            </div>
            <div className="border-t-2 border-black border-dashed my-1.5" />

            {/* Receipt & Date Meta */}
            <div className="space-y-0.5 text-xs text-black font-bold">
              <div className="flex justify-between font-black">
                <span>Receipt #: {payment.receiptNumber}</span>
                <span>{payment.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span>Date: {new Date(payment.createdAt).toLocaleDateString()}</span>
                <span>Time: {new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {payment.collectedBy && (
                <div>
                  <span className="font-black">Collected By:</span> {payment.collectedBy}
                </div>
              )}
            </div>

            {/* Customer Details */}
            <div className="border-t-2 border-black border-dashed my-1.5" />
            <div className="text-xs space-y-0.5 text-black font-bold">
              <div className="font-black text-xs">
                Customer: {cust?.name || 'Customer'} {cust?.code ? `[${cust.code}]` : ''}
              </div>
              {cust?.companyName && (
                <div>Shop: {cust.companyName}</div>
              )}
              {(cust?.deliveryAddress || cust?.city) && (
                <div>Addr: {cust.deliveryAddress || cust.city}</div>
              )}
              {cust?.phone && (
                <div className="font-black">Tel: {cust.phone}</div>
              )}
            </div>

            {/* Amount Paid Box */}
            <div className="border-t-2 border-black my-2" />
            <div className="text-center py-2 border border-black rounded-lg bg-slate-50/50 space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider block text-black">
                AMOUNT RECEIVED / SETTLED
              </span>
              <span className="text-xl sm:text-2xl font-black text-black font-mono">
                {formatMoney(payment.amount)}
              </span>
              <div className="text-[11px] font-black text-black">
                PAYMENT STATUS: PAID & ACKNOWLEDGED
              </div>
            </div>
            <div className="border-t-2 border-black my-2" />

            {/* Cheque / Reference Details */}
            {(payment.chequeNumber || payment.reference || payment.notes) && (
              <div className="space-y-1 text-xs text-black font-bold pb-1">
                {payment.chequeNumber && (
                  <div className="flex justify-between">
                    <span>Cheque No: {payment.chequeNumber}</span>
                    <span>{payment.bankName ? `(${payment.bankName})` : ''}</span>
                  </div>
                )}
                {payment.chequeDate && (
                  <div className="flex justify-between">
                    <span>Cheque Date:</span>
                    <span>{new Date(payment.chequeDate).toLocaleDateString()}</span>
                  </div>
                )}
                {payment.reference && (
                  <div className="flex justify-between">
                    <span>Reference / Slip:</span>
                    <span>{payment.reference}</span>
                  </div>
                )}
                {payment.notes && (
                  <div>
                    <span className="font-black">Remarks:</span> {payment.notes}
                  </div>
                )}
                <div className="border-t border-black border-dashed my-1" />
              </div>
            )}

            {/* Remaining Balance if available */}
            {cust?.outstandingBalance !== undefined && (
              <div className="flex justify-between items-center text-xs font-black text-black py-1">
                <span>Remaining Account Balance:</span>
                <span className="font-mono">{formatMoney(cust.outstandingBalance)}</span>
              </div>
            )}

            {/* Policy & Acknowledgement */}
            <div className="border-t-2 border-black border-dashed my-1.5" />
            <div className="text-center text-xs space-y-0.5 font-bold text-black py-0.5">
              <p>Payment received with thanks.</p>
              <p className="font-black text-[11px]">Official System Generated Receipt</p>
            </div>

            {/* Signatures */}
            <div className="mt-3 pt-2 border-t-2 border-black border-dashed text-xs space-y-2 font-bold text-black mb-0 pb-0">
              <div className="flex justify-between items-end gap-2">
                <div>
                  <p className="font-black mb-2">Collected By:</p>
                  <div className="border-b-2 border-black w-28"></div>
                  <p className="mt-0.5 text-[10px] font-black">{payment.collectedBy || 'Rep Sign'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black mb-2">Received By:</p>
                  <div className="border-b-2 border-black w-28 ml-auto"></div>
                  <p className="mt-0.5 text-[10px] font-black">Shop Stamp / Sign</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print 80mm Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
