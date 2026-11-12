import axios from 'axios';
import {
  Product,
  Customer,
  Order,
  DashboardStats,
  StockMovement,
  Route,
  Lorry,
  LorryLoading,
  SystemSettings,
  ProfitAndLossReport,
  Supplier,
  PurchaseOrder,
  Expense,
  ExpenseSummary,
  CustomerPayment,
  Recipe,
  ProductionRun,
  ManufacturingSummary,
  LorryPerformanceReport,
  RepPerformanceReport,
  User,
  RepTargetProgress,
  Employee,
  Attendance,
  SalaryAdvance,
  Payroll,
  HrPayrollSummary,
  VehicleReturnsReport
} from '../types';

// Dynamic API URL: uses relative '/api' on Railway / production web,
// or fallback to localhost:4812 in standalone Vite dev / Electron
const isDevVite = typeof window !== 'undefined' && window.location.port === '5173';
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';
const devHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : '127.0.0.1';
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDevVite || isFileProtocol ? `http://${devHost}:4812/api` : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const ProductService = {
  getAll: (lowStock?: boolean, search?: string) =>
    api.get<Product[]>('/products', { params: { lowStock, search } }).then(r => r.data),
  create: (data: Partial<Product>) =>
    api.post<Product>('/products', data).then(r => r.data),
  update: (id: string, data: Partial<Product>) =>
    api.put<Product>(`/products/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/products/${id}`).then(r => r.data),
  adjustStock: (id: string, payload: { quantity: number; type: string; isFreeIssue?: boolean; notes?: string; referenceId?: string }) =>
    api.post<Product>(`/products/${id}/stock-adjust`, payload).then(r => r.data),
  bulkImport: (payload: { mode: 'ADD' | 'REPLACE'; items: any[] }) =>
    api.post<{ success: boolean; mode: string; createdCount: number; updatedCount: number; totalProcessed: number; errors: any[] }>('/products/bulk-import', payload).then(r => r.data)
};

export const RouteService = {
  getAll: () =>
    api.get<Route[]>('/routes').then(r => r.data),
  create: (data: { code: string; name: string; description?: string }) =>
    api.post<Route>('/routes', data).then(r => r.data)
};

export const LorryService = {
  getAll: () =>
    api.get<Lorry[]>('/lorries').then(r => r.data),
  getById: (id: string) =>
    api.get<Lorry>(`/lorries/${id}`).then(r => r.data),
  create: (data: { vehicleNumber: string; driverName: string; driverPhone?: string; routeId?: string; status?: string }) =>
    api.post<Lorry>('/lorries', data).then(r => r.data),
  update: (id: string, data: Partial<Lorry>) =>
    api.put<Lorry>(`/lorries/${id}`, data).then(r => r.data),
  loadMorningStock: (id: string, payload: { items: { productId: string; quantity: number; freeQuantity?: number }[]; notes?: string }) =>
    api.post<LorryLoading>(`/lorries/${id}/load`, payload).then(r => r.data),
  getCurrentLoading: (id: string) =>
    api.get<LorryLoading | null>(`/lorries/${id}/current-loading`).then(r => r.data),
  enterDriverBill: (id: string, payload: {
    paperBillNumber?: string;
    customerId: string;
    items: { productId: string; quantity: number; freeQuantity?: number; unitPrice?: number }[];
    returnItems?: { productId: string; quantity: number; unitPrice?: number; returnType: 'DAMAGE' | 'RESALE'; reason?: string }[];
    paymentMethod: 'CASH' | 'CREDIT' | 'CHEQUE';
    cashReceived: number;
    discountAmount?: number;
    discountPercentage?: number;
    notes?: string;
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    settlePreviousBills?: { orderId: string; amount: number; paymentMethod?: string }[];
  }) => api.post<Order>(`/lorries/${id}/bills`, payload).then(r => r.data),
  settleLorry: (id: string, payload: {
    loadingId: string;
    returns: { productId: string; returnedQty: number; returnedFreeQty?: number }[];
    cashHandover: number;
    notes?: string;
  }) => api.post<LorryLoading>(`/lorries/${id}/settle`, payload).then(r => r.data)
};

