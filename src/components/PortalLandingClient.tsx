'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BowlFood,
  ChartBar,
  CookingPot,
  ForkKnife,
  LockSimple,
  QrCode,
  Receipt,
  Storefront,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { cn, formatIdr } from '@/lib/utils';
import { SaberLogo } from '@/components/SaberLogo';
import { triggerCausalHaptic } from '@/lib/apple-motion';

export interface PortalMerchantSummary {
  id: string;
  name: string;
  slug: string;
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
  merchants: PortalMerchantSummary[];
  displayHost: string;
  fonnteConfigured: boolean;
}

export function PortalLandingClient({
  activeMerchant,
  merchants,
  displayHost,
  fonnteConfigured,
}: PortalLandingClientProps) {
  const router = useRouter();
  const [switchingSlug, setSwitchingSlug] = useState<string | null>(null);
  const customMerchants = merchants.filter((m) => !m.isDemo);
  const demoMerchant = merchants.find((m) => m.isDemo) || merchants[0];

  const handleSwitchWorkspace = async (slug: string, redirectTo?: string) => {
    triggerCausalHaptic(8);
    setSwitchingSlug(slug);
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
      setSwitchingSlug(null);
    }
  };

  const operatorModules = [
    {
      domain: '1 • Identitas & QRIS',
      title: 'Profil Resto, Jam Buka & Rekening',
      route: '/onboarding?mode=edit',
      description:
        'Atur nama toko, URL menu /[slug], nomor WhatsApp penerima order, radius pesan antar mandiri, QRIS Statis & rekening bank.',
      icon: Storefront,
      metric: `/${activeMerchant.slug}`,
    },
    {
      domain: '2 • Katalog & Stok',
      title: 'Menu Bilingual (ID | EN) & Stok',
      route: '/admin/menu',
      description:
        'Tambah/ubah menu hidangan dwi-bahasa, atur urutan kategori, tombol Buka/Pause Toko, dan saklar Habis (Sold Out) seketika.',
      icon: BowlFood,
      metric: `${activeMerchant.menuCount} Menu`,
    },
    {
      domain: '3 • QR Meja & PDF',
      title: 'Generator QR Meja & Cetak PDF A4/A5',
      route: '/admin/tables',
      description:
        'Buat nomor meja satuan atau massal, pantau status meja Terisi vs Kosong, dan ekspor stiker meja QR + Wi-Fi tamu siap cetak.',
      icon: QrCode,
      metric: `${activeMerchant.tableCount} Meja`,
    },
    {
      domain: '4 • Dapur & Pembayaran',
      title: 'Kasir Kanban 5-Tahap & Fonnte WA',
      route: '/cashier/orders',
      description:
        'Audit ketersediaan stok dapur, verifikasi bukti transfer QRIS/Bank, pindah/gabung meja, serta log pesan WhatsApp otomatis.',
      icon: CookingPot,
      metric: `${activeMerchant.activeTicketCount} Antrean`,
    },
    {
      domain: '5 • Omzet & Tutup Buku',
      title: 'Laporan Shift Harian & Ekspor CSV/PDF',
      route: '/admin/analytics',
      description:
        'Ringkasan penjualan per shift, pembagian tunai vs QRIS, 5 menu terlaris, dan pulihkan stok seluruh menu dalam 1 klik.',
      icon: ChartBar,
      metric: formatIdr(activeMerchant.revenueIdr),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      {/* HERO: Clear Internet-Ready SaaS Introduction + Mode Banner */}
      <section className="hig-grouped-card overflow-hidden rounded-[26px] p-6 sm:p-10">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-[#0F1E36]/12 bg-[#F5F5F7] px-3 py-1.5">
              <SaberLogo size="sm" className="h-5 w-5 rounded-[6px]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#0F1E36]">
                Saber Culinary • Zero-Commission F&amp;B Platform
              </span>
            </div>

            <h1 className="hig-culinary-serif text-[#1D1D1F]">
              Direct Table QR Ordering &amp; Kitchen Cashier for Indonesian Culinary Merchants.
            </h1>

            <p className="hig-body max-w-[64ch] text-[#515154]">
              Tamu cukup scan QR di meja tanpa download aplikasi atau daftar akun. Kasir mengaudit
              stok &amp; bukti bayar QRIS dari browser, dan sistem mengirim notifikasi pesanan
              otomatis via{' '}
              <strong className="font-semibold text-[#1D1D1F]">
                WhatsApp Gateway (Fonnte API)
              </strong>{' '}
              dengan 0% potongan komisi.
            </p>
          </div>

          {/* Right Context Card: Shows unmistakably whether user is inspecting DEMO or LIVE MERCHANT */}
          <div className="saber-ticket-pass w-full shrink-0 rounded-[22px] p-5 lg:w-[340px]">
            <div className="saber-ticket-divider flex items-start justify-between gap-2 pb-4">
              <div className="min-w-0">
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    activeMerchant.isDemo
                      ? 'bg-[#0090FF]/12 text-[#0066CC]'
                      : 'bg-emerald-500/12 text-[#1D7D32]'
                  )}
                >
                  {activeMerchant.isDemo
                    ? 'Workspace Aktif: Mode Demo Sandbox'
                    : 'Workspace Aktif: Restoran Anda'}
                </span>
                <h2 className="mt-1.5 truncate font-serif text-lg font-bold text-[#1D1D1F]">
                  {activeMerchant.name}
                </h2>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                  activeMerchant.isStoreOpen
                    ? 'bg-emerald-500/12 text-[#1D7D32]'
                    : 'bg-red-500/12 text-[#D70015]'
                )}
              >
                {activeMerchant.isStoreOpen ? 'Open' : 'Paused'}
              </span>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#515154]">Alamat Menu QR</dt>
                <dd className="truncate font-mono font-bold text-apple-blue">
                  {displayHost}/{activeMerchant.slug}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#515154]">WhatsApp Pemilik</dt>
                <dd className="font-mono font-semibold text-[#1D1D1F]">
                  {activeMerchant.ownerWhatsapp}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#515154]">WhatsApp Engine</dt>
                <dd
                  className={cn(
                    'inline-flex items-center gap-1 font-mono font-bold',
                    fonnteConfigured ? 'text-[#1D7D32]' : 'text-[#B25000]'
                  )}
                >
                  <WhatsappLogo aria-hidden="true" weight="duotone" className="h-3.5 w-3.5" />
                  <span>{fonnteConfigured ? 'Fonnte Live' : 'Local Log'}</span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[#515154]">Rekening / QRIS</dt>
                <dd className="truncate font-medium text-[#1D1D1F]">{activeMerchant.bankName}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* THREE CLEAR PATHWAYS: Demo vs New Restaurant vs Existing Merchant */}
        <div className="mt-8 border-t border-black/[0.08] pt-7">
          <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <p className="hig-caption text-[11px] font-bold uppercase tracking-[0.06em] text-[#515154]">
                Pilih Peran &amp; Jalur Anda
              </p>
              <h2 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
                Coba Simulasi Demo atau Gunakan untuk Restoran Asli Anda
              </h2>
            </div>
            <p className="text-xs text-[#515154]">
              Setiap restoran baru memiliki URL menu, QR meja, dan papan kasir terpisah.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Pathway 1: Try Demo Sandbox */}
            <article className="flex flex-col justify-between rounded-[22px] border border-[#0090FF]/25 bg-white p-5 shadow-apple-sm">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#0090FF]/12 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#0066CC]">
                    1 • Live Demo Sandbox
                  </span>
                  <span className="text-[11px] font-medium text-[#515154]">Tanpa Daftar</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-[#1D1D1F]">
                  Uji Coba Simulasi Alur Lengkap
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                  Coba peran tamu &amp; kasir memakai restoran contoh{' '}
                  <strong className="text-[#1D1D1F]">{demoMerchant.name}</strong> tanpa mengubah data
                  toko asli Anda.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <Link
                  href={`/${demoMerchant.slug}?table=TABLE%2004`}
                  className="apple-interactive inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-apple-blue px-4 text-xs font-bold text-white shadow-apple-sm hover:bg-apple-blueHover"
                >
                  <ForkKnife aria-hidden="true" weight="duotone" className="h-4 w-4" />
                  <span>Buka Menu Tamu Demo (Meja 04)</span>
                </Link>
                <button
                  type="button"
                  disabled={switchingSlug === demoMerchant.slug}
                  onClick={() => handleSwitchWorkspace(demoMerchant.slug, '/cashier/orders')}
                  className="apple-interactive inline-flex min-h-[40px] items-center justify-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-4 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4] disabled:opacity-60"
                >
                  Masuk Dapur &amp; Kasir Demo →
                </button>
              </div>
            </article>

            {/* Pathway 2: New Restaurant Onboarding */}
            <article className="flex flex-col justify-between rounded-[22px] border border-[#0F1E36]/20 bg-[#0F1E36] p-5 text-white shadow-apple-md">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#0090FF] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    2 • Daftar Restoran Baru
                  </span>
                  <span className="text-[11px] font-medium text-white/75">3 Menit Aktif</span>
                </div>
                <h3 className="mt-3 text-base font-bold text-white">
                  Buat Akun &amp; Menu Restoran Anda
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/80">
                  Daftarkan nama resto, tentukan URL toko <code className="text-[#7CC8FF]">/[slug]</code>,
                  pasang QRIS/bank Anda, dan hubungkan nomor WhatsApp untuk terima notifikasi pesanan.
                </p>
              </div>

              <div className="mt-5">
                <Link
                  href="/onboarding?mode=new"
                  onClick={() => triggerCausalHaptic(8)}
                  className="apple-interactive inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-xs font-bold text-[#0F1E36] shadow-apple-sm hover:bg-zinc-100"
                >
                  <Storefront aria-hidden="true" weight="duotone" className="h-4 w-4" />
                  <span>Daftarkan Restoran Baru</span>
                  <ArrowRight aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>

            {/* Pathway 3: Existing Onboarded Merchant Portal */}
            <article className="flex flex-col justify-between rounded-[22px] border border-emerald-600/20 bg-white p-5 shadow-apple-sm">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#1D7D32]">
                    3 • Sudah Punya Resto?
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-[#515154]">
                    {customMerchants.length} Terdaftar
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-[#1D1D1F]">
                  Pilih &amp; Konfigurasi Toko Anda
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#515154]">
                  {customMerchants.length > 0
                    ? 'Pilih restoran terdaftar Anda di bawah untuk mengedit profil, menu, QR meja, atau membuka kasir.'
                    : 'Setelah mendaftarkan restoran baru, nama restoran Anda akan muncul di sini agar mudah dikelola kapan saja.'}
                </p>

                <div className="mt-3.5">
                  <label
                    htmlFor="workspace-merchant-select"
                    className="block text-[11px] font-semibold text-[#515154]"
                  >
                    Workspace Restoran Aktif:
                  </label>
                  <select
                    id="workspace-merchant-select"
                    value={activeMerchant.slug}
                    disabled={switchingSlug !== null}
                    onChange={(e) => handleSwitchWorkspace(e.target.value)}
                    className="mt-1 min-h-[42px] w-full rounded-xl border border-black/[0.12] bg-[#F5F5F7] px-3 text-xs font-bold text-[#1D1D1F] outline-none focus:border-apple-blue"
                  >
                    {merchants.map((m) => (
                      <option key={m.id} value={m.slug}>
                        {m.isDemo ? `[DEMO] ${m.name}` : `[LIVE] ${m.name} (/${m.slug})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/onboarding?mode=edit"
                  className="apple-interactive inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full bg-[#1D1D1F] px-4 text-xs font-bold text-white hover:bg-zinc-800"
                >
                  Konfigurasi Profil
                </Link>
                <Link
                  href="/cashier/orders"
                  className="apple-interactive inline-flex min-h-[40px] flex-1 items-center justify-center rounded-full border border-black/[0.12] bg-[#F5F5F7] px-4 text-xs font-semibold text-[#1D1D1F] hover:bg-[#EFEFF4]"
                >
                  Buka Kasir →
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ACTIVE WORKSPACE BACK-OFFICE MODULES */}
      <section className="mt-10">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="hig-caption text-xs font-semibold uppercase tracking-[0.05em] text-[#515154]">
              Portal Merchant &amp; Kasir — {activeMerchant.isDemo ? 'Mode Demo' : 'Toko Aktif'}
            </p>
            <h2 className="hig-title-2 mt-0.5 text-[#1D1D1F]">
              Kelola {activeMerchant.name}
            </h2>
          </div>
          <p className="text-xs font-medium text-[#515154]">
            Semua halaman admin &amp; kasir di bawah beroperasi untuk{' '}
            <code className="font-mono font-bold text-apple-blue">/{activeMerchant.slug}</code>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {operatorModules.map((mod) => {
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
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#1D1D1F] transition-colors group-hover:bg-[#0F1E36] group-hover:text-white">
                      <Icon aria-hidden="true" weight="duotone" className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-[#1D1D1F] transition-colors group-hover:text-apple-blue">
                      {mod.title}
                    </h3>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[#515154]">{mod.description}</p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-black/[0.06] pt-3.5 text-xs font-semibold text-apple-blue">
                  <span>Buka Modul</span>
                  <span aria-hidden="true" className="font-mono text-xs">
                    →
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Customer View Preview Card — Clearly explaining QR isolation */}
          <div className="flex flex-col justify-between rounded-[20px] border border-dashed border-[#0090FF]/40 bg-[#F5F8FC] p-6">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="hig-caption inline-flex items-center gap-1 text-[11px] font-bold uppercase text-[#0066CC]">
                  <LockSimple aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                  Tampilan Pelanggan Terisolasi
                </span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#0066CC]">
                  Customer Only
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-apple-blue text-white">
                  <Receipt aria-hidden="true" weight="duotone" className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold tracking-tight text-[#1D1D1F]">
                  Pratinjau Scan QR Pelanggan
                </h3>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[#515154]">
                Saat pelanggan memindai QR meja, layar hanya membuka menu pemesanan &amp; status
                pesanan tanpa tombol kasir/admin.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-[#0090FF]/15 pt-3.5">
              <Link
                href={`/${activeMerchant.slug}?table=TABLE%2004`}
                className="apple-interactive inline-flex min-h-[36px] items-center rounded-full bg-apple-blue px-3.5 text-xs font-bold text-white hover:bg-apple-blueHover"
              >
                Scan Meja 04 →
              </Link>
              <Link
                href={`/order/${activeMerchant.sampleOrderId}`}
                className="apple-interactive inline-flex min-h-[36px] items-center rounded-full border border-black/10 bg-white px-3.5 text-xs font-semibold text-[#1D1D1F] hover:bg-zinc-50"
              >
                Order Pass
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SIMPLE 4-STEP PLATFORM FLOW FOR PUBLIC VISITORS */}
      <section className="mt-10 rounded-[24px] border border-black/[0.06] bg-white p-6 shadow-apple-sm sm:p-8">
        <div className="mb-5">
          <p className="hig-caption text-[11px] font-bold uppercase tracking-[0.06em] text-[#515154]">
            Cara Kerja 2-Step Verification Loop
          </p>
          <h2 className="text-lg font-bold text-[#1D1D1F]">
            Dari Meja Pelanggan hingga Makanan Disajikan dalam 4 Langkah
          </h2>
        </div>

        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '01',
              title: 'Scan QR Meja & Pesan',
              desc: 'Tamu pilih menu Dine-In, Pick-Up, atau Delivery cukup isi Nama & nomor WhatsApp.',
            },
            {
              step: '02',
              title: 'Konfirmasi Stok Dapur',
              desc: 'Kasir menerima alert WA Fonnte & mengecek stok sebelum tagihan dikirim.',
            },
            {
              step: '03',
              title: 'Bayar QRIS Statis 0% MDR',
              desc: 'Tamu scan QRIS restoran & unggah bukti transfer langsung di halaman Order Pass.',
            },
            {
              step: '04',
              title: 'Masak & Reset Meja Otomatis',
              desc: 'Setelah bukti diverifikasi kasir, dapur memasak & tamu mendapat update WA hingga selesai.',
            },
          ].map((item) => (
            <li
              key={item.step}
              className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4"
            >
              <span className="font-mono text-xs font-bold text-apple-blue">STEP {item.step}</span>
              <h3 className="mt-1 text-sm font-bold text-[#1D1D1F]">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#515154]">{item.desc}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

