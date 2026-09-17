import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Ghép class Tailwind, class sau ghi đè class trước nếu xung đột (vd: p-2 và p-4) */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}