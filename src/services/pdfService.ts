import jsPDF from 'jspdf';
import { Order, Investor, InvestorPayment, PosShift } from '../types';
import { formatGHS } from './dbService';

export const generateReceiptPdf = (order: Order, businessName = 'TAMALE FOOD', tagline = 'The Taste of the North') => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 200] // 80mm standard thermal roll size
  });

  let y = 10;
  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.text(businessName, 40, y, { align: 'center' });
  y += 5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(tagline, 40, y, { align: 'center' });
  y += 4;
  doc.text('Tamale, Northern Region, Ghana', 40, y, { align: 'center' });
  y += 4;
  doc.text('Tel: +233 24 000 1234', 40, y, { align: 'center' });
  y += 5;

  doc.setLineDashPattern([1, 1], 0);
  doc.line(4, y, 76, y);
  y += 4;

  doc.setFontSize(8);
  doc.setFont('courier', 'bold');
  doc.text(`RECEIPT: ${order.receiptNumber}`, 4, y);
  y += 4;
  doc.setFont('courier', 'normal');
  doc.text(`Date: ${new Date(order.createdAt).toLocaleString('en-GH')}`, 4, y);
  y += 4;
  doc.text(`Cashier: ${order.cashierName || 'Staff'}`, 4, y);
  y += 4;
  doc.text(`Order Type: ${order.orderType}`, 4, y);
  if (order.customerName) {
    y += 4;
    doc.text(`Customer: ${order.customerName} (${order.customerPhone || ''})`, 4, y);
  }
  y += 4;

  doc.line(4, y, 76, y);
  y += 4;

  doc.setFont('courier', 'bold');
  doc.text('ITEM', 4, y);
  doc.text('QTY', 46, y);
  doc.text('PRICE', 58, y);
  doc.text('TOTAL', 76, y, { align: 'right' });
  y += 4;
  doc.line(4, y, 76, y);
  y += 4;

  doc.setFont('courier', 'normal');
  for (const item of order.items) {
    const itemName = item.name.length > 20 ? item.name.substring(0, 19) + '..' : item.name;
    doc.text(itemName, 4, y);
    y += 3.5;
    doc.text(`  @ GHS ${item.unitPrice.toFixed(2)}`, 4, y);
    doc.text(`x${item.quantity}`, 46, y);
    doc.text(`GHS ${(item.quantity * item.unitPrice).toFixed(2)}`, 76, y, { align: 'right' });
    y += 4;
  }

  doc.line(4, y, 76, y);
  y += 4;

  doc.text('Subtotal:', 4, y);
  doc.text(formatGHS(order.subtotal), 76, y, { align: 'right' });
  y += 4;

  if (order.discount > 0) {
    doc.text('Discount:', 4, y);
    doc.text(`- ${formatGHS(order.discount)}`, 76, y, { align: 'right' });
    y += 4;
  }

  if (order.deliveryFee > 0) {
    doc.text('Delivery Fee:', 4, y);
    doc.text(formatGHS(order.deliveryFee), 76, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', 4, y);
  doc.text(formatGHS(order.total), 76, y, { align: 'right' });
  y += 5;

  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.text('PAYMENT TENDERED:', 4, y);
  y += 4;
  for (const pm of order.paymentMethods) {
    doc.text(`- ${pm.method}:`, 8, y);
    doc.text(formatGHS(pm.amount), 76, y, { align: 'right' });
    y += 3.5;
  }

  if (order.amountReceived > order.total) {
    doc.text('Amount Tendered:', 4, y);
    doc.text(formatGHS(order.amountReceived), 76, y, { align: 'right' });
    y += 3.5;
    doc.text('Change Returned:', 4, y);
    doc.text(formatGHS(order.changeGiven), 76, y, { align: 'right' });
    y += 4;
  }

  y += 2;
  doc.line(4, y, 76, y);
  y += 5;

  doc.text('Thank you for dining with us!', 40, y, { align: 'center' });
  y += 4;
  doc.text('** TAMALE FOOD - QUALITY FIRST **', 40, y, { align: 'center' });

  return doc;
};

export const generateShiftReportPdf = (shift: PosShift) => {
  const doc = new jsPDF();
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TAMALE FOOD - POS CASH REGISTER REPORT', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Shift ID: ${shift.id}`, 14, y);
  doc.text(`Branch: ${shift.branchId}`, 120, y);
  y += 6;
  doc.text(`Cashier: ${shift.cashierName}`, 14, y);
  doc.text(`Opened: ${new Date(shift.openedAt).toLocaleString('en-GH')}`, 120, y);
  y += 6;
  if (shift.closedAt) {
    doc.text(`Closed: ${new Date(shift.closedAt).toLocaleString('en-GH')}`, 120, y);
  }
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('CASH RECONCILIATION SUMMARY', 14, y);
  y += 8;

  const rows = [
    ['Opening Float / Cash on Hand', formatGHS(shift.openingCash)],
    ['(+) Total Cash POS Sales', formatGHS(shift.cashSales)],
    ['(+) Cash Deposits to Drawer', formatGHS(shift.cashDeposits || 0)],
    ['(-) Cash Refunds Issued', formatGHS(shift.cashRefunds || 0)],
    ['(-) Petty Cash Drawer Expenses', formatGHS(shift.cashExpenses || 0)],
    ['(=) System Expected Closing Cash', formatGHS(shift.expectedCash)],
    ['Actual Cash Counted by Cashier', formatGHS(shift.actualClosingCash || 0)],
    ['Variance / Discrepancy', formatGHS(shift.difference || 0)],
    ['Total Order Transactions in Shift', `${shift.totalOrdersCount || 0} orders`]
  ];

  doc.setFont('helvetica', 'normal');
  for (const [label, val] of rows) {
    doc.text(label, 16, y);
    doc.text(val, 190, y, { align: 'right' });
    y += 7;
  }

  y += 10;
  if (shift.discrepancyNote) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cashier Explanation Note:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(shift.discrepancyNote, 16, y);
    y += 12;
  }

  y += 20;
  doc.line(14, y, 70, y);
  doc.line(130, y, 190, y);
  y += 5;
  doc.text('Cashier Signature', 14, y);
  doc.text('Manager Verification', 130, y);

  return doc;
};

