export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "DEBT_LEND"
  | "DEBT_BORROW"
  | "DEBT_REPAY";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface ParsedRecord {
  action: "RECORD";
  type: TransactionType;
  amount: number;
  account_name: string;
  category: string;
  note: string;
  debt_person: string | null;
  confidence: Confidence;
}

export interface BudgetContext {
  accounts: { name: string; balance: number }[];
  totalBalance: number;
  avgMonthlyExpense: number;
  pendingDebts: number;
  upcomingBills: { name: string; amount: number; daysLeft: number }[];
  monthlyBudget?: number;
}
