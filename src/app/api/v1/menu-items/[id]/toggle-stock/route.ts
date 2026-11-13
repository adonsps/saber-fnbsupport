import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  getScopedMerchantBundle,
  getStore,
  resolveAuthorizedWorkspaceMerchant,
  saveStore,
} from '@/lib/store';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const store = getStore();
    const { merchant } = resolveAuthorizedWorkspaceMerchant(store, {
      sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
      activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
    });

    const bundle = getScopedMerchantBundle(store, merchant);
    const branchCategoryIds = new Set(bundle.categories.map((c) => c.id));
    const item = store.menuItems.find(
      (m) => m.id === id && branchCategoryIds.has(m.categoryId)
    );
    if (!item) {
      return NextResponse.json({ error: 'Menu item tidak ditemukan' }, { status: 404 });
    }

    item.isSoldOut = typeof body.isSoldOut === 'boolean' ? body.isSoldOut : !item.isSoldOut;
    saveStore(store);

    return NextResponse.json({
      success: true,
      menuItem: item,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal memperbarui stok item' },
      { status: 500 }
    );
  }
}
