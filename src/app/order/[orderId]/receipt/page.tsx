'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Branch, Merchant, Order } from '@/types/schema';
import { formatIdr } from '@/lib/utils';

export default function DigitalWebReceiptPage() {
  const routeParams = useParams<{ orderId: string }>();
  const orderId = routeParams?.orderId || '';
  const [order, setOrder] = useState<Order | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/v1/orders/${encodeURIComponent(orderId)}`)
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
        <p className="font-mono text-xs font-medium text-[#515154]">Loading receipt...</p>
      </div>
    );
  }

  if (!order) {
    return <div className="p-10 text-center text-sm">Struk tidak ditemukan.</div>;
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link
          href={`/order/${order.id}`}
          className="apple-interactive inline-flex min-h-[40px] items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-apple-sm"
        >
          ← Kembali ke Status
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="apple-interactive inline-flex min-h-[40px] items-center rounded-full bg-zinc-950 px-5 py-2 text-xs font-bold text-white shadow-apple-sm"
        >
          Cetak / Simpan PDF
        </button>
      </div>

      <div className="rounded-[26px] border border-black/[0.08] bg-white p-7 shadow-apple-md">
        <div className="border-b border-dashed border-zinc-300 pb-5 text-center">
          <p className="font-serif text-lg font-bold tracking-tight text-zinc-950">
            {merchant?.name}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">{branch?.address}</p>
          <div className="mt-3 inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-bold text-[#1D7D32]">
            DIGITAL WEB RECEIPT • #{order.orderNumber}
          </div>
        </div>

        <dl className="mt-4 space-y-1.5 border-b border-dashed border-zinc-300 pb-4 text-xs">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Pelanggan</dt>
            <dd className="font-semibold text-zinc-950">{order.customerName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Channel / Meja</dt>
            <dd className="font-semibold text-zinc-950">{order.tableNumber || order.orderType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Metode Bayar</dt>
            <dd className="font-semibold text-zinc-950">{order.paymentType}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Status Pembayaran</dt>
            <dd className="font-bold text-apple-blue">{order.paymentStatus}</dd>
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
              <span>Ongkos Kirim</span>
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
          Powered by Saber UMKM Direct Commerce • 0% Commission Engine
        </p>
      </div>
    </div>
  );
}

