import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  hashOtpCode,
  hashPassword,
  sanitizeMerchant,
  signSessionToken,
} from '@/lib/auth';
import {
  dispatchWhatsAppNotification,
  getStore,
  isDemoMerchant,
  saveStore,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

const RequestOtpSchema = z.object({
  email: z.string().email('Masukkan alamat email terdaftar Anda.'),
});

const ResetPasswordSchema = z.object({
  email: z.string().email('Email tidak valid.'),
  otp: z.string().regex(/^\d{6}$/, 'Kode OTP harus 6 digit angka.'),
  newPassword: z.string().min(8, 'Kata sandi baru minimal 8 karakter.'),
});

function isHttpsRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  if (proto) return proto === 'https';
  return req.url.startsWith('https://');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RequestOtpSchema.safeParse({
      email: String(body.email || '').trim().toLowerCase(),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Email tidak valid.' },
        { status: 400 }
      );
    }

    const store = getStore();
    const merchant = store.merchants.find(
      (m) => !isDemoMerchant(m) && m.email?.toLowerCase() === parsed.data.email
    );

    if (merchant) {
      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = hashOtpCode(otp, merchant.id);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      store.passwordResets = (store.passwordResets || []).filter(
        (r) => r.merchantId !== merchant.id && Date.parse(r.expiresAt) > Date.now()
      );
      store.passwordResets.push({
        merchantId: merchant.id,
        otpHash,
        expiresAt,
      });
      saveStore(store);

      await dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: merchant.ownerWhatsapp,
        recipientRole: 'MERCHANT',
        eventType: 'NEW_ORDER_MAGIC_LINK',
        orderNumber: 'OTP-RESET',
        messageBody: `🔐 *[Saber Culinary] Kode Reset Kata Sandi*\nHalo ${merchant.ownerName}, kode OTP untuk mengatur ulang kata sandi akun *${merchant.name}* adalah:\n\n*${otp}*\n\nBerlaku selama 10 menit. Jangan bagikan kode ini kepada siapa pun.`,
        forceRealSend: true,
      });
    }

    // Always return neutral response to prevent account email enumeration
    return NextResponse.json({
      success: true,
      message:
        'Jika email terdaftar, kode OTP 6 digit telah dikirimkan ke WhatsApp pemilik restoran.',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengirim OTP reset kata sandi' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse({
      email: String(body.email || '').trim().toLowerCase(),
      otp: String(body.otp || '').trim(),
      newPassword: String(body.newPassword || ''),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Data reset tidak valid.' },
        { status: 400 }
      );
    }

    const { email, otp, newPassword } = parsed.data;
    const store = getStore();
    const merchant = store.merchants.find(
      (m) => !isDemoMerchant(m) && m.email?.toLowerCase() === email
    );

    const resetRecord = merchant
      ? (store.passwordResets || []).find((r) => r.merchantId === merchant.id)
      : undefined;

    if (!merchant || !resetRecord || Date.parse(resetRecord.expiresAt) < Date.now()) {
      return NextResponse.json(
        { error: 'Kode OTP tidak valid atau sudah kedaluwarsa.' },
        { status: 400 }
      );
    }

    const candidateHash = hashOtpCode(otp, merchant.id);
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(resetRecord.otpHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json(
        { error: 'Kode OTP tidak sesuai. Periksa pesan WhatsApp Anda.' },
        { status: 400 }
      );
    }

    const { salt, hash } = hashPassword(newPassword);
    merchant.passwordSalt = salt;
    merchant.passwordHash = hash;
    merchant.updatedAt = new Date().toISOString();
    store.passwordResets = (store.passwordResets || []).filter(
      (r) => r.merchantId !== merchant.id
    );
    saveStore(store);

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
      { error: err instanceof Error ? err.message : 'Gagal memperbarui kata sandi' },
      { status: 500 }
    );
  }
}
