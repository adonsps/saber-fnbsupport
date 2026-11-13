import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  createUuid,
  dispatchWhatsAppNotification,
  getAuthenticatedMerchant,
  getScopedMerchantBundle,
  getStore,
  isDemoMerchant,
  resolveAuthorizedWorkspaceMerchant,
  sanitizeMerchant,
  saveStore,
} from '@/lib/store';
import { formatIdr, getOriginFromHeaders, normalizeBaseOrigin } from '@/lib/utils';
import { Order, OrderStatus, PaymentStatus, PaymentType } from '@/types/schema';

export const dynamic = 'force-dynamic';

function releaseOrderTable(
  store: ReturnType<typeof getStore>,
  branchId: string,
  order: Pick<Order, 'id' | 'tableNumber'>
) {
  store.tableSessions.forEach((t) => {
    if (t.branchId !== branchId) return;
    const existingIds = Array.isArray(t.activeOrderIds)
      ? t.activeOrderIds.filter((id) => id !== order.id)
      : t.activeOrderId && t.activeOrderId !== order.id
        ? [t.activeOrderId]
        : [];
    const matchesOrder =
      t.activeOrderId === order.id ||
      (Array.isArray(t.activeOrderIds) && t.activeOrderIds.includes(order.id));
    const matchesTableWithoutOtherOrder =
      order.tableNumber &&
      t.tableNumber.toUpperCase() === order.tableNumber.toUpperCase() &&
      existingIds.length === 0;
    if (matchesOrder || matchesTableWithoutOtherOrder) {
      t.activeOrderIds = existingIds;
      t.activeOrderId = existingIds[0];
      t.isOccupied = existingIds.length > 0;
    }
  });
}

