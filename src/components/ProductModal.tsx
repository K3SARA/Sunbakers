import React, { useState, useEffect } from 'react';
import { X, Check, Layers, Package, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { isGramUnit, isKgUnit } from '../utils/weightUnits';

interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultIsRawMaterial?: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onSaved,
  defaultIsRawMaterial = false
}) => {
  const { currencyConfig } = useCurrency();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Beverages',
    unit: 'Case',
    unitPrice: '',
    costPrice: '',
    currentStock: '0',
    freeStock: '0',
    minStockAlert: '10',
    freeRatioBuy: '0',
    freeRatioGet: '0',
    isRawMaterial: false
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: product.unit,
        unitPrice: product.isRawMaterial ? '' : product.unitPrice.toString(),
        costPrice: product.costPrice.toString(),
        currentStock: product.currentStock.toString(),
        freeStock: (product.freeStock || 0).toString(),
        minStockAlert: product.minStockAlert.toString(),
        freeRatioBuy: (product.freeRatioBuy || 0).toString(),
        freeRatioGet: (product.freeRatioGet || 0).toString(),
        isRawMaterial: Boolean(product.isRawMaterial)
      });
    } else {
      setFormData({
        sku: '',
        name: '',
        category: defaultIsRawMaterial ? 'Raw Materials' : 'Beverages',
        unit: defaultIsRawMaterial ? 'g' : 'Case',
        unitPrice: '',
        costPrice: '',
        currentStock: '0',
        freeStock: '0',
        minStockAlert: '10',
        freeRatioBuy: '0',
        freeRatioGet: '0',
        isRawMaterial: defaultIsRawMaterial
      });
    }
    setError(null);
  }, [product, isOpen, defaultIsRawMaterial]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.sku.trim()) {
      setError('Please provide SKU / Code and Item Name.');
      return;
    }

    if (!formData.isRawMaterial && !formData.unitPrice) {
      setError('Please provide Unit Selling Price for finished goods.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        sku: formData.sku.trim().toUpperCase(),
        name: formData.name.trim(),
        category: formData.category.trim() || (formData.isRawMaterial ? 'Raw Materials' : 'General'),
        unit: formData.unit.trim() || (formData.isRawMaterial ? 'Kg' : 'Unit'),
        unitPrice: formData.isRawMaterial ? 0 : parseFloat(formData.unitPrice || '0'),
        costPrice: parseFloat(formData.costPrice || '0'),
        currentStock: parseInt(formData.currentStock || '0', 10),
        freeStock: parseInt(formData.freeStock || '0', 10),
        minStockAlert: parseInt(formData.minStockAlert || '10', 10),
        freeRatioBuy: formData.isRawMaterial ? 0 : (parseInt(formData.freeRatioBuy, 10) || 0),
        freeRatioGet: formData.isRawMaterial ? 0 : (parseInt(formData.freeRatioGet, 10) || 0),
        isRawMaterial: formData.isRawMaterial
      };

      if (product) {
        await ProductService.update(product.id, payload);
      } else {
        await ProductService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-slate-900">
              {product 
                ? (formData.isRawMaterial ? 'Edit Raw Material' : 'Edit Product Details')
                : (formData.isRawMaterial ? 'Add Raw Material / Component' : 'Add Finished Good Item')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {formData.isRawMaterial 
                ? 'Manufacturing ingredient or packaging component (no selling price)' 
                : 'Sellable product for sales bills and delivery fleet'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs px-5 sm:px-7 py-2.5 font-medium border-b border-rose-100 shrink-0">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4 overflow-y-auto">
          {/* Item Classification Segmented Control */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Item Classification
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    isRawMaterial: false,
                    category: prev.category === 'Raw Materials' ? 'Beverages' : prev.category,
                    unit: ['Kg', 'g', 'Litre', 'ml'].includes(prev.unit) ? 'Case' : prev.unit
                  }));
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  !formData.isRawMaterial
                    ? 'bg-white text-blue-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Finished Good (Sellable)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    isRawMaterial: true,
                    category: prev.category === 'Beverages' ? 'Raw Materials' : prev.category,
                    unit: prev.unit === 'Case' ? 'Kg' : prev.unit,
                    unitPrice: ''
                  }));
                }}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  formData.isRawMaterial
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Raw Material (Manufacturing)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                SKU / Material Code *
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={e => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder={formData.isRawMaterial ? 'e.g. RAW-SUG-01' : 'e.g. BEV-003'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder={formData.isRawMaterial ? 'e.g. Raw Materials / Ingredients' : 'e.g. Beverages'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {formData.isRawMaterial ? 'Raw Material / Component Name *' : 'Product Description / Name *'}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder={formData.isRawMaterial ? 'e.g. Refined Cane Sugar' : 'e.g. Premium Cold Brew Coffee'}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Unit Type
              </label>
              <select
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                {formData.isRawMaterial ? (
                  <>
                    <option value="g">g (Grams)</option>
                    <option value="Kg">Kg (Kilograms)</option>
                    <option value="Litre">Litre</option>
                    <option value="ml">ml (Millilitre)</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Bag">Bag</option>
                    <option value="Box">Box</option>
                    <option value="Unit">Unit</option>
                  </>
                ) : (
                  <>
                    <option value="Case">Case</option>
                    <option value="Box">Box</option>
                    <option value="Carton">Carton</option>
                    <option value="Bag">Bag</option>
                    <option value="Pack">Pack</option>
                    <option value="Unit">Unit</option>
                  </>
                )}
              </select>
            </div>

            {formData.isRawMaterial ? (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-purple-700">
                    Purchase / Cost Price ({currencyConfig.symbol}) *
                  </label>
                  {isGramUnit(formData.unit) && (
                    <span className="text-[10px] text-purple-600 font-semibold">
                      Base unit: Grams (g)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={formData.costPrice}
                  onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-purple-50/40 border border-purple-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />

                {/* Gram to KG cost helper */}
                {isGramUnit(formData.unit) && (
                  <div className="mt-1.5 p-2 bg-purple-50/60 border border-purple-100 rounded-xl space-y-1">
                    {parseFloat(formData.costPrice) > 0 && (
                      <div className="text-[11px] font-semibold text-purple-900 flex items-center justify-between">
                        <span>Rate: <strong>Rs. {formData.costPrice} / gram</strong></span>
                        <span className="font-mono text-purple-700 font-bold">
                          = Rs. {(parseFloat(formData.costPrice) * 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 1 KG
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10.5px] text-slate-500 font-medium">Or enter 1 KG Price:</span>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 350"
                        className="w-24 bg-white border border-purple-200 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        onChange={(e) => {
                          const kgVal = parseFloat(e.target.value);
                          if (!isNaN(kgVal) && kgVal >= 0) {
                            setFormData(prev => ({ ...prev, costPrice: (kgVal / 1000).toString() }));
                          }
                        }}
                      />
                      <span className="text-[10px] text-purple-600 font-medium">Auto-divides by 1,000 for per-gram cost</span>
                    </div>
                  </div>
                )}

                <span className="text-[10px] text-slate-400 mt-1 block">
                  Acquisition cost per {formData.unit} (used to compute recipe batch costs)
                </span>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Sale Price ({currencyConfig.symbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.unitPrice}
                    onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Cost Price ({currencyConfig.symbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costPrice}
                    onChange={e => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                </div>
              </>
            )}
          </div>

          {/* Raw Material Info Banner */}
          {formData.isRawMaterial && (
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-2xl flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-900">
                  No Selling Price Required
                </p>
                <p className="text-[11px] text-purple-700 mt-0.5 leading-relaxed">
                  Raw materials are used for recipe formulation in manufacturing runs. They are deducted from inventory during batch production and are excluded from retail billing.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-1">
            {!product && (
              <>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Starting Paid Stock ({formData.unit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.currentStock}
                    onChange={e => setFormData({ ...formData, currentStock: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
                  />
                  {/* Gram stock helper */}
                  {formData.isRawMaterial && isGramUnit(formData.unit) && (
                    <div className="mt-1 space-y-1">
                      {parseFloat(formData.currentStock) > 0 && (
                        <div className="text-[11px] font-semibold text-purple-700">
                          = {(parseFloat(formData.currentStock) / 1000).toFixed(2)} KG
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-500">Or enter in KG:</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g. 50"
                          className="w-20 bg-white border border-purple-200 rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                          onChange={(e) => {
                            const kg = parseFloat(e.target.value);
                            if (!isNaN(kg) && kg >= 0) {
                              setFormData(prev => ({ ...prev, currentStock: Math.round(kg * 1000).toString() }));
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                      Free Issue Stock
                    </label>
                    <span className="text-[10px] font-bold px-1 rounded bg-emerald-100 text-emerald-800 font-mono">
                      Cost: 0
                    </span>
                  </div>
                  <input
                    type="number"
                    step="any"
                    value={formData.freeStock}
                    onChange={e => setFormData({ ...formData, freeStock: e.target.value })}
                    placeholder="0"
                    className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Low Stock Alert Threshold ({formData.unit})
              </label>
              <input
                type="number"
                step="any"
                value={formData.minStockAlert}
                onChange={e => setFormData({ ...formData, minStockAlert: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
          </div>

          {/* Trade Promotion / Free Issue Scheme (Finished goods only) */}
          {!formData.isRawMaterial && (
            <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Trade Promotion Scheme (Free Issue Offer)
                </span>
                <span className="text-[10px] text-blue-600 font-semibold bg-blue-100/70 px-2 py-0.5 rounded-full">
                  Optional
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Buy Target (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.freeRatioBuy}
                    onChange={e => setFormData({ ...formData, freeRatioBuy: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    Get Free (Units)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.freeRatioGet}
                    onChange={e => setFormData({ ...formData, freeRatioGet: e.target.value })}
                    placeholder="e.g. 1"
                    className="bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                {parseInt(formData.freeRatioBuy, 10) > 0 && parseInt(formData.freeRatioGet, 10) > 0
                  ? `Active offer: Buy ${formData.freeRatioBuy} get ${formData.freeRatioGet} Free. Office Bill Entry will auto-suggest free units.`
                  : 'No default offer. Free issues can still be entered manually during bill entry.'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-white rounded-xl text-sm font-semibold shadow-sm transition flex items-center gap-1.5 ${
                formData.isRawMaterial 
                  ? 'bg-purple-600 hover:bg-purple-700' 
                  : 'bg-[#0071E3] hover:bg-[#0077ED]'
              }`}
            >
              <Check className="w-4 h-4" /> 
              {loading 
                ? 'Saving...' 
                : (product 
                    ? (formData.isRawMaterial ? 'Update Raw Material' : 'Save Product') 
                    : (formData.isRawMaterial ? 'Add Raw Material' : 'Add Product')
                  )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
