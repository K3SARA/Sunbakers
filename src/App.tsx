import React, { useState } from 'react';
import {
  Menu,
  LayoutDashboard,
  Truck,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { LorryLoading } from './pages/LorryLoading';
import { BillEntry } from './pages/BillEntry';
import { RepBilling } from './pages/RepBilling';
import { LorrySettlement } from './pages/LorrySettlement';
import { Customers } from './pages/Customers';
import { Reports } from './pages/Reports';
import { ProfitAndLoss } from './pages/ProfitAndLoss';
import { FreeIssues } from './pages/FreeIssues';
import { Suppliers } from './pages/Suppliers';
import { Expenses } from './pages/Expenses';
import { Settings } from './pages/Settings';
import { Cheques } from './pages/Cheques';
import { Manufacturing } from './pages/Manufacturing';
import { HrPayroll } from './pages/HrPayroll';
import { LiveMap } from './pages/LiveMap';
import { Login } from './pages/Login';
import { RepMobilePortal } from './pages/RepMobilePortal';
import { InvoiceModal } from './components/InvoiceModal';
import { CurrencyProvider, useCurrency, CURRENCIES } from './context/CurrencyContext';
import { Order, User } from './types';
import { stopRepBackgroundTracking } from './services/backgroundLocation';
import sunbakersLogo from './assets/sunbakers-logo.png';

export const AppContent: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('distributor_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const { currency } = useCurrency();

  const handleLogout = () => {
    stopRepBackgroundTracking();
    localStorage.removeItem('distributor_auth_user');
    setCurrentUser(null);
  };

  // 1. Unauthenticated: Render dedicated Login Page
  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  // 2. Route Sales Rep: Render dedicated Mobile Rep Portal (Separate from desktop)
  if (currentUser.role === 'REP') {
    return <RepMobilePortal user={currentUser} onLogout={handleLogout} />;
  }

  const bottomNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'lorry-loading', label: 'Load', icon: Truck },
    { id: 'bill-entry', label: 'Bills', icon: Receipt },
    { id: 'lorry-settlement', label: 'Settle', icon: RotateCcw },
    { id: 'menu', label: 'Menu', icon: Menu }
  ];

  const handleBottomNavClick = (id: string) => {
    if (id === 'menu') {
      setIsMobileDrawerOpen(true);
    } else {
      setCurrentTab(id);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F1F3F6] text-[#1D1D1F]">
      {/* Sidebar Navigation (Desktop persistent, Mobile drawer) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Work Area */}
      <main className="flex-1 h-screen overflow-hidden flex flex-col min-w-0">
        {/* Mobile Top App Bar (visible on md:hidden) */}
        <header className="md:hidden bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="p-2 -ml-1 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <img
                src={sunbakersLogo}
                alt="sunbakers Distributor"
                className="w-8 h-8 rounded-full object-contain border border-slate-200/80 shadow-2xs"
              />
              <span className="font-bold text-slate-900 text-base tracking-tight">
                sunbakers Distributor
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
              {CURRENCIES[currency]?.symbol || 'Rs.'}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Fleet Active" />
          </div>
        </header>

        {/* Dynamic Page Views with bottom padding for mobile bar */}
        <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className={currentTab === 'dashboard' ? '' : 'hidden'}>
            <Dashboard
              isActive={currentTab === 'dashboard'}
              onNavigateToLoading={() => setCurrentTab('lorry-loading')}
              onNavigateToBillEntry={() => setCurrentTab('bill-entry')}
              onNavigateToSettlement={() => setCurrentTab('lorry-settlement')}
              onNavigateToInventory={() => setCurrentTab('inventory')}
              onNavigateToExpenses={() => setCurrentTab('expenses')}
              onViewInvoice={(order) => setActiveInvoiceOrder(order)}
            />
          </div>

          <div className={currentTab === 'inventory' ? '' : 'hidden'}>
            <Inventory
              isActive={currentTab === 'inventory'}
              onNavigateToSuppliers={() => setCurrentTab('suppliers')}
            />
          </div>

          <div className={currentTab === 'suppliers' ? '' : 'hidden'}>
            <Suppliers isActive={currentTab === 'suppliers'} />
          </div>

          <div className={currentTab === 'manufacturing' ? '' : 'hidden'}>
            <Manufacturing isActive={currentTab === 'manufacturing'} />
          </div>

          <div className={currentTab === 'lorry-loading' ? '' : 'hidden'}>
            <LorryLoading isActive={currentTab === 'lorry-loading'} />
          </div>

          <div className={currentTab === 'bill-entry' ? '' : 'hidden'}>
            <BillEntry
              isActive={currentTab === 'bill-entry'}
              onViewInvoice={(order) => setActiveInvoiceOrder(order)}
            />
          </div>

          <div className={currentTab === 'rep-billing' ? '' : 'hidden'}>
            <RepBilling
              isActive={currentTab === 'rep-billing'}
              user={currentUser}
              onViewInvoice={(order) => setActiveInvoiceOrder(order)}
              onExitToMenu={() => setCurrentTab('dashboard')}
            />
          </div>

          <div className={currentTab === 'lorry-settlement' ? '' : 'hidden'}>
            <LorrySettlement isActive={currentTab === 'lorry-settlement'} />
          </div>

          <div className={currentTab === 'customers' ? '' : 'hidden'}>
            <Customers
              isActive={currentTab === 'customers'}
              onViewInvoice={(order) => setActiveInvoiceOrder(order)}
            />
          </div>

          <div className={currentTab === 'hr-payroll' ? '' : 'hidden'}>
            <HrPayroll isActive={currentTab === 'hr-payroll'} />
          </div>

          <div className={currentTab === 'cheques' ? '' : 'hidden'}>
            <Cheques
              isActive={currentTab === 'cheques'}
              onViewInvoice={(order) => setActiveInvoiceOrder(order)}
            />
          </div>

          <div className={currentTab === 'reports' ? '' : 'hidden'}>
            <Reports isActive={currentTab === 'reports'} />
          </div>

          <div className={currentTab === 'expenses' ? '' : 'hidden'}>
            <Expenses isActive={currentTab === 'expenses'} />
          </div>

          <div className={currentTab === 'pnl' ? '' : 'hidden'}>
            <ProfitAndLoss isActive={currentTab === 'pnl'} />
          </div>

          <div className={currentTab === 'free-issues' ? '' : 'hidden'}>
            <FreeIssues isActive={currentTab === 'free-issues'} />
          </div>

          <div className={currentTab === 'settings' ? '' : 'hidden'}>
            <Settings isActive={currentTab === 'settings'} />
          </div>

          <div className={currentTab === 'live-map' ? '' : 'hidden'}>
            <LiveMap isActive={currentTab === 'live-map'} />
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar (md:hidden) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around z-30 shadow-lg">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleBottomNavClick(item.id)}
                className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-150 min-w-[56px] ${
                  isActive
                    ? 'text-blue-600 font-bold'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className="text-[11px] font-semibold mt-0.5 tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </main>

      {/* Delivery Note & Invoice Preview Modal */}
      <InvoiceModal
        order={activeInvoiceOrder}
        onClose={() => setActiveInvoiceOrder(null)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CurrencyProvider>
      <AppContent />
    </CurrencyProvider>
  );
};

export default App;
