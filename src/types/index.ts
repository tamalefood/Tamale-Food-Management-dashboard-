export type UserRole = 
  | 'Owner/Admin'
  | 'Manager'
  | 'Cashier/Sales Staff'
  | 'Kitchen Staff'
  | 'Accountant'
  | 'Investor';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  branchId?: string;
  phone?: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  managerId?: string;
  managerName?: string;
  active: boolean;
  createdAt?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  category: 'Grains' | 'Meats & Poultry' | 'Vegetables' | 'Oils & Fats' | 'Spices & Seasoning' | 'Packaging' | 'Beverages' | 'Utilities & Gas' | 'Other';
  unit: 'g' | 'kg' | 'ml' | 'L' | 'pcs' | 'pack' | 'portion' | 'bottle';
  currentQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  costPerUnit: number; // Cost in GHS per unit
  supplierId?: string;
  supplierName?: string;
  storageLocation?: string;
  lastUpdated: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number; // quantity in ingredient's base unit
  unit: string;
  costPerUnit: number;
  subtotalCost: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'Fried Rice' | 'Jollof Rice' | 'Yam Fries' | 'Noodles' | 'Chicken' | 'Goat Meat' | 'Drinks' | 'Add-ons' | 'Other';
  sellingPrice: number;
  description?: string;
  image?: string;
  available: boolean;
  recipe: RecipeIngredient[];
  packagingCost: number;
  laborCost: number;
  // Computed fields
  ingredientCost: number;
  totalProductionCost: number;
  grossProfit: number;
  profitMargin: number; // percentage (e.g. 55.4%)
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryMovementType = 
  | 'Purchase'
  | 'Sale/Consumption'
  | 'Production'
  | 'Wastage'
  | 'Adjustment'
  | 'Return';

export interface InventoryMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: InventoryMovementType;
  quantityChange: number; // negative for deductions, positive for additions
  previousQuantity: number;
  newQuantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  orderId?: string;
  purchaseId?: string;
  reason?: string;
  recordedBy: string;
  recordedByName?: string;
  branchId: string;
  timestamp: string;
}

export type OrderType = 'Dine-in' | 'Takeaway' | 'Pickup' | 'Delivery';

export type OrderStatus = 
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready'
  | 'Out for Delivery'
  | 'Completed'
  | 'Cancelled';

export type PaymentMethodType = 
  | 'Cash'
  | 'MTN Mobile Money'
  | 'Telecel Cash'
  | 'AirtelTigo Money'
  | 'Bank/Card'
  | 'Mixed';

export interface SplitPayment {
  method: PaymentMethodType;
  amount: number;
  reference?: string;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  notes?: string;
  category: string;
  recipeSnapshot: RecipeIngredient[];
  productionCost: number;
  subtotal: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  productionCost: number;
  subtotal: number;
  notes?: string;
  recipeSnapshot?: RecipeIngredient[];
}

export interface Order {
  id: string;
  receiptNumber: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  orderType: OrderType;
  status: OrderStatus;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  totalProductionCost: number;
  grossProfit: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial' | 'Refunded';
  paymentMethods: SplitPayment[];
  amountReceived: number;
  changeGiven: number;
  notes?: string;
  riderInfo?: {
    name: string;
    phone: string;
    assignedAt: string;
    deliveryAddress?: string;
  };
  shiftId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PosShift {
  id: string;
  cashierId: string;
  cashierName: string;
  branchId: string;
  status: 'Open' | 'Closed';
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  cashSales: number;
  cashRefunds: number;
  cashExpenses: number;
  cashDeposits: number;
  expectedCash: number;
  actualClosingCash?: number;
  difference?: number;
  shortage?: number;
  excess?: number;
  discrepancyNote?: string;
  approvedBy?: string;
  approvedByName?: string;
  totalOrdersCount: number;
}

export interface Supplier {
  id: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  productsSupplied: string[];
  createdAt: string;
}

export interface PurchaseItem {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  date: string;
  items: PurchaseItem[];
  totalCost: number;
  paymentStatus: 'Paid' | 'Pending' | 'Partial';
  paymentMethod: PaymentMethodType;
  receiptAttachmentUrl?: string;
  notes?: string;
  recordedBy: string;
  recordedByName: string;
  branchId: string;
  createdAt: string;
}

export type ExpenseCategory = 
  | 'Electricity'
  | 'Gas'
  | 'Gas & Fuel'
  | 'Water'
  | 'Utilities'
  | 'Salary'
  | 'Transport'
  | 'Delivery'
  | 'Marketing'
  | 'Repairs'
  | 'Maintenance'
  | 'Packaging'
  | 'Rent'
  | 'Cleaning'
  | 'Permits & Taxes'
  | 'Sundry'
  | 'Other';

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description?: string;
  title?: string;
  date: string;
  paymentMethod: PaymentMethodType;
  recordedBy: string;
  recordedByName: string;
  receiptUrl?: string;
  receiptNumber?: string;
  notes?: string;
  approvalStatus?: 'Approved' | 'Pending' | 'Rejected';
  approvedBy?: string;
  branchId: string;
  createdAt: string;
}

