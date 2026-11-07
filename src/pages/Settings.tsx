import React, { useState, useEffect } from 'react';
import {
  Truck,
  Building2,
  FileText,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Phone,
  ShieldCheck,
  Edit2,
  Plus,
  Compass,
  X,
  Database,
  Download,
  Upload,
  Cloud,
  Trash2,
  Users,
  Target,
  UserPlus
} from 'lucide-react';
import { LorryService, RouteService, SettingsService, BackupService, AuthService } from '../services/api';
import { Lorry, Route, SystemSettings, User } from '../types';
import { useCurrency, CURRENCIES, CurrencyCode } from '../context/CurrencyContext';

export const Settings: React.FC = () => {
  const { currency, setCurrency } = useCurrency();
  const [lorries, setLorries] = useState<Lorry[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: 'Distributor Pro Lanka (Pvt) Ltd',
    tagline: 'Authorized Wholesale FMCG Distribution & Fleet Console',
    phone: '+94 11 234 5678 / +94 77 123 4567',
    email: 'distribution@example.com',
    address: 'No. 88, Commercial Zone, Colombo, Sri Lanka',
    registrationNumber: 'PV-84920/2022',
    invoiceFooterNote: 'Goods once delivered and acknowledged on paper slip cannot be returned without formal warehouse return authorization.',
    defaultCurrency: 'LKR',
    defaultCreditLimit: 50000,
    lowStockThreshold: 10
  });

  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Backup & Cloud Migration State
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  // Edit Lorry Modal State
  const [editingLorry, setEditingLorry] = useState<Lorry | null>(null);
  const [isNewLorry, setIsNewLorry] = useState(false);
  const [lorryForm, setLorryForm] = useState({
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    routeId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'MAINTENANCE'
  });
  const [savingLorry, setSavingLorry] = useState(false);
  const [lorryError, setLorryError] = useState<string | null>(null);

  // Add Route Modal State
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [routeForm, setRouteForm] = useState({
    code: '',
    name: '',
    description: ''
  });
  const [savingRoute, setSavingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Sales Rep Management State
  const [users, setUsers] = useState<User[]>([]);
  const [editingRep, setEditingRep] = useState<User | null>(null);
  const [isNewRep, setIsNewRep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [repForm, setRepForm] = useState({
    fullName: '',
    username: '',
    password: '',
    phone: '',
    lorryId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
    monthlyTarget: 500000,
    dailyTarget: 20000,
    targetNewClients: 5
  });
  const [savingRep, setSavingRep] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);

  const handleOpenAddRep = () => {
    setIsNewRep(true);
    setEditingRep({ id: '', username: '', fullName: '', role: 'REP', status: 'ACTIVE' });
    setRepForm({
      fullName: '',
      username: '',
      password: '',
      phone: '',
      lorryId: lorries[0]?.id || '',
      status: 'ACTIVE',
      monthlyTarget: 500000,
      dailyTarget: 20000,
      targetNewClients: 5
    });
    setShowPassword(false);
    setRepError(null);
  };

  const handleOpenEditRep = (rep: User) => {
    setIsNewRep(false);
    setEditingRep(rep);
    setRepForm({
      fullName: rep.fullName,
      username: rep.username,
      password: '',
      phone: rep.phone || '',
      lorryId: rep.lorryId || '',
      status: rep.status,
      monthlyTarget: rep.monthlyTarget || 0,
      dailyTarget: rep.dailyTarget || 0,
      targetNewClients: rep.targetNewClients || 0
    });
    setShowPassword(false);
    setRepError(null);
  };

  const handleSaveRep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repForm.fullName.trim() || !repForm.username.trim()) {
      setRepError('Full name and username are required.');
      return;
    }
    if (isNewRep && !repForm.password.trim()) {
      setRepError('Password is required for a new sales rep.');
      return;
    }

    try {
      setSavingRep(true);
      setRepError(null);

      if (isNewRep) {
        await AuthService.createUser({
          fullName: repForm.fullName.trim(),
          username: repForm.username.trim().toLowerCase(),
          password: repForm.password.trim(),
          phone: repForm.phone.trim() || undefined,
          lorryId: repForm.lorryId || undefined,
          role: 'REP',
          monthlyTarget: Number(repForm.monthlyTarget) || 0,
          dailyTarget: Number(repForm.dailyTarget) || 0,
          targetNewClients: Number(repForm.targetNewClients) || 0
        });
        setSaveSuccess(`Sales Rep "${repForm.fullName}" registered successfully!`);
      } else if (editingRep) {
        await AuthService.updateUser(editingRep.id, {
          fullName: repForm.fullName.trim(),
          phone: repForm.phone.trim() || undefined,
          lorryId: repForm.lorryId || undefined,
          status: repForm.status,
          monthlyTarget: Number(repForm.monthlyTarget) || 0,
          dailyTarget: Number(repForm.dailyTarget) || 0,
          targetNewClients: Number(repForm.targetNewClients) || 0,
          ...(repForm.password.trim() ? { password: repForm.password.trim() } : {})
        });
        setSaveSuccess(`Sales Rep "${repForm.fullName}" updated successfully!`);
      }

      setTimeout(() => setSaveSuccess(null), 4000);
      setEditingRep(null);
      await loadData();
    } catch (err: any) {
      setRepError(err.response?.data?.error || err.message || 'Failed to save sales rep');
    } finally {
      setSavingRep(false);
    }
  };

  const handleDeleteRep = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete or deactivate sales rep "${name}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await AuthService.deleteUser(id);
      setSaveSuccess(`Sales rep "${name}" deleted/deactivated.`);
      setTimeout(() => setSaveSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      setSaveError(err.response?.data?.error || err.message || 'Failed to delete sales rep');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddRoute = () => {
    const nextNum = routes.length + 1;
    setRouteForm({
      code: `R-${String(nextNum).padStart(2, '0')}`,
      name: '',
      description: ''
    });
    setRouteError(null);
    setShowAddRouteModal(true);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.code.trim() || !routeForm.name.trim()) {
      setRouteError('Route code and name are required.');
      return;
    }
    try {
      setSavingRoute(true);
      setRouteError(null);
      const created = await RouteService.create({
        code: routeForm.code.trim().toUpperCase(),
        name: routeForm.name.trim(),
        description: routeForm.description.trim() || undefined
      });

      const updatedRoutes = [...routes.filter(r => r.id !== created.id), created];
      setRoutes(updatedRoutes);

      // Auto-assign newly created route in lorry form if active
      setLorryForm(prev => ({ ...prev, routeId: created.id }));

      setShowAddRouteModal(false);
      setSaveSuccess(`Route "${created.name}" created and assigned!`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setRouteError(err?.response?.data?.error || err.message || 'Failed to create route.');
    } finally {
      setSavingRoute(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setExportingBackup(true);
      setBackupError(null);
      const data = await BackupService.exportData();
      const counts = data.counts || {};
      setBackupSuccess(
        `Backup downloaded! Snapshot contains: ${counts.orders || 0} orders, ${counts.products || 0} products, ${counts.customers || 0} customers.`
      );
      setTimeout(() => setBackupSuccess(null), 8000);
    } catch (err: any) {
      setBackupError('Failed to export backup: ' + (err.message || 'Unknown error'));
    } finally {
      setExportingBackup(false);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportingBackup(true);
      setBackupError(null);
      const text = await file.text();
      const json = JSON.parse(text);

      const res = await BackupService.importData(json);
      const counts = res.importedCounts || {};
      setBackupSuccess(
        `Cloud backup restored into local database! Ingested ${counts.orders || 0} orders, ${counts.products || 0} products, ${counts.customers || 0} customers, ${counts.lorries || 0} lorries.`
      );
      setTimeout(() => setBackupSuccess(null), 8000);
      await loadData();
    } catch (err: any) {
      console.error('Import failed', err);
      setBackupError('Failed to import backup: ' + (err.response?.data?.error || err.message || 'Invalid JSON file'));
    } finally {
      setImportingBackup(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleWipeDatabase = async () => {
    const confirmed = window.confirm(
      '⚠️ WARNING: Are you sure you want to completely wipe all data?\n\nThis will permanently delete all products, customers, bills, payments, staff members, payroll, fleet, and expenses, leaving a clean business database with only your Administrator login.'
    );
    if (!confirmed) return;

    try {
      setImportingBackup(true);
      setBackupError(null);
      const res = await BackupService.wipeDatabase();
      setBackupSuccess(res.message);
      setTimeout(() => setBackupSuccess(null), 8000);
      await loadData();
    } catch (err: any) {
      setBackupError('Failed to wipe database: ' + (err.response?.data?.error || err.message));
    } finally {
      setImportingBackup(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [lorryData, routeData, settingsData, userData] = await Promise.all([
        LorryService.getAll(),
        RouteService.getAll(),
        SettingsService.get().catch(() => null),
        AuthService.getUsers().catch(() => [])
      ]);

      setLorries(lorryData);
      setRoutes(routeData);
      setUsers(userData);
      if (settingsData) {
        setSettings(settingsData);
        if (settingsData.defaultCurrency && CURRENCIES[settingsData.defaultCurrency as CurrencyCode]) {
          setCurrency(settingsData.defaultCurrency as CurrencyCode);
        }
      }
    } catch (err: any) {
      console.error('Failed to load settings data', err);
      setSaveError('Failed to load settings. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEditLorry = (lorry: Lorry) => {
    setIsNewLorry(false);
    setEditingLorry(lorry);
    setLorryForm({
      vehicleNumber: lorry.vehicleNumber,
      driverName: lorry.driverName,
      driverPhone: lorry.driverPhone || '',
      routeId: lorry.routeId || '',
      status: lorry.status || 'ACTIVE'
    });
    setLorryError(null);
  };

  const handleOpenNewLorry = () => {
    setIsNewLorry(true);
    setEditingLorry({
      id: '',
      vehicleNumber: '',
      driverName: '',
      status: 'ACTIVE'
    } as Lorry);
    setLorryForm({
      vehicleNumber: '',
      driverName: '',
      driverPhone: '',
      routeId: routes[0]?.id || '',
      status: 'ACTIVE'
    });
    setLorryError(null);
  };

  const handleSaveLorry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lorryForm.vehicleNumber.trim() || !lorryForm.driverName.trim()) {
      setLorryError('Vehicle number and driver name are required.');
      return;
    }

    try {
      setSavingLorry(true);
      setLorryError(null);

      if (isNewLorry) {
        await LorryService.create({
          vehicleNumber: lorryForm.vehicleNumber,
          driverName: lorryForm.driverName,
          driverPhone: lorryForm.driverPhone,
          routeId: lorryForm.routeId || undefined,
          status: lorryForm.status
        });
      } else if (editingLorry) {
        await LorryService.update(editingLorry.id, {
          vehicleNumber: lorryForm.vehicleNumber,
          driverName: lorryForm.driverName,
          driverPhone: lorryForm.driverPhone,
          routeId: lorryForm.routeId || undefined,
          status: lorryForm.status
        });
      }

      setSaveSuccess(`Lorry ${lorryForm.vehicleNumber.toUpperCase()} successfully saved!`);
      setTimeout(() => setSaveSuccess(null), 4000);
      setEditingLorry(null);
      await loadData();
    } catch (err: any) {
      setLorryError(err.response?.data?.error || err.message || 'Failed to save lorry');
    } finally {
      setSavingLorry(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSaveError(null);
      const updated = await SettingsService.update(settings);
      setSettings(updated);
      if (updated.defaultCurrency && CURRENCIES[updated.defaultCurrency as CurrencyCode]) {
        setCurrency(updated.defaultCurrency as CurrencyCode);
      }
      setSaveSuccess('System settings successfully saved!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.response?.data?.error || err.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Loading Settings Console...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Settings & Fleet Configuration
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Update lorry driver details, vehicle plate numbers, routes, company branding, and invoice terms.
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-2xl shadow-2xs transition self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-blue-600" />
          Refresh
        </button>
      </div>

      {/* Alert Notifications */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm font-semibold animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* SECTION 1: LORRIES & DRIVER CONFIGURATION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              Distribution Lorries & Drivers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure driver names, vehicle registration plate numbers, phone numbers, and default routes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAddRoute}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-2xl shadow-2xs transition"
            >
              <Plus className="w-4 h-4 text-blue-600" /> Add Route
            </button>
            <button
              onClick={handleOpenNewLorry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> Add Lorry
            </button>
          </div>
        </div>

        {/* Lorry Fleet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {lorries.map((lorry, idx) => (
            <div
              key={lorry.id}
              className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-2xs font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <span className="font-mono text-sm font-bold uppercase tracking-wider text-slate-900 block">
                        {lorry.vehicleNumber}
                      </span>
                      <span className="text-xs font-semibold text-slate-400">
                        Fleet Vehicle
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      lorry.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}
                  >
                    {lorry.status}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50/80 rounded-2xl space-y-2 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[11px]">
                      Assigned Driver
                    </span>
                    <span className="text-sm font-bold text-slate-900 block">
                      {lorry.driverName}
                    </span>
                    {lorry.driverPhone && (
                      <span className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" /> {lorry.driverPhone}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[11px]">
                      Delivery Route
                    </span>
                    <span className="font-semibold text-blue-700 flex items-center gap-1 mt-0.5">
                      <Compass className="w-3.5 h-3.5 text-blue-500" />
                      {lorry.route ? lorry.route.name : 'No Route Assigned'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleOpenEditLorry(lorry)}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit Lorry & Driver
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ROUTE SALES REPS & TARGET MANAGEMENT */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Route Sales Representatives & Monthly Targets
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Create and manage mobile route rep logins, assigned distribution lorries, and sales revenue targets.
            </p>
          </div>

          <button
            onClick={handleOpenAddRep}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-sm transition self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Sales Rep
          </button>
        </div>

        {/* Rep Cards Grid */}
        {users.filter(u => u.role === 'REP').length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">No Sales Reps Registered Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Add your field sales representatives to generate their mobile billing credentials and assign sales targets.
              </p>
            </div>
            <button
              onClick={handleOpenAddRep}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add First Sales Rep
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {users
              .filter(u => u.role === 'REP')
              .map(rep => {
                const monthlyTarget = rep.monthlyTarget || 0;
                const actualSales = rep.actualSalesThisMonth || 0;
                const progressPct = monthlyTarget > 0 ? Math.min(100, Math.round((actualSales / monthlyTarget) * 100)) : 0;

                return (
                  <div
                    key={rep.id}
                    className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs hover:shadow-md transition space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Rep Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
                            {rep.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-sm text-slate-900 block leading-tight">
                              {rep.fullName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              @{rep.username}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            rep.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </div>

                      {/* Fleet & Phone Info */}
                      <div className="p-3 bg-slate-50/80 rounded-2xl space-y-1.5 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            Assigned Lorry
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            {rep.lorry?.vehicleNumber || 'Unassigned'}
                          </span>
                        </div>

                        {rep.lorry?.route && (
                          <div className="flex items-center justify-between text-slate-600 text-[11px]">
                            <span className="text-slate-400">Route:</span>
                            <span className="font-semibold text-blue-700 truncate max-w-[150px]">
                              {rep.lorry.route.name}
                            </span>
                          </div>
                        )}

                        {rep.phone && (
                          <div className="flex items-center justify-between text-slate-500 text-[11px] pt-1 border-t border-slate-200/60">
                            <span className="text-slate-400">Phone:</span>
                            <span className="font-mono">{rep.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Target & Achievement Box */}
                      <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/80 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-indigo-600" />
                            Monthly Target
                          </span>
                          <span className="text-xs font-mono font-bold text-indigo-900">
                            {currency} {monthlyTarget.toLocaleString()}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                progressPct >= 100
                                  ? 'bg-emerald-500'
                                  : progressPct >= 50
                                  ? 'bg-indigo-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>
                              Billed: <strong className="text-slate-800">{currency} {actualSales.toLocaleString()}</strong>
                            </span>
                            <span className={progressPct >= 100 ? 'text-emerald-700 font-bold' : 'text-indigo-700 font-bold'}>
                              {progressPct}% reached
                            </span>
                          </div>
                        </div>

                        {/* Additional Target Metrics */}
                        <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                          <span>Daily: <strong>{currency} {(rep.dailyTarget || 0).toLocaleString()}</strong></span>
                          <span>New Shops: <strong>{rep.targetNewClients || 0}/mo</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditRep(rep)}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit & Targets
                      </button>
                      <button
                        onClick={() => handleDeleteRep(rep.id, rep.fullName)}
                        title="Delete or deactivate rep"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* SECTION 3: COMPANY & BUSINESS PROFILE */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Distributor Company & Warehouse Info
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Branding information shown on driver invoices, delivery bills, and system audit reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Distributor Company Name *
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Business Tagline / Subtitle
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                placeholder="e.g. Authorized FMCG Distribution"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Official Contact Phone Numbers
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="+94 11 234 5678"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Business Email Address
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="office@distributor.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Depot & Warehouse Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Physical warehouse address"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Business Registration (BR / Tax #)
              </label>
              <input
                type="text"
                value={settings.registrationNumber}
                onChange={(e) => setSettings({ ...settings, registrationNumber: e.target.value })}
                placeholder="e.g. PV-84920/2022"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: INVOICE TERMS & BASIC PARAMETERS */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Bill Policy & System Defaults
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Printed remarks and defaults applied when recording bills and managing warehouse stock.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Printed Invoice Footer Remarks / Disclaimer
              </label>
              <textarea
                rows={2}
                value={settings.invoiceFooterNote}
                onChange={(e) => setSettings({ ...settings, invoiceFooterNote: e.target.value })}
                placeholder="Notice printed at the bottom of customer bills..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Default App Currency
                </label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LKR">LKR (Rs. - Sri Lanka)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Default Retailer Credit Limit
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={settings.defaultCreditLimit}
                  onChange={(e) => setSettings({ ...settings, defaultCreditLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Warehouse Min Stock Alert Threshold
                </label>
                <input
                  type="number"
                  min="1"
                  value={settings.lowStockThreshold}
                  onChange={(e) => setSettings({ ...settings, lowStockThreshold: parseInt(e.target.value, 10) || 10 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0071E3] hover:bg-blue-600 text-white font-bold text-sm rounded-2xl shadow-sm transition active:scale-[0.99] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingSettings ? 'Saving Settings...' : 'Save All Settings'}
            </button>
          </div>
        </div>
      </form>

      {/* SECTION: CLOUD BACKUP & OFFLINE DATA MIGRATION BRIDGE */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              Cloud Backup & Offline Data Migration
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Export live sales and inventory data from Railway PostgreSQL and restore it into your offline desktop software (.exe).
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto font-mono">
            Zero-Loss Migration Bridge
          </span>
        </div>

        {backupSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-semibold animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{backupSuccess}</span>
          </div>
        )}

        {backupError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-semibold animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{backupError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">1. Download Cloud Backup</h3>
              </div>
              <p className="text-xs text-slate-500">
                Exports all database records (Products, Customers, Bills, Lorry Loadings, Payments, Users, Expenses) into a portable JSON backup file.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exportingBackup}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>{exportingBackup ? 'Exporting Snapshot...' : 'Download Full Backup (.json)'}</span>
            </button>
          </div>

          {/* Import Card */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">2. Restore / Ingest into Offline Software</h3>
              </div>
              <p className="text-xs text-slate-500">
                Upload your Railway backup JSON file to populate or synchronize your offline desktop SQLite database with zero data loss.
              </p>
            </div>

            <label className="w-full py-2.5 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>{importingBackup ? 'Restoring Database...' : 'Select Backup File to Ingest'}</span>
              <input
                type="file"
                accept=".json"
                disabled={importingBackup}
                onChange={handleImportFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Clear Demo Data */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800 block">Clear All Data (Factory Reset)</span>
            <span className="text-[11px] text-slate-400">Purge all customers, bills, products, staff records, and expenses to start completely fresh. Keeps your admin login.</span>
          </div>
          <button
            type="button"
            onClick={handleWipeDatabase}
            disabled={importingBackup}
            className="py-2 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Wipe All Data</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: OFFLINE DATABASE ENGINE STATUS */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 sm:p-6 text-xs text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm block">
              Offline Embedded SQLite Engine Active
            </span>
            <span>
              All driver bills, inventory levels, and loading records remain stored locally on disk.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Local Engine v1.2.0</span>
        </div>
      </div>

      {/* EDIT / CREATE LORRY MODAL */}
      {editingLorry && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {isNewLorry ? 'Add New Lorry' : `Edit Lorry ${editingLorry.vehicleNumber}`}
                  </h3>
                  <p className="text-xs text-slate-400">Update plate number, driver, and assigned route</p>
                </div>
              </div>

              <button
                onClick={() => setEditingLorry(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLorry} className="p-6 space-y-4">
              {lorryError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                  {lorryError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Lorry Vehicle Plate Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WP-DA-1024 or LY-3921"
                  value={lorryForm.vehicleNumber}
                  onChange={(e) => setLorryForm({ ...lorryForm, vehicleNumber: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Assigned Driver Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sunil Perera"
                  value={lorryForm.driverName}
                  onChange={(e) => setLorryForm({ ...lorryForm, driverName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Driver Contact Phone
                </label>
                <input
                  type="text"
                  placeholder="+94 77 123 4567"
                  value={lorryForm.driverPhone}
                  onChange={(e) => setLorryForm({ ...lorryForm, driverPhone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Assigned Route
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenAddRoute}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition hover:underline"
                    title="Create New Delivery Route"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Route
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={lorryForm.routeId}
                    onChange={(e) => setLorryForm({ ...lorryForm, routeId: e.target.value })}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- No Route Assigned --</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} - {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleOpenAddRoute}
                    className="w-10 h-10 rounded-xl bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200/80 flex items-center justify-center transition shadow-2xs shrink-0 group"
                    title="Add New Delivery Route"
                    aria-label="Add Route"
                  >
                    <Plus className="w-5 h-5 stroke-[2.2] group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Operational Status
                </label>
                <select
                  value={lorryForm.status}
                  onChange={(e) => setLorryForm({ ...lorryForm, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACTIVE">ACTIVE (Ready for Loading & Dispatch)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Temporarily Unavailable)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingLorry(null)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLorry}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {savingLorry ? 'Saving...' : 'Save Lorry Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW ROUTE MODAL */}
      {showAddRouteModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scaleIn border border-slate-100">
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Add Delivery Route</h3>
                  <p className="text-xs text-slate-400">Create a new delivery territory for your fleet</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddRouteModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoute} className="p-6 space-y-4">
              {routeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                  {routeError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Route Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. R-04 or R-COL-02"
                  value={routeForm.code}
                  onChange={(e) => setRouteForm({ ...routeForm, code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Route Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Route 4 - Galle Southern Coastal"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Territory / Locality Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Retail supermarkets & grocery shops along Galle Road from Dehiwala to Panadura"
                  value={routeForm.description}
                  onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddRouteModal(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRoute}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {savingRoute ? 'Saving...' : 'Save & Assign Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* EDIT / CREATE SALES REP & TARGETS MODAL */}
      {editingRep && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {isNewRep ? 'Register New Sales Rep' : 'Edit Sales Rep & Targets'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure mobile login credentials, route lorry assignment, and sales targets.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingRep(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {repError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{repError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRep} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sunil Perera"
                    value={repForm.fullName}
                    onChange={(e) => setRepForm({ ...repForm, fullName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +94 77 123 4501"
                    value={repForm.phone}
                    onChange={(e) => setRepForm({ ...repForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Login Username *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isNewRep}
                    placeholder="e.g. rep1"
                    value={repForm.username}
                    onChange={(e) => setRepForm({ ...repForm, username: e.target.value.toLowerCase().trim() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono font-bold text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {isNewRep ? 'Login Password *' : 'Reset Password'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isNewRep ? 'Enter password' : 'Leave blank to keep current'}
                    value={repForm.password}
                    onChange={(e) => setRepForm({ ...repForm, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Assigned Delivery Lorry
                  </label>
                  <select
                    value={repForm.lorryId}
                    onChange={(e) => setRepForm({ ...repForm, lorryId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- No Lorry Assigned --</option>
                    {lorries.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.vehicleNumber} ({l.driverName}) {l.route ? `— ${l.route.name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Account Status
                  </label>
                  <select
                    value={repForm.status}
                    onChange={(e) => setRepForm({ ...repForm, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized to Bill)</option>
                    <option value="INACTIVE">INACTIVE (Login Blocked)</option>
                  </select>
                </div>
              </div>

              {/* Targets Subsection */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Performance Sales Targets (Admin Set)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Monthly Target ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="5000"
                      value={repForm.monthlyTarget}
                      onChange={(e) => setRepForm({ ...repForm, monthlyTarget: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      Daily Target ({currency})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={repForm.dailyTarget}
                      onChange={(e) => setRepForm({ ...repForm, dailyTarget: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">
                      New Shops / Mo
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={repForm.targetNewClients}
                      onChange={(e) => setRepForm({ ...repForm, targetNewClients: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingRep(null)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-semibold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRep}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  {savingRep ? 'Saving Rep...' : isNewRep ? 'Register Rep' : 'Update Rep & Targets'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
