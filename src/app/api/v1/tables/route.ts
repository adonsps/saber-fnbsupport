import { NextRequest, NextResponse } from 'next/server';
import { createUuid, getStore, saveStore } from '@/lib/store';
import { buildStorefrontUrl, getOriginFromHeaders } from '@/lib/utils';
import { TableSession } from '@/types/schema';

export const dynamic = 'force-dynamic';

function resolveTablesWithQrUrls(
  tables: TableSession[],
  merchantSlug: string,
  origin?: string
): TableSession[] {
  return tables.map((t) => ({
    ...t,
    qrCodeUrl: buildStorefrontUrl(merchantSlug, {
      tableNumber: t.tableNumber,
      baseOrigin: origin,
    }),
  }));
}

export async function GET(req: NextRequest) {
  const store = getStore();
  const merchant = store.merchants[0];
  const origin = getOriginFromHeaders(req.headers);
  const resolvedTables = resolveTablesWithQrUrls(
    store.tableSessions,
    merchant?.slug || 'warungmakan',
    origin
  );
  return NextResponse.json(
    {
      merchant,
      branch: store.branches[0],
      tables: resolvedTables,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const merchant = store.merchants[0];
    const origin = getOriginFromHeaders(req.headers);
    const branchId = store.branches[0]?.id || '22222222-2222-4222-8222-222222222222';
    const wifiName = String(body.wifiName || 'KopiNusantara_5G').trim();
    const wifiPassword = String(body.wifiPassword || 'kopi100persen').trim();

    if (body.mode === 'bulk_generate') {
      const count = Math.min(Math.max(Number(body.count || 5), 1), 50);
      const prefix = String(body.prefix || 'TABLE').trim().toUpperCase();
      const created = [];

      for (let i = 1; i <= count; i++) {
        const numStr = i < 10 ? `0${i}` : `${i}`;
        const label = `${prefix} ${numStr}`;
        if (!store.tableSessions.some((t) => t.tableNumber.toUpperCase() === label)) {
          const table = {
            id: createUuid(),
            branchId,
            tableNumber: label,
            qrCodeUrl: buildStorefrontUrl(merchant.slug, {
              tableNumber: label,
              baseOrigin: origin,
            }),
            isOccupied: false,
            wifiName,
            wifiPassword,
          };
          store.tableSessions.push(table);
          created.push(table);
        }
      }
      saveStore(store);
      return NextResponse.json({
        success: true,
        created,
        tables: resolveTablesWithQrUrls(store.tableSessions, merchant.slug, origin),
      });
    }

    const label = String(body.tableNumber || '').trim().toUpperCase();
    if (!label) {
      return NextResponse.json({ error: 'Label meja wajib diisi' }, { status: 400 });
    }

    if (store.tableSessions.some((t) => t.tableNumber.toUpperCase() === label)) {
      return NextResponse.json({ error: `Meja "${label}" sudah terdaftar` }, { status: 400 });
    }

    const newTable = {
      id: createUuid(),
      branchId,
      tableNumber: label,
      qrCodeUrl: buildStorefrontUrl(merchant.slug, {
        tableNumber: label,
        baseOrigin: origin,
      }),
      isOccupied: false,
      wifiName,
      wifiPassword,
    };

    store.tableSessions.push(newTable);
    saveStore(store);

    return NextResponse.json({
      success: true,
      table: newTable,
      tables: resolveTablesWithQrUrls(store.tableSessions, merchant.slug, origin),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membuat meja' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();

    if (body.action === 'update_wifi') {
      store.tableSessions = store.tableSessions.map((t) => ({
        ...t,
        wifiName: String(body.wifiName || t.wifiName || ''),
        wifiPassword: String(body.wifiPassword || t.wifiPassword || ''),
      }));
      saveStore(store);
      const origin = getOriginFromHeaders(req.headers);
      const slug = store.merchants[0]?.slug || 'warungmakan';
      return NextResponse.json({
        success: true,
        tables: resolveTablesWithQrUrls(store.tableSessions, slug, origin),
      });
    }

    const table = store.tableSessions.find((t) => t.id === body.tableId || t.tableNumber === body.tableNumber);
    if (!table) {
      return NextResponse.json({ error: 'Meja tidak ditemukan' }, { status: 404 });
    }

    if (typeof body.isOccupied === 'boolean') {
      table.isOccupied = body.isOccupied;
      if (!body.isOccupied) {
        table.activeOrderId = undefined;
      }
    }

    saveStore(store);
    const origin = getOriginFromHeaders(req.headers);
    const slug = store.merchants[0]?.slug || 'warungmakan';
    return NextResponse.json({
      success: true,
      table,
      tables: resolveTablesWithQrUrls(store.tableSessions, slug, origin),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui meja' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID meja diperlukan' }, { status: 400 });
  }
  const store = getStore();
  store.tableSessions = store.tableSessions.filter((t) => t.id !== id);
  saveStore(store);
  const origin = getOriginFromHeaders(req.headers);
  const slug = store.merchants[0]?.slug || 'warungmakan';
  return NextResponse.json({
    success: true,
    tables: resolveTablesWithQrUrls(store.tableSessions, slug, origin),
  });
}

