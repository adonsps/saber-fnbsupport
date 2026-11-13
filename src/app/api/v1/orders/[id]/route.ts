import { NextRequest, NextResponse } from 'next/server';
import { getStore, sanitizeMerchant } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const store = getStore();
  const order = store.orders.find(
    (o) => o.id === id || o.orderNumber.toLowerCase() === id.toLowerCase()
  );

  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }

  const branch = store.branches.find((b) => b.id === order.branchId) || store.branches[0];
  const merchant =
    store.merchants.find((m) => m.id === branch?.merchantId) || store.merchants[0];

  return NextResponse.json(
    {
      order,
      merchant: sanitizeMerchant(merchant),
      branch,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