export const generateInvestorStatementPdf = (
  investor: Investor,
  payments: InvestorPayment[],
  periodProfit = 0,
  allocatedShare = 0
) => {
  const doc = new jsPDF();
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TAMALE FOOD MANAGEMENT', 14, y);
  y += 6;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Partner & Investor Profit Allocation Statement', 14, y);
  y += 12;

  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('INVESTOR PROFILE', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Full Name: ${investor.fullName}`, 14, y);
  doc.text(`Email: ${investor.email}`, 110, y);
  y += 6;
  doc.text(`Phone: ${investor.phone}`, 14, y);
  doc.text(`Investment Date: ${investor.investmentDate}`, 110, y);
  y += 6;
  doc.text(`Capital Invested: ${formatGHS(investor.investmentAmount)}`, 14, y);
  doc.text(`Equity Share: ${investor.equityPercentage}%`, 110, y);
  y += 10;

  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('PROFIT DISTRIBUTION ACCRUAL', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Period Net Operating Profit: ${formatGHS(periodProfit)}`, 14, y);
  y += 6;
  doc.text(`Investor Share (${investor.equityPercentage}%): ${formatGHS(allocatedShare)}`, 14, y);
  y += 6;
  doc.text(`Total Historical Distributions Paid: ${formatGHS(investor.totalPaid)}`, 14, y);
  y += 6;
  doc.text(`Current Outstanding Profit Balance: ${formatGHS(investor.outstandingAmount)}`, 14, y);
  y += 12;

  doc.line(14, y, 196, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('DISTRIBUTION PAYMENT HISTORY', 14, y);
  y += 8;

  doc.text('Date', 14, y);
  doc.text('Period', 50, y);
  doc.text('Method', 90, y);
  doc.text('Reference', 130, y);
  doc.text('Amount', 190, y, { align: 'right' });
  y += 4;
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  if (payments.length === 0) {
    doc.text('No historical payout distributions recorded yet.', 14, y);
    y += 8;
  } else {
    for (const p of payments) {
      doc.text(p.paymentDate, 14, y);
      doc.text(p.profitPeriod || '-', 50, y);
      doc.text(p.paymentMethod, 90, y);
      doc.text(p.referenceNumber || '-', 130, y);
      doc.text(formatGHS(p.amount), 190, y, { align: 'right' });
      y += 6;
    }
  }

  y += 20;
  doc.text('Authorized by Tamale Food Financial Operations', 14, y);
  return doc;
};

export interface FinancialStatementParams {
  title: string;
  period: string;
  branchName: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  payroll: number;
  netProfit: number;
  investors?: any[];
}

export const generateFinancialStatementPdf = (params: FinancialStatementParams) => {
  const doc = new jsPDF();
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(params.title, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${params.period} | Outlet: ${params.branchName}`, 14, y);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GH')}`, 140, y);
  y += 8;

  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PROFIT & LOSS FINANCIAL SUMMARY', 14, y);
  y += 8;

  const rows = [
    ['Gross Revenue / Sales', formatGHS(params.revenue)],
    ['Cost of Goods Sold (Raw Ingredients & Packaging)', `(${formatGHS(params.cogs)})`],
    ['GROSS PROFIT', formatGHS(params.grossProfit)],
    ['Operating Overheads & Utilities', `(${formatGHS(params.expenses)})`],
    ['Staff Wages & Payroll Disbursements', `(${formatGHS(params.payroll)})`],
    ['NET OPERATING PROFIT', formatGHS(params.netProfit)]
  ];

  doc.setFontSize(10);
  for (const [label, val] of rows) {
    if (label === 'GROSS PROFIT' || label === 'NET OPERATING PROFIT') {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(label, 16, y);
    doc.text(val, 190, y, { align: 'right' });
    y += 7;
  }

  if (params.investors && params.investors.length > 0) {
    y += 8;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('STAKEHOLDER EQUITY DISTRIBUTION MODEL', 14, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    for (const inv of params.investors) {
      const share = ((inv.equityPercentage || 0) / 100) * params.netProfit;
      const invName = inv.fullName || inv.name || 'Stakeholder';
      doc.text(`${invName} (${inv.equityPercentage}%)`, 16, y);
      doc.text(formatGHS(share), 190, y, { align: 'right' });
      y += 6;
    }
  }

  y += 16;
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFontSize(8);
  doc.text('Tamale Food Management System - Verified Audited Accounting Export', 14, y);

  doc.save(`${params.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`);
  return doc;
};

