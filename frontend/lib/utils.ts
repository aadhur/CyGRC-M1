import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cn } from "cn";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
