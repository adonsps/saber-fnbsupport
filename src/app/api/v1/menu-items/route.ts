import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  createUuid,
  getMerchantBySlug,
  getScopedMerchantBundle,
  getStore,
  resolveWorkspaceMerchant,
  saveStore,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const store = getStore();
  const explicitSlug = req.nextUrl.searchParams.get('slug');
  const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;

  const merchant = explicitSlug
    ? getMerchantBySlug(store, explicitSlug)
    : resolveWorkspaceMerchant(store, cookieSlug);

  if (!merchant) {
    return NextResponse.json(
      { error: `Toko dengan alamat "/${explicitSlug}" tidak ditemukan.` },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const bundle = getScopedMerchantBundle(store, merchant);
  return NextResponse.json(
    {
      merchant: bundle.merchant,
      branch: bundle.branch,
      categories: bundle.categories,
      menuItems: bundle.menuItems,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
    const merchant = resolveWorkspaceMerchant(store, body.slug || cookieSlug);
    const bundle = getScopedMerchantBundle(store, merchant);
    const branchId = bundle.branch?.id || '22222222-2222-4222-8222-222222222222';

    if (body.entity === 'category') {
      const newCategory = {
        id: createUuid(),
        branchId,
        nameId: String(body.nameId || '').trim(),
        nameEn: String(body.nameEn || body.nameId || '').trim(),
        displayOrder: Number(body.displayOrder || bundle.categories.length + 1),
      };
      store.categories.push(newCategory);
      saveStore(store);
      const updated = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        category: newCategory,
        categories: updated.categories,
      });
    }

    if (body.entity === 'reorder_categories' && Array.isArray(body.categoryIds)) {
      body.categoryIds.forEach((id: string, idx: number) => {
        const cat = store.categories.find((c) => c.id === id && c.branchId === branchId);
        if (cat) cat.displayOrder = idx + 1;
      });
      saveStore(store);
      const updated = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({ success: true, categories: updated.categories });
    }

    // Create or update menu item
    if (body.id) {
      const existing = store.menuItems.find((m) => m.id === body.id);
      if (!existing) {
        return NextResponse.json({ error: 'Item menu tidak ditemukan' }, { status: 404 });
      }
      existing.categoryId = body.categoryId || existing.categoryId;
      existing.titleId = body.titleId ?? existing.titleId;
      existing.titleEn = body.titleEn ?? existing.titleEn;
      existing.descriptionId = body.descriptionId ?? existing.descriptionId;
      existing.descriptionEn = body.descriptionEn ?? existing.descriptionEn;
      existing.priceIdr = Number(body.priceIdr ?? existing.priceIdr);
      existing.imageUrl = body.imageUrl ?? existing.imageUrl;
      if (typeof body.isSoldOut === 'boolean') {
        existing.isSoldOut = body.isSoldOut;
      }
      saveStore(store);
      const updated = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        menuItem: existing,
        menuItems: updated.menuItems,
      });
    }

    const newItem = {
      id: createUuid(),
      categoryId: body.categoryId || bundle.categories[0]?.id,
      titleId: String(body.titleId || '').trim(),
      titleEn: String(body.titleEn || body.titleId || '').trim(),
      descriptionId: String(body.descriptionId || '').trim(),
      descriptionEn: String(body.descriptionEn || body.descriptionId || '').trim(),
      priceIdr: Number(body.priceIdr || 0),
      imageUrl:
        body.imageUrl ||
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
      isSoldOut: Boolean(body.isSoldOut),
    };

    store.menuItems.push(newItem);
    saveStore(store);
    const updated = getScopedMerchantBundle(store, merchant);
    return NextResponse.json({
      success: true,
      menuItem: newItem,
      menuItems: updated.menuItems,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menyimpan menu' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
  }
  const store = getStore();
  const cookieSlug = req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value;
  const merchant = resolveWorkspaceMerchant(store, cookieSlug);

  store.menuItems = store.menuItems.filter((item) => item.id !== id);
  saveStore(store);
  const updated = getScopedMerchantBundle(store, merchant);
  return NextResponse.json({ success: true, menuItems: updated.menuItems });
}