export const CustomerService = {
  getAll: (search?: string, routeId?: string) =>
    api.get<Customer[]>('/customers', { params: { search, routeId } }).then(r => r.data),
  create: (data: Partial<Customer>) =>
    api.post<Customer>('/customers', data).then(r => r.data),
  update: (id: string, data: Partial<Customer>) =>
    api.put<Customer>(`/customers/${id}`, data).then(r => r.data),
  getOrderHistory: (id: string) =>
    api.get<Order[]>(`/customers/${id}/orders`).then(r => r.data),
  getUnpaidBills: (id: string) =>
    api.get<Order[]>(`/customers/${id}/unpaid-bills`).then(r => r.data),
  recordPayment: (id: string, payload: {
    amount: number;
    paymentMethod?: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    reference?: string;
    notes?: string;
    collectedBy?: string;
    lorryId?: string;
    allocations?: { orderId: string; amount: number }[];
  }) => api.post<{ message: string; payment: CustomerPayment; customer: Customer }>(`/customers/${id}/payments`, payload).then(r => r.data),
  getPayments: (id: string) =>
    api.get<CustomerPayment[]>(`/customers/${id}/payments`).then(r => r.data),
  getAllPayments: (params?: { lorryId?: string; customerId?: string; from?: string; to?: string }) =>
    api.get<CustomerPayment[]>('/customer-payments', { params }).then(r => r.data),
  deletePayment: (paymentId: string) =>
    api.delete<{ message: string }>(`/customer-payments/${paymentId}`).then(r => r.data)
};

export const OrderService = {
  getAll: (
    status?: string,
    lorryId?: string,
    routeId?: string,
    limit?: number,
    from?: string,
    to?: string
  ) =>
    api
      .get<Order[]>('/orders', { params: { status, lorryId, routeId, limit, from, to } })
      .then(r => r.data),
  getById: (id: string) =>
    api.get<Order>(`/orders/${id}`).then(r => r.data),
  create: (payload: {
    customerId?: string;
    walkInName?: string;
    walkInPhone?: string;
    paperBillNumber?: string;
    items: { productId: string; quantity: number; freeQuantity?: number; unitPrice?: number }[];
    returnItems?: { productId: string; quantity: number; unitPrice?: number; returnType: 'DAMAGE' | 'RESALE'; reason?: string }[];
    paymentStatus?: string;
    paymentMethod?: string;
    cashReceived?: number;
    discountAmount?: number;
    discountPercentage?: number;
    notes?: string;
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    lorryId?: string;
    settlePreviousBills?: { orderId: string; amount: number; paymentMethod?: string }[];
  }) => api.post<Order>('/orders', payload).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    api.patch<Order>(`/orders/${id}/status`, { status }).then(r => r.data)
};

export interface ChequeStats {
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  maturedCount: number;
  maturedAmount: number;
  depositedCount: number;
  depositedAmount: number;
  clearedCount: number;
  clearedAmount: number;
  bouncedCount: number;
  bouncedAmount: number;
}

export const ChequeService = {
  getAll: (params?: { status?: string; search?: string }) =>
    api.get<CustomerPayment[]>('/cheques', { params }).then(r => r.data),
  getStats: () =>
    api.get<ChequeStats>('/cheques/stats').then(r => r.data),
  updateStatus: (id: string, payload: {
    status: 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED';
    depositBank?: string;
    depositDate?: string;
    clearedDate?: string;
    bounceReason?: string;
    notes?: string;
  }) => api.put<CustomerPayment>(`/cheques/${id}/status`, payload).then(r => r.data),
  update: (id: string, payload: {
    chequeNumber?: string;
    bankName?: string;
    chequeDate?: string;
    notes?: string;
    depositBank?: string;
  }) => api.put<CustomerPayment>(`/cheques/${id}`, payload).then(r => r.data)
};

