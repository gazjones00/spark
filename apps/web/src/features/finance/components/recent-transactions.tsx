import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { type Transaction, categoryConfig } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const recentTransactions = transactions.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Transactions</CardTitle>
        <Link
          to="/transactions"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
        >
          View all
          <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentTransactions.map((transaction) => (
            <div
              key={transaction.transactionId}
              className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className="size-2 rounded-none"
                  style={{
                    backgroundColor: categoryConfig[transaction.transactionCategory].color,
                  }}
                />
                <div>
                  <p className="text-sm font-medium">
                    {transaction.merchantName ?? transaction.description}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {categoryConfig[transaction.transactionCategory].label} •{" "}
                    {new Date(transaction.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p
                className={`text-sm font-medium ${
                  transaction.amount >= 0 ? "text-chart-3" : "text-foreground"
                }`}
              >
                {transaction.amount >= 0 ? "+" : ""}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
