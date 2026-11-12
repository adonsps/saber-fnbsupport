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
  XCircle,
} from '@phosphor-icons/react';
import { Branch, Merchant, Order, OrderStatus, PaymentStatus, PaymentType } from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';
import { prepareReceiptUploadDataUrl, useDialogLightDismiss } from '@/lib/client-helpers';
import {
  getOrderTypeLabel,
  persistClientLang,
  resolveClientLang,
  UiLang,
} from '@/lib/order-labels';

const PROGRESS_STEPS = [
  {
    key: OrderStatus.PENDING_STOCK_CONFIRMATION,
    labelId: 'Pesanan Diterima',
    labelEn: 'Order Received',
    subId: 'Menunggu kasir memeriksa ketersediaan stok',
    subEn: 'Awaiting cashier stock verification',
    icon: Clock,
  },
  {
    key: OrderStatus.AWAITING_PAYMENT,
    labelId: 'Stok Tersedia • Menunggu Pembayaran',
    labelEn: 'Stock Confirmed & Payment Requested',
    subId: 'Silakan bayar via QRIS / Transfer / Kasir',
    subEn: 'Please pay via QRIS / Bank Transfer / Cashier',
    icon: QrCode,
  },
  {
    key: OrderStatus.PAYMENT_PENDING_APPROVAL,
    labelId: 'Verifikasi Bukti Bayar',
    labelEn: 'Payment Proof Audit',
    subId: 'Kasir sedang memeriksa bukti transfer Anda',
    subEn: 'Cashier is reviewing your payment proof',
    icon: Receipt,
  },
  {
    key: OrderStatus.IN_KITCHEN,
    labelId: 'Pembayaran Disetujui • Sedang Dimasak',
    labelEn: 'Payment Approved & In Kitchen',
    subId: 'Pesanan Anda sedang disiapkan di dapur',
    subEn: 'Your order is being prepared in kitchen',
    icon: CookingPot,
  },
  {
    key: OrderStatus.READY_FOR_DELIVERY,
    labelId: 'Siap Disajikan / Diantar',
    labelEn: 'Ready / Out for Delivery',
    subId: 'Siap disajikan ke meja, diambil, atau diantar kurir',
    subEn: 'Ready to serve, pickup, or out with courier',
    icon: BellRinging,
  },
  {
    key: OrderStatus.COMPLETED,
    labelId: 'Pesanan Selesai',
    labelEn: 'Completed',
    subId: 'Terima kasih! Pesanan selesai & lunas',
    subEn: 'Thank you! Order completed & settled',
    icon: Package,
  },
];

