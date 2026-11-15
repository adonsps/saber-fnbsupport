'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BowlFood,
  CaretDown,
  ChartBar,
  CookingPot,
  LockSimple,
  SignIn,
  SignOut,
  UserPlus,
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
  whatsappReady: boolean;
}

export function PortalLandingClient({
  activeMerchant,
  authenticatedMerchant,
  demoMerchant,
  displayHost,
  whatsappReady,
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

  // Rule of 3: Maksimal 3 modul utama, masing-masing maksimal 3 poin ringkas & maksimal 3 tautan aksi
  const coreModuleGroups = [
    {
      id: 'menu-qr',
      domain: '1. Katalog & Meja',
      title: 'Menu & QR Meja',
      metric: `${activeMerchant.menuCount} Menu · ${activeMerchant.tableCount} Meja`,
      icon: BowlFood,
      summary: 'Atur daftar hidangan, stok harian, dan stiker QR meja pelanggan.',
      highlights: [
        'Katalog menu dwi-bahasa (ID/EN) & saklar stok habis instan',
        'Cetak lembar stiker QR meja PDF A4/A5 beserta info Wi-Fi',
        'Pratinjau tampilan pemesanan QR langsung dari sisi tamu',
      ],
      actions: [
        { label: 'Kelola Menu', route: '/admin/menu', primary: true },
        { label: 'Cetak QR Meja', route: '/admin/tables' },
        { label: 'Layar Tamu', route: `/${activeMerchant.slug}?table=TABLE%2004` },
      ],
    },
    {
      id: 'cashier-kitchen',
      domain: '2. Operasional',
      title: 'Kasir & Antrean Dapur',
      metric: `${activeMerchant.activeTicketCount} Antrean Aktif`,
      icon: CookingPot,
      summary: 'Kelola pesanan masuk, bukti bayar QRIS, dan status masak real-time.',
      highlights: [
        'Papan Kanban antrean pesanan dari masuk hingga disajikan',
        'Verifikasi bukti bayar QRIS & konfirmasi stok parsial',
        'Notifikasi status pesanan otomatis via Bot WhatsApp Saber',
      ],
      actions: [
        { label: 'Buka Kasir & Dapur', route: '/cashier/orders', primary: true },
      ],
    },
    {
      id: 'analytics-profile',
      domain: '3. Bisnis & Rekening',
      title: 'Laporan & Profil Toko',
      metric: formatIdr(activeMerchant.revenueIdr),
      icon: ChartBar,
      summary: 'Pantau pemasukan harian 0% komisi dan kelola rekening QRIS toko.',
      highlights: [
        'Rekap pendapatan harian Tunai vs. QRIS & ekspor CSV/PDF',
        'Daftar hidangan terlaris & pemulihan stok 1 klik',
        'Pengaturan jam buka, kurir toko, & rekening bank/QRIS',
      ],
      actions: [
        { label: 'Laporan Shift', route: '/admin/analytics', primary: true },
        {
          label: authenticatedMerchant ? 'Profil & QRIS' : 'Buat Akun Toko',
          route: authenticatedMerchant ? '/onboarding?mode=edit' : '/onboarding?mode=new',
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
      {/* Bagian Utama Hero — Sky Blue 60% Atmosphere + Cloud White 30% + Scarlet Red 10% + Authentic Culinary Backdrop */}
      <section className="hig-grouped-card relative overflow-hidden rounded-[26px] border border-sky-200/70 bg-cloud p-7 shadow-apple-md sm:p-11">
        {/* Background Image Otentik Kuliner dengan Sky Blue 60% Ambient Scrim */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src="/hero-bg.webp"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center opacity-30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-sky-50/98 via-sky-50/92 to-sky-100/75"
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className={authenticatedMerchant ? 'max-w-2xl space-y-4' : 'max-w-4xl space-y-4'}>
            <h1 className="hig-culinary-serif text-ink-primary">
              Pesan Meja QR &amp; Kasir Dapur Langsung.
            </h1>

            <p className="hig-body max-w-[54ch] text-ink-secondary">
              <strong className="font-semibold text-ink-primary">0% komisi aplikasi</strong>. Pesan meja QR dan
              bayar QRIS langsung dari browser.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {authenticatedMerchant ? (
                <>
                  <Link
                    href="/cashier/orders"
                    onPointerDown={() => triggerCausalHaptic(8)}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full bg-scarlet-600 px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Buka Kasir ({authenticatedMerchant.name})
                  </Link>
                  <Link
                    href={`/${authenticatedMerchant.slug}?table=TABLE%2004`}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full border border-sky-200 bg-cloud px-6 py-3 text-sm font-semibold text-ink-primary hover:bg-sky-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Menu Pelanggan (/{authenticatedMerchant.slug})
                  </Link>
                  <Link
                    href="/onboarding?mode=edit"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
                  >
                    Pengaturan Profil
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/onboarding?mode=new"
                    onPointerDown={() => triggerCausalHaptic(8)}
                    className="apple-interactive inline-flex min-h-[46px] items-center gap-2 rounded-full bg-scarlet-600 px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    <UserPlus aria-hidden="true" weight="bold" className="h-4 w-4 text-white" />
                    <span>Buat Akun Gratis</span>
                  </Link>
                  <Link
                    href={`/${demoMerchant.slug}?table=TABLE%2004`}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full border border-sky-200 bg-cloud px-6 py-3 text-sm font-semibold text-ink-primary shadow-apple-sm hover:bg-sky-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Coba Simulasi Demo (Meja 04)
                  </Link>
                  <Link
                    href="/login"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[46px] items-center gap-1.5 rounded-full border border-sky-200/80 bg-cloud/90 px-5 py-3 text-sm font-semibold text-ink-primary hover:bg-cloud active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    <SignIn aria-hidden="true" weight="regular" className="h-4 w-4" />
                    <span>Masuk Pemilik Resto</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Kartu Akun hanya tampil apabila pemilik restoran sudah berhasil login */}
          {authenticatedMerchant && (
            <div className="saber-ticket-pass w-full shrink-0 rounded-[22px] border border-sky-200/80 bg-cloud p-6 shadow-apple-sm lg:w-80">
              <div className="saber-ticket-divider flex items-start justify-between gap-2 border-b border-sky-100 pb-4">
                <div className="min-w-0">
                  <p className="hig-caption text-[11px] font-semibold text-ink-secondary">
                    {activeMerchant.isDemo ? 'Pratinjau Mode Simulasi' : 'Akun Restoran Aktif'}
                  </p>
                  <h2 className="mt-0.5 truncate font-serif text-lg font-bold text-ink-primary">
                    {activeMerchant.name}
                  </h2>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    activeMerchant.isStoreOpen
                      ? 'bg-emerald-500/12 text-emerald-700'
                      : 'bg-scarlet-50 text-scarlet-600'
                  }`}
                >
                  {activeMerchant.isStoreOpen ? 'Buka' : 'Tutup'}
                </span>
              </div>

              <dl className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium text-ink-secondary">Alamat Menu QR</dt>
                  <dd className="truncate font-mono font-semibold text-sky-700">
                    {displayHost}/{activeMerchant.slug}
                  </dd>
                </div>
                {!activeMerchant.isDemo && activeMerchant.email && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="font-medium text-ink-secondary">Email Akun</dt>
                    <dd className="truncate font-mono font-medium text-ink-primary">
                      {activeMerchant.email}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-ink-secondary">Bank Penerima</dt>
                  <dd className="truncate font-medium text-ink-primary">{activeMerchant.bankName}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-ink-secondary">Notifikasi WhatsApp</dt>
                  <dd
                    className={`font-mono font-semibold ${
                      whatsappReady ? 'text-emerald-700' : 'text-ink-secondary'
                    }`}
                  >
                    {whatsappReady ? 'Aktif' : 'Log Lokal'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-ink-secondary">Antrean Dapur</dt>
                  <dd className="tabular-nums font-bold text-ink-primary">
                    {activeMerchant.activeTicketCount} Tiket Aktif
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-sky-100 pt-3.5 text-xs">
                {activeMerchant.isDemo ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwitchScope(authenticatedMerchant.slug)}
                    className="font-semibold text-sky-700 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  >
                    Kembali ke {authenticatedMerchant.name}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwitchScope(demoMerchant.slug)}
                    className="font-semibold text-ink-secondary hover:text-ink-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  >
                    Lihat Simulasi Demo
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 font-semibold text-scarlet-600 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600"
                >
                  <SignOut aria-hidden="true" weight="regular" className="h-3.5 w-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tiga Pilihan Penggunaan — Cloud White 30% Cards on Sky Blue Ground */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-sky-200/60 pt-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-cloud p-5 shadow-apple-sm">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">
                Simulasi Demo Meja &amp; Kasir
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                Gunakan restoran contoh{' '}
                <strong className="text-ink-primary">{demoMerchant.name}</strong> untuk mencoba scan
                QR meja, pesan menu, serta verifikasi pesanan di kasir.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
              <Link
                href={`/${demoMerchant.slug}?table=TABLE%2004`}
                className="text-sky-700 hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                Menu Meja 04
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleSwitchScope(demoMerchant.slug, '/cashier/orders')}
                className="text-ink-primary hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                Kasir Demo
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-cloud p-5 shadow-apple-sm ring-1 ring-scarlet-600/10">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">
                Buat Akun Pemilik Baru
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                Daftar akun pemilik gratis dalam 30 detik terlebih dahulu, lalu lanjut atur profil
                restoran <code className="font-mono text-ink-primary">/[slug]</code> &amp; QRIS.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold">
              <Link
                href="/onboarding?mode=new"
                className="inline-flex items-center font-bold text-scarlet-600 hover:text-scarlet-700 hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600"
              >
                Buat Akun Gratis
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-cloud p-5 shadow-apple-sm">
            <div>
              <h2 className="text-sm font-bold text-ink-primary">
                {authenticatedMerchant
                  ? `Akun: ${authenticatedMerchant.name}`
                  : 'Akses Dasbor Terdaftar'}
              </h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-secondary">
                <LockSimple
                  aria-hidden="true"
                  weight="regular"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <span>
                  {authenticatedMerchant
                    ? 'Dasbor, stok menu, dan catatan pesanan toko Anda hanya dapat dibuka oleh pemilik akun ini.'
                    : 'Setiap restoran dilindungi login pemilik agar pengunjung atau toko lain tidak dapat membuka data usaha Anda.'}
                </span>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
              {authenticatedMerchant ? (
                <>
                  <Link
                    href="/onboarding?mode=edit"
                    className="text-sky-700 hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  >
                    Ubah Profil Toko
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLogout}
                    className="text-scarlet-600 hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600"
                  >
                    Keluar Akun
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-sky-700 hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  Masuk ke Akun Saya
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Kumpulan Modul Operasional — Rule of 3 (Maks 3 Modul, Terlipat Default, Klik untuk Detail) */}
      <section className="mt-10" aria-labelledby="modul-pengelolaan-heading">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 id="modul-pengelolaan-heading" className="hig-title-2 text-ink-primary">
              Modul Pengelolaan Restoran &amp; Dapur
            </h2>
          </div>
          <p className="text-xs font-medium text-ink-secondary">
            Klik salah satu modul untuk membuka rincian fitur &amp; pintasan halaman
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          {coreModuleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <details
                key={group.id}
                className="group rounded-[22px] border border-sky-100 bg-cloud shadow-apple-sm motion-safe:transition-colors open:border-sky-300 open:shadow-apple-md"
              >
                <summary
                  onPointerDown={() => triggerCausalHaptic(5)}
                  className="flex cursor-pointer list-none items-center justify-between gap-3.5 p-5 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-800 motion-safe:transition-colors group-open:bg-scarlet-600 group-open:text-white">
                      <Icon aria-hidden="true" weight="duotone" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold text-ink-secondary">
                        {group.domain}
                      </span>
                      <span className="mt-0.5 block truncate text-base font-bold tracking-tight text-ink-primary">
                        {group.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-sky-900 border border-sky-100">
                      {group.metric}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-700 motion-safe:transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180 group-open:bg-scarlet-50 group-open:text-scarlet-600">
                      <CaretDown aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </summary>

                <div className="border-t border-sky-100 px-5 pb-5 pt-4">
                  <p className="text-xs leading-relaxed text-ink-secondary">{group.summary}</p>

                  {/* Maksimal 3 poin utama (Rule of 3) */}
                  <ul className="mt-3 space-y-2">
                    {group.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-xs leading-snug text-ink-primary"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-scarlet-600"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Maksimal 3 tombol pintasan */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 pt-1">
                    {group.actions.map((act) => (
                      <Link
                        key={act.route}
                        href={act.route}
                        onPointerDown={() => triggerCausalHaptic(6)}
                        className={
                          act.primary
                            ? 'apple-interactive inline-flex min-h-[38px] items-center rounded-full bg-scarlet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-scarlet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors'
                            : 'apple-interactive inline-flex min-h-[38px] items-center rounded-full border border-sky-200 bg-sky-50/80 px-3.5 py-2 text-xs font-semibold text-ink-primary hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors'
                        }
                      >
                        {act.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
