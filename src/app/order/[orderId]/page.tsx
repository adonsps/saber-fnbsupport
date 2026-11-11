'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BellRinging,
  Check,
  Clock,
  CookingPot,
  Package,
  QrCode,
  Receipt,
} from '@phosphor-icons/react';
import { Branch, Merchant, Order, OrderStatus, PaymentStatus, PaymentType } from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';

const PROGRESS_STEPS = [
  {
    key: OrderStatus.PENDING_STOCK_CONFIRMATION,
    label: 'Order Received',
    sub: 'Awaiting Cashier Stock Verification',
    icon: Clock,
  },
  {
    key: OrderStatus.AWAITING_PAYMENT,
    label: 'Stock Confirmed & Payment Requested',
    sub: 'Silakan bayar QRIS / Transfer / Kasir',
    icon: QrCode,
  },
  {
    key: OrderStatus.PAYMENT_PENDING_APPROVAL,
    label: 'Payment Proof Audit',
    sub: 'Kasir sedang memeriksa bukti transfer',
    icon: Receipt,
  },
  {
    key: OrderStatus.IN_KITCHEN,
    label: 'Payment Approved & In Kitchen',
    sub: 'Pesanan sedang dimasak & disiapkan',
    icon: CookingPot,
  },
  {
    key: OrderStatus.READY_FOR_DELIVERY,
    label: 'Ready / Out for Delivery',
    sub: 'Siap disajikan ke meja / diantar kurir',
    icon: BellRinging,
  },
  {
    key: OrderStatus.COMPLETED,
    label: 'Completed',
    sub: 'Pesanan selesai & lunas',
    icon: Package,
  },
];

