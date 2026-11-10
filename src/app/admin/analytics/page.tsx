'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Loader2,
  Power,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Category,
  MenuItem,
  Merchant,
  Order,
  OrderStatus,
  OrderType,
  PaymentType,
  TableSession,
} from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';

export default function AdminAnalyticsPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableSession[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [filterScope, setFilterScope] = useState<'ALL' | 'SETTLED_ONLY'>('ALL');

  const loadTelemetry = async () => {
    try {
      const [ordersRes, menuRes] = await Promise.all([
        fetch('/api/v1/orders'),
        fetch('/api/v1/menu-items'),
      ]);
      const ordersData = await ordersRes.json();
      const menuData = await menuRes.json();

      setMerchant(menuData.merchant);
      setOrders(ordersData.orders || []);
      setTables(ordersData.tables || []);
      setMenuItems(menuData.menuItems || []);
      setCategories(menuData.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTelemetry();
  }, []);

  const metrics = useMemo(() => {
    const validOrders = orders.filter((o) => o.orderStatus !== OrderStatus.CANCELLED);
    const settledOrders = validOrders.filter((o) => o.orderStatus === OrderStatus.COMPLETED);
    const targetOrders = filterScope === 'SETTLED_ONLY' ? settledOrders : validOrders;

    const grossSales = targetOrders.reduce((acc, o) => acc + Number(o.totalAmountIdr), 0);
    const aov = targetOrders.length > 0 ? Math.round(grossSales / targetOrders.length) : 0;
    const occupiedTables = tables.filter((t) => t.isOccupied).length;

    const channelCounts = {
      walkIn: targetOrders.filter((o) => o.orderType === OrderType.WALK_IN_TABLE).length,
      preOrder: targetOrders.filter((o) => o.orderType === OrderType.PRE_ORDER_PICKUP).length,
      delivery: targetOrders.filter((o) => o.orderType === OrderType.SELF_DELIVERY).length,
    };

    const cashOrders = targetOrders.filter((o) => o.paymentType === PaymentType.CASH);
    const qrisOrders = targetOrders.filter((o) => o.paymentType === PaymentType.BANK_TRANSFER_QRIS);
    const cashTotal = cashOrders.reduce((acc, o) => acc + Number(o.totalAmountIdr), 0);
    const qrisTotal = qrisOrders.reduce((acc, o) => acc + Number(o.totalAmountIdr), 0);

    // Top 5 Best-Selling Dishes
    const dishMap = new Map<
      string,
      { menuItemId: string; title: string; category: string; units: number; revenue: number }
    >();

    targetOrders.forEach((o) => {
      o.items.forEach((item) => {
        const menu = menuItems.find((m) => m.id === item.menuItemId);
        const cat = categories.find((c) => c.id === menu?.categoryId);
        const existing = dishMap.get(item.menuItemId) || {
          menuItemId: item.menuItemId,
          title: item.itemTitleSnapshot,
          category: cat?.nameId || 'Menu Utama',
          units: 0,
          revenue: 0,
        };
        existing.units += item.quantity;
        existing.revenue += Number(item.totalPriceIdr);
        dishMap.set(item.menuItemId, existing);
      });
    });

    const top5Dishes = Array.from(dishMap.values())
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 5);

    const soldOutCount = menuItems.filter((m) => m.isSoldOut).length;

    return {
      grossSales,
      totalOrders: targetOrders.length,
      settledCount: settledOrders.length,
      aov,
      occupiedTables,
      totalTables: tables.length,
      channelCounts,
      cashTotal,
      qrisTotal,
      cashCount: cashOrders.length,
      qrisCount: qrisOrders.length,
      top5Dishes,
      soldOutCount,
    };
  }, [orders, tables, menuItems, categories, filterScope]);

  const handleToggleStorePause = async () => {
    if (!merchant) return;
    const nextState = !merchant.isStoreOpen;
    setMerchant({ ...merchant, isStoreOpen: nextState });

    await fetch('/api/v1/merchants/onboard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isStoreOpen: nextState }),
    });
  };

  const handleSoldOutResetEngine = async () => {
    const res = await fetch('/api/v1/merchants/onboard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetAllSoldOut: true }),
    });
    const data = await res.json();
    if (data.menuItems) {
      setMenuItems(data.menuItems);
      setResetMessage('Seluruh item menu berhasil di-reset ke "In Stock" untuk shift hari baru!');
      setTimeout(() => setResetMessage(null), 4000);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'OrderNumber',
      'Status',
      'OrderType',
      'PaymentMethod',
      'CustomerName',
      'ItemTitle',
      'Qty',
      'UnitPriceIDR',
      'LineTotalIDR',
      'OrderTotalIDR',
      'CreatedAt',
    ];
    const rows: string[] = [headers.join(',')];

    orders
      .filter((o) => o.orderStatus !== OrderStatus.CANCELLED)
      .forEach((o) => {
        o.items.forEach((item) => {
          rows.push(
            [
              o.orderNumber,
              o.orderStatus,
              o.orderType,
              o.paymentType,
              `"${o.customerName.replace(/"/g, '""')}"`,
              `"${item.itemTitleSnapshot.replace(/"/g, '""')}"`,
              item.quantity,
              item.unitPriceIdr,
              item.totalPriceIdr,
              o.totalAmountIdr,
              o.createdAt,
            ].join(',')
          );
        });
      });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${merchant?.slug || 'saber-fnb'}-shift-sales.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
      </div>
    );
  }

  const maxChannelCount = Math.max(
    1,
    metrics.channelCounts.walkIn,
    metrics.channelCounts.preOrder,
    metrics.channelCounts.delivery
  );
  const totalPayAmount = Math.max(1, metrics.cashTotal + metrics.qrisTotal);
  const qrisSharePct = Math.round((metrics.qrisTotal / totalPayAmount) * 100);
  const cashSharePct = 100 - qrisSharePct;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      {/* Header & Export Capabilities */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-apple-sm sm:flex-row sm:items-center">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-apple-blue">
            Sprint 4 • Operational Telemetry & Shift Summary
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            Ringkasan Shift Harian — {merchant?.name}
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            0% Potongan Komisi • Laporan real-time pendapatan kotor, mix saluran order, dan kontrol
            darurat toko.
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-full border border-zinc-200 bg-[#F5F5F7] p-1">
            <button
              type="button"
              onClick={() => setFilterScope('ALL')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold transition-all',
                filterScope === 'ALL' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'
              )}
            >
              Semua Shift Aktif
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('SETTLED_ONLY')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold transition-all',
                filterScope === 'SETTLED_ONLY'
                  ? 'bg-white text-zinc-950 shadow-sm'
                  : 'text-zinc-500'
              )}
            >
              Completed Only
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export Sales Data CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-zinc-950 px-5 text-xs font-bold text-white hover:bg-apple-blue"
          >
            <Download className="h-4 w-4" />
            <span>Download Shift Summary PDF</span>
          </button>
        </div>
      </div>

      {/* Store Emergency Switches Component */}
      <section className="no-print mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Global Pause Incoming Orders Toggle Banner */}
        <div
          className={cn(
            'flex items-center justify-between gap-4 rounded-[22px] border p-5 shadow-apple-sm',
            merchant?.isStoreOpen
              ? 'border-black/[0.06] bg-white'
              : 'border-red-300 bg-red-50'
          )}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                merchant?.isStoreOpen
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : 'bg-red-500/15 text-red-600'
              )}
            >
              {merchant?.isStoreOpen ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">
                Emergency Switch: {merchant?.isStoreOpen ? 'Store Accepting Orders' : 'Store PAUSED'}
              </h2>
              <p className="text-xs text-zinc-500">
                Set <code className="font-mono">isStoreOpen = false</code> untuk mengunci checkout
                mini-site saat dapur kewalahan.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleStorePause}
            className={cn(
              'inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold text-white transition-colors',
              merchant?.isStoreOpen
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-apple-green hover:bg-emerald-600'
            )}
          >
            <Power className="h-3.5 w-3.5" />
            <span>{merchant?.isStoreOpen ? 'Pause Incoming Orders' : 'Re-Open Store'}</span>
          </button>
        </div>

        {/* Sold-Out Reset Engine */}
        <div className="flex items-center justify-between gap-4 rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">
                Sold-Out Reset Engine ({metrics.soldOutCount} Item Habis)
              </h2>
              <p className="text-xs text-zinc-500">
                Reset massal seluruh menu kembali ke <code className="font-mono">isSoldOut = false</code>{' '}
                di awal shift pagi.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSoldOutResetEngine}
            className="inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white hover:bg-apple-blue"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Semua Stok</span>
          </button>
        </div>
      </section>

      {resetMessage && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <span>{resetMessage}</span>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">Gross Sales Today</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950">
            {formatIdr(metrics.grossSales)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-emerald-700">
            100% Net Kept (Rp 0 Komisi Marketplace)
          </p>
        </div>

        <div className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-apple-blue" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950">
            {metrics.totalOrders}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            {metrics.settledCount} pesanan telah Completed / Lunas
          </p>
        </div>

        <div className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">Average Order Value (AOV)</span>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950">
            {formatIdr(metrics.aov)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">Rata-rata nilai keranjang per transaksi</p>
        </div>

        <div className="rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">Active Occupied Tables</span>
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950">
            {metrics.occupiedTables}{' '}
            <span className="text-sm font-medium text-zinc-400">/ {metrics.totalTables}</span>
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Otomatis kembali Vacant saat order Completed
          </p>
        </div>
      </section>

      {/* Visual Breakdown Charts Row */}
      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Order Volume Breakdown */}
        <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
          <h2 className="text-base font-bold text-zinc-950">Order Volume Breakdown</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Perbandingan saluran pemesanan: Walk-In QR vs Pre-Order Pick-Up vs Self-Delivery
          </p>

          <div className="mt-6 space-y-4">
            {[
              {
                label: 'Walk-In Table QR',
                count: metrics.channelCounts.walkIn,
                barClass: 'bg-apple-blue',
              },
              {
                label: 'Advance Pre-Order (Pick Up)',
                count: metrics.channelCounts.preOrder,
                barClass: 'bg-purple-500',
              },
              {
                label: 'Store Self-Delivery',
                count: metrics.channelCounts.delivery,
                barClass: 'bg-amber-500',
              },
            ].map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-zinc-800">{row.label}</span>
                  <span className="font-mono tabular-nums text-zinc-950">{row.count} order</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', row.barClass)}
                    style={{ width: `${Math.round((row.count / maxChannelCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Channel Split */}
        <div className="rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-950">Payment Channel Split</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Perbandingan settlement tunai (Cash) vs Bank Transfer / QRIS Statis
              </p>
            </div>
            <CreditCard className="h-5 w-5 text-apple-blue" />
          </div>

          <div className="mt-6">
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-[#F5F5F7]">
              <div
                className="bg-apple-blue transition-all duration-500"
                style={{ width: `${qrisSharePct}%` }}
                title={`QRIS / Transfer ${qrisSharePct}%`}
              />
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${cashSharePct}%` }}
                title={`Cash ${cashSharePct}%`}
              />
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-apple-blue/20 bg-apple-blue/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-apple-blue">
                  <span className="h-2.5 w-2.5 rounded-full bg-apple-blue" />
                  <span>QRIS / Bank Transfer ({qrisSharePct}%)</span>
                </div>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-zinc-950">
                  {formatIdr(metrics.qrisTotal)}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {metrics.qrisCount} transaksi terverifikasi
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span>Pay at Cashier / Cash ({cashSharePct}%)</span>
                </div>
                <p className="mt-2 font-mono text-lg font-bold tabular-nums text-zinc-950">
                  {formatIdr(metrics.cashTotal)}
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {metrics.cashCount} transaksi tunai kasir
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Top 5 Best-Selling Dishes Table (Responsive Table Pattern) */}
      <section className="mt-6 rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
        <div className="mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-bold text-zinc-950">Top 5 Best-Selling Dishes</h2>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label="Top 5 Best-Selling Dishes"
          className="overflow-x-auto"
        >
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-black/[0.08] text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <th className="py-3 pr-4">Peringkat</th>
                <th className="py-3 pr-4">Nama Hidangan</th>
                <th className="py-3 pr-4">Kategori</th>
                <th className="py-3 pr-4 text-right">Units Sold</th>
                <th className="py-3 text-right">Total Revenue (IDR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {metrics.top5Dishes.map((dish, idx) => (
                <tr key={dish.menuItemId} className="hover:bg-[#F5F5F7]/60">
                  <td className="py-3.5 pr-4 font-mono font-bold text-apple-blue">#{idx + 1}</td>
                  <th className="py-3.5 pr-4 font-bold text-zinc-950">{dish.title}</th>
                  <td className="py-3.5 pr-4 text-zinc-600">{dish.category}</td>
                  <td className="py-3.5 pr-4 text-right font-mono font-bold tabular-nums text-zinc-950">
                    {dish.units} porsi
                  </td>
                  <td className="py-3.5 text-right font-mono font-bold tabular-nums text-emerald-700">
                    {formatIdr(dish.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

