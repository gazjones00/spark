import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { type Bank } from "@/lib/mock-data";

interface BankSelectorProps {
  banks: Bank[];
  onSelect: (bank: Bank) => void;
}

export function BankSelector({ banks, onSelect }: BankSelectorProps) {
  const [search, setSearch] = React.useState("");

  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(search.toLowerCase()),
  );

  const popularBanks = filteredBanks.filter((bank) => bank.popular);
  const otherBanks = filteredBanks.filter((bank) => !bank.popular);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search banks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {popularBanks.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Popular Banks</p>
          <div className="grid grid-cols-2 gap-2">
            {popularBanks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => onSelect(bank)}
                className="flex items-center gap-3 rounded-none border p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="text-2xl">{bank.logo}</span>
                <span className="text-sm font-medium">{bank.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {otherBanks.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">All Banks</p>
          <div className="space-y-1">
            {otherBanks.map((bank) => (
              <button
                key={bank.id}
                onClick={() => onSelect(bank)}
                className="flex w-full items-center gap-3 rounded-none border p-3 text-left transition-colors hover:bg-muted"
              >
                <span className="text-xl">{bank.logo}</span>
                <span className="text-sm font-medium">{bank.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {filteredBanks.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No banks found matching "{search}"
        </p>
      )}
    </div>
  );
}
