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
        { label: 'Buka Kasir & Dapur →', route: '/cashier/orders', primary: true },
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
      {/* Bagian Utama Hero — Bahasa Indonesia Konsisten + Apple HIG Surface */}
      <section className="hig-grouped-card relative overflow-hidden rounded-[26px] p-7 sm:p-11">
        <div className="relative z-10 flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className={authenticatedMerchant ? 'max-w-2xl space-y-4' : 'max-w-4xl space-y-4'}>
            <p className="hig-caption text-xs font-semibold uppercase tracking-[0.06em] text-[#515154]">
              Saber Platform Kuliner &amp; Pemesanan Langsung
            </p>

            <h1 className="hig-culinary-serif text-[#1D1D1F]">
              Pemesanan QR Meja &amp; Kasir Dapur Langsung untuk Usaha Kuliner Indonesia.
            </h1>

            <p className="hig-body max-w-[54ch] text-[#515154]">
              <strong className="font-semibold text-[#1D1D1F]">0% komisi aplikasi</strong> &amp; tanpa
              mesin kasir tambahan. Terima pesanan QR meja, cek bukti bayar QRIS, dan kirim notifikasi{' '}
              <strong className="font-semibold text-[#1D1D1F]">Bot WhatsApp Saber</strong> otomatis
              langsung dari browser.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {authenticatedMerchant ? (
                <>
                  <Link
                    href="/cashier/orders"
                    onPointerDown={() => triggerCausalHaptic(8)}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover"
                  >
                    Buka Kasir ({authenticatedMerchant.name})
                  </Link>
                  <Link
                    href={`/${authenticatedMerchant.slug}?table=TABLE%2004`}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
                  >
                    Menu Pelanggan (/{authenticatedMerchant.slug})
                  </Link>
                  <Link
                    href="/onboarding?mode=edit"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[44px] items-center px-3 py-2 text-sm font-semibold text-apple-blue hover:underline"
                  >
                    Pengaturan Profil
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/${demoMerchant.slug}?table=TABLE%2004`}
                    onPointerDown={() => triggerCausalHaptic(8)}
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover"
                  >
                    Coba Simulasi Demo (Meja 04)
                  </Link>
                  <Link
                    href="/onboarding?mode=new"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[46px] items-center gap-1.5 rounded-full border border-black/[0.12] bg-[#F5F5F7] px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
                  >
                    <UserPlus aria-hidden="true" weight="bold" className="h-4 w-4 text-apple-blue" />
                    <span>Buat Akun Gratis</span>
                  </Link>
                  <Link
                    href="/login"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[46px] items-center gap-1.5 rounded-full border border-black/[0.14] bg-white px-5 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#F5F5F7]"
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
            <div className="saber-ticket-pass w-full shrink-0 rounded-[22px] p-6 lg:w-80">
              <div className="saber-ticket-divider flex items-start justify-between gap-2 pb-4">
                <div className="min-w-0">
                  <p className="hig-caption text-[11px] font-semibold uppercase text-[#515154]">
                    {activeMerchant.isDemo ? 'Pratinjau Mode Simulasi' : 'Akun Restoran Aktif'}
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
                  {activeMerchant.isStoreOpen ? 'Buka' : 'Tutup'}
                </span>
              </div>

              <dl className="mt-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <dt className="font-medium text-[#515154]">Alamat Menu QR</dt>
                  <dd className="truncate font-mono font-semibold text-apple-blue">
                    {displayHost}/{activeMerchant.slug}
                  </dd>
                </div>
                {!activeMerchant.isDemo && activeMerchant.email && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="font-medium text-[#515154]">Email Akun</dt>
                    <dd className="truncate font-mono font-medium text-[#1D1D1F]">
                      {activeMerchant.email}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-[#515154]">Bank Penerima</dt>
                  <dd className="truncate font-medium text-[#1D1D1F]">{activeMerchant.bankName}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-[#515154]">Notifikasi WhatsApp</dt>
                  <dd
                    className={`font-mono font-semibold ${
                      whatsappReady ? 'text-[#1D7D32]' : 'text-[#515154]'
                    }`}
                  >
                    {whatsappReady ? 'Aktif' : 'Log Lokal'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="font-medium text-[#515154]">Antrean Dapur</dt>
                  <dd className="tabular-nums font-mono font-bold text-[#1D1D1F]">
                    {activeMerchant.activeTicketCount} Tiket Aktif
                  </dd>
                </div>
              </dl>

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
                    Lihat Simulasi Demo
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
            </div>
          )}
        </div>

        {/* Tiga Pilihan Penggunaan — Tanpa angka urutan artifisial agar sesuai Craft Apple Design */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-black/[0.08] pt-6 md:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-5">
            <div>
              <p className="hig-caption text-[11px] font-semibold uppercase tracking-wider text-apple-blue">
                Simulasi Demo
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                Uji Alur Pelanggan &amp; Kasir Tanpa Daftar
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                Gunakan restoran contoh{' '}
                <strong className="text-[#1D1D1F]">{demoMerchant.name}</strong> untuk mencoba scan
                QR meja, pesan menu, serta verifikasi pesanan di kasir.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
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
              <p className="hig-caption text-[11px] font-semibold uppercase tracking-wider text-[#1D1D1F]">
                Mulai Cepat (30 Detik)
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                Buat Akun Dulu, Setup Resto Kemudian
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                Daftar akun pemilik gratis dalam 30 detik terlebih dahulu, lalu lanjut atur profil
                restoran <code className="font-mono text-[#1D1D1F]">/[slug]</code> &amp; QRIS.
              </p>
            </div>
            <div className="mt-4 text-xs font-semibold">
              <Link href="/onboarding?mode=new" className="text-apple-blue hover:underline">
                Buat Akun Gratis →
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-5">
            <div>
              <p className="hig-caption text-[11px] font-semibold uppercase tracking-wider text-[#1D7D32]">
                Akun Terdaftar
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                {authenticatedMerchant
                  ? `Terhubung ke ${authenticatedMerchant.name}`
                  : 'Masuk untuk Mengelola Toko Anda'}
              </h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-[#515154]">
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
                  <Link href="/onboarding?mode=edit" className="text-apple-blue hover:underline">
                    Ubah Profil Toko →
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

      {/* Kumpulan Modul Operasional — Rule of 3 (Maks 3 Modul, Terlipat Default, Klik untuk Detail) */}
      <section className="mt-10" aria-labelledby="modul-pengelolaan-heading">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="hig-caption text-xs font-semibold uppercase tracking-[0.05em] text-[#515154]">
              3 Pilar Utama •{' '}
              {authenticatedMerchant && !activeMerchant.isDemo
                ? activeMerchant.name
                : 'Mode Simulasi Demo'}
            </p>
            <h2 id="modul-pengelolaan-heading" className="hig-title-2 mt-0.5 text-[#1D1D1F]">
              Modul Pengelolaan Restoran &amp; Dapur
            </h2>
          </div>
          <p className="text-xs font-medium text-[#515154]">
            Klik salah satu modul untuk membuka rincian fitur &amp; pintasan halaman
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          {coreModuleGroups.map((group) => {
            const Icon = group.icon;
            return (
              <details
                key={group.id}
                className="group rounded-[22px] border border-black/[0.08] bg-white shadow-apple-sm transition-all open:border-apple-blue/35 open:shadow-apple-md"
              >
                <summary
                  onPointerDown={() => triggerCausalHaptic(5)}
                  className="flex cursor-pointer list-none items-center justify-between gap-3.5 p-5 select-none [&::-webkit-details-marker]:hidden"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#1D1D1F] transition-colors group-open:bg-apple-blue group-open:text-white">
                      <Icon aria-hidden="true" weight="duotone" className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#515154]">
                        {group.domain}
                      </span>
                      <span className="mt-0.5 block truncate text-base font-bold tracking-tight text-[#1D1D1F]">
                        {group.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-[#F5F5F7] px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums text-[#1D1D1F]">
                      {group.metric}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5F7] text-[#515154] transition-transform duration-200 group-open:rotate-180 group-open:bg-apple-blue/10 group-open:text-apple-blue">
                      <CaretDown aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </summary>

                <div className="border-t border-black/[0.06] px-5 pb-5 pt-4">
                  <p className="text-xs leading-relaxed text-[#515154]">{group.summary}</p>

                  {/* Maksimal 3 poin utama (Rule of 3) */}
                  <ul className="mt-3 space-y-2">
                    {group.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-xs leading-snug text-[#1D1D1F]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-apple-blue"
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
                            ? 'apple-interactive inline-flex min-h-[38px] items-center rounded-full bg-apple-blue px-4 py-2 text-xs font-semibold text-white hover:bg-apple-blueHover'
                            : 'apple-interactive inline-flex min-h-[38px] items-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-3.5 py-2 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]'
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
