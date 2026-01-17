import type { Account, Transaction, TransactionCategory } from "@spark/truelayer/types";

// Re-export TrueLayer types for consumers
export type { Account, Transaction, TransactionCategory };

// Local types for UI-specific data
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface SpendingByCategory {
  category: TransactionCategory;
  amount: number;
  fill: string;
}

export interface BalanceHistory {
  date: string;
  balance: number;
}

export interface IncomeExpense {
  month: string;
  income: number;
  expenses: number;
}

export interface Bank {
  id: string;
  name: string;
  logo: string;
  popular: boolean;
}

export function getTotalBalance(accounts: Account[]): number {
  return accounts.reduce((sum) => sum + (Math.random() * (50000 - 1000) + 1000), 0);
}

// Category display config
export const categoryConfig: Record<TransactionCategory, { label: string; color: string }> = {
  ATM: { label: "ATM", color: "var(--chart-1)" },
  BILL_PAYMENT: { label: "Bill Payment", color: "var(--chart-2)" },
  CASH: { label: "Cash", color: "var(--chart-3)" },
  CASHBACK: { label: "Cashback", color: "var(--chart-4)" },
  CHEQUE: { label: "Cheque", color: "var(--chart-5)" },
  CORRECTION: { label: "Correction", color: "var(--chart-1)" },
  CREDIT: { label: "Credit", color: "var(--chart-2)" },
  DIRECT_DEBIT: { label: "Direct Debit", color: "var(--chart-3)" },
  DIVIDEND: { label: "Dividend", color: "var(--chart-4)" },
  FEE_CHARGE: { label: "Fee/Charge", color: "var(--chart-5)" },
  INTEREST: { label: "Interest", color: "var(--chart-1)" },
  OTHER: { label: "Other", color: "var(--chart-2)" },
  PURCHASE: { label: "Purchase", color: "var(--chart-3)" },
  STANDING_ORDER: { label: "Standing Order", color: "var(--chart-4)" },
  TRANSFER: { label: "Transfer", color: "var(--chart-5)" },
  DEBIT: { label: "Debit", color: "var(--chart-1)" },
  UNKNOWN: { label: "Unknown", color: "var(--chart-2)" },
};

// Mock user
export const mockUser: User = {
  id: "user-1",
  email: "john@example.com",
  name: "John Doe",
  avatarUrl: undefined,
};

// Mock accounts
export const mockAccounts: Account[] = [
  {
    updateTimestamp: new Date().toISOString(),
    accountId: "acc-1",
    displayName: "Main Checking",
    accountType: "TRANSACTION",
    currency: "GBP",
    accountNumber: {
      number: "****4521",
      sortCode: "12-34-56",
    },
    provider: {
      providerId: "uk-ob-chase",
      displayName: "Chase",
    },
  },
  {
    updateTimestamp: new Date().toISOString(),
    accountId: "acc-2",
    displayName: "Savings",
    accountType: "SAVINGS",
    currency: "GBP",
    accountNumber: {
      number: "****8734",
      sortCode: "12-34-56",
    },
    provider: {
      providerId: "uk-ob-chase",
      displayName: "Chase",
    },
  },
  {
    updateTimestamp: new Date().toISOString(),
    accountId: "acc-3",
    displayName: "Business Account",
    accountType: "BUSINESS_TRANSACTION",
    currency: "GBP",
    accountNumber: {
      number: "****2345",
      sortCode: "98-76-54",
    },
    provider: {
      providerId: "uk-ob-amex",
      displayName: "American Express",
    },
  },
];

