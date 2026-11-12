import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_MERCHANT_COOKIE,
  SESSION_COOKIE,
  createUuid,
  getMerchantBySlug,
  getScopedMerchantBundle,
  getStore,
  resolveAuthorizedWorkspaceMerchant,
  sanitizeMerchant,
  saveStore,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const store = getStore();
  const explicitSlug = req.nextUrl.searchParams.get('slug');

  // When explicitSlug is requested by Customer QR Storefront (/[slug]), load public catalog
  if (explicitSlug) {
    const publicMerchant = getMerchantBySlug(store, explicitSlug);
    if (!publicMerchant) {
      return NextResponse.json(
        { error: `Toko dengan alamat "/${explicitSlug}" tidak ditemukan.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const publicBundle = getScopedMerchantBundle(store, publicMerchant);
    return NextResponse.json(
      {
        merchant: sanitizeMerchant(publicBundle.merchant),
        branch: publicBundle.branch,
        categories: publicBundle.categories,
        menuItems: publicBundle.menuItems,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Admin Menu Manager: resolve strictly via authenticated merchant session or Demo
  const { merchant } = resolveAuthorizedWorkspaceMerchant(store, {
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
  });

  const bundle = getScopedMerchantBundle(store, merchant);
  return NextResponse.json(
    {
      merchant: sanitizeMerchant(bundle.merchant),
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
    const { merchant, deniedRequestedSlug } = resolveAuthorizedWorkspaceMerchant(store, {
      sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
      activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
      requestedSlug: body.slug,
    });

    if (deniedRequestedSlug) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    const bundle = getScopedMerchantBundle(store, merchant);
    const branchId = bundle.branch?.id || '22222222-2222-4222-8222-222222222222';
    const branchCategoryIds = new Set(bundle.categories.map((c) => c.id));

    if (body.entity === 'category') {
      const nameId = String(body.nameId || '').trim();
      if (!nameId) {
        return NextResponse.json({ error: 'Nama kategori wajib diisi.' }, { status: 400 });
      }
      const newCategory = {
        id: createUuid(),
        branchId,
        nameId,
        nameEn: String(body.nameEn || nameId).trim(),
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

    if (body.entity === 'update_category') {
      const cat = store.categories.find((c) => c.id === body.id && c.branchId === branchId);
      if (!cat) {
        return NextResponse.json({ error: 'Kategori tidak ditemukan.' }, { status: 404 });
      }
      const nameId = String(body.nameId ?? cat.nameId).trim();
      if (!nameId) {
        return NextResponse.json({ error: 'Nama kategori wajib diisi.' }, { status: 400 });
      }
      cat.nameId = nameId;
      cat.nameEn = String(body.nameEn ?? cat.nameEn ?? nameId).trim();
      saveStore(store);
      const updated = getScopedMerchantBundle(store, merchant);
      return NextResponse.json({
        success: true,
        category: cat,
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

    // Create or update menu item (enforce tenant isolation on categoryId & item ID)
    if (body.id) {
      const existing = store.menuItems.find(
        (m) => m.id === body.id && branchCategoryIds.has(m.categoryId)
      );
      if (!existing) {
        return NextResponse.json({ error: 'Item menu tidak ditemukan' }, { status: 404 });
      }
      if (body.categoryId && !branchCategoryIds.has(body.categoryId)) {
        return NextResponse.json({ error: 'Kategori tidak valid.' }, { status: 403 });
      }
      if (body.titleId !== undefined && !String(body.titleId).trim()) {
        return NextResponse.json({ error: 'Nama menu (ID) wajib diisi.' }, { status: 400 });
      }
      const nextPrice =
        body.priceIdr !== undefined ? Number(body.priceIdr) : Number(existing.priceIdr);
      if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
        return NextResponse.json(
          { error: 'Harga menu harus lebih besar dari Rp 0.' },
          { status: 400 }
        );
      }

      existing.categoryId = body.categoryId || existing.categoryId;
      existing.titleId = body.titleId !== undefined ? String(body.titleId).trim() : existing.titleId;
      existing.titleEn = body.titleEn !== undefined ? String(body.titleEn).trim() : existing.titleEn;
      existing.descriptionId = body.descriptionId ?? existing.descriptionId;
      existing.descriptionEn = body.descriptionEn ?? existing.descriptionEn;
      existing.priceIdr = nextPrice;
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

    const titleId = String(body.titleId || '').trim();
    if (!titleId) {
      return NextResponse.json({ error: 'Nama menu wajib diisi.' }, { status: 400 });
    }
    const parsedPrice = Number(body.priceIdr);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json(
        { error: 'Harga menu harus lebih besar dari Rp 0.' },
        { status: 400 }
      );
    }

    const targetCategoryId =
      body.categoryId && branchCategoryIds.has(body.categoryId)
        ? body.categoryId
        : bundle.categories[0]?.id;

    if (!targetCategoryId) {
      return NextResponse.json(
        { error: 'Buat minimal 1 kategori menu terlebih dahulu.' },
        { status: 400 }
      );
    }

    const newItem = {
      id: createUuid(),
      categoryId: targetCategoryId,
      titleId,
      titleEn: String(body.titleEn || titleId).trim(),
      descriptionId: String(body.descriptionId || '').trim(),
      descriptionEn: String(body.descriptionEn || body.descriptionId || '').trim(),
      priceIdr: parsedPrice,
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
  const entity = req.nextUrl.searchParams.get('entity');
  if (!id) {
    return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });
  }
  const store = getStore();
  const { merchant } = resolveAuthorizedWorkspaceMerchant(store, {
    sessionCookie: req.cookies.get(SESSION_COOKIE)?.value,
    activeSlugCookie: req.cookies.get(ACTIVE_MERCHANT_COOKIE)?.value,
  });

  const bundle = getScopedMerchantBundle(store, merchant);

  if (entity === 'category') {
    const branchId = bundle.branch?.id;
    const cat = store.categories.find((c) => c.id === id && c.branchId === branchId);
    if (!cat) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan.' }, { status: 404 });
    }
    store.categories = store.categories.filter((c) => c.id !== id);
    store.menuItems = store.menuItems.filter((item) => item.categoryId !== id);
    saveStore(store);
    const updated = getScopedMerchantBundle(store, merchant);
    return NextResponse.json({
      success: true,
      categories: updated.categories,
      menuItems: updated.menuItems,
    });
  }

  const branchCategoryIds = new Set(bundle.categories.map((c) => c.id));
  store.menuItems = store.menuItems.filter(
    (item) => !(item.id === id && branchCategoryIds.has(item.categoryId))
  );
  saveStore(store);
  const updated = getScopedMerchantBundle(store, merchant);
  return NextResponse.json({ success: true, menuItems: updated.menuItems });
}
