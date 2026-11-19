import React from 'react';
import { Printer, X, Truck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { LorryTransfer } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface InterLorryTransferPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: LorryTransfer | null;
}

export const InterLorryTransferPrintModal: React.FC<InterLorryTransferPrintModalProps> = ({
  isOpen,
  onClose,
  transfer
}) => {
  const { formatMoney } = useCurrency();

  if (!isOpen || !transfer) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalPaidUnits = transfer.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalFreeUnits = transfer.items.reduce((sum, item) => sum + (item.freeQuantity || 0), 0);
  const grandTotalUnits = totalPaidUnits + totalFreeUnits;

  const formattedDate = new Date(transfer.createdAt).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:max-w-none print:w-full print:rounded-none">
        
        {/* Header - Screen Only */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Inter-Lorry Transfer Voucher</h3>
              <p className="text-xs text-slate-500">Official on-route vehicle stock handover slip</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Transfer Slip Document */}
        <div className="p-6 sm:p-8 print:p-6 print:text-black">
          {/* Header & Logo */}
          <div className="text-center border-b-2 border-dashed border-slate-300 pb-5 mb-5">
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              DISTRIBUTOR FLEET CONSOLE
            </h1>
            <p className="text-xs text-slate-600 font-medium">Authorized On-Route Stock Transfer Gate Pass</p>
            
            <div className="mt-3 inline-block px-3 py-1 bg-indigo-50 print:bg-slate-100 border border-indigo-200 print:border-slate-300 rounded-lg">
              <span className="text-xs font-mono font-bold text-indigo-900 print:text-black tracking-wider">
                VOUCHER #{transfer.transferNumber}
              </span>
            </div>

            {transfer.paperSlipNumber && (
              <div className="mt-1 text-xs text-slate-600 font-mono font-semibold">
                Driver Physical Note: <span className="text-slate-900 font-bold">{transfer.paperSlipNumber}</span>
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{formattedDate}</div>
          </div>

          {/* Handover Route Info */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 print:bg-white print:border print:border-slate-300 mb-5 text-xs">
            {/* Giving Lorry */}
            <div className="space-y-1 border-r border-slate-200 print:border-slate-300 pr-3">
              <span className="font-bold text-amber-700 uppercase tracking-wider block text-[10px]">
                Handed Over From (Source)
              </span>
              <div className="font-mono font-black text-sm text-slate-900">
                {transfer.fromLorry?.vehicleNumber}
              </div>
              <div className="text-slate-600 font-medium">
                Driver: <span className="text-slate-900">{transfer.fromLorry?.driverName}</span>
              </div>
              {transfer.fromLorry?.route && (
                <div className="text-slate-500 text-[11px]">
                  Route: {transfer.fromLorry.route.name}
                </div>
              )}
            </div>

            {/* Receiving Lorry */}
            <div className="space-y-1 pl-2">
              <span className="font-bold text-emerald-700 uppercase tracking-wider block text-[10px]">
                Received By (Destination)
              </span>
              <div className="font-mono font-black text-sm text-slate-900">
                {transfer.toLorry?.vehicleNumber}
              </div>
              <div className="text-slate-600 font-medium">
                Driver: <span className="text-slate-900">{transfer.toLorry?.driverName}</span>
              </div>
              {transfer.toLorry?.route && (
                <div className="text-slate-500 text-[11px]">
                  Route: {transfer.toLorry.route.name}
                </div>
              )}
            </div>
          </div>

          {/* Product Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Product Description</th>
                  <th className="py-2 px-3 text-right">Paid Units</th>
                  <th className="py-2 px-3 text-right">Free Promo</th>
                  <th className="py-2 px-3 text-right font-black">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {transfer.items.map((item, idx) => {
                  const lineTotal = (item.quantity || 0) + (item.freeQuantity || 0);
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-sans font-medium text-slate-900">
                        {item.product?.name || 'Product Item'}
                        {item.product?.sku && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            SKU: {item.product.sku}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-800">
                        {item.quantity || 0}
                      </td>
                      <td className="py-2 px-3 text-right text-indigo-700 font-semibold">
                        {item.freeQuantity ? `+${item.freeQuantity}` : '0'}
                      </td>
                      <td className="py-2 px-3 text-right font-black text-slate-900">
                        {lineTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-900">
                <tr>
                  <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px]">
                    Total Units Transferred
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black">
                    {totalPaidUnits}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-700">
                    +{totalFreeUnits}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-sm text-slate-900">
                    {grandTotalUnits}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="p-3 bg-amber-50/60 print:bg-white border border-amber-200/80 print:border-slate-300 rounded-xl mb-6 text-xs text-slate-700">
              <span className="font-bold text-amber-900 uppercase tracking-wider block text-[10px]">
                Handover Notes / Junction Location:
              </span>
              <p className="mt-0.5">{transfer.notes}</p>
            </div>
          )}

          {/* Physical Signatures Section */}
          <div className="grid grid-cols-3 gap-3 pt-6 border-t-2 border-dashed border-slate-300 text-center text-xs text-slate-600">
            <div>
              <div className="h-10 border-b border-slate-400 mb-1.5" />
              <span className="font-bold text-slate-900 block">Driver A (Handed Over)</span>
              <span className="text-[10px] text-slate-500">{transfer.fromLorry?.driverName}</span>
            </div>

            <div>
              <div className="h-10 border-b border-slate-400 mb-1.5" />
              <span className="font-bold text-slate-900 block">Driver B (Received)</span>
              <span className="text-[10px] text-slate-500">{transfer.toLorry?.driverName}</span>
            </div>

            <div>
              <div className="h-10 border-b border-slate-400 mb-1.5" />
              <span className="font-bold text-slate-900 block">Office Authorization</span>
              <span className="text-[10px] text-slate-500">
                {transfer.transferredBy || 'Admin Approved'}
              </span>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-slate-400 font-mono print:text-slate-600">
            Both drivers must verify physical count prior to signing. Retain copy for evening warehouse stock settlement.
          </div>
        </div>

        {/* Footer Actions - Screen Only */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Slip (80mm / A4)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
