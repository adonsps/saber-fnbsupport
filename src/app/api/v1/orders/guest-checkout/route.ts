import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  createMagicToken,
  createUuid,
  dispatchWhatsAppNotification,
  getMerchantBySlug,
  getScopedMerchantBundle,
  getStore,
  resolveWorkspaceMerchant,
  saveStore,
} from '@/lib/store';
import {
  formatIdr,
  getOriginFromHeaders,
  normalizeBaseOrigin,
  normalizeWhatsapp,
} from '@/lib/utils';
import { Order, OrderStatus, OrderType, PaymentStatus, PaymentType } from '@/types/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
    const requestedSlug = body.slug ? String(body.slug).trim().toLowerCase() : undefined;

    const merchant = requestedSlug
      ? getMerchantBySlug(store, requestedSlug)
      : resolveWorkspaceMerchant(store, cookieSlug);

    if (!merchant) {
      return NextResponse.json(
        { error: `Restoran "/${requestedSlug}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    const bundle = getScopedMerchantBundle(store, merchant);
    const branch = bundle.branch;

    if (!merchant.isStoreOpen) {
      return NextResponse.json(
        { error: 'Maaf, toko sedang menjeda pesanan baru (Store Paused).' },
        { status: 403 }
      );
    }

    const customerName = String(body.customerName || '').trim();
    const customerWhatsapp = normalizeWhatsapp(String(body.customerWhatsapp || ''));
    const orderType: OrderType = body.orderType || OrderType.WALK_IN_TABLE;
    const paymentType: PaymentType = body.paymentType || PaymentType.BANK_TRANSFER_QRIS;
    const tableNumber = body.tableNumber ? String(body.tableNumber).trim().toUpperCase() : undefined;
    const deliveryAddress = body.deliveryAddress ? String(body.deliveryAddress).trim() : undefined;
    const scheduledPickupTime = body.scheduledPickupTime || undefined;
    const specialNotes = body.specialNotes ? String(body.specialNotes).trim() : undefined;

    if (!customerName || !customerWhatsapp) {
      return NextResponse.json(
        { error: 'Nama pelanggan dan nomor WhatsApp wajib diisi.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Keranjang pesanan masih kosong.' }, { status: 400 });
    }

    const orderId = createUuid();
    const nextNum = 1025 + store.orders.length;
    const orderNumber = `ORD-${nextNum}`;

    const orderItems = body.items.map((item: { menuItemId: string; quantity: number; notes?: string }) => {
      const found = store.menuItems.find((m) => m.id === item.menuItemId);
      const unitPrice = found ? Number(found.priceIdr) : 0;
      const qty = Math.max(Number(item.quantity || 1), 1);
      return {
        id: createUuid(),
        orderId,
        menuItemId: item.menuItemId,
        itemTitleSnapshot: found ? found.titleId : 'Menu Spesial',
        unitPriceIdr: unitPrice,
        quantity: qty,
        totalPriceIdr: unitPrice * qty,
        notes: item.notes,
      };
    });

    const subtotalIdr = orderItems.reduce((acc: number, i: { totalPriceIdr: number }) => acc + i.totalPriceIdr, 0);
    const deliveryFeeIdr =
      orderType === OrderType.SELF_DELIVERY && branch.isSelfDeliveryEnabled
        ? Number(branch.deliveryFeeIdr || 0)
        : 0;
    const totalAmountIdr = subtotalIdr + deliveryFeeIdr;
    const magicToken = createMagicToken(orderNumber);
    const now = new Date().toISOString();

    const newOrder: Order = {
      id: orderId,
      branchId: branch.id,
      orderNumber,
      orderType,
      orderStatus: OrderStatus.PENDING_STOCK_CONFIRMATION,
      customerName,
      customerWhatsapp,
      tableNumber: orderType === OrderType.WALK_IN_TABLE ? tableNumber || 'WALK-IN' : undefined,
      deliveryAddress: orderType === OrderType.SELF_DELIVERY ? deliveryAddress : undefined,
      scheduledPickupTime: orderType === OrderType.PRE_ORDER_PICKUP ? scheduledPickupTime : undefined,
      subtotalIdr,
      deliveryFeeIdr,
      totalAmountIdr,
      specialNotes,
      paymentType,
      paymentStatus: PaymentStatus.UNPAID,
      magicToken,
      createdAt: now,
      updatedAt: now,
      items: orderItems,
      receipts: [],
    };

    store.orders.unshift(newOrder);

    // Mark table occupied if walk-in table order in this branch
    if (orderType === OrderType.WALK_IN_TABLE && tableNumber) {
      const tbl = store.tableSessions.find(
        (t) => t.branchId === branch.id && t.tableNumber.toUpperCase() === tableNumber.toUpperCase()
      );
      if (tbl) {
        tbl.isOccupied = true;
        tbl.activeOrderId = newOrder.id;
      }
    }

    saveStore(store);

    const origin = normalizeBaseOrigin(getOriginFromHeaders(req.headers));
    const merchantMagicLink = `${origin}/cashier/orders?magicToken=${encodeURIComponent(magicToken)}`;
    const customerTrackingUrl = `${origin}/order/${newOrder.id}`;
    const itemsSummary = orderItems
      .map((i: { quantity: number; itemTitleSnapshot: string }) => `• ${i.quantity}x ${i.itemTitleSnapshot}`)
      .join('\n');

    // Step 1 of Asynchronous 2-Step Verification Loop (via Fonnte WhatsApp API):
    // 1. Send instant alert + Magic Link to Merchant Owner / Cashier WA
    // 2. Send live order pass confirmation to Customer WA
    await Promise.all([
      dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: merchant.ownerWhatsapp,
        recipientRole: 'MERCHANT',
        eventType: 'NEW_ORDER_MAGIC_LINK',
        orderNumber,
        messageBody: `🔔 *[${merchant.name}] Pesanan Baru #${orderNumber}*\nPelanggan: ${customerName} (${newOrder.tableNumber || newOrder.orderType})\n\n${itemsSummary}\nTotal: *${formatIdr(totalAmountIdr)}*\n\nSegera konfirmasi ketersediaan stok dapur via Magic Link di bawah ini:`,
        magicLinkUrl: merchantMagicLink,
      }),
      dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: customerWhatsapp,
        recipientRole: 'CUSTOMER',
        eventType: 'NEW_ORDER_MAGIC_LINK',
        orderNumber,
        messageBody: `👋 Halo *${customerName}*! Pesanan *#${orderNumber}* di *${merchant.name}* sudah kami terima (${formatIdr(totalAmountIdr)}).\n\nKasir sedang mengecek stok dapur sebentar. Pantau status & nota pembayaran Anda di tautan ini:`,
        magicLinkUrl: customerTrackingUrl,
      }),
    ]);

    return NextResponse.json({
      success: true,
      order: newOrder,
      trackingUrl: `/order/${newOrder.id}`,
      magicLinkUrl: `/cashier/orders?magicToken=${encodeURIComponent(magicToken)}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses checkout pesanan' },
      { status: 500 }
    );
  }
}