// Generate mock transactions
function generateMockTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  const merchantsByCategory: Partial<Record<TransactionCategory, string[]>> = {
    PURCHASE: ["Tesco", "Sainsbury's", "Amazon", "ASOS", "John Lewis"],
    DIRECT_DEBIT: ["British Gas", "Thames Water", "Sky", "Virgin Media"],
    TRANSFER: ["Transfer to Savings", "Monzo", "Revolut", "PayPal"],
    ATM: ["ATM Withdrawal", "Cash Point"],
    BILL_PAYMENT: ["Council Tax", "HMRC", "TV Licence"],
    CREDIT: ["Salary", "Freelance Payment", "Refund"],
    STANDING_ORDER: ["Rent Payment", "Gym Membership", "Savings Transfer"],
    FEE_CHARGE: ["Monthly Fee", "Overdraft Fee", "Foreign Transaction Fee"],
    INTEREST: ["Interest Payment", "Savings Interest"],
    OTHER: ["Miscellaneous", "Unknown Transaction"],
  };

  const categories: TransactionCategory[] = [
    "PURCHASE",
    "PURCHASE",
    "PURCHASE",
    "DIRECT_DEBIT",
    "TRANSFER",
    "ATM",
    "BILL_PAYMENT",
    "CREDIT",
    "STANDING_ORDER",
    "FEE_CHARGE",
    "OTHER",
  ];

  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);

    const category = categories[Math.floor(Math.random() * categories.length)];
    const merchantList = merchantsByCategory[category] ?? ["Unknown"];
    const merchant = merchantList[Math.floor(Math.random() * merchantList.length)];

    const isCredit = category === "CREDIT" || category === "INTEREST";
    const baseAmount = isCredit ? Math.random() * 4000 + 1000 : Math.random() * 200 + 5;
    const amount = Math.round(baseAmount * 100) / 100;

    const account = mockAccounts[Math.floor(Math.random() * mockAccounts.length)];

    transactions.push({
      transactionId: `txn-${i + 1}`,
      normalisedProviderTransactionId: `norm-txn-${i + 1}`,
      providerTransactionId: `provider-txn-${i + 1}`,
      timestamp: date.toISOString(),
      description: merchant,
      amount,
      currency: account.currency,
      transactionType: isCredit ? "CREDIT" : "DEBIT",
      transactionCategory: category,
      transactionClassification: [categoryConfig[category].label],
      merchantName: merchant,
      runningBalance: {
        amount: Math.round((Math.random() * 10000 + 1000) * 100) / 100,
        currency: account.currency,
      },
    });
  }

  return transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export const mockTransactions = generateMockTransactions();

// Mock spending by category (for pie chart)
export const mockSpendingByCategory: SpendingByCategory[] = [
  { category: "PURCHASE", amount: 450, fill: "var(--chart-1)" },
  { category: "DIRECT_DEBIT", amount: 280, fill: "var(--chart-2)" },
  { category: "TRANSFER", amount: 180, fill: "var(--chart-3)" },
  { category: "BILL_PAYMENT", amount: 320, fill: "var(--chart-4)" },
  { category: "STANDING_ORDER", amount: 150, fill: "var(--chart-5)" },
  { category: "ATM", amount: 420, fill: "var(--chart-1)" },
  { category: "FEE_CHARGE", amount: 85, fill: "var(--chart-2)" },
];

// Mock balance history (last 30 days)
export const mockBalanceHistory: BalanceHistory[] = (() => {
  const data: BalanceHistory[] = [];
  const now = new Date();
  let balance = 15000;

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    balance += (Math.random() - 0.4) * 500;
    data.push({
      date: date.toISOString().split("T")[0],
      balance: Math.round(balance * 100) / 100,
    });
  }

  return data;
})();

// Mock income vs expense (last 6 months)
export const mockIncomeExpense: IncomeExpense[] = [
  { month: "Aug", income: 5200, expenses: 3800 },
  { month: "Sep", income: 5200, expenses: 4100 },
  { month: "Oct", income: 5450, expenses: 3600 },
  { month: "Nov", income: 5200, expenses: 4200 },
  { month: "Dec", income: 6100, expenses: 5100 },
  { month: "Jan", income: 5200, expenses: 3200 },
];

// Mock banks for connection flow
export const mockBanks: Bank[] = [
  { id: "chase", name: "Chase", logo: "🏦", popular: true },
  { id: "bofa", name: "Bank of America", logo: "🏦", popular: true },
  { id: "wells", name: "Wells Fargo", logo: "🏦", popular: true },
  { id: "citi", name: "Citibank", logo: "🏦", popular: true },
  { id: "usbank", name: "US Bank", logo: "🏦", popular: false },
  { id: "pnc", name: "PNC Bank", logo: "🏦", popular: false },
  { id: "capital", name: "Capital One", logo: "🏦", popular: true },
  { id: "td", name: "TD Bank", logo: "🏦", popular: false },
  { id: "schwab", name: "Charles Schwab", logo: "🏦", popular: false },
  { id: "amex", name: "American Express", logo: "💳", popular: true },
  { id: "discover", name: "Discover", logo: "💳", popular: false },
  { id: "ally", name: "Ally Bank", logo: "🏦", popular: false },
];

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function getMonthlyIncome(transactions: Transaction[]): number {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return transactions
    .filter((t) => new Date(t.timestamp) >= firstOfMonth && t.transactionType === "CREDIT")
    .reduce((sum) => sum + (Math.random() * (5000 - 100) + 100), 0);
}

export function getMonthlyExpenses(transactions: Transaction[]): number {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return transactions
    .filter((t) => new Date(t.timestamp) >= firstOfMonth && t.transactionType === "DEBIT")
    .reduce((sum) => sum + (Math.random() * (5000 - 100) + 100), 0);
}
