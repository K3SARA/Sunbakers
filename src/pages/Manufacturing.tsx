import React, { useState, useEffect } from 'react';
import {
  Factory,
  Plus,
  Layers,
  Sparkles,
  Boxes,
  CheckCircle2,
  AlertCircle,
  X,
  PackageCheck,
  Trash2,
  Check,
  Edit2
} from 'lucide-react';
import { Recipe, ProductionRun, Product, ManufacturingSummary } from '../types';
import { ManufacturingService, ProductService } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { ProductModal } from '../components/ProductModal';
import {
  isGramUnit,
  isKgUnit,
  isWeightUnit,
  formatIngredientQty,
  convertToInventoryBaseQty
} from '../utils/weightUnits';

interface RecipeRowItem {
  componentProductId: string;
  quantity: string | number;
  unit: string;
}

export const Manufacturing: React.FC = () => {
  const { formatMoney } = useCurrency();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'RUNS' | 'RECIPES' | 'MATERIALS'>('RUNS');

  // Core Data
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productionRuns, setProductionRuns] = useState<ProductionRun[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<ManufacturingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isRunModalOpen, setIsRunModalOpen] = useState<boolean>(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState<boolean>(false);
  const [selectedRunDetail, setSelectedRunDetail] = useState<ProductionRun | null>(null);
  const [isRawMaterialModalOpen, setIsRawMaterialModalOpen] = useState<boolean>(false);
  const [editingRawMaterial, setEditingRawMaterial] = useState<Product | null>(null);

  // Notifications
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form: Run Production
  const [runRecipeId, setRunRecipeId] = useState<string>('');
  const [runTargetQty, setRunTargetQty] = useState<string>('100');
  const [runOverhead, setRunOverhead] = useState<string>('0');
  const [runProducedBy, setRunProducedBy] = useState<string>('Production Line 1');
  const [runNotes, setRunNotes] = useState<string>('');
  const [submittingRun, setSubmittingRun] = useState<boolean>(false);

  // Form: New Recipe
  const [recipeName, setRecipeName] = useState<string>('');
  const [recipeProductId, setRecipeProductId] = useState<string>('');
  const [recipeYield, setRecipeYield] = useState<string>('1');
  const [recipeOverhead, setRecipeOverhead] = useState<string>('0');
  const [recipeNotes, setRecipeNotes] = useState<string>('');
  const [recipeItems, setRecipeItems] = useState<RecipeRowItem[]>([
    { componentProductId: '', quantity: '', unit: 'KG' }
  ]);
  const [submittingRecipe, setSubmittingRecipe] = useState<boolean>(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [recList, runList, prodList, sumData] = await Promise.all([
        ManufacturingService.getRecipes(),
        ManufacturingService.getProductionRuns(),
        ProductService.getAll(),
        ManufacturingService.getSummary()
      ]);

      setRecipes(recList);
      setProductionRuns(runList);
      setProducts(prodList);
      setSummary(sumData);

      if (recList.length > 0 && !runRecipeId) {
        setRunRecipeId(recList[0].id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load manufacturing data.');
    } finally {
      setLoading(false);
    }
  };

  // Open Run Modal for a specific recipe
  const openRunModalWithRecipe = (recId: string) => {
    setRunRecipeId(recId);
    setRunTargetQty('100');
    setRunOverhead('0');
    setIsRunModalOpen(true);
  };

  // Handle Execute Production Run
  const handleExecuteRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runRecipeId || !runTargetQty || parseInt(runTargetQty, 10) <= 0) {
      setErrorMessage('Please select a valid recipe and enter a positive quantity.');
      return;
    }

    try {
      setSubmittingRun(true);
      setErrorMessage(null);

      const targetQty = parseInt(runTargetQty, 10);
      const overhead = parseFloat(runOverhead || '0');

      const created = await ManufacturingService.createProductionRun({
        recipeId: runRecipeId,
        targetQuantity: targetQty,
        actualQuantity: targetQty,
        overheadCost: overhead,
        producedBy: runProducedBy.trim() || undefined,
        notes: runNotes.trim() || undefined,
        completeImmediately: true
      });

      setSuccessMessage(
        `Batch ${created.batchNumber} completed! Added ${created.actualQuantity} units of ${created.recipe?.product?.name || 'Finished Goods'} to Central Warehouse stock.`
      );
      setIsRunModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to execute production batch.');
    } finally {
      setSubmittingRun(false);
    }
  };

  // Recipe Component Row Handlers
  const addRecipeRow = () => {
    setRecipeItems([...recipeItems, { componentProductId: '', quantity: '', unit: 'KG' }]);
  };

  const removeRecipeRow = (idx: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== idx));
  };

  const updateRecipeRow = (idx: number, field: keyof RecipeRowItem, val: any) => {
    const updated = [...recipeItems];
    if (field === 'componentProductId') {
      const comp = rawMaterials.find(r => r.id === val);
      const isWeight = comp && (isGramUnit(comp.unit) || isKgUnit(comp.unit));
      const defaultUnit = isWeight ? 'KG' : (comp?.unit || 'Unit');
      updated[idx] = {
        ...updated[idx],
        componentProductId: val,
        unit: defaultUnit
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: val };
    }
    setRecipeItems(updated);
  };

  // Handle Create Recipe
  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeName.trim() || !recipeProductId) {
      setErrorMessage('Recipe name and finished product are required.');
      return;
    }

    const validItems = recipeItems
      .filter(i => i.componentProductId && parseFloat(i.quantity as any) > 0)
      .map(i => {
        const comp = rawMaterials.find(r => r.id === i.componentProductId);
        const rawQty = parseFloat(i.quantity as any);
        const baseQty = convertToInventoryBaseQty(rawQty, i.unit || 'KG', comp?.unit);

        return {
          componentProductId: i.componentProductId,
          quantity: baseQty,
          notes: i.unit === 'KG' && comp && isGramUnit(comp.unit) ? `${rawQty} KG` : undefined
        };
      });

    if (validItems.length === 0) {
      setErrorMessage('Please add at least 1 raw material / component with a valid quantity.');
      return;
    }

    try {
      setSubmittingRecipe(true);
      setErrorMessage(null);

      await ManufacturingService.createRecipe({
        name: recipeName.trim(),
        productId: recipeProductId,
        outputYield: parseInt(recipeYield || '1', 10),
        estimatedOverheadCost: parseFloat(recipeOverhead || '0'),
        notes: recipeNotes.trim() || undefined,
        items: validItems
      });

      setSuccessMessage(`BOM Recipe "${recipeName.trim()}" created successfully!`);
      setIsRecipeModalOpen(false);
      setRecipeName('');
      setRecipeProductId('');
      setRecipeYield('1');
      setRecipeOverhead('0');
      setRecipeNotes('');
      setRecipeItems([{ componentProductId: '', quantity: '', unit: 'KG' }]);
      await loadAllData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to create BOM recipe.');
    } finally {
      setSubmittingRecipe(false);
    }
  };

  // Delete Recipe
  const handleDeleteRecipe = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the recipe "${name}"?`)) return;
    try {
      await ManufacturingService.deleteRecipe(id);
      setSuccessMessage(`Recipe "${name}" deleted.`);
      await loadAllData();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Failed to delete recipe.');
    }
  };

  // Selected recipe preview in Run Modal
  const activeRunRecipe = recipes.find(r => r.id === runRecipeId);
  const targetOutput = parseInt(runTargetQty || '0', 10);
  const multiplier = activeRunRecipe && activeRunRecipe.outputYield > 0
    ? targetOutput / activeRunRecipe.outputYield
    : 1;

  // Raw materials list (ingredients & packaging)
  const rawMaterials = products.filter(p => Boolean(p.isRawMaterial) || p.category.toLowerCase().includes('raw') || p.category.toLowerCase().includes('pack'));
  // Finished goods list (sellable products produced by manufacturing)
  const finishedGoods = products.filter(p => !p.isRawMaterial && !p.category.toLowerCase().includes('raw') && !p.category.toLowerCase().includes('pack'));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 sm:space-y-6 overflow-y-auto h-full pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/80 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 mb-1">
            <Factory className="w-4 h-4" />
            <span>Manufacturing & Production Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Production & BOM
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Formulate Bill of Materials (BOM), produce finished goods, and auto-sync raw materials stock.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
          <button
            onClick={() => setIsRecipeModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200/80 hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold rounded-2xl shadow-2xs transition text-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New BOM Recipe
          </button>

          <button
            onClick={() => {
              if (recipes.length === 0) {
                alert('Please create a BOM Recipe first before running production.');
                setIsRecipeModalOpen(true);
                return;
              }
              setIsRunModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0071E3] hover:bg-blue-600 active:scale-[0.98] text-white font-bold rounded-2xl shadow-sm transition text-xs"
          >
            <PackageCheck className="w-4 h-4 stroke-[2.5]" />
            Run Production Batch
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs sm:text-sm font-medium animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Minimal KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-3xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Completed Batches
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {summary?.totalBatchesCount || productionRuns.length}
          </div>
          <span className="text-[10px] font-medium text-slate-500 mt-1 block">Production runs executed</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-3xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Manufactured Output
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-600">
            {summary?.totalUnitsManufactured?.toLocaleString() || 0} Units
          </div>
          <span className="text-[10px] font-medium text-slate-500 mt-1 block">Added to warehouse inventory</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-3xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Active BOM Formulas
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-blue-600">
            {recipes.length} Recipes
          </div>
          <span className="text-[10px] font-medium text-slate-500 mt-1 block">Configured product recipes</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-4 sm:p-5 rounded-3xl shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Production Spend
          </span>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
            {formatMoney(summary?.totalProductionCost || 0)}
          </div>
          <span className="text-[10px] font-medium text-slate-500 mt-1 block">Direct materials & overhead</span>
        </div>
      </div>

      {/* Clean Tab Navigator */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl max-w-md border border-slate-200/60">
        <button
          type="button"
          onClick={() => setActiveTab('RUNS')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'RUNS'
              ? 'bg-white text-blue-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Production Runs ({productionRuns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('RECIPES')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'RECIPES'
              ? 'bg-white text-blue-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>BOM Recipes ({recipes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('MATERIALS')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeTab === 'MATERIALS'
              ? 'bg-white text-blue-600 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Raw Materials</span>
        </button>
      </div>

      {/* Tab 1: Production Runs List */}
      {activeTab === 'RUNS' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Executed Production Batches
            </h2>
            <span className="text-xs font-mono text-slate-400">
              {productionRuns.length} runs recorded
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading production records...</div>
          ) : productionRuns.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Factory className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium">No production runs executed yet.</p>
              <button
                onClick={() => {
                  if (recipes.length === 0) setIsRecipeModalOpen(true);
                  else setIsRunModalOpen(true);
                }}
                className="px-4 py-2 bg-[#0071E3] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                {recipes.length === 0 ? 'Create First Recipe' : 'Run First Batch'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Batch No</th>
                    <th className="py-3 px-4">Finished Product</th>
                    <th className="py-3 px-4">Output Qty</th>
                    <th className="py-3 px-4">Unit Cost</th>
                    <th className="py-3 px-4">Total Batch Cost</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {productionRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-5 font-mono font-bold text-blue-700">
                        {run.batchNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {run.recipe?.product?.name || 'Product'}
                        <span className="block text-[10px] font-mono text-slate-400">
                          Formula: {run.recipe?.name}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                        {run.actualQuantity > 0 ? run.actualQuantity : run.targetQuantity} {run.recipe?.product?.unit || 'Units'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {formatMoney(run.unitCost)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {formatMoney(run.totalProductionCost)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            run.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        {new Date(run.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedRunDetail(run)}
                          className="px-2.5 py-1 text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-semibold rounded-lg text-xs transition"
                        >
                          View BOM
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: BOM Recipes */}
      {activeTab === 'RECIPES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs hover:shadow-sm transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-2.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg">
                    {recipe.code}
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    Yield: {recipe.outputYield} {recipe.product?.unit || 'Units'}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">{recipe.name}</h3>
                <p className="text-xs text-blue-600 font-medium mt-0.5">
                  Finished Good: {recipe.product?.name}
                </p>

                {recipe.notes && (
                  <p className="text-[11px] text-slate-400 italic mt-1.5 line-clamp-2">
                    {recipe.notes}
                  </p>
                )}

                {/* Ingredients & Raw Materials Breakdown */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Components Required Per {recipe.outputYield} Units:
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {recipe.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50"
                      >
                        <span className="font-medium text-slate-700 truncate max-w-[170px]">
                          {item.componentProduct?.name || 'Raw Material'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatIngredientQty(item.quantity, item.componentProduct?.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recipe Card Footer */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    Est. Overhead
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {formatMoney(recipe.estimatedOverheadCost || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition"
                    title="Delete Recipe"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => openRunModalWithRecipe(recipe.id)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Produce</span>
                  </button>
                </div>
              </div>
            </div>
          ))}

          {recipes.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-200/80 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No BOM Recipes Defined</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create a Bill of Materials formula specifying which raw materials produce your finished goods.
              </p>
              <button
                onClick={() => setIsRecipeModalOpen(true)}
                className="px-4 py-2 bg-[#0071E3] text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Create First BOM Recipe
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Raw Materials Inventory */}
      {activeTab === 'MATERIALS' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Raw Materials & Ingredients Stock
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Central warehouse stock of components consumed in manufacturing recipes (no selling price required).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl">
                {rawMaterials.length} Items
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingRawMaterial(null);
                  setIsRawMaterialModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Raw Material</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-5">SKU</th>
                  <th className="py-3 px-4">Component Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Unit Cost Price</th>
                  <th className="py-3 px-4">Stock on Hand</th>
                  <th className="py-3 px-4">Inventory Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rawMaterials.map((prod) => {
                  const isLow = prod.currentStock <= prod.minStockAlert;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-5 font-mono text-slate-400 font-bold">{prod.sku}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{prod.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
                          {prod.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-purple-700">
                        {formatMoney(prod.costPrice)}
                        <span className="text-[10px] text-slate-400 block font-normal font-sans">
                          per {prod.unit}
                          {isGramUnit(prod.unit) && (
                            <span className="text-purple-600 block font-semibold">
                              ({formatMoney(prod.costPrice * 1000)} / KG)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {prod.currentStock.toLocaleString()} {prod.unit}
                        {isGramUnit(prod.unit) && prod.currentStock >= 1000 && (
                          <span className="text-[10px] text-purple-700 block font-semibold">
                            (= {(prod.currentStock / 1000).toFixed(2)} KG)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                        {formatMoney(prod.currentStock * prod.costPrice)}
                      </td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                            Low (Min {prod.minStockAlert})
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            Sufficient
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => {
                            setEditingRawMaterial(prod);
                            setIsRawMaterialModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition inline-flex items-center gap-1 text-[11px] font-semibold"
                          title="Edit Raw Material"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {rawMaterials.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-xs text-slate-400 space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">No Raw Materials Recorded Yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Add ingredients or packaging materials without needing a selling price.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRawMaterial(null);
                          setIsRawMaterialModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Raw Material</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Run Production Batch */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Factory className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Run Production Batch</h2>
                  <p className="text-xs text-slate-500">Manufactures finished goods & deducts raw materials.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRunModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRun} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Recipe Selector */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Select BOM Recipe *
                </label>
                <select
                  value={runRecipeId}
                  onChange={(e) => setRunRecipeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code}) • Produces {r.product?.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output Target Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Target Finished Units *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={runTargetQty}
                    onChange={(e) => setRunTargetQty(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Unit: {activeRunRecipe?.product?.unit || 'Units'}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Overhead Cost (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={runOverhead}
                    onChange={(e) => setRunOverhead(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Labor / electricity</span>
                </div>
              </div>

              {/* Raw Materials Requirement Live Preview */}
              {activeRunRecipe && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Materials Required for {targetOutput} Units:
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      Batch Multiplier: {multiplier.toFixed(2)}x
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {activeRunRecipe.items.map((item) => {
                      const needed = item.quantity * multiplier;
                      const avail = item.componentProduct?.currentStock || 0;
                      const hasEnough = avail >= needed;

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-white border border-slate-200/60"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {item.componentProduct?.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Stock: {formatIngredientQty(avail, item.componentProduct?.unit)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              {formatIngredientQty(needed, item.componentProduct?.unit)}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                hasEnough ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {hasEnough ? 'Sufficient' : 'Short'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Operator & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Production Line / Operator
                  </label>
                  <input
                    type="text"
                    value={runProducedBy}
                    onChange={(e) => setRunProducedBy(e.target.value)}
                    placeholder="e.g. Line 1 / Shift A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Batch Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={runNotes}
                    onChange={(e) => setRunNotes(e.target.value)}
                    placeholder="e.g. Standard production run"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </form>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRunModalOpen(false)}
                disabled={submittingRun}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRun}
                disabled={submittingRun || !runRecipeId || targetOutput <= 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{submittingRun ? 'Executing Batch...' : 'Confirm & Produce Batch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: New BOM Recipe Modal */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Define BOM Recipe</h2>
                  <p className="text-xs text-slate-500">Configure finished product recipe and raw materials.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRecipeModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Recipe Name *
                </label>
                <input
                  type="text"
                  required
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="e.g. 500ml Bottled Water (Pack of 12)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Target Finished Product *
                  </label>
                  <select
                    required
                    value={recipeProductId}
                    onChange={(e) => setRecipeProductId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="">Select Finished Good to Produce...</option>
                    {finishedGoods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Standard Batch Yield (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={recipeYield}
                    onChange={(e) => setRecipeYield(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Recipe Items Table */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Components & Raw Materials *
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Raw ingredients consumed per batch
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRawMaterial(null);
                        setIsRawMaterialModalOpen(true);
                      }}
                      className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Raw Material</span>
                    </button>
                    <button
                      type="button"
                      onClick={addRecipeRow}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {recipeItems.map((row, idx) => {
                    const selectedComp = rawMaterials.find(p => p.id === row.componentProductId);
                    const isWeight = selectedComp && isWeightUnit(selectedComp.unit);
                    const numQty = parseFloat(row.quantity as string) || 0;

                    return (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={row.componentProductId}
                            onChange={(e) => updateRecipeRow(idx, 'componentProductId', e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                          >
                            <option value="">Select Raw Material / Ingredient...</option>
                            {rawMaterials.length === 0 ? (
                              <option value="" disabled>No raw materials registered — click "+ New Raw Material" above</option>
                            ) : (
                              rawMaterials.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} • Stock: {formatIngredientQty(p.currentStock, p.unit)}
                                </option>
                              ))
                            )}
                          </select>

                          <div className="w-24">
                            <input
                              type="number"
                              step="any"
                              min="0.0001"
                              required
                              value={row.quantity}
                              onChange={(e) => updateRecipeRow(idx, 'quantity', e.target.value)}
                              placeholder={isWeight ? 'e.g. 1.5' : 'Qty'}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                            />
                          </div>

                          {isWeight ? (
                            <select
                              value={row.unit || 'KG'}
                              onChange={(e) => updateRecipeRow(idx, 'unit', e.target.value)}
                              className="w-20 bg-purple-50 border border-purple-200 text-purple-900 rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                              title="Recipe unit (KG or g)"
                            >
                              <option value="KG">KG</option>
                              <option value="g">g</option>
                            </select>
                          ) : (
                            <span className="w-16 px-2 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold text-center shrink-0">
                              {selectedComp?.unit || 'Unit'}
                            </span>
                          )}

                          {recipeItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRecipeRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Remove item"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Live Conversion Helper Note */}
                        {isWeight && numQty > 0 && selectedComp && isGramUnit(selectedComp.unit) && (
                          <div className="text-[11px] font-medium text-purple-800 bg-purple-50 px-2.5 py-1 rounded-xl flex items-center justify-between border border-purple-100 animate-fadeIn">
                            <span>
                              Recipe: <strong>{row.quantity} {row.unit || 'KG'}</strong>
                            </span>
                            <span className="font-mono font-bold text-purple-700">
                              {row.unit === 'g'
                                ? (numQty >= 1000 ? `= ${(numQty / 1000).toFixed(2)} KG` : 'Direct Grams')
                                : `= ${(numQty * 1000).toLocaleString()} grams in inventory`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overhead & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Est. Overhead Cost per Batch
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={recipeOverhead}
                    onChange={(e) => setRecipeOverhead(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Recipe Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={recipeNotes}
                    onChange={(e) => setRecipeNotes(e.target.value)}
                    placeholder="e.g. Standard formula 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </form>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                disabled={submittingRecipe}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRecipe}
                disabled={submittingRecipe || !recipeName.trim() || !recipeProductId}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{submittingRecipe ? 'Saving Recipe...' : 'Save BOM Recipe'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Production Run Detail & Consumed Items Modal */}
      {selectedRunDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {selectedRunDetail.batchNumber}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {selectedRunDetail.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {selectedRunDetail.recipe?.product?.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedRunDetail(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Batch Cost Summary Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Output Manufactured
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-600">
                    {selectedRunDetail.actualQuantity} Units
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Calculated Unit Cost
                  </span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {formatMoney(selectedRunDetail.unitCost)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Raw Materials Cost
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    {formatMoney(selectedRunDetail.totalRawMaterialCost)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Overhead Cost
                  </span>
                  <span className="font-mono font-bold text-slate-700">
                    {formatMoney(selectedRunDetail.overheadCost)}
                  </span>
                </div>
              </div>

              {/* Consumed Raw Materials List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Raw Materials Consumed in this Batch:
                </span>
                <div className="space-y-1.5">
                  {selectedRunDetail.items?.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-slate-200/60 bg-white flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{item.product?.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatMoney(item.unitCost)} per {item.product?.unit}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-900 block">
                          {formatIngredientQty(item.actualQuantity, item.product?.unit)}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatMoney(item.lineCost)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedRunDetail(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Material Add/Edit Modal */}
      <ProductModal
        isOpen={isRawMaterialModalOpen}
        product={editingRawMaterial}
        defaultIsRawMaterial={true}
        onClose={() => {
          setIsRawMaterialModalOpen(false);
          setEditingRawMaterial(null);
        }}
        onSaved={loadAllData}
      />
    </div>
  );
};
