import type { FC } from "react";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const createCompoundComponent = <TProps, TSubcomponents>(
  Component: FC<TProps>,
  subComponents: TSubcomponents,
) => Object.assign(Component, subComponents);

export const formatCurrency = (amount: number, currency = "USD"): string => {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amount);
};
