import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck,
  Plus,
  PackageCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Boxes,
  Compass,
  RotateCcw,
  Search,
  ChevronDown,
  X,
  Printer
} from 'lucide-react';
import { Lorry, Product, LorryLoading as LorryLoadingType } from '../types';
import { LorryService, ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { LorryLoadingPrintModal } from '../components/LorryLoadingPrintModal';

interface LoadingRow {
  productId: string;
  quantity: number;
  freeQuantity?: number;
}

export const LorryLoading: React.FC = () => {
  const { formatMoney } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [selectedLorryId, setSelectedLorryId] = useState<string>('');
  const [warehouseProducts, setWarehouseProducts] = useState<Product[]>([]);
  const [activeLoading, setActiveLoading] = useState<LorryLoadingType | null>(null);
  const [loadingRows, setLoadingRows] = useState<LoadingRow[]>([
    { productId: '', quantity: 0 }
  ]);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Printing state for morning lorry load
  const [printLoadingData, setPrintLoadingData] = useState<LorryLoadingType | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Search & Combobox states for items
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [rowSearchQueries, setRowSearchQueries] = useState<Record<number, string>>({});
  const [quickSearch, setQuickSearch] = useState<string>('');
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setActiveDropdownIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: check if a product has available units in warehouse
  const hasAvailableUnits = (p: Product) => {
    const paid = Number(p.currentStock) || 0;
    const free = Number(p.freeStock) || 0;
    return paid > 0 || free > 0;
  };

  const getFilteredProductsForRow = (query: string) => {
    // Only products with available warehouse stock (> 0 paid or > 0 free)
    const availableOnly = warehouseProducts.filter(hasAvailableUnits);
    if (!query.trim()) return availableOnly;
    const q = query.toLowerCase().trim();
    return availableOnly.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  };

  const quickSearchResults = useMemo(() => {
    if (!quickSearch.trim()) return [];
    const q = quickSearch.toLowerCase().trim();
    return warehouseProducts.filter(p =>
      hasAvailableUnits(p) &&
      (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      )
    );
  }, [warehouseProducts, quickSearch]);

  const handleQuickAddProduct = (prod: Product) => {
    if (!hasAvailableUnits(prod)) return;
    // If the last or only row is empty, fill it; otherwise append a new row
    const emptyRowIndex = loadingRows.findIndex(r => !r.productId);
    if (emptyRowIndex >= 0) {
      updateRow(emptyRowIndex, 'productId', prod.id);
    } else {
      setLoadingRows([...loadingRows, { productId: prod.id, quantity: 0, freeQuantity: 0 }]);
    }
    setQuickSearch('');
  };

  // Draft persistence
  const DRAFT_KEY = 'distributor_lorry_loading_draft';
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(DRAFT_KEY);
    } catch {
      return false;
    }
  });

  // Restore draft on initial load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.selectedLorryId) setSelectedLorryId(d.selectedLorryId);
        if (Array.isArray(d.loadingRows) && d.loadingRows.length > 0) {
          setLoadingRows(d.loadingRows);
        }
        if (d.notes) setNotes(d.notes);
        setHasDraft(true);
      }
    } catch (e) {
      console.warn('Failed to restore loading draft', e);
    }
  }, []);

  // Auto-save draft on any changes
  useEffect(() => {
    const hasContent =
      notes.trim() !== '' ||
      loadingRows.some(r => r.productId !== '' && r.quantity > 0);

    if (hasContent) {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            selectedLorryId,
            loadingRows,
            notes
          })
        );
        setHasDraft(true);
      } catch (e) {}
    }
  }, [selectedLorryId, loadingRows, notes]);

  const handleClearLoadingForm = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
    setLoadingRows([{ productId: '', quantity: 0 }]);
    setNotes('');
    setHasDraft(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [lorryList, productList] = await Promise.all([
        LorryService.getAll(),
        ProductService.getAll()
      ]);
      setLorries(lorryList);
      setWarehouseProducts(productList.filter(p => !p.isRawMaterial));

      if (lorryList.length > 0 && !selectedLorryId) {
        setSelectedLorryId(lorryList[0].id);
        fetchActiveLoading(lorryList[0].id);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load fleet or inventory data.');
    }
  };

  const fetchActiveLoading = async (lorryId: string) => {
    try {
      const loading = await LorryService.getCurrentLoading(lorryId);
      setActiveLoading(loading);
    } catch (err) {
      setActiveLoading(null);
    }
  };

  const handleLorryChange = (lorryId: string) => {
    setSelectedLorryId(lorryId);
    fetchActiveLoading(lorryId);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const selectedLorry = lorries.find(l => l.id === selectedLorryId);

  const addRow = () => {
    setLoadingRows([...loadingRows, { productId: '', quantity: 0, freeQuantity: 0 }]);
  };

  const updateRow = (index: number, field: keyof LoadingRow, value: any) => {
    const updated = [...loadingRows];
    updated[index] = { ...updated[index], [field]: value };
    setLoadingRows(updated);
  };

  const removeRow = (index: number) => {
    if (activeDropdownIndex === index) {
      setActiveDropdownIndex(null);
    }
    if (loadingRows.length === 1) {
      setLoadingRows([{ productId: '', quantity: 0, freeQuantity: 0 }]);
      return;
    }
    setLoadingRows(loadingRows.filter((_, i) => i !== index));
  };

  const calculateTotalUnits = () => {
    return loadingRows.reduce((sum, r) => sum + (parseInt(r.quantity as any, 10) || 0) + (parseInt(r.freeQuantity as any, 10) || 0), 0);
  };

  const calculateTotalEstimatedValue = () => {
    return loadingRows.reduce((sum, r) => {
      const p = warehouseProducts.find(item => item.id === r.productId);
      const totalUnits = (parseInt(r.quantity as any, 10) || 0) + (parseInt(r.freeQuantity as any, 10) || 0);
      return sum + (p ? p.unitPrice * totalUnits : 0);
    }, 0);
  };

  const handleConfirmLoading = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validRows = loadingRows.filter(r => r.productId && ((r.quantity > 0) || ((r.freeQuantity || 0) > 0)));
    if (validRows.length === 0) {
      setErrorMessage('Please add at least one product with a quantity greater than zero.');
      return;
    }

    // Verify warehouse inventory
    for (const row of validRows) {
      const prod = warehouseProducts.find(p => p.id === row.productId);
      if (prod) {
        if (prod.currentStock < row.quantity) {
          setErrorMessage(
            `Cannot load ${row.quantity} regular units of "${prod.name}". Only ${prod.currentStock} ${prod.unit} available in warehouse.`
          );
          return;
        }
        if ((row.freeQuantity || 0) > (prod.freeStock || 0)) {
          setErrorMessage(
            `Cannot load ${row.freeQuantity} free issue units of "${prod.name}". Only ${prod.freeStock || 0} ${prod.unit} free stock available in warehouse.`
          );
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const res = await LorryService.loadMorningStock(selectedLorryId, {
        items: validRows.map(r => ({
          productId: r.productId,
          quantity: r.quantity || 0,
          freeQuantity: r.freeQuantity || 0
        })),
        notes: notes.trim() || undefined
      });

      setSuccessMessage(
        `Successfully loaded ${res.totalLoadedItems} units into Lorry ${selectedLorry?.vehicleNumber}! Warehouse stock deducted.`
      );
      setPrintLoadingData(res);
      setIsPrintModalOpen(true);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {}
      setHasDraft(false);
      setLoadingRows([{ productId: '', quantity: 0, freeQuantity: 0 }]);
      setNotes('');

      // Refresh data
      await loadData();
      await fetchActiveLoading(selectedLorryId);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Error executing morning loading.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Boxes className="w-4 h-4" />
            <span>Step 2: Morning Dispatch Workflow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Morning Lorry Loading
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Transfer bulk items from Central Warehouse into the 3 route lorries before daily departure.
          </p>
        </div>

        <div className="self-start sm:self-auto flex items-center gap-2 text-xs font-medium bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-600 font-medium">
            Today: {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          {printLoadingData && (
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-2xs transition shrink-0 cursor-pointer self-start sm:self-auto"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Loading Sheet</span>
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 sm:p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Lorry Selector Cards (3 Lorries) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {lorries.map((lorry) => {
          const isSelected = lorry.id === selectedLorryId;
          const floatingUnits = lorry.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
          return (
            <button
              key={lorry.id}
              onClick={() => handleLorryChange(lorry.id)}
              className={`text-left p-5 rounded-3xl border transition-all duration-150 flex flex-col justify-between ${isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
            >
              <div className="flex items-start justify-between w-full mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                      }`}
                  >
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider block">
                      {lorry.vehicleNumber}
                    </span>
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {lorry.driverName}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    }`}
                >
                  {lorry.status}
                </span>
              </div>

              <div
                className={`pt-3 border-t text-xs space-y-1 ${isSelected ? 'border-white/20 text-blue-100' : 'border-slate-100 text-slate-500'
                  }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <Compass className="w-3.5 h-3.5" />
                  <span>{lorry.route?.name || 'Unassigned Route'}</span>
                </div>
                <div className="flex items-center justify-between font-medium pt-1">
                  <span>Current Floating Stock:</span>
                  <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                    {floatingUnits} Units
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Form & Lorry Stock Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loading Sheet Entry Form (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Morning Stock Issue to {selectedLorry?.vehicleNumber}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Route: {selectedLorry?.route?.name} • Driver: {selectedLorry?.driverName}
              </p>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product Line
            </button>
          </div>

          {/* Quick Product Search & Rapid-Add Bar */}
          <div className="relative">
            <div className="flex items-center gap-2 p-2 bg-blue-50/70 border border-blue-200/90 rounded-2xl shadow-2xs">
              <Search className="w-4 h-4 text-blue-600 ml-2 shrink-0" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Search available in-stock products (e.g. Bread, Bun, SKU)..."
                className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {quickSearch && (
                <button
                  type="button"
                  onClick={() => setQuickSearch('')}
                  className="p-1 text-slate-400 hover:text-slate-600 text-xs font-bold mr-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Search Autocomplete Suggestions */}
            {quickSearch.trim() && (
              <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                {quickSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">
                    No in-stock products found matching "{quickSearch}"
                  </div>
                ) : (
                  quickSearchResults.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleQuickAddProduct(prod)}
                      className="w-full text-left p-3 hover:bg-blue-50/70 flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            {prod.sku}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {prod.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          Available: <strong className="text-slate-800">{prod.currentStock} {prod.unit}</strong> (paid)
                          {(prod.freeStock || 0) > 0 && (
                            <> • <strong className="text-emerald-700">{prod.freeStock} free</strong></>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs text-blue-600 block">
                          {formatMoney(prod.unitPrice)}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mt-0.5">
                          + Add to Load
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleConfirmLoading} className="space-y-4">
            <div ref={dropdownContainerRef} className="space-y-3">
              {loadingRows.map((row, index) => {
                const selectedProd = warehouseProducts.find(p => p.id === row.productId);
                const isDropdownOpen = activeDropdownIndex === index;
                const rowQuery = rowSearchQueries[index] || '';
                const filteredRowProducts = getFilteredProductsForRow(rowQuery);

                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl relative"
                  >
                    {/* Searchable Product Selector */}
                    <div className="flex-1 w-full relative">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Product from Central Warehouse
                      </label>

                      {/* Combobox Button */}
                      <div
                        onClick={() => setActiveDropdownIndex(isDropdownOpen ? null : index)}
                        className={`w-full bg-white border rounded-xl px-3 py-2 text-sm flex items-center justify-between cursor-pointer transition shadow-2xs ${
                          isDropdownOpen
                            ? 'border-blue-500 ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {selectedProd ? (
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 shrink-0">
                              {selectedProd.sku}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {selectedProd.name}
                            </span>
                            {!hasAvailableUnits(selectedProd) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 shrink-0">
                                0 Available
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Search className="w-4 h-4 text-slate-400" />
                            <span className="text-xs sm:text-sm">Click to select available product...</span>
                          </div>
                        )}

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {selectedProd && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateRow(index, 'productId', '');
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition"
                              title="Clear product"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                        </div>
                      </div>

                      {/* Floating Dropdown Panel with Search Bar */}
                      {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
                          {/* Search Input inside Dropdown */}
                          <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-600 shrink-0" />
                            <input
                              type="text"
                              autoFocus
                              value={rowQuery}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRowSearchQueries(prev => ({ ...prev, [index]: val }));
                              }}
                              placeholder="Search available in-stock products..."
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {rowQuery && (
                              <button
                                type="button"
                                onClick={() => setRowSearchQueries(prev => ({ ...prev, [index]: '' }))}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Filtered Product Options List */}
                          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                            {filteredRowProducts.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                                No available in-stock products found {rowQuery ? `matching "${rowQuery}"` : ''}
                              </div>
                            ) : (
                              filteredRowProducts.map((p) => {
                                const isChosen = p.id === row.productId;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      updateRow(index, 'productId', p.id);
                                      setActiveDropdownIndex(null);
                                      setRowSearchQueries(prev => ({ ...prev, [index]: '' }));
                                    }}
                                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between transition cursor-pointer ${
                                      isChosen ? 'bg-blue-50/80 font-bold' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                          {p.sku}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-900 truncate">
                                          {p.name}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                        Warehouse: <span className="font-bold text-slate-800">{p.currentStock} {p.unit}</span> (paid)
                                        {(p.freeStock || 0) > 0 && (
                                          <> • <span className="font-bold text-emerald-700">{p.freeStock} free</span></>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="font-mono font-bold text-xs text-blue-600 block">
                                        {formatMoney(p.unitPrice)}
                                      </span>
                                      {isChosen && (
                                        <span className="text-[10px] text-blue-600 font-bold">Selected ✓</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quantity to Load (Paid) */}
                    <div className="w-full sm:w-28">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                          Paid Qty
                        </label>
                        {selectedProd && (
                          <span className={`text-[10px] font-mono font-semibold ${selectedProd.currentStock > 0 ? 'text-slate-500' : 'text-rose-500'}`}>
                            Max: {Math.max(0, selectedProd.currentStock)}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={selectedProd ? Math.max(0, selectedProd.currentStock) : 9999}
                        disabled={!selectedProd || selectedProd.currentStock <= 0}
                        value={row.quantity !== undefined && row.quantity !== 0 ? row.quantity : ''}
                        onChange={(e) => {
                          const entered = parseInt(e.target.value, 10) || 0;
                          const maxVal = selectedProd ? Math.max(0, selectedProd.currentStock) : 9999;
                          updateRow(index, 'quantity', Math.min(Math.max(0, entered), maxVal));
                        }}
                        placeholder="0"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold text-center focus:outline-none transition ${
                          !selectedProd || selectedProd.currentStock <= 0
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-900 border-slate-200 focus:ring-2 focus:ring-blue-500'
                        }`}
                      />
                    </div>

                    {/* Free Issue to Load */}
                    <div className="w-full sm:w-28">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                          +Free Qty
                        </label>
                        {selectedProd && (
                          <span className={`text-[10px] font-mono font-semibold ${(selectedProd.freeStock || 0) > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            Max: {Math.max(0, selectedProd.freeStock || 0)}
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={selectedProd ? Math.max(0, selectedProd.freeStock || 0) : 9999}
                        disabled={!selectedProd || (selectedProd.freeStock || 0) <= 0}
                        value={row.freeQuantity !== undefined && row.freeQuantity !== 0 ? row.freeQuantity : ''}
                        onChange={(e) => {
                          const entered = parseInt(e.target.value, 10) || 0;
                          const maxVal = selectedProd ? Math.max(0, selectedProd.freeStock || 0) : 9999;
                          updateRow(index, 'freeQuantity', Math.min(Math.max(0, entered), maxVal));
                        }}
                        placeholder="0"
                        title="Free issue stock to load (Cost: Rs. 0.00)"
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm font-bold font-mono text-center focus:outline-none transition ${
                          !selectedProd || (selectedProd.freeStock || 0) <= 0
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-emerald-50/60 text-emerald-900 border-emerald-300 focus:ring-2 focus:ring-emerald-500'
                        }`}
                      />
                    </div>

                    {/* Stock available badge & Remove */}
                    <div className="flex items-center gap-2 self-end sm:self-center pt-2 sm:pt-4">
                      {selectedProd && (
                        <div className="flex flex-col text-right">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                              selectedProd.currentStock >= row.quantity
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            Paid: {selectedProd.currentStock}
                          </span>
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono mt-0.5"
                          >
                            Free: {selectedProd.freeStock || 0}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-white transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">
                Dispatch Notes / Loading Gate Pass Remarks
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Standard morning load for Route 1 Colombo South"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Summary & Dispatch Action */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Total Units to Load
                  </span>
                  <span className="text-xl font-bold text-slate-900 font-mono">
                    {calculateTotalUnits()} Units
                  </span>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Estimated Stock Value
                  </span>
                  <span className="text-xl font-bold text-blue-600 font-mono">
                    {formatMoney(calculateTotalEstimatedValue())}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {hasDraft && (
                  <button
                    type="button"
                    onClick={handleClearLoadingForm}
                    className="px-4 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors flex items-center gap-1.5"
                    title="Clear current loading draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.99] text-white text-xs font-bold rounded-2xl shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>{submitting ? 'Transferring Stock...' : 'Confirm & Load Lorry'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Current Lorry Inventory & Active Loading Card (1 Col) */}
        <div className="space-y-4">
          {/* Active Gate Pass status */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Today's Active Loading
                </h3>
              </div>
              {activeLoading && (
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200/60">
                    {activeLoading.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintLoadingData(activeLoading);
                      setIsPrintModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-100/70 hover:bg-blue-200/80 rounded-lg transition cursor-pointer"
                    title="Print Morning Loading Sheet"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Sheet</span>
                  </button>
                </div>
              )}
            </div>

            {activeLoading ? (
              <div className="space-y-3">
                <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Gate Pass #:</span>
                    <span className="font-mono font-bold text-slate-900">{activeLoading.loadingNumber}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Loaded Units (This Lorry):</span>
                    <span className="font-bold text-slate-900">{activeLoading.totalLoadedItems}</span>
                  </div>
                  
                  {/* Total Units from all three lorries */}
                  <div className="flex justify-between items-center py-2 px-2.5 bg-blue-50/90 border border-blue-200/80 rounded-xl my-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs">
                      <Truck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Total Units (All 3 Lorries):</span>
                    </div>
                    <span className="font-mono font-bold text-blue-700 text-sm">
                      {lorries.reduce((acc, l) => {
                        const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                        const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                        return acc + (lLoaded > 0 ? lLoaded : lFloating);
                      }, 0)} Units
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Sold via Bills:</span>
                    <span className="font-bold text-emerald-600">{activeLoading.totalSoldItems}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 font-medium">
                    <span>Total Sales:</span>
                    <span className="font-bold text-blue-600">{formatMoney(activeLoading.totalSalesAmount)}</span>
                  </div>

                  {/* All 3 Lorries Units Breakdown */}
                  <div className="pt-2 border-t border-slate-200/70 mt-1 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      All 3 Lorries Loaded Units:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {lorries.map((l) => {
                        const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                        const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                        const count = lLoaded > 0 ? lLoaded : lFloating;
                        const isCurrent = l.id === selectedLorryId;
                        return (
                          <div
                            key={l.id}
                            className={`p-1.5 rounded-lg text-center border text-[11px] ${
                              isCurrent
                                ? 'bg-blue-100/70 border-blue-300 font-bold text-blue-900 shadow-2xs'
                                : 'bg-white border-slate-200/70 text-slate-700'
                            }`}
                          >
                            <span className="font-mono text-[9px] block text-slate-400 truncate">{l.vehicleNumber}</span>
                            <span className="font-mono font-bold">{count} u</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Loaded Items Breakdown:
                  </span>
                  {activeLoading.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 bg-white border border-slate-100 rounded-xl text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate max-w-[130px]">
                        {item.product.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="text-slate-500">{item.loadedQty} loaded</span>
                        <span className="text-emerald-600 font-bold">({item.soldQty} sold)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 space-y-3">
                <Boxes className="w-8 h-8 mx-auto text-slate-300" />
                <div>
                  <p className="font-medium text-slate-700">No active loading sheet for this lorry today.</p>
                  <p className="text-[11px] text-slate-400">Fill items above to dispatch this lorry.</p>
                </div>
                
                {/* Total across 3 lorries even if current lorry is empty */}
                <div className="bg-slate-50 p-3 rounded-2xl text-left border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                      Total Units (All 3 Lorries):
                    </span>
                    <span className="font-mono font-bold text-blue-700">
                      {lorries.reduce((acc, l) => {
                        const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                        const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                        return acc + (lLoaded > 0 ? lLoaded : lFloating);
                      }, 0)} Units
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {lorries.map((l) => {
                      const lLoaded = l.loadings?.[0]?.status !== 'SETTLED' ? (l.loadings?.[0]?.totalLoadedItems || 0) : 0;
                      const lFloating = l.lorryStocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
                      const count = lLoaded > 0 ? lLoaded : lFloating;
                      return (
                        <div key={l.id} className="bg-white p-1.5 rounded-lg border border-slate-200/70 text-center text-[11px]">
                          <span className="font-mono text-[9px] text-slate-400 block truncate">{l.vehicleNumber}</span>
                          <span className="font-mono font-bold text-slate-800">{count} u</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Current Floating Inventory on Lorry */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              Floating Inventory Inside Lorry
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {selectedLorry?.lorryStocks && selectedLorry.lorryStocks.length > 0 ? (
                selectedLorry.lorryStocks
                  .filter(s => s.quantity > 0)
                  .map((stock) => (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-medium text-slate-800 block">{stock.product.name}</span>
                        <span className="font-mono text-[10px] text-slate-400">{stock.product.sku}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded-lg">
                        {stock.quantity} {stock.product.unit}
                      </span>
                    </div>
                  ))
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  Lorry has 0 floating inventory currently.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Printable Loading Sheet Modal */}
      <LorryLoadingPrintModal
        loading={printLoadingData}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        defaultFormat="80mm"
      />
    </div>
  );
};
