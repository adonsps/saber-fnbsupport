'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { pdf } from '@react-pdf/renderer';
import { QrCode, Trash, WifiHigh } from '@phosphor-icons/react';
import { Branch, Merchant, TableSession } from '@/types/schema';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';
import { TableQrPdfDocument, TableWithQrDataUrl } from '@/components/TableQrPdfDocument';

export default function AdminTablesPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [tables, setTables] = useState<TableWithQrDataUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingPdf, setPrintingPdf] = useState(false);

  const [singleLabel, setSingleLabel] = useState('');
  const [bulkCount, setBulkCount] = useState(6);
  const [bulkPrefix, setBulkPrefix] = useState('TABLE');
  const [wifiName, setWifiName] = useState('KopiNusantara_5G');
  const [wifiPassword, setWifiPassword] = useState('kopi100persen');
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');

  const enrichWithQr = async (rawTables: TableSession[]): Promise<TableWithQrDataUrl[]> => {
    return Promise.all(
      rawTables.map(async (t) => {
        const qrPngDataUrl = await QRCode.toDataURL(t.qrCodeUrl, {
          width: 480,
          margin: 1,
          color: { dark: '#1D1D1F', light: '#FFFFFF' },
        });
        return { ...t, qrPngDataUrl };
      })
    );
  };

  const loadTables = async () => {
    try {
      const res = await fetch('/api/v1/tables');
      const data = await res.json();
      setMerchant(data.merchant);
      setBranch(data.branch);
      const enriched = await enrichWithQr(data.tables || []);
      setTables(enriched);
      if (data.tables?.[0]) {
        setWifiName(data.tables[0].wifiName || 'KopiNusantara_5G');
        setWifiPassword(data.tables[0].wifiPassword || 'kopi100persen');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSingleTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleLabel.trim()) return;
    const res = await fetch('/api/v1/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: singleLabel,
        wifiName,
        wifiPassword,
      }),
    });
    const data = await res.json();
    if (data.tables) {
      setTables(await enrichWithQr(data.tables));
      setSingleLabel('');
    } else if (data.error) {
      alert(data.error);
    }
  };

  const handleBulkCreate = async () => {
    const res = await fetch('/api/v1/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'bulk_generate',
        count: bulkCount,
        prefix: bulkPrefix,
        wifiName,
        wifiPassword,
      }),
    });
    const data = await res.json();
    if (data.tables) {
      setTables(await enrichWithQr(data.tables));
    }
  };

  const handleResetOccupancy = async (table: TableSession) => {
    const res = await fetch('/api/v1/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableId: table.id,
        isOccupied: !table.isOccupied,
      }),
    });
    const data = await res.json();
    if (data.tables) {
      setTables(await enrichWithQr(data.tables));
    }
  };

  const handleUpdateWifiAll = async () => {
    const res = await fetch('/api/v1/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_wifi',
        wifiName,
        wifiPassword,
      }),
    });
    const data = await res.json();
    if (data.tables) {
      setTables(await enrichWithQr(data.tables));
    }
  };

  const handleDeleteTable = async (id: string) => {
    const res = await fetch(`/api/v1/tables?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.tables) {
      setTables(await enrichWithQr(data.tables));
    }
  };

  const handleDownloadPdf = async () => {
    if (!merchant || tables.length === 0) return;
    setPrintingPdf(true);
    try {
      const blob = await pdf(
        <TableQrPdfDocument merchant={merchant} tables={tables} pageSize={pageSize} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${merchant.slug}-table-qr-${pageSize.toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPrintingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs font-medium text-[#515154]">Loading floor tables...</p>
      </div>
    );
  }

  const occupiedCount = tables.filter((t) => t.isOccupied).length;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-apple-sm sm:flex-row sm:items-center">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-apple-blue">
            Floor & Print Engine
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            Manajemen Meja & Generator PDF QR
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Setiap meja menghasilkan URL unik{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-apple-blue">
              https://{merchant?.slug}.saberconsulting.id?table=[tableId]
            </code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-full border border-zinc-200 bg-[#F5F5F7] p-1">
            {(['A4', 'A5'] as const).map((sz) => {
              const active = pageSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    triggerCausalHaptic(6);
                    setPageSize(sz);
                  }}
                  className={cn(
                    'relative z-10 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors',
                    active ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-900'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="tables-pagesize-pill"
                      transition={APPLE_SPRINGS.default}
                      className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm"
                    />
                  )}
                  {sz} Sheet
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={printingPdf || tables.length === 0}
            onClick={handleDownloadPdf}
            className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-6 py-2.5 text-xs font-bold text-white shadow-apple-sm hover:bg-apple-blueHover disabled:opacity-50"
          >
            {printingPdf ? 'Generating PDF...' : `Print Table QRs (${pageSize} PDF)`}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print apple-interactive inline-flex min-h-[44px] items-center rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Browser Print
          </button>
        </div>
      </div>

      {/* Controls Grid: Add Table + Bulk Generator + WiFi Placeholder */}
      <div className="no-print mb-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Single Table Form */}
        <form
          onSubmit={handleAddSingleTable}
          className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-apple-sm"
        >
          <h2 className="text-sm font-bold text-zinc-950">Tambah Meja Kustom</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Misal: &ldquo;VIP OUTDOOR 03&rdquo;, &ldquo;BAR 01&rdquo;, &ldquo;LANTAI 2 - A&rdquo;
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={singleLabel}
              onChange={(e) => setSingleLabel(e.target.value)}
              placeholder="Contoh: TABLE 05"
              className="min-h-[44px] flex-1 rounded-xl border border-zinc-200 px-3 text-xs font-semibold uppercase outline-none focus:border-apple-blue"
            />
            <button
              type="submit"
              className="apple-interactive inline-flex items-center rounded-xl bg-zinc-950 px-4 text-xs font-bold text-white hover:bg-zinc-800"
            >
              Tambah
            </button>
          </div>
        </form>

        {/* Bulk Table 1 to N */}
        <div className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <h2 className="text-sm font-bold text-zinc-950">Generator Massal Meja (1 — N)</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Buat banyak nomor meja sekaligus secara otomatis.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="Prefix"
              className="min-h-[44px] w-24 rounded-xl border border-zinc-200 px-3 text-xs font-semibold uppercase"
            />
            <input
              type="number"
              min={1}
              max={50}
              value={bulkCount}
              onChange={(e) => setBulkCount(Number(e.target.value))}
              className="min-h-[44px] w-20 rounded-xl border border-zinc-200 px-3 font-mono text-xs font-semibold"
            />
            <button
              type="button"
              onClick={handleBulkCreate}
              className="apple-interactive flex-1 rounded-xl bg-apple-blue px-4 text-xs font-bold text-white hover:bg-apple-blueHover"
            >
              Generate 1–{bulkCount}
            </button>
          </div>
        </div>

        {/* WiFi Credential Block for PDF Cards */}
        <div className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-zinc-950">
              <WifiHigh aria-hidden="true" weight="duotone" className="h-4 w-4 text-apple-blue" />
              <span>Info WiFi di Kartu QR</span>
            </h2>
            <button
              type="button"
              onClick={handleUpdateWifiAll}
              className="text-[11px] font-bold text-apple-blue hover:underline"
            >
              Terapkan ke Semua
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="text"
              value={wifiName}
              onChange={(e) => setWifiName(e.target.value)}
              placeholder="Nama WiFi"
              className="min-h-[44px] rounded-xl border border-zinc-200 px-3 text-xs"
            />
            <input
              type="text"
              value={wifiPassword}
              onChange={(e) => setWifiPassword(e.target.value)}
              placeholder="Password WiFi"
              className="min-h-[44px] rounded-xl border border-zinc-200 px-3 font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Occupancy Summary Strip */}
      <div className="mb-4 flex items-center justify-between text-xs font-medium text-zinc-600">
        <div className="flex items-center gap-4">
          <span>
            Vacant: <strong className="tabular-nums text-[#1D7D32]">{tables.length - occupiedCount}</strong>
          </span>
          <span>
            Occupied / Session Active:{' '}
            <strong className="tabular-nums text-[#B25000]">{occupiedCount}</strong>
          </span>
        </div>
        <span>Total Meja: {tables.length}</span>
      </div>

      {/* Active Table QR Grid — Signature Tactile Table Passes (.saber-ticket-pass) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <div
            key={table.id}
            className="saber-ticket-pass flex flex-col justify-between rounded-[22px] p-5 transition-all hover:shadow-apple-md"
          >
            <div className="saber-ticket-divider flex items-start justify-between gap-2 pb-3.5">
              <div className="flex items-center gap-2.5">
                {branch?.logoUrl ? (
                  <img
                    src={branch.logoUrl}
                    alt={merchant?.name || 'Logo'}
                    className="h-10 w-10 rounded-xl object-cover ring-1 ring-black/10"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1D1D1F] text-white">
                    <QrCode aria-hidden="true" weight="duotone" className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-mono text-base font-bold tracking-tight text-[#1D1D1F]">
                    {table.tableNumber}
                  </h3>
                  <p className="text-[11px] font-medium text-[#515154]">{merchant?.name}</p>
                </div>
              </div>

              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold',
                  table.isOccupied
                    ? 'bg-amber-500/15 text-[#B25000]'
                    : 'bg-emerald-500/15 text-[#1D7D32]'
                )}
              >
                {table.isOccupied ? 'Occupied' : 'Vacant'}
              </span>
            </div>

            {/* QR Preview Card (mirrors A4/A5 Print Layout) */}
            <div className="my-4 flex flex-col items-center rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4 text-center">
              <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                <img
                  src={table.qrPngDataUrl}
                  alt={`QR Code ${table.tableNumber}`}
                  className="h-40 w-40"
                />
              </div>
              <p className="mt-3 text-xs font-bold text-apple-blue">Scan to View Menu & Order</p>
              <p className="mt-1 max-w-full truncate font-mono text-[11px] text-[#515154]">
                {table.qrCodeUrl}
              </p>
              <div className="mt-2.5 w-full rounded-xl bg-white px-3 py-1.5 text-[11px] text-[#515154]">
                Wi-Fi: <strong className="text-[#1D1D1F]">{table.wifiName}</strong> • Pass:{' '}
                <strong className="font-mono text-[#1D1D1F]">{table.wifiPassword}</strong>
              </div>
            </div>

            <div className="no-print flex items-center justify-between gap-2 border-t border-black/[0.06] pt-3">
              <Link
                href={`/${merchant?.slug || 'warungmakan'}?table=${encodeURIComponent(
                  table.tableNumber
                )}`}
                className="apple-interactive inline-flex min-h-[40px] items-center rounded-full bg-apple-blue px-4 py-1.5 text-xs font-semibold text-white hover:bg-apple-blueHover"
              >
                Simulate QR Scan
              </Link>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleResetOccupancy(table)}
                  title="Toggle table Vacant or Occupied"
                  className="apple-interactive inline-flex min-h-[40px] items-center rounded-full bg-[#F5F5F7] px-3 py-1.5 text-[11px] font-semibold text-[#1D1D1F] hover:bg-zinc-200"
                >
                  {table.isOccupied ? 'Set Vacant' : 'Set Occupied'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${table.tableNumber}`}
                  onClick={() => handleDeleteTable(table.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[#515154] hover:bg-red-50 hover:text-[#D70015]"
                >
                  <Trash aria-hidden="true" weight="regular" className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

