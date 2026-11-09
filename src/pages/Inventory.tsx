import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  ArrowDownRight, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  Package,
  Boxes,
  Truck,
  FileSpreadsheet
} from 'lucide-react';
import { ProductService } from '../services/api';
import { Product } from '../types';
import { ProductModal } from '../components/ProductModal';
import { StockAdjustModal } from '../components/StockAdjustModal';
import { BulkStockImportModal } from '../components/BulkStockImportModal';
import { useCurrency } from '../context/CurrencyContext';

interface InventoryProps {
  onNavigateToSuppliers?: () => void;
}

export const Inventory: React.FC<InventoryProps> = ({ onNavigateToSuppliers }) => {
  const { formatMoney } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [materialFilter, setMaterialFilter] = useState<'ALL' | 'FINISHED' | 'RAW'>('ALL');

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);

  const loadProducts = async () => {
    try {
      const data = await ProductService.getAll(lowStockOnly, search);
      setProducts(data);
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [lowStockOnly, search]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product? Products with order history cannot be deleted.')) {
      try {
        await ProductService.delete(id);
        loadProducts();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to delete product');
      }
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
  };

  const openAdjustModal = (product: Product) => {
    setAdjustingProduct(product);
    setIsAdjustModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Boxes className="w-4 h-4" />
            <span>Step 1: Central Warehouse Stock</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Central Warehouse Stock
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Bulk stock inward from suppliers. Items here will be loaded into the 3 lorries every morning.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => setIsBulkImportModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-semibold rounded-2xl border border-slate-200/90 hover:border-slate-300 transition text-xs shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Bulk Import (.CSV)
          </button>

          {onNavigateToSuppliers && (
            <button
              onClick={onNavigateToSuppliers}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-2xl border border-emerald-200 transition text-xs"
            >
              <Package className="w-4 h-4 text-emerald-600" />
              Receive Inbound GRN
            </button>
          )}
          <button
            onClick={openAddModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-sm transition text-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Add New Product
          </button>
        </div>
      </div>

      {/* Stock Valuation & Free Issue Summary Cards */}
      {(() => {
        const totalInvestedCost = products.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0);
        const totalFreeUnits = products.reduce((sum, p) => sum + (p.freeStock || 0), 0);
        const totalFreeMarketValue = products.reduce((sum, p) => sum + ((p.freeStock || 0) * (p.unitPrice || 0)), 0);
        const totalPhysicalUnits = products.reduce((sum, p) => sum + p.currentStock + (p.freeStock || 0), 0);
        const totalRealizableValue = products.reduce((sum, p) => sum + ((p.currentStock + (p.freeStock || 0)) * (p.isRawMaterial ? p.costPrice : p.unitPrice)), 0);

        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Stock Cost (Invested)</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                {formatMoney(totalInvestedCost)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Paid inventory only • Free issue cost is Rs. 0.00</p>
            </div>

            <div className="bg-emerald-50/70 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-emerald-200/70 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-emerald-800">Free Issue Stock</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900 font-mono">
                  Cost: Rs. 0.00
                </span>
              </div>
              <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-900">
                {totalFreeUnits.toLocaleString()} <span className="text-xs font-sans font-medium text-emerald-700">units</span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Sales Value: <span className="font-mono font-semibold">{formatMoney(totalFreeMarketValue)}</span>
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Physical Stock</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                {totalPhysicalUnits.toLocaleString()} <span className="text-xs font-sans font-medium text-slate-500">units</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Paid stock + Free issue units in warehouse</p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Stock Realizable Value</span>
              <div className="text-xl sm:text-2xl font-bold font-mono text-blue-600">
                {formatMoney(totalRealizableValue)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Full commercial valuation on hand</p>
            </div>
          </div>
        );
      })()}

      {/* Controls Bar: Search & Low Stock Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU, product name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#0071E3] font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setMaterialFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                materialFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setMaterialFilter('FINISHED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                materialFilter === 'FINISHED'
                  ? 'bg-white text-blue-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Finished Goods
            </button>
            <button
              onClick={() => setMaterialFilter('RAW')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                materialFilter === 'RAW'
                  ? 'bg-white text-purple-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw Materials
            </button>
          </div>

          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
              lowStockOnly
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{lowStockOnly ? 'Low Stock Only' : 'Low Stock Alert'}</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200/70 rounded-2xl sm:rounded-3xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <table className="w-full text-left border-collapse text-sm min-w-[680px]">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-7 py-4">SKU</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price / Cost</th>
                <th className="px-6 py-4">Warehouse Stock (Paid + Free)</th>
                <th className="px-6 py-4">In Lorries</th>
                <th className="px-7 py-4 text-right">Inward / Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(() => {
                const filteredProducts = products.filter(p => {
                  if (materialFilter === 'FINISHED') return !p.isRawMaterial;
                  if (materialFilter === 'RAW') return Boolean(p.isRawMaterial);
                  return true;
                });

                if (filteredProducts.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="px-7 py-16 text-center text-slate-400">
                        No products found matching your search and filter.
                      </td>
                    </tr>
                  );
                }

                return filteredProducts.map((p) => {
                  const isLow = p.currentStock <= p.minStockAlert;
                  const regularInLorries = p.lorryStocks?.reduce((acc, s) => acc + s.quantity, 0) || 0;
                  const freeInLorries = p.lorryStocks?.reduce((acc, s) => acc + (s.freeQuantity || 0), 0) || 0;
                  const totalInLorries = regularInLorries + freeInLorries;
                  const freeUnits = p.freeStock || 0;
                  const totalStock = p.currentStock + freeUnits;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-7 py-4 font-mono font-bold text-slate-900">
                        {p.sku}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900 block text-sm">{p.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400">Pack: {p.unit}</span>
                          {p.isRawMaterial && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-mono">
                              Raw Material
                            </span>
                          )}
                          {p.freeRatioBuy && p.freeRatioBuy > 0 && p.freeRatioGet ? (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded-md text-xs">
                              Promo: Buy {p.freeRatioBuy} + {p.freeRatioGet} Free
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                        <span className="px-2.5 py-1 bg-slate-100 rounded-lg">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 font-mono">
                        {p.isRawMaterial ? (
                          <div className="flex flex-col">
                            <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md w-fit">
                              Cost: {formatMoney(p.costPrice)}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5 font-sans font-normal">
                              No selling price
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span>{formatMoney(p.unitPrice)}</span>
                            <span className="text-[10px] text-slate-400 font-sans font-normal">
                              Cost: {formatMoney(p.costPrice)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono font-bold text-sm px-3 py-0.5 rounded-full ${
                                p.currentStock <= 0
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isLow
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                              title="Paid Warehouse Stock"
                            >
                              {p.currentStock} {p.unit}
                            </span>
                            {isLow && (
                              <span className="text-xs font-bold text-amber-600" title={`Alert at ≤ ${p.minStockAlert}`}>
                                (Low)
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                              title="Free Issue Stock (Cost: Rs. 0.00)"
                            >
                              +{freeUnits} Free Issue
                            </span>
                            {((p.damageStock || 0) > 0) && (
                              <span
                                className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200/80"
                                title="Damaged / Expired stock from customer returns"
                              >
                                {p.damageStock} Damaged
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Total: {totalStock})
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-semibold text-blue-600 flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-blue-500" />
                            {totalInLorries} {p.unit}
                          </span>
                          {freeInLorries > 0 && (
                            <span className="text-[10px] text-emerald-600 font-mono mt-0.5">
                              ({regularInLorries} paid + {freeInLorries} free)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-7 py-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openAdjustModal(p)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl transition inline-flex items-center gap-1 border border-emerald-200/60"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" /> Bulk Inward
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition inline-block align-middle"
                          title="Edit Details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition inline-block align-middle"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        product={editingProduct}
        defaultIsRawMaterial={materialFilter === 'RAW'}
        onClose={() => setIsProductModalOpen(false)}
        onSaved={loadProducts}
      />

      <StockAdjustModal
        isOpen={isAdjustModalOpen}
        product={adjustingProduct}
        onClose={() => setIsAdjustModalOpen(false)}
        onAdjusted={loadProducts}
      />

      <BulkStockImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onSuccess={loadProducts}
        existingProducts={products}
      />
    </div>
  );
};
