import { NextRequest, NextResponse } from 'next/server';
import {
  createMagicToken,
  createUuid,
  dispatchWhatsAppNotification,
  getStore,
  saveStore,
} from '@/lib/store';
import { formatIdr, normalizeWhatsapp } from '@/lib/utils';
import { Order, OrderStatus, OrderType, PaymentStatus, PaymentType } from '@/types/schema';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const merchant = store.merchants[0];
    const branch = store.branches[0];

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

    // Mark table occupied if walk-in table order
    if (orderType === OrderType.WALK_IN_TABLE && tableNumber) {
      const tbl = store.tableSessions.find(
        (t) => t.tableNumber.toUpperCase() === tableNumber.toUpperCase()
      );
      if (tbl) {
        tbl.isOccupied = true;
        tbl.activeOrderId = newOrder.id;
      }
    }

    saveStore(store);

    // Step 1 of Asynchronous 2-Step Verification Loop:
    // Fire Saber Central WA Bot alert to Merchant WA with single-use magic link
    const magicLinkUrl = `/cashier/orders?magicToken=${encodeURIComponent(magicToken)}`;
    dispatchWhatsAppNotification({
      recipientPhone: merchant.ownerWhatsapp,
      recipientRole: 'MERCHANT',
      eventType: 'NEW_ORDER_MAGIC_LINK',
      orderNumber,
      messageBody: `🔔 [SABER CENTRAL BOT] Pesanan Baru #${orderNumber} (${
        newOrder.tableNumber || newOrder.orderType
      } - ${customerName}) sebesar ${formatIdr(
        totalAmountIdr
      )} menunggu Konfirmasi Stok Dapur. Klik Magic Link untuk audit stok & tagih pembayaran.`,
      magicLinkUrl,
    });

    return NextResponse.json({
      success: true,
      order: newOrder,
      trackingUrl: `/order/${newOrder.id}`,
      magicLinkUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memproses checkout pesanan' },
      { status: 500 }
    );
  }
}

