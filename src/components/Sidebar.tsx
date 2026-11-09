import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Truck,
  Receipt,
  RotateCcw,
  Users,
  BarChart3,
  ShieldCheck,
  Database,
  Coins,
  Settings as SettingsIcon,
  TrendingUp,
  TrendingDown,
  Building2,
  Factory,
  CreditCard,
  Briefcase,
  LogOut,
  X
} from 'lucide-react';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext';
import { User } from '../types';
import samanthaLogo from '../assets/samantha-logo.png';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
}

interface SidebarSection {
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeTone?: 'step' | 'inward' | 'pnl' | 'expense';
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isOpen = false,
  onClose,
  currentUser,
  onLogout
}) => {
  const { currency, setCurrency } = useCurrency();

  const sections: SidebarSection[] = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'Operations Workflow',
      items: [
        { id: 'inventory', label: 'Warehouse Stock', icon: Boxes, badge: 'Step 1', badgeTone: 'step' },
        { id: 'suppliers', label: 'Suppliers', icon: Building2, badge: 'Stock In', badgeTone: 'inward' },
        { id: 'manufacturing', label: 'Manufacturing & BOM', icon: Factory, badge: 'Production', badgeTone: 'inward' },
        { id: 'lorry-loading', label: 'Morning Lorry Load', icon: Truck, badge: 'Step 2', badgeTone: 'step' },
        { id: 'bill-entry', label: 'Office Bill Entry', icon: Receipt, badge: 'Step 3', badgeTone: 'step' },
        { id: 'lorry-settlement', label: 'Day Settlement', icon: RotateCcw, badge: 'Step 4', badgeTone: 'step' }
      ]
    },
    {
      title: 'Finance & Management',
      items: [
        { id: 'customers', label: 'Clients & Accounts', icon: Users },
        { id: 'hr-payroll', label: 'HR & Payroll', icon: Briefcase, badge: 'Staff', badgeTone: 'pnl' },
        { id: 'cheques', label: 'Cheque Management', icon: CreditCard, badge: 'PDC', badgeTone: 'inward' },
        { id: 'expenses', label: 'Expenses & Opex', icon: TrendingDown, badge: 'Outflow', badgeTone: 'expense' },
        { id: 'pnl', label: 'Profit & Loss', icon: TrendingUp, badge: 'P&L', badgeTone: 'pnl' },
        { id: 'reports', label: 'Reports & Audit', icon: BarChart3 },
        { id: 'settings', label: 'Fleet & Settings', icon: SettingsIcon }
      ]
    }
  ];

  const handleItemClick = (id: string) => {
    onTabChange(id);
    if (onClose) {
      onClose();
    }
  };

  const getBadgeClass = (isActive: boolean, tone?: 'step' | 'inward' | 'pnl' | 'expense') => {
    if (isActive) {
      return 'bg-white/20 text-white border border-white/30 backdrop-blur-xs';
    }
    switch (tone) {
      case 'inward':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      case 'pnl':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200/70';
      case 'expense':
        return 'bg-rose-50 text-rose-700 border border-rose-200/70';
      case 'step':
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200/70';
    }
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none bg-white">
      {/* Top Header & Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* App Title & Header */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={samanthaLogo}
              alt="Samantha Distributor"
              className="w-10 h-10 rounded-xl object-contain drop-shadow-xs shrink-0"
            />
            <div>
              <h1 className="font-bold text-slate-900 text-base tracking-tight leading-snug">
                Samantha Distributor
              </h1>
              <span className="text-xs font-medium text-slate-400 block -mt-0.5">
                Fleet &amp; Distribution
              </span>
            </div>
          </div>

          {/* Close button for mobile drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 md:hidden transition-colors"
              aria-label="Close Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Fleet Route Live Status */}
        <div className="px-4.5 pt-3.5 pb-2">
          <div className="flex items-center justify-between px-3.5 py-1.5 bg-emerald-50/90 border border-emerald-200/60 rounded-xl text-xs font-semibold text-emerald-800">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              3 Routes Active
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100/70 text-emerald-700 rounded-md tracking-wider uppercase">
              Online
            </span>
          </div>
        </div>

        {/* Sectioned Navigation list */}
        <nav className="px-3 py-2 space-y-4">
          {sections.map((section, sIdx) => (
            <div key={section.title} className={sIdx > 0 ? 'pt-1' : ''}>
              <div className="px-3 pb-1.5 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13.5px] transition-all duration-150 text-left group ${isActive
                          ? 'bg-[#0071E3] text-white shadow-sm shadow-blue-500/20 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                        }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <Icon
                          className={`w-[18px] h-[18px] shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 whitespace-nowrap transition-colors ${getBadgeClass(
                            isActive,
                            item.badgeTone
                          )}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer System Status & Currency Selector */}
      <div className="p-4 border-t border-slate-100 space-y-2.5 bg-white shrink-0">
        {/* Currency Switcher */}
        <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-2xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Coins className="w-3.5 h-3.5 text-blue-600" /> Currency
            </span>
            <span className="text-[11px] font-bold text-[#0071E3] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/80">
              {CURRENCIES[currency].symbol}
            </span>
          </div>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0071E3]/20 focus:border-[#0071E3] shadow-2xs cursor-pointer transition-colors"
          >
            <option value="LKR">LKR (Rs. - Sri Lanka)</option>
            <option value="USD">USD ($ - US Dollar)</option>
            <option value="INR">INR (₹ - Indian Rupee)</option>
            <option value="EUR">EUR (€ - Euro)</option>
            <option value="GBP">GBP (£ - British Pound)</option>
          </select>
        </div>

        {/* Database & Engine Status */}
        <div className="pt-0.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <Database className="w-3.5 h-3.5 text-slate-400" /> Offline DB
            </span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">
              v1.2.0
            </span>
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between font-medium">
            <span className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Local Engine Active</span>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
        </div>

        {/* Admin User Profile & Logout */}
        {onLogout && (
          <div className="pt-2.5 mt-2 border-t border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                A
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {currentUser?.fullName || 'Administrator'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate">
                  Admin Backoffice
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
              title="Sign Out to Login Screen"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (md and up) - Increased width from w-64 (256px) to w-[295px] */}
      <aside className="hidden md:flex w-[295px] bg-white border-r border-slate-200/80 flex-col h-screen shrink-0 shadow-2xs">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (under md) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Dimmed Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Slide-in Panel */}
          <div className="relative w-[305px] max-w-[85vw] bg-white h-full shadow-2xl z-10 flex flex-col animate-slideIn">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