export const ReportService = {
  getDashboardStats: (from?: string, to?: string) =>
    api.get<DashboardStats>('/reports/dashboard-stats', { params: { from, to } }).then(r => r.data),
  getLorryPerformance: (from?: string, to?: string) =>
    api.get<LorryPerformanceReport>('/reports/lorry-performance', { params: { from, to } }).then(r => r.data),
  getRepPerformance: (from?: string, to?: string) =>
    api.get<RepPerformanceReport>('/reports/rep-performance', { params: { from, to } }).then(r => r.data),
  getRouteSales: (from?: string, to?: string) =>
    api.get<any[]>('/reports/route-sales', { params: { from, to } }).then(r => r.data),
  getSalesSummary: (from?: string, to?: string, lorryId?: string, routeId?: string) =>
    api.get<any>('/reports/sales-summary', { params: { from, to, lorryId, routeId } }).then(r => r.data),
  getStockMovements: (type?: string, limit?: number, from?: string, to?: string) =>
    api.get<StockMovement[]>('/reports/stock-movements', { params: { type, limit, from, to } }).then(r => r.data),
  getCustomerBalances: () =>
    api.get<any>('/reports/customer-balances').then(r => r.data),
  getProfitAndLoss: (from?: string, to?: string) =>
    api.get<ProfitAndLossReport>('/reports/profit-and-loss', { params: { from, to } }).then(r => r.data),
  getVehicleReturns: (from?: string, to?: string, lorryId?: string) =>
    api.get<VehicleReturnsReport>('/reports/vehicle-returns', { params: { from, to, lorryId } }).then(r => r.data)
};

export const SettingsService = {
  get: () =>
    api.get<SystemSettings>('/settings').then(r => r.data),
  update: (data: Partial<SystemSettings>) =>
    api.put<SystemSettings>('/settings', data).then(r => r.data)
};

export const SupplierService = {
  getAll: (search?: string) =>
    api.get<Supplier[]>('/suppliers', { params: { search } }).then(r => r.data),
  getById: (id: string) =>
    api.get<Supplier>(`/suppliers/${id}`).then(r => r.data),
  create: (data: Partial<Supplier>) =>
    api.post<Supplier>('/suppliers', data).then(r => r.data),
  update: (id: string, data: Partial<Supplier>) =>
    api.put<Supplier>(`/suppliers/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/suppliers/${id}`).then(r => r.data),
  recordPayment: (id: string, payload: { amount: number; paymentMethod?: string; notes?: string }) =>
    api.post<{ message: string; supplier: Supplier }>(`/suppliers/${id}/payments`, payload).then(r => r.data)
};

export const PurchaseOrderService = {
  getAll: (params?: { supplierId?: string; from?: string; to?: string }) =>
    api.get<PurchaseOrder[]>('/purchase-orders', { params }).then(r => r.data),
  create: (payload: {
    supplierId: string;
    supplierInvoiceNumber?: string;
    date?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    paidAmount?: number;
    notes?: string;
    items: { productId: string; quantity: number; costPrice: number }[];
  }) => api.post<PurchaseOrder>('/purchase-orders', payload).then(r => r.data)
};

export const ExpenseService = {
  getAll: (params?: {
    from?: string;
    to?: string;
    category?: string;
    lorryId?: string;
    paymentMethod?: string;
    search?: string;
  }) => api.get<Expense[]>('/expenses', { params }).then(r => r.data),
  getSummary: (from?: string, to?: string) =>
    api.get<ExpenseSummary>('/expenses/summary', { params: { from, to } }).then(r => r.data),
  getById: (id: string) =>
    api.get<Expense>(`/expenses/${id}`).then(r => r.data),
  create: (data: {
    category: string;
    title: string;
    amount: number;
    date?: string;
    paymentMethod?: string;
    referenceNumber?: string;
    paidTo?: string;
    notes?: string;
    lorryId?: string;
    loadingId?: string;
  }) => api.post<Expense>('/expenses', data).then(r => r.data),
  update: (id: string, data: Partial<Expense>) =>
    api.put<Expense>(`/expenses/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/expenses/${id}`).then(r => r.data)
};

