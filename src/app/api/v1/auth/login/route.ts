import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  sanitizeMerchant,
  signSessionToken,
  verifyPassword,
} from '@/lib/auth';
import { getStore, isDemoMerchant } from '@/lib/store';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email('Masukkan alamat email yang valid.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (proto) return proto === 'https';
  return req.url.startsWith('https://');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse({
      email: String(body.email || '').trim().toLowerCase(),
      password: String(body.password || ''),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Email dan kata sandi wajib diisi.' },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const store = getStore();
    const merchant = store.merchants.find(
      (m) => !isDemoMerchant(m) && m.email?.toLowerCase() === email
    );

    if (!merchant || !verifyPassword(password, merchant.passwordSalt, merchant.passwordHash)) {
      return NextResponse.json(
        { error: 'Email atau kata sandi salah. Periksa kembali kredensial Anda.' },
        { status: 401 }
      );
    }

    const sessionToken = signSessionToken(merchant.id, merchant.slug);
    const secureCookie = isHttpsRequest(req);

    const res = NextResponse.json({
      success: true,
      merchant: sanitizeMerchant(merchant),
    });

    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie,
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    res.cookies.set(ACTIVE_MERCHANT_COOKIE, merchant.slug, {
      sameSite: 'lax',
      secure: secureCookie,
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });

    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses login' },
      { status: 500 }
    );
  }
}
