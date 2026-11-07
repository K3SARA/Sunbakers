import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import { prisma } from './prisma';

const app = express();
const PORT = process.env.PORT || 4812;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging in dev
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// System Settings Helper & Defaults
const SETTINGS_FILE = path.join(__dirname, '../settings.json');

const defaultSettings = {
  companyName: 'Sunbakers & confectionary',
  tagline: 'Fresh Bakery & Confectionary Distribution',
  phone: '+94 77 254 9414',
  email: 'sunbakers@gmail.com',
  address: '239,kurukutthala ,kadugannawa',
  registrationNumber: '',
  invoiceFooterNote: 'Goods received in fresh & satisfactory condition. Thank you for your business!',
  defaultCurrency: 'LKR',
  defaultCreditLimit: 50000,
  lowStockThreshold: 10
};

function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading settings file:', err);
  }
  return defaultSettings;
}

function saveSettings(settings: any) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing settings file:', err);
  }
}

// Auto-generate unique Employee sequence numbers (EMP-001, EMP-002...)
async function generateNextEmployeeNumber(): Promise<string> {
  const allEmployees = await prisma.employee.findMany({ select: { employeeNumber: true } });
  let maxNum = 0;
  for (const emp of allEmployees) {
    const match = emp.employeeNumber.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `EMP-${(maxNum + 1).toString().padStart(3, '0')}`;
}

// Auto-detect and sync sales reps and lorry drivers from fleet into staff directory
async function syncFleetAndRepsToEmployees() {
  try {
    const [reps, lorries] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['REP', 'rep'] } },
        include: { lorry: true }
      }),
      prisma.lorry.findMany()
    ]);

    // 1. Sync Sales Reps into Employee directory
    for (const rep of reps) {
      const trimmedRepName = rep.fullName.trim();
      const callingName = rep.username?.trim() || trimmedRepName.split(' ')[0];
      const repPhone = rep.phone?.trim() || null;
      const expectedStatus = rep.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

      // 1. Try finding employee by linked userId
      let emp = await prisma.employee.findFirst({
        where: { userId: rep.id }
      });

      // 2. If not found by userId, try matching unlinked employee by fullName or callingName (case-insensitive)
      if (!emp) {
        const allEmps = await prisma.employee.findMany();
        emp = allEmps.find(e =>
          !e.userId && (
            e.fullName.trim().toLowerCase() === trimmedRepName.toLowerCase() ||
            (e.callingName && e.callingName.trim().toLowerCase() === rep.username.trim().toLowerCase())
          )
        ) || null;
      }

      if (!emp) {
        const employeeNumber = await generateNextEmployeeNumber();
        await prisma.employee.create({
          data: {
            employeeNumber,
            fullName: trimmedRepName,
            callingName,
            phone: repPhone || '077 000 0000',
            designation: 'Sales Representative',
            department: 'SALES_FLEET',
            employmentType: 'FULL_TIME',
            basicSalary: 45000,
            allowances: 5000,
            otHourlyRate: 350,
            commissionRate: 1.5,
            userId: rep.id,
            lorryId: rep.lorryId || null,
            status: expectedStatus,
            joinDate: rep.createdAt || new Date()
          }
        });
      } else {
        const updateData: any = {};
        if (emp.userId !== rep.id) updateData.userId = rep.id;
        if (emp.fullName !== trimmedRepName) updateData.fullName = trimmedRepName;
        if (callingName && emp.callingName !== callingName) updateData.callingName = callingName;
        if (repPhone && emp.phone !== repPhone) updateData.phone = repPhone;
        if (emp.lorryId !== (rep.lorryId || null)) updateData.lorryId = rep.lorryId || null;
        if (emp.status !== expectedStatus) updateData.status = expectedStatus;

        if (Object.keys(updateData).length > 0) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: updateData
          });
        }
      }
    }

    // 2. Sync Lorry Drivers into Employee directory
    for (const lorry of lorries) {
      if (!lorry.driverName || lorry.driverName.trim() === '') continue;

      const trimmedDriverName = lorry.driverName.trim();
      const callingName = trimmedDriverName.split(' ')[0];
      const driverPhone = lorry.driverPhone?.trim() || null;
      const expectedStatus = lorry.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

      let emp = await prisma.employee.findFirst({
        where: {
          OR: [
            { lorryId: lorry.id, designation: { contains: 'Driver' } },
            { fullName: trimmedDriverName }
          ]
        }
      });

      if (!emp) {
        const employeeNumber = await generateNextEmployeeNumber();
        await prisma.employee.create({
          data: {
            employeeNumber,
            fullName: trimmedDriverName,
            callingName,
            phone: driverPhone || '077 000 0000',
            designation: 'Lorry Driver',
            department: 'SALES_FLEET',
            employmentType: 'FULL_TIME',
            basicSalary: 40000,
            dailyRate: 1500,
            otHourlyRate: 350,
            allowances: 4000,
            commissionRate: 0.5,
            lorryId: lorry.id,
            status: expectedStatus,
            joinDate: lorry.createdAt || new Date()
          }
        });
      } else {
        const updateData: any = {};
        if (emp.lorryId !== lorry.id) updateData.lorryId = lorry.id;
        if (emp.fullName !== trimmedDriverName) updateData.fullName = trimmedDriverName;
        if (callingName && emp.callingName !== callingName) updateData.callingName = callingName;
        if (driverPhone && emp.phone !== driverPhone) {
          updateData.phone = driverPhone;
        }
        if (emp.status !== expectedStatus) updateData.status = expectedStatus;

        if (Object.keys(updateData).length > 0) {
          await prisma.employee.update({
            where: { id: emp.id },
            data: updateData
          });
        }
      }
    }
  } catch (err) {
    console.error('[Sync Fleet & Reps Error]', err);
  }
}

// ========================================================
// 0. AUTHENTICATION & USER MANAGEMENT (ADMIN & ROUTE REPS)
// ========================================================

// Login endpoint (separates Admin vs Rep by role)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password).trim();

    const user = await prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername },
        status: 'ACTIVE'
      },
      include: {
        lorry: {
          include: {
            route: true
          }
        }
      }
    });

    if (!user || user.password !== cleanPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role, // 'ADMIN' | 'REP'
        phone: user.phone,
        lorryId: user.lorryId,
        lorry: user.lorry ? {
          id: user.lorry.id,
          vehicleNumber: user.lorry.vehicleNumber,
          driverName: user.lorry.driverName,
          routeId: user.lorry.routeId,
          routeName: user.lorry.route?.name || 'Assigned Route',
          routeCode: user.lorry.route?.code || ''
        } : null
      }
    });
  } catch (err: any) {
    console.error('[API Auth] Login error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

// List users (for admin management) with performance targets & progress
app.get('/api/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        lorry: {
          include: {
            route: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Compute month-to-date sales progress for sales reps
    const enhancedUsers = await Promise.all(
      users.map(async (u) => {
        let actualSalesThisMonth = 0;
        if (u.role === 'REP' && u.lorryId) {
          const salesAgg = await prisma.order.aggregate({
            _sum: { netTotal: true },
            where: {
              lorryId: u.lorryId,
              createdAt: { gte: startOfMonth }
            }
          });
          actualSalesThisMonth = salesAgg._sum.netTotal || 0;
        }

        const monthlyTarget = u.monthlyTarget || 0;
        const achievementPercentage =
          monthlyTarget > 0 ? Math.round((actualSalesThisMonth / monthlyTarget) * 100) : 0;

        return {
          ...u,
          actualSalesThisMonth,
          achievementPercentage
        };
      })
    );

    return res.json(enhancedUsers);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create new user (admin adds reps or admins with targets)
app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, role, phone, lorryId, monthlyTarget, dailyTarget, targetNewClients } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Username, password and full name required' });
    }

    const existing = await prisma.user.findUnique({
      where: { username: String(username).trim() }
    });
    if (existing) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const user = await prisma.user.create({
      data: {
        username: String(username).trim(),
        password: String(password).trim(),
        fullName: String(fullName).trim(),
        role: role === 'ADMIN' ? 'ADMIN' : 'REP',
        phone: phone ? String(phone).trim() : null,
        lorryId: lorryId || null,
        status: 'ACTIVE',
        monthlyTarget: monthlyTarget ? Number(monthlyTarget) : 0,
        dailyTarget: dailyTarget ? Number(dailyTarget) : 0,
        targetNewClients: targetNewClients ? Number(targetNewClients) : 0
      },
      include: {
        lorry: {
          include: {
            route: true
          }
        }
      }
    });

    if (user.role === 'REP') {
      await syncFleetAndRepsToEmployees();
    }

    return res.status(201).json(user);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update user / reset password / update sales targets
app.put('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password, fullName, role, phone, lorryId, status, monthlyTarget, dailyTarget, targetNewClients } = req.body;

    const data: any = {};
    if (password) data.password = String(password).trim();
    if (fullName) data.fullName = String(fullName).trim();
    if (role) data.role = role === 'ADMIN' ? 'ADMIN' : 'REP';
    if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
    if (lorryId !== undefined) data.lorryId = lorryId || null;
    if (status) data.status = status;
    if (monthlyTarget !== undefined) data.monthlyTarget = Number(monthlyTarget) || 0;
    if (dailyTarget !== undefined) data.dailyTarget = Number(dailyTarget) || 0;
    if (targetNewClients !== undefined) data.targetNewClients = Number(targetNewClients) || 0;

    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        lorry: {
          include: {
            route: true
          }
        }
      }
    });

    await syncFleetAndRepsToEmployees();

    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete or deactivate user
