'use client';

import React, { Suspense, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeSlash, LockSimple, WhatsappLogo } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { SaberLogo } from '@/components/SaberLogo';
import { triggerCausalHaptic } from '@/lib/apple-motion';

function sanitizeNextPath(raw?: string | null): string {
  if (!raw) return '/';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/';
  }
  return trimmed;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="font-mono text-xs font-medium text-[#515154]">Loading sign-in...</p>
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
    <div className="mx-auto max-w-md px-4 pt-8 sm:px-6 sm:pt-12">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <SaberLogo size="lg" />
        </div>
        <p className="hig-caption text-xs font-semibold uppercase tracking-[0.06em] text-[#515154]">
          Merchant Portal Authentication
        </p>
        <h1 id="login-heading" className="hig-culinary-serif mt-1.5 text-[#1D1D1F]">
          Sign In to Your Restaurant
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#515154]">
          Akses privat ke dasbor restoran Anda: Menu &amp; Stok, QR Meja, Kasir Kanban, dan Laporan
          Shift.
        </p>
      </div>

      <section className="hig-grouped-card rounded-[28px] p-6 sm:p-8">
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
                className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-[#D70015]"
              >
                {errorMsg}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-[#1D1D1F]">
                Email Pemilik Restoran <span aria-hidden="true" className="text-[#D70015]">*</span>
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
                className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-300 bg-[#F5F5F7]/60 px-4 text-sm text-[#1D1D1F] outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-[#1D1D1F]"
                >
                  Kata Sandi <span aria-hidden="true" className="text-[#D70015]">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPanel(true);
                    setResetEmail(email);
                    setResetStatus(null);
                  }}
                  className="text-xs font-semibold text-apple-blue hover:underline"
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
                  className="min-h-[48px] w-full rounded-2xl border border-zinc-300 bg-[#F5F5F7]/60 pl-4 pr-12 text-sm text-[#1D1D1F] outline-none transition-all focus:border-apple-blue focus:bg-white focus:ring-4 focus:ring-apple-blue/10"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#515154] hover:bg-black/[0.05] hover:text-[#1D1D1F]"
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
              className="apple-interactive flex min-h-[48px] w-full items-center justify-center rounded-full bg-apple-blue px-6 py-3 text-sm font-semibold text-white shadow-apple-sm hover:bg-apple-blueHover disabled:opacity-60"
            >
              {submitting ? 'Memverifikasi Akun...' : 'Sign In'}
            </button>

            <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-[#515154]">
              <LockSimple aria-hidden="true" weight="duotone" className="h-3.5 w-3.5" />
              <span>Terisolasi per akun — pengguna lain tidak dapat membuka toko Anda.</span>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <WhatsappLogo
                  aria-hidden="true"
                  weight="duotone"
                  className="h-4 w-4 text-[#1D7D32]"
                />
                <h2 className="text-sm font-bold text-[#1D1D1F]">Reset Kata Sandi via WhatsApp</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPanel(false);
                  setResetStep('request');
                  setResetStatus(null);
                }}
                className="text-xs font-semibold text-apple-blue hover:underline"
              >
                Kembali ke Login
              </button>
            </div>

            {resetStatus && (
              <div
                role={resetStatus.type === 'error' ? 'alert' : 'status'}
                aria-live="polite"
                className={cn(
                  'rounded-2xl border px-3.5 py-2.5 text-xs font-medium',
                  resetStatus.type === 'error'
                    ? 'border-red-200 bg-red-50 text-[#D70015]'
                    : 'border-emerald-200 bg-emerald-50 text-[#1D7D32]'
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
                    className="block text-xs font-semibold text-[#1D1D1F]"
                  >
                    Email Akun Terdaftar <span aria-hidden="true" className="text-[#D70015]">*</span>
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
                    className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-300 bg-[#F5F5F7]/60 px-4 text-sm outline-none focus:border-apple-blue focus:bg-white"
                  />
                  <p className="mt-1 text-[11px] text-[#515154]">
                    Kode OTP 6 digit akan dikirimkan melalui Fonnte Bot ke nomor WhatsApp pemilik
                    restoran Anda.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={resetBusy}
                  className="apple-interactive flex min-h-[46px] w-full items-center justify-center rounded-full bg-apple-blue px-5 text-xs font-bold text-white hover:bg-apple-blueHover disabled:opacity-60"
                >
                  {resetBusy ? 'Mengirim OTP...' : 'Kirim Kode OTP ke WhatsApp'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div>
                  <label htmlFor="reset-otp" className="block text-xs font-semibold text-[#1D1D1F]">
                    Kode OTP (6 Digit dari WhatsApp){' '}
                    <span aria-hidden="true" className="text-[#D70015]">
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
                    className="mt-1.5 min-h-[48px] w-full rounded-2xl border border-zinc-300 bg-[#F5F5F7]/60 px-4 font-mono text-base font-bold tracking-widest outline-none focus:border-apple-blue focus:bg-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reset-new-pw"
                    className="block text-xs font-semibold text-[#1D1D1F]"
                  >
                    Kata Sandi Baru (Minimal 8 Karakter){' '}
                    <span aria-hidden="true" className="text-[#D70015]">
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
                      className="min-h-[48px] w-full rounded-2xl border border-zinc-300 bg-[#F5F5F7]/60 pl-4 pr-12 text-sm outline-none focus:border-apple-blue focus:bg-white"
                    />
                    <button
                      type="button"
                      aria-pressed={showResetPassword}
                      aria-label={
                        showResetPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
                      }
                      onClick={() => setShowResetPassword((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[#515154]"
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
                  className="apple-interactive flex min-h-[46px] w-full items-center justify-center rounded-full bg-apple-blue px-5 text-xs font-bold text-white hover:bg-apple-blueHover disabled:opacity-60"
                >
                  {resetBusy ? 'Menyimpan Kata Sandi...' : 'Simpan & Masuk ke Akun'}
                </button>
              </form>
            )}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col items-center gap-2 text-center text-xs text-[#515154]">
        <p>
          Pemilik restoran baru?{' '}
          <Link href="/onboarding?mode=new" className="font-semibold text-apple-blue hover:underline">
            Daftarkan Restoran Baru →
          </Link>
        </p>
        <p>
          Ingin mencoba alur tanpa login?{' '}
          <Link href="/" className="font-semibold text-[#1D1D1F] hover:underline">
            Kembali ke Demo Sandbox
          </Link>
        </p>
      </div>
    </div>
  );
}
