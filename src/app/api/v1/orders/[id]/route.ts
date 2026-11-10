import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

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

  return NextResponse.json({
    order,
    merchant: store.merchants[0],
    branch: store.branches[0],
  });
}
