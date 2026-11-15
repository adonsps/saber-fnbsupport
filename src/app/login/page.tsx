'use client';

import React, { Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeSlash, LockSimple, WhatsappLogo } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { SaberLogo } from '@/components/SaberLogo';
import { triggerCausalHaptic } from '@/lib/apple-motion';

function sanitizeNextPath(raw?: string | null): string {
  if (!raw) return '/cashier/orders';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/cashier/orders';
  }
  return trimmed;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm font-medium text-ink-secondary">Memuat halaman masuk…</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Forgot Password / WhatsApp OTP Reset State
  const [showForgotPanel, setShowForgotPanel] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'info' | 'error'; text: string } | null>(
    null
  );
  const [resetBusy, setResetBusy] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    triggerCausalHaptic(8);
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Email atau kata sandi salah.');
        emailInputRef.current?.focus();
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setErrorMsg('Gangguan jaringan saat menghubungi server login.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    setResetBusy(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail || email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetStatus({ type: 'error', text: data.error || 'Gagal meminta kode OTP.' });
        return;
      }
      setResetEmail((prev) => prev || email);
      setResetStep('confirm');
      setResetStatus({
        type: 'info',
        text: data.message,
      });
    } catch {
      setResetStatus({ type: 'error', text: 'Gagal menghubungi server WhatsApp OTP.' });
    } finally {
      setResetBusy(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus(null);
    setResetBusy(true);
    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          otp: resetOtp,
          newPassword: resetNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetStatus({ type: 'error', text: data.error || 'Gagal mengatur ulang kata sandi.' });
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setResetStatus({ type: 'error', text: 'Gangguan jaringan saat memperbarui kata sandi.' });
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-10 sm:px-6 sm:pt-14">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <SaberLogo size="lg" />
        </div>
        <h1 id="login-heading" className="hig-culinary-serif text-ink-primary">
          Masuk ke Akun Toko
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">
          Kelola daftar menu, stiker QR meja, antrean kasir dapur, dan laporan penjualan harian.
        </p>
      </div>

      <section className="rounded-2xl border border-sky-200 bg-cloud p-6 sm:p-8">
        {!showForgotPanel ? (
          <form
            action="/api/v1/auth/login"
            method="POST"
            aria-labelledby="login-heading"
            onSubmit={handleSignIn}
            className="space-y-5"
          >
            {errorMsg && (
              <div
                role="alert"
                aria-live="polite"
                className="rounded-xl border border-scarlet-200 bg-scarlet-50 px-4 py-3 text-xs font-medium text-scarlet-600"
              >
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-sm font-semibold text-ink-primary">
                Email Pemilik <span aria-hidden="true" className="text-scarlet-600">*</span>
              </label>
              <input
                ref={emailInputRef}
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                enterKeyHint="next"
                required
                aria-invalid={Boolean(errorMsg)}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="pemilik@restorananda.com"
                className="mt-1.5 min-h-[48px] w-full rounded-xl border border-sky-200 bg-sky-50/70 px-4 text-base text-ink-primary motion-safe:transition-colors focus:border-sky-600 focus:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-sm font-semibold text-ink-primary"
                >
                  Kata Sandi <span aria-hidden="true" className="text-scarlet-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPanel(true);
                    setResetEmail(email);
                    setResetStatus(null);
                  }}
                  className="text-xs font-semibold text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  Lupa kata sandi?
                </button>
              </div>

              <div className="relative mt-1.5">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  aria-invalid={Boolean(errorMsg)}
                  aria-describedby="login-toggle-warning"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Minimal 8 karakter"
                  className="min-h-[48px] w-full rounded-xl border border-sky-200 bg-sky-50/70 pl-4 pr-12 text-base text-ink-primary motion-safe:transition-colors focus:border-sky-600 focus:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-secondary hover:bg-sky-100/60 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                >
                  {showPassword ? (
                    <EyeSlash aria-hidden="true" weight="regular" className="h-4 w-4" />
                  ) : (
                    <Eye aria-hidden="true" weight="regular" className="h-4 w-4" />
                  )}
                </button>
              </div>
              <span id="login-toggle-warning" className="sr-only">
                Menampilkan kata sandi akan memperlihatkannya di layar perangkat Anda.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="apple-interactive flex min-h-[48px] w-full items-center justify-center rounded-xl bg-scarlet-600 px-6 py-3 text-base font-semibold text-cloud hover:bg-scarlet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 focus-visible:ring-offset-2 motion-safe:transition-colors"
            >
              {submitting ? 'Memverifikasi Akun…' : 'Masuk ke Akun'}
            </button>

            <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-ink-secondary">
              <LockSimple aria-hidden="true" weight="duotone" className="h-4 w-4 shrink-0" />
              <span>Terisolasi per akun: pengguna lain tidak dapat membuka toko Anda.</span>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-sky-100 pb-3">
              <div className="flex items-center gap-2">
                <WhatsappLogo
                  aria-hidden="true"
                  weight="duotone"
                  className="h-4 w-4 text-signal-green"
                />
                <h2 className="text-sm font-bold text-ink-primary">Reset Kata Sandi via WhatsApp</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPanel(false);
                  setResetStep('request');
                  setResetStatus(null);
                }}
                className="text-xs font-semibold text-sky-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
              >
                Kembali ke Login
              </button>
            </div>

            {resetStatus && (
              <div
                role={resetStatus.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={cn(
                  'rounded-xl border px-3.5 py-2.5 text-xs font-medium',
                  resetStatus.type === 'error'
                    ? 'border-scarlet-200 bg-scarlet-50 text-scarlet-600'
                    : 'border-sky-200 bg-sky-50 text-signal-green'
                )}
              >
                {resetStatus.text}
              </div>
            )}

            {resetStep === 'request' ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-email"
                    className="block text-sm font-semibold text-ink-primary"
                  >
                    Email Akun Terdaftar <span aria-hidden="true" className="text-scarlet-600">*</span>
                  </label>
                  <input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    spellCheck={false}
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="pemilik@restorananda.com"
                    className="mt-1.5 min-h-[48px] w-full rounded-xl border border-sky-200 bg-sky-50/70 px-4 text-base text-ink-primary focus:border-sky-600 focus:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  />
                  <p className="mt-1.5 text-xs text-ink-secondary">
                    Kode OTP 6 digit akan dikirimkan melalui WhatsApp ke nomor pemilik toko Anda.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={resetBusy}
                  className="apple-interactive flex min-h-[46px] w-full items-center justify-center rounded-xl bg-scarlet-600 px-5 text-sm font-semibold text-cloud hover:bg-scarlet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600"
                >
                  {resetBusy ? 'Mengirim OTP…' : 'Kirim Kode OTP ke WhatsApp'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div>
                  <label htmlFor="reset-otp" className="block text-sm font-semibold text-ink-primary">
                    Kode OTP (6 Digit dari WhatsApp){' '}
                    <span aria-hidden="true" className="text-scarlet-600">
                      *
                    </span>
                  </label>
                  <input
                    id="reset-otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    required
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="mt-1.5 min-h-[48px] w-full rounded-xl border border-sky-200 bg-sky-50/70 px-4 font-mono text-base font-bold tracking-widest text-ink-primary focus:border-sky-600 focus:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reset-new-pw"
                    className="block text-sm font-semibold text-ink-primary"
                  >
                    Kata Sandi Baru (Minimal 8 Karakter){' '}
                    <span aria-hidden="true" className="text-scarlet-600">
                      *
                    </span>
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="reset-new-pw"
                      name="new-password"
                      type={showResetPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      className="min-h-[48px] w-full rounded-xl border border-sky-200 bg-sky-50/70 pl-4 pr-12 text-base text-ink-primary focus:border-sky-600 focus:bg-cloud focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                    />
                    <button
                      type="button"
                      aria-pressed={showResetPassword}
                      aria-label={
                        showResetPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                      }
                      onClick={() => setShowResetPassword((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                    >
                      {showResetPassword ? (
                        <EyeSlash aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Eye aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={resetBusy}
                  className="apple-interactive flex min-h-[46px] w-full items-center justify-center rounded-xl bg-scarlet-600 px-5 text-sm font-semibold text-cloud hover:bg-scarlet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600"
                >
                  {resetBusy ? 'Menyimpan Kata Sandi…' : 'Simpan & Masuk ke Akun'}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col items-center gap-2.5 text-center text-sm text-ink-secondary">
        <p>
          Pemilik restoran baru?{' '}
          <Link
            href="/onboarding?mode=new"
            className="font-semibold text-scarlet-600 underline-offset-4 hover:underline"
          >
            Buat Akun Toko
          </Link>
        </p>
        <p>
          Ingin mencoba alur tanpa login?{' '}
          <Link
            href="/"
            className="font-semibold text-ink-primary underline-offset-4 hover:underline"
          >
            Kembali ke Beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
