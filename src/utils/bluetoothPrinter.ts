/**
 * Bluetooth Thermal Printer (80mm / ESC-POS) Utility
 * Supports:
 * 1. Web Bluetooth API for direct wireless printing to portable thermal receipt printers
 * 2. ESC/POS command generation optimized for 80mm rolls (42-48 character width)
 * 3. Fallback to System Print Spooler / Android Bluetooth Print Services (RawBT, Bluetooth Print)
 */

import { Order, SystemSettings, LorryLoading } from '../types';

// Standard 80mm thermal receipt character width (Font A: 42-48 chars, using 42 for safe margins)
const RECEIPT_WIDTH = 42;

// Standard Bluetooth thermal printer GATT service & characteristic UUIDs
const BLUETOOTH_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Common ESC/POS Serial (Xprinter, Rongta, MPT, GOOJPRT)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
  '0000ff00-0000-1000-8000-00805f9b34fb',
];

// Basic ESC/POS byte commands
const ESC = 0x1b;
const GS = 0x1d;

const COMMANDS = {
  INIT: [ESC, 0x40], // Initialize printer
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_WIDTH: [ESC, 0x21, 0x20],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  LINE_FEED: [0x0a],
  PAPER_FEED_3: [ESC, 0x64, 0x03],
  PAPER_FEED_5: [ESC, 0x64, 0x05],
  PARTIAL_CUT: [GS, 0x56, 0x41, 0x10],
};

/**
 * Check if Web Bluetooth is supported in the current browser/environment
 */
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Format string into two columns aligned left and right for 80mm (42 columns)
 */
function padTwoColumns(left: string, right: string, width = RECEIPT_WIDTH): string {
  const leftTrim = left.trim();
  const rightTrim = right.trim();
  const spaces = width - leftTrim.length - rightTrim.length;
  if (spaces <= 0) {
    // If text exceeds width, put right on next line
    return `${leftTrim}\n${' '.repeat(Math.max(0, width - rightTrim.length))}${rightTrim}`;
  }
  return `${leftTrim}${' '.repeat(spaces)}${rightTrim}`;
}

/**
 * Divider line helper
 */
function dividerLine(char = '-', width = RECEIPT_WIDTH): string {
  return char.repeat(width);
}

/**
 * Encode string to Uint8Array using ASCII / Windows-1252 compatible encoding
 */
function encodeText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

/**
 * Build ESC/POS Byte Buffer for 80mm Thermal Receipt
 */
