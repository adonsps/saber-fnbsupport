import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  dispatchWhatsAppNotification,
  getScopedMerchantBundle,
  getStore,
  resolveAuthorizedWorkspaceMerchant,
} from '@/lib/store';
import { getOriginFromHeaders, normalizeBaseOrigin, normalizeWhatsapp } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const store = getStore();
  const { merchant } = resolveAuthorizedWorkspaceMerchant(store, {
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
  });
  const bundle = getScopedMerchantBundle(store, merchant);

  return NextResponse.json({
    gateway: 'Saber Centralized Automated WhatsApp Gateway',
    status: process.env.FONNTE_API_TOKEN ? 'CONNECTED' : 'TOKEN_MISSING',
    gatewayConfigured: Boolean(process.env.FONNTE_API_TOKEN),
    zeroMerchantConfig: true,
    logs: bundle.whatsappLogs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const { merchant, deniedRequestedSlug } = resolveAuthorizedWorkspaceMerchant(store, {
      sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
      activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
      requestedSlug: body.slug,
    });

    if (deniedRequestedSlug) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const origin = normalizeBaseOrigin(getOriginFromHeaders(req.headers));

    const recipientPhone = normalizeWhatsapp(
      String(body.recipientPhone || merchant.ownerWhatsapp || '+6281288990011')
    );
    const recipientRole = body.recipientRole === 'MERCHANT' ? 'MERCHANT' : 'CUSTOMER';
    const eventType = body.eventType || 'STOCK_CONFIRMED_INVOICE';
    const orderNumber = String(body.orderNumber || 'TEST-WA');
    const messageBody = String(
      body.messageBody ||
        `[SABER WA BOT] Uji koneksi notifikasi WhatsApp berhasil untuk *${merchant.name}* (#${orderNumber}).`
    );
    const magicLinkUrl = body.magicLinkUrl
      ? String(body.magicLinkUrl).startsWith('http')
        ? String(body.magicLinkUrl)
        : `${origin}${String(body.magicLinkUrl)}`
      : undefined;

    const dispatched = await dispatchWhatsAppNotification({
      merchantId: merchant.id,
      recipientPhone,
      recipientRole,
      eventType,
      orderNumber,
      messageBody,
      magicLinkUrl,
      forceRealSend: true,
    });

    return NextResponse.json({
      success: dispatched.deliveryStatus !== 'FAILED',
      dispatched,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengirim webhook WhatsApp' },
      { status: 500 }
    );
  }
}
