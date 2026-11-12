import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Bluetooth,
  FileText,
  Check,
  Loader2,
  Smartphone
} from 'lucide-react';
import { Order, SystemSettings } from '../types';
import samanthaLogo from '../assets/samantha-logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { SettingsService } from '../services/api';
import {
  printToBluetoothThermalPrinter
} from '../utils/bluetoothPrinter';
import { printReceiptElement } from '../utils/printHelper';

interface InvoiceModalProps {
  order: Order | null;
  onClose: () => void;
  defaultFormat?: '80mm' | 'a4';
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  order,
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
    if (order) {
      SettingsService.get()
        .then((s) => setCompanySettings(s))
        .catch(() => { });
    }
  }, [order]);

  if (!order) return null;

  const handleSystemPrint = () => {
    printReceiptElement(
      'printable-invoice',
      format,
      `Bill-${order.paperBillNumber || order.orderNumber}`
    );
  };

  const handleBluetoothPrint = async () => {
    if (!order) return;
    setBtLoading(true);
    setBtStatus('Initializing Bluetooth...');
    setBtSuccess(false);

    try {
      const result = await printToBluetoothThermalPrinter(
        order,
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
        // If device was not selected or not supported, keep message for 4s
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
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:block print:h-auto print:min-h-0 print:overflow-visible print:shadow-none"
      style={{ zIndex: 100 }}
    >
      <div className={`bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[95vh] transition-all duration-200 print:max-w-none print:w-full print:rounded-none print:shadow-none print:border-none print:p-0 print:m-0 print:max-h-none print:overflow-visible print:block ${format === '80mm' ? 'max-w-md' : 'max-w-2xl'
        }`}>
        {/* Modal Controls Toolbar */}
        <div className="px-3 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/80 print:hidden shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Format Switcher */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFormat('80mm')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${format === '80mm'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
                title="80mm Thermal Receipt (Mobile / Bluetooth)"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                <span>80mm Thermal</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('a4')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition ${format === 'a4'
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
                title="Full A4 / Slip"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>A4 Slip</span>
              </button>
            </div>

            {order.paperBillNumber && (
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 hidden sm:inline">
                Slip: {order.paperBillNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Direct Bluetooth Print button */}
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btLoading}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-60 cursor-pointer"
              title="Connect & Print directly to any Bluetooth thermal printer (ESC/POS)"
            >
              {btLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : btSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-300" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {btLoading ? 'Printing...' : btSuccess ? 'Printed!' : 'Bluetooth Print'}
              </span>
            </button>

            {/* Standard System Print Button */}
            <button
              type="button"
              onClick={handleSystemPrint}
              className="px-3 sm:px-3.5 py-1.5 bg-[#0071E3] hover:bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title="Print via System Print Spooler (Supports all Bluetooth / USB printers)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {format === '80mm' ? '80mm' : 'Bill'}</span>
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

        {/* Live Bluetooth Status Banner (if active) */}
        {btStatus && (
          <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-b print:hidden transition-all ${btSuccess
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : btStatus.includes('failed') || btStatus.includes('not supported') || btStatus.includes('cancelled')
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200 animate-pulse'
            }`}>
            {btSuccess ? (
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Bluetooth className="w-4 h-4 text-indigo-600 shrink-0" />
            )}
            <span className="truncate">{btStatus}</span>
          </div>
        )}

        {/* Printable Delivery Note & Invoice Body */}
        <div id="printable-invoice" className="overflow-y-auto bg-slate-100/50 p-2 sm:p-4 print:bg-white print:p-0 print:m-0 print:overflow-visible print:max-h-none print:h-auto print:w-full print:border-none print:shadow-none">
          {format === '80mm' ? (
            /* ========================================================
               80MM THERMAL RECEIPT LAYOUT (OPTIMIZED FOR BLUETOOTH PRINTERS)
               ======================================================== */
            <div className="receipt-80mm w-full max-w-[360px] mx-auto bg-white p-3.5 sm:p-4 shadow-sm border border-slate-300 rounded-xl text-black font-mono text-[13.5px] sm:text-[14px] leading-snug select-text print:max-w-none print:w-full print:border-none print:shadow-none print:rounded-none print:p-0 print:m-0 print:bg-white font-bold">
              {/* Receipt Logo & Header */}
              <div className="text-center space-y-1 pb-2">
                {/* Sunbakers & Confectionary Logo */}
                <div className="flex justify-center mb-1.5">
                  <img
                    src={samanthaLogo}
                    alt="Sun Bakers & Confectionary"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-contain mx-auto rounded-full border border-slate-300 shadow-2xs print:border-none"
                  />
                </div>

                <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-black leading-tight">
                  {companySettings?.companyName || 'Sunbakers & confectionary'}
                </h2>

                <p className="text-xs sm:text-[13px] text-black font-bold leading-tight">
                  {companySettings?.address || '239,kurukutthala ,kadugannawa'}
                </p>
                <p className="text-xs sm:text-[13px] text-black font-black">
                  Tel: {companySettings?.phone || '+94 77 254 9414'}
                </p>
                {companySettings?.registrationNumber && (
                  <p className="text-xs text-black font-bold">Reg/VAT: {companySettings.registrationNumber}</p>
                )}
              </div>

              {/* Header Double Divider */}
              <div className="border-t-2 border-black my-1.5" />
              <div className="text-center font-black text-xs sm:text-[13.5px] py-0.5 tracking-wider text-black">
                *** SALES BILL / DELIVERY SLIP ***
              </div>
              <div className="border-t-2 border-black border-dashed my-1.5" />

              {/* Bill Details */}
              <div className="space-y-0.5 text-xs sm:text-[13px] text-black font-bold">
                <div className="flex justify-between">
                  <span>Date: {new Date(order.createdAt).toLocaleDateString()}</span>
                  <span>Time: {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between font-black text-black">
                  <span>Bill #: {order.paperBillNumber || order.orderNumber}</span>
                  <span>Ref: {order.orderNumber}</span>
                </div>
                {order.lorry && (
                  <div>
                    <span className="font-black">Lorry:</span> {order.lorry.vehicleNumber} ({order.lorry.driverName})
                  </div>
                )}
                {(order.route?.name || order.lorry?.route?.name) && (
                  <div>
                    <span className="font-black">Route:</span> {order.route?.name || order.lorry?.route?.name}
                  </div>
                )}
              </div>

              {/* Customer Box */}
              <div className="border-t-2 border-black border-dashed my-1.5" />
              <div className="text-xs sm:text-[13px] space-y-0.5 text-black font-bold">
                <div className="font-black text-xs sm:text-[13.5px]">
                  Customer: {order.customer.name} [{order.customer.code}]
                </div>
                {order.customer.companyName && (
                  <div>Shop: {order.customer.companyName}</div>
                )}
                {(order.customer.deliveryAddress || order.customer.city) && (
                  <div>Addr: {order.customer.deliveryAddress || order.customer.city}</div>
                )}
                {order.customer.phone && (
                  <div className="font-black">Tel: {order.customer.phone}</div>
                )}
              </div>

              {/* Items Table (2-line 80mm format: Item name line 1, Qty x Price & Total line 2) */}
              <div className="border-t-2 border-black my-1.5" />
              <div className="flex justify-between font-black text-xs sm:text-[13px] pb-1 text-black">
                <span>ITEM DESCRIPTION</span>
                <span>TOTAL</span>
              </div>
              <div className="border-t-2 border-black border-dashed mb-1.5" />

              <div className="space-y-2 text-xs sm:text-[13px] text-black">
                {order.items.map((item) => (
                  <div key={item.id} className="leading-tight">
                    <div className="font-black text-xs sm:text-[13.5px] break-words text-black">{item.product.name}</div>
                    <div className="flex justify-between pl-1 font-bold text-black">
                      <span>
                        {item.quantity} {item.product.unit || 'pcs'} x {formatMoney(item.unitPrice)}
                        {item.product && item.unitPrice < item.product.unitPrice && (
                          <span className="text-[11px] font-black"> (Disc: was {formatMoney(item.product.unitPrice)})</span>
                        )}
                      </span>
                      <span className="font-black text-black">{formatMoney(item.lineTotal)}</span>
                    </div>
                    {item.freeQuantity > 0 && (
                      <div className="pl-1 font-black text-xs text-black">
                        &gt;&gt; FREE PROMO: +{item.freeQuantity} {item.product.unit || 'pcs'} (Rs. 0.00)
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Returned & Damaged Items (80mm) */}
              {order.returns && order.returns.length > 0 && (
                <>
                  <div className="border-t-2 border-black border-dashed my-1.5" />
                  <div className="flex justify-between font-black text-xs sm:text-[13px] pb-1 text-black">
                    <span>RETURNED / DAMAGED ITEMS</span>
                    <span>DEDUCT</span>
                  </div>
                  <div className="border-t-2 border-black border-dashed mb-1.5" />
                  <div className="space-y-1.5 text-xs sm:text-[13px] text-black">
                    {order.returns.map((ret) => (
                      <div key={ret.id} className="leading-tight">
                        <div className="font-black break-words text-black">
                          [{ret.returnType === 'DAMAGE' ? 'DMG' : 'RET'}] {ret.product?.name || 'Product'}
                        </div>
                        <div className="flex justify-between pl-1 font-bold text-black">
                          <span>
                            {ret.quantity} {ret.product?.unit || 'pcs'} x {formatMoney(ret.unitPrice)}
                            {ret.reason ? ` (${ret.reason})` : ''}
                          </span>
                          <span className="font-black text-black">-{formatMoney(ret.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Totals Section */}
              <div className="border-t-2 border-black border-dashed my-1.5" />
              <div className="space-y-1 text-xs sm:text-[13px] text-black font-bold">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-black">{formatMoney(order.subtotal)}</span>
                </div>

                {order.items.some((i) => (i.freeQuantity || 0) > 0) && (
                  <div className="flex justify-between font-black">
                    <span>Promotional Units:</span>
                    <span>
                      {order.items.reduce((acc, i) => acc + (i.freeQuantity || 0), 0)} Free pcs
                    </span>
                  </div>
                )}

                {order.discountAmount > 0 && (
                  <div className="flex justify-between font-black">
                    <span>Discount:</span>
                    <span>-{formatMoney(order.discountAmount)}</span>
                  </div>
                )}

                {order.returnAmount !== undefined && order.returnAmount > 0 && (
                  <div className="flex justify-between font-black">
                    <span>Returns / Damages:</span>
                    <span>-{formatMoney(order.returnAmount)}</span>
                  </div>
                )}

                <div className="border-t-2 border-black my-1.5" />
                <div className="flex justify-between text-base sm:text-lg font-black py-0.5 text-black">
                  <span>NET TOTAL:</span>
                  <span>{formatMoney(order.netTotal)}</span>
                </div>
                <div className="border-t-2 border-black my-1.5" />

                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-black">{order.paymentMethod || 'CASH'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="font-black">{formatMoney(order.cashReceived || 0)}</span>
                </div>

                {order.netTotal - (order.cashReceived || 0) > 0 && (
                  <div className="flex justify-between font-black">
                    <span>Credit Balance Due:</span>
                    <span>{formatMoney(order.netTotal - (order.cashReceived || 0))}</span>
                  </div>
                )}

                {(order.cashReceived || 0) > order.netTotal && (
                  <div className="flex justify-between font-black">
                    <span>Change Returned:</span>
                    <span>{formatMoney((order.cashReceived || 0) - order.netTotal)}</span>
                  </div>
                )}
              </div>

              {order.notes && (
                <>
                  <div className="border-t-2 border-black border-dashed my-1.5" />
                  <div className="text-xs sm:text-[13px] text-black">
                    <span className="font-black">Notes:</span> {order.notes}
                  </div>
                </>
              )}

              {/* Policy & Terms */}
              <div className="border-t-2 border-black border-dashed my-2" />
              <div className="text-center text-xs sm:text-[12.5px] space-y-0.5 font-bold text-black">
                {companySettings?.invoiceFooterNote ? (
                  <p>{companySettings.invoiceFooterNote}</p>
                ) : (
                  <>
                    <p>Goods received in satisfactory condition.</p>
                    <p className="font-black">Thank you for your business!</p>
                  </>
                )}
              </div>

              {/* Tear-off Signatures */}
              <div className="mt-4 pt-2 border-t-2 border-black border-dashed text-xs sm:text-[13px] space-y-3 font-bold text-black">
                <div className="flex justify-between items-end gap-2">
                  <div>
                    <p className="font-black mb-3">Delivered By:</p>
                    <div className="border-b-2 border-black w-28"></div>
                    <p className="mt-0.5 text-[10px] font-black">{order.lorry?.driverName || 'Driver Sign'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black mb-3">Received By:</p>
                    <div className="border-b-2 border-black w-28 ml-auto"></div>
                    <p className="mt-0.5 text-[10px] font-black">Shop Stamp / Sign</p>
                  </div>
                </div>
              </div>

              {/* Bottom Thermal Paper Margin (Hidden in print to avoid 2nd page feed) */}
              <div className="pt-2 text-center text-[8px] text-slate-400 print:hidden">
                - - - - - - - - - - - - - - - - - -
              </div>
            </div>
          ) : (
            /* ========================================================
               A4 / FULL SLIP LAYOUT (OFFICE / DESKTOP DISPATCH)
               ======================================================== */
            <div className="invoice-a4 bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-400 space-y-5 text-black">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b-2 border-black pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-black">
                    DISTRIBUTION SALES BILL
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold text-black mt-1">
                    <span>System Ref: {order.orderNumber}</span>
                    {order.paperBillNumber && (
                      <span className="text-black font-black bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">Paper Bill #: {order.paperBillNumber}</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-black mt-1">
                    Date: {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-2">
                  <div className="flex items-center gap-3 sm:justify-end">
                    <img
                      src={samanthaLogo}
                      alt="Sun Bakers & Confectionary"
                      className="w-14 h-14 object-contain rounded-full border border-slate-300 shadow-2xs shrink-0"
                    />
                    <div>
                      <h3 className="font-black text-sm text-black">
                        {companySettings?.companyName || 'Sunbakers & confectionary'}
                      </h3>
                      <p className="text-xs font-bold text-black">
                        {companySettings?.address || '239,kurukutthala ,kadugannawa'}
                      </p>
                      <p className="text-xs font-black text-black font-mono">
                        Tel: {companySettings?.phone || '+94 77 254 9414'}
                      </p>
                    </div>
                  </div>

                  {order.lorry ? (
                    <div className="text-xs font-bold text-black space-y-0.5">
                      <p className="font-black text-black">
                        Lorry: {order.lorry.vehicleNumber} ({order.lorry.driverName})
                      </p>
                      <p className="font-bold text-black">Route: {order.route?.name || order.lorry.route?.name || 'Local Route'}</p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-black">Warehouse Central Counter</p>
                  )}
                </div>
              </div>

              {/* Client & Destination Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-300 text-sm">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-black block mb-1">
                    Retail Outlet / Customer
                  </span>
                  <p className="font-black text-base text-black">{order.customer.name}</p>
                  {order.customer.companyName && (
                    <p className="text-xs font-bold text-black">{order.customer.companyName}</p>
                  )}
                  <p className="text-xs font-bold text-black mt-0.5">{order.customer.deliveryAddress || order.customer.city}</p>
                  <p className="text-xs font-black text-black font-mono">{order.customer.phone}</p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[11px] font-black uppercase tracking-wider text-black block mb-1">
                    Account & Payment
                  </span>
                  <p className="text-xs font-bold text-black">
                    Client Code: <span className="font-mono font-black text-black">{order.customer.code}</span>
                  </p>
                  <p className="text-xs font-bold text-black">
                    Payment Mode: <span className="font-black text-black">{order.paymentMethod || 'CASH'}</span>
                  </p>
                  <p className="text-xs font-bold text-black">
                    Status: <span className="font-black text-black">{order.paymentStatus}</span>
                  </p>
                  {order.notes && (
                    <div className="mt-1.5 text-xs text-black font-bold bg-white p-2 rounded-lg text-left border border-slate-300">
                      <strong>Notes:</strong> {order.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-300 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-200 text-black text-[11px] font-black uppercase tracking-wider border-b-2 border-black">
                    <tr>
                      <th className="p-2.5 pl-3">Item & SKU</th>
                      <th className="p-2.5 text-center">Unit</th>
                      <th className="p-2.5 text-center">Qty</th>
                      <th className="p-2.5 text-right">Unit Price</th>
                      <th className="p-2.5 pr-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2.5 pl-3">
                          <p className="font-black text-slate-900 text-sm">{item.product.name}</p>
                          <span className="text-[11px] font-mono font-bold text-black">{item.product.sku}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-black">{item.product.unit}</td>
                        <td className="p-2.5 text-center font-black text-black text-sm">
                          {item.quantity}
                          {item.freeQuantity > 0 && (
                            <span className="block text-[11px] font-black text-black">
                              +{item.freeQuantity} Free
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-black">
                          <div>{formatMoney(item.unitPrice)}</div>
                          {item.product && item.unitPrice < item.product.unitPrice && (
                            <div className="text-[11px] text-black font-black">
                              was <span className="line-through">{formatMoney(item.product.unitPrice)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-black text-black font-mono text-sm">
                          {formatMoney(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Returned & Damaged Items Table (A4) */}
              {order.returns && order.returns.length > 0 && (
                <div className="border border-slate-300 rounded-xl overflow-x-auto bg-amber-50/30">
                  <div className="px-3 py-2 bg-amber-100 border-b-2 border-black text-[11px] font-black text-black uppercase tracking-wider flex items-center justify-between">
                    <span>Customer Returned & Damaged Items (Credit Deductions)</span>
                    <span className="font-mono text-black font-black">
                      Total Return Deductions: -{formatMoney(order.returnAmount || order.returns.reduce((a, b) => a + b.total, 0))}
                    </span>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-200 text-black text-[11px] font-black uppercase tracking-wider border-b border-black">
                      <tr>
                        <th className="p-2 pl-3">Condition</th>
                        <th className="p-2">Product Name</th>
                        <th className="p-2 text-center">Returned Qty</th>
                        <th className="p-2 text-right">Credit Rate</th>
                        <th className="p-2 pr-3 text-right">Line Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {order.returns.map((ret) => (
                        <tr key={ret.id}>
                          <td className="p-2 pl-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-black border border-black">
                              {ret.returnType === 'DAMAGE' ? '💥 Damaged / Expired' : '✨ Good Resellable'}
                            </span>
                          </td>
                          <td className="p-2">
                            <p className="font-black text-black">{ret.product?.name || 'Product'}</p>
                            {ret.reason && (
                              <span className="text-[11px] text-black font-bold block">Reason: {ret.reason}</span>
                            )}
                          </td>
                          <td className="p-2 text-center font-black text-black text-sm">{ret.quantity}</td>
                          <td className="p-2 text-right font-mono font-bold text-black">{formatMoney(ret.unitPrice)}</td>
                          <td className="p-2 pr-3 text-right font-black text-black font-mono">
                            -{formatMoney(ret.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals Breakdown */}
              <div className="flex justify-end pt-1">
                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-black font-bold">
                    <span>Subtotal:</span>
                    <span className="font-black font-mono">{formatMoney(order.subtotal)}</span>
                  </div>
                  {order.items.some((i) => (i.freeQuantity || 0) > 0) && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Promotional Units:</span>
                      <span className="font-mono font-black">
                        {order.items.reduce((acc, i) => acc + (i.freeQuantity || 0), 0)} Free
                      </span>
                    </div>
                  )}
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Discount:</span>
                      <span className="font-mono font-black">-{formatMoney(order.discountAmount)}</span>
                    </div>
                  )}
                  {order.returnAmount !== undefined && order.returnAmount > 0 && (
                    <div className="flex justify-between text-black font-bold">
                      <span>Returns / Damages:</span>
                      <span className="font-mono font-black">-{formatMoney(order.returnAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-black border-t-2 border-black pt-1.5">
                    <span>Net Total:</span>
                    <span className="font-mono text-base">{formatMoney(order.netTotal)}</span>
                  </div>
                  <div className="flex justify-between text-black font-bold">
                    <span>Cash Paid:</span>
                    <span className="font-mono font-black">{formatMoney(order.cashReceived || 0)}</span>
                  </div>
                  {order.netTotal - (order.cashReceived || 0) > 0 && (
                    <div className="flex justify-between text-black font-black">
                      <span>Credit Balance:</span>
                      <span className="font-mono">{formatMoney(order.netTotal - (order.cashReceived || 0))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Policy / Terms Notice */}
              {companySettings?.invoiceFooterNote && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-300 text-xs text-black text-center font-bold">
                  {companySettings.invoiceFooterNote}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-4 grid grid-cols-2 gap-6 border-t-2 border-black text-xs text-black">
                <div>
                  <p className="font-black text-black mb-4">Delivered By:</p>
                  <div className="border-b-2 border-black w-44"></div>
                  <p className="mt-1 text-[11px] font-black">{order.lorry ? `${order.lorry.driverName} (${order.lorry.vehicleNumber})` : 'Warehouse Dispatch'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-black mb-4">Received By:</p>
                  <div className="border-b-2 border-black w-44 ml-auto"></div>
                  <p className="mt-1 text-[11px] font-black">Authorized Shop Stamp & Sign</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
