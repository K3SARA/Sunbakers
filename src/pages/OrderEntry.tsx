import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Trash2, 
  ArrowLeft, 
  Check, 
  AlertCircle,
  Plus, 
  Minus,
  Receipt,
  UserCheck
} from 'lucide-react';
import { CustomerService, ProductService, OrderService } from '../services/api';
import { Product, Customer, Order } from '../types';
import { useCurrency } from '../context/CurrencyContext';

interface OrderEntryProps {
  onBack: () => void;
  onOrderCompleted: (order: Order) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const OrderEntry: React.FC<OrderEntryProps> = ({ onBack, onOrderCompleted }) => {
  const { formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [paymentStatus, setPaymentStatus] = useState<string>('UNPAID');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          CustomerService.getAll(),
          ProductService.getAll()
        ]);
        setCustomers(custRes);
        setProducts(prodRes.filter(p => !p.isRawMaterial));
        if (custRes.length > 0) {
          setSelectedCustomerId(custRes[0].id);
        }
      } catch (err) {
        console.error('Failed to load customers and products', err);
      }
    };
    loadInitialData();
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category)))];

  const addToCart = (product: Product) => {
    if (product.currentStock <= 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) return prev;
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const clamped = Math.min(qty, item.product.currentStock);
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.unitPrice * item.quantity, 0);
  const discountRate = selectedCustomer?.discountPercentage || 0;
  const discountAmount = (subtotal * discountRate) / 100;
  const netTotal = subtotal - discountAmount;

  const handleCompleteOrder = async () => {
    if (!selectedCustomerId) {
      setErrorMsg('Please select a client for this distribution order.');
      return;
    }
    if (cart.length === 0) {
      setErrorMsg('Order must contain at least one product.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const created = await OrderService.create({
        customerId: selectedCustomerId,
        paymentStatus,
        notes,
        items: cart.map(i => ({ productId: i.product.id, quantity: i.quantity }))
      });
      onOrderCompleted(created);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to complete order.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="h-full flex flex-col bg-[#F1F3F6] overflow-hidden select-none">
      {/* Top Bar */}
      <div className="bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 font-semibold text-sm transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-slate-900">Point of Sale & Distribution Entry</h2>
          <p className="text-xs text-slate-400">Rapid order creation with auto-calculated discounts</p>
        </div>
        <div className="w-24 text-right">
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg">
            POS Terminal
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border-b border-rose-200 px-8 py-2.5 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Split Interface */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Product Selection & Customer Bar */}
        <div className="w-7/12 p-8 flex flex-col border-r border-slate-200/80 overflow-y-auto space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full sm:w-7/12">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                Select Customer / Store Account
              </label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0071E3]"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.pricingTier} Tier • {c.discountPercentage}% Off)
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer && (
              <div className="text-left sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <span className="text-xs text-slate-400 font-semibold block">Outstanding Credit</span>
                <span className={`text-lg font-bold ${selectedCustomer.outstandingBalance > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {formatCurrency(selectedCustomer.outstandingBalance)}
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Limit: {formatCurrency(selectedCustomer.creditLimit)}
                </span>
              </div>
            )}
          </div>

          {/* Search & Categories */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0071E3] shadow-sm font-medium"
              />
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 gap-4 pb-6">
            {filteredProducts.map(product => {
              const outOfStock = product.currentStock <= 0;
              const inCart = cart.find(c => c.product.id === product.id);

              return (
                <div
                  key={product.id}
                  onClick={() => !outOfStock && addToCart(product)}
                  className={`p-5 rounded-3xl border transition-all text-left relative ${
                    outOfStock
                      ? 'bg-slate-100/60 border-slate-200 cursor-not-allowed opacity-60'
                      : inCart
                      ? 'bg-blue-50/40 border-blue-400/80 shadow-sm cursor-pointer'
                      : 'bg-white border-slate-200/80 hover:border-[#0071E3] hover:shadow-md cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-4 right-4 bg-[#0071E3] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                      {inCart.quantity}
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-2 pr-6">
                    <span className="text-xs font-mono text-slate-400 font-bold">{product.sku}</span>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-base leading-snug line-clamp-2">
                    {product.name}
                  </h4>

                  <div className="flex items-baseline justify-between mt-4">
                    <span className="text-xl font-bold text-slate-900">
                      {formatCurrency(product.unitPrice)}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        outOfStock
                          ? 'bg-rose-100 text-rose-700'
                          : product.currentStock <= product.minStockAlert
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {outOfStock ? 'Out of Stock' : `${product.currentStock} ${product.unit}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Order Ticket Manifest */}
        <div className="w-5/12 bg-slate-100/80 flex flex-col justify-between p-8 border-l border-slate-200/80">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 mb-4 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Distribution Manifest
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {cart.length} {cart.length === 1 ? 'Line Item' : 'Line Items'}
              </span>
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-14 h-14 rounded-full bg-slate-200/70 flex items-center justify-center mb-3">
                  <Receipt className="w-6 h-6 text-slate-400" />
                </div>
                <p className="font-semibold text-slate-700">Order is currently empty</p>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Click on any available product on the left catalog to add cases or units to this delivery.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {cart.map(item => (
                  <div
                    key={item.product.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-slate-400 font-medium">
                        {formatCurrency(item.product.unitPrice)} / {item.product.unit}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Quantity Stepper */}
                      <div className="flex items-center border border-slate-200 bg-white rounded-xl overflow-hidden shadow-xs">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 font-bold text-xs text-slate-900 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-20 text-right font-bold text-sm text-slate-900">
                        {formatCurrency(item.product.unitPrice * item.quantity)}
                      </div>

                      <button
                        onClick={() => updateQuantity(item.product.id, 0)}
                        className="text-slate-300 hover:text-rose-500 p-1 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing Summary & Dispatch Trigger */}
          <div className="border-t border-slate-100 pt-5 space-y-4 shrink-0">
            {/* Payment & Delivery Note Controls */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Payment Terms
                </label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-semibold text-slate-900 focus:outline-none"
                >
                  <option value="UNPAID">On Credit (Unpaid)</option>
                  <option value="PAID">Paid in Full (Cash/Bank)</option>
                  <option value="PARTIAL">Partial Payment</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Delivery Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Dock #2 entrance"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-sm">
              <div className="flex justify-between text-slate-500 font-medium">
                <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} units)</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Client Tier Discount ({discountRate}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-slate-900 border-t border-slate-200/80 pt-2">
                <span>Net Total Due</span>
                <span>{formatCurrency(netTotal)}</span>
              </div>
            </div>

            {/* Apple Primary Action Button */}
            <button
              disabled={cart.length === 0 || submitting}
              onClick={handleCompleteOrder}
              className={`w-full py-4 rounded-2xl font-bold text-white text-base shadow-sm transition-all duration-150 flex items-center justify-center gap-2 ${
                cart.length === 0 || submitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.99]'
              }`}
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              {submitting ? 'Generating Order & Updating Stock...' : 'Confirm Order & Print Delivery Note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
