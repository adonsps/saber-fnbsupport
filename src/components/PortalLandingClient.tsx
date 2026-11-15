'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaretDown, SignOut } from '@phosphor-icons/react';
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

  const coreModuleGroups = [
    {
      id: 'menu-qr',
      title: 'Menu & QR Meja',
      metric: `${activeMerchant.menuCount} menu, ${activeMerchant.tableCount} meja`,
      summary:
        'Atur daftar hidangan, ketersediaan stok harian, dan lembar kode QR untuk setiap meja pelanggan.',
      highlights: [
        {
          term: 'Katalog & Stok Harian',
          detail: 'Ubah harga, foto hidangan, dan matikan menu yang sedang habis dalam satu ketukan.',
        },
        {
          term: 'Lembar QR Siap Cetak',
          detail: 'Unduh stiker QR meja ukuran A4 atau A5 lengkap dengan informasi Wi-Fi toko.',
        },
        {
          term: 'Pesan Tanpa Aplikasi',
          detail: 'Tamu cukup membuka kamera ponsel di meja untuk memilih menu dan memesan.',
        },
      ],
      actions: [
        { label: 'Kelola Menu', route: '/admin/menu' },
        { label: 'Cetak QR Meja', route: '/admin/tables' },
        { label: 'Layar Tamu', route: `/${activeMerchant.slug}?table=TABLE%2004` },
      ],
    },
    {
      id: 'cashier-kitchen',
      title: 'Kasir & Antrean Dapur',
      metric: `${activeMerchant.activeTicketCount} pesanan aktif`,
      summary:
        'Terima pesanan masuk dari meja maupun pesan antar, periksa bukti bayar QRIS, dan perbarui status masak.',
      highlights: [
        {
          term: 'Antrean Pesanan Terpadu',
          detail: 'Pantau tiket pesanan baru, sedang dimasak, hingga siap diantar ke meja pelanggan.',
        },
        {
          term: 'Verifikasi QRIS & Tunai',
          detail: 'Periksa foto bukti transfer QRIS pelanggan atau catat pembayaran tunai di kasir.',
        },
        {
          term: 'Kabar Otomatis WhatsApp',
          detail: 'Pelanggan menerima pesan WhatsApp saat pesanan dikonfirmasi dan siap disajikan.',
        },
      ],
      actions: [
        { label: 'Buka Kasir & Dapur', route: '/cashier/orders' },
      ],
    },
    {
      id: 'analytics-profile',
      title: 'Laporan & Rekening Toko',
      metric: formatIdr(activeMerchant.revenueIdr),
      summary:
        'Pantau rekap pemasukan harian utuh tanpa potongan komisi serta atur rekening bank dan QRIS toko.',
      highlights: [
        {
          term: 'Rekap Penjualan Harian',
          detail: 'Ringkasan pemasukan tunai dan QRIS per shift yang siap diunduh ke CSV atau PDF.',
        },
        {
          term: 'Hidangan Terlaris',
          detail: 'Lihat urutan menu favorit pelanggan dan pulihkan stok menu untuk shift berikutnya.',
        },
        {
          term: 'Profil & Rekening QRIS',
          detail: 'Atur jam buka, kurir toko, nomor WhatsApp pemilik, serta kode QRIS bank Anda.',
        },
      ],
      actions: [
        { label: 'Laporan Shift', route: '/admin/analytics' },
        {
          label: authenticatedMerchant ? 'Pengaturan Toko' : 'Buat Akun Toko',
          route: authenticatedMerchant ? '/onboarding?mode=edit' : '/onboarding?mode=new',
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      {/* Stage Hero — 12-Column Asymmetric Split on 60% Sky Blue Ground */}
      <section aria-labelledby="hero-heading" className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="min-w-0 lg:col-span-6">
          <h1 id="hero-heading" className="apple-display text-ink-primary">
            Pesanan meja langsung masuk ke dapur.
          </h1>

          <p className="hig-body mt-5 max-w-[50ch] text-ink-secondary">
            Tanpa potongan komisi. Tamu scan QR meja dan bayar QRIS dari browser.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            {authenticatedMerchant ? (
              <>
                <Link
                  href="/cashier/orders"
                  onPointerDown={() => triggerCausalHaptic(8)}
                  className="apple-interactive inline-flex min-h-[48px] items-center whitespace-nowrap rounded-xl bg-scarlet-600 px-6 py-3 text-base font-semibold text-cloud hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                >
                  Buka Kasir &amp; Dapur
                </Link>
                <Link
                  href={`/${authenticatedMerchant.slug}?table=TABLE%2004`}
                  onPointerDown={() => triggerCausalHaptic(6)}
                  className="apple-interactive inline-flex min-h-[48px] items-center whitespace-nowrap rounded-xl border border-sky-200 bg-cloud px-5 py-3 text-base font-semibold text-ink-primary hover:bg-sky-100/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                >
                  Lihat Menu Tamu
                </Link>
                <Link
                  href="/onboarding?mode=edit"
                  onPointerDown={() => triggerCausalHaptic(6)}
                  className="apple-interactive inline-flex min-h-[48px] items-center whitespace-nowrap px-3 py-3 text-base font-medium text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  Atur Profil Toko
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/onboarding?mode=new"
                  onPointerDown={() => triggerCausalHaptic(8)}
                  className="apple-interactive inline-flex min-h-[48px] items-center whitespace-nowrap rounded-xl bg-scarlet-600 px-6 py-3 text-base font-semibold text-cloud hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                >
                  Buat Akun Toko
                </Link>
                <Link
                  href={`/${demoMerchant.slug}?table=TABLE%2004`}
                  onPointerDown={() => triggerCausalHaptic(6)}
                  className="apple-interactive inline-flex min-h-[48px] items-center whitespace-nowrap rounded-xl border border-sky-200 bg-cloud px-5 py-3 text-base font-semibold text-ink-primary hover:bg-sky-100/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                >
                  Coba Menu Meja 04
                </Link>
                <Link
                  href="/login"
                  onPointerDown={() => triggerCausalHaptic(6)}
                  className="apple-interactive inline-flex min-h-[48px] items-center whitespace-nowrap px-3 py-3 text-base font-medium text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  Masuk Pemilik
                </Link>
              </>
            )}
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-sky-200 pt-6">
            <div>
              <dt className="text-sm text-ink-secondary">Potongan komisi</dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink-primary">
                0%
              </dd>
            </div>
            <div className="border-l border-sky-200 pl-6">
              <dt className="text-sm text-ink-secondary">Katalog aktif</dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink-primary">
                {activeMerchant.menuCount} menu
              </dd>
            </div>
            <div className="border-l border-sky-200 pl-6">
              <dt className="text-sm text-ink-secondary">Titik meja</dt>
              <dd className="mt-1 font-serif text-2xl font-bold tabular-nums text-ink-primary">
                {activeMerchant.tableCount} QR
              </dd>
            </div>
          </dl>
        </div>

        {/* Signature Visual — Authentic Bistro Photography + Live Store Pass on 30% Cloud White */}
        <div className="min-w-0 lg:col-span-6">
          <div className="overflow-hidden rounded-2xl border border-sky-200 bg-cloud">
            <img
              src="/hero-bg.webp"
              alt="Meja bistro dengan pencahayaan pagi alami dan sajian kuliner"
              width={1200}
              height={750}
              fetchPriority="high"
              className="aspect-[16/10] w-full object-cover object-center"
            />

            {authenticatedMerchant ? (
              <div className="border-t border-sky-100 p-6">
                <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-secondary">
                      {activeMerchant.isDemo ? 'Menampilkan Toko Contoh' : 'Toko Terhubung'}
                    </p>
                    <h2 className="mt-0.5 truncate font-serif text-xl font-bold text-ink-primary">
                      {activeMerchant.name}
                    </h2>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-lg px-3 py-1 text-xs font-semibold ${
                      activeMerchant.isStoreOpen
                        ? 'bg-sky-50 text-signal-green'
                        : 'bg-scarlet-50 text-scarlet-600'
                    }`}
                  >
                    {activeMerchant.isStoreOpen ? 'Buka' : 'Tutup'}
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-secondary">Tautan QR meja</dt>
                    <dd className="mt-0.5 truncate font-mono font-semibold text-sky-700">
                      {displayHost}/{activeMerchant.slug}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary">Rekening penerima</dt>
                    <dd className="mt-0.5 truncate font-semibold text-ink-primary">
                      {activeMerchant.bankName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary">Kabar WhatsApp</dt>
                    <dd className="mt-0.5 font-semibold text-ink-primary">
                      {whatsappReady ? 'Aktif otomatis' : 'Tercatat di sistem'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-secondary">Antrean dapur</dt>
                    <dd className="mt-0.5 font-bold tabular-nums text-ink-primary">
                      {activeMerchant.activeTicketCount} pesanan aktif
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sky-100 pt-4 text-sm">
                  {activeMerchant.isDemo ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSwitchScope(authenticatedMerchant.slug)}
                      className="font-semibold text-sky-700 underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                    >
                      Kembali ke {authenticatedMerchant.name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleSwitchScope(demoMerchant.slug)}
                      className="font-medium text-ink-secondary underline-offset-4 hover:text-ink-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                    >
                      Buka toko contoh
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1.5 font-semibold text-scarlet-600 underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600"
                  >
                    <SignOut aria-hidden="true" weight="regular" className="h-4 w-4" />
                    <span>Keluar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col justify-between gap-4 border-t border-sky-100 p-6 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-secondary">
                    Contoh toko siap dicoba
                  </p>
                  <p className="mt-0.5 truncate font-serif text-lg font-bold text-ink-primary">
                    {demoMerchant.name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
                  <Link
                    href={`/${demoMerchant.slug}?table=TABLE%2004`}
                    className="whitespace-nowrap text-sky-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  >
                    Layar Tamu Meja 04
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwitchScope(demoMerchant.slug, '/cashier/orders')}
                    className="whitespace-nowrap text-ink-primary underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  >
                    Buka Kasir Contoh
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Ruang Kerja Restoran — Asymmetric 4+8 Split with Hairline Disclosure Rows (Rule of 3) */}
      <section
        aria-labelledby="modul-pengelolaan-heading"
        className="mt-16 grid grid-cols-1 gap-8 border-t border-sky-200 pt-14 lg:grid-cols-12 lg:gap-12"
      >
        <div className="lg:col-span-4">
          <h2 id="modul-pengelolaan-heading" className="hig-title-2 text-ink-primary">
            Tiga ruang kerja utama.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-secondary">
            Pilih bagian yang ingin dibuka. Semua terhubung dari meja tamu hingga laporan kasir.
          </p>
        </div>

        <div className="lg:col-span-8">
          <div className="divide-y divide-sky-200 rounded-2xl border border-sky-200 bg-cloud">
            {coreModuleGroups.map((group) => (
              <details key={group.id} className="group">
                <summary
                  onPointerDown={() => triggerCausalHaptic(5)}
                  className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 select-none hover:bg-sky-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 [&::-webkit-details-marker]:hidden"
                >
                  <span className="font-serif text-xl font-bold text-ink-primary">
                    {group.title}
                  </span>

                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-lg bg-sky-50 px-3 py-1 text-sm font-medium tabular-nums text-ink-secondary">
                      {group.metric}
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-ink-primary motion-safe:transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180 group-open:bg-scarlet-50 group-open:text-scarlet-600">
                      <CaretDown aria-hidden="true" weight="bold" className="h-4 w-4" />
                    </span>
                  </div>
                </summary>

                <div className="border-t border-sky-100 px-6 pb-6 pt-5">
                  <p className="max-w-[62ch] text-base leading-relaxed text-ink-secondary">
                    {group.summary}
                  </p>

                  <dl className="mt-5 grid grid-cols-1 gap-5 border-t border-sky-100 pt-5 sm:grid-cols-3">
                    {group.highlights.map((item) => (
                      <div key={item.term}>
                        <dt className="text-sm font-semibold text-ink-primary">{item.term}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-ink-secondary">
                          {item.detail}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-sky-100 pt-4">
                    {group.actions.map((act, idx) => (
                      <Link
                        key={act.route}
                        href={act.route}
                        onPointerDown={() => triggerCausalHaptic(6)}
                        className={
                          idx === 0
                            ? 'apple-interactive inline-flex min-h-[42px] items-center whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-ink-primary hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 motion-safe:transition-colors'
                            : 'apple-interactive inline-flex min-h-[42px] items-center whitespace-nowrap px-3 py-2 text-sm font-medium text-sky-700 underline-offset-4 hover:text-sky-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600'
                        }
                      >
                        {act.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Colophon Footer */}
      <footer className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-sky-200 py-8 text-sm text-ink-secondary sm:flex-row sm:items-center">
        <p className="font-medium text-ink-primary">
          Saber Culinary · Pesan meja QR dan kasir dapur langsung
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <Link
            href={`/${demoMerchant.slug}?table=TABLE%2004`}
            className="hover:text-ink-primary hover:underline"
          >
            Menu Contoh
          </Link>
          <Link href="/cashier/orders" className="hover:text-ink-primary hover:underline">
            Kasir &amp; Dapur
          </Link>
          <Link href="/onboarding?mode=new" className="hover:text-ink-primary hover:underline">
            Buat Akun Toko
          </Link>
          <Link href="/login" className="hover:text-ink-primary hover:underline">
            Masuk
          </Link>
        </div>
      </footer>
    </div>
  );
}