app.delete('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.json({ success: true, message: 'User already removed or does not exist' });
    }

    try {
      await prisma.user.delete({ where: { id } });
      await prisma.employee.updateMany({
        where: { userId: id },
        data: { status: 'INACTIVE', userId: null }
      });
    } catch {
      await prisma.user.update({
        where: { id },
        data: { status: 'INACTIVE', lorryId: null }
      });
      await prisma.employee.updateMany({
        where: { userId: id },
        data: { status: 'INACTIVE' }
      });
    }

    await syncFleetAndRepsToEmployees();

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Live Target & Achieved Progress for Mobile Sales Rep
app.get('/api/reps/my-targets', async (req: Request, res: Response) => {
  try {
    const { userId, lorryId } = req.query;

    let targetUser: any = null;
    if (userId && typeof userId === 'string') {
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { lorry: { include: { route: true } } }
      });
    }

    // Fallback if userId not provided or not found: find active REP user
    if (!targetUser) {
      targetUser = await prisma.user.findFirst({
        where: { role: 'REP', status: 'ACTIVE' },
        include: { lorry: { include: { route: true } } }
      });
    }

    // Final fallback to any user
    if (!targetUser) {
      targetUser = await prisma.user.findFirst({
        include: { lorry: { include: { route: true } } }
      });
    }

    const effectiveLorryId = (lorryId as string) || targetUser?.lorryId || null;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const orderWhereToday: any = {
      status: { not: 'CANCELLED' },
      createdAt: { gte: startOfDay }
    };

    const orderWhereMonth: any = {
      status: { not: 'CANCELLED' },
      createdAt: { gte: startOfMonth }
    };

    if (effectiveLorryId) {
      orderWhereToday.lorryId = effectiveLorryId;
      orderWhereMonth.lorryId = effectiveLorryId;
    }

    const todayAgg = await prisma.order.aggregate({
      _sum: { netTotal: true },
      _count: { id: true },
      where: orderWhereToday
    });
    const achievedToday = todayAgg._sum.netTotal || 0;
    const todayBillsCount = todayAgg._count.id || 0;

    const monthAgg = await prisma.order.aggregate({
      _sum: { netTotal: true },
      _count: { id: true },
      where: orderWhereMonth
    });
    const achievedMonth = monthAgg._sum.netTotal || 0;
    const monthBillsCount = monthAgg._count.id || 0;

    const dailyTarget = targetUser?.dailyTarget || 20000;
    const monthlyTarget = targetUser?.monthlyTarget || 500000;
    const targetNewClients = targetUser?.targetNewClients || 5;

    const dailyPercentage = dailyTarget > 0 ? Math.round((achievedToday / dailyTarget) * 100) : 0;
    const monthlyPercentage = monthlyTarget > 0 ? Math.round((achievedMonth / monthlyTarget) * 100) : 0;
    const dailyRemaining = Math.max(0, dailyTarget - achievedToday);
    const monthlyRemaining = Math.max(0, monthlyTarget - achievedMonth);

    return res.json({
      dailyTarget,
      monthlyTarget,
      targetNewClients,
      achievedToday,
      achievedMonth,
      todayBillsCount,
      monthBillsCount,
      dailyPercentage,
      monthlyPercentage,
      dailyRemaining,
      monthlyRemaining,
      repName: targetUser?.fullName || 'Sales Rep',
      lorryVehicle: targetUser?.lorry?.vehicleNumber || null,
      routeName: targetUser?.lorry?.route?.name || null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ========================================================
// 0.2 BACKUP & DATA MIGRATION ENGINE (CLOUD -> OFFLINE DESKTOP)
// ========================================================

// 1. Export complete system snapshot as JSON
app.get('/api/backup/export', async (_req: Request, res: Response) => {
  try {
    const settings = getSettings();
    const [
      users,
      suppliers,
      products,
      routes,
      lorries,
      lorryStocks,
      customers,
      loadings,
      orders,
      customerPayments,
      billPaymentAllocations,
      expenses,
      recipes,
      productionRuns,
      employees,
      attendances,
      salaryAdvances,
      payrolls
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.supplier.findMany(),
      prisma.product.findMany(),
      prisma.route.findMany(),
      prisma.lorry.findMany(),
      prisma.lorryStock.findMany(),
      prisma.customer.findMany(),
      prisma.lorryLoading.findMany({ include: { items: true } }),
      prisma.order.findMany({ include: { items: true, returns: true } }),
      prisma.customerPayment.findMany(),
      prisma.billPaymentAllocation.findMany(),
      prisma.expense.findMany(),
      prisma.recipe.findMany({ include: { items: true } }),
      prisma.productionRun.findMany({ include: { items: true } }),
      prisma.employee.findMany(),
      prisma.attendance.findMany(),
      prisma.salaryAdvance.findMany(),
      prisma.payroll.findMany()
    ]);

    const backupPayload = {
      version: '1.0.0',
      system: 'Distributor Pro Enterprise',
      exportedAt: new Date().toISOString(),
      counts: {
        users: users.length,
        suppliers: suppliers.length,
        products: products.length,
        routes: routes.length,
        lorries: lorries.length,
        customers: customers.length,
        loadings: loadings.length,
        orders: orders.length,
        payments: customerPayments.length,
        allocations: billPaymentAllocations.length,
        expenses: expenses.length,
        recipes: recipes.length,
        productionRuns: productionRuns.length,
        employees: employees.length,
        attendances: attendances.length,
        salaryAdvances: salaryAdvances.length,
        payrolls: payrolls.length
      },
      data: {
        settings,
        users,
        suppliers,
        products,
        routes,
        lorries,
        lorryStocks,
        customers,
        loadings,
        orders,
        customerPayments,
        billPaymentAllocations,
        expenses,
        recipes,
        productionRuns,
        employees,
        attendances,
        salaryAdvances,
        payrolls
      }
    };

    const filename = `distributor_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.json(backupPayload);
  } catch (err: any) {
    console.error('[Backup Export Error]', err);
    return res.status(500).json({ error: 'Failed to generate backup: ' + err.message });
  }
});

// 2. Ingest and restore JSON snapshot into local database
app.post('/api/backup/import', async (req: Request, res: Response) => {
  try {
    const backup = req.body;
    const data = backup.data || backup;
    if (!data) {
      return res.status(400).json({ error: 'Invalid backup format: missing "data" node.' });
    }

    const {
      settings,
      users = [],
      suppliers = [],
      products = [],
      routes = [],
      lorries = [],
      lorryStocks = [],
      customers = [],
      loadings = [],
      orders = [],
      customerPayments = [],
      billPaymentAllocations = [],
      expenses = [],
      recipes = [],
      productionRuns = [],
      employees = [],
      attendances = [],
      salaryAdvances = [],
      payrolls = []
    } = data;

    // 1. Settings
    if (settings) {
      saveSettings(settings);
    }

    // 2. Routes (first, before lorries & customers)
    for (const r of routes) {
      await prisma.route.upsert({
        where: { id: r.id },
        update: { code: r.code, name: r.name, description: r.description },
        create: { id: r.id, code: r.code, name: r.name, description: r.description }
      });
    }

    // 3. Lorries
    for (const l of lorries) {
      await prisma.lorry.upsert({
        where: { id: l.id },
        update: {
          vehicleNumber: l.vehicleNumber,
          driverName: l.driverName,
          driverPhone: l.driverPhone,
          routeId: l.routeId || null,
          status: l.status || 'ACTIVE'
        },
        create: {
          id: l.id,
          vehicleNumber: l.vehicleNumber,
          driverName: l.driverName,
          driverPhone: l.driverPhone,
          routeId: l.routeId || null,
          status: l.status || 'ACTIVE'
        }
      });
    }

    // 4. Users
    for (const u of users) {
      await prisma.user.upsert({
        where: { username: u.username },
        update: {
          password: u.password,
          fullName: u.fullName,
          role: u.role || 'REP',
          phone: u.phone || null,
          lorryId: u.lorryId || null,
          status: u.status || 'ACTIVE',
          monthlyTarget: Number(u.monthlyTarget) || 0,
          dailyTarget: Number(u.dailyTarget) || 0,
          targetNewClients: Number(u.targetNewClients) || 0
        },
        create: {
          id: u.id,
          username: u.username,
          password: u.password,
          fullName: u.fullName,
          role: u.role || 'REP',
          phone: u.phone || null,
          lorryId: u.lorryId || null,
          status: u.status || 'ACTIVE',
          monthlyTarget: Number(u.monthlyTarget) || 0,
          dailyTarget: Number(u.dailyTarget) || 0,
          targetNewClients: Number(u.targetNewClients) || 0
        }
      });
    }

    // 5. Suppliers
    for (const s of suppliers) {
      await prisma.supplier.upsert({
        where: { id: s.id },
        update: {
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson || null,
          phone: s.phone,
          email: s.email || null,
          address: s.address || null,
          city: s.city || 'Colombo',
          paymentTerms: s.paymentTerms || 'NET 30',
          outstandingBalance: s.outstandingBalance || 0
        },
        create: {
          id: s.id,
          code: s.code,
          name: s.name,
          contactPerson: s.contactPerson || null,
          phone: s.phone,
          email: s.email || null,
          address: s.address || null,
          city: s.city || 'Colombo',
          paymentTerms: s.paymentTerms || 'NET 30',
          outstandingBalance: s.outstandingBalance || 0
        }
      });
    }

    // 6. Products
    for (const p of products) {
      await prisma.product.upsert({
        where: { id: p.id },
        update: {
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit: p.unit,
          unitPrice: p.unitPrice,
          costPrice: p.costPrice,
          currentStock: p.currentStock,
          minStockAlert: p.minStockAlert,
          freeRatioBuy: p.freeRatioBuy || 0,
          freeRatioGet: p.freeRatioGet || 0,
          isRawMaterial: p.isRawMaterial || false,
          supplierId: p.supplierId || null
        },
        create: {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit: p.unit,
          unitPrice: p.unitPrice,
          costPrice: p.costPrice,
          currentStock: p.currentStock,
          minStockAlert: p.minStockAlert,
          freeRatioBuy: p.freeRatioBuy || 0,
          freeRatioGet: p.freeRatioGet || 0,
          isRawMaterial: p.isRawMaterial || false,
          supplierId: p.supplierId || null
        }
      });
    }

    // 7. Lorry Stocks
    for (const ls of lorryStocks) {
      await prisma.lorryStock.upsert({
        where: {
          lorryId_productId: {
            lorryId: ls.lorryId,
            productId: ls.productId
          }
        },
        update: { quantity: ls.quantity },
        create: {
          id: ls.id,
          lorryId: ls.lorryId,
          productId: ls.productId,
          quantity: ls.quantity
        }
      });
    }

    // 8. Customers
    for (const c of customers) {
      await prisma.customer.upsert({
        where: { id: c.id },
        update: {
          code: c.code,
          name: c.name,
          companyName: c.companyName || null,
          phone: c.phone,
          deliveryAddress: c.deliveryAddress,
          city: c.city || 'Local',
          routeId: c.routeId || null,
          pricingTier: c.pricingTier || 'STANDARD',
          creditLimit: c.creditLimit || 50000,
          discountPercentage: c.discountPercentage || 0,
          outstandingBalance: c.outstandingBalance || 0,
          maxCreditInvoices: c.maxCreditInvoices || 1
        },
        create: {
          id: c.id,
          code: c.code,
          name: c.name,
          companyName: c.companyName || null,
          phone: c.phone,
          deliveryAddress: c.deliveryAddress,
          city: c.city || 'Local',
          routeId: c.routeId || null,
          pricingTier: c.pricingTier || 'STANDARD',
          creditLimit: c.creditLimit || 50000,
          discountPercentage: c.discountPercentage || 0,
          outstandingBalance: c.outstandingBalance || 0,
          maxCreditInvoices: c.maxCreditInvoices || 1
        }
      });
    }

    // 9. Loadings and Loading Items
    for (const ld of loadings) {
      await prisma.lorryLoading.upsert({
        where: { id: ld.id },
        update: {
          loadingNumber: ld.loadingNumber,
          lorryId: ld.lorryId,
          routeId: ld.routeId || null,
          date: new Date(ld.date),
          status: ld.status || 'LOADED',
          notes: ld.notes || null,
          totalLoadedItems: ld.totalLoadedItems || 0,
          totalSoldItems: ld.totalSoldItems || 0,
          totalFreeItems: ld.totalFreeItems || 0,
          totalReturnedItems: ld.totalReturnedItems || 0,
          totalSalesAmount: ld.totalSalesAmount || 0,
          cashCollected: ld.cashCollected || 0
        },
        create: {
          id: ld.id,
          loadingNumber: ld.loadingNumber,
          lorryId: ld.lorryId,
          routeId: ld.routeId || null,
          date: new Date(ld.date),
          status: ld.status || 'LOADED',
          notes: ld.notes || null,
          totalLoadedItems: ld.totalLoadedItems || 0,
          totalSoldItems: ld.totalSoldItems || 0,
          totalFreeItems: ld.totalFreeItems || 0,
          totalReturnedItems: ld.totalReturnedItems || 0,
          totalSalesAmount: ld.totalSalesAmount || 0,
          cashCollected: ld.cashCollected || 0
        }
      });

      if (Array.isArray(ld.items)) {
        for (const item of ld.items) {
          await prisma.lorryLoadingItem.upsert({
            where: { id: item.id },
            update: {
              loadingId: ld.id,
              productId: item.productId,
              loadedQty: item.loadedQty || 0,
              soldQty: item.soldQty || 0,
              freeQty: item.freeQty || 0,
              returnedQty: item.returnedQty || 0,
              discrepancyQty: item.discrepancyQty || 0
            },
            create: {
              id: item.id,
              loadingId: ld.id,
              productId: item.productId,
              loadedQty: item.loadedQty || 0,
              soldQty: item.soldQty || 0,
              freeQty: item.freeQty || 0,
              returnedQty: item.returnedQty || 0,
              discrepancyQty: item.discrepancyQty || 0
            }
          });
        }
      }
    }

    // 10. Orders & Order Items
    for (const ord of orders) {
      await prisma.order.upsert({
        where: { id: ord.id },
        update: {
          orderNumber: ord.orderNumber,
          paperBillNumber: ord.paperBillNumber || null,
          customerId: ord.customerId,
          lorryId: ord.lorryId || null,
          routeId: ord.routeId || null,
          subtotal: ord.subtotal || 0,
          discountAmount: ord.discountAmount || 0,
          taxAmount: ord.taxAmount || 0,
          netTotal: ord.netTotal || 0,
          cashReceived: ord.cashReceived || 0,
          paidAmount: ord.paidAmount || 0,
          balanceAmount: ord.balanceAmount || 0,
          paymentMethod: ord.paymentMethod || 'CASH',
          paymentStatus: ord.paymentStatus || 'PAID',
          status: ord.status || 'COMPLETED',
          notes: ord.notes || null,
          createdAt: new Date(ord.createdAt)
        },
        create: {
          id: ord.id,
          orderNumber: ord.orderNumber,
          paperBillNumber: ord.paperBillNumber || null,
          customerId: ord.customerId,
          lorryId: ord.lorryId || null,
          routeId: ord.routeId || null,
          subtotal: ord.subtotal || 0,
          discountAmount: ord.discountAmount || 0,
          taxAmount: ord.taxAmount || 0,
          netTotal: ord.netTotal || 0,
          cashReceived: ord.cashReceived || 0,
          paidAmount: ord.paidAmount || 0,
          balanceAmount: ord.balanceAmount || 0,
          paymentMethod: ord.paymentMethod || 'CASH',
          paymentStatus: ord.paymentStatus || 'PAID',
          status: ord.status || 'COMPLETED',
          notes: ord.notes || null,
          createdAt: new Date(ord.createdAt)
        }
      });

      if (Array.isArray(ord.items)) {
        for (const it of ord.items) {
          await prisma.orderItem.upsert({
            where: { id: it.id },
            update: {
              orderId: ord.id,
              productId: it.productId,
              unitPrice: it.unitPrice || 0,
              quantity: it.quantity || 1,
              freeQuantity: it.freeQuantity || 0,
              lineTotal: it.lineTotal || 0
            },
            create: {
              id: it.id,
              orderId: ord.id,
              productId: it.productId,
              unitPrice: it.unitPrice || 0,
              quantity: it.quantity || 1,
              freeQuantity: it.freeQuantity || 0,
              lineTotal: it.lineTotal || 0
            }
          });
        }
      }

      if (Array.isArray(ord.returns)) {
        for (const ret of ord.returns) {
          await prisma.orderReturn.upsert({
            where: { id: ret.id },
            update: {
              orderId: ord.id,
              productId: ret.productId,
              quantity: ret.quantity || 0,
              unitPrice: ret.unitPrice || 0,
              total: ret.total || 0,
              returnType: ret.returnType || 'DAMAGE',
              reason: ret.reason || null
            },
            create: {
              id: ret.id,
              orderId: ord.id,
              productId: ret.productId,
              quantity: ret.quantity || 0,
              unitPrice: ret.unitPrice || 0,
              total: ret.total || 0,
              returnType: ret.returnType || 'DAMAGE',
              reason: ret.reason || null
            }
          });
        }
      }
    }

    // 11. Customer Payments
    for (const cp of customerPayments) {
      await prisma.customerPayment.upsert({
        where: { id: cp.id },
        update: {
          receiptNumber: cp.receiptNumber,
          customerId: cp.customerId,
          lorryId: cp.lorryId || null,
          amount: cp.amount,
          paymentMethod: cp.paymentMethod || 'CASH',
          chequeNumber: cp.chequeNumber || null,
          bankName: cp.bankName || null,
          reference: cp.reference || null,
          notes: cp.notes || null,
          collectedBy: cp.collectedBy || null,
          createdAt: new Date(cp.createdAt)
        },
        create: {
          id: cp.id,
          receiptNumber: cp.receiptNumber,
          customerId: cp.customerId,
          lorryId: cp.lorryId || null,
          amount: cp.amount,
          paymentMethod: cp.paymentMethod || 'CASH',
          chequeNumber: cp.chequeNumber || null,
          bankName: cp.bankName || null,
          reference: cp.reference || null,
          notes: cp.notes || null,
          collectedBy: cp.collectedBy || null,
          createdAt: new Date(cp.createdAt)
        }
      });
    }

    // 11.1 Bill Payment Allocations
    for (const bpa of billPaymentAllocations) {
      await prisma.billPaymentAllocation.upsert({
        where: { id: bpa.id },
        update: {
          paymentId: bpa.paymentId,
          orderId: bpa.orderId,
          amount: bpa.amount
        },
        create: {
          id: bpa.id,
          paymentId: bpa.paymentId,
          orderId: bpa.orderId,
          amount: bpa.amount
        }
      });
    }

    // 12. Expenses
    for (const exp of expenses) {
      await prisma.expense.upsert({
        where: { id: exp.id },
        update: {
          expenseNumber: exp.expenseNumber,
          category: exp.category,
          title: exp.title,
          amount: exp.amount,
          paymentMethod: exp.paymentMethod || 'CASH',
          referenceNumber: exp.referenceNumber || null,
          paidTo: exp.paidTo || null,
          notes: exp.notes || null,
          lorryId: exp.lorryId || null,
          date: new Date(exp.date),
          createdAt: new Date(exp.createdAt)
        },
        create: {
          id: exp.id,
          expenseNumber: exp.expenseNumber,
          category: exp.category,
          title: exp.title,
          amount: exp.amount,
          paymentMethod: exp.paymentMethod || 'CASH',
          referenceNumber: exp.referenceNumber || null,
          paidTo: exp.paidTo || null,
          notes: exp.notes || null,
          lorryId: exp.lorryId || null,
          date: new Date(exp.date),
          createdAt: new Date(exp.createdAt)
        }
      });
    }



    // 13. Recipes & Recipe Items
    for (const r of recipes) {
      await prisma.recipe.upsert({
        where: { id: r.id },
        update: {
          code: r.code,
          name: r.name,
          productId: r.productId,
          outputYield: r.outputYield || 1,
          estimatedOverheadCost: r.estimatedOverheadCost || 0,
          notes: r.notes || null
        },
        create: {
          id: r.id,
          code: r.code,
          name: r.name,
          productId: r.productId,
          outputYield: r.outputYield || 1,
          estimatedOverheadCost: r.estimatedOverheadCost || 0,
          notes: r.notes || null
        }
      });

      if (Array.isArray(r.items)) {
        for (const item of r.items) {
          await prisma.recipeItem.upsert({
            where: { id: item.id },
            update: {
              recipeId: r.id,
              componentProductId: item.componentProductId,
              quantity: item.quantity,
              notes: item.notes || null
            },
            create: {
              id: item.id,
              recipeId: r.id,
              componentProductId: item.componentProductId,
              quantity: item.quantity,
              notes: item.notes || null
            }
          });
        }
      }
    }

    // 14. Production Runs & Items
    for (const pr of productionRuns) {
      await prisma.productionRun.upsert({
        where: { id: pr.id },
        update: {
          batchNumber: pr.batchNumber,
          recipeId: pr.recipeId,
          targetQuantity: pr.targetQuantity,
          actualQuantity: pr.actualQuantity || 0,
          status: pr.status || 'COMPLETED',
          totalRawMaterialCost: pr.totalRawMaterialCost || 0,
          overheadCost: pr.overheadCost || 0,
          totalProductionCost: pr.totalProductionCost || 0,
          unitCost: pr.unitCost || 0,
          producedBy: pr.producedBy || null,
          notes: pr.notes || null,
          startDate: new Date(pr.startDate),
          completedAt: pr.completedAt ? new Date(pr.completedAt) : null
        },
        create: {
          id: pr.id,
          batchNumber: pr.batchNumber,
          recipeId: pr.recipeId,
          targetQuantity: pr.targetQuantity,
          actualQuantity: pr.actualQuantity || 0,
          status: pr.status || 'COMPLETED',
          totalRawMaterialCost: pr.totalRawMaterialCost || 0,
          overheadCost: pr.overheadCost || 0,
          totalProductionCost: pr.totalProductionCost || 0,
          unitCost: pr.unitCost || 0,
          producedBy: pr.producedBy || null,
          notes: pr.notes || null,
          startDate: new Date(pr.startDate),
          completedAt: pr.completedAt ? new Date(pr.completedAt) : null
        }
      });

      if (Array.isArray(pr.items)) {
        for (const it of pr.items) {
          await prisma.productionRunItem.upsert({
            where: { id: it.id },
            update: {
              productionRunId: pr.id,
              productId: it.productId,
              plannedQuantity: it.plannedQuantity,
              actualQuantity: it.actualQuantity,
              unitCost: it.unitCost,
              lineCost: it.lineCost
            },
            create: {
              id: it.id,
              productionRunId: pr.id,
              productId: it.productId,
              plannedQuantity: it.plannedQuantity,
              actualQuantity: it.actualQuantity,
              unitCost: it.unitCost,
              lineCost: it.lineCost
            }
          });
        }
      }
    }

    // 15. Employees
    for (const emp of employees) {
      await prisma.employee.upsert({
        where: { id: emp.id },
        update: {
          employeeNumber: emp.employeeNumber,
          fullName: emp.fullName,
          callingName: emp.callingName || null,
          nicNumber: emp.nicNumber || null,
          phone: emp.phone,
          address: emp.address || null,
          designation: emp.designation,
          department: emp.department || 'SALES_FLEET',
          employmentType: emp.employmentType || 'FULL_TIME',
          joinDate: new Date(emp.joinDate || Date.now()),
          status: emp.status || 'ACTIVE',
          basicSalary: emp.basicSalary || 0,
          dailyRate: emp.dailyRate || 0,
          otHourlyRate: emp.otHourlyRate || 0,
          allowances: emp.allowances || 0,
          commissionRate: emp.commissionRate || 0,
          bankName: emp.bankName || null,
          branchName: emp.branchName || null,
          accountNumber: emp.accountNumber || null,
          epfNumber: emp.epfNumber || null,
          userId: emp.userId || null,
          lorryId: emp.lorryId || null,
          notes: emp.notes || null
        },
        create: {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          fullName: emp.fullName,
          callingName: emp.callingName || null,
          nicNumber: emp.nicNumber || null,
          phone: emp.phone,
          address: emp.address || null,
          designation: emp.designation,
          department: emp.department || 'SALES_FLEET',
          employmentType: emp.employmentType || 'FULL_TIME',
          joinDate: new Date(emp.joinDate || Date.now()),
          status: emp.status || 'ACTIVE',
          basicSalary: emp.basicSalary || 0,
          dailyRate: emp.dailyRate || 0,
          otHourlyRate: emp.otHourlyRate || 0,
          allowances: emp.allowances || 0,
          commissionRate: emp.commissionRate || 0,
          bankName: emp.bankName || null,
          branchName: emp.branchName || null,
          accountNumber: emp.accountNumber || null,
          epfNumber: emp.epfNumber || null,
          userId: emp.userId || null,
          lorryId: emp.lorryId || null,
          notes: emp.notes || null
        }
      });
    }

    // 16. Attendances
    for (const att of attendances) {
      await prisma.attendance.upsert({
        where: { id: att.id },
        update: {
          employeeId: att.employeeId,
          date: new Date(att.date),
          status: att.status || 'PRESENT',
          checkInTime: att.checkInTime || null,
          checkOutTime: att.checkOutTime || null,
          otHours: att.otHours || 0,
          notes: att.notes || null
        },
        create: {
          id: att.id,
          employeeId: att.employeeId,
          date: new Date(att.date),
          status: att.status || 'PRESENT',
          checkInTime: att.checkInTime || null,
          checkOutTime: att.checkOutTime || null,
          otHours: att.otHours || 0,
          notes: att.notes || null
        }
      });
    }

    // 17. Salary Advances
    for (const adv of salaryAdvances) {
      await prisma.salaryAdvance.upsert({
        where: { id: adv.id },
        update: {
          advanceNumber: adv.advanceNumber,
          employeeId: adv.employeeId,
          amount: adv.amount,
          date: new Date(adv.date),
          reason: adv.reason || null,
          paymentMethod: adv.paymentMethod || 'CASH',
          status: adv.status || 'PENDING',
          payrollId: adv.payrollId || null,
          notes: adv.notes || null
        },
        create: {
          id: adv.id,
          advanceNumber: adv.advanceNumber,
          employeeId: adv.employeeId,
          amount: adv.amount,
          date: new Date(adv.date),
          reason: adv.reason || null,
          paymentMethod: adv.paymentMethod || 'CASH',
          status: adv.status || 'PENDING',
          payrollId: adv.payrollId || null,
          notes: adv.notes || null
        }
      });
    }

    // 18. Payrolls
    for (const pay of payrolls) {
      await prisma.payroll.upsert({
        where: { id: pay.id },
        update: {
          payslipNumber: pay.payslipNumber,
          employeeId: pay.employeeId,
          month: pay.month,
          year: pay.year,
          workedDays: pay.workedDays || 0,
          absentDays: pay.absentDays || 0,
          leaveDays: pay.leaveDays || 0,
          otHours: pay.otHours || 0,
          basicSalary: pay.basicSalary || 0,
          otAmount: pay.otAmount || 0,
          allowances: pay.allowances || 0,
          salesCommission: pay.salesCommission || 0,
          performanceBonus: pay.performanceBonus || 0,
          grossEarnings: pay.grossEarnings || 0,
          advancesDeducted: pay.advancesDeducted || 0,
          epfDeduction: pay.epfDeduction || 0,
          employerEpf: pay.employerEpf || 0,
          employerEtf: pay.employerEtf || 0,
          otherDeductions: pay.otherDeductions || 0,
          totalDeductions: pay.totalDeductions || 0,
          netPayable: pay.netPayable || 0,
          paymentStatus: pay.paymentStatus || 'PAID',
          paymentMethod: pay.paymentMethod || 'CASH',
          paidAt: pay.paidAt ? new Date(pay.paidAt) : null,
          expenseId: pay.expenseId || null,
          notes: pay.notes || null
        },
        create: {
          id: pay.id,
          payslipNumber: pay.payslipNumber,
          employeeId: pay.employeeId,
          month: pay.month,
          year: pay.year,
          workedDays: pay.workedDays || 0,
          absentDays: pay.absentDays || 0,
          leaveDays: pay.leaveDays || 0,
          otHours: pay.otHours || 0,
          basicSalary: pay.basicSalary || 0,
          otAmount: pay.otAmount || 0,
          allowances: pay.allowances || 0,
          salesCommission: pay.salesCommission || 0,
          performanceBonus: pay.performanceBonus || 0,
          grossEarnings: pay.grossEarnings || 0,
          advancesDeducted: pay.advancesDeducted || 0,
          epfDeduction: pay.epfDeduction || 0,
          employerEpf: pay.employerEpf || 0,
          employerEtf: pay.employerEtf || 0,
          otherDeductions: pay.otherDeductions || 0,
          totalDeductions: pay.totalDeductions || 0,
          netPayable: pay.netPayable || 0,
          paymentStatus: pay.paymentStatus || 'PAID',
          paymentMethod: pay.paymentMethod || 'CASH',
          paidAt: pay.paidAt ? new Date(pay.paidAt) : null,
          expenseId: pay.expenseId || null,
          notes: pay.notes || null
        }
      });
    }

    return res.json({
      success: true,
      message: 'Cloud backup successfully restored into database!',
      importedCounts: {
        users: users.length,
        suppliers: suppliers.length,
        products: products.length,
        routes: routes.length,
        lorries: lorries.length,
        customers: customers.length,
        loadings: loadings.length,
        orders: orders.length,
        payments: customerPayments.length,
        expenses: expenses.length,
        recipes: recipes.length,
        productionRuns: productionRuns.length,
        employees: employees.length,
        attendances: attendances.length,
        salaryAdvances: salaryAdvances.length,
        payrolls: payrolls.length
      }
    });
  } catch (err: any) {
    console.error('[Backup Import Error]', err);
    return res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

// Purge all demo/transactional data and retain only default admin account
app.post('/api/database/wipe-all', async (_req: Request, res: Response) => {
  try {
    await prisma.billPaymentAllocation.deleteMany();
    await prisma.customerPayment.deleteMany();
    await prisma.orderReturn.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.lorryLoadingItem.deleteMany();
    await prisma.lorryLoading.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.payroll.deleteMany();
    await prisma.salaryAdvance.deleteMany();
    await prisma.attendance.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.lorryStock.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.productionRunItem.deleteMany();
    await prisma.productionRun.deleteMany();
    await prisma.recipeItem.deleteMany();
    await prisma.recipe.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
    await prisma.lorry.deleteMany();
    await prisma.route.deleteMany();

    await prisma.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        fullName: 'Administrator',
        role: 'ADMIN'
      }
    });

    return res.json({
      success: true,
      message: 'All demo and test data purged successfully. Database is now completely clean.'
    });
  } catch (err: any) {
    console.error('[Database Wipe Error]', err);
    return res.status(500).json({ error: 'Failed to wipe database: ' + err.message });
  }
});

// ========================================================
// 1. INVENTORY & WAREHOUSE MANAGEMENT
// ========================================================

// List all products
app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const { lowStock, search, isRawMaterial } = req.query;
    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { category: { contains: search } }
      ];
    }

    if (isRawMaterial !== undefined && isRawMaterial !== 'ALL') {
      where.isRawMaterial = isRawMaterial === 'true';
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        supplier: true,
        lorryStocks: {
          include: { lorry: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    if (lowStock === 'true') {
      const filtered = products.filter(p => p.currentStock <= p.minStockAlert);
      return res.json(filtered);
    }

    res.json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create product
app.post('/api/products', async (req: Request, res: Response) => {
  try {
    const { sku, name, category, unit, unitPrice, costPrice, currentStock, freeStock, minStockAlert, freeRatioBuy, freeRatioGet, isRawMaterial } = req.body;

    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and Name are required.' });
    }

    const isRaw = Boolean(isRawMaterial);

    if (!isRaw && (unitPrice === undefined || unitPrice === null || unitPrice === '')) {
      return res.status(400).json({ error: 'Selling Unit Price is required for finished goods.' });
    }

    const initialCurrentStock = parseInt(currentStock || 0, 10);
    const initialFreeStock = parseInt(freeStock || 0, 10);

    const product = await prisma.product.create({
      data: {
        sku: sku.trim().toUpperCase(),
        name: name.trim(),
        category: category?.trim() || (isRaw ? 'Raw Materials' : 'General'),
        unit: unit?.trim() || (isRaw ? 'Kg' : 'Unit'),
        unitPrice: isRaw ? (unitPrice ? parseFloat(unitPrice) : 0) : parseFloat(unitPrice),
        costPrice: parseFloat(costPrice || 0),
        currentStock: initialCurrentStock,
        freeStock: initialFreeStock,
        minStockAlert: parseInt(minStockAlert || 10, 10),
        freeRatioBuy: isRaw ? 0 : (freeRatioBuy ? parseInt(freeRatioBuy, 10) : 0),
        freeRatioGet: isRaw ? 0 : (freeRatioGet ? parseInt(freeRatioGet, 10) : 0),
        isRawMaterial: isRaw
      }
    });

    if (initialCurrentStock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'INBOUND',
          quantity: initialCurrentStock,
          isFreeIssue: false,
          notes: isRaw ? 'Initial raw material intake stock' : 'Initial warehouse intake stock'
        }
      });
    }

    if (initialFreeStock > 0) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: 'INBOUND',
          quantity: initialFreeStock,
          isFreeIssue: true,
          notes: 'Initial promotional free issue stock intake (Cost: Rs. 0.00)'
        }
      });
    }

    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update product
app.put('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, name, category, unit, unitPrice, costPrice, freeStock, minStockAlert, freeRatioBuy, freeRatioGet, isRawMaterial } = req.body;
    const isRaw = isRawMaterial !== undefined ? Boolean(isRawMaterial) : undefined;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        sku: sku?.trim().toUpperCase(),
        name: name?.trim(),
        category: category?.trim(),
        unit: unit?.trim(),
        unitPrice: isRaw ? 0 : (unitPrice !== undefined ? parseFloat(unitPrice) : undefined),
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : undefined,
        freeStock: freeStock !== undefined ? parseInt(freeStock, 10) : undefined,
        minStockAlert: minStockAlert !== undefined ? parseInt(minStockAlert, 10) : undefined,
        freeRatioBuy: isRaw ? 0 : (freeRatioBuy !== undefined ? parseInt(freeRatioBuy, 10) : undefined),
        freeRatioGet: isRaw ? 0 : (freeRatioGet !== undefined ? parseInt(freeRatioGet, 10) : undefined),
        isRawMaterial: isRaw
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Inbound Stock / Adjustment (Supplier Bulk Inward / Physical Count)
app.post('/api/products/:id/stock-adjust', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { quantity, type, notes, referenceId, isFreeIssue } = req.body;
  const isFree = Boolean(isFreeIssue);

  try {
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty === 0) {
      return res.status(400).json({ error: 'Valid non-zero quantity is required.' });
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: isFree
          ? { freeStock: { increment: parsedQty } }
          : { currentStock: { increment: parsedQty } }
      });

      if (isFree && product.freeStock < 0) {
        throw new Error('Adjustment would result in negative free issue inventory.');
      } else if (!isFree && product.currentStock < 0) {
        throw new Error('Adjustment would result in negative warehouse inventory.');
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          type: type || 'INBOUND',
          quantity: parsedQty,
          isFreeIssue: isFree,
          referenceId: referenceId?.trim() || null,
          notes: notes?.trim() || (isFree ? 'Free issue stock adjustment (Cost: Rs. 0.00)' : null)
        }
      });

      return product;
    });

    res.json(updatedProduct);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete product
app.delete('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.json({ message: 'Product already removed or does not exist.' });
    }

    const orderItemsCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemsCount > 0) {
      return res.status(400).json({ error: 'Cannot delete product with existing order history.' });
    }

    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted successfully.' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.json({ message: 'Product already removed or does not exist.' });
    }
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 1.5. SUPPLIERS & PROCUREMENT (WAREHOUSE INBOUND STOCK)
// ========================================================

// List all suppliers
app.get('/api/suppliers', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactPerson: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: {
        _count: {
          select: { products: true, purchaseOrders: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single supplier with products & past purchase orders
app.get('/api/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUniqueOrThrow({
      where: { id },
      include: {
        products: true,
        purchaseOrders: {
          include: {
            items: { include: { product: true } }
          },
          orderBy: { date: 'desc' },
          take: 25
        }
      }
    });
    res.json(supplier);
  } catch (error: any) {
    res.status(404).json({ error: 'Supplier not found.' });
  }
});

// Create supplier
app.post('/api/suppliers', async (req: Request, res: Response) => {
  try {
    const { code, name, contactPerson, phone, email, address, city, paymentTerms } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Supplier name and contact phone are required.' });
    }

    let supplierCode = code?.trim()?.toUpperCase();
    if (!supplierCode) {
      const count = await prisma.supplier.count();
      supplierCode = `SUP-${String(count + 1).padStart(3, '0')}`;
    }

    const supplier = await prisma.supplier.create({
      data: {
        code: supplierCode,
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || 'Colombo',
        paymentTerms: paymentTerms?.trim() || 'NET 30',
        outstandingBalance: 0.0
      }
    });

    res.json(supplier);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update supplier
app.put('/api/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, contactPerson, phone, email, address, city, paymentTerms } = req.body;

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: name?.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim(),
        paymentTerms: paymentTerms?.trim()
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Record supplier payment (settles outstanding balance owed)
app.post('/api/suppliers/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const payAmount = parseFloat(amount);

    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount required.' });
    }

    const supplier = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        outstandingBalance: { decrement: payAmount }
      }
    });

    res.json({
      message: `Payment of ${payAmount} recorded for ${supplier.name}.`,
      supplier: updated
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete supplier
app.delete('/api/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return res.json({ message: 'Supplier already removed or does not exist.' });
    }

    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
    if (poCount > 0) {
      return res.status(400).json({ error: 'Cannot delete supplier with linked purchase orders.' });
    }

    // Unlink any products referencing this supplier before deletion
    await prisma.product.updateMany({
      where: { supplierId: id },
      data: { supplierId: null }
    });

    await prisma.supplier.delete({ where: { id } });
    res.json({ message: 'Supplier deleted successfully.' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.json({ message: 'Supplier already removed or does not exist.' });
    }
    res.status(400).json({ error: error.message });
  }
});

// List Inbound Goods Receipts / Purchase Orders
app.get('/api/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { supplierId, from, to } = req.query;
    const where: any = {};

    if (supplierId && typeof supplierId === 'string' && supplierId !== 'ALL') {
      where.supplierId = supplierId;
    }
    if (from || to) {
      where.date = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const orders = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Inbound Goods Received Note (GRN) - DIRECTLY WIRED WITH WAREHOUSE STOCK
app.post('/api/purchase-orders', async (req: Request, res: Response) => {
  try {
    const {
      supplierId,
      supplierInvoiceNumber,
      date,
      paymentStatus,
      paymentMethod,
      paidAmount,
      notes,
      items
    } = req.body;

    if (!supplierId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Supplier and at least one received item are required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });

      let subtotal = 0;
      const validItems = [];

      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        const cost = parseFloat(item.costPrice);

        if (qty <= 0 && freeQty <= 0) continue;
        if (isNaN(cost) || cost < 0) continue;

        // Line total strictly charges for purchased units. Free issue units have Cost = Rs. 0.00
        const lineTotal = qty * cost;
        subtotal += lineTotal;

        validItems.push({
          productId: item.productId,
          quantity: qty,
          freeQuantity: freeQty,
          costPrice: cost,
          lineTotal
        });
      }

      if (validItems.length === 0) {
        throw new Error('Please specify valid product quantities and unit costs.');
      }

      const totalAmount = subtotal;
      const actualPaid = parseFloat(paidAmount !== undefined ? paidAmount : (paymentStatus === 'PAID' ? totalAmount : 0)) || 0;
      const actualPaymentStatus = paymentStatus || (actualPaid >= totalAmount ? 'PAID' : actualPaid > 0 ? 'PARTIAL' : 'UNPAID');

      // Auto-generate PO / GRN number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.purchaseOrder.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `GRN-${dateStr}-${String(countToday + 1).padStart(4, '0')}`;

      // 1. Create Purchase Order / GRN
      const createdPO = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          supplierInvoiceNumber: supplierInvoiceNumber?.trim() || null,
          supplierId,
          status: 'RECEIVED',
          paymentStatus: actualPaymentStatus,
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          date: date ? new Date(date) : new Date(),
          subtotal,
          taxAmount: 0.0,
          totalAmount,
          paidAmount: actualPaid,
          notes: notes?.trim() || null,
          receivedAt: new Date(),
          items: {
            create: validItems
          }
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      // 2. WIRE WITH WAREHOUSE STOCK FOR EACH ITEM:
      for (const item of validItems) {
        // Increment warehouse central paid stock & free issue stock, update cost price
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity },
            freeStock: { increment: item.freeQuantity },
            costPrice: item.costPrice,
            supplierId: supplier.id
          }
        });

        // Record Inbound Regular Stock Movement
        if (item.quantity > 0) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'INBOUND',
              quantity: item.quantity,
              isFreeIssue: false,
              referenceId: createdPO.orderNumber,
              notes: `Inbound GRN from ${supplier.name}${supplierInvoiceNumber ? ` (Inv #${supplierInvoiceNumber})` : ''}`
            }
          });
        }

        // Record Inbound Free Issue Movement (Cost: Rs. 0.00)
        if (item.freeQuantity > 0) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'INBOUND',
              quantity: item.freeQuantity,
              isFreeIssue: true,
              referenceId: createdPO.orderNumber,
              notes: `Supplier promotional free issue from ${supplier.name} (Cost: Rs. 0.00)`
            }
          });
        }
      }

      // 3. If unpaid balance, update supplier outstanding payable balance
      const unpaidBalance = totalAmount - actualPaid;
      if (unpaidBalance > 0) {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: {
            outstandingBalance: { increment: unpaidBalance }
          }
        });
      }

      return createdPO;
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 2. ROUTES & FLEET (3 LORRIES ON 3 ROUTES)
// ========================================================

// List routes
app.get('/api/routes', async (_req: Request, res: Response) => {
  try {
    const routes = await prisma.route.findMany({
      include: {
        lorries: true,
        _count: { select: { customers: true, orders: true } }
      },
      orderBy: { code: 'asc' }
    });
    res.json(routes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create/Update Route
app.post('/api/routes', async (req: Request, res: Response) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Route code and name are required.' });
    }

    const route = await prisma.route.upsert({
      where: { code: code.trim().toUpperCase() },
      update: { name: name.trim(), description: description?.trim() },
      create: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim()
      }
    });
    res.json(route);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List 3 Lorries with real-time floating stock & active morning loading
app.get('/api/lorries', async (_req: Request, res: Response) => {
  try {
    const lorries = await prisma.lorry.findMany({
      include: {
        route: true,
        lorryStocks: {
          include: { product: true }
        },
        loadings: {
          orderBy: { date: 'desc' },
          take: 1,
          include: {
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { vehicleNumber: 'asc' }
    });
    res.json(lorries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single lorry details
app.get('/api/lorries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lorry = await prisma.lorry.findUniqueOrThrow({
      where: { id },
      include: {
        route: true,
        lorryStocks: {
          include: { product: true }
        },
        loadings: {
          orderBy: { date: 'desc' },
          take: 5,
          include: {
            items: { include: { product: true } }
          }
        }
      }
    });
    res.json(lorry);
  } catch (error: any) {
    res.status(404).json({ error: 'Lorry not found' });
  }
});

// Create a new Lorry
app.post('/api/lorries', async (req: Request, res: Response) => {
  try {
    const { vehicleNumber, driverName, driverPhone, routeId, status } = req.body;
    if (!vehicleNumber || !driverName) {
      return res.status(400).json({ error: 'Vehicle number and Driver name are required.' });
    }

    const lorry = await prisma.lorry.create({
      data: {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone?.trim() || null,
        routeId: routeId || null,
        status: status || 'ACTIVE'
      },
      include: { route: true }
    });

    await syncFleetAndRepsToEmployees();

    res.json(lorry);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update Lorry details (driver name, vehicle plate number, route, phone, status)
app.put('/api/lorries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vehicleNumber, driverName, driverPhone, routeId, status } = req.body;

    const data: any = {};
    if (vehicleNumber !== undefined && vehicleNumber.trim() !== '') {
      data.vehicleNumber = vehicleNumber.trim().toUpperCase();
    }
    if (driverName !== undefined && driverName.trim() !== '') {
      data.driverName = driverName.trim();
    }
    if (driverPhone !== undefined) {
      data.driverPhone = driverPhone.trim();
    }
    if (routeId !== undefined) {
      data.routeId = routeId || null;
    }
    if (status !== undefined) {
      data.status = status;
    }

    const updated = await prisma.lorry.update({
      where: { id },
      data,
      include: {
        route: true,
        lorryStocks: { include: { product: true } }
      }
    });

    await syncFleetAndRepsToEmployees();

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 3. MORNING LORRY LOADING (WAREHOUSE -> LORRY TRANSFER)
// ========================================================
// Every morning, items are loaded from warehouse into the lorry.
// Warehouse stock is reduced immediately.
app.post('/api/lorries/:id/load', async (req: Request, res: Response) => {
  const { id: lorryId } = req.params;
  const { items, notes } = req.body;
  // items: [{ productId: string, quantity: number }]

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required for morning lorry loading.' });
  }

  try {
    const loadingSession = await prisma.$transaction(async (tx) => {
      const lorry = await tx.lorry.findUniqueOrThrow({
        where: { id: lorryId },
        include: { route: true }
      });

      // Generate Loading Number (e.g. LOAD-20261030-001)
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.lorryLoading.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const loadingNumber = `LOAD-${todayStr}-${(countToday + 1).toString().padStart(3, '0')}`;

      // Check warehouse stock availability
      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        if (qty <= 0 && freeQty <= 0) continue;

        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        if (qty > 0 && product.currentStock < qty) {
          throw new Error(`Insufficient warehouse regular stock for "${product.name}". Available: ${product.currentStock} ${product.unit}, requested: ${qty}`);
        }
        if (freeQty > 0 && product.freeStock < freeQty) {
          throw new Error(`Insufficient warehouse free issue stock for "${product.name}". Available: ${product.freeStock} ${product.unit}, requested: ${freeQty}`);
        }
      }

      // Create LorryLoading sheet
      const newLoading = await tx.lorryLoading.create({
        data: {
          loadingNumber,
          lorryId,
          routeId: lorry.routeId,
          status: 'LOADED',
          notes: notes?.trim() || `Morning dispatch for route ${lorry.route?.name || 'Assigned Route'}`
        }
      });

      let totalLoadedUnits = 0;

      // Transfer stock from warehouse to lorry
      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        if (qty <= 0 && freeQty <= 0) continue;

        totalLoadedUnits += (qty + freeQty);

        // 1. Deduct Warehouse Stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: qty > 0 ? { decrement: qty } : undefined,
            freeStock: freeQty > 0 ? { decrement: freeQty } : undefined
          }
        });

        // 2. Record Warehouse Outward Movement
        if (qty > 0) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'LORRY_LOAD',
              quantity: -qty,
              isFreeIssue: false,
              referenceId: loadingNumber,
              notes: `Loaded into Lorry ${lorry.vehicleNumber} (${lorry.driverName})`
            }
          });
        }

        if (freeQty > 0) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'LORRY_LOAD',
              quantity: -freeQty,
              isFreeIssue: true,
              referenceId: loadingNumber,
              notes: `Free issue stock loaded into Lorry ${lorry.vehicleNumber} (${lorry.driverName})`
            }
          });
        }

        // 3. Increment Lorry Floating Stock
        await tx.lorryStock.upsert({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          update: {
            quantity: { increment: qty },
            freeQuantity: { increment: freeQty }
          },
          create: {
            lorryId,
            productId: item.productId,
            quantity: qty,
            freeQuantity: freeQty
          }
        });

        // 4. Record Loading Item
        await tx.lorryLoadingItem.create({
          data: {
            loadingId: newLoading.id,
            productId: item.productId,
            loadedQty: qty,
            loadedFreeQty: freeQty,
            soldQty: 0,
            freeQty: 0,
            returnedQty: 0,
            returnedFreeQty: 0,
            discrepancyQty: 0
          }
        });
      }

      // Update total units count
      return await tx.lorryLoading.update({
        where: { id: newLoading.id },
        data: { totalLoadedItems: totalLoadedUnits },
        include: {
          lorry: { include: { route: true } },
          items: { include: { product: true } }
        }
      });
    });

    res.status(201).json(loadingSession);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get current active loading sheet for a lorry
app.get('/api/lorries/:id/current-loading', async (req: Request, res: Response) => {
  try {
    const { id: lorryId } = req.params;
    const activeLoading = await prisma.lorryLoading.findFirst({
      where: {
        lorryId,
        status: { in: ['LOADED', 'IN_TRANSIT'] }
      },
      orderBy: { date: 'desc' },
      include: {
        lorry: { include: { route: true } },
        items: { include: { product: true } },
        expenses: true
      }
    });

    res.json(activeLoading || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 4. EVENING OFFICE BILL ENTRY (DRIVER PAPER BILLS -> SYSTEM)
// ========================================================
// Office manager receives physical bills from driver and enters them.
// Stock is deducted from the LORRY's floating stock (not warehouse).
app.post('/api/lorries/:id/bills', async (req: Request, res: Response) => {
  const { id: lorryId } = req.params;
  const {
    paperBillNumber,
    customerId,
    items,
    returnItems,
    paymentMethod, // CASH, CREDIT, CHEQUE
    cashReceived,
    notes,
    chequeNumber,
    bankName,
    chequeDate,
    settlePreviousBills // optional array: [{ orderId: string, amount: number, paymentMethod?: string }]
  } = req.body;

  if (!customerId || ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(returnItems) || returnItems.length === 0))) {
    return res.status(400).json({ error: 'Customer and at least one bill item or return item are required.' });
  }

  try {
    const orderResult = await prisma.$transaction(async (tx) => {
      const lorry = await tx.lorry.findUniqueOrThrow({
        where: { id: lorryId },
        include: { route: true }
      });

      const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });

      // Find current active loading sheet for this lorry
      let activeLoading = await tx.lorryLoading.findFirst({
        where: {
          lorryId,
          status: { in: ['LOADED', 'IN_TRANSIT'] }
        },
        orderBy: { date: 'desc' },
        include: { items: true }
      });

      let subtotal = 0;
      const orderItemsToCreate = [];

      // Validate Lorry floating inventory
      for (const item of items) {
        const qty = parseInt(item.quantity, 10) || 0;
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        if (qty <= 0 && freeQty <= 0) continue;

        const totalNeeded = qty + freeQty;

        const lorryStock = await tx.lorryStock.findUnique({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          include: { product: true }
        });

        const product = lorryStock?.product || await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const availableRegular = lorryStock?.quantity || 0;
        const availableFree = lorryStock?.freeQuantity || 0;
        const totalAvailable = availableRegular + availableFree;

        if (totalAvailable < totalNeeded) {
          throw new Error(
            `Insufficient stock on Lorry ${lorry.vehicleNumber} for "${product.name}". Available in lorry: ${availableRegular} regular + ${availableFree} free (${totalAvailable} total), bill requires: ${qty} sold + ${freeQty} free (${totalNeeded} total)`
          );
        }

        const itemUnitPrice = item.unitPrice !== undefined && !isNaN(parseFloat(item.unitPrice)) && parseFloat(item.unitPrice) >= 0
          ? parseFloat(item.unitPrice)
          : product.unitPrice;

        // Line total and invoice subtotal strictly reflect billed units; promotional free units cost Rs. 0.00
        const lineTotal = itemUnitPrice * qty;
        subtotal += lineTotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: qty,
          freeQuantity: freeQty,
          unitPrice: itemUnitPrice,
          lineTotal
        });

        // 1. Deduct from Lorry Floating Stock:
        // Free issue units deduct from freeQuantity bucket first; remainder deducts from regular stock
        const deductFromFree = Math.min(availableFree, freeQty);
        const freeRemainder = freeQty - deductFromFree;
        const deductFromRegular = qty + freeRemainder;

        await tx.lorryStock.update({
          where: {
            lorryId_productId: {
              lorryId,
              productId: item.productId
            }
          },
          data: {
            quantity: deductFromRegular > 0 ? { decrement: deductFromRegular } : undefined,
            freeQuantity: deductFromFree > 0 ? { decrement: deductFromFree } : undefined
          }
        });

        // 2. Update active loading sheet sold & free quantities if exists
        if (activeLoading) {
          const loadingItem = activeLoading.items.find(li => li.productId === item.productId);
          if (loadingItem) {
            await tx.lorryLoadingItem.update({
              where: { id: loadingItem.id },
              data: {
                soldQty: { increment: qty },
                freeQty: { increment: freeQty }
              }
            });
          }
        }
      }

      // Process Returns & Damages
      let returnAmount = 0;
      const orderReturnsToCreate: any[] = [];
      if (Array.isArray(returnItems) && returnItems.length > 0) {
        for (const ret of returnItems) {
          const retQty = parseInt(ret.quantity, 10) || 0;
          if (retQty <= 0) continue;

          const retProduct = await tx.product.findUniqueOrThrow({ where: { id: ret.productId } });
          const retUnitPrice = ret.unitPrice !== undefined && !isNaN(parseFloat(ret.unitPrice)) && parseFloat(ret.unitPrice) >= 0
            ? parseFloat(ret.unitPrice)
            : retProduct.unitPrice;
          const lineTotal = retQty * retUnitPrice;
          returnAmount += lineTotal;
          const returnType = ret.returnType === 'RESALE' ? 'RESALE' : 'DAMAGE';

          orderReturnsToCreate.push({
            productId: retProduct.id,
            quantity: retQty,
            unitPrice: retUnitPrice,
            total: lineTotal,
            returnType,
            reason: ret.reason?.trim() || (returnType === 'DAMAGE' ? 'Market return / Damaged / Expired' : 'Good condition return')
          });

          if (returnType === 'RESALE') {
            // Good condition items returned to inventory (warehouse stock)
            await tx.product.update({
              where: { id: retProduct.id },
              data: { currentStock: { increment: retQty } }
            });
            await tx.stockMovement.create({
              data: {
                productId: retProduct.id,
                type: 'RETURN',
                quantity: retQty,
                isFreeIssue: false,
                referenceId: paperBillNumber?.trim() || null,
                notes: `Customer return in good condition (Bill #${paperBillNumber || 'Lorry'})`
              }
            });
          } else {
            // Damaged/Expired items tracked in damageStock - never mixed into sellable stock
            await tx.product.update({
              where: { id: retProduct.id },
              data: { damageStock: { increment: retQty } }
            });
            await tx.stockMovement.create({
              data: {
                productId: retProduct.id,
                type: 'DAMAGE_RETURN',
                quantity: retQty,
                isFreeIssue: false,
                referenceId: paperBillNumber?.trim() || null,
                notes: `Customer return - Damaged/Expired (Bill #${paperBillNumber || 'Lorry'}: ${ret.reason || 'Damage'})`
              }
            });
          }
        }
      }

      // Calculations: allow custom discountAmount/discountPercentage or fall back to customer profile discount
      const reqDiscountAmount = req.body.discountAmount !== undefined ? parseFloat(req.body.discountAmount) : null;
      const reqDiscountPercent = req.body.discountPercentage !== undefined ? parseFloat(req.body.discountPercentage) : null;

      let discountAmount = 0;
      if (reqDiscountAmount !== null && !isNaN(reqDiscountAmount) && reqDiscountAmount >= 0) {
        discountAmount = reqDiscountAmount;
      } else if (reqDiscountPercent !== null && !isNaN(reqDiscountPercent) && reqDiscountPercent >= 0) {
        discountAmount = (subtotal * reqDiscountPercent) / 100;
      } else {
        const discountPercentage = customer.discountPercentage || 0;
        discountAmount = (subtotal * discountPercentage) / 100;
      }

      const netTotal = Math.max(0, subtotal - discountAmount - returnAmount);

      const isCheque = paymentMethod === 'CHEQUE';
      const paidAmount = isCheque
        ? netTotal
        : parseFloat(cashReceived !== undefined ? cashReceived : (paymentMethod === 'CASH' ? netTotal : 0));
      const paymentStatus = paidAmount >= netTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');
      const balanceAmount = Math.max(0, netTotal - paidAmount);

      // Order number
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `ORD-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

      // 3. Create Order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          paperBillNumber: paperBillNumber?.trim() || null,
          customerId,
          lorryId,
          routeId: lorry.routeId || customer.routeId || null,
          status: 'DELIVERED',
          paymentStatus,
          paymentMethod: paymentMethod || 'CASH',
          chequeNumber: isCheque ? (chequeNumber?.trim() || null) : null,
          bankName: isCheque ? (bankName?.trim() || null) : null,
          chequeDate: isCheque && chequeDate ? new Date(chequeDate) : (isCheque ? new Date() : null),
          subtotal,
          discountAmount,
          taxAmount: 0.0,
          returnAmount,
          netTotal,
          cashReceived: isCheque ? 0 : paidAmount,
          paidAmount,
          balanceAmount,
          notes: notes?.trim() || `Driver: ${lorry.driverName} (${lorry.vehicleNumber})`,
          dispatchedAt: new Date(),
          deliveredAt: new Date(),
          items: {
            create: orderItemsToCreate
          },
          returns: {
            create: orderReturnsToCreate
          }
        } as any,
        include: {
          customer: true,
          lorry: { include: { route: true } },
          route: true,
          items: { include: { product: true } },
          returns: { include: { product: true } }
        }
      });

      // 3.1 If paid by Cheque, record a CustomerPayment so Cheque Management can track & clear it
      if (isCheque && netTotal > 0) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const countTodayRcpt = await tx.customerPayment.count({
          where: { createdAt: { gte: startOfToday, lte: endOfToday } }
        });
        const rcptNum = `RCPT-${todayStr}-${(countTodayRcpt + 1).toString().padStart(4, '0')}`;

        const chqPayment = await tx.customerPayment.create({
          data: {
            receiptNumber: rcptNum,
            customerId,
            amount: netTotal,
            paymentMethod: 'CHEQUE',
            chequeNumber: chequeNumber?.trim() || `CHQ-${newOrder.orderNumber}`,
            bankName: bankName?.trim() || null,
            chequeDate: chequeDate ? new Date(chequeDate) : new Date(),
            chequeStatus: 'PENDING',
            notes: `Rep Cheque Payment for ${newOrder.orderNumber}`,
            collectedBy: lorry.driverName || 'Rep',
            lorryId
          } as any
        });

        await tx.billPaymentAllocation.create({
          data: {
            paymentId: chqPayment.id,
            orderId: newOrder.id,
            amount: netTotal,
            notes: `Cheque #${chequeNumber?.trim() || 'N/A'} for bill ${newOrder.orderNumber}`
          }
        });
      }

      // 4. Update Customer Outstanding Balance if credit/unpaid on current order
      const creditAmount = balanceAmount;
      if (creditAmount > 0) {
        await tx.customer.update({
          where: { id: customerId },
          data: { outstandingBalance: { increment: creditAmount } }
        });
      }

      // 5. Process Previous Bill Clearance (Bill-to-Bill Knock-off collected on this delivery visit)
      let totalPreviousBillCollected = 0;
      let totalPreviousBillCashCollected = 0;
      const settledReceipts: any[] = [];

      if (Array.isArray(settlePreviousBills) && settlePreviousBills.length > 0) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        for (const prevBill of settlePreviousBills) {
          const prevPayAmount = parseFloat(prevBill.amount);
          if (isNaN(prevPayAmount) || prevPayAmount <= 0) continue;

          const targetOrder = await tx.order.findUnique({
            where: { id: prevBill.orderId }
          });
          if (!targetOrder) continue;

          const currentPaid = targetOrder.paidAmount || 0;
          const currentBal = targetOrder.balanceAmount > 0
            ? targetOrder.balanceAmount
            : Math.max(0, targetOrder.netTotal - currentPaid);
          const applyAmt = Math.min(prevPayAmount, currentBal);
          if (applyAmt <= 0) continue;

          const countTodayRcpt = await tx.customerPayment.count({
            where: { createdAt: { gte: startOfToday, lte: endOfToday } }
          });
          const rcptNum: string = `RCPT-${todayStr}-${(countTodayRcpt + settledReceipts.length + 1).toString().padStart(4, '0')}`;

          const prevMethod = prevBill.paymentMethod || 'CASH';

          // Create payment receipt for previous bill clearance
          const paymentReceipt: any = await tx.customerPayment.create({
            data: {
              receiptNumber: rcptNum,
              customerId,
              amount: applyAmt,
              paymentMethod: prevMethod,
              notes: `Cleared Previous Bill ${targetOrder.orderNumber} during Delivery ${orderNumber}`,
              collectedBy: lorry.driverName || 'Driver',
              lorryId
            }
          });

          // Create allocation link
          await tx.billPaymentAllocation.create({
            data: {
              paymentId: paymentReceipt.id,
              orderId: targetOrder.id,
              amount: applyAmt,
              notes: `Delivery knock-off on ${orderNumber}`
            }
          });

          // Update previous order paid amount and balance
          const updatedPaid = currentPaid + applyAmt;
          const updatedBal = Math.max(0, targetOrder.netTotal - updatedPaid);
          const updatedStatus = updatedBal <= 0 ? 'PAID' : 'PARTIAL';

          await tx.order.update({
            where: { id: targetOrder.id },
            data: {
              paidAmount: updatedPaid,
              balanceAmount: updatedBal,
              cashReceived: prevMethod === 'CASH' ? updatedPaid : targetOrder.cashReceived,
              paymentStatus: updatedStatus
            }
          });

          // Decrement customer outstanding balance for cleared previous bill
          await tx.customer.update({
            where: { id: customerId },
            data: { outstandingBalance: { decrement: applyAmt } }
          });

          if (prevMethod === 'CASH') {
            totalPreviousBillCashCollected += applyAmt;
          }
          totalPreviousBillCollected += applyAmt;
          settledReceipts.push(paymentReceipt);
        }
      }

      // 6. Update Loading sheet cumulative stats (Current bill cash + previous bill collected cash)
      // Note: Only physical cash increments cashCollected so day-end physical cash handover reconciles accurately
      const currentBillCash = isCheque ? 0 : paidAmount;
      const totalCashFromVisit = currentBillCash + totalPreviousBillCashCollected;
      if (activeLoading) {
        await tx.lorryLoading.update({
          where: { id: activeLoading.id },
          data: {
            totalSoldItems: { increment: orderItemsToCreate.reduce((a, b) => a + b.quantity, 0) },
            totalFreeItems: { increment: orderItemsToCreate.reduce((a, b) => a + (b.freeQuantity || 0), 0) },
            totalSalesAmount: { increment: netTotal },
            cashCollected: { increment: totalCashFromVisit },
            creditGiven: { increment: creditAmount > 0 ? creditAmount : 0 }
          }
        });
      }

      return {
        ...newOrder,
        previousBillsSettled: settledReceipts,
        totalPreviousBillCollected
      };
    });

    res.status(201).json(orderResult);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 5. DAY-END LORRY SETTLEMENT & UNSOLD RETURN TO WAREHOUSE
