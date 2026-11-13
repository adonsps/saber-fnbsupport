import { OrderStatus, OrderType, PaymentStatus, PaymentType } from '@/types/schema';

export type UiLang = 'ID' | 'EN';

export const LANG_STORAGE_KEY = 'saber_fnb_lang';

export function resolveClientLang(searchParams?: URLSearchParams | null): UiLang {
  const fromQuery = searchParams?.get('lang')?.toUpperCase();
  if (fromQuery === 'EN' || fromQuery === 'ID') {
    return fromQuery;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(LANG_STORAGE_KEY)?.toUpperCase();
      if (saved === 'EN' || saved === 'ID') return saved;
    } catch {
      // Ignore storage failures
    }
  }
  return 'ID';
}

export function persistClientLang(lang: UiLang) {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage failures
    }
  }
}

export function getOrderTypeLabel(type: OrderType | string, lang: UiLang): string {
  switch (type) {
    case OrderType.WALK_IN_TABLE:
      return lang === 'ID' ? 'Makan di Meja (Scan QR)' : 'Dine-In (Table QR)';
    case OrderType.PRE_ORDER_PICKUP:
      return lang === 'ID' ? 'Ambil Sendiri (Pre-Order)' : 'Pre-Order Pickup';
    case OrderType.SELF_DELIVERY:
      return lang === 'ID' ? 'Antar Kurir Toko' : 'Store Self-Delivery';
    default:
      return String(type);
  }
}

export function getPaymentTypeLabel(type: PaymentType | string, lang: UiLang): string {
  switch (type) {
    case PaymentType.CASH:
      return lang === 'ID' ? 'Tunai di Kasir' : 'Cash at Cashier';
    case PaymentType.BANK_TRANSFER_QRIS:
      return lang === 'ID' ? 'QRIS / Transfer Bank' : 'QRIS / Bank Transfer';
    default:
      return String(type);
  }
}

export function getPaymentStatusLabel(status: PaymentStatus | string, lang: UiLang): string {
  switch (status) {
    case PaymentStatus.UNPAID:
      return lang === 'ID' ? 'Belum Dibayar' : 'Unpaid';
    case PaymentStatus.PROOF_UPLOADED:
      return lang === 'ID' ? 'Menunggu Verifikasi Kasir' : 'Awaiting Cashier Verification';
    case PaymentStatus.VERIFIED:
      return lang === 'ID' ? 'Pembayaran Terverifikasi' : 'Payment Verified';
    case PaymentStatus.REJECTED:
      return lang === 'ID' ? 'Bukti Ditolak (Perlu Unggah Ulang)' : 'Proof Rejected (Re-upload Needed)';
    default:
      return String(status);
  }
}

export function getOrderStatusLabel(status: OrderStatus | string, lang: UiLang): string {
  switch (status) {
    case OrderStatus.PENDING_STOCK_CONFIRMATION:
      return lang === 'ID' ? 'Konfirmasi Stok Dapur' : 'Kitchen Stock Confirmation';
    case OrderStatus.AWAITING_PAYMENT:
      return lang === 'ID' ? 'Menunggu Pembayaran' : 'Awaiting Payment';
    case OrderStatus.PAYMENT_PENDING_APPROVAL:
      return lang === 'ID' ? 'Menunggu Verifikasi Bukti' : 'Pending Payment Approval';
    case OrderStatus.IN_KITCHEN:
      return lang === 'ID' ? 'Sedang Dimasak di Dapur' : 'Preparing in Kitchen';
    case OrderStatus.READY_FOR_DELIVERY:
      return lang === 'ID' ? 'Siap Disajikan / Diambil' : 'Ready to Serve / Pickup';
    case OrderStatus.COMPLETED:
      return lang === 'ID' ? 'Pesanan Selesai' : 'Order Completed';
    case OrderStatus.CANCELLED:
      return lang === 'ID' ? 'Pesanan Dibatalkan' : 'Order Cancelled';
    default:
      return String(status);
  }
}
