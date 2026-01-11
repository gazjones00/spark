import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BankSelector } from "./bank-selector";
import { type Bank, mockBanks } from "@/lib/mock-data";

type Step = "select-bank" | "credentials" | "select-accounts" | "success";

const mockBankAccounts = [
  { id: "1", name: "Checking Account", number: "****4521", selected: true },
  { id: "2", name: "Savings Account", number: "****8734", selected: true },
  { id: "3", name: "Credit Card", number: "****2345", selected: false },
];

export function ConnectBankWizard() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState<Step>("select-bank");
  const [selectedBank, setSelectedBank] = React.useState<Bank | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [accounts, setAccounts] = React.useState(mockBankAccounts);

  const progress = {
    "select-bank": 25,
    credentials: 50,
    "select-accounts": 75,
    success: 100,
  };

  const handleBankSelect = (bank: Bank) => {
    setSelectedBank(bank);
    setStep("credentials");
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);
    setStep("select-accounts");
  };

  const handleAccountToggle = (accountId: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === accountId ? { ...acc, selected: !acc.selected } : acc)),
    );
  };

  const handleConnectAccounts = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
    setStep("success");
  };

  const handleBack = () => {
    if (step === "credentials") setStep("select-bank");
    if (step === "select-accounts") setStep("credentials");
  };

  const selectedCount = accounts.filter((a) => a.selected).length;

  return (
    <div className="mx-auto max-w-lg">
      <Progress value={progress[step]} className="mb-6" />

      {step === "select-bank" && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Your Bank</CardTitle>
            <CardDescription>Select your bank to securely connect your accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <BankSelector banks={mockBanks} onSelect={handleBankSelect} />
          </CardContent>
        </Card>
      )}

      {step === "credentials" && selectedBank && (
        <Card>
          <CardHeader>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2 -ml-2 w-fit">
              <ArrowLeft className="mr-1 size-4" />
              Back
            </Button>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedBank.logo}</span>
              Log in to {selectedBank.name}
            </CardTitle>
            <CardDescription>Enter your online banking credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                Your credentials are encrypted and never stored
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "select-accounts" && selectedBank && (
        <Card>
          <CardHeader>
            <Button variant="ghost" size="sm" onClick={handleBack} className="mb-2 -ml-2 w-fit">
              <ArrowLeft className="mr-1 size-4" />
              Back
            </Button>
            <CardTitle>Select Accounts</CardTitle>
            <CardDescription>
              Choose which accounts to connect from {selectedBank.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex cursor-pointer items-center gap-3 rounded-none border p-3 transition-colors hover:bg-muted"
                >
                  <Checkbox
                    checked={account.selected}
                    onCheckedChange={() => handleAccountToggle(account.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-muted-foreground text-xs">{account.number}</p>
                  </div>
                </label>
              ))}
            </div>
            <Button
              className="mt-4 w-full"
              onClick={handleConnectAccounts}
              disabled={selectedCount === 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                `Connect ${selectedCount} Account${selectedCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "success" && selectedBank && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="bg-chart-3/20 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
                <Check className="text-chart-3 size-8" />
              </div>
              <h2 className="text-xl font-bold">Successfully Connected!</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {selectedCount} account{selectedCount !== 1 ? "s" : ""} from {selectedBank.name}{" "}
                have been added
              </p>
              <Button className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
