import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
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
  const activeOrders = store.orders.filter(
    (o) => o.orderStatus !== 'COMPLETED' && o.orderStatus !== 'CANCELLED'
  );
  const settledOrders = store.orders.filter((o) => o.orderStatus === 'COMPLETED');
  const totalRevenue = settledOrders.reduce((acc, o) => acc + Number(o.totalAmountIdr), 0);

  const modules = [
    {
      domain: 'Merchant Setup',
      title: 'Self-Onboarding Wizard',
      route: '/onboarding',
      description:
        'Configure business identity, live subdomain ([slug].saberconsulting.id), self-delivery radius, and static QRIS or bank settlement credentials in three guided steps.',
      icon: Sparkles,
      badge: '3-Step Setup',
      color: 'bg-blue-500/10 text-apple-blue',
    },
    {
      domain: 'Catalog & Inventory',
      title: 'Dual-Language Menu & Stock Engine',
      route: '/admin/menu',
      description:
        'Manage bilingual (ID | EN) dishes, category display order, master store open/pause status, and one-tap optimistic Sold Out switches.',
      icon: UtensilsCrossed,
      badge: `${store.menuItems.length} Dishes`,
      color: 'bg-emerald-500/10 text-[#1D7D32]',
    },
    {
      domain: 'Floor & Print Engine',
      title: 'Table QR Manager & A4/A5 PDF Sheet',
      route: '/admin/tables',
      description:
        'Monitor live table occupancy (Vacant vs. Occupied), generate new tables in bulk, and print press-ready A4/A5 QR standees with guest Wi-Fi details.',
      icon: QrCode,
      badge: `${store.tableSessions.length} Tables`,
      color: 'bg-purple-500/10 text-purple-800',
    },
    {
      domain: 'Guest Direct Commerce',
      title: 'Customer Subdomain Storefront & Checkout',
      route: `/${merchant.slug}?table=TABLE%2004`,
      description:
        'Account-free mobile storefront with bilingual toggle, Dine-In QR / Pre-Order / Delivery modes, persistent local basket, and tactile sheet checkout.',
      icon: Store,
      badge: `${merchant.slug}.saberconsulting.id`,
      color: 'bg-amber-500/10 text-[#B25000]',
    },
    {
      domain: 'Live Order Pass',
      title: 'Order Status Pass & QRIS Proof Upload',
      route: `/order/${store.orders[0]?.id || '66666666-6666-4666-8666-666666666601'}`,
      description:
        'Real-time 6-stage order pass, zoomable Static QRIS with one-tap bank account copy, transfer receipt upload, and printable web invoice.',
      icon: Compass,
      badge: 'Live Telemetry',
      color: 'bg-sky-500/10 text-sky-800',
    },
    {
      domain: 'Kitchen & Cashier Ops',
      title: 'Cashier 5-Column Kanban & WhatsApp Bot',
      route: '/cashier/orders',
      description:
        '5-stage kitchen board with audio-haptic chime, Partial Stock Audit & automatic total recalculation, Receipt Inspector, Table Move/Merge, and WA Bot logs.',
      icon: ChefHat,
      badge: `${activeOrders.length} Active Tickets`,
      color: 'bg-rose-500/10 text-[#D70015]',
    },
    {
      domain: 'Shift Telemetry',
      title: 'Daily Shift Report & Store Controls',
      route: '/admin/analytics',
      description:
        'Shift summary displaying Gross Revenue (IDR), Order Channel Split, Cash vs. QRIS breakdown, Top 5 Dishes, one-tap stock restoration, and CSV/PDF export.',
      icon: BarChart3,
      badge: formatIdr(totalRevenue),
      color: 'bg-indigo-500/10 text-indigo-800',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      {/* Content Layer Grouped Hero Card (Opaque surface per liquid-glass.md › Where the material belongs) */}
      <section className="hig-grouped-card relative overflow-hidden rounded-[26px] p-7 sm:p-11">
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-black/[0.08] bg-[#F5F5F7] px-3.5 py-1.5 text-xs font-semibold text-[#1D1D1F]">
              <span className="h-2 w-2 rounded-full bg-[#1D7D32]" />
              <span>Saber F&B Direct Commerce • Zero-Commission UMKM Architecture</span>
            </div>

            <h1 className="hig-culinary-serif text-[#1D1D1F]">
              Direct Table Ordering & Kitchen Kanban for Indonesian Culinary Merchants.
            </h1>

            <p className="hig-body max-w-[62ch] text-[#515154]">
              Purpose-built for warungs, artisanal cafes, dine-in restaurants, and cloud kitchens.
              Merchants retain 100% of revenue with zero marketplace commission, zero dedicated POS
              hardware, and automated 2-step stock and QRIS verification via{' '}
              <strong className="font-semibold text-[#1D1D1F]">
                Saber Central WhatsApp Gateway Bot
              </strong>
              .
            </p>

            {/* HIG Button Hierarchy (buttons.md › Style): 1 prominent primary CTA + 1 tinted secondary CTA */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/${merchant.slug}?table=TABLE%2004`}
                className="apple-interactive inline-flex min-h-[46px] items-center gap-2 rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover"
              >
                <Smartphone className="h-4 w-4" />
                <span>Open Guest Storefront (Table 04)</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>

              <Link
                href="/cashier/orders"
                className="apple-interactive inline-flex min-h-[46px] items-center gap-2 rounded-full border border-black/[0.12] bg-[#F5F5F7] px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
              >
                <ChefHat className="h-4 w-4 text-apple-blue" />
                <span>Open Cashier & Kitchen Kanban</span>
              </Link>

              <Link
                href="/onboarding"
                className="apple-interactive inline-flex min-h-[44px] items-center gap-1.5 px-3 py-2 text-sm font-semibold text-apple-blue hover:underline"
              >
                <Sparkles className="h-4 w-4" />
                <span>Configure Merchant Profile</span>
              </Link>
            </div>
          </div>

          {/* Signature Studio Element: Tactile Perforated Merchant Pass (.saber-ticket-pass) */}
          <div className="saber-ticket-pass w-full shrink-0 rounded-[22px] p-6 lg:w-80">
            <div className="saber-ticket-divider flex items-center justify-between pb-4">
              <div>
                <p className="hig-caption text-[11px] font-semibold uppercase text-[#515154]">
                  Active Merchant Pass
                </p>
                <h2 className="mt-0.5 font-serif text-lg font-bold text-[#1D1D1F]">
                  {merchant.name}
                </h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  merchant.isStoreOpen
                    ? 'bg-emerald-500/15 text-[#1D7D32]'
                    : 'bg-red-500/15 text-[#D70015]'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    merchant.isStoreOpen ? 'bg-[#1D7D32]' : 'bg-[#D70015]'
                  }`}
                />
                {merchant.isStoreOpen ? 'OPEN' : 'PAUSED'}
              </span>
            </div>

            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="font-medium text-[#515154]">Live Subdomain</dt>
                <dd className="font-mono font-semibold text-apple-blue">
                  {merchant.slug}.saberconsulting.id
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium text-[#515154]">Owner WhatsApp</dt>
                <dd className="font-mono font-medium text-[#1D1D1F]">{merchant.ownerWhatsapp}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium text-[#515154]">Settlement Bank</dt>
                <dd className="font-medium text-[#1D1D1F]">{branch.bankName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium text-[#515154]">Kitchen Queue</dt>
                <dd className="tabular-nums font-mono font-bold text-[#1D1D1F]">
                  {activeOrders.length} Active Tickets
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Non-Negotiable Architecture Pillars — Opaque Grouped Tertiary Surface (#F5F5F7) */}
        <div className="mt-8 grid grid-cols-1 gap-3 border-t border-black/[0.08] pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-apple-blue" />
            <div>
              <p className="text-xs font-semibold text-[#1D1D1F]">0% Commission & Zero Hardware</p>
              <p className="mt-0.5 text-xs text-[#515154]">
                Runs in any mobile or tablet browser without proprietary POS terminals.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-[#1D7D32]" />
            <div>
              <p className="text-xs font-semibold text-[#1D1D1F]">100% Account-Free Guest Flow</p>
              <p className="mt-0.5 text-xs text-[#515154]">
                Collects only Name and WhatsApp. Basket persists automatically on device.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4">
            <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-[#B25000]" />
            <div>
              <p className="text-xs font-semibold text-[#1D1D1F]">2-Step Stock & Payment Loop</p>
              <p className="mt-0.5 text-xs text-[#515154]">
                Cashier verifies kitchen stock before guests transfer via Static QRIS.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-purple-800" />
            <div>
              <p className="text-xs font-semibold text-[#1D1D1F]">Automated Table Reset</p>
              <p className="mt-0.5 text-xs text-[#515154]">
                Completing an order automatically releases the table session for the next guest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Workspace Directory */}
      <section className="mt-10">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="hig-caption text-xs font-semibold uppercase text-apple-blue">
              End-to-End Operational Workspaces
            </p>
            <h2 className="hig-title-2 mt-0.5 text-[#1D1D1F]">
              Explore Direct Commerce & Kitchen Modules
            </h2>
          </div>
          <p className="text-xs font-medium text-[#515154]">
            Select any workspace below to test the live guest, cashier, or merchant workflow
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.title}
                href={mod.route}
                className="apple-interactive group flex flex-col justify-between rounded-[20px] border border-black/[0.08] bg-white p-6 shadow-apple-sm hover:-translate-y-0.5 hover:border-apple-blue/40 hover:shadow-apple-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="hig-caption text-[11px] font-semibold uppercase text-[#515154]">
                      {mod.domain}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${mod.color}`}
                    >
                      {mod.badge}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#1D1D1F] transition-colors group-hover:bg-apple-blue group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-[#1D1D1F] transition-colors group-hover:text-apple-blue">
                      {mod.title}
                    </h3>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[#515154]">{mod.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-black/[0.06] pt-3.5 text-xs font-semibold text-apple-blue">
                  <span>Open Workspace</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