// ========================================================
// Reconcile loaded vs sold vs returned.
// Any returned unsold stock is credited back to Main Warehouse stock.
app.post('/api/lorries/:id/settle', async (req: Request, res: Response) => {
  const { id: lorryId } = req.params;
  const { loadingId, returns, cashHandover, notes } = req.body;
  // returns: [{ productId: string, returnedQty: number }]

  try {
    const settlementSummary = await prisma.$transaction(async (tx) => {
      const lorry = await tx.lorry.findUniqueOrThrow({
        where: { id: lorryId },
        include: { route: true }
      });

      const loading = await tx.lorryLoading.findUniqueOrThrow({
        where: { id: loadingId },
        include: { items: { include: { product: true } } }
      });

      let totalReturned = 0;
      let totalReturnedFree = 0;

      // Process each returned product
      for (const ret of returns || []) {
        const returnQty = parseInt(ret.returnedQty, 10) || 0;
        const returnFreeQty = parseInt(ret.returnedFreeQty, 10) || 0;
        if (returnQty < 0 && returnFreeQty < 0) continue;

        totalReturned += Math.max(0, returnQty);
        totalReturnedFree += Math.max(0, returnFreeQty);

        // 1. Credit back to Main Warehouse (Regular and Free Issue separately)
        if (returnQty > 0 || returnFreeQty > 0) {
          await tx.product.update({
            where: { id: ret.productId },
            data: {
              currentStock: returnQty > 0 ? { increment: returnQty } : undefined,
              freeStock: returnFreeQty > 0 ? { increment: returnFreeQty } : undefined
            }
          });

          if (returnQty > 0) {
            await tx.stockMovement.create({
              data: {
                productId: ret.productId,
                type: 'LORRY_RETURN',
                quantity: returnQty,
                isFreeIssue: false,
                referenceId: loading.loadingNumber,
                notes: `Unsold regular stock returned from Lorry ${lorry.vehicleNumber}`
              }
            });
          }

          if (returnFreeQty > 0) {
            await tx.stockMovement.create({
              data: {
                productId: ret.productId,
                type: 'LORRY_RETURN',
                quantity: returnFreeQty,
                isFreeIssue: true,
                referenceId: loading.loadingNumber,
                notes: `Unsold free issue stock returned from Lorry ${lorry.vehicleNumber} (Cost: Rs. 0.00)`
              }
            });
          }
        }

        // 2. Update loading item line (returned + calculate discrepancy)
        const itemLine = loading.items.find(i => i.productId === ret.productId);
        if (itemLine) {
          const totalDispatched = itemLine.soldQty + (itemLine.freeQty || 0);
          const totalLoaded = itemLine.loadedQty + (itemLine.loadedFreeQty || 0);
          const discrepancy = totalLoaded - (totalDispatched + returnQty + returnFreeQty);
          await tx.lorryLoadingItem.update({
            where: { id: itemLine.id },
            data: {
              returnedQty: returnQty,
              returnedFreeQty: returnFreeQty,
              discrepancyQty: discrepancy
            }
          });
        }

        // 3. Clear Lorry Floating Stock for settled products
        await tx.lorryStock.upsert({
          where: {
            lorryId_productId: {
              lorryId,
              productId: ret.productId
            }
          },
          update: { quantity: 0, freeQuantity: 0 },
          create: {
            lorryId,
            productId: ret.productId,
            quantity: 0,
            freeQuantity: 0
          }
        });
      }

      // Mark Loading Sheet as SETTLED
      const settledLoading = await tx.lorryLoading.update({
        where: { id: loadingId },
        data: {
          status: 'SETTLED',
          settledAt: new Date(),
          totalReturnedItems: totalReturned + totalReturnedFree,
          cashCollected: cashHandover !== undefined ? parseFloat(cashHandover) : loading.cashCollected,
          notes: notes?.trim() || loading.notes
        },
        include: {
          lorry: { include: { route: true } },
          items: { include: { product: true } }
        }
      });

      return settledLoading;
    });

    res.json(settlementSummary);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 6. CUSTOMER & CLIENT DIRECTORY
// ========================================================

// List customers
app.get('/api/customers', async (req: Request, res: Response) => {
  try {
    const { search, routeId } = req.query;
    const where: any = {};

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { phone: { contains: search } },
        { companyName: { contains: search } }
      ];
    }

    if (routeId && typeof routeId === 'string' && routeId !== 'ALL') {
      where.routeId = routeId;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        route: true,
        _count: { select: { orders: true, payments: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create customer
app.post('/api/customers', async (req: Request, res: Response) => {
  try {
    const { name, companyName, phone, deliveryAddress, city, routeId, pricingTier, discountPercentage, creditLimit } = req.body;

    if (!name || !phone || !deliveryAddress) {
      return res.status(400).json({ error: 'Name, Phone, and Delivery Address are required.' });
    }

    const count = await prisma.customer.count();
    const code = `CUST-${(count + 1).toString().padStart(3, '0')}`;

    const customer = await prisma.customer.create({
      data: {
        code,
        name: name.trim(),
        companyName: companyName?.trim() || null,
        phone: phone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        city: city?.trim() || 'Local',
        routeId: routeId || null,
        pricingTier: pricingTier || 'STANDARD',
        discountPercentage: parseFloat(discountPercentage || 0),
        creditLimit: parseFloat(creditLimit || 50000)
      },
      include: { route: true }
    });

    res.status(201).json(customer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update customer
app.put('/api/customers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, companyName, phone, deliveryAddress, city, routeId, pricingTier, discountPercentage, creditLimit, outstandingBalance } = req.body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name?.trim(),
        companyName: companyName?.trim(),
        phone: phone?.trim(),
        deliveryAddress: deliveryAddress?.trim(),
        city: city?.trim(),
        routeId: routeId !== undefined ? routeId : undefined,
        pricingTier,
        discountPercentage: discountPercentage !== undefined ? parseFloat(discountPercentage) : undefined,
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : undefined,
        outstandingBalance: outstandingBalance !== undefined ? parseFloat(outstandingBalance) : undefined
      },
      include: { route: true }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Customer order history
app.get('/api/customers/:id/orders', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = await prisma.order.findMany({
      where: { customerId: id },
      include: {
        lorry: true,
        route: true,
        items: { include: { product: true } },
        returns: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get unpaid / partially paid bills for a customer (for Bill-to-Bill knock-off)
app.get('/api/customers/:id/unpaid-bills', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const unpaidOrders = await prisma.order.findMany({
      where: {
        customerId: id,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        status: { not: 'CANCELLED' }
      },
      include: {
        lorry: true,
        route: true,
        items: { include: { product: true } },
        returns: { include: { product: true } },
        allocations: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'asc' } // Oldest first (FIFO)
    });

    const now = new Date().getTime();
    const formatted = unpaidOrders.map(order => {
      // Dynamic balance calculation if balanceAmount wasn't explicitly populated
      const computedBalance = order.balanceAmount > 0
        ? order.balanceAmount
        : Math.max(0, order.netTotal - (order.paidAmount || 0));
      const daysOpen = Math.floor((now - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...order,
        balanceAmount: computedBalance,
        daysOpen
      };
    });

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record customer payment (settles credit balance owed with bill-to-bill knock-off)
app.post('/api/customers/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      amount,
      paymentMethod,
      chequeNumber,
      bankName,
      chequeDate,
      reference,
      notes,
      collectedBy,
      lorryId,
      allocations // optional array of { orderId: string, amount: number }
    } = req.body;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Valid positive payment amount required.' });
    }

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { id },
      include: { route: true }
    });

    // Generate unique receipt number: RCPT-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const countToday = await prisma.customerPayment.count({
      where: {
        createdAt: {
          gte: startOfToday,
          lte: endOfToday
        }
      }
    });
    const receiptNumber = `RCPT-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    // Execute in transaction: create payment receipt, create allocations, update bill balances, decrement customer balance
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.create({
        data: {
          receiptNumber,
          customerId: id,
          amount: payAmount,
          paymentMethod: paymentMethod || 'CASH',
          chequeNumber: chequeNumber?.trim() || null,
          bankName: bankName?.trim() || null,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          chequeStatus: paymentMethod === 'CHEQUE' ? 'PENDING' : null,
          reference: reference?.trim() || null,
          notes: notes?.trim() || null,
          collectedBy: collectedBy?.trim() || null,
          lorryId: lorryId || null
        } as any,
        include: {
          customer: true,
          lorry: true
        }
      });

      // Bill-to-Bill Knock-off Allocation
      let remainingToAllocate = payAmount;
      const allocationRecords = [];

      if (Array.isArray(allocations) && allocations.length > 0) {
        // Specific user-defined allocations
        for (const alloc of allocations) {
          const allocAmt = parseFloat(alloc.amount);
          if (allocAmt <= 0) continue;

          const targetOrder = await tx.order.findUnique({ where: { id: alloc.orderId } });
          if (!targetOrder) continue;

          const currentPaid = targetOrder.paidAmount || 0;
          const currentBal = targetOrder.balanceAmount > 0 ? targetOrder.balanceAmount : Math.max(0, targetOrder.netTotal - currentPaid);
          const applyAmt = Math.min(allocAmt, currentBal);
          const newPaid = currentPaid + applyAmt;
          const newBal = Math.max(0, targetOrder.netTotal - newPaid);
          const newStatus = newBal <= 0 ? 'PAID' : 'PARTIAL';

          const createdAlloc = await tx.billPaymentAllocation.create({
            data: {
              paymentId: payment.id,
              orderId: targetOrder.id,
              amount: applyAmt,
              notes: `Allocated to Bill ${targetOrder.orderNumber}`
            }
          });
          allocationRecords.push(createdAlloc);

          await tx.order.update({
            where: { id: targetOrder.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBal,
              cashReceived: newPaid,
              paymentStatus: newStatus
            }
          });
        }
      } else {
        // Automatic FIFO (First-In, First-Out) knock-off against oldest unpaid bills
        const unpaidBills = await tx.order.findMany({
          where: {
            customerId: id,
            paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
            status: { not: 'CANCELLED' }
          },
          orderBy: { createdAt: 'asc' }
        });

        for (const bill of unpaidBills) {
          if (remainingToAllocate <= 0) break;

          const currentPaid = bill.paidAmount || 0;
          const currentBal = bill.balanceAmount > 0 ? bill.balanceAmount : Math.max(0, bill.netTotal - currentPaid);
          if (currentBal <= 0) continue;

          const applyAmt = Math.min(remainingToAllocate, currentBal);
          remainingToAllocate -= applyAmt;

          const newPaid = currentPaid + applyAmt;
          const newBal = Math.max(0, bill.netTotal - newPaid);
          const newStatus = newBal <= 0 ? 'PAID' : 'PARTIAL';

          const createdAlloc = await tx.billPaymentAllocation.create({
            data: {
              paymentId: payment.id,
              orderId: bill.id,
              amount: applyAmt,
              notes: `Auto FIFO knock-off for Bill ${bill.orderNumber}`
            }
          });
          allocationRecords.push(createdAlloc);

          await tx.order.update({
            where: { id: bill.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBal,
              cashReceived: newPaid,
              paymentStatus: newStatus
            }
          });
        }
      }

      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          outstandingBalance: { decrement: payAmount }
        },
        include: { route: true }
      });

      return { payment, allocations: allocationRecords, customer: updatedCustomer };
    });

    res.status(201).json({
      message: `Payment of ${payAmount} recorded for ${customer.name}. Receipt: ${receiptNumber}.`,
      payment: result.payment,
      allocations: result.allocations,
      customer: result.customer
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// List customer payment receipts
app.get('/api/customers/:id/payments', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payments = await prisma.customerPayment.findMany({
      where: { customerId: id },
      include: {
        lorry: true,
        allocations: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                netTotal: true,
                paperBillNumber: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Void / Delete customer payment (restores credit balance and reverses allocations)
app.delete('/api/customer-payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payment = await prisma.customerPayment.findUniqueOrThrow({
      where: { id },
      include: { allocations: true }
    });

    await prisma.$transaction(async (tx) => {
      // Revert allocations from orders
      for (const alloc of payment.allocations) {
        const order = await tx.order.findUnique({ where: { id: alloc.orderId } });
        if (order) {
          const newPaid = Math.max(0, (order.paidAmount || 0) - alloc.amount);
          const newBal = Math.max(0, order.netTotal - newPaid);
          const newStatus = newPaid <= 0 ? 'UNPAID' : (newBal <= 0 ? 'PAID' : 'PARTIAL');

          await tx.order.update({
            where: { id: order.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBal,
              cashReceived: newPaid,
              paymentStatus: newStatus
            }
          });
        }
        await tx.billPaymentAllocation.delete({ where: { id: alloc.id } });
      }

      await tx.customer.update({
        where: { id: payment.customerId },
        data: {
          outstandingBalance: { increment: payment.amount }
        }
      });

      await tx.customerPayment.delete({
        where: { id }
      });
    });

    res.json({
      message: `Payment receipt ${payment.receiptNumber} voided. Customer balance restored by ${payment.amount}.`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 6.1 CHEQUE MANAGEMENT (REP & OFFICE CHEQUES)
// ========================================================

// Get all cheques with search and status filtering
app.get('/api/cheques', async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const where: any = {
      paymentMethod: 'CHEQUE'
    };

    if (status && status !== 'ALL') {
      where.chequeStatus = status;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { chequeNumber: { contains: q } },
        { bankName: { contains: q } },
        { receiptNumber: { contains: q } },
        { notes: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { code: { contains: q } } }
      ];
    }

    const cheques = await prisma.customerPayment.findMany({
      where,
      orderBy: [
        { chequeDate: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        customer: {
          include: { route: true }
        },
        lorry: true,
        allocations: {
          include: {
            order: true
          }
        }
      }
    });

    res.json(cheques);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Cheque Management statistics & summary KPIs
app.get('/api/cheques/stats', async (_req: Request, res: Response) => {
  try {
    const allCheques = await prisma.customerPayment.findMany({
      where: { paymentMethod: 'CHEQUE' }
    });

    const now = new Date();
    now.setHours(23, 59, 59, 999);

    let pendingCount = 0;
    let pendingAmount = 0;
    let maturedCount = 0;
    let maturedAmount = 0;
    let depositedCount = 0;
    let depositedAmount = 0;
    let clearedCount = 0;
    let clearedAmount = 0;
    let bouncedCount = 0;
    let bouncedAmount = 0;
    let totalCount = allCheques.length;
    let totalAmount = 0;

    for (const chq of allCheques) {
      const amt = chq.amount || 0;
      totalAmount += amt;
      const status = (chq as any).chequeStatus || 'PENDING';

      if (status === 'PENDING') {
        pendingCount++;
        pendingAmount += amt;
        if (chq.chequeDate && new Date(chq.chequeDate) <= now) {
          maturedCount++;
          maturedAmount += amt;
        }
      } else if (status === 'DEPOSITED') {
        depositedCount++;
        depositedAmount += amt;
      } else if (status === 'CLEARED') {
        clearedCount++;
        clearedAmount += amt;
      } else if (status === 'BOUNCED') {
        bouncedCount++;
        bouncedAmount += amt;
      }
    }

    res.json({
      totalCount,
      totalAmount,
      pendingCount,
      pendingAmount,
      maturedCount,
      maturedAmount,
      depositedCount,
      depositedAmount,
      clearedCount,
      clearedAmount,
      bouncedCount,
      bouncedAmount
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update Cheque status (PENDING, DEPOSITED, CLEARED, BOUNCED)
app.put('/api/cheques/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, depositBank, depositDate, clearedDate, bounceReason, notes } = req.body;

    if (!['PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid cheque status.' });
    }

    const payment = await prisma.customerPayment.findUniqueOrThrow({
      where: { id },
      include: {
        allocations: {
          include: { order: true }
        },
        customer: true
      }
    });

    const previousStatus = (payment as any).chequeStatus || 'PENDING';

    await prisma.$transaction(async (tx) => {
      const updateData: any = {
        chequeStatus: status
      };

      if (notes !== undefined) updateData.notes = notes;

      if (status === 'DEPOSITED') {
        updateData.depositDate = depositDate ? new Date(depositDate) : new Date();
        if (depositBank) updateData.depositBank = depositBank.trim();
      } else if (status === 'CLEARED') {
        updateData.clearedDate = clearedDate ? new Date(clearedDate) : new Date();
      } else if (status === 'BOUNCED') {
        updateData.bouncedDate = new Date();
        updateData.bounceReason = bounceReason?.trim() || 'Payment bounced / returned by bank';
      }

      // If transition to BOUNCED: reverse order payments and restore customer outstanding credit
      if (status === 'BOUNCED' && previousStatus !== 'BOUNCED') {
        for (const alloc of payment.allocations) {
          const order = alloc.order;
          if (order) {
            const newPaid = Math.max(0, (order.paidAmount || 0) - alloc.amount);
            const newBal = Math.max(0, order.netTotal - newPaid);
            const newStatus = newPaid <= 0 ? 'UNPAID' : (newBal <= 0 ? 'PAID' : 'PARTIAL');

            await tx.order.update({
              where: { id: order.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: newBal,
                paymentStatus: newStatus
              }
            });
          }
        }

        // Re-open debt on customer balance
        await tx.customer.update({
          where: { id: payment.customerId },
          data: {
            outstandingBalance: { increment: payment.amount }
          }
        });
      }

      // If recovering from a BOUNCED state back to PENDING/DEPOSITED/CLEARED
      if (previousStatus === 'BOUNCED' && status !== 'BOUNCED') {
        for (const alloc of payment.allocations) {
          const order = alloc.order;
          if (order) {
            const newPaid = Math.min(order.netTotal, (order.paidAmount || 0) + alloc.amount);
            const newBal = Math.max(0, order.netTotal - newPaid);
            const newStatus = newBal <= 0 ? 'PAID' : 'PARTIAL';

            await tx.order.update({
              where: { id: order.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: newBal,
                paymentStatus: newStatus
              }
            });
          }
        }

        // Decrement customer outstanding balance as cheque is no longer bounced
        await tx.customer.update({
          where: { id: payment.customerId },
          data: {
            outstandingBalance: { decrement: payment.amount }
          }
        });
      }

      await tx.customerPayment.update({
        where: { id },
        data: updateData
      });
    });

    const updated = await prisma.customerPayment.findUnique({
      where: { id },
      include: {
        customer: true,
        lorry: true,
        allocations: {
          include: { order: true }
        }
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update Cheque details (edit Cheque #, bank, maturity date, notes)
app.put('/api/cheques/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { chequeNumber, bankName, chequeDate, notes, depositBank } = req.body;

    const data: any = {};
    if (chequeNumber !== undefined) data.chequeNumber = chequeNumber.trim();
    if (bankName !== undefined) data.bankName = bankName ? bankName.trim() : null;
    if (chequeDate !== undefined) data.chequeDate = chequeDate ? new Date(chequeDate) : null;
    if (notes !== undefined) data.notes = notes ? notes.trim() : null;
    if (depositBank !== undefined) data.depositBank = depositBank ? depositBank.trim() : null;

    const updated = await prisma.customerPayment.update({
      where: { id },
      data,
      include: {
        customer: true,
        lorry: true,
        allocations: {
          include: { order: true }
        }
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 7. ORDERS & BILL HISTORY
// ========================================================

// List orders with filter
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const { status, lorryId, routeId, limit, from, to, startDate, endDate } = req.query;
    const where: any = {};
    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }
    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      where.lorryId = lorryId;
    }
    if (routeId && typeof routeId === 'string' && routeId !== 'ALL') {
      where.routeId = routeId;
    }
    const fromVal = (from || startDate) as string | undefined;
    const toVal = (to || endDate) as string | undefined;
    if (fromVal || toVal) {
      where.createdAt = {};
      if (fromVal) {
        where.createdAt.gte = new Date(fromVal);
      }
      if (toVal) {
        where.createdAt.lte = new Date(toVal);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        lorry: true,
        route: true,
        items: { include: { product: true } },
        returns: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : undefined
    });

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order
app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        lorry: true,
        route: true,
        items: { include: { product: true } },
        returns: { include: { product: true } }
      }
    });
    res.json(order);
  } catch (error: any) {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Create counter POS order (Direct warehouse sale for Walk-in or direct customers)
app.post('/api/orders', async (req: Request, res: Response) => {
  const {
    customerId,
    walkInName,
    walkInPhone,
    paperBillNumber,
    items,
    returnItems,
    notes,
    paymentStatus,
    paymentMethod,
    cashReceived,
    chequeNumber,
    bankName,
    chequeDate,
    lorryId,
    settlePreviousBills
  } = req.body;

  if (lorryId) {
    // Forward to lorry bill entry logic
    return res.redirect(307, `/api/lorries/${lorryId}/bills`);
  }

  if ((!Array.isArray(items) || items.length === 0) && (!Array.isArray(returnItems) || returnItems.length === 0)) {
    return res.status(400).json({ error: 'At least one bill item or return item is required for the bill.' });
  }

  try {
    const newOrder = await prisma.$transaction(async (tx) => {
      let customer;
      if (!customerId || customerId === 'walk-in' || customerId === 'WALK-IN') {
        customer = await tx.customer.findUnique({ where: { code: 'WALK-IN' } });
        if (!customer) {
          customer = await tx.customer.create({
            data: {
              code: 'WALK-IN',
              name: walkInName ? `Walk-in: ${walkInName.trim()}` : 'Walk-in Cash Customer',
              companyName: 'Counter Customer',
              phone: walkInPhone?.trim() || '—',
              deliveryAddress: 'Direct Warehouse Sales Counter',
              city: 'Warehouse Counter',
              pricingTier: 'STANDARD',
              discountPercentage: 0.0,
              creditLimit: 0,
              outstandingBalance: 0
            }
          });
        }
      } else {
        customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      }

      let subtotal = 0;
      let totalBilledUnits = 0;
      let totalFreeUnits = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const qty = parseInt(item.quantity, 10) || 0;
        const freeQty = parseInt(item.freeQuantity, 10) || 0;
        const totalNeeded = qty + freeQty;

        if (qty <= 0 && freeQty <= 0) continue;

        const availableRegular = product.currentStock;
        const availableFree = product.freeStock;
        const totalAvailable = availableRegular + availableFree;

        if (totalAvailable < totalNeeded) {
          throw new Error(
            `Insufficient warehouse stock for "${product.name}". Available: ${availableRegular} regular + ${availableFree} free (${totalAvailable} total), required: ${qty} sold + ${freeQty} free (${totalNeeded} total)`
          );
        }

        const itemUnitPrice = item.unitPrice !== undefined && !isNaN(parseFloat(item.unitPrice)) && parseFloat(item.unitPrice) >= 0
          ? parseFloat(item.unitPrice)
          : product.unitPrice;

        // Line total and invoice subtotal strictly reflect billed units; promotional free units cost Rs. 0.00
        const lineTotal = itemUnitPrice * qty;
        subtotal += lineTotal;
        totalBilledUnits += qty;
        totalFreeUnits += freeQty;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: qty,
          freeQuantity: freeQty,
          unitPrice: itemUnitPrice,
          lineTotal
        });

        // Deduct from Warehouse Stock (Promotional free units consume freeStock first)
        const deductFromFree = Math.min(availableFree, freeQty);
        const freeRemainder = freeQty - deductFromFree;
        const deductFromRegular = qty + freeRemainder;

        await tx.product.update({
          where: { id: product.id },
          data: {
            currentStock: deductFromRegular > 0 ? { decrement: deductFromRegular } : undefined,
            freeStock: deductFromFree > 0 ? { decrement: deductFromFree } : undefined
          }
        });

        if (deductFromRegular > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'OUTBOUND',
              quantity: -deductFromRegular,
              isFreeIssue: false,
              notes: `Counter sales bill order (Regular stock)`
            }
          });
        }

        if (deductFromFree > 0) {
          await tx.stockMovement.create({
            data: {
              productId: product.id,
              type: 'OUTBOUND',
              quantity: -deductFromFree,
              isFreeIssue: true,
              notes: `Promotional free issue issued on counter sales (Cost: Rs. 0.00)`
            }
          });
        }
      }

      if (orderItemsToCreate.length === 0) {
        throw new Error('All bill item quantities are zero.');
      }

      // Process Returns & Damages
      let returnAmount = 0;
      const orderReturnsToCreate: any[] = [];
      if (Array.isArray(returnItems) && returnItems.length > 0) {
        for (const ret of returnItems) {
          const retQty = parseInt(ret.quantity, 10) || 0;
          if (retQty <= 0) continue;

          const retProduct = await tx.product.findUniqueOrThrow({ where: { id: ret.productId } });
          const retUnitPrice = ret.unitPrice !== undefined && !isNaN(parseFloat(ret.unitPrice)) && parseFloat(ret.unitPrice) >= 0
            ? parseFloat(ret.unitPrice)
            : retProduct.unitPrice;
          const retTotal = retQty * retUnitPrice;
          returnAmount += retTotal;
          const returnType = ret.returnType === 'RESALE' ? 'RESALE' : 'DAMAGE';

          orderReturnsToCreate.push({
            productId: retProduct.id,
            quantity: retQty,
            unitPrice: retUnitPrice,
            total: retTotal,
            returnType,
            reason: ret.reason?.trim() || (returnType === 'DAMAGE' ? 'Market return / Damaged / Expired' : 'Good condition return')
          });

          if (returnType === 'RESALE') {
            // Good condition items returned to inventory (warehouse stock)
            await tx.product.update({
              where: { id: retProduct.id },
              data: { currentStock: { increment: retQty } }
            });
            await tx.stockMovement.create({
              data: {
                productId: retProduct.id,
                type: 'RETURN',
                quantity: retQty,
                isFreeIssue: false,
                referenceId: paperBillNumber?.trim() || null,
                notes: `Counter customer return in good condition (Bill #${paperBillNumber || 'Counter'})`
              }
            });
          } else {
            // Damaged/Expired items tracked in damageStock - never mixed into sellable stock
            await tx.product.update({
              where: { id: retProduct.id },
              data: { damageStock: { increment: retQty } }
            });
            await tx.stockMovement.create({
              data: {
                productId: retProduct.id,
                type: 'DAMAGE_RETURN',
                quantity: retQty,
                isFreeIssue: false,
                referenceId: paperBillNumber?.trim() || null,
                notes: `Counter customer return - Damaged/Expired (Bill #${paperBillNumber || 'Counter'}: ${ret.reason || 'Damage'})`
              }
            });
          }
        }
      }

      const reqDiscountAmount = req.body.discountAmount !== undefined ? parseFloat(req.body.discountAmount) : null;
      const reqDiscountPercent = req.body.discountPercentage !== undefined ? parseFloat(req.body.discountPercentage) : null;

      let discountAmount = 0;
      if (reqDiscountAmount !== null && !isNaN(reqDiscountAmount) && reqDiscountAmount >= 0) {
        discountAmount = reqDiscountAmount;
      } else if (reqDiscountPercent !== null && !isNaN(reqDiscountPercent) && reqDiscountPercent >= 0) {
        discountAmount = (subtotal * reqDiscountPercent) / 100;
      } else {
        const discountPercentage = customer.discountPercentage || 0;
        discountAmount = (subtotal * discountPercentage) / 100;
      }

      const netTotal = Math.max(0, subtotal - discountAmount - returnAmount);

      const isCheque = paymentMethod === 'CHEQUE';
      const paidAmount = isCheque
        ? netTotal
        : parseFloat(cashReceived !== undefined && cashReceived !== '' ? cashReceived : (paymentMethod === 'CASH' ? netTotal : 0));
      const calculatedPaymentStatus = paymentStatus || (paidAmount >= netTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID'));
      const balanceAmount = Math.max(0, netTotal - paidAmount);

      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await tx.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      });
      const orderNumber = `ORD-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          paperBillNumber: paperBillNumber?.trim() || null,
          customerId: customer.id,
          lorryId: req.body.lorryId || null,
          routeId: req.body.routeId || customer.routeId || null,
          status: 'DELIVERED',
          paymentStatus: calculatedPaymentStatus,
          paymentMethod: paymentMethod || 'CASH',
          chequeNumber: isCheque ? (chequeNumber?.trim() || null) : null,
          bankName: isCheque ? (bankName?.trim() || null) : null,
          chequeDate: isCheque && chequeDate ? new Date(chequeDate) : (isCheque ? new Date() : null),
          subtotal,
          discountAmount,
          taxAmount: 0.0,
          returnAmount,
          netTotal,
          cashReceived: isCheque ? 0 : paidAmount,
          paidAmount,
          balanceAmount,
          notes: notes?.trim() || (walkInName ? `Walk-in: ${walkInName}` : 'Warehouse Direct Counter Sale'),
          items: {
            create: orderItemsToCreate
          },
          returns: {
            create: orderReturnsToCreate
          }
        } as any,
        include: {
          customer: true,
          items: { include: { product: true } },
          returns: { include: { product: true } }
        }
      });

      // If paid by Cheque, create CustomerPayment for Cheque Management
      if (isCheque && netTotal > 0) {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const countTodayRcpt = await tx.customerPayment.count({
          where: { createdAt: { gte: startOfToday, lte: endOfToday } }
        });
        const rcptNum = `RCPT-${todayStr}-${(countTodayRcpt + 1).toString().padStart(4, '0')}`;

        const chqPayment = await tx.customerPayment.create({
          data: {
            receiptNumber: rcptNum,
            customerId: customer.id,
            amount: netTotal,
            paymentMethod: 'CHEQUE',
            chequeNumber: chequeNumber?.trim() || `CHQ-${createdOrder.orderNumber}`,
            bankName: bankName?.trim() || null,
            chequeDate: chequeDate ? new Date(chequeDate) : new Date(),
            chequeStatus: 'PENDING',
            notes: `Counter Cheque Payment for ${createdOrder.orderNumber}`,
            collectedBy: 'Warehouse Counter',
            lorryId: null
          } as any
        });

        await tx.billPaymentAllocation.create({
          data: {
            paymentId: chqPayment.id,
            orderId: createdOrder.id,
            amount: netTotal,
            notes: `Counter bill payment via Cheque #${chequeNumber?.trim() || 'N/A'}`
          }
        });
      }

      // Record Stock Movement Outbound
      for (const item of orderItemsToCreate) {
        const totalOut = item.quantity + (item.freeQuantity || 0);
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'OUTBOUND',
            quantity: -totalOut,
            referenceId: createdOrder.orderNumber,
            notes: `Counter Sale ${createdOrder.orderNumber} to ${customer.name}${item.freeQuantity ? ` (${item.freeQuantity} free promo)` : ''}`
          }
        });
      }

      // If credit given and customer is an account holder
      if (calculatedPaymentStatus !== 'PAID' && customer.code !== 'WALK-IN') {
        const remainingCredit = balanceAmount;
        if (remainingCredit > 0) {
          await tx.customer.update({
            where: { id: customer.id },
            data: { outstandingBalance: { increment: remainingCredit } }
          });
        }
      }

      // Settle previous bills if provided for warehouse direct customer
      const settledReceipts: any[] = [];
      if (Array.isArray(settlePreviousBills) && settlePreviousBills.length > 0 && customer.code !== 'WALK-IN') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        for (const prevBill of settlePreviousBills) {
          const prevPayAmount = parseFloat(prevBill.amount);
          if (isNaN(prevPayAmount) || prevPayAmount <= 0) continue;

          const targetOrder = await tx.order.findUnique({ where: { id: prevBill.orderId } });
          if (!targetOrder) continue;

          const currentPaid = targetOrder.paidAmount || 0;
          const currentBal = targetOrder.balanceAmount > 0
            ? targetOrder.balanceAmount
            : Math.max(0, targetOrder.netTotal - currentPaid);
          const applyAmt = Math.min(prevPayAmount, currentBal);
          if (applyAmt <= 0) continue;

          const countTodayRcpt = await tx.customerPayment.count({
            where: { createdAt: { gte: startOfToday, lte: endOfToday } }
          });
          const rcptNum: string = `RCPT-${todayStr}-${(countTodayRcpt + settledReceipts.length + 1).toString().padStart(4, '0')}`;

          const paymentReceipt: any = await tx.customerPayment.create({
            data: {
              receiptNumber: rcptNum,
              customerId: customer.id,
              amount: applyAmt,
              paymentMethod: prevBill.paymentMethod || 'CASH',
              notes: `Cleared Previous Bill ${targetOrder.orderNumber} at Sales Counter`,
              collectedBy: 'Warehouse Counter'
            }
          });

          await tx.billPaymentAllocation.create({
            data: {
              paymentId: paymentReceipt.id,
              orderId: targetOrder.id,
              amount: applyAmt,
              notes: `Counter knock-off on ${orderNumber}`
            }
          });

          const updatedPaid = currentPaid + applyAmt;
          const updatedBal = Math.max(0, targetOrder.netTotal - updatedPaid);
          const updatedStatus = updatedBal <= 0 ? 'PAID' : 'PARTIAL';

          await tx.order.update({
            where: { id: targetOrder.id },
            data: {
              paidAmount: updatedPaid,
              balanceAmount: updatedBal,
              cashReceived: updatedPaid,
              paymentStatus: updatedStatus
            }
          });

          await tx.customer.update({
            where: { id: customer.id },
            data: { outstandingBalance: { decrement: applyAmt } }
          });

          settledReceipts.push(paymentReceipt);
        }
      }

      return {
        ...createdOrder,
        previousBillsSettled: settledReceipts
      };
    });

    res.status(201).json(newOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update order status
app.patch('/api/orders/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, customer: true }
      });

      if (status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        for (const item of existing.items) {
          const restoreQty = item.quantity + (item.freeQuantity || 0);

          // If order was from lorry, return to lorry or warehouse
          if (existing.lorryId) {
            await tx.lorryStock.upsert({
              where: {
                lorryId_productId: {
                  lorryId: existing.lorryId,
                  productId: item.productId
                }
              },
              update: { quantity: { increment: restoreQty } },
              create: {
                lorryId: existing.lorryId,
                productId: item.productId,
                quantity: restoreQty
              }
            });
          } else {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentStock: { increment: restoreQty } }
            });
          }

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'RETURN',
              quantity: restoreQty,
              referenceId: existing.orderNumber,
              notes: `Order cancelled; stock restored (${item.quantity} sold${item.freeQuantity ? ` + ${item.freeQuantity} free promo` : ''})`
            }
          });
        }

        // Only revert the unpaid credit portion of this bill from customer balance
        const creditToRevert = existing.balanceAmount > 0
          ? existing.balanceAmount
          : (existing.paymentStatus === 'UNPAID' ? existing.netTotal : 0);

        if (creditToRevert > 0 && existing.customer.code !== 'WALK-IN') {
          await tx.customer.update({
            where: { id: existing.customerId },
            data: { outstandingBalance: { decrement: creditToRevert } }
          });
        }
      }

      return await tx.order.update({
        where: { id },
        data: {
          status,
          deliveredAt: status === 'DELIVERED' ? new Date() : existing.deliveredAt
        },
        include: { customer: true, lorry: true, route: true, items: { include: { product: true } } }
      });
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 8. REPORTING & ANALYTICS (LORRY PERFORMANCE, ROUTES, CASH)
// ========================================================

