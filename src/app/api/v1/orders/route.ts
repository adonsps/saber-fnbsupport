import { NextRequest, NextResponse } from 'next/server';
import {
  createUuid,
  dispatchWhatsAppNotification,
  getStore,
  saveStore,
} from '@/lib/store';
import { formatIdr } from '@/lib/utils';
import { OrderStatus, PaymentStatus, PaymentType } from '@/types/schema';

export async function GET(req: NextRequest) {
  const store = getStore();
  const magicToken = req.nextUrl.searchParams.get('magicToken');
  const highlightedOrder = magicToken
    ? store.orders.find((o) => o.magicToken === magicToken)
    : undefined;

  return NextResponse.json({
    merchant: store.merchants[0],
    branch: store.branches[0],
    orders: store.orders,
    tables: store.tableSessions,
    whatsappLogs: store.whatsappLogs.slice(0, 25),
    highlightedOrderId: highlightedOrder?.id || null,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const branch = store.branches[0];

    // Action 1: Merge Tables (combine items from sourceOrderId into targetOrderId)
    if (body.action === 'merge_tables') {
      const sourceOrder = store.orders.find((o) => o.id === body.sourceOrderId);
      const targetOrder = store.orders.find((o) => o.id === body.targetOrderId);

      if (!sourceOrder || !targetOrder || sourceOrder.id === targetOrder.id) {
        return NextResponse.json({ error: 'Pilih dua pesanan meja berbeda untuk digabung.' }, { status: 400 });
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
      targetOrder.totalAmountIdr = targetOrder.subtotalIdr + Number(targetOrder.deliveryFeeIdr || 0);
      targetOrder.specialNotes = [
        targetOrder.specialNotes,
        `[Merged dari #${sourceOrder.orderNumber} / ${sourceOrder.tableNumber || 'Walk-in'}]`,
      ]
        .filter(Boolean)
        .join(' • ');
      targetOrder.updatedAt = new Date().toISOString();

      // Free the source table session
      if (sourceOrder.tableNumber) {
        const srcTable = store.tableSessions.find(
          (t) => t.tableNumber.toUpperCase() === sourceOrder.tableNumber?.toUpperCase()
        );
        if (srcTable) {
          srcTable.isOccupied = false;
          srcTable.activeOrderId = undefined;
        }
      }

      sourceOrder.orderStatus = OrderStatus.CANCELLED;
      sourceOrder.updatedAt = new Date().toISOString();

      saveStore(store);
      return NextResponse.json({
        success: true,
        targetOrder,
        orders: store.orders,
        tables: store.tableSessions,
      });
    }

    const order = store.orders.find((o) => o.id === body.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // Action 2: Move Table
    if (body.action === 'move_table' && body.newTableNumber) {
      const oldTableNum = order.tableNumber;
      const newTableNum = String(body.newTableNumber).toUpperCase();

      if (oldTableNum) {
        const oldTable = store.tableSessions.find(
          (t) => t.tableNumber.toUpperCase() === oldTableNum.toUpperCase()
        );
        if (oldTable) {
          oldTable.isOccupied = false;
          oldTable.activeOrderId = undefined;
        }
      }

      const newTable = store.tableSessions.find(
        (t) => t.tableNumber.toUpperCase() === newTableNum
      );
      if (newTable) {
        newTable.isOccupied = true;
        newTable.activeOrderId = order.id;
      }

      order.tableNumber = newTableNum;
      order.updatedAt = new Date().toISOString();
      saveStore(store);
      return NextResponse.json({
        success: true,
        order,
        orders: store.orders,
        tables: store.tableSessions,
      });
    }

    // Action 3: Partial Stock Audit & Line-Item Quantity Modification
    if (body.action === 'confirm_stock') {
      if (Array.isArray(body.updatedItems)) {
        const filtered = body.updatedItems
          .filter((item: { quantity: number }) => Number(item.quantity) > 0)
          .map((item: { id: string; menuItemId: string; itemTitleSnapshot: string; unitPriceIdr: number; quantity: number; notes?: string }) => {
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
          });

        order.items = filtered;
        order.subtotalIdr = filtered.reduce((acc: number, i: { totalPriceIdr: number }) => acc + i.totalPriceIdr, 0);
        order.totalAmountIdr = order.subtotalIdr + Number(order.deliveryFeeIdr || 0);
      }

      // If Cash at cashier, can still go to AWAITING_PAYMENT so cashier collects cash or directly to IN_KITCHEN if paid
      order.orderStatus = OrderStatus.AWAITING_PAYMENT;
      order.updatedAt = new Date().toISOString();
      saveStore(store);

      dispatchWhatsAppNotification({
        recipientPhone: order.customerWhatsapp,
        recipientRole: 'CUSTOMER',
        eventType: 'STOCK_CONFIRMED_INVOICE',
        orderNumber: order.orderNumber,
        messageBody:
          order.paymentType === PaymentType.BANK_TRANSFER_QRIS
            ? `✅ Halo ${order.customerName}! Stok pesanan #${order.orderNumber} telah dikonfirmasi dapur. Total tagihan akhir: ${formatIdr(
                order.totalAmountIdr
              )}. Silakan bayar via QRIS Statis / ${branch.bankName} ${branch.bankAccountNumber} a.n ${
                branch.bankAccountHolder
              } dan unggah bukti bayar di tautan pelacakan.`
            : `✅ Halo ${order.customerName}! Stok pesanan #${order.orderNumber} telah dikonfirmasi. Total tagihan: ${formatIdr(
                order.totalAmountIdr
              )}. Silakan selesaikan pembayaran tunai di kasir.`,
        magicLinkUrl: `/order/${order.id}`,
      });

      return NextResponse.json({
        success: true,
        order,
        orders: store.orders,
        whatsappLogs: store.whatsappLogs.slice(0, 25),
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

      return NextResponse.json({
        success: true,
        order,
        orders: store.orders,
      });
    }

    // Action 5: Cashier verifies or rejects receipt
    if (body.action === 'verify_receipt') {
      const approved = Boolean(body.approved);
      const latestReceipt = order.receipts[0];

      if (approved) {
        if (latestReceipt) {
          latestReceipt.verifiedAt = new Date().toISOString();
          latestReceipt.verifiedByStaffId = body.staffId || 'KASIR-UTAMA';
        }
        order.paymentStatus = PaymentStatus.VERIFIED;
        order.orderStatus = OrderStatus.IN_KITCHEN;
        order.updatedAt = new Date().toISOString();

        dispatchWhatsAppNotification({
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'PAYMENT_APPROVED_KITCHEN',
          orderNumber: order.orderNumber,
          messageBody: `🍳 Pembayaran pesanan #${order.orderNumber} sebesar ${formatIdr(
            order.totalAmountIdr
          )} telah diverifikasi! Pesanan Anda sedang dimasak di dapur.`,
          magicLinkUrl: `/order/${order.id}`,
        });
      } else {
        if (latestReceipt) {
          latestReceipt.rejectionReason =
            body.rejectionReason || 'Bukti transfer buram atau nominal belum sesuai.';
        }
        order.paymentStatus = PaymentStatus.REJECTED;
        order.orderStatus = OrderStatus.AWAITING_PAYMENT;
        order.updatedAt = new Date().toISOString();

        dispatchWhatsAppNotification({
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'RECEIPT_REJECTED',
          orderNumber: order.orderNumber,
          messageBody: `⚠️ Halo ${order.customerName}, bukti pembayaran untuk pesanan #${order.orderNumber} memerlukan unggah ulang (${
            body.rejectionReason || 'Nominal/foto kurang jelas'
          }). Silakan unggah kembali di halaman pesanan.`,
          magicLinkUrl: `/order/${order.id}`,
        });
      }

      saveStore(store);
      return NextResponse.json({
        success: true,
        order,
        orders: store.orders,
        whatsappLogs: store.whatsappLogs.slice(0, 25),
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
        dispatchWhatsAppNotification({
          recipientPhone: order.customerWhatsapp,
          recipientRole: 'CUSTOMER',
          eventType: 'ORDER_READY_SERVED',
          orderNumber: order.orderNumber,
          messageBody:
            order.orderType === 'SELF_DELIVERY'
              ? `🛵 Pesanan #${order.orderNumber} sudah siap dan kurir toko sedang menuju alamat Anda!`
              : `🍽️ Pesanan #${order.orderNumber} (${
                  order.tableNumber || 'Pick-Up'
                }) sudah siap disajikan! Selamat menikmati.`,
          magicLinkUrl: `/order/${order.id}`,
        });
      }

      // NON-NEGOTIABLE RULE: Automated Session Reset when order transitions to COMPLETED
      if (nextStatus === OrderStatus.COMPLETED && order.tableNumber) {
        const tbl = store.tableSessions.find(
          (t) => t.tableNumber.toUpperCase() === order.tableNumber?.toUpperCase()
        );
        if (tbl) {
          tbl.isOccupied = false;
          tbl.activeOrderId = undefined;
        }
      }

      saveStore(store);
      return NextResponse.json({
        success: true,
        order,
        orders: store.orders,
        tables: store.tableSessions,
        whatsappLogs: store.whatsappLogs.slice(0, 25),
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

