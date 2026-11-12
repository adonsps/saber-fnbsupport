'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Branch, Merchant, Order, OrderStatus } from '@/types/schema';
import {
  getOrderStatusLabel,
  getOrderTypeLabel,
  getPaymentStatusLabel,
  getPaymentTypeLabel,
  resolveClientLang,
  UiLang,
} from '@/lib/order-labels';
import { cn, formatIdr } from '@/lib/utils';

export default function DigitalWebReceiptPage() {
  const routeParams = useParams<{ orderId: string }>();
  const orderId = routeParams?.orderId || '';
  const [lang, setLang] = useState<UiLang>('ID');
  const [order, setOrder] = useState<Order | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLang(
      resolveClientLang(
        typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      )
    );
  }, []);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setOrder(data.order);
        setMerchant(data.merchant);
        setBranch(data.branch);
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs font-medium text-[#515154]">
          {lang === 'ID' ? 'Memuat struk...' : 'Loading receipt...'}
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-10 text-center text-sm">
        {lang === 'ID' ? 'Struk tidak ditemukan.' : 'Receipt not found.'}
      </div>
    );
  }

  const isCancelled = order.orderStatus === OrderStatus.CANCELLED;

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-10">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/order/${order.id}`}
          className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-apple-sm"
        >
          ← {lang === 'ID' ? 'Kembali ke Status' : 'Back to Status'}
        </Link>
        <div className="flex items-center gap-2">
          {isCancelled && (
            <Link
              href={`/${merchant?.slug || 'warungmakan'}`}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-4 py-2 text-xs font-bold text-white shadow-apple-sm"
            >
              {lang === 'ID' ? 'Pesan Ulang' : 'Reorder'}
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white shadow-apple-sm"
          >
            {lang === 'ID' ? 'Cetak / Simpan PDF' : 'Print / Save PDF'}
          </button>
        </div>
      </div>

      <div className="rounded-[26px] border border-black/[0.08] bg-white p-7 shadow-apple-md">
        <div className="border-b border-dashed border-zinc-300 pb-5 text-center">
          <p className="font-serif text-lg font-bold tracking-tight text-zinc-950">
            {merchant?.name}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">{branch?.address}</p>
          <div
            className={cn(
              'mt-3 inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-bold',
              isCancelled
                ? 'bg-red-500/10 text-[#D70015]'
                : 'bg-emerald-500/10 text-[#1D7D32]'
            )}
          >
            {isCancelled
              ? `${lang === 'ID' ? 'PESANAN DIBATALKAN' : 'CANCELLED'} • #${order.orderNumber}`
              : `${lang === 'ID' ? 'STRUK DIGITAL' : 'DIGITAL WEB RECEIPT'} • #${order.orderNumber}`}
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 border-b border-dashed border-zinc-300 pb-4 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">{lang === 'ID' ? 'Pelanggan' : 'Customer'}</dt>
            <dd className="font-semibold text-zinc-950">{order.customerName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">{lang === 'ID' ? 'Layanan / Meja' : 'Channel / Table'}</dt>
            <dd className="text-right font-semibold text-zinc-950">
              {order.tableNumber || getOrderTypeLabel(order.orderType, lang)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">{lang === 'ID' ? 'Status Pesanan' : 'Order Status'}</dt>
            <dd
              className={cn(
                'text-right font-bold',
                isCancelled ? 'text-[#D70015]' : 'text-zinc-950'
              )}
            >
              {getOrderStatusLabel(order.orderStatus, lang)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">{lang === 'ID' ? 'Metode Bayar' : 'Payment Method'}</dt>
            <dd className="text-right font-semibold text-zinc-950">
              {getPaymentTypeLabel(order.paymentType, lang)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500">{lang === 'ID' ? 'Status Pembayaran' : 'Payment Status'}</dt>
            <dd className="text-right font-bold text-apple-blue">
              {getPaymentStatusLabel(order.paymentStatus, lang)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 space-y-2 border-b border-dashed border-zinc-300 pb-4 text-xs">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-2">
              <span className="text-zinc-800">
                {item.quantity}× {item.itemTitleSnapshot}
              </span>
              <span className="font-mono font-semibold tabular-nums text-zinc-950">
                {formatIdr(item.totalPriceIdr)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 text-xs">
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
          <div className="flex justify-between pt-2 text-base font-bold text-zinc-950">
            <span>TOTAL</span>
            <span className="font-mono tabular-nums text-apple-blue">
              {formatIdr(order.totalAmountIdr)}
            </span>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-zinc-400">
          Powered by Saber Culinary Direct Commerce • 0% Commission Engine
        </p>
      </div>
    </div>
  );
}
