import * as React from "react";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2, SearchX } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DATE_RANGES,
  TransactionFiltersBar,
  type DateRange,
  type TransactionFilters,
} from "@/features/finance/components/TransactionFilters";
import {
  TransactionDetailSheet,
  TransactionList,
} from "@/features/finance/components/TransactionList";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { orpc } from "@spark/orpc";
import type { SavedTransaction } from "@spark/orpc/contract";

const PAGE_SIZE = 25;

/**
 * Filters live in the URL, so links from elsewhere (a category, an account)
 * open the list pre-filtered and the back button restores them.
 */
const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  account: z.string().optional(),
  range: z.enum(Object.keys(DATE_RANGES) as [DateRange, ...DateRange[]]).optional(),
});

type ListInput = Parameters<typeof orpc.transactions.list.call>[0];

export const Route = createFileRoute("/_authenticated/transactions")({
  validateSearch: searchSchema,
  // Warm the accounts cache on client-side navigations. SSR is skipped: the
  // oRPC fetch has no user cookie there.
  loader: ({ context }) => {
    if (typeof window === "undefined") return;
    void context.queryClient.prefetchQuery({
      queryKey: queryKeys.accounts,
      queryFn: () => orpc.accounts.list.call({}),
    });
  },
  component: TransactionsPage,
});

function TransactionsPage() {
  const linked = useSearch({ from: "/_authenticated/transactions" });
  const navigate = useNavigate();
  // The search box updates as you type; the URL follows the other filters.
  const [search, setSearch] = React.useState(linked.q ?? "");
  const deferredSearch = React.useDeferredValue(search.trim());
  const [selected, setSelected] = React.useState<SavedTransaction | null>(null);

  const filters: TransactionFilters = {
    search,
    category: linked.category,
    account: linked.account,
    range: linked.range,
  };

  const setFilters = (next: TransactionFilters) => {
    setSearch(next.search);
    void navigate({
      to: "/transactions",
      search: {
        q: next.search.trim() || undefined,
        category: next.category,
        account: next.account,
        range: next.range,
      },
      replace: true,
    });
  };

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => orpc.accounts.list.call({}),
  });

  const input = React.useMemo(() => {
    const value: ListInput = { limit: PAGE_SIZE };
    if (deferredSearch) value.search = deferredSearch;
    if (filters.account) value.accountId = filters.account;
    if (filters.category) value.category = filters.category;
    if (filters.range) {
      const from = new Date();
      from.setDate(from.getDate() - DATE_RANGES[filters.range].days);
      from.setHours(0, 0, 0, 0);
      value.from = from.toISOString();
    }
    return value;
  }, [deferredSearch, filters.account, filters.category, filters.range]);

  const transactionsQuery = useInfiniteQuery({
    queryKey: [...queryKeys.transactions, "list", input],
    queryFn: ({ pageParam }) =>
      orpc.transactions.list.call(pageParam ? { ...input, cursor: pageParam } : input),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    refetchOnMount: "always",
  });

  const accounts = accountsQuery.data?.accounts ?? [];
  const transactions = transactionsQuery.data?.pages.flatMap((page) => page.transactions) ?? [];
  const filtered = Boolean(deferredSearch || filters.account || filters.category || filters.range);

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Search, filter and categorise your spending." />

      <TransactionFiltersBar filters={filters} onFiltersChange={setFilters} accounts={accounts} />

      {transactionsQuery.isLoading ? (
        <ListSkeleton />
      ) : transactions.length === 0 ? (
        <EmptyState filtered={filtered} onClear={() => setFilters({ search: "" })} />
      ) : (
        <>
          <div className="text-muted-foreground flex items-center gap-2 px-1 text-sm">
            <span>
              {transactions.length} {transactions.length === 1 ? "transaction" : "transactions"}
              {transactionsQuery.hasNextPage ? " so far" : ""}
            </span>
            {transactionsQuery.isFetching && !transactionsQuery.isFetchingNextPage ? (
              <Loader2 className="size-4 animate-spin" aria-label="Updating" />
            ) : null}
          </div>

          <TransactionList transactions={transactions} accounts={accounts} onOpen={setSelected} />

          <div className="flex justify-center pt-2">
            {transactionsQuery.hasNextPage ? (
              <Button
                variant="outline"
                onClick={() => void transactionsQuery.fetchNextPage()}
                disabled={transactionsQuery.isFetchingNextPage}
              >
                {transactionsQuery.isFetchingNextPage ? <Loader2 className="animate-spin" /> : null}
                Load more
              </Button>
            ) : (
              <p className="text-muted-foreground text-sm">That's everything.</p>
            )}
          </div>
        </>
      )}

      <TransactionDetailSheet
        transaction={
          // Show the freshest copy (e.g. after a category change).
          selected ? (transactions.find((item) => item.id === selected.id) ?? selected) : null
        }
        accounts={accounts}
        onOpenChange={(open) => !open && setSelected(null)}
        onShowMerchant={(name) => {
          setSelected(null);
          setFilters({ ...filters, search: name });
        }}
      />
    </div>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="bg-muted text-muted-foreground inline-flex size-11 items-center justify-center rounded-full">
          <SearchX className="size-5" />
        </span>
        {filtered ? (
          <>
            <div>
              <p className="text-foreground font-semibold">No transactions match</p>
              <p className="text-muted-foreground text-sm">
                Try a different search or clear the filters.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="text-foreground font-semibold">No transactions yet</p>
              <p className="text-muted-foreground text-sm">
                They appear here once an account is connected and synced.
              </p>
            </div>
            <Link to="/accounts/connect" className={cn(buttonVariants({ size: "sm" }))}>
              Connect an account
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading transactions">
      {[0, 1].map((group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
