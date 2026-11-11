import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  getAuthenticatedMerchant,
  getMerchantBySlug,
  getStore,
  isDemoMerchant,
  sanitizeMerchant,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body.slug || '').trim().toLowerCase();
    const store = getStore();
    const targetMerchant = getMerchantBySlug(store, slug);

    if (!targetMerchant) {
      return NextResponse.json(
        { error: `Restoran "/${slug}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    const authedMerchant = getAuthenticatedMerchant(
      store,
      req.cookies.get(SESSION_COOKIE)?.value
    );

    // Strictly allow switching only to Demo Sandbox OR the caller's own signed-in restaurant
    if (!isDemoMerchant(targetMerchant) && authedMerchant?.id !== targetMerchant.id) {
      return NextResponse.json(
        { error: 'Akses ditolak. Silakan login sebagai pemilik restoran terkait.' },
        { status: 403 }
      );
    }

    const res = NextResponse.json({
      success: true,
      merchant: sanitizeMerchant(targetMerchant),
    });
    res.cookies.set(ACTIVE_MERCHANT_COOKIE, targetMerchant.slug, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengganti workspace' },
      { status: 500 }
    );
  }
}
