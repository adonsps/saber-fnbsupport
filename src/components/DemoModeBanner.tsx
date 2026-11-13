'use client';

import React from 'react';
import Link from 'next/link';
import { WarningCircle } from '@phosphor-icons/react';
import { Merchant } from '@/types/schema';

export function DemoModeBanner({ merchant }: { merchant: Merchant | null }) {
  if (!merchant || (!merchant.isDemo && merchant.slug !== 'warungmakan')) {
    return null;
  }

  return (
    <div
      role="status"
      className="no-print mb-5 flex flex-col justify-between gap-3 rounded-[20px] border border-amber-300/80 bg-amber-50/90 px-4 py-3.5 text-xs text-amber-950 shadow-apple-sm sm:flex-row sm:items-center sm:px-5"
    >
      <div className="flex items-start gap-2.5">
        <WarningCircle
          aria-hidden="true"
          weight="fill"
          className="mt-0.5 h-4 w-4 shrink-0 text-[#B25000]"
        />
        <div>
          <p className="font-bold">
            Mode Sandbox Demo Publik ({merchant.name})
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900">
            Anda sedang melihat ruang uji coba bersama. Daftarkan toko Anda sendiri atau masuk ke
            akun pemilik agar data menu, meja, dan pesanan tersimpan khusus untuk restoran Anda.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Link
          href="/login"
          className="apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-amber-400/60 bg-white px-4 text-xs font-bold text-amber-950 hover:bg-amber-100/60"
        >
          Masuk Pemilik
        </Link>
        <Link
          href="/onboarding"
          className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-[#1D1D1F] px-4 text-xs font-bold text-white hover:bg-zinc-800"
        >
          + Daftar Toko Baru
        </Link>
      </div>
    </div>
  );
}
