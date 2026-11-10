import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChefHat,
  Compass,
  Layers,
  MessageSquareText,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import { getStore } from '@/lib/store';
import { formatIdr } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const store = getStore();
  const merchant = store.merchants[0];
  const branch = store.branches[0];
  const activeOrders = store.orders.filter((o) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED');
  const settledOrders = store.orders.filter((o) => o.orderStatus === 'COMPLETED');
  const totalRevenue = settledOrders.reduce((acc, o) => acc + Number(o.totalAmountIdr), 0);

  const modules = [
    {
      sprint: 'Sprint 1 • Screen 1',
      title: 'Merchant Self-Onboarding Wizard',
      route: '/onboarding',
      description:
        '3-step self-service wizard: Business Profile & Live Subdomain Validator ([slug].saberconsulting.id), Operations & Self-Delivery Radius, and Static QRIS / Bank Credentials.',
      icon: Sparkles,
      badge: '10-Min Setup',
      color: 'bg-blue-500/10 text-apple-blue',
    },
    {
      sprint: 'Sprint 1 • Screen 2',
      title: 'Dual-Language Menu & Stock Engine',
      route: '/admin/menu',
      description:
        'Dual-pane bilingual (ID | EN) menu manager, category ordering, Master Store Status switch (OPEN / PAUSED), and 1-click optimistic "Mark Sold Out" toggles.',
      icon: UtensilsCrossed,
      badge: `${store.menuItems.length} Menu Items`,
      color: 'bg-emerald-500/10 text-emerald-700',
    },
    {
      sprint: 'Sprint 2 • Screen 3',
      title: 'Table QR Manager & A4/A5 PDF Engine',
      route: '/admin/tables',
      description:
        'Live table occupancy grid (Vacant / Occupied), instant bulk table generator, and high-resolution printable A4/A5 Table QR sheets with WiFi credentials.',
      icon: QrCode,
      badge: `${store.tableSessions.length} Active Tables`,
      color: 'bg-purple-500/10 text-purple-700',
    },
    {
      sprint: 'Sprint 2 • Screen 4 & 5',
      title: 'Customer Subdomain Mini-Site & Checkout',
      route: `/${merchant.slug}?table=TABLE%2004`,
      description:
        'Zero-registration mobile PWA storefront with ID | EN pill switch, Walk-In QR / Pre-Order / Self-Delivery tabs, localStorage cart, and frictionless guest checkout modal.',
      icon: Store,
      badge: `${merchant.slug}.saberconsulting.id`,
      color: 'bg-amber-500/10 text-amber-700',
    },
    {
      sprint: 'Sprint 2 • Screen 6',
      title: 'Live Order Tracking & QRIS Proof Upload',
      route: `/order/${store.orders[0]?.id || '66666666-6666-4666-8666-666666666601'}`,
      description:
        'Real-time 6-stage progress stepper, zoomable Static QRIS & 1-click bank account copy, transfer receipt uploader, and printable digital web receipt.',
      icon: Compass,
      badge: 'Live Auto-Polling',
      color: 'bg-sky-500/10 text-sky-700',
    },
    {
      sprint: 'Sprint 3 • Screen 7',
      title: 'Cashier 5-Column Kanban & WA Bot Loop',
      route: '/cashier/orders',
      description:
        '5-stage Kanban board with web audio chime, Partial Stock Audit & Line-Item Recalculation modal, Receipt Proof Inspector, Table Move/Merge, and Saber Central WA Bot.',
      icon: ChefHat,
      badge: `${activeOrders.length} Active Orders`,
      color: 'bg-rose-500/10 text-rose-700',
    },
    {
      sprint: 'Sprint 4 • Screen 8',
      title: 'Daily Shift Summary & Store Emergency Controls',
      route: '/admin/analytics',
      description:
        'Executive telemetry dashboard: Gross Revenue IDR, Order Channel Split, Cash vs QRIS breakdown, Top 5 Dishes, Sold-Out Reset Engine, and PDF/CSV exporters.',
      icon: BarChart3,
      badge: formatIdr(totalRevenue),
      color: 'bg-indigo-500/10 text-indigo-700',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      {/* Apple HIG Hero Section */}
      <section className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-white p-8 shadow-apple-md sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-apple-blue/15 via-emerald-400/10 to-transparent blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#F5F5F7] px-3.5 py-1.5 text-xs font-semibold text-zinc-800">
              <span className="h-2 w-2 rounded-full bg-apple-green animate-pulse" />
              <span>Saber Technology Studio • UMKM F&B Direct Commerce Platform</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-5xl sm:leading-[1.08]">
              Zero-Commission Direct Ordering & Table QR Engine.
            </h1>

            <p className="text-base leading-relaxed text-zinc-600 sm:text-lg">
              Dirancang khusus untuk warung, kafe, restoran dine-in, dan cloud kitchen di Indonesia.
              100% pendapatan milik merchant tanpa potongan komisi aplikasi, tanpa perlu perangkat
              POS khusus, dan terintegrasi langsung dengan{' '}
              <span className="font-semibold text-zinc-900">
                Saber Central Automated WhatsApp Gateway Bot
              </span>
              .
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/${merchant.slug}?table=TABLE%2004`}
                className="inline-flex items-center gap-2 rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm transition-all hover:bg-apple-blueHover active:scale-[0.98]"
              >
                <Smartphone className="h-4 w-4" />
                <span>Buka Mini-Site Pelanggan (Meja 04)</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              <Link
                href="/cashier/orders"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white shadow-apple-sm transition-all hover:bg-zinc-800 active:scale-[0.98]"
              >
                <ChefHat className="h-4 w-4" />
                <span>Buka Kanban Kasir & Dapur</span>
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 transition-all hover:bg-zinc-50 active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4 text-apple-blue" />
                <span>Merchant Onboarding Wizard</span>
              </Link>
            </div>
          </div>

          {/* Active Store Status Snapshot Card */}
          <div className="w-full shrink-0 rounded-[22px] border border-black/[0.06] bg-[#F5F5F7]/90 p-6 lg:w-80">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Active Tenant Store
                </p>
                <h2 className="mt-0.5 text-base font-bold text-zinc-950">{merchant.name}</h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  merchant.isStoreOpen
                    ? 'bg-emerald-500/15 text-emerald-800'
                    : 'bg-red-500/15 text-red-700'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    merchant.isStoreOpen ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                {merchant.isStoreOpen ? 'OPEN' : 'PAUSED'}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Subdomain Aktif</dt>
                <dd className="font-mono font-semibold text-apple-blue">
                  {merchant.slug}.saberconsulting.id
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">WhatsApp Owner</dt>
                <dd className="font-mono font-medium text-zinc-900">{merchant.ownerWhatsapp}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Rekening Settlement</dt>
                <dd className="font-medium text-zinc-900">{branch.bankName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-zinc-500">Antrean Aktif Dapur</dt>
                <dd className="tabular-nums font-bold text-zinc-950">
                  {activeOrders.length} Pesanan
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Non-Negotiable Architecture Pillars */}
        <div className="mt-8 grid grid-cols-1 gap-3 border-t border-black/[0.06] pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7]/70 p-3.5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-apple-blue" />
            <div>
              <p className="text-xs font-semibold text-zinc-950">0% Komisi & Zero Hardware</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Berjalan murni di browser HP & tablet tanpa mesin kasir mahal.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7]/70 p-3.5">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-zinc-950">100% Tanpa Login Tamu</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Cukup Nama & Nomor WhatsApp. Keranjang tersimpan di localStorage.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7]/70 p-3.5">
            <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs font-semibold text-zinc-950">2-Step Stock & Payment Loop</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Konfirmasi stok kasir dulu sebelum pelanggan transfer QRIS Statis.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-[#F5F5F7]/70 p-3.5">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-purple-600" />
            <div>
              <p className="text-xs font-semibold text-zinc-950">Auto Table Session Reset</p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Status meja otomatis kembali Vacant begitu pesanan Completed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Complete 8-Screen Architecture Grid */}
      <section className="mt-10">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-apple-blue">
              Full-Stack Sprint 1 – Sprint 4 Architecture
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950">
              Eksplorasi Seluruh Modul Platform
            </h2>
          </div>
          <p className="text-xs text-zinc-500">
            Klik kartu di bawah untuk menguji alur end-to-end dari Onboarding hingga Shift Analytics
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.title}
                href={mod.route}
                className="group flex flex-col justify-between rounded-[22px] border border-black/[0.06] bg-white p-6 shadow-apple-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-apple-blue/30 hover:shadow-apple-md active:scale-[0.99]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      {mod.sprint}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${mod.color}`}
                    >
                      {mod.badge}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F5F5F7] text-zinc-900 transition-colors group-hover:bg-apple-blue group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-zinc-950 group-hover:text-apple-blue transition-colors">
                      {mod.title}
                    </h3>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-zinc-600">{mod.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-black/[0.05] pt-3.5 text-xs font-semibold text-apple-blue">
                  <span>Buka Modul Layar</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

