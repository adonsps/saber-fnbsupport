import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeWhatsapp(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('08')) {
    return '+62' + digits.slice(1);
  }
  if (digits.startsWith('62')) {
    return '+' + digits;
  }
  if (!digits.startsWith('+')) {
    return '+62' + digits;
  }
  return digits;
}