export function build80mmEscPosReceipt(order: Order, settings?: SystemSettings | null): Uint8Array {
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (const b of bytes) chunks.push(b);
  };

  const addText = (text: string) => {
    const encoded = encodeText(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  const addLine = (text = '') => {
    addText(text);
    addBytes(COMMANDS.LINE_FEED);
  };

  // 1. Initialize
  addBytes(COMMANDS.INIT);

  // 2. Header (Centered, bold)
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE);
  addBytes(COMMANDS.BOLD_ON);
  addLine(settings?.companyName || 'Sunbakers & confectionary');
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);

  addLine(settings?.address || '239,kurukutthala ,kadugannawa');
  addLine(`Tel: ${settings?.phone || '+94 77 254 9414'}`);
  if (settings?.registrationNumber) {
    addLine(`Reg/VAT: ${settings.registrationNumber}`);
  }

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addLine('*** SALES BILL / DELIVERY RECEIPT ***');
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  // 3. Bill & Lorry Metadata (Left aligned)
  addBytes(COMMANDS.ALIGN_LEFT);
  const dateStr = new Date(order.createdAt).toLocaleDateString();
  const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  addLine(padTwoColumns(`Date: ${dateStr} ${timeStr}`, `Status: ${order.paymentStatus}`));
  addLine(padTwoColumns(`Bill #: ${order.paperBillNumber || order.orderNumber}`, `Ref: ${order.orderNumber}`));

  if (order.lorry) {
    addLine(`Lorry: ${order.lorry.vehicleNumber} | Driver: ${order.lorry.driverName}`);
    if (order.route?.name || order.lorry.route?.name) {
      addLine(`Route: ${order.route?.name || order.lorry.route?.name}`);
    }
  }

  // 4. Customer Information
  addLine(dividerLine('-'));
  addBytes(COMMANDS.BOLD_ON);
  addLine(`Customer: ${order.customer.name} [${order.customer.code}]`);
  addBytes(COMMANDS.BOLD_OFF);
  if (order.customer.companyName) {
    addLine(`Shop: ${order.customer.companyName}`);
  }
  if (order.customer.deliveryAddress || order.customer.city) {
    addLine(`Addr: ${order.customer.deliveryAddress || order.customer.city}`);
  }
  if (order.customer.phone) {
    addLine(`Phone: ${order.customer.phone}`);
  }
  addLine(dividerLine('-'));

  // 5. Line Items Header
  addBytes(COMMANDS.BOLD_ON);
  addLine(padTwoColumns('ITEM DESCRIPTION', 'TOTAL'));
  addLine(padTwoColumns(' QTY x PRICE', ''));
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  // 6. Items
  let totalFreeQty = 0;
  order.items.forEach((item) => {
    // Line 1: Item Name (truncated if exceeds width)
    const nameStr = item.product.name.slice(0, RECEIPT_WIDTH);
    addLine(nameStr);

    // Line 2: Qty x UnitPrice and Line Total
    const qtyPrice = `  ${item.quantity} ${item.product.unit || 'pcs'} x Rs.${item.unitPrice.toFixed(2)}`;
    const lineTot = `Rs.${item.lineTotal.toFixed(2)}`;
    addLine(padTwoColumns(qtyPrice, lineTot));

    // Promotional Free Issue line
    if (item.freeQuantity && item.freeQuantity > 0) {
      totalFreeQty += item.freeQuantity;
      addBytes(COMMANDS.BOLD_ON);
      addLine(`  >> FREE PROMO: +${item.freeQuantity} ${item.product.unit || 'pcs'} (Rs.0.00)`);
      addBytes(COMMANDS.BOLD_OFF);
    }
  });

  addLine(dividerLine('-'));

  // 7. Totals & Payment Breakdown
  addLine(padTwoColumns('Subtotal:', `Rs.${order.subtotal.toFixed(2)}`));

  if (totalFreeQty > 0) {
    addLine(padTwoColumns('Promotional Units:', `${totalFreeQty} Free pcs`));
  }

  if (order.discountAmount > 0) {
    addLine(padTwoColumns('Discount:', `-Rs.${order.discountAmount.toFixed(2)}`));
  }

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addBytes(COMMANDS.DOUBLE_HEIGHT);
  addLine(padTwoColumns('NET TOTAL:', `Rs.${order.netTotal.toFixed(2)}`));
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  addLine(padTwoColumns('Payment Method:', `${order.paymentMethod || 'CASH'}`));
  const cashRec = order.cashReceived || 0;
  addLine(padTwoColumns('Amount Paid:', `Rs.${cashRec.toFixed(2)}`));

  const balance = order.netTotal - cashRec;
  if (balance > 0) {
    addBytes(COMMANDS.BOLD_ON);
    addLine(padTwoColumns('Credit Balance Due:', `Rs.${balance.toFixed(2)}`));
    addBytes(COMMANDS.BOLD_OFF);
  } else if (cashRec > order.netTotal) {
    addLine(padTwoColumns('Change Returned:', `Rs.${(cashRec - order.netTotal).toFixed(2)}`));
  }

  if (order.notes) {
    addLine(dividerLine('-'));
    addLine(`Notes: ${order.notes}`);
  }

  // 8. Footer Notice / Policy
  addLine(dividerLine('-'));
  addBytes(COMMANDS.ALIGN_CENTER);
  if (settings?.invoiceFooterNote) {
    addLine(settings.invoiceFooterNote);
  } else {
    addLine('Goods received in satisfactory condition.');
    addLine('Thank you for your business!');
  }

  // 9. Signatures Tear-off
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine('');
  addLine(padTwoColumns('Delivered By (Driver):', 'Received By (Shop):'));
  addLine('');
  addLine(padTwoColumns('____________________', '____________________'));
  addLine(padTwoColumns(order.lorry?.driverName || 'Driver Sign', 'Customer Stamp / Sign'));

  // 10. Feed and Cut
  addLine('');
  addLine(dividerLine('.'));
  addBytes(COMMANDS.PAPER_FEED_5);
  addBytes(COMMANDS.PARTIAL_CUT);

  return new Uint8Array(chunks);
}

