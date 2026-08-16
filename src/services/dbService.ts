import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch, 
  runTransaction,
  serverTimestamp,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  MenuItem, 
  Ingredient, 
  Order, 
  CartItem, 
  PosShift, 
  InventoryMovement, 
  Expense, 
  Purchase, 
  Investor, 
  InvestorPayment, 
  Employee, 
  PayrollRun, 
  AuditLog, 
  Branch, 
  AppSettings,
  UserProfile,
  SplitPayment
} from '../types';

export const COLLECTIONS = {
  USERS: 'users',
  BRANCHES: 'branches',
  MENU_ITEMS: 'menuItems',
  INGREDIENTS: 'ingredients',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  ORDERS: 'orders',
  POS_SHIFTS: 'posShifts',
  SUPPLIERS: 'suppliers',
  PURCHASES: 'purchases',
  EXPENSES: 'expenses',
  INVESTORS: 'investors',
  INVESTOR_PAYMENTS: 'investorPayments',
  DIVIDENDS: 'investorPayments',
  EMPLOYEES: 'employees',
  PAYROLL: 'payroll',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications'
};

// Format currency helper (Ghanaian Cedi)
export const formatGHS = (amount: number): string => {
  return `GHS ${Number(amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Generate human readable unique receipt number
export const generateReceiptNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TF-${year}${month}${day}-${randomSuffix}`;
};