function getStepIndex(status: OrderStatus): number {
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

export default function LiveOrderTrackingPage() {
  const routeParams = useParams<{ orderId: string }>();
  const orderId = routeParams?.orderId || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const qrisZoomDialogRef = useRef<HTMLDialogElement>(null);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setMerchant(data.merchant);
        setBranch(data.branch);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const timer = setInterval(fetchOrder, 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleCopy = (label: string, text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1600);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !receiptPreview) return;
    setUploading(true);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          action: 'upload_receipt',
          receiptImageUrl: receiptPreview,
        }),
      });
      const data = await res.json();
      if (data.order) {
        setOrder(data.order);
        setReceiptPreview(null);
      }
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs font-medium text-[#515154]">Loading order pass...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-950">Pesanan Tidak Ditemukan</h1>
        <Link
          href="/warungmakan"
          className="mt-4 inline-block rounded-full bg-apple-blue px-6 py-2.5 text-xs font-bold text-white"
        >
          Kembali ke Menu
        </Link>
      </div>
    );
  }

  const currentStepIdx = getStepIndex(order.orderStatus);
  const showPaymentPanel =
    (order.orderStatus === OrderStatus.AWAITING_PAYMENT ||
      order.paymentStatus === PaymentStatus.REJECTED) &&
    order.paymentType === PaymentType.BANK_TRANSFER_QRIS;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
      {/* Signature Tactile Order Pass (.saber-ticket-pass) */}
      <div className="saber-ticket-pass rounded-[24px] p-6 sm:p-8">
        <div className="saber-ticket-divider flex flex-wrap items-start justify-between gap-4 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-apple-blue/10 px-3 py-1 text-[11px] font-bold text-apple-blue">
                Live Order Pass
              </span>
              <span className="font-mono text-xs font-bold text-[#515154]">
                #{order.orderNumber}
              </span>
            </div>
            <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#1D1D1F]">
              {merchant?.name}
            </h1>
            <p className="mt-0.5 text-xs text-[#515154]">
              Guest: <strong className="text-[#1D1D1F]">{order.customerName}</strong> •{' '}
              {order.tableNumber || order.orderType}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrder}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-black/[0.1] bg-[#F5F5F7] px-4 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
            >
              Sync Pass
            </button>
            <Link
              href={`/order/${order.id}/receipt`}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-4 py-2 text-xs font-semibold text-white hover:bg-apple-blueHover"
            >
              View Invoice
            </Link>
          </div>
        </div>

        {/* Rejected Receipt Warning */}
        {order.paymentStatus === PaymentStatus.REJECTED && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-[#D70015]"
          >
            <p className="font-bold">Bukti Pembayaran Perlu Diunggah Ulang</p>
            <p className="mt-0.5">
              {order.receipts[0]?.rejectionReason ||
                'Kasir meminta unggah ulang foto bukti transfer yang lebih jelas.'}
            </p>
          </div>
        )}

        {/* Real-Time 6-Stage Progress Stepper */}
        <ol className="mt-6 space-y-3">
          {PROGRESS_STEPS.map((st, idx) => {
            const Icon = st.icon;
            const isCompleted = idx < currentStepIdx || order.orderStatus === OrderStatus.COMPLETED;
            const isCurrent = idx === currentStepIdx && order.orderStatus !== OrderStatus.COMPLETED;

            return (
              <li
                key={st.key}
                className={cn(
                  'flex items-center gap-3.5 rounded-2xl border p-3.5 transition-all',
                  isCurrent
                    ? 'border-apple-blue bg-apple-blue/5 shadow-sm'
                    : isCompleted
                    ? 'border-emerald-500/20 bg-emerald-50/50'
                    : 'border-black/[0.04] bg-[#F5F5F7]/50 opacity-60'
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    isCompleted
                      ? 'bg-apple-green text-white'
                      : isCurrent
                      ? 'bg-apple-blue text-white'
                      : 'bg-zinc-200 text-zinc-500'
                  )}
                >
                  {isCompleted ? (
                    <Check aria-hidden="true" weight="bold" className="h-5 w-5" />
                  ) : (
                    <Icon aria-hidden="true" weight="duotone" className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-950">{st.label}</p>
                  <p className="text-xs text-zinc-500">{st.sub}</p>
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-apple-blue px-2.5 py-0.5 text-[10px] font-bold text-white">
                    ACTIVE
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Payment Panel Component (Active when Stock Confirmed & Payment Requested) */}
      {showPaymentPanel && (
        <section className="mt-6 rounded-[28px] border-2 border-apple-blue/30 bg-white p-6 shadow-apple-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-4">
            <div>
              <span className="rounded-full bg-apple-blue/10 px-2.5 py-0.5 text-[11px] font-bold text-apple-blue">
                Stok Terkonfirmasi • Tagihan Siap Dibayar
              </span>
              <h2 className="mt-1.5 text-xl font-bold text-zinc-950">
                Total Bayar:{' '}
                <span className="font-mono text-apple-blue">
                  {formatIdr(order.totalAmountIdr)}
                </span>
              </h2>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Static QRIS with Zoom Preview */}
            <div className="flex flex-col items-center rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4">
              {branch?.qrisImageUrl && (
                <button
                  type="button"
                  onClick={() => qrisZoomDialogRef.current?.showModal()}
                  className="apple-interactive group relative overflow-hidden rounded-2xl border border-black/10 bg-white p-2 shadow-sm"
                >
                  <img
                    src={branch.qrisImageUrl}
                    alt="Static QRIS"
                    className="h-60 w-48 object-contain"
                  />
                  <span className="liquid-glass-clear absolute bottom-3 right-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold text-white">
                    Zoom QRIS
                  </span>
                </button>
              )}
            </div>

            {/* Bank Details + Receipt Upload Widget */}
            <div className="flex flex-col justify-between space-y-4">
              <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4 text-xs">
                <p className="font-bold text-zinc-950">Atau Transfer Manual Bank</p>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Bank</span>
                  <span className="font-bold text-zinc-950">{branch?.bankName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">No. Rekening</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('rek', branch?.bankAccountNumber)}
                    className="apple-interactive inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono font-bold text-apple-blue shadow-sm"
                  >
                    <span>{branch?.bankAccountNumber}</span>
                    <span className="text-[10px] font-semibold uppercase text-[#515154]">
                      {copiedField === 'rek' ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Atas Nama</span>
                  <span className="font-semibold text-zinc-900">{branch?.bankAccountHolder}</span>
                </div>
                <div className="flex items-center justify-between border-t border-black/[0.06] pt-2">
                  <span className="text-zinc-500">Nominal Tepat</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('amt', String(order.totalAmountIdr))}
                    className="apple-interactive inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono font-bold text-zinc-950 shadow-sm"
                  >
                    <span>{formatIdr(order.totalAmountIdr)}</span>
                    <span className="text-[10px] font-semibold uppercase text-[#515154]">
                      {copiedField === 'amt' ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitReceipt} className="space-y-3">
                <p className="text-xs font-bold text-zinc-950">Upload Transfer Receipt Image</p>
                {receiptPreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 p-2">
                    <img
                      src={receiptPreview}
                      alt="Preview Bukti Transfer"
                      className="mx-auto max-h-40 rounded-xl object-contain"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <label className="apple-interactive inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-xs font-bold text-zinc-800 hover:bg-zinc-50">
                    <span>{receiptPreview ? 'Ganti Gambar' : 'Pilih Foto Bukti Bayar'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={!receiptPreview || uploading}
                    className="apple-interactive inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-apple-blue px-5 text-xs font-bold text-white shadow-apple-sm hover:bg-apple-blueHover disabled:opacity-50"
                  >
                    {uploading ? 'Mengunggah...' : 'Kirim Bukti Pembayaran'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Order Itemized Breakdown */}
      <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
        <h2 className="text-sm font-bold text-zinc-950">Rincian Menu Pesanan</h2>
        <div className="mt-3 divide-y divide-black/[0.05] text-xs">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-semibold text-zinc-950">
                  <span className="font-mono text-apple-blue">{item.quantity}×</span>{' '}
                  {item.itemTitleSnapshot}
                </p>
                {item.notes && <p className="text-[11px] text-zinc-500">Catatan: {item.notes}</p>}
              </div>
              <span className="font-mono font-bold tabular-nums text-zinc-950">
                {formatIdr(item.totalPriceIdr)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1.5 border-t border-black/[0.08] pt-3 text-xs">
          <div className="flex justify-between text-zinc-600">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatIdr(order.subtotalIdr)}</span>
          </div>
          {order.deliveryFeeIdr > 0 && (
            <div className="flex justify-between text-zinc-600">
              <span>Ongkos Kirim</span>
              <span className="font-mono tabular-nums">{formatIdr(order.deliveryFeeIdr)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold text-zinc-950">
            <span>Total Tagihan</span>
            <span className="font-mono tabular-nums text-apple-blue">
              {formatIdr(order.totalAmountIdr)}
            </span>
          </div>
        </div>
      </section>

      {/* Native <dialog> Zoom QRIS Modal (HIG Sheet Anatomy per sheets.md) */}
      <dialog
        ref={qrisZoomDialogRef}
        aria-labelledby="qris-zoom-title"
        className="w-full max-w-md rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => qrisZoomDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Done
          </button>
          <h3 id="qris-zoom-title" className="text-sm font-bold text-[#1D1D1F]">
            Scan Static QRIS — {merchant?.name}
          </h3>
          <span className="min-w-[44px]" />
        </div>
        <div className="p-5">
          {branch?.qrisImageUrl && (
            <img
              src={branch.qrisImageUrl}
              alt="Zoomed Static QRIS"
              className="mx-auto w-full rounded-2xl border border-black/5"
            />
          )}
        </div>
      </dialog>
    </div>
  );
}

