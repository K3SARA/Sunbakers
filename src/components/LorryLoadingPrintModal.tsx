import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Bluetooth,
  FileText,
  Check,
  Loader2,
  Smartphone,
  Truck,
  Calendar,
  Compass,
  User,
  CheckCircle2,
  Boxes
} from 'lucide-react';
import { LorryLoading, SystemSettings } from '../types';
import samanthaLogo from '../assets/samantha-logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { SettingsService } from '../services/api';
import { printLorryLoadingToBluetooth } from '../utils/bluetoothPrinter';

interface LorryLoadingPrintModalProps {
  loading: LorryLoading | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: '80mm' | 'a4';
}

export const LorryLoadingPrintModal: React.FC<LorryLoadingPrintModalProps> = ({
  loading,
  isOpen,
  onClose,
  defaultFormat = '80mm'
}) => {
  const { formatMoney } = useCurrency();
  const [companySettings, setCompanySettings] = useState<SystemSettings | null>(null);
  const [format, setFormat] = useState<'80mm' | 'a4'>(defaultFormat);
  const [btStatus, setBtStatus] = useState<string | null>(null);
  const [btLoading, setBtLoading] = useState<boolean>(false);
  const [btSuccess, setBtSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && loading) {
      SettingsService.get()
        .then((s) => setCompanySettings(s))
        .catch(() => {});
    }
  }, [isOpen, loading]);

  if (!isOpen || !loading) return null;

  // Calculate totals
  const totalRegularUnits = loading.items.reduce((sum, item) => sum + (item.loadedQty || 0), 0);
  const totalFreeUnits = loading.items.reduce((sum, item) => sum + (item.loadedFreeQty || 0), 0);
  const grandTotalUnits = totalRegularUnits + totalFreeUnits;
  const totalEstimatedValue = loading.items.reduce((sum, item) => {
    const price = item.product?.unitPrice || 0;
    return sum + (item.loadedQty || 0) * price;
  }, 0);

  const loadDate = new Date(loading.date || loading.createdAt || new Date());
  const dateFormatted = loadDate.toLocaleDateString();
  const timeFormatted = loadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleSystemPrint = () => {
    const styleId = 'print-page-size-style';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    if (format === '80mm') {
      styleTag.innerHTML = `
        @page {
          size: 80mm auto !important;
          margin: 0mm !important;
        }
        #printable-loading-sheet {
          max-width: 80mm !important;
          width: 80mm !important;
        }
      `;
    } else {
      styleTag.innerHTML = `
        @page {
          size: A4 portrait !important;
          margin: 8mm !important;
        }
        html, body {
          width: 100% !important;
          max-width: 100% !important;
        }
        #printable-loading-sheet {
          max-width: 100% !important;
          width: 100% !important;
        }
      `;
    }
    window.print();
  };

  const handleBluetoothPrint = async () => {
    if (!loading) return;
    setBtLoading(true);
    setBtStatus('Connecting Bluetooth printer...');
    setBtSuccess(false);

    try {
      const result = await printLorryLoadingToBluetooth(
        loading,
        companySettings,
        (status) => setBtStatus(status)
      );

      if (result.success) {
        setBtSuccess(true);
        setTimeout(() => {
          setBtStatus(null);
          setBtLoading(false);
          setBtSuccess(false);
        }, 3500);
      } else {
        setBtLoading(false);
        setTimeout(() => setBtStatus(null), 4000);
      }
    } catch (err: any) {
      setBtLoading(false);
      setBtStatus(err?.message || 'Bluetooth printing failed');
      setTimeout(() => setBtStatus(null), 4000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:block print:h-auto print:min-h-0 print:overflow-visible print:shadow-none"
      style={{ zIndex: 100 }}
    >
      <div
        className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[95vh] transition-all duration-200 print:max-w-none print:w-full print:rounded-none print:shadow-none print:border-none print:p-0 print:m-0 print:max-h-none print:overflow-visible print:block ${
          format === '80mm' ? 'max-w-md' : 'max-w-3xl'
        }`}
      >
        {/* Modal Controls Toolbar (Hidden in print) */}
        <div className="px-3 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/90 print:hidden shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Format Switcher */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat('80mm')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                  format === '80mm'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="80mm Thermal Receipt (Mobile / Bluetooth POS)"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>80mm Thermal</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${
                  format === 'a4'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Full A4 Dispatch Sheet"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>A4 Sheet</span>
              </button>
            </div>

            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 hidden sm:inline">
              {loading.loadingNumber}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Direct Bluetooth Print button */}
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btLoading}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-60 cursor-pointer"
              title="Connect & Print directly to any Bluetooth thermal printer"
            >
              {btLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : btSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {btLoading ? 'Printing...' : btSuccess ? 'Printed!' : 'Bluetooth'}
              </span>
            </button>

            {/* Standard System Print Button */}
            <button
              type="button"
              onClick={handleSystemPrint}
              className="px-3 sm:px-3.5 py-1.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Print via System Print Spooler (ESC/POS or Laser)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {format === '80mm' ? '80mm' : 'A4'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Bluetooth Status Banner */}
        {btStatus && (
          <div
            className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-b print:hidden transition-all ${
              btSuccess
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
            }`}
          >
            {btLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-indigo-600" />}
            {btSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
            <span>{btStatus}</span>
          </div>
        )}

        {/* Printable Content Body */}
        <div className="overflow-y-auto flex-1 p-3 sm:p-6 print:p-0 print:overflow-visible">
          {format === '80mm' ? (
            /* ==================== 80mm THERMAL RECEIPT LAYOUT ==================== */
            <div id="printable-loading-sheet" className="receipt-80mm">
              {/* Header */}
              <div className="text-center pb-2">
                <img
                  src={samanthaLogo}
                  alt="Sunbakers"
                  className="w-12 h-12 object-contain mx-auto mb-1 rounded-full border border-black/10"
                />
                <h2 className="text-base font-black tracking-wider uppercase text-black leading-tight">
                  {companySettings?.companyName || 'Sunbakers & confectionary'}
                </h2>
                <p className="text-[11.5px] text-black font-semibold leading-tight">
                  {companySettings?.address || '239,kurukutthala ,kadugannawa'}
                </p>
                <p className="text-[11.5px] text-black font-bold">
                  Tel: {companySettings?.phone || '+94 77 254 9414'}
                </p>
              </div>

              {/* Title */}
              <div className="border-t-2 border-black my-1.5" />
              <div className="text-center font-black text-xs py-0.5 tracking-wider">
                *** MORNING LORRY LOAD SHEET ***
              </div>
              <div className="text-center font-bold text-[10.5px] text-black">
                GATE PASS & DISPATCH NOTE
              </div>
              <div className="border-t border-black border-dashed my-1.5" />

              {/* Meta */}
              <div className="space-y-0.5 text-[11.5px]">
                <div className="flex justify-between font-bold">
                  <span>Gate Pass #: {loading.loadingNumber}</span>
                  <span>{loading.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date: {dateFormatted}</span>
                  <span>Time: {timeFormatted}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Lorry: {loading.lorry?.vehicleNumber}</span>
                  <span>Driver: {loading.lorry?.driverName}</span>
                </div>
                {loading.lorry?.route?.name && (
                  <div>
                    <span className="font-semibold">Route:</span> {loading.lorry.route.name}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border-t-2 border-black my-1.5" />
              <div className="flex justify-between font-black text-xs pb-1">
                <span>ITEM DESCRIPTION</span>
                <span>LOADED [FREE]</span>
              </div>
              <div className="border-t border-black border-dashed mb-1.5" />

              <div className="space-y-2">
                {loading.items.map((item, idx) => {
                  const reg = item.loadedQty || 0;
                  const free = item.loadedFreeQty || 0;
                  const price = item.product?.unitPrice || 0;
                  const lineTotal = reg * price;

                  return (
                    <div key={item.id || idx} className="text-[12px] leading-tight">
                      <div className="font-bold text-black flex justify-between">
                        <span>{idx + 1}. {item.product?.name}</span>
                        <span className="font-mono text-black font-bold">
                          {reg} {item.product?.unit || 'u'}
                          {free > 0 && <span className="font-bold"> (+{free}F)</span>}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-black font-mono pl-3">
                        <span>SKU: {item.product?.sku || '—'} @ {formatMoney(price)}</span>
                        <span className="font-semibold">{formatMoney(lineTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals Section */}
              <div className="border-t-2 border-black my-2" />
              <div className="space-y-1 text-[12px] font-bold">
                <div className="flex justify-between">
                  <span>Regular Paid Units:</span>
                  <span className="font-mono">{totalRegularUnits} units</span>
                </div>
                {totalFreeUnits > 0 && (
                  <div className="flex justify-between">
                    <span>Free Issue Units:</span>
                    <span className="font-mono">+{totalFreeUnits} free</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-black border-dashed pt-1 font-black text-xs">
                  <span>GRAND TOTAL UNITS:</span>
                  <span className="font-mono text-[13px]">{grandTotalUnits} units</span>
                </div>
                <div className="flex justify-between border-t border-black pt-1 font-black text-xs">
                  <span>ESTIMATED LOAD VALUE:</span>
                  <span className="font-mono text-[13px]">{formatMoney(totalEstimatedValue)}</span>
                </div>
              </div>
              <div className="border-t-2 border-black my-2" />

              {/* Notes */}
              {loading.notes && (
                <div className="text-[11px] py-1 border-b border-black border-dashed">
                  <span className="font-bold">Notes: </span>
                  <span>{loading.notes}</span>
                </div>
              )}

              {/* Handover & Signatures */}
              <div className="pt-3 pb-1 text-[11px] space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="w-28 border-b border-black" />
                    <span className="font-bold block mt-0.5">Dispatched By</span>
                    <span className="text-[10px] text-black">Warehouse Keeper</span>
                  </div>
                  <div className="text-right">
                    <div className="w-28 border-b border-black ml-auto" />
                    <span className="font-bold block mt-0.5">Received By</span>
                    <span className="text-[10px] text-black">{loading.lorry?.driverName || 'Driver / Rep'}</span>
                  </div>
                </div>
              </div>

              {/* Footer Notice */}
              <div className="text-center pt-2 text-[10px] font-semibold text-black border-t border-black border-dashed mt-2">
                <div>*** VERIFIED FOR MORNING ROUTE ***</div>
                <div>Sunbakers Distribution Management</div>
              </div>
            </div>
          ) : (
            /* ==================== FULL A4 DISPATCH SHEET LAYOUT ==================== */
            <div id="printable-loading-sheet" className="p-4 sm:p-6 bg-white text-slate-900 space-y-5">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-4 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800">
                      GATE PASS / DISPATCH NOTE
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">
                      #{loading.loadingNumber}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    Morning Lorry Loading Sheet
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Date: <strong className="text-slate-800">{dateFormatted}</strong> • Time: <strong className="text-slate-800">{timeFormatted}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:text-right">
                  <img
                    src={samanthaLogo}
                    alt="Sunbakers"
                    className="w-14 h-14 object-contain rounded-full border border-slate-200 shadow-2xs shrink-0"
                  />
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-900 uppercase">
                      {companySettings?.companyName || 'Sunbakers & confectionary'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {companySettings?.address || '239,kurukutthala ,kadugannawa'}
                    </p>
                    <p className="text-xs font-mono text-slate-600">
                      Tel: {companySettings?.phone || '+94 77 254 9414'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dispatch Meta Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                    <Truck className="w-3 h-3 text-blue-600" /> Vehicle Assigned
                  </span>
                  <p className="font-bold text-sm text-slate-900">{loading.lorry?.vehicleNumber}</p>
                  <p className="text-slate-500 text-[11px]">Delivery Fleet Lorry</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                    <User className="w-3 h-3 text-emerald-600" /> Driver / Sales Rep
                  </span>
                  <p className="font-bold text-sm text-slate-900">{loading.lorry?.driverName}</p>
                  <p className="text-slate-500 font-mono text-[11px]">Tel: {loading.lorry?.driverPhone || '—'}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5 flex items-center gap-1">
                    <Compass className="w-3 h-3 text-indigo-600" /> Route & Status
                  </span>
                  <p className="font-bold text-sm text-slate-900">{loading.lorry?.route?.name || 'Local Route'}</p>
                  <p className="text-emerald-700 font-bold text-[11px] uppercase">● Status: {loading.status}</p>
                </div>
              </div>

              {/* Loaded Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3 w-8">#</th>
                      <th className="py-2.5 px-3">Product Name & SKU</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-center">Regular Qty</th>
                      <th className="py-2.5 px-3 text-center">Free Issue</th>
                      <th className="py-2.5 px-3 text-center">Total Units</th>
                      <th className="py-2.5 px-3 text-right">Est. Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading.items.map((item, idx) => {
                      const reg = item.loadedQty || 0;
                      const free = item.loadedFreeQty || 0;
                      const price = item.product?.unitPrice || 0;
                      const lineTotal = reg * price;

                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{item.product?.name}</span>
                            <span className="font-mono text-[10px] text-slate-400">{item.product?.sku}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                            {formatMoney(price)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                            {reg} {item.product?.unit || 'u'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700">
                            {free > 0 ? `+${free}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-blue-700 bg-blue-50/40">
                            {reg + free}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatMoney(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Dispatch Notes / Instructions:
                  </span>
                  <p className="text-slate-700 italic">
                    {loading.notes || 'Goods dispatched in good condition for daily sales route.'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>Regular Loaded Units:</span>
                    <span className="font-mono font-bold text-slate-900">{totalRegularUnits} units</span>
                  </div>
                  {totalFreeUnits > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Free Promotional Stock:</span>
                      <span className="font-mono font-bold">+{totalFreeUnits} units</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-200 pt-1.5">
                    <span>Grand Total Loaded Units:</span>
                    <span className="font-mono text-blue-700">{grandTotalUnits} units</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-black text-sm border-t border-slate-200 pt-1.5">
                    <span>Estimated Stock Value:</span>
                    <span className="font-mono text-emerald-700 text-base">{formatMoney(totalEstimatedValue)}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="border-b border-slate-300 pb-8" />
                  <span className="font-bold text-slate-800 block mt-1.5">Dispatched By</span>
                  <span className="text-[11px] text-slate-400">Warehouse Dispatcher</span>
                </div>

                <div>
                  <div className="border-b border-slate-300 pb-8" />
                  <span className="font-bold text-slate-800 block mt-1.5">Received By</span>
                  <span className="text-[11px] text-slate-400">{loading.lorry?.driverName || 'Driver / Sales Rep'}</span>
                </div>

                <div>
                  <div className="border-b border-slate-300 pb-8" />
                  <span className="font-bold text-slate-800 block mt-1.5">Authorized By</span>
                  <span className="text-[11px] text-slate-400">Gate Security / Supervisor</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
