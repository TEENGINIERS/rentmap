import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatRent(inr: number): string {
  if (inr >= 100_000) {
    return `₹${(inr / 100_000).toFixed(1)}L`;
  }
  return `₹${(inr / 1000).toFixed(0)}k`;
}

export function formatRentFull(inr: number): string {
  return `₹${inr.toLocaleString("en-IN")}`;
}