export const ManufacturingService = {
  getRecipes: (search?: string) =>
    api.get<Recipe[]>('/manufacturing/recipes', { params: { search } }).then(r => r.data),
  getRecipeById: (id: string) =>
    api.get<Recipe>(`/manufacturing/recipes/${id}`).then(r => r.data),
  createRecipe: (data: {
    name: string;
    productId: string;
    outputYield?: number;
    estimatedOverheadCost?: number;
    notes?: string;
    items: { componentProductId: string; quantity: number; notes?: string }[];
  }) => api.post<Recipe>('/manufacturing/recipes', data).then(r => r.data),
  updateRecipe: (id: string, data: Partial<{
    name: string;
    productId: string;
    outputYield: number;
    estimatedOverheadCost: number;
    notes: string;
    items: { componentProductId: string; quantity: number; notes?: string }[];
  }>) => api.put<Recipe>(`/manufacturing/recipes/${id}`, data).then(r => r.data),
  deleteRecipe: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/manufacturing/recipes/${id}`).then(r => r.data),

  getProductionRuns: (params?: { recipeId?: string; status?: string; from?: string; to?: string }) =>
    api.get<ProductionRun[]>('/manufacturing/production-runs', { params }).then(r => r.data),
  getProductionRunById: (id: string) =>
    api.get<ProductionRun>(`/manufacturing/production-runs/${id}`).then(r => r.data),
  createProductionRun: (data: {
    recipeId: string;
    targetQuantity: number;
    actualQuantity?: number;
    overheadCost?: number;
    producedBy?: string;
    notes?: string;
    completeImmediately?: boolean;
  }) => api.post<ProductionRun>('/manufacturing/production-runs', data).then(r => r.data),
  completeProductionRun: (id: string, data?: { actualQuantity?: number; overheadCost?: number; notes?: string }) =>
    api.post<ProductionRun>(`/manufacturing/production-runs/${id}/complete`, data || {}).then(r => r.data),
  cancelProductionRun: (id: string) =>
    api.post<ProductionRun>(`/manufacturing/production-runs/${id}/cancel`).then(r => r.data),
  getSummary: () =>
    api.get<ManufacturingSummary>('/manufacturing/summary').then(r => r.data)
};

export const AuthService = {
  login: (credentials: { username: string; password: string }) =>
    api.post<{ user: User }>('/auth/login', credentials).then(r => r.data),
  getUsers: () =>
    api.get<User[]>('/users').then(r => r.data),
  createUser: (data: {
    username: string;
    password: string;
    fullName: string;
    role?: 'ADMIN' | 'REP';
    phone?: string;
    lorryId?: string;
    monthlyTarget?: number;
    dailyTarget?: number;
    targetNewClients?: number;
  }) => api.post<User>('/users', data).then(r => r.data),
  updateUser: (id: string, data: Partial<User> & { password?: string }) =>
    api.put<User>(`/users/${id}`, data).then(r => r.data),
  deleteUser: (id: string) =>
    api.delete<{ success: boolean }>(`/users/${id}`).then(r => r.data),
  getMyTargets: (params: { userId?: string; lorryId?: string }) =>
    api.get<RepTargetProgress>('/reps/my-targets', { params }).then(r => r.data)
};

export const BackupService = {
  exportData: () =>
    api.get('/backup/export').then(response => {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `distributor_pro_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return response.data;
    }),
  importData: (payload: any) =>
    api.post<{ success: boolean; message: string; importedCounts: Record<string, number> }>('/backup/import', payload).then(r => r.data),
  wipeDatabase: () =>
    api.post<{ success: boolean; message: string }>('/database/wipe-all').then(r => r.data)
};