/**
 * Direct Print to Bluetooth Thermal Printer using Web Bluetooth API
 */
export interface RepBillsSummaryData {
  repName?: string;
  repPhone?: string;
  vehicleNumber?: string;
  routeName?: string;
  driverName?: string;
  dateStr?: string;
  filterLabel?: string;
  bills: Order[];
  summary: {
    totalBills: number;
    totalValue: number;
    totalCash: number;
    totalCredit: number;
    cashCount: number;
    creditCount: number;
    chequeCount?: number;
    totalCheque?: number;
  };
  productSummary?: {
    name: string;
    unit: string;
    quantity: number;
    freeQuantity: number;
    totalValue: number;
  }[];
}

/**
 * Build ESC/POS Byte Buffer for 80mm Rep Bills Summary Slip
 */
export function build80mmEscPosBillsSummary(
  data: RepBillsSummaryData,
  settings?: SystemSettings | null
): Uint8Array {
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (const b of bytes) chunks.push(b);
  };

  const addText = (text: string) => {
    const encoded = encodeText(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  const addLine = (text = '') => {
    addText(text);
    addBytes(COMMANDS.LINE_FEED);
  };

  // 1. Initialize
  addBytes(COMMANDS.INIT);

  // 2. Header
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE);
  addBytes(COMMANDS.BOLD_ON);
  addLine(settings?.companyName || 'Sunbakers & confectionary');
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);

  addLine(settings?.address || '239,kurukutthala ,kadugannawa');
  addLine(`Tel: ${settings?.phone || '+94 77 254 9414'}`);
  if (settings?.registrationNumber) {
    addLine(`Reg/VAT: ${settings.registrationNumber}`);
  }

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addLine('*** SALES REP BILLS SUMMARY ***');
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  // 3. Metadata
  addBytes(COMMANDS.ALIGN_LEFT);
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  addLine(padTwoColumns(`Date: ${dateStr} ${timeStr}`, `Bills: ${data.bills.length}`));
  addLine(padTwoColumns(`Rep: ${data.repName || 'Sales Rep'}`, `Van: ${data.vehicleNumber || 'Route Lorry'}`));
  if (data.routeName) {
    addLine(`Route: ${data.routeName}`);
  }
  if (data.driverName) {
    addLine(`Driver: ${data.driverName}`);
  }
  if (data.filterLabel && data.filterLabel !== 'ALL') {
    addLine(`Filtered By: ${data.filterLabel} BILLS ONLY`);
  }
  addLine(dividerLine('-'));

  // 4. Financial KPI Box
  addBytes(COMMANDS.BOLD_ON);
  addBytes(COMMANDS.DOUBLE_HEIGHT);
  addLine(padTwoColumns('TOTAL SALES:', `Rs.${data.summary.totalValue.toFixed(2)}`));
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  addLine(padTwoColumns('CASH COLLECTED:', `Rs.${data.summary.totalCash.toFixed(2)}`));
  addLine(padTwoColumns('  Cash Bills Count:', `${data.summary.cashCount} bills`));
  addLine(padTwoColumns('CREDIT GIVEN:', `Rs.${data.summary.totalCredit.toFixed(2)}`));
  addLine(padTwoColumns('  Credit Bills Count:', `${data.summary.creditCount} bills`));
  if (data.summary.totalCheque && data.summary.totalCheque > 0) {
    addLine(padTwoColumns('CHEQUES COLLECTED:', `Rs.${data.summary.totalCheque.toFixed(2)}`));
    addLine(padTwoColumns('  Cheque Bills Count:', `${data.summary.chequeCount || 0} bills`));
  }
  addLine(dividerLine('='));

  // 5. Bills Listing
  addBytes(COMMANDS.BOLD_ON);
  addLine(`*** BILLS BREAKDOWN (${data.bills.length} BILLS) ***`);
  addLine(padTwoColumns('SLIP# / TIME', 'AMOUNT'));
  addLine(padTwoColumns(' CUSTOMER [MODE]', 'STATUS / DUE'));
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  data.bills.forEach((bill, idx) => {
    const slip = bill.paperBillNumber ? `#${bill.paperBillNumber}` : bill.orderNumber;
    const time = new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const net = `Rs.${bill.netTotal.toFixed(2)}`;
    addLine(padTwoColumns(`${idx + 1}. ${slip} (${time})`, net));

    const custName = (bill.customer?.companyName || bill.customer?.name || 'Customer').slice(0, 24);
    const creditDue = Math.max(0, bill.netTotal - (bill.cashReceived || 0));
    const statusStr =
      bill.paymentMethod === 'CASH'
        ? '[CASH] PAID'
        : bill.paymentMethod === 'CHEQUE'
        ? '[CHQ] RECORDED'
        : creditDue > 0
        ? `[CR] Due: Rs.${creditDue.toFixed(2)}`
        : '[CR] CLEARED';

    addLine(padTwoColumns(`   ${custName}`, statusStr));
  });

  addLine(dividerLine('-'));

  // 6. Product-wise aggregate units sold
  if (data.productSummary && data.productSummary.length > 0) {
    addBytes(COMMANDS.BOLD_ON);
    addLine('*** PRODUCT SALES SUMMARY ***');
    addLine(padTwoColumns('ITEM DESCRIPTION', 'QTY [FREE]'));
    addBytes(COMMANDS.BOLD_OFF);
    addLine(dividerLine('-'));

    let totalSoldUnits = 0;
    let totalFreeUnits = 0;

    data.productSummary.forEach((prod) => {
      totalSoldUnits += prod.quantity;
      totalFreeUnits += prod.freeQuantity || 0;
      const name = prod.name.slice(0, 26);
      const qtyStr = `${prod.quantity} ${prod.unit || 'pcs'}${
        prod.freeQuantity ? ` (+${prod.freeQuantity}F)` : ''
      }`;
      addLine(padTwoColumns(name, qtyStr));
      addLine(padTwoColumns(`   Total Value:`, `Rs.${prod.totalValue.toFixed(2)}`));
    });

    addLine(dividerLine('-'));
    addBytes(COMMANDS.BOLD_ON);
    addLine(
      padTwoColumns(
        'TOTAL UNITS SOLD:',
        `${totalSoldUnits} pcs${totalFreeUnits > 0 ? ` (+${totalFreeUnits} Free)` : ''}`
      )
    );
    addBytes(COMMANDS.BOLD_OFF);
    addLine(dividerLine('='));
  }

  // 7. Signatures
  addLine('');
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine(padTwoColumns('Rep Signature:', 'Supervisor / Cashier:'));
  addLine('');
  addLine(padTwoColumns('____________________', '____________________'));
  addLine(padTwoColumns(data.repName || 'Sales Rep', 'Store / Cash Office'));
  addLine('');

  // 8. Footer Notice
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine('*** END OF ROUTE SUMMARY ***');
  addLine('Generated from Sales Rep Billing App');
  addLine(dividerLine('.'));

  // 9. Feed and Cut
  addBytes(COMMANDS.PAPER_FEED_5);
  addBytes(COMMANDS.PARTIAL_CUT);

  return new Uint8Array(chunks);
}

