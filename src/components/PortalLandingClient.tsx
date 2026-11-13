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

  const modules = [
    ...(authenticatedMerchant
      ? [
          {
            domain: 'Profil Usaha',
            title: 'Identitas Toko & Rekening QRIS',
            route: '/onboarding?mode=edit',
            description:
              'Perbarui nama usaha, jam operasional, radius pengiriman mandiri, QRIS Statis, serta rekening bank tujuan transfer.',
            icon: Storefront,
            metric: `/${activeMerchant.slug}`,
          },
        ]
      : [
          {
            domain: 'Pendaftaran Baru',
            title: 'Daftarkan Restoran Anda',
            route: '/onboarding?mode=new',
            description:
              'Buat akun pemilik usaha beserta tautan menu /[slug], jam buka harian, serta rekening transfer & QRIS Statis dalam tiga langkah.',
            icon: Storefront,
            metric: '3 Langkah Setup',
          },
        ]),
    {
      domain: 'Katalog & Stok',
      title: 'Manajemen Menu Dwi-Bahasa & Stok',
      route: '/admin/menu',
      description:
        'Atur daftar hidangan Indonesia & Inggris, urutan kategori, tombol Buka/Tutup sementara, serta saklar Habis (Sold Out) instan.',
      icon: BowlFood,
      metric: `${activeMerchant.menuCount} Menu`,
    },
    {
      domain: 'Meja & Cetak QR',
      title: 'QR Meja & Cetak Lembar PDF A4/A5',
      route: '/admin/tables',
      description:
        'Pantau status meja Terisi atau Kosong, buat daftar meja secara massal, dan unduh stiker meja QR beserta info Wi-Fi tamu.',
      icon: QrCode,
      metric: `${activeMerchant.tableCount} Meja`,
    },
    {
      domain: 'Dapur & Kasir',
      title: 'Papan Kasir Kanban 5-Tahap & WhatsApp',
      route: '/cashier/orders',
      description:
        'Kelola antrean dapur lima tahap dengan audit stok parsial, verifikasi bukti bayar QRIS, pindah/gabung meja, serta riwayat pesan WhatsApp.',
      icon: CookingPot,
      metric: `${activeMerchant.activeTicketCount} Antrean Aktif`,
    },
    {
      domain: 'Laporan Penjualan',
      title: 'Laporan Shift Harian & Kontrol Toko',
      route: '/admin/analytics',
      description:
        'Ringkasan pendapatan kotor (IDR), rincian metode bayar Tunai vs. QRIS, 5 menu terlaris, pulihkan stok 1 klik, serta ekspor CSV/PDF.',
      icon: ChartBar,
      metric: formatIdr(activeMerchant.revenueIdr),
    },
    {
      domain: 'Tampilan Pelanggan',
      title: 'Pratinjau Menu Scan QR Tamu',
      route: `/${activeMerchant.slug}?table=TABLE%2004`,
      description:
        'Saat QR dipindai tamu, layar terkunci hanya membuka halaman menu pemesanan & status pesanan tanpa akses ke menu admin/kasir.',
      icon: ForkKnife,
      metric: 'Khusus Pelanggan',
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

            <p className="hig-body max-w-[64ch] text-[#515154]">
              Dirancang khusus untuk warung makan, kafe, restoran makan di tempat, hingga dapur
              pesan antar. Seluruh pemasukan diterima utuh 0% komisi aplikasi, berjalan di browser
              tanpa perangkat kasir tambahan, serta dilengkapi verifikasi stok &amp; bukti bayar
              QRIS dengan notifikasi{' '}
              <strong className="font-semibold text-[#1D1D1F]">
                Bot WhatsApp Terpusat Saber
              </strong>
              .
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
                    className="apple-interactive inline-flex min-h-[46px] items-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
                  >
                    Daftarkan Restoran Baru
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
                Pemilik Restoran Baru
              </p>
              <h2 className="mt-1 text-sm font-bold text-[#1D1D1F]">
                Daftarkan Akun &amp; Menu Usaha Anda
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                Buat akun pemilik dengan email &amp; kata sandi, alamat toko{' '}
                <code className="font-mono text-[#1D1D1F]">/[slug]</code>, QR meja siap cetak, dan
                QRIS 0% potongan.
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

      {/* Kumpulan Modul Operasional */}
      <section className="mt-10">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="hig-caption text-xs font-semibold uppercase tracking-[0.05em] text-[#515154]">
              Area Operasional • {authenticatedMerchant && !activeMerchant.isDemo ? activeMerchant.name : 'Mode Simulasi Demo'}
            </p>
            <h2 className="hig-title-2 mt-0.5 text-[#1D1D1F]">
              Modul Pengelolaan Restoran &amp; Dapur
            </h2>
          </div>
          <p className="text-xs font-medium text-[#515154]">
            {authenticatedMerchant
              ? `Seluruh modul di bawah sedang mengelola data usaha ${activeMerchant.name}`
              : 'Sebelum masuk ke akun usaha Anda, seluruh modul berjalan aman pada restoran contoh'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.title}
                href={mod.route}
                onPointerDown={() => triggerCausalHaptic(6)}
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
                  <span>Buka Halaman</span>
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
