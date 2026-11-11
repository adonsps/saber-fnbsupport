import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  getMerchantBySlug,
  getStore,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = String(body.slug || '').trim().toLowerCase();
    const store = getStore();
    const merchant = getMerchantBySlug(store, slug);

    if (!merchant) {
      return NextResponse.json(
        { error: `Restoran dengan slug "/${slug}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    const res = NextResponse.json({
      success: true,
      merchant,
    });
    res.cookies.set(ACTIVE_MERCHANT_COOKIE, merchant.slug, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengganti workspace' },
      { status: 500 }
    );
  }
}

