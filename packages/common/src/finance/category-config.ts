import type { TransactionCategory } from "@spark/schema";

/**
 * Canonical category → display config (label + chart colour token).
 *
 * Shared by the live transactions table/filters and the dashboard charts.
 * The `var(--chart-*)` values are CSS custom properties defined in the web
 * app's theme. This is real, shipped configuration — not mock data.
 */
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
