export interface Route {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  lorries?: Lorry[];
  _count?: {
    customers: number;
    orders: number;
  };
}

export interface Lorry {
  id: string;
  vehicleNumber: string;
  driverName: string;
  driverPhone?: string | null;
  routeId?: string | null;
  route?: Route | null;
  status: 'ACTIVE' | 'MAINTENANCE';
  lorryStocks?: LorryStock[];
  loadings?: LorryLoading[];
}

export interface LorryStock {
  id: string;
  lorryId: string;
  productId: string;
  product: Product;
  quantity: number;
  freeQuantity?: number;
  updatedAt: string;
}

export interface LorryLoadingItem {
  id: string;
  loadingId: string;
  productId: string;
  product: Product;
  loadedQty: number;
  loadedFreeQty?: number;
  soldQty: number;
  freeQty: number;
  returnedQty: number;
  returnedFreeQty?: number;
  discrepancyQty: number;
}

export interface LorryLoading {
  id: string;
  loadingNumber: string;
  lorryId: string;
  lorry: Lorry;
  routeId?: string | null;
  date: string;
  status: 'LOADED' | 'IN_TRANSIT' | 'SETTLED';
  notes?: string | null;
  totalLoadedItems: number;
  totalSoldItems: number;
  totalFreeItems: number;
  totalReturnedItems: number;
  totalSalesAmount: number;
  cashCollected: number;
  creditGiven: number;
  settledAt?: string | null;
  items: LorryLoadingItem[];
  expenses?: Expense[];
  customerReturns?: OrderReturn[];
  routeCollections?: CustomerPayment[];
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  currentStock: number; // Main warehouse stock
  freeStock: number; // Warehouse promotional free issue stock (Cost = 0)
  damageStock?: number; // Damaged / expired returned stock
  minStockAlert: number;
  freeRatioBuy?: number;
  freeRatioGet?: number;
  isRawMaterial?: boolean;
  supplierId?: string | null;
  supplier?: Supplier | null;
  createdAt: string;
  updatedAt: string;
  lorryStocks?: {
    quantity: number;
    freeQuantity?: number;
    lorry: Lorry;
  }[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  city: string;
  paymentTerms?: string | null;
  outstandingBalance: number;
  createdAt: string;
  updatedAt: string;
  products?: Product[];
  purchaseOrders?: PurchaseOrder[];
  _count?: {
    products: number;
    purchaseOrders: number;
  };
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  product: Product;
  quantity: number;
  freeQuantity?: number;
  costPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierInvoiceNumber?: string | null;
  supplierId: string;
  supplier: Supplier;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  date: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  notes?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  companyName?: string | null;
  phone: string;
  deliveryAddress: string;
  city: string;
  routeId?: string | null;
  route?: Route | null;
  pricingTier: 'STANDARD' | 'WHOLESALE' | 'VIP';
  discountPercentage: number;
  creditLimit: number;
  outstandingBalance: number;
  maxCreditInvoices?: number;
  createdAt: string;
  updatedAt: string;
  payments?: CustomerPayment[];
  _count?: {
    orders: number;
    payments?: number;
  };
}

export interface CustomerPayment {
  id: string;
  receiptNumber: string;
  customerId: string;
  customer?: Customer;
  amount: number;
  paymentMethod: 'CASH' | 'CHEQUE' | 'BANK_TRANSFER';
  chequeNumber?: string | null;
  bankName?: string | null;
  chequeDate?: string | null;
  chequeStatus?: 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED' | null;
  depositDate?: string | null;
  clearedDate?: string | null;
  bouncedDate?: string | null;
  depositBank?: string | null;
  bounceReason?: string | null;
  reference?: string | null;
  notes?: string | null;
  collectedBy?: string | null;
  lorryId?: string | null;
  lorry?: Lorry | null;
  allocations?: BillPaymentAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface BillPaymentAllocation {
  id: string;
  paymentId: string;
  payment?: CustomerPayment;
  orderId: string;
  order?: Order;
  amount: number;
  notes?: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product: Product;
  quantity: number;
  freeQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderReturn {
  id: string;
  orderId: string;
  order?: Order;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  returnType: 'DAMAGE' | 'RESALE';
  reason?: string | null;
  createdAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  paperBillNumber?: string | null;
  customerId: string;
  customer: Customer;
  lorryId?: string | null;
  lorry?: Lorry | null;
  routeId?: string | null;
  route?: Route | null;
  status: 'PENDING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentMethod: 'CASH' | 'CREDIT' | 'CHEQUE';
  chequeNumber?: string | null;
  bankName?: string | null;
  chequeDate?: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  returnAmount?: number;
  netTotal: number;
  cashReceived: number;
  paidAmount?: number;
  balanceAmount?: number;
  daysOpen?: number;
  allocations?: BillPaymentAllocation[];
  notes?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  returns?: OrderReturn[];
}

export interface FreeIssueBillDetail {
  orderId: string;
  orderNumber: string;
  paperBillNumber?: string | null;
  date: string;
  customerName: string;
  customerCode?: string | null;
  lorryNumber?: string;
  paidQty: number;
  freeQty: number;
  freeValue: number;
}

export interface FreeIssueItem {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  freeRatioBuy: number;
  freeRatioGet: number;
  paidQuantity: number;
  freeQuantity: number;
  totalQuantity: number;
  freeRatioPercent: number;
  freeRetailValue: number;
  freeCostValue: number;
  paidRevenue: number;
  billsCount: number;
  bills: FreeIssueBillDetail[];
}

export interface FreeIssuesReport {
  from: string;
  to: string;
  summary: {
    totalOrdersCount: number;
    ordersWithFreeCount: number;
    totalFreeUnits: number;
    totalPaidUnits: number;
    totalUnits: number;
    overallFreePercent: number;
    totalFreeRetailValue: number;
    totalFreeCostValue: number;
    distinctPromotionalItemsCount: number;
  };
  items: FreeIssueItem[];
}

export interface StockMovement {
  id: string;
  productId: string;
  product: Product;
  type: 'INBOUND' | 'LORRY_LOAD' | 'LORRY_RETURN' | 'OUTBOUND' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE_RETURN';
  quantity: number;
  isFreeIssue?: boolean;
  referenceId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface FleetLorryStatus {
  id: string;
  vehicleNumber: string;
  driverName: string;
  routeName: string;
  status: 'READY_TO_LOAD' | 'ACTIVE' | 'SETTLED';
  floatingStockUnits: number;
  todaySales: number;
  todayCash: number;
  todayExpenses?: number;
}

export interface DashboardStats {
  revenueToday: number;
  cashToday: number;
  creditToday: number;
  chequesToday?: number;
  ordersTodayCount: number;
  lowStockCount: number;
  totalOutstanding: number;
  expensesToday: number;
  netProfitToday: number;
  creditCollectionsToday?: number;
  orderCashToday?: number;
  directCashCollections?: number;
  fleetStatus: FleetLorryStatus[];
  repLiveStatus?: RepLiveStatus[];
  recentOrders: Order[];
  lowStockItems: Product[];
}

export interface RepLiveStatus {
  id: string;
  fullName: string;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  vehicleNumber?: string | null;
  driverName?: string | null;
  routeName?: string | null;
  todaySales: number;
  todayCash: number;
  todayCredit: number;
  todayCheque?: number;
  todayCollections?: number;
  todayBillsCount: number;
  dailyTarget: number;
  dailyAchievementPercentage: number;
  monthlyTarget: number;
  monthToDateSales: number;
  monthlyAchievementPercentage: number;
}

export interface SystemSettings {
  companyName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  registrationNumber: string;
  invoiceFooterNote: string;
  defaultCurrency: string;
  defaultCreditLimit: number;
  lowStockThreshold: number;
}

export type ExpenseCategory =
  | 'FUEL'
  | 'VEHICLE_MAINTENANCE'
  | 'DRIVER_ALLOWANCE'
  | 'RENT'
  | 'UTILITIES'
  | 'SALARIES'
  | 'PACKAGING'
  | 'PETTY_CASH'
  | 'OTHER';

export interface Expense {
  id: string;
  expenseNumber: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  date: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE';
  referenceNumber?: string | null;
  paidTo?: string | null;
  notes?: string | null;
  lorryId?: string | null;
  lorry?: Lorry | null;
  loadingId?: string | null;
  loading?: LorryLoading | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  totalCount: number;
  fleetExpenses: number;
  overheadExpenses: number;
  byCategory: Array<{
    category: ExpenseCategory;
    amount: number;
    count: number;
  }>;
  byLorry: Array<{
    lorryId: string;
    vehicleNumber: string;
    driverName: string;
    amount: number;
    count: number;
  }>;
  byPaymentMethod: Array<{
    paymentMethod: string;
    amount: number;
  }>;
}

export interface ProfitAndLossReport {
  period: {
    from: string;
    to: string;
  };
  summary: {
    grossRevenue: number;
    discounts: number;
    netRevenue: number;
    cogs: number;
    freeIssueCost: number;
    totalCostOfSales: number;
    grossProfit: number;
    grossProfitMargin: number;
    markupPercentage: number;
    totalUnitsSold: number;
    totalFreeUnits: number;
    totalOrdersCount: number;
    cashCollected: number;
    chequesCollected?: number;
    creditReceivables: number;
    totalExpenses: number;
    netOperatingProfit: number;
    netProfitMargin: number;
    fleetExpenses: number;
    overheadExpenses: number;
  };
  expensesByCategory: Array<{
    category: ExpenseCategory;
    amount: number;
    count: number;
  }>;
  channelBreakdown: Array<{
    id: string;
    channelName: string;
    subtext: string;
    billsCount: number;
    netRevenue: number;
    cogs: number;
    freeIssueCost: number;
    totalCost: number;
    grossProfit: number;
    margin: number;
    expenses?: number;
    netProfit?: number;
  }>;
  productBreakdown: Array<{
    productId: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    unitPrice: number;
    costPrice: number;
    unitsSold: number;
    unitsFree: number;
    revenue: number;
    cogs: number;
    freeCost: number;
    totalCost: number;
    grossProfit: number;
    margin: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
    expenses?: number;
  }>;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  componentProductId: string;
  componentProduct?: Product;
  quantity: number;
  notes?: string | null;
}

export interface Recipe {
  id: string;
  code: string;
  name: string;
  productId: string;
  product?: Product;
  outputYield: number;
  estimatedOverheadCost: number;
  notes?: string | null;
  items: RecipeItem[];
  productionRuns?: ProductionRun[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductionRunItem {
  id: string;
  productionRunId: string;
  productId: string;
  product?: Product;
  plannedQuantity: number;
  actualQuantity: number;
  unitCost: number;
  lineCost: number;
}

export interface ProductionRun {
  id: string;
  batchNumber: string;
  recipeId: string;
  recipe?: Recipe;
  targetQuantity: number;
  actualQuantity: number;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  totalRawMaterialCost: number;
  overheadCost: number;
  totalProductionCost: number;
  unitCost: number;
  producedBy?: string | null;
  notes?: string | null;
  startDate: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ProductionRunItem[];
}
export interface ManufacturingSummary {
  totalBatchesCount: number;
  totalUnitsManufactured: number;
  totalProductionCost: number;
  activeRecipesCount: number;
}

export interface LorryWiseSummary {
  lorryId: string;
  vehicleNumber: string;
  driverName: string;
  routeName?: string | null;
  routeCode?: string | null;
  loadingsCount: number;
  ordersCount: number;
  totalAllSales: number;
  totalCashSales: number;
  totalCreditSale: number;
  cashRatio: number;
  totalSoldItems: number;
}

export interface LorryPerformanceReport {
  summary: {
    totalAllSales: number;
    totalCashSales: number;
    totalCreditSale: number;
    totalLoadedItems: number;
    totalSoldItems: number;
    totalFreeItems: number;
    totalReturnedItems: number;
    activeLorriesCount: number;
    totalLoadingsCount: number;
  };
  lorrySummaries: LorryWiseSummary[];
  loadings: (LorryLoading & {
    totalAllSales: number;
    totalCashSales: number;
    totalCreditSale: number;
  })[];
}

export interface VehicleReturnItemDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  paperBillNumber?: string | null;
  date: string;
  customerId: string;
  customerName: string;
  lorryId?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  routeName?: string | null;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  returnType: 'DAMAGE' | 'RESALE';
  reason?: string | null;
}

export interface VehicleReturnSummary {
  lorryId: string | null;
  vehicleNumber: string;
  driverName: string;
  routeName?: string | null;
  routeCode?: string | null;
  damageCount: number;
  damageValue: number;
  resaleCount: number;
  resaleValue: number;
  totalReturnsCount: number;
  totalReturnsValue: number;
  eveningUnsoldReturnsCount: number;
  billsWithReturnsCount: number;
  items: VehicleReturnItemDetail[];
}

export interface VehicleReturnsReport {
  summary: {
    totalReturnValue: number;
    totalDamageValue: number;
    totalDamageUnits: number;
    totalResaleValue: number;
    totalResaleUnits: number;
    totalEveningUnsoldUnits: number;
    totalVehiclesWithReturns: number;
    totalBillsWithReturns: number;
  };
  vehicles: VehicleReturnSummary[];
  recentReturnItems: VehicleReturnItemDetail[];
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'REP';
  phone?: string | null;
  lorryId?: string | null;
  lorry?: {
    id: string;
    vehicleNumber: string;
    driverName: string;
    routeId?: string | null;
    route?: Route | null;
    routeName?: string | null;
    routeCode?: string | null;
  } | null;
  status: 'ACTIVE' | 'INACTIVE';
  monthlyTarget?: number;
  dailyTarget?: number;
  targetNewClients?: number;
  actualSalesThisMonth?: number;
  achievementPercentage?: number;
}

export interface RepTargetProgress {
  dailyTarget: number;
  monthlyTarget: number;
  targetNewClients: number;
  achievedToday: number;
  achievedMonth: number;
  todayBillsCount: number;
  monthBillsCount: number;
  dailyPercentage: number;
  monthlyPercentage: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  repName?: string;
  lorryVehicle?: string | null;
  routeName?: string | null;
}

export interface RepWiseSummary {
  repId: string;
  fullName: string;
  username: string;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  lorryId?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  routeName?: string | null;
  routeCode?: string | null;
  dailyTarget: number;
  monthlyTarget: number;
  targetNewClients: number;
  periodSales: number;
  periodCash: number;
  periodCredit: number;
  cashRatio: number;
  ordersCount: number;
  dailyAchievementPercentage: number;
  monthToDateSales: number;
  monthlyAchievementPercentage: number;
  newClientsCount: number;
  statusBadge: 'MET_TARGET' | 'ON_TRACK' | 'IN_PROGRESS';
}

export interface RepOrderLog {
  orderId: string;
  orderNumber: string;
  paperBillNumber?: string | null;
  customerId: string;
  customerName: string;
  customerCode: string;
  repId?: string | null;
  repName: string;
  lorryId?: string | null;
  vehicleNumber?: string | null;
  routeName?: string | null;
  netTotal: number;
  cashReceived: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  chequeNumber?: string | null;
  bankName?: string | null;
  createdAt: string;
}

export interface RepPerformanceReport {
  summary: {
    totalRepSales: number;
    totalRepCash: number;
    totalRepCredit: number;
    totalRepBills: number;
    totalDailyTarget: number;
    totalMonthlyTarget: number;
    avgDailyAchievement: number;
    avgMonthlyAchievement: number;
    activeRepsCount: number;
  };
  repSummaries: RepWiseSummary[];
  repOrders: RepOrderLog[];
}

// --------------------------------------------------------
// 10. HR & PAYROLL MANAGEMENT INTERFACES
// --------------------------------------------------------
export type EmployeeDepartment = 'SALES_FLEET' | 'WAREHOUSE' | 'MANUFACTURING' | 'ADMIN';
export type EmploymentType = 'FULL_TIME' | 'DAILY_WAGE' | 'CONTRACT';
export type AttendanceStatus = 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'LEAVE';

export interface Employee {
  id: string;
  employeeNumber: string;
  fullName: string;
  callingName?: string | null;
  nicNumber?: string | null;
  phone: string;
  address?: string | null;
  designation: string;
  department: EmployeeDepartment;
  employmentType: EmploymentType;
  joinDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
  basicSalary: number;
  dailyRate: number;
  otHourlyRate: number;
  allowances: number;
  commissionRate: number;
  bankName?: string | null;
  branchName?: string | null;
  accountNumber?: string | null;
  epfNumber?: string | null;
  userId?: string | null;
  lorryId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  attendances?: Attendance[];
  salaryAdvances?: SalaryAdvance[];
  payrolls?: Payroll[];
}

export interface Attendance {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  otHours: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryAdvance {
  id: string;
  advanceNumber: string;
  employeeId: string;
  employee?: Employee;
  amount: number;
  date: string;
  reason?: string | null;
  paymentMethod: string;
  status: 'PENDING' | 'DEDUCTED' | 'CANCELLED';
  payrollId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payroll {
  id: string;
  payslipNumber: string;
  employeeId: string;
  employee?: Employee;
  month: number;
  year: number;
  workedDays: number;
  absentDays: number;
  leaveDays: number;
  otHours: number;
  basicSalary: number;
  otAmount: number;
  allowances: number;
  salesCommission: number;
  performanceBonus: number;
  grossEarnings: number;
  advancesDeducted: number;
  epfDeduction: number;
  employerEpf: number;
  employerEtf: number;
  otherDeductions: number;
  totalDeductions: number;
  netPayable: number;
  paymentStatus: 'DRAFT' | 'APPROVED' | 'PAID';
  paymentMethod: string;
  paidAt?: string | null;
  expenseId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  salaryAdvances?: SalaryAdvance[];
}

export interface HrPayrollSummary {
  totalEmployees: number;
  activeEmployees: number;
  todayPresentCount: number;
  todayAbsentCount: number;
  pendingAdvancesTotal: number;
  currentMonthPayrollTotal: number;
  departmentCounts: Record<string, number>;
}
