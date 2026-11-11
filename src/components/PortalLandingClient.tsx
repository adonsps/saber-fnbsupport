'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BowlFood,
  ChartBar,
  CookingPot,
  ForkKnife,
  LockSimple,
  QrCode,
  SignIn,
  SignOut,
  Storefront,
} from '@phosphor-icons/react';
import { formatIdr } from '@/lib/utils';
import { triggerCausalHaptic } from '@/lib/apple-motion';

export interface PortalMerchantSummary {
  id: string;
  name: string;
  slug: string;
  email?: string;
  ownerName: string;
  ownerWhatsapp: string;
  bankName: string;
  isStoreOpen: boolean;
  isDemo: boolean;
  menuCount: number;
  tableCount: number;
  activeTicketCount: number;
  revenueIdr: number;
  sampleOrderId: string;
}

interface PortalLandingClientProps {
  activeMerchant: PortalMerchantSummary;
  authenticatedMerchant: PortalMerchantSummary | null;
  demoMerchant: PortalMerchantSummary;
  displayHost: string;
  fonnteConfigured: boolean;
}

export function PortalLandingClient({
  activeMerchant,
  authenticatedMerchant,
  demoMerchant,
  displayHost,
  fonnteConfigured,
}: PortalLandingClientProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleSwitchScope = async (slug: string, redirectTo?: string) => {
    triggerCausalHaptic(8);
    setBusy(true);
    try {
      const res = await fetch('/api/v1/merchants/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          router.refresh();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    triggerCausalHaptic(8);
    setBusy(true);
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const modules = [
    {
      domain: 'Merchant Setup',
      title: 'Profil Toko & Rekening QRIS',
      route: '/onboarding?mode=edit',
      description:
        'Atur identitas toko, jam operasional, radius pengantaran mandiri, serta kredensial QRIS Statis & rekening bank penerimaan.',
      icon: Storefront,
      metric: `/${activeMerchant.slug}`,
    },
    {
      domain: 'Catalog & Inventory',
      title: 'Menu Bilingual (ID | EN) & Stok',
      route: '/admin/menu',
      description:
        'Kelola daftar hidangan dwi-bahasa, urutan kategori, tombol Buka/Pause Toko utama, serta saklar Habis (Sold Out) instan.',
      icon: BowlFood,
      metric: `${activeMerchant.menuCount} Dishes`,
    },
    {
      domain: 'Floor & Print Engine',
      title: 'QR Meja & Cetak PDF A4/A5',
      route: '/admin/tables',
      description:
        'Pantau status meja Terisi vs. Kosong, buat meja secara massal, dan ekspor stiker meja QR + info Wi-Fi tamu siap cetak.',
      icon: QrCode,
      metric: `${activeMerchant.tableCount} Tables`,
    },
    {
      domain: 'Kitchen & Cashier Ops',
      title: 'Kasir Kanban 5-Tahap & WA Bot',
      route: '/cashier/orders',
      description:
        'Papan dapur 5 kolom dengan audit ketersediaan stok, inspeksi bukti bayar QRIS, pindah/gabung meja, serta log Fonnte WhatsApp.',
      icon: CookingPot,
      metric: `${activeMerchant.activeTicketCount} Active Tickets`,
    },
    {
      domain: 'Shift Telemetry',
      title: 'Laporan Shift & Tutup Buku',
      route: '/admin/analytics',
      description:
        'Ringkasan pendapatan shift (IDR), pembagian tunai vs. QRIS, 5 hidangan terlaris, pemulihan stok 1 klik, dan ekspor CSV/PDF.',
      icon: ChartBar,
      metric: formatIdr(activeMerchant.revenueIdr),
    },
    {
      domain: 'Customer QR Preview',
      title: 'Pratinjau Menu Meja Pelanggan',
      route: `/${activeMerchant.slug}?table=TABLE%2004`,
      description:
        'Saat QR dipindai tamu, layar terkunci hanya menampilkan menu pemesanan & status pesanan tanpa akses ke menu admin/kasir.',
      icon: ForkKnife,
      metric: 'QR Isolated View',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      {/* Main Hero Surface — Cohesive Apple HIG Grouped Card & Culinary Editorial Serif */}
      <section className="hig-grouped-card relative overflow-hidden rounded-[26px] p-7 sm:p-11">
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-4">
            <p className="hig-caption text-xs font-semibold uppercase tracking-[0.06em] text-[#515154]">
              Saber Hospitality &amp; Direct Commerce
            </p>

            <h1 className="hig-culinary-serif text-[#1D1D1F]">
              Direct Table Ordering &amp; Kitchen Kanban for Indonesian Culinary Merchants.
            </h1>

            <p className="hig-body max-w-[62ch] text-[#515154]">
              Purpose-built for warungs, artisanal cafes, dine-in restaurants, and cloud kitchens.
              Merchants retain 100% of revenue with zero marketplace commission, zero dedicated POS
              hardware, and automated 2-step stock and QRIS verification via{' '}
              <strong className="font-semibold text-[#1D1D1F]">
                Saber x Fonnte WhatsApp Gateway
              </strong>
              .
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {authenticatedMerchant ? (
                <>
                  <Link
                    href="/cashier/orders"
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover"
                  >
                    Buka Kasir ({authenticatedMerchant.name})
                  </Link>
                  <Link
                    href={`/${authenticatedMerchant.slug}?table=TABLE%2004`}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
                  >
                    Menu Pelanggan (/{authenticatedMerchant.slug})
                  </Link>
                  <Link
                    href="/onboarding?mode=edit"
                    className="apple-interactive inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-semibold text-apple-blue hover:underline"
                  >
                    Profil &amp; Rekening
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/${demoMerchant.slug}?table=TABLE%2004`}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover"
                  >
                    Coba Simulasi Demo (Meja 04)
                  </Link>
                  <Link
                    href="/onboarding?mode=new"
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
                  >
                    Daftarkan Restoran Baru
                  </Link>
                  <Link
                    href="/login"
                    className="apple-interactive inline-flex min-h-[46px] items-center gap-1.5 rounded-full border border-black/[0.14] bg-white px-5 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  >
                    <SignIn aria-hidden="true" weight="regular" className="h-4 w-4" />
                    <span>Masuk Pemilik Resto</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Signature Tactile Pass Card — Explicitly identifies Demo vs. Logged-In Account */}
          <div className="saber-ticket-pass w-full shrink-0 rounded-[22px] p-6 lg:w-80">
            <div className="saber-ticket-divider flex items-start justify-between gap-2 pb-4">
              <div className="min-w-0">
                <p className="hig-caption text-[11px] font-semibold uppercase text-[#515154]">
                  {activeMerchant.isDemo
                    ? 'Demo Sandbox Pass'
                    : 'Authenticated Merchant Pass'}
                </p>
                <h2 className="mt-0.5 truncate font-serif text-lg font-bold text-[#1D1D1F]">
                  {activeMerchant.name}
                </h2>
              </div>
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  activeMerchant.isStoreOpen
                    ? 'bg-emerald-500/12 text-[#1D7D32]'
                    : 'bg-red-500/12 text-[#D70015]'
                }`}
              >
                {activeMerchant.isStoreOpen ? 'Open' : 'Paused'}
              </span>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="font-medium text-[#515154]">Live Menu URL</dt>
                <dd className="truncate font-mono font-semibold text-apple-blue">
                  {displayHost}/{activeMerchant.slug}
                </dd>
              </div>
              {authenticatedMerchant && !activeMerchant.isDemo && activeMerchant.email && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-[#515154]">Account Login</dt>
                  <dd className="truncate font-mono font-medium text-[#1D1D1F]">
                    {activeMerchant.email}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <dt className="font-medium text-[#515154]">Settlement Bank</dt>
                <dd className="truncate font-medium text-[#1D1D1F]">{activeMerchant.bankName}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="font-medium text-[#515154]">WhatsApp Gateway</dt>
                <dd
                  className={`font-mono font-semibold ${
                    fonnteConfigured ? 'text-[#1D7D32]' : 'text-[#515154]'
                  }`}
                >
                  {fonnteConfigured ? 'Fonnte Connected' : 'Local Log'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium text-[#515154]">Kitchen Queue</dt>
                <dd className="tabular-nums font-mono font-bold text-[#1D1D1F]">
                  {activeMerchant.activeTicketCount} Active Tickets
                </dd>
              </div>
            </dl>

            {authenticatedMerchant && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.08] pt-3.5 text-xs">
                {activeMerchant.isDemo ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwitchScope(authenticatedMerchant.slug)}
                    className="font-semibold text-apple-blue hover:underline disabled:opacity-50"
                  >
                    Kembali ke {authenticatedMerchant.name}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwitchScope(demoMerchant.slug)}
                    className="font-semibold text-[#515154] hover:text-[#1D1D1F] hover:underline disabled:opacity-50"
                  >
                    Lihat Demo Sandbox
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 font-semibold text-[#D70015] hover:underline disabled:opacity-50"
                >
                  <SignOut aria-hidden="true" weight="regular" className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Three Calm Uniform Track Cards — Clear Demo vs. Onboarding vs. Account Login */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-black/[0.08] pt-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-5">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-apple-blue">
                01 • Live Demo Sandbox
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                Uji Alur Pelanggan &amp; Kasir Tanpa Daftar
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                Gunakan restoran contoh{' '}
                <strong className="text-[#1D1D1F]">{demoMerchant.name}</strong> untuk mencoba scan
                QR meja, pesan menu, dan audit bukti bayar di Kasir Kanban.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <Link
                href={`/${demoMerchant.slug}?table=TABLE%2004`}
                className="text-apple-blue hover:underline"
              >
                Menu Meja 04 →
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSwitchScope(demoMerchant.slug, '/cashier/orders')}
                className="text-[#1D1D1F] hover:underline"
              >
                Kasir Demo →
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-5">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#1D1D1F]">
                02 • Pendaftaran Restoran Baru
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                Buat Akun &amp; Halaman Menu Toko Anda
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                Daftarkan restoran dengan Email &amp; Kata Sandi pribadi, alamat menu{' '}
                <code className="font-mono text-[#1D1D1F]">/[slug]</code>, cetak QR meja, dan
                rekening QRIS 0% komisi.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold">
              <Link href="/onboarding?mode=new" className="text-apple-blue hover:underline">
                Mulai Daftar Restoran →
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-5">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#1D7D32]">
                03 • Akun Terdaftar &amp; Terisolasi
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                {authenticatedMerchant
                  ? `Terhubung ke ${authenticatedMerchant.name}`
                  : 'Masuk untuk Kelola Restoran Anda'}
              </h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-[#515154]">
                <LockSimple
                  aria-hidden="true"
                  weight="regular"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <span>
                  {authenticatedMerchant
                    ? 'Hanya pemilik terautentikasi yang dapat membuka dasbor, stok, dan kasir toko Anda.'
                    : 'Pemilik restoran lain tidak dapat melihat atau masuk ke akun restoran Anda tanpa login email & kata sandi.'}
                </span>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              {authenticatedMerchant ? (
                <>
                  <Link href="/onboarding?mode=edit" className="text-apple-blue hover:underline">
                    Konfigurasi Profil →
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLogout}
                    className="text-[#D70015] hover:underline"
                  >
                    Keluar Akun
                  </button>
                </>
              ) : (
                <Link href="/login" className="text-apple-blue hover:underline">
                  Masuk ke Akun Saya →
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Operational Workspaces Grid — Uniform Opaque Grouped Module Cards */}
      <section className="mt-10">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="hig-caption text-xs font-semibold uppercase tracking-[0.05em] text-[#515154]">
              Operational Workspaces • {activeMerchant.isDemo ? 'Mode Demo' : activeMerchant.name}
            </p>
            <h2 className="hig-title-2 mt-0.5 text-[#1D1D1F]">
              Direct Commerce &amp; Kitchen Modules
            </h2>
          </div>
          <p className="text-xs font-medium text-[#515154]">
            {authenticatedMerchant
              ? `Modul di bawah mengelola toko aktif ${activeMerchant.name} (/${activeMerchant.slug})`
              : 'Saat belum login, seluruh modul di bawah berjalan aman di Mode Demo Sandbox'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.title}
                href={mod.route}
                className="apple-interactive group flex flex-col justify-between rounded-[20px] border border-black/[0.08] bg-white p-6 shadow-apple-sm hover:-translate-y-0.5 hover:border-black/20 hover:shadow-apple-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="hig-caption text-[11px] font-semibold uppercase text-[#515154]">
                      {mod.domain}
                    </span>
                    <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#1D1D1F]">
                      {mod.metric}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#1D1D1F] transition-colors group-hover:bg-[#1D1D1F] group-hover:text-white">
                      <Icon aria-hidden="true" weight="duotone" className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-[#1D1D1F] transition-colors group-hover:text-apple-blue">
                      {mod.title}
                    </h3>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[#515154]">{mod.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-black/[0.06] pt-3.5 text-xs font-semibold text-apple-blue">
                  <span>Open Workspace</span>
                  <span aria-hidden="true" className="font-mono text-xs">
                    →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
