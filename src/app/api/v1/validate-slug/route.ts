import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import {
  buildStorefrontUrl,
  formatStorefrontDisplayUrl,
  getOriginFromHeaders,
  isReservedSlug,
} from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get('slug') || '').toLowerCase().trim();
  const slugRegex = /^[a-z0-9-]+$/;
  const origin = getOriginFromHeaders(req.headers);

  if (!slug || slug.length < 3) {
    return NextResponse.json({
      valid: false,
      available: false,
      message: 'Slug URL toko minimal 3 karakter huruf kecil, angka, atau tanda hubung (-).',
    });
  }

  if (!slugRegex.test(slug)) {
    return NextResponse.json({
      valid: false,
      available: false,
      message: 'Format hanya boleh huruf kecil a-z, angka 0-9, dan tanda hubung (-).',
    });
  }

  const displayUrl = formatStorefrontDisplayUrl(slug, origin);

  if (isReservedSlug(slug)) {
    return NextResponse.json({
      valid: true,
      available: false,
      message: `URL "${displayUrl}" dicadangkan oleh sistem.`,
    });
  }

  const store = getStore();
  const exists = store.merchants.some((m) => m.slug.toLowerCase() === slug && m.slug !== 'warungmakan');

  return NextResponse.json({
    valid: true,
    available: !exists,
    subdomain: displayUrl,
    storefrontUrl: buildStorefrontUrl(slug, { baseOrigin: origin }),
    message: exists
      ? `URL "${displayUrl}" sudah digunakan merchant lain.`
      : `Tersedia! ${displayUrl} siap digunakan tanpa perlu setting DNS.`,
  });
}

