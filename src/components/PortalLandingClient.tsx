'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaretDown, CookingPot, SignIn, SignOut, User } from '@phosphor-icons/react';
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

const PROMO_DEADLINE_MS = new Date('2026-12-12T00:00:00+07:00').getTime();

function calculatePromoTimeLeft() {
  const diff = PROMO_DEADLINE_MS - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  };
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
  const [timeLeft, setTimeLeft] = useState({
    days: 25,
    hours: 18,
    minutes: 0,
    seconds: 0,
    expired: false,
  });

  useEffect(() => {
    setTimeLeft(calculatePromoTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculatePromoTimeLeft());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
        { label: 'Layar Tamu', route: `/${activeMerchant.slug}?table=Demo` },
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
      {/* Stage Hero — 12-Column Asymmetric Split with Seamless Culinary & Smartphone Background */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden rounded-3xl border border-sky-200/90 bg-cloud px-6 py-10 shadow-sm sm:px-10 sm:py-14 lg:p-12"
      >
        {/* Ambient Lifestyle Visual — Smartphone & Gourmet Plate seamless background */}
        <div className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden">
          <img
            src="/hero-bg.webp"
            alt="Sajian kuliner di atas piring dan smartphone untuk pesan menu digital"
            width={1376}
            height={768}
            fetchPriority="high"
            className="h-full w-full object-cover object-right lg:object-[82%_center]"
          />
          {/* Seamless scrim: pure cloud white ground for left text, smoothly revealing the physical dining scene on the right */}
          <div className="absolute inset-0 bg-gradient-to-r from-cloud via-cloud/90 to-transparent lg:from-cloud lg:via-cloud/80 lg:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-cloud/70 via-transparent to-transparent lg:hidden" />
        </div>

        <div className="relative z-10 grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Punchline Badge, Headline, Subhead, CTA Buttons, and 2-Sided Quick Show */}
          <div className="min-w-0 lg:col-span-7">
            {/* Big Free Offer Announcement with Strikethrough & Countdown */}
            <div className="mb-6 rounded-2xl border border-scarlet-200 bg-scarlet-50/95 p-4 sm:p-5 shadow-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="inline-flex items-center rounded-md bg-scarlet-600 px-2.5 py-0.5 text-xs font-bold text-cloud shadow-xs">
                  100% Gratis
                </span>
                <span className="font-serif text-3xl font-bold tabular-nums text-scarlet-700 sm:text-4xl">
                  Rp 0
                </span>
                <span className="text-base font-semibold tabular-nums text-ink-secondary/70 line-through decoration-scarlet-600 decoration-2">
                  Rp 3.000.000
                </span>
                <span className="text-xs font-medium text-scarlet-800">
                  Bebas biaya lisensi selamanya
                </span>
              </div>

              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-scarlet-200/80 pt-3 text-xs text-ink-secondary">
                <span className="font-medium text-ink-primary">
                  Khusus pendaftaran sebelum 12 Desember 2026 (00:00 WIB):
                </span>
                {/* Tabular Live Countdown */}
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums text-scarlet-700">
                  <span className="rounded border border-scarlet-200 bg-cloud px-1.5 py-0.5 shadow-xs">
                    {timeLeft.days} hari
                  </span>
                  <span className="rounded border border-scarlet-200 bg-cloud px-1.5 py-0.5 shadow-xs">
                    {String(timeLeft.hours).padStart(2, '0')} jam
                  </span>
                  <span className="rounded border border-scarlet-200 bg-cloud px-1.5 py-0.5 shadow-xs">
                    {String(timeLeft.minutes).padStart(2, '0')} mnt
                  </span>
                  <span className="rounded border border-scarlet-200 bg-cloud px-1.5 py-0.5 shadow-xs">
                    {String(timeLeft.seconds).padStart(2, '0')} dtk
                  </span>
                </div>
              </div>
            </div>

            <h1 id="hero-heading" className="apple-display text-ink-primary">
              Pesanan meja langsung masuk ke dapur.
            </h1>

            <p className="hig-body mt-5 max-w-[48ch] text-ink-secondary">
              Tanpa potongan komisi. Tamu pesan dan bayar QRIS langsung dari browser.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {authenticatedMerchant ? (
                <>
                  <Link
                    href="/cashier/orders"
                    onPointerDown={() => triggerCausalHaptic(8)}
                    className="apple-interactive inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-full bg-scarlet-600 px-6 py-3 text-base font-semibold text-cloud shadow-sm hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Buka Kasir &amp; Dapur
                  </Link>
                  <Link
                    href={`/${authenticatedMerchant.slug}?table=Demo`}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-full border border-sky-300 bg-cloud px-5 py-3 text-base font-semibold text-ink-primary shadow-sm hover:bg-sky-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Lihat Menu Tamu
                  </Link>
                  <Link
                    href="/onboarding?mode=edit"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-full border border-sky-300 bg-cloud px-5 py-3 text-base font-semibold text-ink-primary shadow-sm hover:bg-sky-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Atur Profil Toko
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/onboarding?mode=new"
                    onPointerDown={() => triggerCausalHaptic(8)}
                    className="apple-interactive inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-full bg-scarlet-600 px-6 py-3 text-base font-semibold text-cloud shadow-sm hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    Daftarkan Restoran Baru
                  </Link>
                  <Link
                    href="/login"
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-full border border-sky-300 bg-cloud px-5 py-3 text-base font-semibold text-ink-primary shadow-sm hover:bg-sky-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
                  >
                    <SignIn aria-hidden="true" weight="bold" className="h-4 w-4 text-ink-secondary" />
                    <span>Masuk Pemilik Resto</span>
                  </Link>
                </>
              )}
            </div>

            {/* Quick Show 2 Sisi — Integrated directly into the action flow */}
            {!authenticatedMerchant && (
              <div id="quick-show" className="mt-8 rounded-2xl border border-sky-200/90 bg-cloud/95 p-5 shadow-sm backdrop-blur-sm sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b border-sky-100 pb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-secondary">Simulasi langsung 2 sisi</p>
                    <p className="mt-0.5 truncate font-serif text-base font-bold text-ink-primary">{demoMerchant.name}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">Toko Contoh</span>
                </div>

                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Link
                    href={`/${demoMerchant.slug}?table=Demo`}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive flex items-center justify-between gap-3 whitespace-nowrap rounded-xl bg-sky-600 px-4 py-3 text-xs font-semibold text-cloud shadow-sm hover:bg-sky-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 motion-safe:transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <User aria-hidden="true" weight="bold" className="h-4 w-4" />
                      <span>Sisi Pelanggan</span>
                    </span>
                    <span className="rounded bg-sky-700/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-100">Pesan Menu</span>
                  </Link>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleSwitchScope(demoMerchant.slug, '/cashier/orders')}
                    onPointerDown={() => triggerCausalHaptic(6)}
                    className="apple-interactive flex items-center justify-between gap-3 whitespace-nowrap rounded-xl border border-sky-300 bg-cloud px-4 py-3 text-xs font-semibold text-ink-primary shadow-sm hover:bg-sky-50 active:scale-[0.98] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 motion-safe:transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <CookingPot aria-hidden="true" weight="bold" className="h-4 w-4 text-scarlet-600" />
                      <span>Sisi Pemilik</span>
                    </span>
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">Kasir</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Open dining visual with contextual annotation or Active Store Pass */}
          <div className="min-w-0 lg:col-span-5">
            {authenticatedMerchant ? (
              <div className="overflow-hidden rounded-2xl border border-sky-200 bg-cloud/95 shadow-sm backdrop-blur-sm">
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-secondary">
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
                        Buka simulasi contoh
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
              </div>
            ) : (
              /* Right column left completely unobstructed to showcase the smartphone and plated dining visual */
              <div aria-hidden="true" className="hidden lg:block min-h-[420px]" />
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
            href={`/${demoMerchant.slug}?table=Demo`}
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
