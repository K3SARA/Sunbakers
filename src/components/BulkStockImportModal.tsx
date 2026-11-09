import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Layers,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Product } from '../types';
import { ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';

interface BulkStockImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingProducts: Product[];
}

interface ParsedImportRow {
  rowIndex: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  unitPrice: number;
  quantity: number;
  freeStock: number;
  minStockAlert: number;
  isRawMaterial: boolean;
  isExisting: boolean;
  existingProduct?: Product;
  projectedStock: number;
  hasError: boolean;
  errorMessage?: string;
}

export const BulkStockImportModal: React.FC<BulkStockImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingProducts
}) => {
  const { formatMoney } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'ADD' | 'REPLACE'>('ADD');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [filterView, setFilterView] = useState<'ALL' | 'NEW' | 'UPDATE' | 'ERROR'>('ALL');
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // 1. Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const csvContent =
      'SKU,Name,Category,Unit,CostPrice,SellingPrice,StockQuantity,FreeStock,MinStockAlert,IsRawMaterial\r\n' +
      'BRD-001,White Sandwich Bread 450g,Bakery,Loaf,140.00,180.00,50,5,15,false\r\n' +
      'BUN-002,Spicy Fish Bun,Pastry,Pcs,65.00,90.00,100,0,20,false\r\n' +
      'CAK-003,Butter Cake 500g,Cakes,Box,350.00,450.00,30,0,10,false\r\n' +
      'RAW-004,Sugar 50kg,Raw Materials,Bag,6000.00,0.00,10,0,5,true\r\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'samantha_stock_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 2. Pure RFC 4180 CSV parser
  const parseCSV = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \r\n
        }
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some(col => col.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(col => col.trim().length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  // 3. Process File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && !file.name.toLowerCase().endsWith('.txt')) {
      alert('Please select a valid CSV (.csv) file.');
      return;
    }

    setSelectedFile(file);
    setResultMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const rawRows = parseCSV(content);
      if (rawRows.length < 2) {
        alert('The CSV file appears to be empty or missing data rows.');
        return;
      }

      // Map headers
      const headerRow = rawRows[0].map(h => h.trim().toLowerCase());
      const getColIndex = (aliases: string[]) =>
        headerRow.findIndex(h => aliases.some(alias => h === alias || h.replace(/[^a-z0-9]/g, '') === alias.replace(/[^a-z0-9]/g, '')));

      const skuIdx = getColIndex(['sku', 'code', 'itemcode', 'barcode', 'item_code']);
      const nameIdx = getColIndex(['name', 'productname', 'itemname', 'description', 'title', 'product_name']);
      const categoryIdx = getColIndex(['category', 'group', 'type']);
      const unitIdx = getColIndex(['unit', 'uom', 'pack']);
      const costIdx = getColIndex(['costprice', 'cost', 'purchaseprice', 'buyingprice', 'cost_price']);
      const priceIdx = getColIndex(['sellingprice', 'unitprice', 'price', 'unit_price', 'mrp', 'selling_price']);
      const qtyIdx = getColIndex(['stockquantity', 'quantity', 'currentstock', 'qty', 'stock', 'inventory', 'stock_quantity']);
      const freeIdx = getColIndex(['freestock', 'freequantity', 'freeqty', 'bonus', 'free_stock']);
      const minAlertIdx = getColIndex(['minstockalert', 'minstock', 'reorderlevel', 'alert', 'min_stock_alert']);
      const isRawIdx = getColIndex(['israwmaterial', 'rawmaterial', 'raw', 'is_raw_material']);

      if (nameIdx === -1 && skuIdx === -1) {
        alert('Could not find a "Name" or "SKU" column in your CSV. Please ensure your CSV has a header row.');
        return;
      }

      // Existing lookup maps
      const skuMap = new Map<string, Product>();
      const nameMap = new Map<string, Product>();
      existingProducts.forEach(p => {
        if (p.sku) skuMap.set(p.sku.trim().toLowerCase(), p);
        if (p.name) nameMap.set(p.name.trim().toLowerCase(), p);
      });

      const parsed: ParsedImportRow[] = [];

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rawSku = skuIdx >= 0 && row[skuIdx] ? row[skuIdx].trim().toUpperCase() : '';
        const rawName = nameIdx >= 0 && row[nameIdx] ? row[nameIdx].trim() : '';

        if (!rawName && !rawSku) continue; // skip blank line

        const rawCat = categoryIdx >= 0 && row[categoryIdx] ? row[categoryIdx].trim() : 'General';
        const rawUnit = unitIdx >= 0 && row[unitIdx] ? row[unitIdx].trim() : 'Unit';
        const costPrice = costIdx >= 0 && row[costIdx] ? parseFloat(row[costIdx].replace(/[^0-9.-]/g, '')) || 0 : 0;
        const unitPrice = priceIdx >= 0 && row[priceIdx] ? parseFloat(row[priceIdx].replace(/[^0-9.-]/g, '')) || 0 : 0;
        const quantity = qtyIdx >= 0 && row[qtyIdx] ? parseInt(row[qtyIdx].replace(/[^0-9-]/g, ''), 10) || 0 : 0;
        const freeStock = freeIdx >= 0 && row[freeIdx] ? parseInt(row[freeIdx].replace(/[^0-9-]/g, ''), 10) || 0 : 0;
        const minAlert = minAlertIdx >= 0 && row[minAlertIdx] ? parseInt(row[minAlertIdx].replace(/[^0-9-]/g, ''), 10) || 10 : 10;
        const isRawMaterial = isRawIdx >= 0 && row[isRawIdx] ? ['true', 'yes', '1', 'raw'].includes(row[isRawIdx].trim().toLowerCase()) : false;

        // Check matching product
        const matched = (rawSku ? skuMap.get(rawSku.toLowerCase()) : undefined) || (rawName ? nameMap.get(rawName.toLowerCase()) : undefined);

        let hasError = false;
        let errorMessage = '';

        if (!rawName && !matched) {
          hasError = true;
          errorMessage = 'Product name is required for new items.';
        }

        const currentStock = matched ? matched.currentStock : 0;
        const projectedStock = mode === 'ADD'
          ? currentStock + quantity
          : quantity;

        parsed.push({
          rowIndex: i + 1,
          sku: rawSku || (matched ? matched.sku : ''),
          name: rawName || (matched ? matched.name : 'Unknown Product'),
          category: rawCat || (matched ? matched.category : 'General'),
          unit: rawUnit || (matched ? matched.unit : 'Unit'),
          costPrice: costPrice || (matched ? matched.costPrice : 0),
          unitPrice: unitPrice || (matched ? matched.unitPrice : 0),
          quantity,
          freeStock,
          minStockAlert: minAlert,
          isRawMaterial: isRawMaterial || (matched ? matched.isRawMaterial : false),
          isExisting: Boolean(matched),
          existingProduct: matched,
          projectedStock: Math.max(0, projectedStock),
          hasError,
          errorMessage
        });
      }

      setParsedRows(parsed);
    };

    reader.readAsText(file);
  };

  // Re-calculate projections if mode is toggled
  const handleModeChange = (newMode: 'ADD' | 'REPLACE') => {
    setMode(newMode);
    setParsedRows(prev =>
      prev.map(row => {
        const currentStock = row.existingProduct ? row.existingProduct.currentStock : 0;
        const projectedStock = newMode === 'ADD'
          ? currentStock + row.quantity
          : row.quantity;
        return {
          ...row,
          projectedStock: Math.max(0, projectedStock)
        };
      })
    );
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setResultMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute Import
  const handleCommitImport = async () => {
    const validItems = parsedRows.filter(r => !r.hasError);
    if (validItems.length === 0) {
      alert('No valid items to import. Please check your CSV data.');
      return;
    }

    setLoading(true);
    setResultMessage(null);

    try {
      const payload = {
        mode,
        items: validItems.map(r => ({
          sku: r.sku,
          name: r.name,
          category: r.category,
          unit: r.unit,
          costPrice: r.costPrice,
          unitPrice: r.unitPrice,
          quantity: r.quantity,
          freeStock: r.freeStock,
          minStockAlert: r.minStockAlert,
          isRawMaterial: r.isRawMaterial
        }))
      };

      const response = await ProductService.bulkImport(payload);

      setResultMessage({
        type: 'success',
        text: `Success! Created ${response.createdCount} new products and updated stock for ${response.updatedCount} existing items.`
      });

      // Notify parent to refresh products
      onSuccess();

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Import failed:', err);
      setResultMessage({
        type: 'error',
        text: err.response?.data?.error || err.message || 'Failed to complete bulk import. Please check your data.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter calculations
  const totalRows = parsedRows.length;
  const newProductsCount = parsedRows.filter(r => !r.isExisting && !r.hasError).length;
  const updateProductsCount = parsedRows.filter(r => r.isExisting && !r.hasError).length;
  const errorCount = parsedRows.filter(r => r.hasError).length;

  const displayedRows = parsedRows.filter(r => {
    if (filterView === 'NEW') return !r.isExisting && !r.hasError;
    if (filterView === 'UPDATE') return r.isExisting && !r.hasError;
    if (filterView === 'ERROR') return r.hasError;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100/80 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Bulk Import Stock (.CSV)
              </h2>
              <p className="text-xs text-slate-500">
                Bulk inward warehouse stock, update prices, or create new inventory items in one click.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Options Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mode Selector */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 space-y-2">
              <span className="text-xs font-semibold text-slate-700 block">
                Stock Inward Mode
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange('ADD')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs font-medium cursor-pointer ${
                    mode === 'ADD'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold mb-0.5">Add to Current</div>
                  <div className={`text-[10.5px] ${mode === 'ADD' ? 'text-blue-100' : 'text-slate-400'}`}>
                    Adds shipment qty onto existing warehouse stock.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange('REPLACE')}
                  className={`p-2.5 rounded-xl text-left border transition text-xs font-medium cursor-pointer ${
                    mode === 'REPLACE'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold mb-0.5">Set / Overwrite</div>
                  <div className={`text-[10.5px] ${mode === 'REPLACE' ? 'text-blue-100' : 'text-slate-400'}`}>
                    Replaces stock with exact count (Physical stock take).
                  </div>
                </button>
              </div>
            </div>

            {/* Template Download Box */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-0.5">
                  Need a template?
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Download our pre-formatted spreadsheet with standard headers (SKU, Name, Category, Unit, Prices, Quantity).
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-3 inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                Download Sample CSV Template
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          {!selectedFile ? (
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 rounded-3xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition shadow-2xs">
                <Upload className="w-7 h-7 stroke-[2]" />
              </div>
              <div>
                <span className="font-bold text-slate-800 text-sm block">
                  Click to browse or drag and drop your .CSV file here
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  Supports UTF-8 CSV exports from Excel, Google Sheets, or any ERP system.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                  CSV
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {selectedFile.name}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {totalRows} valid data rows detected
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearFile}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-semibold rounded-xl border border-slate-200 hover:border-rose-200 text-xs transition cursor-pointer shadow-2xs"
              >
                Change File
              </button>
            </div>
          )}

          {/* Results / Status Alert */}
          {resultMessage && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-center gap-3 border ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                  : 'bg-rose-50 border-rose-200 text-rose-800 font-medium'
              }`}
            >
              {resultMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{resultMessage.text}</span>
            </div>
          )}

          {/* Data Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Summary filter tabs */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterView('ALL')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                      filterView === 'ALL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Rows ({totalRows})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterView('UPDATE')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                      filterView === 'UPDATE'
                        ? 'bg-blue-600 text-white'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    Updates ({updateProductsCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterView('NEW')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                      filterView === 'NEW'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    New Items ({newProductsCount})
                  </button>

                  {errorCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterView('ERROR')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                        filterView === 'ERROR'
                          ? 'bg-rose-600 text-white'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      Errors ({errorCount})
                    </button>
                  )}
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  Showing {displayedRows.length} of {totalRows}
                </span>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-center">Import Qty</th>
                      <th className="py-2.5 px-3 text-right">Projected Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {displayedRows.map((row) => (
                      <tr key={row.rowIndex} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3">
                          {row.hasError ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <AlertTriangle className="w-3 h-3" /> Error
                            </span>
                          ) : row.isExisting ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              <RefreshCw className="w-3 h-3" /> Update
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <Plus className="w-3 h-3" /> New
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {row.sku || <span className="text-slate-300 italic">Auto-gen</span>}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 max-w-[180px] truncate">
                          {row.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {row.category} ({row.unit})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                          {formatMoney(row.costPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                          {formatMoney(row.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-600">
                          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {row.isExisting ? (
                            <div className="flex items-center justify-end gap-1.5 text-slate-500">
                              <span>{row.existingProduct?.currentStock}</span>
                              <ArrowRight className="w-3 h-3 text-slate-300" />
                              <span className="font-bold text-slate-900">{row.projectedStock}</span>
                            </div>
                          ) : (
                            <span className="font-bold text-emerald-700">{row.projectedStock}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 ? (
              <span>
                Ready to process <strong>{totalRows - errorCount}</strong> valid item(s).
              </span>
            ) : (
              <span>Upload a CSV file to preview items before importing.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleCommitImport}
              disabled={loading || parsedRows.length === 0 || (totalRows - errorCount === 0)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-xs transition text-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing Stock...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Confirm &amp; Import ({totalRows - errorCount})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