export async function GET(req: NextRequest) {
  const store = getStore();
  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value;
  const activeSlugCookie = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
  const authedMerchant = getAuthenticatedMerchant(store, sessionCookie);

  const magicToken = req.nextUrl.searchParams.get('magicToken');
  const highlightedOrder = magicToken
    ? store.orders.find((o) => o.magicToken === magicToken)
    : undefined;

  if (highlightedOrder) {
    const branchFromMagic = store.branches.find((b) => b.id === highlightedOrder.branchId);
    const merchantFromMagic = branchFromMagic
      ? store.merchants.find((m) => m.id === branchFromMagic.merchantId)
      : undefined;

    if (merchantFromMagic) {
      if (!isDemoMerchant(merchantFromMagic) && authedMerchant?.id !== merchantFromMagic.id) {
        return NextResponse.json(
          {
            requiresAuth: true,
            error: 'Silakan login sebagai pemilik restoran untuk membuka pesanan ini.',
          },
          { status: 401 }
        );
      }

      const bundle = getScopedMerchantBundle(store, merchantFromMagic);
      return NextResponse.json(
        {
          merchant: sanitizeMerchant(bundle.merchant),
          branch: bundle.branch,
          orders: bundle.orders,
          tables: bundle.tables,
          whatsappLogs: bundle.whatsappLogs.slice(0, 25),
          highlightedOrderId: highlightedOrder.id,
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  const explicitSlug = req.nextUrl.searchParams.get('slug');
  const { merchant, deniedRequestedSlug } = resolveAuthorizedWorkspaceMerchant(store, {
    sessionCookie,
    activeSlugCookie,
    requestedSlug: explicitSlug,
  });

  if (deniedRequestedSlug) {
    return NextResponse.json(
      { requiresAuth: true, error: 'Akses ditolak.' },
      { status: 403 }
    );
  }

  const bundle = getScopedMerchantBundle(store, merchant);

  return NextResponse.json(
    {
      merchant: sanitizeMerchant(bundle.merchant),
      branch: bundle.branch,
      orders: bundle.orders,
      tables: bundle.tables,
      whatsappLogs: bundle.whatsappLogs.slice(0, 25),
      highlightedOrderId: null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const authedMerchant = getAuthenticatedMerchant(
      store,
      req.cookies.get(SESSION_COOKIE)?.value
    );
    const origin = normalizeBaseOrigin(getOriginFromHeaders(req.headers));

    const canManageBranch = (branchId: string) => {
      const branch = store.branches.find((b) => b.id === branchId);
      const m = branch ? store.merchants.find((mr) => mr.id === branch.merchantId) : undefined;
      if (!m) return false;
      return isDemoMerchant(m) || authedMerchant?.id === m.id;
    };

    // Action 1: Merge Tables (cashier operation — must belong to authorized same branch)
    if (body.action === 'merge_tables') {
      const sourceOrder = store.orders.find((o) => o.id === body.sourceOrderId);
      const targetOrder = store.orders.find((o) => o.id === body.targetOrderId);

      if (
        !sourceOrder ||
        !targetOrder ||
        sourceOrder.id === targetOrder.id ||
        sourceOrder.branchId !== targetOrder.branchId
      ) {
        return NextResponse.json(
          { error: 'Pilih dua pesanan meja berbeda dalam cabang yang sama untuk digabung.' },
          { status: 400 }
        );
      }

      if (!canManageBranch(targetOrder.branchId)) {
        return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      }

      sourceOrder.items.forEach((srcItem) => {
        const existing = targetOrder.items.find((i) => i.menuItemId === srcItem.menuItemId);
        if (existing) {
          existing.quantity += srcItem.quantity;
          existing.totalPriceIdr = existing.quantity * existing.unitPriceIdr;
        } else {
          targetOrder.items.push({
            ...srcItem,
            id: createUuid(),
            orderId: targetOrder.id,
          });
        }
      });

      targetOrder.subtotalIdr = targetOrder.items.reduce((sum, i) => sum + i.totalPriceIdr, 0);
      targetOrder.totalAmountIdr =
        targetOrder.subtotalIdr + Number(targetOrder.deliveryFeeIdr || 0);
      targetOrder.specialNotes = [
        targetOrder.specialNotes,
        `[Merged dari #${sourceOrder.orderNumber} / ${sourceOrder.tableNumber || 'Walk-in'}]`,
      ]
        .filter(Boolean)
        .join(' • ');
      targetOrder.updatedAt = new Date().toISOString();

      releaseOrderTable(store, sourceOrder.branchId, sourceOrder);

      sourceOrder.orderStatus = OrderStatus.CANCELLED;
      sourceOrder.updatedAt = new Date().toISOString();

      saveStore(store);

      const branch =
        store.branches.find((b) => b.id === targetOrder.branchId) || store.branches[0];
      const merchant =
        store.merchants.find((m) => m.id === branch.merchantId) || store.merchants[0];
      const bundle = getScopedMerchantBundle(store, merchant);

      return NextResponse.json({
        success: true,
        targetOrder,
        orders: bundle.orders,
        tables: bundle.tables,
      });
    }

    const order = store.orders.find((o) => o.id === body.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const branch = store.branches.find((b) => b.id === order.branchId) || store.branches[0];
    const merchant = store.merchants.find((m) => m.id === branch.merchantId) || store.merchants[0];

    // Action 4: Customer uploads payment receipt proof (customer action allowed via order UUID)
    if (body.action === 'upload_receipt' && body.receiptImageUrl) {
      if (
        order.orderStatus === OrderStatus.CANCELLED ||
        order.orderStatus === OrderStatus.COMPLETED
      ) {
        return NextResponse.json(
          {
            error:
              order.orderStatus === OrderStatus.CANCELLED
                ? 'Pesanan ini telah dibatalkan dan tidak dapat menerima bukti bayar baru.'
                : 'Pesanan ini sudah selesai.',
          },
          { status: 409 }
        );
      }

      const receipt = {
        id: createUuid(),
        orderId: order.id,
        receiptImageUrl: String(body.receiptImageUrl),
        uploadedAt: new Date().toISOString(),
      };
      order.receipts.unshift(receipt);
      order.paymentStatus = PaymentStatus.PROOF_UPLOADED;
      order.orderStatus = OrderStatus.PAYMENT_PENDING_APPROVAL;
      order.updatedAt = new Date().toISOString();
      saveStore(store);

      const cashierUrl = `${origin}/cashier/orders?magicToken=${encodeURIComponent(
        order.magicToken || ''
      )}`;
      await dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: merchant.ownerWhatsapp,
        recipientRole: 'MERCHANT',
        eventType: 'RECEIPT_UPLOADED',
        orderNumber: order.orderNumber,
        messageBody: `🧾 *[${merchant.name}] Bukti Bayar Diunggah*\nPesanan *#${order.orderNumber}* (${order.customerName}) sebesar *${formatIdr(order.totalAmountIdr)}* menunggu verifikasi kasir:`,
        magicLinkUrl: cashierUrl,
      });

      return NextResponse.json({
        success: true,
        order,
      });
    }

    // All remaining actions are strictly Merchant / Cashier operations
    if (!canManageBranch(order.branchId)) {
      return NextResponse.json(
        { error: 'Akses ditolak. Login pemilik restoran dibutuhkan.' },
        { status: 403 }
      );
    }

    // Action 2: Move Table (preserves concurrent activeOrderIds on both old and new tables)
    if (body.action === 'move_table' && body.newTableNumber) {
      const newTableNum = String(body.newTableNumber).toUpperCase();

      releaseOrderTable(store, branch.id, order);

      const newTable = store.tableSessions.find(
        (t) => t.branchId === branch.id && t.tableNumber.toUpperCase() === newTableNum
      );
      if (newTable) {
        const nextIds = Array.isArray(newTable.activeOrderIds)
          ? newTable.activeOrderIds.slice()
          : newTable.activeOrderId
            ? [newTable.activeOrderId]
            : [];
        if (!nextIds.includes(order.id)) nextIds.push(order.id);
        newTable.activeOrderIds = nextIds;
        if (!newTable.activeOrderId) {
          newTable.activeOrderId = order.id;
        }
        newTable.isOccupied = true;
      }

      order.tableNumber = newTableNum;
      order.updatedAt = new Date().toISOString();
      saveStore(store);

      const bundle = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        order,
        orders: bundle.orders,
        tables: bundle.tables,
      });
    }

    // Action 3: Partial Stock Audit & Line-Item Quantity Modification
    if (body.action === 'confirm_stock') {
      if (Array.isArray(body.updatedItems)) {
        const filtered = body.updatedItems
          .filter((item: { quantity: number }) => Number(item.quantity) > 0)
          .map(
            (item: {
              id: string;
              menuItemId: string;
              itemTitleSnapshot: string;
              unitPriceIdr: number;
              quantity: number;
              notes?: string;
            }) => {
              const qty = Math.max(Number(item.quantity), 1);
              const unit = Number(item.unitPriceIdr);
              return {
                id: item.id || createUuid(),
                orderId: order.id,
                menuItemId: item.menuItemId,
                itemTitleSnapshot: item.itemTitleSnapshot,
                unitPriceIdr: unit,
                quantity: qty,
                totalPriceIdr: unit * qty,
                notes: item.notes,
              };
            }
          );

        if (filtered.length === 0) {
          return NextResponse.json(
            { error: 'Minimal 1 item harus tersedia untuk konfirmasi, atau batalkan pesanan.' },
            { status: 400 }
          );
        }

        order.items = filtered;
        order.subtotalIdr = filtered.reduce(
          (acc: number, i: { totalPriceIdr: number }) => acc + i.totalPriceIdr,
          0
        );
        order.totalAmountIdr = order.subtotalIdr + Number(order.deliveryFeeIdr || 0);
      }

      order.orderStatus = OrderStatus.AWAITING_PAYMENT;
      order.updatedAt = new Date().toISOString();
      saveStore(store);

      const trackingUrl = `${origin}/order/${order.id}`;
      await dispatchWhatsAppNotification({
        merchantId: merchant.id,
        recipientPhone: order.customerWhatsapp,
        recipientRole: 'CUSTOMER',
        eventType: 'STOCK_CONFIRMED_INVOICE',
        orderNumber: order.orderNumber,
        messageBody:
          order.paymentType === PaymentType.BANK_TRANSFER_QRIS
            ? `✅ Halo *${order.customerName}*! Stok pesanan *#${order.orderNumber}* di *${merchant.name}* telah dikonfirmasi dapur.\n\nTotal tagihan: *${formatIdr(order.totalAmountIdr)}*\nSilakan bayar via QRIS / ${branch.bankName} ${branch.bankAccountNumber} (a.n ${branch.bankAccountHolder}) lalu unggah bukti bayar di tautan ini:`
            : `✅ Halo *${order.customerName}*! Stok pesanan *#${order.orderNumber}* telah dikonfirmasi. Total tagihan: *${formatIdr(order.totalAmountIdr)}*. Silakan selesaikan pembayaran tunai di kasir.`,
        magicLinkUrl: trackingUrl,
      });

      const bundle = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        order,
        orders: bundle.orders,
        whatsappLogs: bundle.whatsappLogs.slice(0, 25),
      });
    }

    // Action 5: Cashier verifies or rejects receipt
    if (body.action === 'verify_receipt') {
      const approved = Boolean(body.approved);
      const latestReceipt = order.receipts[0];
      const trackingUrl = `${origin}/order/${order.id}`;

      if (approved) {
        if (latestReceipt) {
          latestReceipt.verifiedAt = new Date().toISOString();
          latestReceipt.verifiedByStaffId = body.staffId || 'KASIR-UTAMA';
        }
        order.paymentStatus = PaymentStatus.VERIFIED;
        order.orderStatus = OrderStatus.IN_KITCHEN;
        order.updatedAt = new Date().toISOString();
        saveStore(store);

        await dispatchWhatsAppNotification({
          merchantId: merchant.id,
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'PAYMENT_APPROVED_KITCHEN',
          orderNumber: order.orderNumber,
          messageBody: `🍳 Pembayaran pesanan *#${order.orderNumber}* di *${merchant.name}* sebesar *${formatIdr(order.totalAmountIdr)}* telah diverifikasi! Pesanan Anda sedang dimasak di dapur.`,
          magicLinkUrl: trackingUrl,
        });
      } else {
        if (latestReceipt) {
          latestReceipt.rejectionReason =
            body.rejectionReason || 'Bukti transfer buram atau nominal belum sesuai.';
        }
        order.paymentStatus = PaymentStatus.REJECTED;
        order.orderStatus = OrderStatus.AWAITING_PAYMENT;
        order.updatedAt = new Date().toISOString();
        saveStore(store);

        await dispatchWhatsAppNotification({
          merchantId: merchant.id,
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'RECEIPT_REJECTED',
          orderNumber: order.orderNumber,
          messageBody: `⚠️ Halo *${order.customerName}*, bukti pembayaran untuk pesanan *#${order.orderNumber}* memerlukan unggah ulang (${body.rejectionReason || 'Nominal/foto kurang jelas'}). Silakan unggah kembali lewat tautan ini:`,
          magicLinkUrl: trackingUrl,
        });
      }

      const bundle = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        order,
        orders: bundle.orders,
        whatsappLogs: bundle.whatsappLogs.slice(0, 25),
      });
    }

    // Action 6: Generic status transition (e.g. IN_KITCHEN -> READY_FOR_DELIVERY -> COMPLETED -> CANCELLED)
    if (body.orderStatus) {
      const nextStatus = body.orderStatus as OrderStatus;
      order.orderStatus = nextStatus;
      order.updatedAt = new Date().toISOString();

      if (nextStatus === OrderStatus.IN_KITCHEN && order.paymentType === PaymentType.CASH) {
        order.paymentStatus = PaymentStatus.VERIFIED;
      }

      if (nextStatus === OrderStatus.READY_FOR_DELIVERY) {
        await dispatchWhatsAppNotification({
          merchantId: merchant.id,
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'ORDER_READY_SERVED',
          orderNumber: order.orderNumber,
          messageBody:
            order.orderType === 'SELF_DELIVERY'
              ? `🛵 Pesanan *#${order.orderNumber}* dari *${merchant.name}* sudah siap dan kurir toko sedang menuju alamat Anda!`
              : `🍽️ Pesanan *#${order.orderNumber}* (${order.tableNumber || 'Pick-Up'}) di *${merchant.name}* sudah siap disajikan! Selamat menikmati.`,
          magicLinkUrl: `${origin}/order/${order.id}`,
        });
      }

      if (nextStatus === OrderStatus.CANCELLED) {
        const cancelReason = body.cancelReason ? String(body.cancelReason).trim() : '';
        if (cancelReason) {
          order.specialNotes = [order.specialNotes, `[Dibatalkan Kasir: ${cancelReason}]`]
            .filter(Boolean)
            .join(' • ');
        }
        releaseOrderTable(store, branch.id, order);

        await dispatchWhatsAppNotification({
          merchantId: merchant.id,
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'RECEIPT_REJECTED',
          orderNumber: order.orderNumber,
          messageBody: `❌ Halo *${order.customerName}*, mohon maaf pesanan *#${order.orderNumber}* di *${merchant.name}* terpaksa dibatalkan${cancelReason ? ` (${cancelReason})` : ''}. Anda dapat memesan ulang lewat menu kami:`,
          magicLinkUrl: `${origin}/${merchant.slug}`,
        });
      }

      if (nextStatus === OrderStatus.COMPLETED) {
        releaseOrderTable(store, branch.id, order);
      }

      saveStore(store);
      const bundle = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        order,
        orders: bundle.orders,
        tables: bundle.tables,
        whatsappLogs: bundle.whatsappLogs.slice(0, 25),
      });
    }

    return NextResponse.json({ error: 'Tidak ada aksi perubahan yang valid' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui pesanan' },
      { status: 500 }
    );
  }
}