export const HrService = {
  // Employees
  getEmployees: (params?: { department?: string; status?: string; search?: string }) =>
    api.get<Employee[]>('/hr/employees', { params }).then(r => r.data),
  syncStaff: () =>
    api.post<{ success: boolean; message: string; totalEmployees: number }>('/hr/employees/sync').then(r => r.data),
  getEmployeeById: (id: string) =>
    api.get<Employee>(`/hr/employees/${id}`).then(r => r.data),
  createEmployee: (data: Partial<Employee>) =>
    api.post<Employee>('/hr/employees', data).then(r => r.data),
  updateEmployee: (id: string, data: Partial<Employee>) =>
    api.put<Employee>(`/hr/employees/${id}`, data).then(r => r.data),
  deleteEmployee: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/hr/employees/${id}`).then(r => r.data),

  // Attendance
  getAttendance: (params?: { date?: string; startDate?: string; endDate?: string; employeeId?: string; department?: string }) =>
    api.get<{ date: string; attendances: any[]; summary: any } | Attendance[]>('/hr/attendance', { params }).then(r => r.data),
  saveAttendance: (data: { employeeId: string; date: string; status: string; checkInTime?: string; checkOutTime?: string; otHours?: number; notes?: string }) =>
    api.post<Attendance>('/hr/attendance', data).then(r => r.data),
  bulkAttendance: (data: { records: Array<{ employeeId: string; status: string; otHours?: number; notes?: string }>; date: string }) =>
    api.post<{ success: boolean; count: number }>('/hr/attendance/bulk', data).then(r => r.data),

  // Salary Advances
  getAdvances: (params?: { employeeId?: string; status?: string; month?: number; year?: number }) =>
    api.get<SalaryAdvance[]>('/hr/advances', { params }).then(r => r.data),
  createAdvance: (data: { employeeId: string; amount: number; date: string; reason?: string; paymentMethod?: string; notes?: string }) =>
    api.post<SalaryAdvance>('/hr/advances', data).then(r => r.data),
  deleteAdvance: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/hr/advances/${id}`).then(r => r.data),

  // Payroll
  getPayrolls: (params?: { employeeId?: string; month?: number; year?: number; paymentStatus?: string }) =>
    api.get<Payroll[]>('/hr/payroll', { params }).then(r => r.data),
  getPayrollPreview: (employeeId: string, params: { month: number; year: number; customCommission?: number; customBonus?: number; customOtherDeductions?: number }) =>
    api.get<any>(`/hr/payroll/preview/${employeeId}`, { params }).then(r => r.data),
  generatePayroll: (data: {
    employeeId: string;
    month: number;
    year: number;
    workedDays?: number;
    absentDays?: number;
    leaveDays?: number;
    otHours?: number;
    basicSalary?: number;
    otAmount?: number;
    allowances?: number;
    salesCommission?: number;
    performanceBonus?: number;
    advancesDeducted?: number;
    epfDeduction?: number;
    employerEpf?: number;
    employerEtf?: number;
    otherDeductions?: number;
    paymentMethod?: string;
    autoPayNow?: boolean;
    notes?: string;
  }) => api.post<Payroll>('/hr/payroll/generate', data).then(r => r.data),
  getPayrollById: (id: string) =>
    api.get<Payroll>(`/hr/payroll/${id}`).then(r => r.data),
  updatePayrollStatus: (id: string, data: { paymentStatus: 'APPROVED' | 'PAID'; paymentMethod?: string; paidAt?: string }) =>
    api.put<Payroll>(`/hr/payroll/${id}/status`, data).then(r => r.data),
  deletePayroll: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/hr/payroll/${id}`).then(r => r.data),

  // Summary
  getSummary: () =>
    api.get<HrPayrollSummary>('/hr/summary').then(r => r.data)
};