export interface Investor {
  id: string;
  fullName?: string;
  name?: string;
  phone?: string;
  email?: string;
  investmentAmount?: number;
  totalInvestment?: number;
  equityPercentage: number; // e.g. 15 for 15%
  investmentDate: string;
  agreementDocumentUrl?: string;
  bankDetails?: string;
  status?: 'Active' | 'Inactive' | 'Exited';
  totalPaid?: number;
  totalDividendsPaid?: number;
  outstandingAmount?: number;
  notes?: string;
  createdAt?: string;
}

export interface InvestorPayment {
  id: string;
  investorId: string;
  investorName: string;
  amount: number;
  paymentDate: string;
  profitPeriod?: string; // e.g. "August 2026"
  period?: string;
  paymentMethod?: PaymentMethodType;
  referenceNumber?: string;
  notes?: string;
  status?: 'Approved' | 'Paid' | 'Pending';
  paidAt?: string;
  recordedBy: string;
  recordedByName?: string;
  createdAt: string;
}

export type DividendPayout = InvestorPayment;

export interface Employee {
  id: string;
  fullName: string;
  name?: string;
  phone: string;
  email?: string;
  position?: 'Manager' | 'Head Chef' | 'Cook' | 'Kitchen Assistant' | 'Cashier' | 'Delivery Rider' | 'Cleaner' | 'Security';
  role?: UserRole;
  employmentDate?: string;
  hireDate?: string;
  salaryType?: 'Monthly' | 'Daily' | 'Hourly';
  salaryFrequency?: 'Monthly' | 'Weekly';
  monthlySalary?: number;
  baseSalary?: number;
  dailyWage?: number;
  hourlyWage?: number;
  bankName?: string;
  accountOrMomoNumber?: string;
  accountDetails?: string;
  paymentMethod?: PaymentMethodType | 'Bank' | 'Cash' | 'MTN Mobile Money';
  status?: 'Active' | 'On Leave' | 'Terminated';
  active?: boolean;
  branchId: string;
  createdAt: string;
}

export interface PayrollItem {
  id: string;
  employeeId: string;
  employeeName: string;
  position?: string;
  role?: string;
  period?: string;
  salaryType?: 'Monthly' | 'Daily' | 'Hourly';
  basicPay?: number;
  baseSalary?: number;
  overtime?: number;
  allowances?: number;
  bonuses?: number;
  deductions?: number;
  salaryAdvances?: number;
  grossPay?: number;
  netPay?: number;
  netSalary?: number;
  status?: 'Approved' | 'Paid' | 'Pending';
  paymentStatus?: 'Paid' | 'Pending';
  paymentDate?: string;
  paidAt?: string;
  paymentMethod?: PaymentMethodType | 'Bank' | 'Cash' | 'MTN Mobile Money';
  accountDetails?: string;
  recordedBy?: string;
  branchId?: string;
  createdAt?: string;
  notes?: string;
}

export type PayrollRecord = PayrollItem;

export interface PayrollRun {
  id: string;
  monthYear: string; // e.g. "2026-08"
  periodLabel: string; // "August 2026"
  branchId: string;
  totalGross: number;
  totalNet: number;
  totalDeductions: number;
  items: PayrollItem[];
  status: 'Draft' | 'Approved' | 'Paid';
  processedBy: string;
  processedByName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  category: 'AUTH' | 'SALE' | 'INVENTORY' | 'EXPENSE' | 'PURCHASE' | 'PAYROLL' | 'INVESTOR' | 'SYSTEM' | 'SETTINGS';
  details?: string;
  description?: string;
  relatedRecordId?: string;
  oldValue?: string;
  newValue?: string;
  branchId?: string;
  timestamp: string;
}

export type AuditEvent = AuditLog;

export interface AppSettings {
  businessName: string;
  tagline: string;
  currency: string;
  currencySymbol: string;
  taxRate: number; // percentage
  receiptFooter: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  momoPayNumber?: string;
  lowStockThresholdPercent: number;
}