// Record Audit Log
export const logAuditEvent = async (
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  category: AuditLog['category'],
  details: string,
  relatedRecordId?: string,
  oldValue?: string,
  newValue?: string,
  branchId?: string
) => {
  try {
    const auditRef = collection(db, COLLECTIONS.AUDIT_LOGS);
    await addDoc(auditRef, {
      userId,
      userName,
      userRole,
      action,
      category,
      details,
      relatedRecordId: relatedRecordId || '',
      oldValue: oldValue || '',
      newValue: newValue || '',
      branchId: branchId || 'main',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
};

/**
 * ATOMIC POS SALE EXECUTION:
 * 1. Creates Order doc in Firestore
 * 2. Deducts ingredient quantities atomically per item recipe * quantity
 * 3. Creates inventoryMovement records for each ingredient deducted
 * 4. Updates POS shift cash total if Cash was part of payment
 * 5. Emits Audit Log
 */
export const processPosSale = async (params: {
  orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>;
  user: UserProfile;
  activeShift?: PosShift | null;
}): Promise<{ success: boolean; orderId: string; receiptNumber: string; error?: string }> => {
  const { orderData, user, activeShift } = params;

  try {
    const batch = writeBatch(db);
    const orderRef = doc(collection(db, COLLECTIONS.ORDERS));
    const nowIso = new Date().toISOString();

    const finalOrder: Order = {
      ...orderData,
      id: orderRef.id,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: orderData.status === 'Completed' ? nowIso : undefined
    };

    // 1. Set the order document
    batch.set(orderRef, finalOrder);

    // 2. Aggregate ingredient deductions across all cart items
    const ingredientDeductionMap = new Map<string, {
      ingredientName: string;
      totalDeduct: number;
      unit: string;
      unitCost: number;
    }>();

    for (const item of orderData.items) {
      if (item.recipeSnapshot && item.recipeSnapshot.length > 0) {
        for (const ing of item.recipeSnapshot) {
          const requiredQty = ing.quantity * item.quantity;
          const existing = ingredientDeductionMap.get(ing.ingredientId);
          if (existing) {
            existing.totalDeduct += requiredQty;
          } else {
            ingredientDeductionMap.set(ing.ingredientId, {
              ingredientName: ing.ingredientName,
              totalDeduct: requiredQty,
              unit: ing.unit,
              unitCost: ing.costPerUnit
            });
          }
        }
      }
    }

    // Read current ingredient docs to deduct properly
    for (const [ingredientId, deductInfo] of ingredientDeductionMap.entries()) {
      const ingDocRef = doc(db, COLLECTIONS.INGREDIENTS, ingredientId);
      const ingSnap = await getDoc(ingDocRef);

      if (ingSnap.exists()) {
        const currentData = ingSnap.data() as Ingredient;
        const previousQty = currentData.currentQuantity || 0;
        const newQty = Math.max(0, previousQty - deductInfo.totalDeduct);

        // Update ingredient quantity
        batch.update(ingDocRef, {
          currentQuantity: newQty,
          lastUpdated: nowIso
        });

        // Add inventory movement document
        const movementRef = doc(collection(db, COLLECTIONS.INVENTORY_MOVEMENTS));
        const movementDoc: InventoryMovement = {
          id: movementRef.id,
          ingredientId,
          ingredientName: deductInfo.ingredientName,
          type: 'Sale/Consumption',
          quantityChange: -deductInfo.totalDeduct,
          previousQuantity: previousQty,
          newQuantity: newQty,
          unit: deductInfo.unit,
          unitCost: deductInfo.unitCost,
          totalCost: deductInfo.totalDeduct * deductInfo.unitCost,
          orderId: orderRef.id,
          recordedBy: user.uid,
          recordedByName: user.displayName || 'Cashier',
          branchId: orderData.branchId,
          timestamp: nowIso,
          reason: `POS Sale Receipt: ${orderData.receiptNumber}`
        };
        batch.set(movementRef, movementDoc);
      }
    }

    // 3. Update Active Shift Cash if Cash was tendered
    if (activeShift && activeShift.id) {
      const cashTendered = orderData.paymentMethods
        .filter(pm => pm.method === 'Cash')
        .reduce((sum, pm) => sum + (pm.amount || 0), 0);

      if (cashTendered > 0) {
        const shiftDocRef = doc(db, COLLECTIONS.POS_SHIFTS, activeShift.id);
        const newCashSales = (activeShift.cashSales || 0) + cashTendered;
        const newExpectedCash = (activeShift.openingCash || 0) + newCashSales - (activeShift.cashRefunds || 0) - (activeShift.cashExpenses || 0);
        
        batch.update(shiftDocRef, {
          cashSales: newCashSales,
          expectedCash: newExpectedCash,
          totalOrdersCount: (activeShift.totalOrdersCount || 0) + 1
        });
      }
    }

    // Commit atomic batch
    await batch.commit();

    // Log audit event
    await logAuditEvent(
      user.uid,
      user.displayName || 'Cashier',
      user.role,
      'POS Sale Completed',
      'SALE',
      `Order ${orderData.receiptNumber} completed. Total: ${formatGHS(orderData.total)}. Items: ${orderData.items.length}. Type: ${orderData.orderType}`,
      orderRef.id,
      '',
      JSON.stringify({ total: orderData.total, itemsCount: orderData.items.length }),
      orderData.branchId
    );

    return {
      success: true,
      orderId: orderRef.id,
      receiptNumber: orderData.receiptNumber
    };
  } catch (error: any) {
    console.error('Error processing POS Sale:', error);
    return {
      success: false,
      orderId: '',
      receiptNumber: '',
      error: error.message || 'Failed to complete POS sale transaction.'
    };
  }
};

/**
 * DEFAULT SEED DATA GENERATOR FOR TAMALE FOOD
 * Populates real Ghanaian menu items, recipes, ingredients, branches, suppliers, employees, settings
 */
export const seedInitialTamaleFoodData = async (user?: Partial<UserProfile>) => {
  const batch = writeBatch(db);
  const nowIso = new Date().toISOString();
  const activeUser = {
    uid: user?.uid || 'sys-admin',
    displayName: user?.displayName || 'System Admin',
    role: user?.role || 'Owner/Admin' as const
  };

  // 1. Settings
  const settingsRef = doc(db, COLLECTIONS.SETTINGS, 'general');
  const initialSettings: AppSettings = {
    businessName: 'Tamale Food',
    tagline: 'The Taste of the North',
    currency: 'GHS',
    currencySymbol: '₵',
    taxRate: 0,
    receiptFooter: 'Thank you for dining with Tamale Food! The Taste of the North.',
    contactPhone: '+233 24 000 1234',
    contactEmail: 'contact@tamalefood.com',
    address: 'Central Market Road, Tamale, Northern Region, Ghana',
    momoPayNumber: '0240001234 (Tamale Food Ventures)',
    lowStockThresholdPercent: 20
  };
  batch.set(settingsRef, initialSettings);

  // 2. Branches
  const branches: Branch[] = [
    {
      id: 'tamale-central',
      name: 'Tamale Main Branch - Central Market',
      code: 'TF-CTR',
      address: 'Central Market Road, Tamale',
      phone: '+233 24 111 2233',
      active: true
    },
    {
      id: 'tamale-airport',
      name: 'Tamale Airport Road Branch',
      code: 'TF-AIR',
      address: 'Airport Residential, Tamale',
      phone: '+233 24 444 5566',
      active: true
    },
    {
      id: 'tamale-lamashegu',
      name: 'Tamale Lamashegu Branch',
      code: 'TF-LAM',
      address: 'Near Lamashegu Market, Tamale',
      phone: '+233 24 777 8899',
      active: true
    }
  ];

  for (const branch of branches) {
    const bRef = doc(db, COLLECTIONS.BRANCHES, branch.id);
    batch.set(bRef, branch);
  }

  // 3. Suppliers
  const suppliers = [
    {
      id: 'sup-northerngrains',
      businessName: 'Savannah Grains & Rice Millers Ltd',
      contactPerson: 'Alhaji Haruna Yakubu',
      phone: '+233 24 333 4455',
      email: 'savannahgrains@tamale.gh',
      address: 'Aboabo Commercial Area, Tamale',
      productsSupplied: ['Local Perfumed Rice', 'Jollof Rice', 'Beans'],
      createdAt: nowIso
    },
    {
      id: 'sup-poultry',
      businessName: 'Dagbon Fresh Poultry & Meat Supply',
      contactPerson: 'Madam Amina Seidu',
      phone: '+233 24 666 7788',
      email: 'dagbonpoultry@gmail.com',
      address: 'Kukuo, Tamale',
      productsSupplied: ['Fresh Whole Chicken', 'Goat Meat', 'Gizzard', 'Beef Cuts'],
      createdAt: nowIso
    },
    {
      id: 'sup-veggies',
      businessName: 'Vea Farmers Fresh Produce',
      contactPerson: 'Kwame Adjei',
      phone: '+233 24 999 0011',
      email: 'veafarmers@yahoo.com',
      address: 'Tamale Central Veggie Hub',
      productsSupplied: ['Tomatoes', 'Onions', 'Green Pepper', 'Carrots', 'Cabbage'],
      createdAt: nowIso
    },
    {
      id: 'sup-pack',
      businessName: 'Northern Packaging & Disposables',
      contactPerson: 'Ibrahim Zakaria',
      phone: '+233 20 123 9876',
      email: 'northpack@gmail.com',
      address: 'Industrial Area, Tamale',
      productsSupplied: ['Takeaway Packs', 'Foil Bowls', 'Disposable Spoons', 'Carrier Bags'],
      createdAt: nowIso
    }
  ];

  for (const s of suppliers) {
    const sRef = doc(db, COLLECTIONS.SUPPLIERS, s.id);
    batch.set(sRef, s);
  }

  // 4. Ingredients & Raw Stock
  const ingredients: Ingredient[] = [
    {
      id: 'ing-rice',
      name: 'Perfumed Jasmine Rice',
      category: 'Grains',
      unit: 'g',
      currentQuantity: 75000, // 75 kg in grams
      minQuantity: 15000,
      maxQuantity: 200000,
      costPerUnit: 0.024, // GHS 24 per 1kg = 0.024 / g
      supplierId: 'sup-northerngrains',
      supplierName: 'Savannah Grains & Rice Millers Ltd',
      storageLocation: 'Dry Pantry Shelf A',
      lastUpdated: nowIso
    },
    {
      id: 'ing-oil',
      name: 'Pure Vegetable Cooking Oil',
      category: 'Oils & Fats',
      unit: 'ml',
      currentQuantity: 50000, // 50 Liters
      minQuantity: 10000,
      maxQuantity: 100000,
      costPerUnit: 0.035, // GHS 35 per Liter = 0.035 / ml
      supplierId: 'sup-veggies',
      supplierName: 'Vea Farmers Fresh Produce',
      storageLocation: 'Oil Store Rack',
      lastUpdated: nowIso
    },
    {
      id: 'ing-chicken',
      name: 'Seasoned Grilled Chicken Portion',
      category: 'Meats & Poultry',
      unit: 'portion',
      currentQuantity: 180,
      minQuantity: 30,
      maxQuantity: 400,
      costPerUnit: 12.50, // GHS 12.50 per portion
      supplierId: 'sup-poultry',
      supplierName: 'Dagbon Fresh Poultry & Meat Supply',
      storageLocation: 'Deep Freezer 1',
      lastUpdated: nowIso
    },
    {
      id: 'ing-goat',
      name: 'Spiced Peppered Goat Meat Cut',
      category: 'Meats & Poultry',
      unit: 'portion',
      currentQuantity: 120,
      minQuantity: 25,
      maxQuantity: 300,
      costPerUnit: 18.00, // GHS 18.00 per portion
      supplierId: 'sup-poultry',
      supplierName: 'Dagbon Fresh Poultry & Meat Supply',
      storageLocation: 'Deep Freezer 2',
      lastUpdated: nowIso
    },
    {
      id: 'ing-yam',
      name: 'Northern Pona Yam Slices',
      category: 'Vegetables',
      unit: 'portion',
      currentQuantity: 150,
      minQuantity: 30,
      maxQuantity: 350,
      costPerUnit: 5.00,
      supplierId: 'sup-northerngrains',
      supplierName: 'Savannah Grains & Rice Millers Ltd',
      storageLocation: 'Yam Basket Area',
      lastUpdated: nowIso
    },
    {
      id: 'ing-noodles',
      name: 'Spiced Stir-fry Noodles Base',
      category: 'Grains',
      unit: 'pack',
      currentQuantity: 200,
      minQuantity: 40,
      maxQuantity: 500,
      costPerUnit: 4.20,
      storageLocation: 'Dry Pantry Shelf B',
      lastUpdated: nowIso
    },
    {
      id: 'ing-veggies-mix',
      name: 'Fresh Stir-fry Veggies (Carrots, Peas, Green Bell)',
      category: 'Vegetables',
      unit: 'g',
      currentQuantity: 30000,
      minQuantity: 5000,
      maxQuantity: 60000,
      costPerUnit: 0.020, // 20 GHS per kg = 0.02 / g
      supplierId: 'sup-veggies',
      supplierName: 'Vea Farmers Fresh Produce',
      storageLocation: 'Walk-in Chiller',
      lastUpdated: nowIso
    },
    {
      id: 'ing-tamale-spices',
      name: 'Northern Suya & Shito Seasoning Blend',
      category: 'Spices & Seasoning',
      unit: 'g',
      currentQuantity: 15000,
      minQuantity: 2000,
      maxQuantity: 40000,
      costPerUnit: 0.040,
      storageLocation: 'Spices Cabinet',
      lastUpdated: nowIso
    },
    {
      id: 'ing-pack-takeaway',
      name: 'Eco Heat-Resistant Takeaway Pack + Spoon',
      category: 'Packaging',
      unit: 'pcs',
      currentQuantity: 650,
      minQuantity: 100,
      maxQuantity: 2000,
      costPerUnit: 1.80,
      supplierId: 'sup-pack',
      supplierName: 'Northern Packaging & Disposables',
      storageLocation: 'Packaging Store Shelf 1',
      lastUpdated: nowIso
    },
    {
      id: 'ing-drink-sobolo',
      name: 'Chilled Artisanal Sobolo Infusion Bottle',
      category: 'Beverages',
      unit: 'bottle',
      currentQuantity: 95,
      minQuantity: 20,
      maxQuantity: 300,
      costPerUnit: 4.50,
      storageLocation: 'Beverage Fridge A',
      lastUpdated: nowIso
    },
    {
      id: 'ing-drink-ginger',
      name: 'Fresh Ginger-Pineapple Juice Bottle',
      category: 'Beverages',
      unit: 'bottle',
      currentQuantity: 80,
      minQuantity: 20,
      maxQuantity: 250,
      costPerUnit: 5.00,
      storageLocation: 'Beverage Fridge B',
      lastUpdated: nowIso
    },
    {
      id: 'ing-drink-water',
      name: 'Mineral Water 500ml',
      category: 'Beverages',
      unit: 'bottle',
      currentQuantity: 240,
      minQuantity: 48,
      maxQuantity: 600,
      costPerUnit: 2.00,
      storageLocation: 'Drink Crate Stack',
      lastUpdated: nowIso
    }
  ];

  for (const ing of ingredients) {
    const ingRef = doc(db, COLLECTIONS.INGREDIENTS, ing.id);
    batch.set(ingRef, ing);
  }

  // 5. Menu Items with Exact Recipe Ingredients
  const menuItems: MenuItem[] = [
    {
      id: 'menu-fried-rice-chicken',
      name: 'Tamale Fried Rice + Spicy Grilled Chicken',
      category: 'Fried Rice',
      sellingPrice: 55.00,
      description: 'Signature fragrant rice stir-fried with farm fresh veggies, served with tender Tamale seasoned grilled chicken and spicy Northern shito.',
      available: true,
      image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
      packagingCost: 1.80,
      laborCost: 2.50,
      recipe: [
        { ingredientId: 'ing-rice', ingredientName: 'Perfumed Jasmine Rice', quantity: 250, unit: 'g', costPerUnit: 0.024, subtotalCost: 6.00 },
        { ingredientId: 'ing-oil', ingredientName: 'Pure Vegetable Cooking Oil', quantity: 35, unit: 'ml', costPerUnit: 0.035, subtotalCost: 1.23 },
        { ingredientId: 'ing-veggies-mix', ingredientName: 'Fresh Stir-fry Veggies', quantity: 90, unit: 'g', costPerUnit: 0.020, subtotalCost: 1.80 },
        { ingredientId: 'ing-tamale-spices', ingredientName: 'Northern Suya & Shito Blend', quantity: 15, unit: 'g', costPerUnit: 0.040, subtotalCost: 0.60 },
        { ingredientId: 'ing-chicken', ingredientName: 'Seasoned Grilled Chicken Portion', quantity: 1, unit: 'portion', costPerUnit: 12.50, subtotalCost: 12.50 },
        { ingredientId: 'ing-pack-takeaway', ingredientName: 'Eco Takeaway Pack + Spoon', quantity: 1, unit: 'pcs', costPerUnit: 1.80, subtotalCost: 1.80 }
      ],
      ingredientCost: 23.93,
      totalProductionCost: 28.23, // 23.93 + 1.80 packaging + 2.50 labor
      grossProfit: 26.77, // 55.00 - 28.23
      profitMargin: 48.67,
      createdAt: nowIso
    },
    {
      id: 'menu-jollof-goat',
      name: 'Northern Smokey Jollof Rice + Peppered Goat Meat',
      category: 'Jollof Rice',
      sellingPrice: 65.00,
      description: 'Rich firewood-infused Ghanaian Jollof rice cooked in seasoned tomato broth, paired with tender peppered goat meat and fried plantain.',
      available: true,
      image: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=600&q=80',
      packagingCost: 1.80,
      laborCost: 3.00,
      recipe: [
        { ingredientId: 'ing-rice', ingredientName: 'Perfumed Jasmine Rice', quantity: 260, unit: 'g', costPerUnit: 0.024, subtotalCost: 6.24 },
        { ingredientId: 'ing-oil', ingredientName: 'Pure Vegetable Cooking Oil', quantity: 40, unit: 'ml', costPerUnit: 0.035, subtotalCost: 1.40 },
        { ingredientId: 'ing-veggies-mix', ingredientName: 'Fresh Stir-fry Veggies', quantity: 80, unit: 'g', costPerUnit: 0.020, subtotalCost: 1.60 },
        { ingredientId: 'ing-tamale-spices', ingredientName: 'Northern Suya & Shito Blend', quantity: 20, unit: 'g', costPerUnit: 0.040, subtotalCost: 0.80 },
        { ingredientId: 'ing-goat', ingredientName: 'Spiced Peppered Goat Meat Cut', quantity: 1, unit: 'portion', costPerUnit: 18.00, subtotalCost: 18.00 },
        { ingredientId: 'ing-pack-takeaway', ingredientName: 'Eco Takeaway Pack + Spoon', quantity: 1, unit: 'pcs', costPerUnit: 1.80, subtotalCost: 1.80 }
      ],
      ingredientCost: 29.84,
      totalProductionCost: 34.64,
      grossProfit: 30.36,
      profitMargin: 46.71,
      createdAt: nowIso
    },
    {
      id: 'menu-yam-fries-chicken',
      name: 'Crispy Northern Yam Fries + Grilled Chicken',
      category: 'Yam Fries',
      sellingPrice: 48.00,
      description: 'Golden crispy deep-fried Pona yam sticks tossed with house herbs and accompanied by juicy grilled chicken and green pepper sauce.',
      available: true,
      image: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=600&q=80',
      packagingCost: 1.80,
      laborCost: 2.00,
      recipe: [
        { ingredientId: 'ing-yam', ingredientName: 'Northern Pona Yam Slices', quantity: 1, unit: 'portion', costPerUnit: 5.00, subtotalCost: 5.00 },
        { ingredientId: 'ing-oil', ingredientName: 'Pure Vegetable Cooking Oil', quantity: 45, unit: 'ml', costPerUnit: 0.035, subtotalCost: 1.58 },
        { ingredientId: 'ing-tamale-spices', ingredientName: 'Northern Suya & Shito Blend', quantity: 15, unit: 'g', costPerUnit: 0.040, subtotalCost: 0.60 },
        { ingredientId: 'ing-chicken', ingredientName: 'Seasoned Grilled Chicken Portion', quantity: 1, unit: 'portion', costPerUnit: 12.50, subtotalCost: 12.50 },
        { ingredientId: 'ing-pack-takeaway', ingredientName: 'Eco Takeaway Pack + Spoon', quantity: 1, unit: 'pcs', costPerUnit: 1.80, subtotalCost: 1.80 }
      ],
      ingredientCost: 21.48,
      totalProductionCost: 25.28,
      grossProfit: 22.72,
      profitMargin: 47.33,
      createdAt: nowIso
    },
    {
      id: 'menu-spicy-noodles',
      name: 'Savannah Spiced Stir-Fry Noodles + Chicken',
      category: 'Noodles',
      sellingPrice: 42.00,
      description: 'Wok-tossed noodles with colorful crunch vegetables, egg, Northern spices, and sliced grilled chicken.',
      available: true,
      image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
      packagingCost: 1.80,
      laborCost: 2.00,
      recipe: [
        { ingredientId: 'ing-noodles', ingredientName: 'Spiced Stir-fry Noodles Base', quantity: 2, unit: 'pack', costPerUnit: 4.20, subtotalCost: 8.40 },
        { ingredientId: 'ing-oil', ingredientName: 'Pure Vegetable Cooking Oil', quantity: 25, unit: 'ml', costPerUnit: 0.035, subtotalCost: 0.88 },
        { ingredientId: 'ing-veggies-mix', ingredientName: 'Fresh Stir-fry Veggies', quantity: 100, unit: 'g', costPerUnit: 0.020, subtotalCost: 2.00 },
        { ingredientId: 'ing-tamale-spices', ingredientName: 'Northern Suya & Shito Blend', quantity: 10, unit: 'g', costPerUnit: 0.040, subtotalCost: 0.40 },
        { ingredientId: 'ing-chicken', ingredientName: 'Seasoned Grilled Chicken Portion', quantity: 0.5, unit: 'portion', costPerUnit: 12.50, subtotalCost: 6.25 },
        { ingredientId: 'ing-pack-takeaway', ingredientName: 'Eco Takeaway Pack + Spoon', quantity: 1, unit: 'pcs', costPerUnit: 1.80, subtotalCost: 1.80 }
      ],
      ingredientCost: 19.73,
      totalProductionCost: 23.53,
      grossProfit: 18.47,
      profitMargin: 43.98,
      createdAt: nowIso
    },
    {
      id: 'menu-portion-goat',
      name: 'Extra Portion Peppered Goat Meat',
      category: 'Goat Meat',
      sellingPrice: 35.00,
      description: 'Succulent cuts of local goat meat boiled in aromatic Northern herbs and tossed in rich red pepper stew.',
      available: true,
      image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
      packagingCost: 1.20,
      laborCost: 2.00,
      recipe: [
        { ingredientId: 'ing-goat', ingredientName: 'Spiced Peppered Goat Meat Cut', quantity: 1, unit: 'portion', costPerUnit: 18.00, subtotalCost: 18.00 },
        { ingredientId: 'ing-tamale-spices', ingredientName: 'Northern Suya & Shito Blend', quantity: 20, unit: 'g', costPerUnit: 0.040, subtotalCost: 0.80 }
      ],
      ingredientCost: 18.80,
      totalProductionCost: 22.00,
      grossProfit: 13.00,
      profitMargin: 37.14,
      createdAt: nowIso
    },
    {
      id: 'menu-sobolo',
      name: 'Artisanal Chilled Sobolo (Hibiscus & Cloves)',
      category: 'Drinks',
      sellingPrice: 12.00,
      description: 'Refreshing traditional hibiscus drink brewed with fresh ginger, cloves, and natural pineapple essence.',
      available: true,
      image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
      packagingCost: 0.50,
      laborCost: 0.50,
      recipe: [
        { ingredientId: 'ing-drink-sobolo', ingredientName: 'Chilled Artisanal Sobolo Bottle', quantity: 1, unit: 'bottle', costPerUnit: 4.50, subtotalCost: 4.50 }
      ],
      ingredientCost: 4.50,
      totalProductionCost: 5.50,
      grossProfit: 6.50,
      profitMargin: 54.17,
      createdAt: nowIso
    },
    {
      id: 'menu-ginger-juice',
      name: 'Fresh Pineapple Ginger Punch (500ml)',
      category: 'Drinks',
      sellingPrice: 15.00,
      description: '100% natural cold-pressed sweet pineapple blended with fiery northern ginger.',
      available: true,
      image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=600&q=80',
      packagingCost: 0.50,
      laborCost: 0.50,
      recipe: [
        { ingredientId: 'ing-drink-ginger', ingredientName: 'Fresh Ginger-Pineapple Juice Bottle', quantity: 1, unit: 'bottle', costPerUnit: 5.00, subtotalCost: 5.00 }
      ],
      ingredientCost: 5.00,
      totalProductionCost: 6.00,
      grossProfit: 9.00,
      profitMargin: 60.00,
      createdAt: nowIso
    },
    {
      id: 'menu-water',
      name: 'Mineral Water (500ml Chilled)',
      category: 'Drinks',
      sellingPrice: 5.00,
      description: 'Pure purified table water.',
      available: true,
      packagingCost: 0,
      laborCost: 0,
      recipe: [
        { ingredientId: 'ing-drink-water', ingredientName: 'Mineral Water 500ml', quantity: 1, unit: 'bottle', costPerUnit: 2.00, subtotalCost: 2.00 }
      ],
      ingredientCost: 2.00,
      totalProductionCost: 2.00,
      grossProfit: 3.00,
      profitMargin: 60.00,
      createdAt: nowIso
    }
  ];

  for (const m of menuItems) {
    const mRef = doc(db, COLLECTIONS.MENU_ITEMS, m.id);
    batch.set(mRef, m);
  }

  // 6. Employees
  const employees: Employee[] = [
    {
      id: 'emp-01',
      fullName: 'Mustapha Iddrisu',
      phone: '+233 24 555 1010',
      email: 'mustapha@tamalefood.gh',
      position: 'Manager',
      employmentDate: '2025-01-15',
      salaryType: 'Monthly',
      monthlySalary: 3800.00,
      dailyWage: 0,
      hourlyWage: 0,
      bankName: 'GCB Bank - Tamale Main',
      accountOrMomoNumber: '7011002345678',
      status: 'Active',
      branchId: 'tamale-central',
      createdAt: nowIso
    },
    {
      id: 'emp-02',
      fullName: 'Salifu Mohammed',
      phone: '+233 24 555 2020',
      position: 'Head Chef',
      employmentDate: '2025-02-01',
      salaryType: 'Monthly',
      monthlySalary: 2900.00,
      dailyWage: 0,
      hourlyWage: 0,
      accountOrMomoNumber: '0245552020 (MTN MoMo)',
      status: 'Active',
      branchId: 'tamale-central',
      createdAt: nowIso
    },
    {
      id: 'emp-03',
      fullName: 'Fatima Zuleiha',
      phone: '+233 20 555 3030',
      position: 'Cashier',
      employmentDate: '2025-03-10',
      salaryType: 'Monthly',
      monthlySalary: 1800.00,
      dailyWage: 0,
      hourlyWage: 0,
      accountOrMomoNumber: '0205553030 (Telecel Cash)',
      status: 'Active',
      branchId: 'tamale-central',
      createdAt: nowIso
    },
    {
      id: 'emp-04',
      fullName: 'Rashid Tanko',
      phone: '+233 24 555 4040',
      position: 'Delivery Rider',
      employmentDate: '2025-04-01',
      salaryType: 'Daily',
      monthlySalary: 0,
      dailyWage: 65.00,
      hourlyWage: 0,
      accountOrMomoNumber: '0245554040 (MTN MoMo)',
      status: 'Active',
      branchId: 'tamale-central',
      createdAt: nowIso
    },
    {
      id: 'emp-05',
      fullName: 'Mariam Alhassan',
      phone: '+233 24 555 5050',
      position: 'Cook',
      employmentDate: '2025-04-15',
      salaryType: 'Monthly',
      monthlySalary: 2100.00,
      dailyWage: 0,
      hourlyWage: 0,
      accountOrMomoNumber: '0245555050 (MTN MoMo)',
      status: 'Active',
      branchId: 'tamale-central',
      createdAt: nowIso
    }
  ];

  for (const emp of employees) {
    const empRef = doc(db, COLLECTIONS.EMPLOYEES, emp.id);
    batch.set(empRef, emp);
  }

  // 7. Investors
  const investors: Investor[] = [
    {
      id: 'inv-01',
      fullName: 'Dr. Abdul-Rahman Yakubu',
      phone: '+233 24 888 9900',
      email: 'investor.yakubu@tamaleinvest.org',
      investmentAmount: 150000.00,
      equityPercentage: 20.0,
      investmentDate: '2024-11-01',
      agreementDocumentUrl: '',
      status: 'Active',
      totalPaid: 24500.00,
      outstandingAmount: 5500.00,
      notes: 'Seed expansion partner for Tamale Central and Airport Branches.'
    },
    {
      id: 'inv-02',
      fullName: 'Hajia Aisha Bawa',
      phone: '+233 24 777 6655',
      email: 'aisha.bawa@savannahholdings.com',
      investmentAmount: 85000.00,
      equityPercentage: 12.5,
      investmentDate: '2025-03-01',
      status: 'Active',
      totalPaid: 11200.00,
      outstandingAmount: 2800.00,
      notes: 'Growth capital investment for central kitchen equipment.'
    }
  ];

  for (const inv of investors) {
    const invRef = doc(db, COLLECTIONS.INVESTORS, inv.id);
    batch.set(invRef, inv);
  }

  // 8. Sample Purchases & Invoices
  const samplePurchase: Purchase = {
    id: 'pur-20260810-01',
    supplierId: 'sup-northerngrains',
    supplierName: 'Savannah Grains & Rice Millers Ltd',
    invoiceNumber: 'INV-SGR-2026-891',
    date: '2026-08-10',
    items: [
      { ingredientId: 'ing-rice', ingredientName: 'Perfumed Jasmine Rice', quantity: 50000, unit: 'g', unitCost: 0.024, totalCost: 1200.00 }
    ],
    totalCost: 1200.00,
    paymentStatus: 'Paid',
    paymentMethod: 'Bank/Card',
    recordedBy: activeUser.uid,
    recordedByName: activeUser.displayName || 'Manager',
    branchId: 'tamale-central',
    createdAt: nowIso
  };
  const purRef = doc(db, COLLECTIONS.PURCHASES, samplePurchase.id);
  batch.set(purRef, samplePurchase);

  // 9. Sample Operating Expenses
  const sampleExpenses: Expense[] = [
    {
      id: 'exp-01',
      amount: 450.00,
      category: 'Electricity',
      description: 'NEDCo Commercial Power Pre-paid Token Top-up',
      date: '2026-08-12',
      paymentMethod: 'MTN Mobile Money',
      recordedBy: activeUser.uid,
      recordedByName: activeUser.displayName || 'Manager',
      approvalStatus: 'Approved',
      approvedBy: activeUser.displayName,
      branchId: 'tamale-central',
      createdAt: nowIso
    },
    {
      id: 'exp-02',
      amount: 320.00,
      category: 'Gas',
      description: 'Two 50kg LPG Gas Cylinders Refill for Commercial Burners',
      date: '2026-08-14',
      paymentMethod: 'Cash',
      recordedBy: activeUser.uid,
      recordedByName: activeUser.displayName || 'Manager',
      approvalStatus: 'Approved',
      approvedBy: activeUser.displayName,
      branchId: 'tamale-central',
      createdAt: nowIso
    },
    {
      id: 'exp-03',
      amount: 150.00,
      category: 'Water',
      description: 'Ghana Water Company utility billing monthly settlement',
      date: '2026-08-15',
      paymentMethod: 'Telecel Cash',
      recordedBy: activeUser.uid,
      recordedByName: activeUser.displayName || 'Manager',
      approvalStatus: 'Approved',
      approvedBy: activeUser.displayName,
      branchId: 'tamale-central',
      createdAt: nowIso
    }
  ];

  for (const exp of sampleExpenses) {
    const expRef = doc(db, COLLECTIONS.EXPENSES, exp.id);
    batch.set(expRef, exp);
  }

  // 10. Sample Completed Orders to Populate Dashboard with authentic data
  const sampleOrders: Order[] = [
    {
      id: 'ord-demo-01',
      receiptNumber: 'TF-20260816-1001',
      branchId: 'tamale-central',
      cashierId: activeUser.uid,
      cashierName: 'Fatima Zuleiha',
      customerName: 'Kofi Mensah',
      customerPhone: '0241234567',
      orderType: 'Dine-in',
      status: 'Completed',
      items: [
        {
          menuItemId: 'menu-fried-rice-chicken',
          name: 'Tamale Fried Rice + Spicy Grilled Chicken',
          unitPrice: 55.00,
          quantity: 2,
          discount: 0,
          category: 'Fried Rice',
          recipeSnapshot: menuItems[0].recipe,
          productionCost: 28.23,
          subtotal: 110.00
        },
        {
          menuItemId: 'menu-sobolo',
          name: 'Artisanal Chilled Sobolo',
          unitPrice: 12.00,
          quantity: 2,
          discount: 0,
          category: 'Drinks',
          recipeSnapshot: menuItems[5].recipe,
          productionCost: 5.50,
          subtotal: 24.00
        }
      ],
      subtotal: 134.00,
      discount: 0,
      deliveryFee: 0,
      total: 134.00,
      totalProductionCost: 67.46,
      grossProfit: 66.54,
      paymentStatus: 'Paid',
      paymentMethods: [
        { method: 'Cash', amount: 134.00 }
      ],
      amountReceived: 140.00,
      changeGiven: 6.00,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'ord-demo-02',
      receiptNumber: 'TF-20260816-1002',
      branchId: 'tamale-central',
      cashierId: activeUser.uid,
      cashierName: 'Fatima Zuleiha',
      customerName: 'Amina Salifu',
      customerPhone: '0209876543',
      orderType: 'Delivery',
      status: 'Completed',
      items: [
        {
          menuItemId: 'menu-jollof-goat',
          name: 'Northern Smokey Jollof Rice + Peppered Goat Meat',
          unitPrice: 65.00,
          quantity: 1,
          discount: 0,
          category: 'Jollof Rice',
          recipeSnapshot: menuItems[1].recipe,
          productionCost: 34.64,
          subtotal: 65.00
        },
        {
          menuItemId: 'menu-ginger-juice',
          name: 'Fresh Pineapple Ginger Punch (500ml)',
          unitPrice: 15.00,
          quantity: 1,
          discount: 0,
          category: 'Drinks',
          recipeSnapshot: menuItems[6].recipe,
          productionCost: 6.00,
          subtotal: 15.00
        }
      ],
      subtotal: 80.00,
      discount: 0,
      deliveryFee: 15.00,
      total: 95.00,
      totalProductionCost: 40.64,
      grossProfit: 39.36,
      paymentStatus: 'Paid',
      paymentMethods: [
        { method: 'MTN Mobile Money', amount: 95.00, reference: 'MM20260816-991' }
      ],
      amountReceived: 95.00,
      changeGiven: 0,
      riderInfo: {
        name: 'Rashid Tanko',
        phone: '0245554040',
        assignedAt: nowIso,
        deliveryAddress: 'House 45, Airport Residential, Tamale'
      },
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'ord-demo-03',
      receiptNumber: 'TF-20260816-1003',
      branchId: 'tamale-central',
      cashierId: activeUser.uid,
      cashierName: 'Fatima Zuleiha',
      customerName: 'Ibrahim Kassim',
      customerPhone: '0543332211',
      orderType: 'Takeaway',
      status: 'Preparing',
      items: [
        {
          menuItemId: 'menu-yam-fries-chicken',
          name: 'Crispy Northern Yam Fries + Grilled Chicken',
          unitPrice: 48.00,
          quantity: 1,
          discount: 0,
          category: 'Yam Fries',
          recipeSnapshot: menuItems[2].recipe,
          productionCost: 25.28,
          subtotal: 48.00
        }
      ],
      subtotal: 48.00,
      discount: 0,
      deliveryFee: 0,
      total: 48.00,
      totalProductionCost: 25.28,
      grossProfit: 22.72,
      paymentStatus: 'Paid',
      paymentMethods: [
        { method: 'Cash', amount: 20.00 },
        { method: 'Telecel Cash', amount: 28.00, reference: 'TC-338291' }
      ],
      amountReceived: 48.00,
      changeGiven: 0,
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString()
    }
  ];

  for (const ord of sampleOrders) {
    const oRef = doc(db, COLLECTIONS.ORDERS, ord.id);
    batch.set(oRef, ord);
  }

  // Commit all seed data
  await batch.commit();

  await logAuditEvent(
    activeUser.uid,
    activeUser.displayName || 'System Admin',
    activeUser.role,
    'Database Seeded',
    'SYSTEM',
    'Initial Tamale Food menu, authentic recipes, ingredients, branches, staff, suppliers, and baseline orders seeded successfully.'
  );

  return true;
};
