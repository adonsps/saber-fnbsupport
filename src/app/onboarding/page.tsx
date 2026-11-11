'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Check,
  Clock,
  CreditCard,
  Eye,
  EyeSlash,
  QrCode,
  Storefront,
  Truck,
} from '@phosphor-icons/react';
import { DEFAULT_HOURS, DEFAULT_QRIS_SVG } from '@/lib/defaults';
import { DaySchedule } from '@/types/schema';
import { cn, formatIdr, slugify } from '@/lib/utils';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';

const INDONESIAN_BANKS = [
  'BCA (Bank Central Asia)',
  'Bank Mandiri',
  'BRI (Bank Rakyat Indonesia)',
  'BNI (Bank Negara Indonesia)',
  'CIMB Niaga',
  'Bank Syariah Indonesia (BSI)',
  'Bank Permata',
  'SeaBank Indonesia',
  'Bank Jago',
];

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="font-mono text-xs font-medium text-[#515154]">Loading onboarding...</p>
        </div>
      }
    >
      <OnboardingWizardContent />
    </Suspense>
  );
}

function OnboardingWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'new' ? 'new' : 'edit';
  const [onboardingMode, setOnboardingMode] = useState<'new' | 'edit'>(initialMode);
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null);
  const [editingOriginalSlug, setEditingOriginalSlug] = useState<string>('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [launchSuccess, setLaunchSuccess] = useState<{
    slug: string;
    subdomainUrl: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Merchant Profile & Protected Login Credentials
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerWhatsapp, setOwnerWhatsapp] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [isEditingDemo, setIsEditingDemo] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    valid: boolean;
    available: boolean;
    message: string;
  }>({
    checking: false,
    valid: false,
    available: false,
    message: 'Masukkan nama restoran Anda untuk membuat alamat URL toko.',
  });

  // Step 2: Operations & Delivery
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState(
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80'
  );
  const [logoProgress, setLogoProgress] = useState<number>(0);
  const [operationalHours, setOperationalHours] = useState<DaySchedule[]>(DEFAULT_HOURS);
  const [isSelfDeliveryEnabled, setIsSelfDeliveryEnabled] = useState(true);
  const [maxDeliveryRadiusKm, setMaxDeliveryRadiusKm] = useState(5);
  const [deliveryFeeIdr, setDeliveryFeeIdr] = useState(10000);

  // Step 3: Payment Credentials
  const [qrisImageUrl, setQrisImageUrl] = useState(DEFAULT_QRIS_SVG);
  const [qrisProgress, setQrisProgress] = useState<number>(0);
  const [bankName, setBankName] = useState('BCA (Bank Central Asia)');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');

  const [appDisplayOrigin, setAppDisplayOrigin] = useState(
    process.env.NEXT_PUBLIC_APP_DOMAIN || 'fnbsupport.saberconsulting.id'
  );

  // Sync mode changes or hydrate active merchant when editing
  useEffect(() => {
    setAppDisplayOrigin(window.location.origin.replace(/^https?:\/\//i, ''));
    setLaunchSuccess(null);
    setErrorMsg(null);
    setStep(1);

    if (onboardingMode === 'new') {
      setEditingMerchantId(null);
      setEditingOriginalSlug('');
      setIsEditingDemo(false);
      setBusinessName('');
      setSlug('');
      setOwnerName('');
      setOwnerWhatsapp('');
      setAccountEmail('');
      setAccountPassword('');
      setAddress('');
      setBankAccountNumber('');
      setBankAccountHolder('');
      setQrisImageUrl(DEFAULT_QRIS_SVG);
      return;
    }

    fetch('/api/v1/merchants/onboard', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.merchant) {
          setEditingMerchantId(data.merchant.id);
          setEditingOriginalSlug(data.merchant.slug);
          setIsEditingDemo(Boolean(data.merchant.isDemo || data.merchant.slug === 'warungmakan'));
          setBusinessName(data.merchant.name);
          setSlug(data.merchant.slug);
          setOwnerName(data.merchant.ownerName);
          setOwnerWhatsapp(data.merchant.ownerWhatsapp);
          setAccountEmail(data.merchant.email || '');
          setAccountPassword('');
        }
        if (data.branch) {
          setAddress(data.branch.address);
          if (data.branch.logoUrl) setLogoUrl(data.branch.logoUrl);
          if (data.branch.operationalHours) {
            try {
              const parsed = JSON.parse(data.branch.operationalHours);
              if (Array.isArray(parsed)) setOperationalHours(parsed);
            } catch {
              // ignore
            }
          }
          setIsSelfDeliveryEnabled(Boolean(data.branch.isSelfDeliveryEnabled));
          setMaxDeliveryRadiusKm(Number(data.branch.maxDeliveryRadiusKm || 5));
          setDeliveryFeeIdr(Number(data.branch.deliveryFeeIdr || 10000));
          if (data.branch.qrisImageUrl) setQrisImageUrl(data.branch.qrisImageUrl);
          if (data.branch.bankName) setBankName(data.branch.bankName);
          if (data.branch.bankAccountNumber) setBankAccountNumber(data.branch.bankAccountNumber);
          if (data.branch.bankAccountHolder) setBankAccountHolder(data.branch.bankAccountHolder);
        }
      })
      .catch(() => {});
  }, [onboardingMode]);

  // Live Slug Availability Check
  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (!clean) {
      setSlugStatus({
        checking: false,
        valid: false,
        available: false,
        message: 'Slug URL toko wajib diisi (contoh: kedai-kopi-senja).',
      });
      return;
    }

    setSlugStatus((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({
        slug: clean,
        mode: onboardingMode,
        currentSlug: editingOriginalSlug,
      });
      fetch(`/api/v1/validate-slug?${qs.toString()}`)
        .then((res) => res.json())
        .then((res) => {
          setSlugStatus({
            checking: false,
            valid: Boolean(res.valid),
            available: Boolean(res.available),
            message: res.message || '',
          });
        })
        .catch(() => {
          setSlugStatus({
            checking: false,
            valid: false,
            available: false,
            message: 'Gagal memvalidasi alamat URL toko.',
          });
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [slug, onboardingMode, editingOriginalSlug]);

  const handleBusinessNameChange = (val: string) => {
    setBusinessName(val);
    if (onboardingMode === 'new') {
      const auto = slugify(val);
      if (auto.length >= 3) {
        setSlug(auto);
      }
    }
  };

  // Client-side square 1:1 crop & resize upload with progress indicator
  const handleSquareLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoProgress(20);

    const reader = new FileReader();
    reader.onload = () => {
      setLogoProgress(55);
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
          setLogoUrl(canvas.toDataURL('image/webp', 0.9));
        }
        setLogoProgress(100);
        setTimeout(() => setLogoProgress(0), 1200);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrisProgress(35);
    const reader = new FileReader();
    reader.onload = () => {
      setQrisProgress(100);
      setQrisImageUrl(String(reader.result));
      setTimeout(() => setQrisProgress(0), 1200);
    };
    reader.readAsDataURL(file);
  };

  const handleNextStep = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!businessName.trim() || !ownerName.trim() || !ownerWhatsapp.trim()) {
        setErrorMsg('Lengkapi Nama Bisnis, Nama Pemilik, dan Nomor WhatsApp.');
        return;
      }
      if (onboardingMode === 'new') {
        if (!accountEmail.trim() || !accountEmail.includes('@')) {
          setErrorMsg('Masukkan email pemilik yang valid untuk akun login restoran Anda.');
          return;
        }
        if (accountPassword.length < 8) {
          setErrorMsg('Kata sandi akun minimal 8 karakter.');
          return;
        }
      }
      if (!slugStatus.valid || !slugStatus.available) {
        setErrorMsg('Pastikan subdomain slug valid dan tersedia sebelum melanjutkan.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!address.trim()) {
        setErrorMsg('Alamat cabang wajib diisi.');
        return;
      }
      setStep(3);
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/merchants/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: onboardingMode === 'new' ? 'create' : 'update',
          merchantId: onboardingMode === 'edit' ? editingMerchantId || undefined : undefined,
          email: accountEmail.trim() ? accountEmail.trim().toLowerCase() : undefined,
          password: accountPassword || undefined,
          businessName,
          slug,
          ownerName,
          ownerWhatsapp,
          address,
          logoUrl,
          operationalHours,
          isSelfDeliveryEnabled,
          maxDeliveryRadiusKm,
          deliveryFeeIdr,
          qrisImageUrl,
          bankName,
          bankAccountNumber,
          bankAccountHolder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyelesaikan setup merchant');
      }
      setLaunchSuccess({
        slug: data.merchant.slug,
        subdomainUrl: data.subdomainUrl,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSubmitting(false);
    }
  };

  const stepsMeta = [
    { num: 1, title: 'Merchant Profile', subtitle: 'Identity & Store URL', icon: Storefront },
    { num: 2, title: 'Branch & Delivery', subtitle: 'Hours & Courier Radius', icon: Clock },
    { num: 3, title: 'QRIS & Settlement', subtitle: 'Static QRIS & Bank', icon: CreditCard },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
      <div className="mb-8 text-center">
        <p className="hig-caption text-xs font-semibold uppercase tracking-[0.06em] text-[#515154]">
          {onboardingMode === 'new' ? 'Pendaftaran Restoran Baru' : 'Pengaturan Profil Restoran'}
        </p>
        <h1 className="hig-culinary-serif mt-2 text-3xl text-[#1D1D1F] sm:text-4xl">
          {onboardingMode === 'new'
            ? 'Daftarkan Restoran Anda dalam 3 Langkah'
            : 'Kelola & Perbarui Profil Restoran Anda'}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[#515154]">
          {onboardingMode === 'new'
            ? 'Buat URL pemesanan mandiri /[nama-resto], cetak QR meja otomatis, dan terima notifikasi WhatsApp Fonnte tanpa komisi marketplace.'
            : 'Perbarui identitas toko, jam operasional, rekening transfer / QRIS Statis, dan nomor WhatsApp penerima order.'}
        </p>

        {/* Explicit Mode Switcher: New Restaurant vs Configure Existing */}
        <div className="mx-auto mt-5 inline-flex rounded-full border border-black/[0.08] bg-white p-1 shadow-apple-sm">
          <button
            type="button"
            onClick={() => setOnboardingMode('new')}
            className={cn(
              'min-h-[38px] rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              onboardingMode === 'new'
                ? 'bg-[#0F1E36] text-white shadow-sm'
                : 'text-[#515154] hover:text-[#1D1D1F]'
            )}
          >
            + Daftar Restoran Baru
          </button>
          <button
            type="button"
            onClick={() => setOnboardingMode('edit')}
            className={cn(
              'min-h-[38px] rounded-full px-4 py-1.5 text-xs font-bold transition-colors',
              onboardingMode === 'edit'
                ? 'bg-[#0F1E36] text-white shadow-sm'
                : 'text-[#515154] hover:text-[#1D1D1F]'
            )}
          >
            Edit Restoran Aktif
          </button>
        </div>
      </div>

      {/* Apple-Grade Progress Stepper */}
      <nav aria-label="Progress Onboarding" className="mb-8">
        <ol className="grid grid-cols-3 gap-3">
          {stepsMeta.map((s) => {
            const Icon = s.icon;
            const isCurrent = step === s.num;
            const isDone = step > s.num || Boolean(launchSuccess);

            return (
              <li
                key={s.num}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3.5 transition-all',
                  isCurrent
                    ? 'border-apple-blue bg-white shadow-apple-md ring-2 ring-apple-blue/15'
                    : isDone
                    ? 'border-emerald-500/30 bg-emerald-50/60'
                    : 'border-black/[0.06] bg-white/70 opacity-75'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
                    isDone
                      ? 'bg-apple-green text-white'
                      : isCurrent
                      ? 'bg-apple-blue text-white'
                      : 'bg-zinc-200 text-zinc-600'
                  )}
                >
                  {isDone ? (
                    <Check aria-hidden="true" weight="bold" className="h-4 w-4" />
                  ) : (
                    <Icon aria-hidden="true" weight="duotone" className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-zinc-950 sm:text-sm">{s.title}</p>
                  <p className="hidden truncate text-[11px] text-zinc-500 sm:block">{s.subtitle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {errorMsg && (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-[#D70015]"
        >
          {errorMsg}
        </div>
      )}

      {launchSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-[28px] border border-emerald-500/30 bg-white p-8 text-center shadow-apple-lg sm:p-12"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12 text-[#1D7D32]">
            <Storefront aria-hidden="true" weight="duotone" className="h-8 w-8" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-zinc-950">
            Toko Anda Siap Menerima Pesanan!
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
            Mini-site toko Anda telah aktif secara instan dan siap digunakan untuk cetak QR meja
            serta menerima pembayaran QRIS 0% komisi tanpa konfigurasi DNS.
          </p>

            <div className="mx-auto mt-6 max-w-md space-y-3 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Live Storefront URL
                </p>
                <p className="mt-1 break-all font-mono text-sm font-bold text-apple-blue">
                  {launchSuccess.subdomainUrl}
                </p>
              </div>
              {accountEmail && !isEditingDemo && (
                <div className="border-t border-black/[0.08] pt-3">
                  <p className="text-[11px] text-[#515154]">
                    Akun dilindungi login:{' '}
                    <strong className="font-mono text-[#1D1D1F]">{accountEmail}</strong> ·{' '}
                    <Link href="/login" className="font-semibold text-apple-blue hover:underline">
                      Halaman Login
                    </Link>
                  </p>
                </div>
              )}
            </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/menu')}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Atur Menu &amp; Stok
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/tables')}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-black/15 bg-white px-6 py-3 text-sm font-semibold text-[#1D1D1F] hover:bg-zinc-50"
            >
              Cetak QR Meja PDF
            </button>
            <button
              type="button"
              onClick={() => router.push(`/${launchSuccess.slug}`)}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white hover:bg-apple-blueHover"
            >
              Lihat Menu Pelanggan (QR View)
            </button>
          </div>
        </motion.div>
      ) : (
        <form
          onSubmit={handleLaunch}
          className="rounded-[28px] border border-black/[0.06] bg-white p-6 shadow-apple-md sm:p-10"
        >
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                    Profil Merchant & Link Mini-Site Instan
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Data ini menghasilkan link QR toko unik Anda secara otomatis dan rute bot WhatsApp.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="businessName"
                      className="block text-xs font-semibold text-zinc-800"
                    >
                      Nama Bisnis / Warung / Kafe <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => handleBusinessNameChange(e.target.value)}
                      placeholder="Contoh: Warung Kopi Nusantara"
                      className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 text-sm text-zinc-950 outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="slug" className="block text-xs font-semibold text-zinc-800">
                      Storefront URL Slug (<code className="text-apple-blue">^[a-z0-9-]+$</code>){' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="mt-1.5 flex overflow-hidden rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 focus-within:border-apple-blue focus-within:bg-white focus-within:ring-4 focus-within:ring-apple-blue/10">
                      <span className="flex shrink-0 items-center border-r border-zinc-200 bg-zinc-100/80 px-3.5 font-mono text-xs font-medium text-zinc-600">
                        {appDisplayOrigin}/
                      </span>
                      <input
                        id="slug"
                        name="slug"
                        type="text"
                        required
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="contoh-kedai-kopi"
                        className="min-h-[48px] w-full bg-transparent px-3 font-mono text-sm font-semibold text-zinc-950 outline-none"
                      />
                    </div>

                    {/* Live Availability Status Banner */}
                    <div
                      aria-live="polite"
                      className={cn(
                        'mt-2 rounded-xl px-3.5 py-2 text-xs font-medium',
                        slugStatus.checking
                          ? 'bg-zinc-100 text-zinc-600'
                          : slugStatus.valid && slugStatus.available
                          ? 'bg-emerald-50 text-[#1D7D32]'
                          : 'bg-red-50 text-[#D70015]'
                      )}
                    >
                      {slugStatus.checking ? 'Memeriksa ketersediaan subdomain...' : slugStatus.message}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="ownerName" className="block text-xs font-semibold text-zinc-800">
                      Nama Lengkap Pemilik <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="ownerName"
                      name="ownerName"
                      type="text"
                      autoComplete="name"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 text-sm text-zinc-950 outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ownerWhatsapp"
                      className="block text-xs font-semibold text-zinc-800"
                    >
                      Nomor WhatsApp Pemilik/Kasir (+62) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="ownerWhatsapp"
                      name="ownerWhatsapp"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={ownerWhatsapp}
                      onChange={(e) => setOwnerWhatsapp(e.target.value)}
                      placeholder="+62812..."
                      className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 font-mono text-sm text-zinc-950 outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                    />
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Saber Central WA Bot akan mengirim Magic Link pesanan baru ke nomor ini.
                    </p>
                  </div>

                  {!isEditingDemo && (
                    <>
                      <div>
                        <label
                          htmlFor="accountEmail"
                          className="block text-xs font-semibold text-zinc-800"
                        >
                          Email Akun Login Pemilik{' '}
                          {onboardingMode === 'new' && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          id="accountEmail"
                          name="email"
                          type="email"
                          autoComplete="username"
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="none"
                          required={onboardingMode === 'new'}
                          value={accountEmail}
                          onChange={(e) => setAccountEmail(e.target.value)}
                          placeholder="pemilik@restorananda.com"
                          className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 text-sm text-zinc-950 outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                        />
                        <p className="mt-1 text-[11px] text-zinc-500">
                          Digunakan untuk masuk secara privat ke dasbor restoran Anda.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="accountPassword"
                          className="block text-xs font-semibold text-zinc-800"
                        >
                          {onboardingMode === 'new'
                            ? 'Kata Sandi Akun (Min. 8 Karakter)'
                            : 'Kata Sandi Baru (Opsional)'}{' '}
                          {onboardingMode === 'new' && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative mt-1.5">
                          <input
                            id="accountPassword"
                            name="new-password"
                            type={showAccountPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            minLength={onboardingMode === 'new' ? 8 : undefined}
                            required={onboardingMode === 'new'}
                            aria-describedby="onboarding-pw-help"
                            value={accountPassword}
                            onChange={(e) => setAccountPassword(e.target.value)}
                            placeholder={
                              onboardingMode === 'new'
                                ? 'Minimal 8 karakter'
                                : 'Kosongkan jika tidak diubah'
                            }
                            className="min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 pl-4 pr-12 text-sm text-zinc-950 outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                          />
                          <button
                            type="button"
                            aria-pressed={showAccountPassword}
                            aria-label={
                              showAccountPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                            }
                            onClick={() => setShowAccountPassword((prev) => !prev)}
                            className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#515154] hover:bg-black/[0.05]"
                          >
                            {showAccountPassword ? (
                              <EyeSlash aria-hidden="true" className="h-4 w-4" />
                            ) : (
                              <Eye aria-hidden="true" className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <p id="onboarding-pw-help" className="mt-1 text-[11px] text-zinc-500">
                          Melindungi dasbor restoran Anda dari akses pengguna lain.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                    Operasional Cabang, Logo 1:1 & Self-Delivery
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Unggah logo toko (otomatis terpotong 1:1), atur jam buka harian, dan opsi pesan
                    antar mandiri.
                  </p>
                </div>

                {/* Store Logo Upload with 1:1 Auto-Crop */}
                <div className="flex flex-col gap-5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/60 p-4 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-sm">
                    <img
                      src={logoUrl}
                      alt="Store Logo Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-bold text-zinc-950">
                      Logo Toko (Auto-Cropped Square 1:1)
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Ditampilkan pada header mini-site pelanggan dan di tengah lembaran PDF Table QR.
                    </p>
                    <label className="apple-interactive inline-flex min-h-[40px] cursor-pointer items-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50">
                      <span>Pilih Gambar Logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSquareLogoUpload}
                        className="sr-only"
                      />
                    </label>
                    {logoProgress > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full bg-apple-blue transition-all duration-300"
                          style={{ width: `${logoProgress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="block text-xs font-semibold text-zinc-800">
                    Alamat Lengkap Cabang <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    rows={2}
                    required
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 py-3 text-sm text-zinc-950 outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                  />
                </div>

                {/* Operational Hours Array */}
                <div>
                  <p className="mb-2 text-xs font-semibold text-zinc-800">Jam Operasional Harian</p>
                  <div className="divide-y divide-black/[0.05] overflow-hidden rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/40">
                    {operationalHours.map((item, idx) => (
                      <div
                        key={item.day}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs"
                      >
                        <label className="flex items-center gap-2.5 font-medium text-zinc-800">
                          <input
                            type="checkbox"
                            checked={item.isOpen}
                            onChange={(e) => {
                              const next = [...operationalHours];
                              next[idx] = { ...item, isOpen: e.target.checked };
                              setOperationalHours(next);
                            }}
                            className="h-4 w-4 rounded accent-apple-blue"
                          />
                          <span>{item.day}</span>
                        </label>
                        {item.isOpen ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={item.openTime}
                              onChange={(e) => {
                                const next = [...operationalHours];
                                next[idx] = { ...item, openTime: e.target.value };
                                setOperationalHours(next);
                              }}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 font-mono text-xs"
                            />
                            <span className="text-zinc-400">—</span>
                            <input
                              type="time"
                              value={item.closeTime}
                              onChange={(e) => {
                                const next = [...operationalHours];
                                next[idx] = { ...item, closeTime: e.target.value };
                                setOperationalHours(next);
                              }}
                              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 font-mono text-xs"
                            />
                          </div>
                        ) : (
                          <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
                            Tutup / Closed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Self-Delivery Settings */}
                <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/60 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-[#B25000]">
                        <Truck aria-hidden="true" weight="duotone" className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-950">
                          Aktifkan Store Self-Delivery
                        </p>
                        <p className="text-xs text-zinc-500">
                          Kirim pesanan dengan kurir toko tanpa potongan komisi ojol.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSelfDeliveryEnabled}
                      onClick={() => {
                        triggerCausalHaptic(8);
                        setIsSelfDeliveryEnabled(!isSelfDeliveryEnabled);
                      }}
                      className={cn(
                        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors',
                        isSelfDeliveryEnabled
                          ? 'justify-end bg-apple-green'
                          : 'justify-start bg-zinc-300'
                      )}
                    >
                      <motion.span
                        layout
                        transition={APPLE_SPRINGS.default}
                        className="inline-block h-5 w-5 rounded-full bg-white shadow"
                      />
                    </button>
                  </div>

                  {isSelfDeliveryEnabled && (
                    <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="maxRadius"
                          className="block text-xs font-semibold text-zinc-800"
                        >
                          Maksimal Radius Pengantaran (km)
                        </label>
                        <input
                          id="maxRadius"
                          type="number"
                          min={1}
                          max={50}
                          value={maxDeliveryRadiusKm}
                          onChange={(e) => setMaxDeliveryRadiusKm(Number(e.target.value))}
                          className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="deliveryFee"
                          className="block text-xs font-semibold text-zinc-800"
                        >
                          Ongkos Kirim Flat (IDR) — {formatIdr(deliveryFeeIdr)}
                        </label>
                        <input
                          id="deliveryFee"
                          type="number"
                          min={0}
                          step={1000}
                          value={deliveryFeeIdr}
                          onChange={(e) => setDeliveryFeeIdr(Number(e.target.value))}
                          className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-zinc-950">
                    Kredensial Pembayaran Langsung (0% MDR / Fee)
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Unggah poster/barcode QRIS Statis usaha Anda dan detail rekening bank. Dana
                    masuk 100% langsung ke rekening merchant.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Static QRIS Upload */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-[#F5F5F7]/60 p-5 text-center">
                    <div className="mb-3 h-52 w-44 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-apple-sm">
                      <img
                        src={qrisImageUrl}
                        alt="Static QRIS Barcode Preview"
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <label className="apple-interactive inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
                      <QrCode aria-hidden="true" weight="duotone" className="h-3.5 w-3.5" />
                      <span>Upload Gambar QRIS Statis</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrisUpload}
                        className="sr-only"
                      />
                    </label>
                    {qrisProgress > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className="h-full bg-apple-green transition-all duration-300"
                          style={{ width: `${qrisProgress}%` }}
                        />
                      </div>
                    )}
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Format JPG/PNG/SVG. Default QRIS Statis demo sudah terpasang siap pakai.
                    </p>
                  </div>

                  {/* Bank Credentials */}
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="bankName" className="block text-xs font-semibold text-zinc-800">
                        Nama Bank Tujuan <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="bankName"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-3.5 text-sm text-zinc-950 outline-none focus:border-apple-blue focus:bg-white"
                      >
                        {INDONESIAN_BANKS.map((bank) => (
                          <option key={bank} value={bank}>
                            {bank}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="bankAccountNumber"
                        className="block text-xs font-semibold text-zinc-800"
                      >
                        Nomor Rekening <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="bankAccountNumber"
                        type="text"
                        inputMode="numeric"
                        required
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 font-mono text-sm text-zinc-950 outline-none focus:border-apple-blue focus:bg-white"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bankAccountHolder"
                        className="block text-xs font-semibold text-zinc-800"
                      >
                        Nama Pemilik Rekening (a.n.) <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="bankAccountHolder"
                        type="text"
                        required
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/50 px-4 text-sm text-zinc-950 outline-none focus:border-apple-blue focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer Action Buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-black/[0.06] pt-6">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((step - 1) as 1 | 2)}
                className="apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                Previous Step
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Next Step
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-7 py-2.5 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover disabled:opacity-60"
              >
                {submitting ? 'Menyimpan...' : 'Complete Setup & Launch'}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

