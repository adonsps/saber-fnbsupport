import { NextRequest, NextResponse } from 'next/server';
import { dispatchWhatsAppNotification, getStore } from '@/lib/store';
import { normalizeWhatsapp } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    gateway: 'Saber Centralized Automated WhatsApp Gateway Bot v2.4',
    status: 'CONNECTED',
    zeroMerchantConfig: true,
    logs: store.whatsappLogs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const recipientPhone = normalizeWhatsapp(String(body.recipientPhone || '+6281288990011'));
    const recipientRole = body.recipientRole === 'MERCHANT' ? 'MERCHANT' : 'CUSTOMER';
    const eventType = body.eventType || 'STOCK_CONFIRMED_INVOICE';
    const orderNumber = String(body.orderNumber || 'ORD-1024');
    const messageBody = String(
      body.messageBody ||
        `[SABER CENTRAL WA BOT] Update status untuk pesanan #${orderNumber}.`
    );
    const magicLinkUrl = body.magicLinkUrl ? String(body.magicLinkUrl) : undefined;

    const dispatched = dispatchWhatsAppNotification({
      recipientPhone,
      recipientRole,
      eventType,
      orderNumber,
      messageBody,
      magicLinkUrl,
    });

    return NextResponse.json({
      success: true,
      dispatched,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal mengirim webhook WhatsApp' },
      { status: 500 }
    );
  }
}

