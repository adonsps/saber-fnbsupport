import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get('slug') || '').toLowerCase().trim();
  const slugRegex = /^[a-z0-9-]+$/;

  if (!slug || slug.length < 3) {
    return NextResponse.json({
      valid: false,
      available: false,
      message: 'Subdomain slug minimal 3 karakter huruf kecil, angka, atau tanda hubung (-).',
    });
  }

  if (!slugRegex.test(slug)) {
    return NextResponse.json({
      valid: false,
      available: false,
      message: 'Format hanya boleh huruf kecil a-z, angka 0-9, dan tanda hubung (-).',
    });
  }

  const reserved = new Set(['admin', 'cashier', 'api', 'www', 'staging', 'onboarding', 'order', 'checkout']);
  if (reserved.has(slug)) {
    return NextResponse.json({
      valid: true,
      available: false,
      message: `Subdomain "${slug}.saberconsulting.id" dicadangkan oleh sistem.`,
    });
  }

  const store = getStore();
  const exists = store.merchants.some((m) => m.slug.toLowerCase() === slug && m.slug !== 'warungmakan');

  return NextResponse.json({
    valid: true,
    available: !exists,
    subdomain: `${slug}.saberconsulting.id`,
    message: exists
      ? `Subdomain "${slug}.saberconsulting.id" sudah digunakan merchant lain.`
      : `Tersedia! ${slug}.saberconsulting.id siap digunakan.`,
  });
}