// Dashboard statistics with date range support
app.get('/api/reports/dashboard-stats', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const [periodOrders, allProducts, customerBalances, lorries, periodExpenses, customerPaymentsPeriod, reps] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { customer: true, lorry: true, route: true },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.findMany({
        include: { lorryStocks: true }
      }),
      prisma.customer.aggregate({
        _sum: { outstandingBalance: true }
      }),
      prisma.lorry.findMany({
        include: {
          route: true,
          lorryStocks: true,
          loadings: {
            where: {
              date: {
                gte: startDate,
                lte: endDate
              }
            },
            include: { items: true, expenses: true }
          }
        }
      }),
      prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.customerPayment.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.user.findMany({
        where: { role: 'REP' },
        include: {
          lorry: { include: { route: true } }
        },
        orderBy: { fullName: 'asc' }
      })
    ]);

    const lowStockProducts = (allProducts as any[]).filter((p: any) => p.currentStock <= p.minStockAlert);
    const validOrders = (periodOrders as any[]).filter((o: any) => o.status !== 'CANCELLED');
    const revenueToday = validOrders.reduce((acc: number, order: any) => acc + order.netTotal, 0);
    const cashToday = validOrders.reduce((acc: number, order: any) => acc + (order.cashReceived || 0), 0);
    const chequesToday = validOrders.filter((o: any) => o.paymentMethod === 'CHEQUE').reduce((acc: number, order: any) => acc + order.netTotal, 0);
    const creditToday = validOrders.reduce((acc: number, order: any) => {
      if (order.paymentMethod === 'CHEQUE') return acc;
      return acc + (order.balanceAmount !== undefined ? order.balanceAmount : Math.max(0, order.netTotal - (order.cashReceived || 0)));
    }, 0);
    const expensesToday = (periodExpenses as any[]).reduce((acc: number, exp: any) => acc + exp.amount, 0);
    const netProfitToday = revenueToday - expensesToday;
    const creditCollectionsToday = (customerPaymentsPeriod || []).reduce((acc: number, p: any) => acc + p.amount, 0);

    // Lorry fleet status breakdown
    const fleetStatus = (lorries as any[]).map((l: any) => {
      const activeLoading = l.loadings?.[0];
      const floatingStockUnits = (l.lorryStocks || []).reduce((a: number, b: any) => a + b.quantity, 0);
      const lorryExpenses = (periodExpenses as any[]).filter((e: any) => e.lorryId === l.id);
      const todayExpenses = lorryExpenses.reduce((acc: number, e: any) => acc + e.amount, 0);

      return {
        id: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        routeName: l.route?.name || 'Unassigned',
        status: activeLoading ? (activeLoading.status === 'SETTLED' ? 'SETTLED' : 'ACTIVE') : 'READY_TO_LOAD',
        floatingStockUnits,
        todaySales: activeLoading?.totalSalesAmount || 0,
        todayCash: activeLoading?.cashCollected || 0,
        todayExpenses
      };
    });

    // Sales Reps live performance breakdown

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const mtdOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        status: { not: 'CANCELLED' }
      },
      select: {
        id: true,
        lorryId: true,
        netTotal: true
      }
    });

    const repLiveStatus = (reps as any[]).map((r: any) => {
      const repOrdersToday = validOrders.filter((o: any) => o.lorryId === r.lorryId);
      const todaySales = repOrdersToday.reduce((acc: number, o: any) => acc + o.netTotal, 0);
      const todayCash = repOrdersToday.reduce((acc: number, o: any) => acc + Math.min(o.netTotal, o.cashReceived || 0), 0);
      const todayCheque = repOrdersToday.filter((o: any) => o.paymentMethod === 'CHEQUE').reduce((acc: number, o: any) => acc + o.netTotal, 0);
      const todayCredit = repOrdersToday.reduce((acc: number, o: any) => {
        if (o.paymentMethod === 'CHEQUE') return acc;
        return acc + (o.balanceAmount !== undefined ? o.balanceAmount : Math.max(0, o.netTotal - (o.cashReceived || 0)));
      }, 0);
      const todayBillsCount = repOrdersToday.length;

      const repMtdOrders = (mtdOrders as any[]).filter((o: any) => o.lorryId === r.lorryId);
      const monthToDateSales = repMtdOrders.reduce((acc: number, o: any) => acc + o.netTotal, 0);

      const dailyTarget = r.dailyTarget || 20000;
      const monthlyTarget = r.monthlyTarget || 500000;
      const dailyAchievementPercentage = dailyTarget > 0 ? Math.round((todaySales / dailyTarget) * 100) : 0;
      const monthlyAchievementPercentage = monthlyTarget > 0 ? Math.round((monthToDateSales / monthlyTarget) * 100) : 0;

      return {
        id: r.id,
        fullName: r.fullName,
        phone: r.phone,
        status: r.status as 'ACTIVE' | 'INACTIVE',
        vehicleNumber: r.lorry?.vehicleNumber || null,
        driverName: r.lorry?.driverName || null,
        routeName: r.lorry?.route?.name || 'Assigned Route',
        todaySales,
        todayCash,
        todayCredit,
        todayCheque,
        todayBillsCount,
        dailyTarget,
        dailyAchievementPercentage,
        monthlyTarget,
        monthToDateSales,
        monthlyAchievementPercentage
      };
    });

    res.json({
      revenueToday,
      cashToday,
      creditToday,
      chequesToday,
      expensesToday,
      netProfitToday,
      creditCollectionsToday,
      ordersTodayCount: validOrders.length,
      lowStockCount: lowStockProducts.length,
      totalOutstanding: customerBalances._sum.outstandingBalance || 0,
      fleetStatus,
      repLiveStatus,
      recentOrders: periodOrders.slice(0, 15),
      lowStockItems: lowStockProducts.slice(0, 5),
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Lorry Performance & Settlement Report with date filtering
app.get('/api/reports/lorry-performance', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const loadingWhere: any = {};
    const orderWhere: any = { status: { not: 'CANCELLED' } };
    if (from || to) {
      const gte = from ? new Date(from as string) : undefined;
      const lte = to ? new Date(to as string) : undefined;
      loadingWhere.date = { gte, lte };
      orderWhere.createdAt = { gte, lte };
    }

    const [loadings, lorries, orders] = await Promise.all([
      prisma.lorryLoading.findMany({
        where: loadingWhere,
        include: {
          lorry: { include: { route: true } },
          items: { include: { product: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.lorry.findMany({
        include: { route: true },
        orderBy: { vehicleNumber: 'asc' }
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          lorryId: true,
          netTotal: true,
          cashReceived: true,
          createdAt: true
        }
      })
    ]);

    // Compute sales, cash, credit for each loading sheet
    const enrichedLoadings = loadings.map(load => {
      const loadDateStr = new Date(load.date).toISOString().slice(0, 10);
      const matchingOrders = orders.filter(o => 
        o.lorryId === load.lorryId && 
        new Date(o.createdAt).toISOString().slice(0, 10) === loadDateStr
      );

      const ordersTotal = matchingOrders.reduce((acc, o) => acc + (o.netTotal || 0), 0);
      const ordersCash = matchingOrders.reduce((acc, o) => acc + Math.min(o.netTotal || 0, o.cashReceived || 0), 0);

      const totalAllSales = Math.max(load.totalSalesAmount || 0, ordersTotal);
      const totalCashSales = load.cashCollected > 0 ? load.cashCollected : ordersCash;
      const totalCreditSale = load.creditGiven > 0 ? load.creditGiven : Math.max(0, totalAllSales - totalCashSales);

      return {
        ...load,
        totalAllSales,
        totalCashSales,
        totalCreditSale
      };
    });

    // Compute lorry-wise summaries
    const lorrySummaries = lorries.map(l => {
      const lorryLoads = enrichedLoadings.filter(ld => ld.lorryId === l.id);
      const lorryOrders = orders.filter(o => o.lorryId === l.id);

      const loadsSales = lorryLoads.reduce((sum, ld) => sum + ld.totalAllSales, 0);
      const loadsCash = lorryLoads.reduce((sum, ld) => sum + ld.totalCashSales, 0);
      const loadsCredit = lorryLoads.reduce((sum, ld) => sum + ld.totalCreditSale, 0);

      const ordersSales = lorryOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
      const ordersCash = lorryOrders.reduce((sum, o) => sum + Math.min(o.netTotal || 0, o.cashReceived || 0), 0);

      const totalAllSales = Math.max(loadsSales, ordersSales);
      const totalCashSales = loadsCash > 0 ? loadsCash : ordersCash;
      const totalCreditSale = loadsCredit > 0 ? loadsCredit : Math.max(0, totalAllSales - totalCashSales);
      const cashRatio = totalAllSales > 0 ? (totalCashSales / totalAllSales) * 100 : 0;
      const totalSoldItems = lorryLoads.reduce((sum, ld) => sum + ld.totalSoldItems, 0);

      return {
        lorryId: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        routeName: l.route?.name || null,
        routeCode: l.route?.code || null,
        loadingsCount: lorryLoads.length,
        ordersCount: lorryOrders.length,
        totalAllSales,
        totalCashSales,
        totalCreditSale,
        cashRatio,
        totalSoldItems
      };
    });

    // Compute fleet-wide totals
    const totalAllSales = lorrySummaries.reduce((sum, l) => sum + l.totalAllSales, 0);
    const totalCashSales = lorrySummaries.reduce((sum, l) => sum + l.totalCashSales, 0);
    const totalCreditSale = lorrySummaries.reduce((sum, l) => sum + l.totalCreditSale, 0);
    const totalLoadedItems = enrichedLoadings.reduce((sum, ld) => sum + ld.totalLoadedItems, 0);
    const totalSoldItems = enrichedLoadings.reduce((sum, ld) => sum + ld.totalSoldItems, 0);
    const totalFreeItems = enrichedLoadings.reduce((sum, ld) => sum + (ld.totalFreeItems || 0), 0);
    const totalReturnedItems = enrichedLoadings.reduce((sum, ld) => sum + ld.totalReturnedItems, 0);

    const summary = {
      totalAllSales,
      totalCashSales,
      totalCreditSale,
      totalLoadedItems,
      totalSoldItems,
      totalFreeItems,
      totalReturnedItems,
      activeLorriesCount: lorries.length,
      totalLoadingsCount: enrichedLoadings.length
    };

    res.json({
      summary,
      lorrySummaries,
      loadings: enrichedLoadings
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vehicle-wise Returns & Damages Report (Minimal, Clean & Clear)
app.get('/api/reports/vehicle-returns', async (req: Request, res: Response) => {
  try {
    const { from, to, lorryId } = req.query;
    const dateFilter: any = {};
    if (from || to) {
      if (from) dateFilter.gte = new Date(from as string);
      if (to) dateFilter.lte = new Date(to as string);
    }

    const orderWhere: any = {
      status: { not: 'CANCELLED' }
    };
    if (from || to) {
      orderWhere.createdAt = dateFilter;
    }
    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      if (lorryId === 'COUNTER') {
        orderWhere.lorryId = null;
      } else {
        orderWhere.lorryId = lorryId;
      }
    }

    const [lorries, returnRecords, loadings] = await Promise.all([
      prisma.lorry.findMany({
        include: { route: true },
        orderBy: { vehicleNumber: 'asc' }
      }),
      prisma.orderReturn.findMany({
        where: {
          order: orderWhere
        },
        include: {
          product: true,
          order: {
            include: {
              customer: true,
              lorry: { include: { route: true } },
              route: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lorryLoading.findMany({
        where: (from || to) ? { date: dateFilter } : undefined,
        select: {
          id: true,
          lorryId: true,
          totalReturnedItems: true
        }
      })
    ]);

    // Map return records into flat details
    const returnDetails = returnRecords.map(r => ({
      id: r.id,
      orderId: r.orderId,
      orderNumber: r.order.orderNumber,
      paperBillNumber: r.order.paperBillNumber,
      date: r.createdAt.toISOString(),
      customerId: r.order.customerId,
      customerName: r.order.customer?.name || 'Customer',
      lorryId: r.order.lorryId,
      vehicleNumber: r.order.lorry?.vehicleNumber || (r.order.lorryId ? 'Unknown Lorry' : 'Warehouse Counter'),
      driverName: r.order.lorry?.driverName || (r.order.lorryId ? 'Driver' : 'Counter Sale'),
      routeName: r.order.route?.name || r.order.lorry?.route?.name || (r.order.lorryId ? 'Route' : 'Direct Counter'),
      productId: r.productId,
      productName: r.product?.name || 'Product',
      sku: r.product?.sku || '',
      unit: r.product?.unit || 'Unit',
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      total: r.total,
      returnType: (r.returnType === 'RESALE' ? 'RESALE' : 'DAMAGE') as 'DAMAGE' | 'RESALE',
      reason: r.reason
    }));

    // Build vehicle-wise summaries
    const vehicleSummaries: any[] = lorries.map(l => {
      const vItems = returnDetails.filter(item => item.lorryId === l.id);
      const vOrders = new Set(vItems.map(i => i.orderId));

      const damageItems = vItems.filter(i => i.returnType === 'DAMAGE');
      const resaleItems = vItems.filter(i => i.returnType === 'RESALE');

      const damageCount = damageItems.reduce((acc, i) => acc + i.quantity, 0);
      const damageValue = damageItems.reduce((acc, i) => acc + i.total, 0);
      const resaleCount = resaleItems.reduce((acc, i) => acc + i.quantity, 0);
      const resaleValue = resaleItems.reduce((acc, i) => acc + i.total, 0);

      const eveningUnsoldReturnsCount = loadings
        .filter(ld => ld.lorryId === l.id)
        .reduce((acc, ld) => acc + (ld.totalReturnedItems || 0), 0);

      return {
        lorryId: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        routeName: l.route?.name || null,
        routeCode: l.route?.code || null,
        damageCount,
        damageValue,
        resaleCount,
        resaleValue,
        totalReturnsCount: damageCount + resaleCount,
        totalReturnsValue: damageValue + resaleValue,
        eveningUnsoldReturnsCount,
        billsWithReturnsCount: vOrders.size,
        items: vItems
      };
    });

    // Also include Counter returns if any or if specifically requested
    const counterItems = returnDetails.filter(item => !item.lorryId);
    if (counterItems.length > 0 || lorryId === 'COUNTER') {
      const counterOrders = new Set(counterItems.map(i => i.orderId));
      const damageItems = counterItems.filter(i => i.returnType === 'DAMAGE');
      const resaleItems = counterItems.filter(i => i.returnType === 'RESALE');

      const damageCount = damageItems.reduce((acc, i) => acc + i.quantity, 0);
      const damageValue = damageItems.reduce((acc, i) => acc + i.total, 0);
      const resaleCount = resaleItems.reduce((acc, i) => acc + i.quantity, 0);
      const resaleValue = resaleItems.reduce((acc, i) => acc + i.total, 0);

      vehicleSummaries.push({
        lorryId: null,
        vehicleNumber: 'Warehouse Counter',
        driverName: 'Direct Walk-in / Office',
        routeName: 'Central Warehouse',
        routeCode: 'WH-01',
        damageCount,
        damageValue,
        resaleCount,
        resaleValue,
        totalReturnsCount: damageCount + resaleCount,
        totalReturnsValue: damageValue + resaleValue,
        eveningUnsoldReturnsCount: 0,
        billsWithReturnsCount: counterOrders.size,
        items: counterItems
      });
    }

    // Filter if specific vehicle requested
    const filteredVehicles = (lorryId && lorryId !== 'ALL')
      ? vehicleSummaries.filter(v => (lorryId === 'COUNTER' ? v.lorryId === null : v.lorryId === lorryId))
      : vehicleSummaries;

    // Overall fleet totals
    const totalReturnValue = returnDetails.reduce((sum, i) => sum + i.total, 0);
    const totalDamageValue = returnDetails.filter(i => i.returnType === 'DAMAGE').reduce((sum, i) => sum + i.total, 0);
    const totalDamageUnits = returnDetails.filter(i => i.returnType === 'DAMAGE').reduce((sum, i) => sum + i.quantity, 0);
    const totalResaleValue = returnDetails.filter(i => i.returnType === 'RESALE').reduce((sum, i) => sum + i.total, 0);
    const totalResaleUnits = returnDetails.filter(i => i.returnType === 'RESALE').reduce((sum, i) => sum + i.quantity, 0);
    const totalEveningUnsoldUnits = loadings.reduce((sum, ld) => sum + (ld.totalReturnedItems || 0), 0);
    const totalVehiclesWithReturns = vehicleSummaries.filter(v => v.totalReturnsCount > 0).length;
    const totalBillsWithReturns = new Set(returnDetails.map(i => i.orderId)).size;

    res.json({
      summary: {
        totalReturnValue,
        totalDamageValue,
        totalDamageUnits,
        totalResaleValue,
        totalResaleUnits,
        totalEveningUnsoldUnits,
        totalVehiclesWithReturns,
        totalBillsWithReturns
      },
      vehicles: filteredVehicles,
      recentReturnItems: returnDetails
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sales Rep Performance, Targets & Route Distribution Report with date filtering
app.get('/api/reports/rep-performance', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const orderWhere: any = { status: { not: 'CANCELLED' } };
    if (from || to) {
      orderWhere.createdAt = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [reps, ordersInPeriod, mtdOrders, customersInPeriod] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'REP' },
        include: {
          lorry: { include: { route: true } }
        },
        orderBy: { fullName: 'asc' }
      }),
      prisma.order.findMany({
        where: orderWhere,
        include: {
          customer: true,
          lorry: { include: { route: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.findMany({
        where: {
          createdAt: { gte: startOfMonth },
          status: { not: 'CANCELLED' }
        },
        select: {
          id: true,
          lorryId: true,
          netTotal: true
        }
      }),
      prisma.customer.findMany({
        where: from || to ? {
          createdAt: {
            gte: from ? new Date(from as string) : undefined,
            lte: to ? new Date(to as string) : undefined
          }
        } : {},
        select: {
          id: true,
          routeId: true
        }
      })
    ]);

    // Build Rep Summaries
    const repSummaries = reps.map(r => {
      const repOrders = ordersInPeriod.filter(o => o.lorryId === r.lorryId);
      const periodSales = repOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
      const periodCash = repOrders.reduce((sum, o) => sum + Math.min(o.netTotal || 0, o.cashReceived || 0), 0);
      const periodCredit = Math.max(0, periodSales - periodCash);
      const cashRatio = periodSales > 0 ? (periodCash / periodSales) * 100 : 0;
      const ordersCount = repOrders.length;

      const dailyTarget = r.dailyTarget || 20000;
      const monthlyTarget = r.monthlyTarget || 500000;
      const targetNewClients = r.targetNewClients || 5;

      const dailyAchievementPercentage = dailyTarget > 0 ? Math.round((periodSales / dailyTarget) * 100) : 0;

      const repMtdOrders = mtdOrders.filter(o => o.lorryId === r.lorryId);
      const monthToDateSales = repMtdOrders.reduce((sum, o) => sum + (o.netTotal || 0), 0);
      const monthlyAchievementPercentage = monthlyTarget > 0 ? Math.round((monthToDateSales / monthlyTarget) * 100) : 0;

      const newClientsCount = customersInPeriod.filter(c => c.routeId && c.routeId === r.lorry?.routeId).length;

      const statusBadge: 'MET_TARGET' | 'ON_TRACK' | 'IN_PROGRESS' =
        dailyAchievementPercentage >= 100
          ? 'MET_TARGET'
          : dailyAchievementPercentage >= 70
            ? 'ON_TRACK'
            : 'IN_PROGRESS';

      return {
        repId: r.id,
        fullName: r.fullName,
        username: r.username,
        phone: r.phone,
        status: r.status as 'ACTIVE' | 'INACTIVE',
        lorryId: r.lorryId,
        vehicleNumber: r.lorry?.vehicleNumber || null,
        driverName: r.lorry?.driverName || null,
        routeName: r.lorry?.route?.name || null,
        routeCode: r.lorry?.route?.code || null,
        dailyTarget,
        monthlyTarget,
        targetNewClients,
        periodSales,
        periodCash,
        periodCredit,
        cashRatio,
        ordersCount,
        dailyAchievementPercentage,
        monthToDateSales,
        monthlyAchievementPercentage,
        newClientsCount,
        statusBadge
      };
    });

    // Build Rep Orders Detailed Log
    const repOrders = ordersInPeriod.map(o => {
      const rep = reps.find(r => r.lorryId === o.lorryId);
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        paperBillNumber: o.paperBillNumber,
        customerId: o.customerId,
        customerName: o.customer?.name || 'Walk-in',
        customerCode: o.customer?.code || '',
        repId: rep?.id || null,
        repName: rep?.fullName || o.lorry?.driverName || 'Driver Rep',
        lorryId: o.lorryId,
        vehicleNumber: o.lorry?.vehicleNumber || null,
        routeName: o.lorry?.route?.name || (o as any).route?.name || null,
        netTotal: o.netTotal,
        cashReceived: o.cashReceived,
        paidAmount: o.paidAmount,
        balanceAmount: o.balanceAmount,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        chequeNumber: (o as any).chequeNumber || null,
        bankName: (o as any).bankName || null,
        createdAt: o.createdAt.toISOString()
      };
    });

    // Compute Summary totals across all reps
    const totalRepSales = repSummaries.reduce((sum, r) => sum + r.periodSales, 0);
    const totalRepCash = repSummaries.reduce((sum, r) => sum + r.periodCash, 0);
    const totalRepCredit = repSummaries.reduce((sum, r) => sum + r.periodCredit, 0);
    const totalRepBills = repSummaries.reduce((sum, r) => sum + r.ordersCount, 0);
    const totalDailyTarget = repSummaries.reduce((sum, r) => sum + r.dailyTarget, 0);
    const totalMonthlyTarget = repSummaries.reduce((sum, r) => sum + r.monthlyTarget, 0);
    const avgDailyAchievement =
      totalDailyTarget > 0 ? Math.round((totalRepSales / totalDailyTarget) * 100) : 0;
    const totalMtdSales = repSummaries.reduce((sum, r) => sum + r.monthToDateSales, 0);
    const avgMonthlyAchievement =
      totalMonthlyTarget > 0 ? Math.round((totalMtdSales / totalMonthlyTarget) * 100) : 0;

    const summary = {
      totalRepSales,
      totalRepCash,
      totalRepCredit,
      totalRepBills,
      totalDailyTarget,
      totalMonthlyTarget,
      avgDailyAchievement,
      avgMonthlyAchievement,
      activeRepsCount: repSummaries.filter(r => r.status === 'ACTIVE').length
    };

    res.json({
      summary,
      repSummaries,
      repOrders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sales summary by route with date filtering
app.get('/api/reports/route-sales', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const orderWhere: any = { status: { not: 'CANCELLED' } };
    if (from || to) {
      orderWhere.createdAt = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const [routes, allOrders] = await Promise.all([
      prisma.route.findMany({
        include: {
          lorries: true,
          customers: true,
          orders: {
            where: orderWhere,
            include: { items: true }
          }
        },
        orderBy: { code: 'asc' }
      }),
      prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          routeId: true,
          lorryId: true,
          customerId: true,
          netTotal: true,
          cashReceived: true,
          paymentMethod: true,
          paymentStatus: true
        }
      })
    ]);

    const routeSummaries = routes.map(r => {
      const lorryIds = new Set(r.lorries.map(l => l.id));
      const customerIds = new Set(r.customers.map(c => c.id));

      // Match orders for this route: directly by routeId, or by assigned lorry or assigned customer
      const routeOrders = allOrders.filter(o => 
        o.routeId === r.id || 
        (o.lorryId && lorryIds.has(o.lorryId)) || 
        (o.customerId && customerIds.has(o.customerId))
      );

      const totalSales = routeOrders.reduce((acc, o) => acc + (o.netTotal || 0), 0);
      const totalCash = routeOrders.reduce((acc, o) => acc + (o.cashReceived || 0), 0);
      const totalCredit = routeOrders.reduce((acc, o) => acc + Math.max(0, (o.netTotal || 0) - (o.cashReceived || 0)), 0);
      const totalBills = routeOrders.length;
      const cashBillsCount = routeOrders.filter(o => (o.cashReceived || 0) >= (o.netTotal || 0)).length;
      const creditBillsCount = routeOrders.filter(o => (o.cashReceived || 0) < (o.netTotal || 0)).length;

      return {
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        lorry: r.lorries[0] || null,
        customerCount: r.customers.length,
        totalBills,
        cashBillsCount,
        creditBillsCount,
        totalSales,
        totalCash,
        totalCredit
      };
    });

    res.json(routeSummaries);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End-of-day sales summary
app.get('/api/reports/sales-summary', async (req: Request, res: Response) => {
  try {
    const { from, to, lorryId, routeId } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      where.lorryId = lorryId;
    }
    if (routeId && typeof routeId === 'string' && routeId !== 'ALL') {
      where.routeId = routeId;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        lorry: true,
        route: true,
        items: { include: { product: true } },
        returns: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const validOrders = orders.filter(o => o.status !== 'CANCELLED');
    const totalGross = validOrders.reduce((acc, o) => acc + o.subtotal, 0);
    const totalDiscounts = validOrders.reduce((acc, o) => acc + o.discountAmount, 0);
    const totalNet = validOrders.reduce((acc, o) => acc + o.netTotal, 0);
    const totalCash = validOrders.reduce((acc, o) => acc + o.cashReceived, 0);

    res.json({
      from: startDate.toISOString(),
      to: endDate.toISOString(),
      ordersCount: validOrders.length,
      totalGross,
      totalDiscounts,
      totalNet,
      totalCash,
      totalCredit: totalNet - totalCash,
      orders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stock movement history with date filtering
app.get('/api/reports/stock-movements', async (req: Request, res: Response) => {
  try {
    const { type, limit, from, to } = req.query;
    const where: any = {};
    if (type && typeof type === 'string' && type !== 'ALL') {
      where.type = type;
    }
    if (from || to) {
      where.createdAt = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit as string, 10) : 100
    });

    res.json(movements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Customer outstanding balances
app.get('/api/reports/customer-balances', async (_req: Request, res: Response) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { outstandingBalance: { gt: 0 } },
      include: { route: true },
      orderBy: { outstandingBalance: 'desc' }
    });

    const totalOutstanding = customers.reduce((acc, c) => acc + c.outstandingBalance, 0);

    res.json({
      totalOutstanding,
      count: customers.length,
      customers
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Profit and Loss Statement with full financial breakdown & date filtering
app.get('/api/reports/profit-and-loss', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const [orders, lorries, periodExpenses] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          items: {
            include: { product: true }
          },
          customer: true,
          lorry: {
            include: { route: true }
          },
          route: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.lorry.findMany({
        include: { route: true }
      }),
      prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { lorry: true }
      })
    ]);

    let grossRevenue = 0;
    let discounts = 0;
    let netRevenue = 0;
    let cogs = 0;
    let freeIssueCost = 0;
    let totalUnitsSold = 0;
    let totalFreeUnits = 0;
    let cashCollected = 0;

    // Track product-level breakdown
    const productStatsMap = new Map<string, {
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
    }>();

    // Track channel breakdown
    const channelMap = new Map<string, {
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
    }>();

    // Initialize lorries in channel map
    for (const lorry of lorries) {
      channelMap.set(lorry.id, {
        id: lorry.id,
        channelName: lorry.vehicleNumber,
        subtext: `${lorry.driverName} • ${lorry.route?.name || 'Assigned Route'}`,
        billsCount: 0,
        netRevenue: 0,
        cogs: 0,
        freeIssueCost: 0,
        totalCost: 0,
        grossProfit: 0,
        margin: 0
      });
    }

    // Warehouse direct counter channel
    const COUNTER_CHANNEL_ID = 'warehouse-counter';
    channelMap.set(COUNTER_CHANNEL_ID, {
      id: COUNTER_CHANNEL_ID,
      channelName: 'Warehouse Sales Counter',
      subtext: 'Direct Counter & Walk-in Cash Sales',
      billsCount: 0,
      netRevenue: 0,
      cogs: 0,
      freeIssueCost: 0,
      totalCost: 0,
      grossProfit: 0,
      margin: 0
    });

    // Daily breakdown map
    const dailyMap = new Map<string, {
      date: string;
      revenue: number;
      cost: number;
      profit: number;
      margin: number;
    }>();

    for (const order of orders) {
      grossRevenue += order.subtotal;
      discounts += order.discountAmount;
      netRevenue += order.netTotal;
      cashCollected += order.cashReceived;

      const channelKey = order.lorryId || COUNTER_CHANNEL_ID;
      const channel = channelMap.get(channelKey);
      if (channel) {
        channel.billsCount += 1;
        channel.netRevenue += order.netTotal;
      }

      const dateKey = order.createdAt.toISOString().slice(0, 10);
      let dayStat = dailyMap.get(dateKey);
      if (!dayStat) {
        dayStat = { date: dateKey, revenue: 0, cost: 0, profit: 0, margin: 0 };
        dailyMap.set(dateKey, dayStat);
      }
      dayStat.revenue += order.netTotal;

      for (const item of order.items) {
        const prod = item.product;
        const soldQty = item.quantity;
        const freeQty = item.freeQuantity || 0;
        const itemCogs = soldQty * prod.costPrice;
        // Cost is NOT counted on free issues (free promotional units are acquired at Rs. 0.00 cost)
        const itemFreeCost = 0;
        const itemLineTotal = item.lineTotal;

        cogs += itemCogs;
        freeIssueCost += itemFreeCost;
        totalUnitsSold += soldQty;
        totalFreeUnits += freeQty;

        if (channel) {
          channel.cogs += itemCogs;
          channel.freeIssueCost += itemFreeCost;
          channel.totalCost += (itemCogs + itemFreeCost);
        }

        dayStat.cost += (itemCogs + itemFreeCost);

        // Product map
        let prodStat = productStatsMap.get(prod.id);
        if (!prodStat) {
          prodStat = {
            productId: prod.id,
            name: prod.name,
            sku: prod.sku,
            category: prod.category,
            unit: prod.unit,
            unitPrice: prod.unitPrice,
            costPrice: prod.costPrice,
            unitsSold: 0,
            unitsFree: 0,
            revenue: 0,
            cogs: 0,
            freeCost: 0,
            totalCost: 0,
            grossProfit: 0,
            margin: 0
          };
          productStatsMap.set(prod.id, prodStat);
        }

        prodStat.unitsSold += soldQty;
        prodStat.unitsFree += freeQty;
        prodStat.revenue += itemLineTotal;
        prodStat.cogs += itemCogs;
        prodStat.freeCost += itemFreeCost;
        prodStat.totalCost += (itemCogs + itemFreeCost);
      }
    }

    const totalCostOfSales = cogs + freeIssueCost;
    const grossProfit = netRevenue - totalCostOfSales;
    const grossProfitMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    const markupPercentage = totalCostOfSales > 0 ? (grossProfit / totalCostOfSales) * 100 : 0;
    const chequesCollected = (orders as any[]).filter((o: any) => o.paymentMethod === 'CHEQUE').reduce((acc: number, o: any) => acc + o.netTotal, 0);
    const creditReceivables = (orders as any[]).reduce((acc: number, o: any) => {
      if (o.paymentMethod === 'CHEQUE') return acc;
      return acc + (o.balanceAmount !== undefined ? o.balanceAmount : Math.max(0, o.netTotal - (o.cashReceived || 0)));
    }, 0);

    // Process Operating Expenditures (OPEX)
    const totalExpenses = periodExpenses.reduce((acc, exp) => acc + exp.amount, 0);
    const netOperatingProfit = grossProfit - totalExpenses;
    const netProfitMargin = netRevenue > 0 ? (netOperatingProfit / netRevenue) * 100 : 0;

    let fleetExpenses = 0;
    let overheadExpenses = 0;
    const expenseCategoryMap = new Map<string, { category: string; amount: number; count: number }>();

    for (const exp of periodExpenses) {
      let catStat = expenseCategoryMap.get(exp.category);
      if (!catStat) {
        catStat = { category: exp.category, amount: 0, count: 0 };
        expenseCategoryMap.set(exp.category, catStat);
      }
      catStat.amount += exp.amount;
      catStat.count += 1;

      if (exp.lorryId) {
        fleetExpenses += exp.amount;
        const channel = channelMap.get(exp.lorryId);
        if (channel) {
          (channel as any).expenses = ((channel as any).expenses || 0) + exp.amount;
        }
      } else {
        overheadExpenses += exp.amount;
      }

      // Add expense to daily breakdown
      const dateKey = exp.date.toISOString().slice(0, 10);
      let dayStat = dailyMap.get(dateKey);
      if (!dayStat) {
        dayStat = { date: dateKey, revenue: 0, cost: 0, profit: 0, margin: 0 };
        dailyMap.set(dateKey, dayStat);
      }
      (dayStat as any).expenses = ((dayStat as any).expenses || 0) + exp.amount;
    }

    // Compute margins and net channel profit for channels
    const channelBreakdown = Array.from(channelMap.values()).map(c => {
      c.grossProfit = c.netRevenue - c.totalCost;
      c.margin = c.netRevenue > 0 ? (c.grossProfit / c.netRevenue) * 100 : 0;
      const channelExp = (c as any).expenses || 0;
      (c as any).expenses = channelExp;
      (c as any).netProfit = c.grossProfit - channelExp;
      return c;
    });

    // Compute margins for products & sort by profit descending
    const productBreakdown = Array.from(productStatsMap.values()).map(p => {
      p.grossProfit = p.revenue - p.totalCost;
      p.margin = p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0;
      return p;
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    // Daily breakdown sorted by date
    const dailyBreakdown = Array.from(dailyMap.values()).map(d => {
      d.profit = d.revenue - d.cost;
      d.margin = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
      return d;
    }).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString()
      },
      summary: {
        grossRevenue,
        discounts,
        netRevenue,
        cogs,
        freeIssueCost,
        totalCostOfSales,
        grossProfit,
        grossProfitMargin,
        markupPercentage,
        totalUnitsSold,
        totalFreeUnits,
        totalOrdersCount: orders.length,
        cashCollected,
        chequesCollected,
        creditReceivables,
        totalExpenses,
        netOperatingProfit,
        netProfitMargin,
        fleetExpenses,
        overheadExpenses
      },
      expensesByCategory: Array.from(expenseCategoryMap.values()),
      channelBreakdown,
      productBreakdown,
      dailyBreakdown
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 9. EXPENSES & OPERATIONAL EXPENDITURES (OPEX)
// ========================================================

// List expenses with date, category, lorry, payment method & search filters
app.get('/api/expenses', async (req: Request, res: Response) => {
  try {
    const { from, to, category, lorryId, paymentMethod, search } = req.query;
    const where: any = {};

    if (from || to) {
      where.date = {
        gte: from ? new Date(from as string) : undefined,
        lte: to ? new Date(to as string) : undefined
      };
    }

    if (category && typeof category === 'string' && category !== 'ALL') {
      where.category = category;
    }

    if (lorryId && typeof lorryId === 'string' && lorryId !== 'ALL') {
      where.lorryId = lorryId === 'OVERHEAD' ? null : lorryId;
    }

    if (paymentMethod && typeof paymentMethod === 'string' && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search } },
        { expenseNumber: { contains: search } },
        { referenceNumber: { contains: search } },
        { paidTo: { contains: search } },
        { notes: { contains: search } }
      ];
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        lorry: {
          include: { route: true }
        },
        loading: true
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Expense Summary KPIs & Category Breakdown
app.get('/api/expenses/summary', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    const startDate = from ? new Date(from as string) : new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = to ? new Date(to as string) : new Date(new Date().setHours(23, 59, 59, 999));

    const [expenses, lorries] = await Promise.all([
      prisma.expense.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: { lorry: true }
      }),
      prisma.lorry.findMany()
    ]);

    const totalAmount = expenses.reduce((acc, exp) => acc + exp.amount, 0);
    const totalCount = expenses.length;

    let fleetExpenses = 0;
    let overheadExpenses = 0;

    const categoryMap = new Map<string, { category: string; amount: number; count: number }>();
    const lorryMap = new Map<string, { lorryId: string; vehicleNumber: string; driverName: string; amount: number; count: number }>();
    const paymentMap = new Map<string, number>();

    for (const l of lorries) {
      lorryMap.set(l.id, {
        lorryId: l.id,
        vehicleNumber: l.vehicleNumber,
        driverName: l.driverName,
        amount: 0,
        count: 0
      });
    }

    for (const exp of expenses) {
      // By category
      let cat = categoryMap.get(exp.category);
      if (!cat) {
        cat = { category: exp.category, amount: 0, count: 0 };
        categoryMap.set(exp.category, cat);
      }
      cat.amount += exp.amount;
      cat.count += 1;

      // By lorry / fleet
      if (exp.lorryId) {
        fleetExpenses += exp.amount;
        let lStat = lorryMap.get(exp.lorryId);
        if (lStat) {
          lStat.amount += exp.amount;
          lStat.count += 1;
        }
      } else {
        overheadExpenses += exp.amount;
      }

      // By payment method
      const currentPm = paymentMap.get(exp.paymentMethod) || 0;
      paymentMap.set(exp.paymentMethod, currentPm + exp.amount);
    }

    res.json({
      totalAmount,
      totalCount,
      fleetExpenses,
      overheadExpenses,
      byCategory: Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount),
      byLorry: Array.from(lorryMap.values()),
      byPaymentMethod: Array.from(paymentMap.entries()).map(([paymentMethod, amount]) => ({
        paymentMethod,
        amount
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single expense
app.get('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        lorry: { include: { route: true } },
        loading: true
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense record not found.' });
    }

    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record a new Expense
app.post('/api/expenses', async (req: Request, res: Response) => {
  try {
    const {
      category,
      title,
      amount,
      date,
      paymentMethod,
      referenceNumber,
      paidTo,
      notes,
      lorryId,
      loadingId
    } = req.body;

    if (!category || !title || amount === undefined || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid category, title, and positive amount are required.' });
    }

    const expenseDate = date ? new Date(date) : new Date();
    const todayStr = expenseDate.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.expense.count({
      where: {
        date: {
          gte: new Date(new Date(expenseDate).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(expenseDate).setHours(23, 59, 59, 999))
        }
      }
    });
    const expenseNumber = `EXP-${todayStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    // Auto-link active loading if lorryId is specified without loadingId
    let finalLoadingId = loadingId || null;
    if (lorryId && !finalLoadingId) {
      const activeLoading = await prisma.lorryLoading.findFirst({
        where: {
          lorryId,
          status: { in: ['LOADED', 'IN_TRANSIT'] }
        },
        orderBy: { date: 'desc' }
      });
      if (activeLoading) {
        finalLoadingId = activeLoading.id;
      }
    }

    const created = await prisma.expense.create({
      data: {
        expenseNumber,
        category: category.trim().toUpperCase(),
        title: title.trim(),
        amount: parseFloat(amount),
        date: expenseDate,
        paymentMethod: paymentMethod || 'CASH',
        referenceNumber: referenceNumber?.trim() || null,
        paidTo: paidTo?.trim() || null,
        notes: notes?.trim() || null,
        lorryId: lorryId || null,
        loadingId: finalLoadingId
      },
      include: {
        lorry: { include: { route: true } },
        loading: true
      }
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update an Expense
app.put('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      category,
      title,
      amount,
      date,
      paymentMethod,
      referenceNumber,
      paidTo,
      notes,
      lorryId,
      loadingId
    } = req.body;

    const data: any = {};
    if (category !== undefined) data.category = category.trim().toUpperCase();
    if (title !== undefined) data.title = title.trim();
    if (amount !== undefined) {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
      }
      data.amount = numAmount;
    }
    if (date !== undefined) data.date = new Date(date);
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod;
    if (referenceNumber !== undefined) data.referenceNumber = referenceNumber?.trim() || null;
    if (paidTo !== undefined) data.paidTo = paidTo?.trim() || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (lorryId !== undefined) data.lorryId = lorryId || null;
    if (loadingId !== undefined) data.loadingId = loadingId || null;

    const updated = await prisma.expense.update({
      where: { id },
      data,
      include: {
        lorry: { include: { route: true } },
        loading: true
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete an Expense
app.delete('/api/expenses/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return res.json({ success: true, message: 'Expense already removed or does not exist.' });
    }
    await prisma.expense.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Expense record deleted.' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.json({ success: true, message: 'Expense already removed or does not exist.' });
    }
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// 8. MANUFACTURING, BOM RECIPES & PRODUCTION RUNS
// ========================================================

// 1. List recipes with product and components
app.get('/api/manufacturing/recipes', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { product: { name: { contains: search } } }
      ];
    }

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        },
        _count: { select: { productionRuns: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(recipes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Get single recipe by ID
app.get('/api/manufacturing/recipes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recipe = await prisma.recipe.findUniqueOrThrow({
      where: { id },
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        },
        productionRuns: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    res.json(recipe);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// 3. Create a new BOM Recipe
app.post('/api/manufacturing/recipes', async (req: Request, res: Response) => {
  try {
    const { name, productId, outputYield, estimatedOverheadCost, notes, items } = req.body;

    if (!name || !productId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Recipe name, target finished product, and at least 1 raw material / component are required.' });
    }

    const count = await prisma.recipe.count();
    const code = `BOM-${(count + 1).toString().padStart(3, '0')}`;

    const recipe = await prisma.recipe.create({
      data: {
        code,
        name: name.trim(),
        productId,
        outputYield: parseInt(outputYield || 1, 10),
        estimatedOverheadCost: parseFloat(estimatedOverheadCost || 0),
        notes: notes?.trim() || null,
        items: {
          create: items.map((it: any) => ({
            componentProductId: it.componentProductId,
            quantity: parseFloat(it.quantity || 1),
            notes: it.notes?.trim() || null
          }))
        }
      },
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        }
      }
    });

    res.status(201).json(recipe);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Update a BOM Recipe
app.put('/api/manufacturing/recipes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, productId, outputYield, estimatedOverheadCost, notes, items } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (productId !== undefined) data.productId = productId;
    if (outputYield !== undefined) data.outputYield = parseInt(outputYield, 10);
    if (estimatedOverheadCost !== undefined) data.estimatedOverheadCost = parseFloat(estimatedOverheadCost);
    if (notes !== undefined) data.notes = notes?.trim() || null;

    if (items && Array.isArray(items)) {
      // Replace items
      await prisma.recipeItem.deleteMany({ where: { recipeId: id } });
      data.items = {
        create: items.map((it: any) => ({
          componentProductId: it.componentProductId,
          quantity: parseFloat(it.quantity || 1),
          notes: it.notes?.trim() || null
        }))
      };
    }

    const updated = await prisma.recipe.update({
      where: { id },
      data,
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        }
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Delete a Recipe
app.delete('/api/manufacturing/recipes/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.recipe.findUnique({ where: { id } });
    if (!existing) {
      return res.json({ success: true, message: 'Recipe already removed or does not exist.' });
    }
    await prisma.recipe.delete({ where: { id } });
    res.json({ success: true, message: 'Recipe removed successfully.' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.json({ success: true, message: 'Recipe already removed or does not exist.' });
    }
    res.status(400).json({ error: error.message });
  }
});

// 6. List Production Runs
app.get('/api/manufacturing/production-runs', async (req: Request, res: Response) => {
  try {
    const { recipeId, status, from, to } = req.query;
    const where: any = {};
    if (recipeId && typeof recipeId === 'string' && recipeId !== 'ALL') where.recipeId = recipeId;
    if (status && typeof status === 'string' && status !== 'ALL') where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from as string);
      if (to) where.createdAt.lte = new Date(to as string);
    }

    const runs = await prisma.productionRun.findMany({
      where,
      include: {
        recipe: {
          include: { product: true }
        },
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get single Production Run
app.get('/api/manufacturing/production-runs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = await prisma.productionRun.findUniqueOrThrow({
      where: { id },
      include: {
        recipe: {
          include: { product: true }
        },
        items: {
          include: { product: true }
        }
      }
    });
    res.json(run);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// 8. Create & Execute a Production Run
app.post('/api/manufacturing/production-runs', async (req: Request, res: Response) => {
  try {
    const {
      recipeId,
      targetQuantity,
      actualQuantity,
      overheadCost,
      producedBy,
      notes,
      completeImmediately = true
    } = req.body;

    const plannedQty = parseInt(targetQuantity, 10);
    if (isNaN(plannedQty) || plannedQty <= 0) {
      return res.status(400).json({ error: 'Valid positive target quantity required.' });
    }

    const recipe = await prisma.recipe.findUniqueOrThrow({
      where: { id: recipeId },
      include: {
        product: true,
        items: {
          include: { componentProduct: true }
        }
      }
    });

    const outputQty = actualQuantity !== undefined ? parseInt(actualQuantity, 10) : plannedQty;
    const outputYield = recipe.outputYield || 1;
    const batchMultiplier = outputQty / outputYield;

    // Generate batch number BATCH-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.productionRun.count({
      where: {
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }
    });
    const batchNumber = `BATCH-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    // Calculate component quantities and costs
    let totalRawMaterialCost = 0;
    const itemsData = recipe.items.map((item) => {
      const requiredQty = item.quantity * batchMultiplier;
      const unitCost = item.componentProduct.costPrice || 0;
      const lineCost = requiredQty * unitCost;
      totalRawMaterialCost += lineCost;

      return {
        productId: item.componentProductId,
        plannedQuantity: requiredQty,
        actualQuantity: requiredQty,
        unitCost,
        lineCost
      };
    });

    const additionalOverhead = parseFloat(overheadCost !== undefined ? overheadCost : (recipe.estimatedOverheadCost * batchMultiplier)) || 0;
    const totalProductionCost = totalRawMaterialCost + additionalOverhead;
    const unitCost = outputQty > 0 ? (totalProductionCost / outputQty) : 0;

    const runStatus = completeImmediately ? 'COMPLETED' : 'IN_PROGRESS';

    // Execute in transaction
    const productionRun = await prisma.$transaction(async (tx) => {
      // Create ProductionRun record
      const run = await tx.productionRun.create({
        data: {
          batchNumber,
          recipeId,
          targetQuantity: plannedQty,
          actualQuantity: completeImmediately ? outputQty : 0,
          status: runStatus,
          totalRawMaterialCost,
          overheadCost: additionalOverhead,
          totalProductionCost,
          unitCost,
          producedBy: producedBy?.trim() || null,
          notes: notes?.trim() || null,
          startDate: today,
          completedAt: completeImmediately ? today : null,
          items: {
            create: itemsData
          }
        },
        include: {
          recipe: { include: { product: true } },
          items: { include: { product: true } }
        }
      });

      if (completeImmediately) {
        // 1. Deduct raw materials from warehouse stock
        for (const item of itemsData) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              currentStock: { decrement: Math.round(item.actualQuantity) }
            }
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'MANUFACTURING_CONSUMPTION',
              quantity: -Math.round(item.actualQuantity),
              referenceId: batchNumber,
              notes: `Consumed in production batch ${batchNumber} for ${recipe.product.name}`
            }
          });
        }

        // 2. Add finished product to warehouse stock and update costPrice
        await tx.product.update({
          where: { id: recipe.productId },
          data: {
            currentStock: { increment: outputQty },
            costPrice: unitCost > 0 ? parseFloat(unitCost.toFixed(2)) : undefined
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: recipe.productId,
            type: 'MANUFACTURING_OUTPUT',
            quantity: outputQty,
            referenceId: batchNumber,
            notes: `Manufactured ${outputQty} units in production batch ${batchNumber}`
          }
        });
      }

      return run;
    });

    res.status(201).json(productionRun);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 9. Complete an In-Progress Production Run
app.post('/api/manufacturing/production-runs/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { actualQuantity, notes } = req.body;

    const run = await prisma.productionRun.findUniqueOrThrow({
      where: { id },
      include: {
        recipe: { include: { product: true } },
        items: { include: { product: true } }
      }
    });

    if (run.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Production run is already marked as completed.' });
    }

    const outputQty = actualQuantity !== undefined ? parseInt(actualQuantity, 10) : run.targetQuantity;
    const completedAt = new Date();

    const updatedRun = await prisma.$transaction(async (tx) => {
      // 1. Deduct raw materials
      for (const item of run.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { decrement: Math.round(item.actualQuantity) }
          }
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'MANUFACTURING_CONSUMPTION',
            quantity: -Math.round(item.actualQuantity),
            referenceId: run.batchNumber,
            notes: `Consumed in batch ${run.batchNumber}`
          }
        });
      }

      // 2. Add finished product
      await tx.product.update({
        where: { id: run.recipe.productId },
        data: {
          currentStock: { increment: outputQty },
          costPrice: run.unitCost > 0 ? parseFloat(run.unitCost.toFixed(2)) : undefined
        }
      });

      await tx.stockMovement.create({
        data: {
          productId: run.recipe.productId,
          type: 'MANUFACTURING_OUTPUT',
          quantity: outputQty,
          referenceId: run.batchNumber,
          notes: `Manufactured ${outputQty} units in batch ${run.batchNumber}`
        }
      });

      return tx.productionRun.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualQuantity: outputQty,
          completedAt,
          notes: notes !== undefined ? notes : run.notes
        },
        include: {
          recipe: { include: { product: true } },
          items: { include: { product: true } }
        }
      });
    });

    res.json(updatedRun);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 10. Cancel a Production Run
app.post('/api/manufacturing/production-runs/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const run = await prisma.productionRun.findUniqueOrThrow({ where: { id } });
    if (run.status === 'COMPLETED') {
      return res.status(400).json({ error: 'Cannot cancel an already completed production run.' });
    }

    const updated = await prisma.productionRun.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 11. Manufacturing Summary Stats
app.get('/api/manufacturing/summary', async (_req: Request, res: Response) => {
  try {
    const [totalRuns, activeRecipes, completedRunsAgg] = await Promise.all([
      prisma.productionRun.count(),
      prisma.recipe.count(),
      prisma.productionRun.aggregate({
        where: { status: 'COMPLETED' },
        _sum: {
          actualQuantity: true,
          totalProductionCost: true
        }
      })
    ]);

    res.json({
      totalBatchesCount: totalRuns,
      totalUnitsManufactured: completedRunsAgg._sum.actualQuantity || 0,
      totalProductionCost: completedRunsAgg._sum.totalProductionCost || 0,
      activeRecipesCount: activeRecipes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================================
// 8. GENERAL & BUSINESS SETTINGS
// ========================================================
// ========================================================
// 12. HR & PAYROLL MANAGEMENT (EMPLOYEES, ATTENDANCE, ADVANCES, PAYROLL)
// ========================================================

// 12.1 EMPLOYEES DIRECTORY
app.get('/api/hr/employees', async (req: Request, res: Response) => {
  try {
    // Automatically detect and sync sales reps and lorry drivers from fleet into staff directory
    await syncFleetAndRepsToEmployees();

    const { department, status, search } = req.query;
    const where: any = {};

    if (department && department !== 'ALL') {
      where.department = department;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { callingName: { contains: q } },
        { employeeNumber: { contains: q } },
        { nicNumber: { contains: q } },
        { phone: { contains: q } },
        { designation: { contains: q } }
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { employeeNumber: 'asc' },
      include: {
        salaryAdvances: {
          where: { status: 'PENDING' }
        }
      }
    });

    res.json(employees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Explicit endpoint to trigger Fleet & Rep sync
app.post('/api/hr/employees/sync', async (_req: Request, res: Response) => {
  try {
    await syncFleetAndRepsToEmployees();
    const count = await prisma.employee.count();
    res.json({ success: true, message: 'Staff directory successfully synced with fleet & reps', totalEmployees: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/hr/employees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const employee = await prisma.employee.findUniqueOrThrow({
      where: { id },
      include: {
        attendances: {
          take: 31,
          orderBy: { date: 'desc' }
        },
        salaryAdvances: {
          orderBy: { date: 'desc' }
        },
        payrolls: {
          take: 12,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    res.json(employee);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/hr/employees', async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      callingName,
      nicNumber,
      phone,
      address,
      designation,
      department,
      employmentType,
      joinDate,
      basicSalary,
      dailyRate,
      otHourlyRate,
      allowances,
      commissionRate,
      bankName,
      branchName,
      accountNumber,
      epfNumber,
      userId,
      lorryId,
      notes
    } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    if (!designation || !designation.trim()) {
      return res.status(400).json({ error: 'Designation / job role is required.' });
    }

    // Auto-generate employee number EMP-001, EMP-002...
    const countTotal = await prisma.employee.count();
    const employeeNumber = `EMP-${(countTotal + 1).toString().padStart(3, '0')}`;

    const newEmployee = await prisma.employee.create({
      data: {
        employeeNumber,
        fullName: fullName.trim(),
        callingName: callingName?.trim() || null,
        nicNumber: nicNumber?.trim() || null,
        phone: phone.trim(),
        address: address?.trim() || null,
        designation: designation.trim(),
        department: department || 'SALES_FLEET',
        employmentType: employmentType || 'FULL_TIME',
        joinDate: joinDate ? new Date(joinDate) : new Date(),
        status: 'ACTIVE',
        basicSalary: parseFloat(basicSalary) || 0.0,
        dailyRate: parseFloat(dailyRate) || 0.0,
        otHourlyRate: parseFloat(otHourlyRate) || 0.0,
        allowances: parseFloat(allowances) || 0.0,
        commissionRate: parseFloat(commissionRate) || 0.0,
        bankName: bankName?.trim() || null,
        branchName: branchName?.trim() || null,
        accountNumber: accountNumber?.trim() || null,
        epfNumber: epfNumber?.trim() || null,
        userId: userId || null,
        lorryId: lorryId || null,
        notes: notes?.trim() || null
      }
    });

    res.status(201).json(newEmployee);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/hr/employees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      callingName,
      nicNumber,
      phone,
      address,
      designation,
      department,
      employmentType,
      joinDate,
      status,
      basicSalary,
      dailyRate,
      otHourlyRate,
      allowances,
      commissionRate,
      bankName,
      branchName,
      accountNumber,
      epfNumber,
      userId,
      lorryId,
      notes
    } = req.body;

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        fullName: fullName !== undefined ? fullName.trim() : undefined,
        callingName: callingName !== undefined ? callingName.trim() : undefined,
        nicNumber: nicNumber !== undefined ? nicNumber.trim() : undefined,
        phone: phone !== undefined ? phone.trim() : undefined,
        address: address !== undefined ? address.trim() : undefined,
        designation: designation !== undefined ? designation.trim() : undefined,
        department: department !== undefined ? department : undefined,
        employmentType: employmentType !== undefined ? employmentType : undefined,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        status: status !== undefined ? status : undefined,
        basicSalary: basicSalary !== undefined ? parseFloat(basicSalary) : undefined,
        dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : undefined,
        otHourlyRate: otHourlyRate !== undefined ? parseFloat(otHourlyRate) : undefined,
        allowances: allowances !== undefined ? parseFloat(allowances) : undefined,
        commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : undefined,
        bankName: bankName !== undefined ? bankName.trim() : undefined,
        branchName: branchName !== undefined ? branchName.trim() : undefined,
        accountNumber: accountNumber !== undefined ? accountNumber.trim() : undefined,
        epfNumber: epfNumber !== undefined ? epfNumber.trim() : undefined,
        userId: userId !== undefined ? userId : undefined,
        lorryId: lorryId !== undefined ? lorryId : undefined,
        notes: notes !== undefined ? notes.trim() : undefined
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/hr/employees/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payrollCount = await prisma.payroll.count({ where: { employeeId: id } });

    if (payrollCount > 0) {
      // Soft-delete to preserve payroll audit history
      const updated = await prisma.employee.update({
        where: { id },
        data: { status: 'TERMINATED' }
      });
      return res.json({ message: `Employee record archived and set to TERMINATED due to existing payroll history.`, employee: updated });
    }

    await prisma.employee.delete({ where: { id } });
    res.json({ message: 'Employee deleted successfully.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 12.2 DAILY ATTENDANCE
app.get('/api/hr/attendance', async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const [activeEmployees, attendances] = await Promise.all([
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { employeeNumber: 'asc' }
      }),
      prisma.attendance.findMany({
        where: {
          date: {
            gte: targetDate,
            lt: nextDate
          }
        },
        include: { employee: true }
      })
    ]);

    // Merge so every active employee has an entry for the day (marked or pending)
    const attendanceMap = new Map<string, any>(attendances.map((a: any) => [a.employeeId, a]));
    const merged = activeEmployees.map((emp: any) => {
      const record = attendanceMap.get(emp.id);
      return {
        employeeId: emp.id,
        employee: emp,
        attendanceId: record?.id || null,
        date: targetDate.toISOString(),
        status: record?.status || 'PRESENT',
        checkInTime: record?.checkInTime || '',
        checkOutTime: record?.checkOutTime || '',
        otHours: record?.otHours || 0.0,
        notes: record?.notes || ''
      };
    });

    res.json({
      date: targetDate.toISOString(),
      attendances: merged,
      summary: {
        total: activeEmployees.length,
        present: attendances.filter((a: any) => a.status === 'PRESENT').length,
        halfDay: attendances.filter((a: any) => a.status === 'HALF_DAY').length,
        absent: attendances.filter((a: any) => a.status === 'ABSENT').length,
        leave: attendances.filter((a: any) => a.status === 'LEAVE').length,
        unmarked: activeEmployees.length - attendances.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/attendance', async (req: Request, res: Response) => {
  try {
    const { employeeId, date, status, checkInTime, checkOutTime, otHours, notes } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required.' });
    }

    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: attendanceDate
        }
      },
      update: {
        status: status || 'PRESENT',
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        otHours: parseFloat(otHours) || 0.0,
        notes: notes !== undefined ? notes : undefined
      },
      create: {
        employeeId,
        date: attendanceDate,
        status: status || 'PRESENT',
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        otHours: parseFloat(otHours) || 0.0,
        notes: notes || null
      },
      include: { employee: true }
    });

    res.json(record);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/hr/attendance/bulk', async (req: Request, res: Response) => {
  try {
    const { date, records, markAllPresent } = req.body;
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    let rowsToProcess = records;

    if (markAllPresent) {
      const activeEmployees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' }
      });
      rowsToProcess = activeEmployees.map((emp: any) => ({
        employeeId: emp.id,
        status: 'PRESENT',
        otHours: 0,
        notes: 'Bulk marked present'
      }));
    }

    if (!Array.isArray(rowsToProcess) || rowsToProcess.length === 0) {
      return res.status(400).json({ error: 'No attendance records provided.' });
    }

    const saved: any[] = [];
    for (const r of rowsToProcess) {
      if (!r.employeeId) continue;
      const rec = await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: r.employeeId,
            date: attendanceDate
          }
        },
        update: {
          status: r.status || 'PRESENT',
          checkInTime: r.checkInTime || null,
          checkOutTime: r.checkOutTime || null,
          otHours: parseFloat(r.otHours) || 0.0,
          notes: r.notes || null
        },
        create: {
          employeeId: r.employeeId,
          date: attendanceDate,
          status: r.status || 'PRESENT',
          checkInTime: r.checkInTime || null,
          checkOutTime: r.checkOutTime || null,
          otHours: parseFloat(r.otHours) || 0.0,
          notes: r.notes || null
        }
      });
      saved.push(rec);
    }

    res.json({ message: `Successfully recorded attendance for ${saved.length} employees.`, count: saved.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 12.3 SALARY ADVANCES (WIRED TO OPEX & PAYROLL)
app.get('/api/hr/advances', async (req: Request, res: Response) => {
  try {
    const { employeeId, status } = req.query;
    const where: any = {};

    if (employeeId && employeeId !== 'ALL') {
      where.employeeId = employeeId;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    const advances = await prisma.salaryAdvance.findMany({
      where,
      include: { employee: true, payroll: true },
      orderBy: { date: 'desc' }
    });

    res.json(advances);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/hr/advances', async (req: Request, res: Response) => {
  try {
    const { employeeId, amount, date, reason, paymentMethod, notes, syncToExpense = true } = req.body;

    const advAmount = parseFloat(amount);
    if (!employeeId || isNaN(advAmount) || advAmount <= 0) {
      return res.status(400).json({ error: 'Valid employee and positive advance amount required.' });
    }

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countTotal = await prisma.salaryAdvance.count();
    const advanceNumber = `ADV-${todayStr}-${(countTotal + 1).toString().padStart(4, '0')}`;
    const advanceDate = date ? new Date(date) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Salary Advance Record
      const newAdvance = await tx.salaryAdvance.create({
        data: {
          advanceNumber,
          employeeId,
          amount: advAmount,
          date: advanceDate,
          reason: reason?.trim() || 'Mid-month cash advance',
          paymentMethod: paymentMethod || 'CASH',
          status: 'PENDING',
          notes: notes?.trim() || null
        },
        include: { employee: true }
      });

      // 2. WIRED TO WHOLE APP: Auto-create Expense entry under SALARIES so cash outflow is tracked immediately
      if (syncToExpense) {
        const countExpensesToday = await tx.expense.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        });
        const expenseNumber = `EXP-${todayStr}-${(countExpensesToday + 1).toString().padStart(4, '0')}`;

        await tx.expense.create({
          data: {
            expenseNumber,
            category: 'SALARIES',
            title: `Salary Advance: ${employee.fullName} (${advanceNumber})`,
            amount: advAmount,
            date: advanceDate,
            paymentMethod: paymentMethod || 'CASH',
            referenceNumber: advanceNumber,
            paidTo: employee.fullName,
            notes: `Salary advance issued to ${employee.designation} ${employee.fullName}. Reason: ${reason || 'N/A'}`,
            lorryId: employee.lorryId || null
          }
        });
      }

      return newAdvance;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/hr/advances/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const advance = await prisma.salaryAdvance.findUniqueOrThrow({ where: { id } });

    if (advance.status === 'DEDUCTED') {
      return res.status(400).json({ error: 'Cannot delete advance that has already been deducted in a settled payroll.' });
    }

    // Delete advance and any auto-created expense linked via referenceNumber
    await prisma.$transaction(async (tx) => {
      await tx.expense.deleteMany({
        where: { referenceNumber: advance.advanceNumber }
      });
      await tx.salaryAdvance.delete({ where: { id } });
    });

    res.json({ message: `Salary advance ${advance.advanceNumber} voided successfully.` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 12.4 PAYROLL PROCESSING & AUTOMATIC COMMISSION / EXPENSE WIRING
app.get('/api/hr/payroll', async (req: Request, res: Response) => {
  try {
    const { month, year, employeeId } = req.query;
    const where: any = {};

    if (month) where.month = parseInt(month as string, 10);
    if (year) where.year = parseInt(year as string, 10);
    if (employeeId && employeeId !== 'ALL') where.employeeId = employeeId;

    const payrolls = await prisma.payroll.findMany({
      where,
      include: {
        employee: true,
        salaryAdvances: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(payrolls);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PREVIEW SALARY CALCULATION FOR AN EMPLOYEE BEFORE FINALIZING
app.get('/api/hr/payroll/preview/:employeeId', async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });

    // Date bounds for the month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // 1. Attendance aggregation
    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId,
        date: { gte: startOfMonth, lte: endOfMonth }
      }
    });

    const workedDays = attendances.filter((a: any) => a.status === 'PRESENT').length + (attendances.filter((a: any) => a.status === 'HALF_DAY').length * 0.5);
    const absentDays = attendances.filter((a: any) => a.status === 'ABSENT').length;
    const leaveDays = attendances.filter((a: any) => a.status === 'LEAVE').length;
    const totalOtHours = attendances.reduce((acc: number, a: any) => acc + (a.otHours || 0), 0);

    // 2. Earnings calculation
    let basicSalary = employee.basicSalary;
    if (employee.employmentType === 'DAILY_WAGE' && employee.dailyRate > 0) {
      basicSalary = employee.dailyRate * workedDays;
    }

    const otAmount = totalOtHours * (employee.otHourlyRate || 0);
    const allowances = employee.allowances || 0;

    // 3. Sales Rep Commission Cross-Wiring
    let salesCommission = 0;
    let monthlySalesTotal = 0;
    if (employee.commissionRate > 0 && (employee.lorryId || employee.userId)) {
      const orderWhere: any = {
        status: { not: 'CANCELLED' },
        createdAt: { gte: startOfMonth, lte: endOfMonth }
      };
      if (employee.lorryId) {
        orderWhere.lorryId = employee.lorryId;
      }

      const deliveredOrders = await prisma.order.findMany({
        where: orderWhere,
        select: { netTotal: true }
      });

      monthlySalesTotal = deliveredOrders.reduce((acc: number, o: any) => acc + o.netTotal, 0);
      salesCommission = Math.round((monthlySalesTotal * employee.commissionRate) / 100);
    }

    const grossEarnings = basicSalary + otAmount + allowances + salesCommission;

    // 4. Pending Salary Advances to deduct
    const pendingAdvances = await prisma.salaryAdvance.findMany({
      where: {
        employeeId,
        status: 'PENDING',
        date: { lte: endOfMonth }
      }
    });
    const advancesDeducted = pendingAdvances.reduce((acc: number, adv: any) => acc + adv.amount, 0);

    // 5. Statutory EPF / ETF (Sri Lankan standard)
    // Employee EPF: 8% of Basic
    // Employer EPF: 12% of Basic
    // Employer ETF: 3% of Basic
    const epfDeduction = employee.employmentType === 'FULL_TIME' ? Math.round(basicSalary * 0.08) : 0;
    const employerEpf = employee.employmentType === 'FULL_TIME' ? Math.round(basicSalary * 0.12) : 0;
    const employerEtf = employee.employmentType === 'FULL_TIME' ? Math.round(basicSalary * 0.03) : 0;

    const totalDeductions = advancesDeducted + epfDeduction;
    const netPayable = Math.max(0, grossEarnings - totalDeductions);

    res.json({
      employee,
      period: { month, year },
      workedDays,
      absentDays,
      leaveDays,
      otHours: totalOtHours,
      basicSalary,
      otAmount,
      allowances,
      monthlySalesTotal,
      commissionRate: employee.commissionRate,
      salesCommission,
      grossEarnings,
      advancesDeducted,
      pendingAdvances,
      epfDeduction,
      employerEpf,
      employerEtf,
      otherDeductions: 0,
      totalDeductions,
      netPayable
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/hr/payroll/generate', async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      month,
      year,
      workedDays,
      absentDays,
      leaveDays,
      otHours,
      basicSalary,
      otAmount,
      allowances,
      salesCommission,
      performanceBonus,
      otherDeductions,
      paymentMethod = 'CASH',
      paymentStatus = 'PAID',
      notes,
      syncToExpense = true
    } = req.body;

    if (!employeeId || !month || !year) {
      return res.status(400).json({ error: 'Employee, month, and year are required.' });
    }

    const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });

    // Check if payroll already exists for this employee for this month/year
    const existing = await prisma.payroll.findFirst({
      where: { employeeId, month: parseInt(month, 10), year: parseInt(year, 10) }
    });
    if (existing) {
      return res.status(400).json({ error: `Payslip already generated for ${employee.fullName} for ${month}/${year} (${existing.payslipNumber}).` });
    }

    const parsedMonth = parseInt(month, 10);
    const parsedYear = parseInt(year, 10);
    const endOfMonth = new Date(parsedYear, parsedMonth, 0, 23, 59, 59, 999);

    const bSalary = parseFloat(basicSalary) || employee.basicSalary;
    const ot = parseFloat(otAmount) || 0;
    const allow = parseFloat(allowances) || 0;
    const comm = parseFloat(salesCommission) || 0;
    const bonus = parseFloat(performanceBonus) || 0;
    const otherDed = parseFloat(otherDeductions) || 0;

    const grossEarnings = bSalary + ot + allow + comm + bonus;

    // Find and deduct unsettled advances
    const pendingAdvances = await prisma.salaryAdvance.findMany({
      where: {
        employeeId,
        status: 'PENDING',
        date: { lte: endOfMonth }
      }
    });
    const advancesDeducted = pendingAdvances.reduce((acc: number, a: any) => acc + a.amount, 0);

    const epfDeduction = employee.employmentType === 'FULL_TIME' ? Math.round(bSalary * 0.08) : 0;
    const employerEpf = employee.employmentType === 'FULL_TIME' ? Math.round(bSalary * 0.12) : 0;
    const employerEtf = employee.employmentType === 'FULL_TIME' ? Math.round(bSalary * 0.03) : 0;

    const totalDeductions = advancesDeducted + epfDeduction + otherDed;
    const netPayable = Math.max(0, grossEarnings - totalDeductions);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countTotal = await prisma.payroll.count();
    const payslipNumber = `PAY-${parsedYear}${parsedMonth.toString().padStart(2, '0')}-${(countTotal + 1).toString().padStart(4, '0')}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payroll record
      const payroll = await tx.payroll.create({
        data: {
          payslipNumber,
          employeeId,
          month: parsedMonth,
          year: parsedYear,
          workedDays: parseInt(workedDays, 10) || 0,
          absentDays: parseInt(absentDays, 10) || 0,
          leaveDays: parseInt(leaveDays, 10) || 0,
          otHours: parseFloat(otHours) || 0.0,
          basicSalary: bSalary,
          otAmount: ot,
          allowances: allow,
          salesCommission: comm,
          performanceBonus: bonus,
          grossEarnings,
          advancesDeducted,
          epfDeduction,
          employerEpf,
          employerEtf,
          otherDeductions: otherDed,
          totalDeductions,
          netPayable,
          paymentStatus,
          paymentMethod,
          paidAt: paymentStatus === 'PAID' ? new Date() : null,
          notes: notes?.trim() || null
        },
        include: { employee: true }
      });

      // 2. Mark pending advances as DEDUCTED and link to this payroll
      if (pendingAdvances.length > 0) {
        await tx.salaryAdvance.updateMany({
          where: { id: { in: pendingAdvances.map((a: any) => a.id) } },
          data: {
            status: 'DEDUCTED',
            payrollId: payroll.id
          }
        });
      }

      // 3. WIRED TO WHOLE APP: Auto-create business Expense if PAID
      if (paymentStatus === 'PAID' && syncToExpense && netPayable > 0) {
        const countTodayExp = await tx.expense.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        });
        const expenseNumber = `EXP-${dateStr}-${(countTodayExp + 1).toString().padStart(4, '0')}`;

        const createdExpense = await tx.expense.create({
          data: {
            expenseNumber,
            category: 'SALARIES',
            title: `Salary: ${employee.fullName} (${parsedMonth}/${parsedYear})`,
            amount: netPayable,
            date: new Date(),
            paymentMethod,
            referenceNumber: payslipNumber,
            paidTo: employee.fullName,
            notes: `Monthly payroll ${payslipNumber} for ${employee.designation} ${employee.fullName}. Basic: ${bSalary}, Net: ${netPayable}`,
            lorryId: employee.lorryId || null
          }
        });

        await tx.payroll.update({
          where: { id: payroll.id },
          data: { expenseId: createdExpense.id }
        });
      }

      return payroll;
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/hr/payroll/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payroll = await prisma.payroll.findUniqueOrThrow({
      where: { id },
      include: {
        employee: true,
        salaryAdvances: true
      }
    });
    res.json(payroll);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

app.put('/api/hr/payroll/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod } = req.body;

    const existing = await prisma.payroll.findUniqueOrThrow({
      where: { id },
      include: { employee: true }
    });

    const updated = await prisma.$transaction(async (tx) => {
      const payroll = await tx.payroll.update({
        where: { id },
        data: {
          paymentStatus: status,
          paymentMethod: paymentMethod || existing.paymentMethod,
          paidAt: status === 'PAID' ? new Date() : existing.paidAt
        },
        include: { employee: true }
      });

      // If transitioning to PAID and no expense exists yet, create OPEX record
      if (status === 'PAID' && !existing.expenseId && existing.netPayable > 0) {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const countTodayExp = await tx.expense.count({
          where: {
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
          }
        });
        const expenseNumber = `EXP-${dateStr}-${(countTodayExp + 1).toString().padStart(4, '0')}`;

        const createdExpense = await tx.expense.create({
          data: {
            expenseNumber,
            category: 'SALARIES',
            title: `Salary: ${existing.employee.fullName} (${existing.month}/${existing.year})`,
            amount: existing.netPayable,
            date: new Date(),
            paymentMethod: paymentMethod || existing.paymentMethod || 'CASH',
            referenceNumber: existing.payslipNumber,
            paidTo: existing.employee.fullName,
            notes: `Payslip ${existing.payslipNumber} settled.`,
            lorryId: existing.employee.lorryId || null
          }
        });

        await tx.payroll.update({
          where: { id },
          data: { expenseId: createdExpense.id }
        });
      }

      return payroll;
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/hr/payroll/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payroll = await prisma.payroll.findUniqueOrThrow({ where: { id } });

    await prisma.$transaction(async (tx) => {
      // Revert attached salary advances back to PENDING so they can be re-deducted
      await tx.salaryAdvance.updateMany({
        where: { payrollId: id },
        data: {
          status: 'PENDING',
          payrollId: null
        }
      });

      // Remove auto-created expense if exists
      if (payroll.expenseId) {
        await tx.expense.deleteMany({ where: { id: payroll.expenseId } });
      }
      await tx.expense.deleteMany({ where: { referenceNumber: payroll.payslipNumber } });

      await tx.payroll.delete({ where: { id } });
    });

    res.json({ message: `Payslip ${payroll.payslipNumber} deleted. Attached salary advances unlinked back to PENDING.` });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 12.5 HR DASHBOARD SUMMARY
app.get('/api/hr/summary', async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [employees, todayAttendances, pendingAdvances, monthPayrolls] = await Promise.all([
      prisma.employee.findMany(),
      prisma.attendance.findMany({
        where: { date: { gte: today, lt: tomorrow } }
      }),
      prisma.salaryAdvance.findMany({
        where: { status: 'PENDING' }
      }),
      prisma.payroll.findMany({
        where: { month: currentMonth, year: currentYear }
      })
    ]);

    const activeEmployees = employees.filter((e: any) => e.status === 'ACTIVE');
    const todayPresentCount = todayAttendances.filter((a: any) => a.status === 'PRESENT').length;
    const todayAbsentCount = todayAttendances.filter((a: any) => a.status === 'ABSENT').length;
    const pendingAdvancesTotal = pendingAdvances.reduce((acc: number, a: any) => acc + a.amount, 0);
    const currentMonthPayrollTotal = monthPayrolls.reduce((acc: number, p: any) => acc + p.netPayable, 0);

    const departmentCounts: Record<string, number> = {};
    for (const e of activeEmployees) {
      departmentCounts[e.department] = (departmentCounts[e.department] || 0) + 1;
    }

    res.json({
      totalEmployees: employees.length,
      activeEmployees: activeEmployees.length,
      todayPresentCount,
      todayAbsentCount,
      pendingAdvancesTotal,
      currentMonthPayrollTotal,
      departmentCounts
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', (_req: Request, res: Response) => {
  res.json(getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  try {
    const current = getSettings();
    const updated = { ...current, ...req.body };
    saveSettings(updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ========================================================
// SERVE PRODUCTION FRONTEND (RAILWAY / WEB HOSTING)
// ========================================================
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  console.log(`[Express] Serving static web bundle from ${distPath}`);
  app.use(express.static(distPath));

  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

async function seedIfEmpty() {
  try {
    // Only ensure a default Administrator exists if no users exist in the database
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[System Init] Clean database detected. Creating initial administrator account...');
      await prisma.user.create({
        data: {
          username: 'admin',
          password: 'admin123',
          fullName: 'Administrator',
          role: 'ADMIN'
        }
      });
      console.log('[System Init] Default admin user initialized: admin / admin123');
    }
  } catch (err) {
    console.error('[System Init] User init check skipped:', err);
  }
}

app.listen(Number(PORT), HOST, async () => {
  console.log(`[Express Backend] Distributor Server active on http://${HOST}:${PORT}`);
  await seedIfEmpty();
  await syncFleetAndRepsToEmployees();
});
