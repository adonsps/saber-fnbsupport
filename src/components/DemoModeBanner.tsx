'use client';

import React from 'react';
import Link from 'next/link';
import { Info } from '@phosphor-icons/react';
import { Merchant } from '@/types/schema';

export function DemoModeBanner({ merchant }: { merchant: Merchant | null }) {
  if (!merchant || (!merchant.isDemo && merchant.slug !== 'warungmakan')) {
    return null;
  }

  return (
    <div
      role="status"
      className="no-print mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-sky-200 bg-cloud px-5 py-4 text-sm text-ink-primary sm:flex-row sm:items-center"
    >
      <div className="flex items-start gap-3">
        <Info
          aria-hidden="true"
          weight="fill"
          className="mt-0.5 h-5 w-5 shrink-0 text-sky-600"
        />
        <div>
          <p className="font-semibold text-ink-primary">
            Menampilkan Toko Contoh ({merchant.name})
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
            Anda sedang mencoba ruang contoh publik. Buat akun toko sendiri atau masuk agar menu,
            meja, dan pesanan tersimpan khusus untuk restoran Anda.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <Link
          href="/login"
          className="apple-interactive inline-flex min-h-[42px] items-center whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50 px-4 text-xs font-semibold text-ink-primary hover:bg-sky-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 motion-safe:transition-colors"
        >
          Masuk
        </Link>
        <Link
          href="/onboarding?mode=new"
          className="apple-interactive inline-flex min-h-[42px] items-center whitespace-nowrap rounded-lg bg-scarlet-600 px-4 text-xs font-semibold text-cloud hover:bg-scarlet-700 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scarlet-600 motion-safe:transition-colors"
        >
          Buat Akun Toko
        </Link>
      </div>
    </div>
  );
}