/**
 * Shared helper to send ESC/POS byte array to Bluetooth printer
 */
export async function sendEscPosToBluetoothDevice(
  receiptData: Uint8Array,
  onStatusChange?: (status: string) => void
): Promise<{ success: boolean; message: string }> {
  if (!isWebBluetoothSupported()) {
    return {
      success: false,
      message: 'Web Bluetooth is not supported on this browser. Please use the System Print option.'
    };
  }

  try {
    onStatusChange?.('Searching for Bluetooth printer...');

    const nav = navigator as any;
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLUETOOTH_PRINTER_SERVICES
    });

    if (!device) {
      return { success: false, message: 'No Bluetooth printer was selected.' };
    }

    onStatusChange?.(`Connecting to ${device.name || 'Bluetooth Printer'}...`);

    const server = await device.gatt?.connect();
    if (!server) {
      return { success: false, message: 'Could not connect to Bluetooth printer GATT server.' };
    }

    onStatusChange?.('Locating printer communication channel...');

    let writeCharacteristic: any = null;

    for (const serviceUuid of BLUETOOTH_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        }
      } catch {
        // continue
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic && server.getPrimaryServices) {
      try {
        const allServices = await server.getPrimaryServices();
        for (const s of allServices) {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeCharacteristic = c;
              break;
            }
          }
          if (writeCharacteristic) break;
        }
      } catch {
        // ignore
      }
    }

    if (!writeCharacteristic) {
      throw new Error('Could not find a writable Bluetooth channel on this printer.');
    }

    onStatusChange?.('Sending data to 80mm thermal printer...');

    const CHUNK_SIZE = 100;
    for (let i = 0; i < receiptData.length; i += CHUNK_SIZE) {
      const chunk = receiptData.slice(i, i + CHUNK_SIZE);
      if (writeCharacteristic.writeValueWithoutResponse) {
        await writeCharacteristic.writeValueWithoutResponse(chunk);
      } else {
        await writeCharacteristic.writeValue(chunk);
      }
      await new Promise(r => setTimeout(r, 25));
    }

    onStatusChange?.('Summary printed successfully!');

    setTimeout(() => {
      try {
        device.gatt?.disconnect();
      } catch {}
    }, 1000);

    return { success: true, message: 'Receipt printed successfully to Bluetooth printer!' };
  } catch (error: any) {
    console.error('Bluetooth printing error:', error);
    if (error.name === 'NotFoundError') {
      return { success: false, message: 'Bluetooth pairing cancelled.' };
    }
    return {
      success: false,
      message: error.message || 'Failed to print via Bluetooth. Please use System Print.'
    };
  }
}

