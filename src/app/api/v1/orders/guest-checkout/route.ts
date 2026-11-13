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
import { evaluateStoreHours, formatScheduledWib, validateScheduledDateTime } from '@/lib/store-hours';
import { buildGoogleMapsUrl, haversineDistanceKm, parseLatLng } from '@/lib/geo';
import { getOrderTypeLabel } from '@/lib/order-labels';
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

    const hoursCheck = evaluateStoreHours(branch.operationalHours);
    if (!hoursCheck.isWithinHours) {
      return NextResponse.json(
        {
          error: `Maaf, toko sedang di luar jam operasional (${hoursCheck.statusLabelId}).`,
        },
        { status: 403 }
      );
    }

    const customerName = String(body.customerName || '').trim();
    const customerWhatsapp = normalizeWhatsapp(String(body.customerWhatsapp || ''));
    const orderType: OrderType = body.orderType || OrderType.WALK_IN_TABLE;
    const paymentType: PaymentType = body.paymentType || PaymentType.BANK_TRANSFER_QRIS;
    const tableNumber = body.tableNumber ? String(body.tableNumber).trim().toUpperCase() : undefined;
    const deliveryAddress = body.deliveryAddress ? String(body.deliveryAddress).trim() : undefined;
    const rawScheduledPickupTime = body.scheduledPickupTime
      ? String(body.scheduledPickupTime).trim()
      : undefined;
    const rawScheduledDeliveryTime = body.scheduledDeliveryTime
      ? String(body.scheduledDeliveryTime).trim()
      : undefined;
    const specialNotes = body.specialNotes ? String(body.specialNotes).trim() : undefined;

    if (!customerName || !customerWhatsapp) {
      return NextResponse.json(
        { error: 'Nama pelanggan dan nomor WhatsApp wajib diisi.' },
        { status: 400 }
      );
    }

    if (!Object.values(OrderType).includes(orderType)) {
      return NextResponse.json({ error: 'Jenis pesanan tidak valid.' }, { status: 400 });
    }

    if (!Object.values(PaymentType).includes(paymentType)) {
      return NextResponse.json({ error: 'Metode pembayaran tidak valid.' }, { status: 400 });
    }

    let deliveryCoords: { lat: number; lng: number } | null = null;
    let deliveryDistanceKm: number | undefined;
    let validatedScheduledPickupTime: string | undefined;
    let validatedScheduledDeliveryTime: string | undefined;

    if (orderType === OrderType.SELF_DELIVERY) {
      if (!branch.isSelfDeliveryEnabled) {
        return NextResponse.json(
          { error: 'Layanan antar kurir toko sedang tidak tersedia.' },
          { status: 400 }
        );
      }
      if (!deliveryAddress) {
        return NextResponse.json(
          { error: 'Alamat pengantaran wajib diisi untuk pesanan antar.' },
          { status: 400 }
        );
      }
      deliveryCoords = parseLatLng(body.deliveryLat, body.deliveryLng);
      if (
        deliveryCoords &&
        typeof branch.branchLat === 'number' &&
        typeof branch.branchLng === 'number'
      ) {
        deliveryDistanceKm = haversineDistanceKm(
          { lat: branch.branchLat, lng: branch.branchLng },
          deliveryCoords
        );
        if (branch.maxDeliveryRadiusKm > 0 && deliveryDistanceKm > branch.maxDeliveryRadiusKm) {
          return NextResponse.json(
            {
              error: `Jarak pengantaran (${deliveryDistanceKm.toFixed(1)} km) melebihi batas radius kurir toko (${branch.maxDeliveryRadiusKm} km).`,
            },
            { status: 400 }
          );
        }
      }
      if (rawScheduledDeliveryTime) {
        const schedCheck = validateScheduledDateTime(
          rawScheduledDeliveryTime,
          branch.operationalHours
        );
        if (!schedCheck.valid) {
          return NextResponse.json(
            { error: schedCheck.errorId || 'Waktu pengantaran terjadwal tidak valid.' },
            { status: 400 }
          );
        }
        validatedScheduledDeliveryTime = schedCheck.isoString;
      }
    }

    if (orderType === OrderType.PRE_ORDER_PICKUP) {
      if (!rawScheduledPickupTime) {
        return NextResponse.json(
          { error: 'Waktu pengambilan (Pick-up) wajib dipilih.' },
          { status: 400 }
        );
      }
      const schedCheck = validateScheduledDateTime(
        rawScheduledPickupTime,
        branch.operationalHours
      );
      if (!schedCheck.valid) {
        return NextResponse.json(
          { error: schedCheck.errorId || 'Waktu pengambilan (Pick-up) tidak valid.' },
          { status: 400 }
        );
      }
      validatedScheduledPickupTime = schedCheck.isoString;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Keranjang pesanan masih kosong.' }, { status: 400 });
    }

    const branchCategoryIds = new Set(bundle.categories.map((c) => c.id));
    const orderId = createUuid();
    const nextNum = 1025 + store.orders.length;
    const orderNumber = `ORD-${nextNum}`;

    const orderItems = [];
    for (const item of body.items as Array<{
      menuItemId: string;
      quantity: number;
      notes?: string;
    }>) {
      const found = bundle.menuItems.find(
        (m) => m.id === item.menuItemId && branchCategoryIds.has(m.categoryId)
      );
      if (!found) {
        return NextResponse.json(
          { error: 'Terdapat item menu yang tidak ditemukan atau bukan milik toko ini.' },
          { status: 400 }
        );
      }
      if (found.isSoldOut) {
        return NextResponse.json(
          { error: `Maaf, menu "${found.titleId}" baru saja habis (Sold Out).` },
          { status: 400 }
        );
      }
      const unitPrice = Number(found.priceIdr);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return NextResponse.json(
          { error: `Harga menu "${found.titleId}" tidak valid.` },
          { status: 400 }
        );
      }
      const qty = Math.floor(Number(item.quantity));
      if (!Number.isFinite(qty) || qty < 1) {
        return NextResponse.json(
          { error: `Jumlah item "${found.titleId}" harus minimal 1.` },
          { status: 400 }
        );
      }
      orderItems.push({
        id: createUuid(),
        orderId,
        menuItemId: found.id,
        itemTitleSnapshot: found.titleId,
        unitPriceIdr: unitPrice,
        quantity: qty,
        totalPriceIdr: unitPrice * qty,
        notes: item.notes,
      });
    }

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
      deliveryLat: orderType === OrderType.SELF_DELIVERY ? deliveryCoords?.lat : undefined,
      deliveryLng: orderType === OrderType.SELF_DELIVERY ? deliveryCoords?.lng : undefined,
      deliveryDistanceKm: orderType === OrderType.SELF_DELIVERY ? deliveryDistanceKm : undefined,
      scheduledPickupTime:
        orderType === OrderType.PRE_ORDER_PICKUP ? validatedScheduledPickupTime : undefined,
      scheduledDeliveryTime:
        orderType === OrderType.SELF_DELIVERY ? validatedScheduledDeliveryTime : undefined,
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

    // Mark table occupied if walk-in table order in this branch (preserve concurrent activeOrderIds)
    if (orderType === OrderType.WALK_IN_TABLE && tableNumber) {
      const tbl = store.tableSessions.find(
        (t) => t.branchId === branch.id && t.tableNumber.toUpperCase() === tableNumber.toUpperCase()
      );
      if (tbl) {
        const existingIds = Array.isArray(tbl.activeOrderIds)
          ? tbl.activeOrderIds.slice()
          : tbl.activeOrderId
            ? [tbl.activeOrderId]
            : [];
        if (!existingIds.includes(newOrder.id)) {
          existingIds.push(newOrder.id);
        }
        tbl.activeOrderIds = existingIds;
        if (!tbl.activeOrderId) {
          tbl.activeOrderId = newOrder.id;
        }
        tbl.isOccupied = true;
      }
    }

    saveStore(store);

    const origin = normalizeBaseOrigin(getOriginFromHeaders(req.headers));
    const merchantMagicLink = `${origin}/cashier/orders?magicToken=${encodeURIComponent(magicToken)}`;
    const customerTrackingUrl = `${origin}/order/${newOrder.id}`;
    const itemsSummary = orderItems
      .map((i: { quantity: number; itemTitleSnapshot: string }) => `• ${i.quantity}x ${i.itemTitleSnapshot}`)
      .join('\n');

    const channelLabel = getOrderTypeLabel(orderType, 'ID');
    const fulfillmentLines: string[] = [];
    if (orderType === OrderType.WALK_IN_TABLE && newOrder.tableNumber) {
      fulfillmentLines.push(`Meja: *${newOrder.tableNumber}*`);
    }
    if (orderType === OrderType.SELF_DELIVERY && newOrder.deliveryAddress) {
      fulfillmentLines.push(`Alamat Antar: ${newOrder.deliveryAddress}`);
      if (typeof newOrder.deliveryLat === 'number' && typeof newOrder.deliveryLng === 'number') {
        const distNote =
          typeof newOrder.deliveryDistanceKm === 'number'
            ? ` (${newOrder.deliveryDistanceKm.toFixed(1)} km)`
            : '';
        fulfillmentLines.push(
          `Pin Maps${distNote}: ${buildGoogleMapsUrl(newOrder.deliveryLat, newOrder.deliveryLng)}`
        );
      }
      if (newOrder.scheduledDeliveryTime) {
        fulfillmentLines.push(`Jadwal Antar: ${formatScheduledWib(newOrder.scheduledDeliveryTime, 'id')}`);
      } else {
        fulfillmentLines.push(`Jadwal Antar: Segera (ASAP)`);
      }
    }
    if (orderType === OrderType.PRE_ORDER_PICKUP && newOrder.scheduledPickupTime) {
      fulfillmentLines.push(`Jadwal Ambil: ${formatScheduledWib(newOrder.scheduledPickupTime, 'id')}`);
    }
    const fulfillmentBlock = fulfillmentLines.length > 0 ? `\n${fulfillmentLines.join('\n')}` : '';

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
        messageBody: `🔔 *[${merchant.name}] Pesanan Baru #${orderNumber}*\nPelanggan: ${customerName} (${channelLabel})${fulfillmentBlock}\n\n${itemsSummary}\nTotal: *${formatIdr(totalAmountIdr)}*\n\nSegera konfirmasi ketersediaan stok dapur via Magic Link di bawah ini:`,
        magicLinkUrl: merchantMagicLink,
      }),
      dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: customerWhatsapp,
        recipientRole: 'CUSTOMER',
        eventType: 'NEW_ORDER_MAGIC_LINK',
        orderNumber,
        messageBody: `👋 Halo *${customerName}*! Pesanan *#${orderNumber}* (${channelLabel}) di *${merchant.name}* sudah kami terima (${formatIdr(totalAmountIdr)}).${fulfillmentBlock}\n\nKasir sedang mengecek stok dapur sebentar. Pantau status & nota pembayaran Anda di tautan ini:`,
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
