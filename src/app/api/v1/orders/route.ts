import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  createUuid,
  dispatchWhatsAppNotification,
  getScopedMerchantBundle,
  getStore,
  resolveWorkspaceMerchant,
  saveStore,
} from '@/lib/store';
import { formatIdr, getOriginFromHeaders, normalizeBaseOrigin } from '@/lib/utils';
import { OrderStatus, PaymentStatus, PaymentType } from '@/types/schema';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const store = getStore();
  const magicToken = req.nextUrl.searchParams.get('magicToken');
  const highlightedOrder = magicToken
    ? store.orders.find((o) => o.magicToken === magicToken)
    : undefined;

  // If magicToken points to a specific branch's order, resolve directly to that merchant
  const branchFromMagic = highlightedOrder
    ? store.branches.find((b) => b.id === highlightedOrder.branchId)
    : undefined;
  const merchantFromMagic = branchFromMagic
    ? store.merchants.find((m) => m.id === branchFromMagic.merchantId)
    : undefined;

  const explicitSlug = req.nextUrl.searchParams.get('slug');
  const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
  const merchant =
    merchantFromMagic || resolveWorkspaceMerchant(store, explicitSlug || cookieSlug);

  const bundle = getScopedMerchantBundle(store, merchant);

  return NextResponse.json(
    {
      merchant: bundle.merchant,
      branch: bundle.branch,
      orders: bundle.orders,
      tables: bundle.tables,
      whatsappLogs: bundle.whatsappLogs.slice(0, 25),
      highlightedOrderId: highlightedOrder?.id || null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const origin = normalizeBaseOrigin(getOriginFromHeaders(req.headers));

    // Action 1: Merge Tables (combine items from sourceOrderId into targetOrderId)
    if (body.action === 'merge_tables') {
      const sourceOrder = store.orders.find((o) => o.id === body.sourceOrderId);
      const targetOrder = store.orders.find((o) => o.id === body.targetOrderId);

      if (!sourceOrder || !targetOrder || sourceOrder.id === targetOrder.id) {
        return NextResponse.json(
          { error: 'Pilih dua pesanan meja berbeda untuk digabung.' },
          { status: 400 }
        );
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

      if (sourceOrder.tableNumber) {
        const srcTable = store.tableSessions.find(
          (t) =>
            t.branchId === sourceOrder.branchId &&
            t.tableNumber.toUpperCase() === sourceOrder.tableNumber?.toUpperCase()
        );
        if (srcTable) {
          srcTable.isOccupied = false;
          srcTable.activeOrderId = undefined;
        }
      }

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

    // Action 2: Move Table
    if (body.action === 'move_table' && body.newTableNumber) {
      const oldTableNum = order.tableNumber;
      const newTableNum = String(body.newTableNumber).toUpperCase();

      if (oldTableNum) {
        const oldTable = store.tableSessions.find(
          (t) =>
            t.branchId === branch.id &&
            t.tableNumber.toUpperCase() === oldTableNum.toUpperCase()
        );
        if (oldTable) {
          oldTable.isOccupied = false;
          oldTable.activeOrderId = undefined;
        }
      }

      const newTable = store.tableSessions.find(
        (t) => t.branchId === branch.id && t.tableNumber.toUpperCase() === newTableNum
      );
      if (newTable) {
        newTable.isOccupied = true;
        newTable.activeOrderId = order.id;
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

    // Action 4: Customer uploads payment receipt proof
    if (body.action === 'upload_receipt' && body.receiptImageUrl) {
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

      const bundle = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        order,
        orders: bundle.orders,
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

    // Action 6: Generic status transition (e.g. IN_KITCHEN -> READY_FOR_DELIVERY -> COMPLETED)
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

      // Automated Session Reset when order transitions to COMPLETED
      if (nextStatus === OrderStatus.COMPLETED && order.tableNumber) {
        const tbl = store.tableSessions.find(
          (t) =>
            t.branchId === branch.id &&
            t.tableNumber.toUpperCase() === order.tableNumber?.toUpperCase()
        );
        if (tbl) {
          tbl.isOccupied = false;
          tbl.activeOrderId = undefined;
        }
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