/**
 * Direct Print Single Invoice to Bluetooth Thermal Printer
 */
export async function printToBluetoothThermalPrinter(
  order: Order,
  settings?: SystemSettings | null,
  onStatusChange?: (status: string) => void
): Promise<{ success: boolean; message: string }> {
  try {
    const receiptData = build80mmEscPosReceipt(order, settings);
    return await sendEscPosToBluetoothDevice(receiptData, onStatusChange);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Bluetooth printing failed' };
  }
}

/**
 * Direct Print Rep's Bills Summary to Bluetooth Thermal Printer
 */
export async function printBillsSummaryToBluetooth(
  data: RepBillsSummaryData,
  settings?: SystemSettings | null,
  onStatusChange?: (status: string) => void
): Promise<{ success: boolean; message: string }> {
  try {
    const summaryBytes = build80mmEscPosBillsSummary(data, settings);
    return await sendEscPosToBluetoothDevice(summaryBytes, onStatusChange);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Bluetooth printing failed' };
  }
}

/**
 * Build ESC/POS Byte Buffer for 80mm Lorry Morning Load Sheet
 */
export function build80mmEscPosLorryLoading(
  loading: LorryLoading,
  settings?: SystemSettings | null
): Uint8Array {
  const chunks: number[] = [];

  const addBytes = (bytes: number[]) => {
    for (const b of bytes) chunks.push(b);
  };

  const addText = (text: string) => {
    const encoded = encodeText(text);
    for (let i = 0; i < encoded.length; i++) {
      chunks.push(encoded[i]);
    }
  };

  const addLine = (text = '') => {
    addText(text);
    addBytes(COMMANDS.LINE_FEED);
  };

  // 1. Initialize
  addBytes(COMMANDS.INIT);

  // 2. Header
  addBytes(COMMANDS.ALIGN_CENTER);
  addBytes(COMMANDS.DOUBLE_SIZE);
  addBytes(COMMANDS.BOLD_ON);
  addLine(settings?.companyName || 'Sunbakers & confectionary');
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);

  addLine(settings?.address || '239,kurukutthala ,kadugannawa');
  addLine(`Tel: ${settings?.phone || '+94 77 254 9414'}`);

  addLine(dividerLine('='));
  addBytes(COMMANDS.BOLD_ON);
  addLine('*** MORNING LORRY LOAD SHEET ***');
  addLine('GATE PASS & DISPATCH NOTE');
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  // 3. Metadata
  addBytes(COMMANDS.ALIGN_LEFT);
  const loadDate = new Date(loading.date || loading.createdAt || new Date());
  const dateStr = loadDate.toLocaleDateString();
  const timeStr = loadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  addLine(padTwoColumns(`Gate Pass: ${loading.loadingNumber}`, `Status: ${loading.status}`));
  addLine(padTwoColumns(`Date: ${dateStr}`, `Time: ${timeStr}`));
  addLine(padTwoColumns(`Lorry: ${loading.lorry?.vehicleNumber || 'Lorry'}`, `Driver: ${(loading.lorry?.driverName || 'Driver').slice(0, 16)}`));
  if (loading.lorry?.route?.name) {
    addLine(`Route: ${loading.lorry.route.name}`);
  }
  addLine(dividerLine('-'));

  // 4. Items Table
  addBytes(COMMANDS.BOLD_ON);
  addLine(padTwoColumns('ITEM DESCRIPTION', 'LOADED [FREE]'));
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('-'));

  let totalRegularUnits = 0;
  let totalFreeUnits = 0;
  let totalEstimatedValue = 0;

  loading.items.forEach((item, idx) => {
    const reg = item.loadedQty || 0;
    const free = item.loadedFreeQty || 0;
    const price = item.product?.unitPrice || 0;
    const itemValue = reg * price;

    totalRegularUnits += reg;
    totalFreeUnits += free;
    totalEstimatedValue += itemValue;

    const name = item.product?.name || `Item ${idx + 1}`;
    const qtyStr = `${reg} ${item.product?.unit || 'u'}${free > 0 ? ` (+${free}F)` : ''}`;
    addLine(padTwoColumns(`${idx + 1}. ${name.slice(0, 26)}`, qtyStr));
    addLine(padTwoColumns(`   SKU: ${item.product?.sku || '—'} @ Rs.${price.toFixed(2)}`, `Val: Rs.${itemValue.toFixed(2)}`));
  });

  addLine(dividerLine('-'));

  // 5. Totals
  addBytes(COMMANDS.BOLD_ON);
  addLine(padTwoColumns('TOTAL REGULAR UNITS:', `${totalRegularUnits}`));
  if (totalFreeUnits > 0) {
    addLine(padTwoColumns('TOTAL FREE ISSUE:', `${totalFreeUnits}`));
  }
  addLine(padTwoColumns('GRAND TOTAL UNITS:', `${totalRegularUnits + totalFreeUnits} units`));
  addBytes(COMMANDS.DOUBLE_HEIGHT);
  addLine(padTwoColumns('ESTIMATED LOAD VALUE:', `Rs.${totalEstimatedValue.toFixed(2)}`));
  addBytes(COMMANDS.NORMAL_SIZE);
  addBytes(COMMANDS.BOLD_OFF);
  addLine(dividerLine('='));

  if (loading.notes) {
    addLine(`Notes: ${loading.notes}`);
    addLine(dividerLine('-'));
  }

  // 6. Signatures Handover
  addLine('');
  addBytes(COMMANDS.ALIGN_LEFT);
  addLine(padTwoColumns('Dispatched (Warehouse):', 'Received (Driver/Rep):'));
  addLine('');
  addLine(padTwoColumns('____________________', '____________________'));
  addLine(padTwoColumns('Warehouse Keeper', loading.lorry?.driverName || 'Driver / Rep'));
  addLine('');

  // 7. Footer
  addBytes(COMMANDS.ALIGN_CENTER);
  addLine('*** VERIFIED FOR MORNING ROUTE ***');
  addLine('Sunbakers Distribution Management');
  addLine(dividerLine('.'));

  // 8. Feed & Cut
  addBytes(COMMANDS.PAPER_FEED_5);
  addBytes(COMMANDS.PARTIAL_CUT);

  return new Uint8Array(chunks);
}

/**
 * Direct Print Lorry Loading Sheet to Bluetooth Thermal Printer
 */
export async function printLorryLoadingToBluetooth(
  loading: LorryLoading,
  settings?: SystemSettings | null,
  onStatusChange?: (status: string) => void
): Promise<{ success: boolean; message: string }> {
  try {
    const bytes = build80mmEscPosLorryLoading(loading, settings);
    return await sendEscPosToBluetoothDevice(bytes, onStatusChange);
  } catch (err: any) {
    return { success: false, message: err?.message || 'Bluetooth printing failed' };
  }
}