function getStepIndex(status: OrderStatus): number {
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

export default function LiveOrderTrackingPage() {
  const routeParams = useParams<{ orderId: string }>();
  const orderId = routeParams?.orderId || '';
  const [lang, setLang] = useState<UiLang>('ID');
  const [order, setOrder] = useState<Order | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [allowReupload, setAllowReupload] = useState(false);
  const qrisZoomDialogRef = useRef<HTMLDialogElement>(null);

  useDialogLightDismiss(qrisZoomDialogRef);

  useEffect(() => {
    setLang(
      resolveClientLang(
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      )
    );
  }, []);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`, {
        cache: 'no-store',
      });
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);
    setProcessingPhoto(true);
    try {
      const compressedDataUrl = await prepareReceiptUploadDataUrl(file);
      setReceiptPreview(compressedDataUrl);
    } catch (err) {
      setReceiptPreview(null);
      setUploadError(
        err instanceof Error
          ? err.message
          : 'Gagal memproses foto bukti pembayaran. Pilih file gambar JPG/PNG.'
      );
    } finally {
      setProcessingPhoto(false);
    }
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !receiptPreview) {
      setUploadError('Pilih foto bukti transfer terlebih dahulu.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(null);
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

      const rawText = await res.text();
      let data: { order?: Order; error?: string } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('Ukuran gambar terlalu besar untuk server. Pilih gambar lebih kecil.');
        }
        throw new Error(data.error || `Gagal mengirim bukti pembayaran (HTTP ${res.status}).`);
      }

      if (!data.order) {
        throw new Error('Server tidak mengembalikan pembaruan pesanan.');
      }

      setOrder(data.order);
      setReceiptPreview(null);
      setAllowReupload(false);
      setUploadSuccess(
        lang === 'ID'
          ? 'Bukti pembayaran terkirim dan langsung diteruskan ke kasir.'
          : 'Payment receipt uploaded and forwarded to the cashier.'
      );
      await fetchOrder();
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : lang === 'ID'
            ? 'Terjadi gangguan jaringan saat mengirim bukti pembayaran.'
            : 'Network error while uploading your receipt.'
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs font-medium text-[#515154]">
          {lang === 'ID' ? 'Memuat status pesanan...' : 'Loading order pass...'}
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-12 text-center">
        <h1 className="text-xl font-bold text-zinc-950">
          {lang === 'ID' ? 'Pesanan Tidak Ditemukan' : 'Order Not Found'}
        </h1>
        <Link
          href="/warungmakan"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-6 py-2.5 text-xs font-bold text-white"
        >
          {lang === 'ID' ? 'Kembali ke Menu' : 'Back to Menu'}
        </Link>
      </div>
    );
  }

  const isCancelled = order.orderStatus === OrderStatus.CANCELLED;
  const currentStepIdx = getStepIndex(order.orderStatus);
  const showPaymentPanel =
    !isCancelled &&
    (order.orderStatus === OrderStatus.AWAITING_PAYMENT ||
      order.paymentStatus === PaymentStatus.REJECTED ||
      allowReupload) &&
    order.paymentType === PaymentType.BANK_TRANSFER_QRIS;
  const hasUploadedProofPendingAudit =
    !isCancelled &&
    order.receipts.length > 0 &&
    order.orderStatus === OrderStatus.PAYMENT_PENDING_APPROVAL &&
    order.paymentStatus === PaymentStatus.PROOF_UPLOADED;

  const menuHref = `/${merchant?.slug || 'warungmakan'}${
    order.tableNumber ? `?table=${encodeURIComponent(order.tableNumber)}` : ''
  }`;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
      {/* Locked Customer Pass Header (strictly isolated to customer storefront & order pass only) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-black/[0.06] bg-white px-4 py-2.5 shadow-apple-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          {branch?.logoUrl && (
            <img
              src={branch.logoUrl}
              alt={merchant?.name || 'Restoran'}
              className="h-8 w-8 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#1D1D1F]">{merchant?.name}</p>
            <p className="font-mono text-[10px] font-semibold text-[#515154]">
              #{order.orderNumber} {order.tableNumber ? `• ${order.tableNumber}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-black/[0.08] bg-[#F5F5F7] p-0.5">
            {(['ID', 'EN'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setLang(code);
                  persistClientLang(code);
                }}
                className={cn(
                  'min-h-[34px] rounded-full px-2.5 text-[11px] font-bold transition-colors',
                  lang === code ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#515154]'
                )}
              >
                {code}
              </button>
            ))}
          </div>
          <Link
            href={menuHref}
            className="apple-interactive inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-black/[0.1] bg-[#F5F5F7] px-3.5 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
          >
            ← {lang === 'ID' ? 'Menu Utama' : 'Menu'}
          </Link>
        </div>
      </div>

      {/* Signature Tactile Order Pass (.saber-ticket-pass) */}
      <div className="saber-ticket-pass rounded-[24px] p-6 sm:p-8">
        <div className="saber-ticket-divider flex flex-wrap items-start justify-between gap-4 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold',
                  isCancelled
                    ? 'bg-red-500/10 text-[#D70015]'
                    : 'bg-apple-blue/10 text-apple-blue'
                )}
              >
                {isCancelled
                  ? lang === 'ID'
                    ? 'Pesanan Dibatalkan'
                    : 'Order Cancelled'
                  : lang === 'ID'
                    ? 'Status Pesanan Langsung'
                    : 'Live Order Pass'}
              </span>
              <span className="font-mono text-xs font-bold text-[#515154]">
                #{order.orderNumber}
              </span>
            </div>
            <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-[#1D1D1F]">
              {merchant?.name}
            </h1>
            <p className="mt-0.5 text-xs text-[#515154]">
              {lang === 'ID' ? 'Pelanggan' : 'Guest'}:{' '}
              <strong className="text-[#1D1D1F]">{order.customerName}</strong> •{' '}
              {order.tableNumber || getOrderTypeLabel(order.orderType, lang)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOrder}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-black/[0.1] bg-[#F5F5F7] px-4 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
            >
              {lang === 'ID' ? 'Segarkan' : 'Sync Pass'}
            </button>
            <Link
              href={`/order/${order.id}/receipt?lang=${lang}`}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-4 py-2 text-xs font-semibold text-white hover:bg-apple-blueHover"
            >
              {lang === 'ID' ? 'Lihat Struk' : 'View Invoice'}
            </Link>
          </div>
        </div>

        {/* Rejected Receipt Warning (hidden when order cancelled) */}
        {!isCancelled && order.paymentStatus === PaymentStatus.REJECTED && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-[#D70015]"
          >
            <p className="font-bold">
              {lang === 'ID'
                ? 'Bukti Pembayaran Perlu Diunggah Ulang'
                : 'Payment Proof Requires Re-upload'}
            </p>
            <p className="mt-0.5">
              {order.receipts[0]?.rejectionReason ||
                (lang === 'ID'
                  ? 'Kasir meminta unggah ulang foto bukti transfer yang lebih jelas.'
                  : 'The cashier requested a clearer transfer receipt photo.')}
            </p>
          </div>
        )}

        {/* Explicit Terminal Cancelled Card (C3) or 6-Stage Progress Stepper */}
        {isCancelled ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#D70015] text-white">
              <XCircle aria-hidden="true" weight="bold" className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-lg font-bold text-[#D70015]">
              {lang === 'ID' ? 'Pesanan Ini Telah Dibatalkan' : 'This Order Was Cancelled'}
            </h2>
            <p className="mx-auto mt-1 max-w-md text-xs text-zinc-700">
              {lang === 'ID'
                ? 'Pesanan tidak diproses lebih lanjut dan meja telah dilepas kembali. Jika Anda masih ingin memesan, silakan buat pesanan baru dari menu restoran.'
                : 'This order will not be processed further and any occupied table has been released. You may place a new order anytime from the menu.'}
            </p>
            {order.specialNotes && (
              <p className="mx-auto mt-3 inline-block rounded-xl border border-red-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#D70015]">
                {order.specialNotes}
              </p>
            )}
            <div className="mt-5 flex justify-center">
              <Link
                href={menuHref}
                className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-6 py-2.5 text-xs font-bold text-white shadow-apple-sm hover:bg-apple-blueHover"
              >
                {lang === 'ID' ? 'Pesan Ulang dari Menu' : 'Order Again from Menu'}
              </Link>
            </div>
          </div>
        ) : (
          <ol className="mt-6 space-y-3">
            {PROGRESS_STEPS.map((st, idx) => {
              const Icon = st.icon;
              const isCompleted = idx < currentStepIdx || order.orderStatus === OrderStatus.COMPLETED;
              const isCurrent =
                idx === currentStepIdx && order.orderStatus !== OrderStatus.COMPLETED;

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
                    <p className="text-sm font-bold text-zinc-950">
                      {lang === 'ID' ? st.labelId : st.labelEn}
                    </p>
                    <p className="text-xs text-zinc-500">{lang === 'ID' ? st.subId : st.subEn}</p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-apple-blue px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {lang === 'ID' ? 'AKTIF' : 'ACTIVE'}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Payment Panel Component (Active when Stock Confirmed & Payment Requested) */}
      {showPaymentPanel && (
        <section className="mt-6 rounded-[28px] border-2 border-apple-blue/30 bg-white p-6 shadow-apple-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] pb-4">
            <div>
              <span className="rounded-full bg-apple-blue/10 px-2.5 py-0.5 text-[11px] font-bold text-apple-blue">
                {lang === 'ID'
                  ? 'Stok Terkonfirmasi • Tagihan Siap Dibayar'
                  : 'Stock Confirmed • Ready for Payment'}
              </span>
              <h2 className="mt-1.5 text-xl font-bold text-zinc-950">
                {lang === 'ID' ? 'Total Bayar:' : 'Total Due:'}{' '}
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
                    {lang === 'ID' ? 'Perbesar QRIS' : 'Zoom QRIS'}
                  </span>
                </button>
              )}
            </div>

            {/* Bank Details + Receipt Upload Widget */}
            <div className="flex flex-col justify-between space-y-4">
              <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4 text-xs">
                <p className="font-bold text-zinc-950">
                  {lang === 'ID' ? 'Atau Transfer Manual Bank' : 'Or Manual Bank Transfer'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Bank</span>
                  <span className="font-bold text-zinc-950">{branch?.bankName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-500">
                    {lang === 'ID' ? 'No. Rekening' : 'Account Number'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('rek', branch?.bankAccountNumber)}
                    className="apple-interactive inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono font-bold text-apple-blue shadow-sm"
                  >
                    <span>{branch?.bankAccountNumber}</span>
                    <span className="text-[10px] font-semibold uppercase text-[#515154]">
                      {copiedField === 'rek'
                        ? lang === 'ID'
                          ? 'Disalin'
                          : 'Copied'
                        : lang === 'ID'
                          ? 'Salin'
                          : 'Copy'}
                    </span>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">
                    {lang === 'ID' ? 'Atas Nama' : 'Account Holder'}
                  </span>
                  <span className="font-semibold text-zinc-900">{branch?.bankAccountHolder}</span>
                </div>
                <div className="flex items-center justify-between border-t border-black/[0.06] pt-2">
                  <span className="text-zinc-500">
                    {lang === 'ID' ? 'Nominal Tepat' : 'Exact Amount'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('amt', String(order.totalAmountIdr))}
                    className="apple-interactive inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-mono font-bold text-zinc-950 shadow-sm"
                  >
                    <span>{formatIdr(order.totalAmountIdr)}</span>
                    <span className="text-[10px] font-semibold uppercase text-[#515154]">
                      {copiedField === 'amt'
                        ? lang === 'ID'
                          ? 'Disalin'
                          : 'Copied'
                        : lang === 'ID'
                          ? 'Salin'
                          : 'Copy'}
                    </span>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitReceipt} className="space-y-3">
                <p className="text-xs font-bold text-zinc-950">
                  {lang === 'ID'
                    ? 'Unggah Foto Bukti Pembayaran'
                    : 'Upload Transfer Receipt Image'}
                </p>

                {uploadError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-[#D70015]"
                  >
                    {uploadError}
                  </div>
                )}

                {uploadSuccess && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-[#1D7D32]"
                  >
                    {uploadSuccess}
                  </div>
                )}

                {processingPhoto ? (
                  <div className="rounded-2xl border border-black/10 bg-zinc-50 p-4 text-center text-xs font-medium text-[#515154]">
                    {lang === 'ID'
                      ? 'Mengoptimalkan ukuran foto bukti pembayaran...'
                      : 'Optimizing receipt photo size...'}
                  </div>
                ) : receiptPreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 p-2">
                    <img
                      src={receiptPreview}
                      alt={lang === 'ID' ? 'Pratinjau Bukti Transfer' : 'Transfer Receipt Preview'}
                      className="mx-auto max-h-40 rounded-xl object-contain"
                    />
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <label className="apple-interactive inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center rounded-full border border-zinc-300 bg-white px-4 text-xs font-bold text-zinc-800 hover:bg-zinc-50">
                    <span>
                      {receiptPreview
                        ? lang === 'ID'
                          ? 'Ganti Gambar'
                          : 'Change Image'
                        : lang === 'ID'
                          ? 'Pilih Foto Bukti Bayar'
                          : 'Select Receipt Photo'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={!receiptPreview || uploading || processingPhoto}
                    className="apple-interactive inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full bg-apple-blue px-5 text-xs font-bold text-white shadow-apple-sm hover:bg-apple-blueHover disabled:opacity-50"
                  >
                    {uploading
                      ? lang === 'ID'
                        ? 'Mengunggah...'
                        : 'Uploading...'
                      : lang === 'ID'
                        ? 'Kirim Bukti Pembayaran'
                        : 'Submit Payment Proof'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Uploaded Proof Confirmation Card (While Waiting for Cashier Audit) */}
      {hasUploadedProofPendingAudit && !allowReupload && (
        <section className="mt-6 rounded-[24px] border border-emerald-500/25 bg-white p-6 shadow-apple-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-[#1D7D32]">
                {lang === 'ID'
                  ? 'Bukti Pembayaran Terkirim • Menunggu Audit Kasir'
                  : 'Payment Proof Submitted • Awaiting Cashier Verification'}
              </span>
              <h2 className="mt-2 text-base font-bold text-zinc-950">
                {lang === 'ID'
                  ? 'Kasir Sedang Memeriksa Bukti Transfer Anda'
                  : 'Cashier Is Reviewing Your Payment Receipt'}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {lang === 'ID' ? 'Diunggah pada ' : 'Uploaded at '}
                {new Date(order.receipts[0].uploadedAt).toLocaleTimeString(
                  lang === 'ID' ? 'id-ID' : 'en-US',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
                {lang === 'ID'
                  ? '. Pesanan akan otomatis masuk dapur setelah disetujui.'
                  : '. Your order moves directly to kitchen once approved.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAllowReupload(true)}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-zinc-200 bg-[#F5F5F7] px-3.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200"
            >
              {lang === 'ID' ? 'Unggah Ulang Foto' : 'Re-upload Photo'}
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.08] bg-zinc-50 p-3">
            <img
              src={order.receipts[0].receiptImageUrl}
              alt={lang === 'ID' ? 'Bukti Pembayaran Terkirim' : 'Submitted Payment Proof'}
              className="mx-auto max-h-60 rounded-xl object-contain"
            />
          </div>
        </section>
      )}

      {/* Order Itemized Breakdown */}
      <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
        <h2 className="text-sm font-bold text-zinc-950">
          {lang === 'ID' ? 'Rincian Menu Pesanan' : 'Order Item Breakdown'}
        </h2>
        <div className="mt-3 divide-y divide-black/[0.05] text-xs">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="font-semibold text-zinc-950">
                  <span className="font-mono text-apple-blue">{item.quantity}×</span>{' '}
                  {item.itemTitleSnapshot}
                </p>
                {item.notes && (
                  <p className="text-[11px] text-zinc-500">
                    {lang === 'ID' ? 'Catatan' : 'Note'}: {item.notes}
                  </p>
                )}
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
              <span>{lang === 'ID' ? 'Ongkos Kirim' : 'Delivery Fee'}</span>
              <span className="font-mono tabular-nums">{formatIdr(order.deliveryFeeIdr)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base font-bold text-zinc-950">
            <span>{lang === 'ID' ? 'Total Tagihan' : 'Total Due'}</span>
            <span className="font-mono tabular-nums text-apple-blue">
              {formatIdr(order.totalAmountIdr)}
            </span>
          </div>
        </div>
      </section>

      {/* Native <dialog> Zoom QRIS Modal (HIG Sheet Anatomy per sheets.md) */}
      <dialog
        ref={qrisZoomDialogRef}
        closedby="any"
        aria-labelledby="qris-zoom-title"
        className="w-full max-w-md rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => qrisZoomDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            {lang === 'ID' ? 'Tutup' : 'Done'}
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

