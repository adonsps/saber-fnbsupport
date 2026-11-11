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

export const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'staging',
  'dev',
  'mail',
  'admin',
  'cashier',
  'api',
  'onboarding',
  'order',
  'orders',
  'checkout',
  'assets',
  'static',
  'fnbsupport',
  'staging-fnbsupport',
  'jbc',
  'hris',
  'erp',
  'eproc',
  'tracker',
  'pingspaw',
  'kuekoe',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type QrRoutingMode = 'path' | 'subdomain';

export const DEFAULT_APP_DOMAIN =
  process.env.NEXT_PUBLIC_APP_DOMAIN || 'fnbsupport.saberconsulting.id';

export const DEFAULT_ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'saberconsulting.id';

/**
 * Option B (Zero-Wildcard / Zero-DNS) is the default routing mode so new restaurants
 * never require wildcard DNS entries or wildcard SSL certificates.
 */
export function getQrRoutingMode(): QrRoutingMode {
  return process.env.NEXT_PUBLIC_QR_MODE === 'subdomain' ? 'subdomain' : 'path';
}

export function normalizeBaseOrigin(baseOriginOrDomain?: string): string {
  const candidate =
    baseOriginOrDomain?.trim() ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    DEFAULT_APP_DOMAIN;

  const stripped = candidate.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(stripped)) {
    return stripped;
  }
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(stripped);
  return `${isLocal ? 'http' : 'https'}://${stripped}`;
}

export function getOriginFromHeaders(headers: {
  get(name: string): string | null;
}): string | undefined {
  const rawHost = headers.get('x-forwarded-host') || headers.get('host');
  if (!rawHost) return undefined;
  const cleanHost = rawHost.split(',')[0].trim();
  if (!cleanHost || cleanHost.startsWith('0.0.0.0')) {
    return undefined;
  }
  const forwardedProto = headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanHost);
  const proto = forwardedProto || (isLocal ? 'http' : 'https');
  return `${proto}://${cleanHost}`;
}

export function buildStorefrontUrl(
  slug: string,
  options?: {
    tableNumber?: string;
    baseOrigin?: string;
    mode?: QrRoutingMode;
  }
): string {
  const cleanSlug = slugify(slug) || slug.trim().toLowerCase() || 'warungmakan';
  const mode = options?.mode ?? getQrRoutingMode();
  const tableQuery = options?.tableNumber
    ? `?table=${encodeURIComponent(options.tableNumber)}`
    : '';

  if (mode === 'subdomain') {
    const rootDomain = DEFAULT_ROOT_DOMAIN.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return `https://${cleanSlug}.${rootDomain}${tableQuery}`;
  }

  const origin = normalizeBaseOrigin(options?.baseOrigin);
  return `${origin}/${cleanSlug}${tableQuery}`;
}

export function formatStorefrontDisplayUrl(
  slug: string,
  baseOrigin?: string,
  mode?: QrRoutingMode
): string {
  return buildStorefrontUrl(slug, { baseOrigin, mode }).replace(/^https?:\/\//i, '');
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

