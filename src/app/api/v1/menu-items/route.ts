import { NextRequest, NextResponse } from 'next/server';
import { createUuid, getStore, saveStore } from '@/lib/store';

export async function GET() {
  const store = getStore();
  const sortedCategories = [...store.categories].sort((a, b) => a.displayOrder - b.displayOrder);
  return NextResponse.json({
    merchant: store.merchants[0],
    branch: store.branches[0],
    categories: sortedCategories,
    menuItems: store.menuItems,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const branchId = store.branches[0]?.id || '22222222-2222-4222-8222-222222222222';

    if (body.entity === 'category') {
      const newCategory = {
        id: createUuid(),
        branchId,
        nameId: String(body.nameId || '').trim(),
        nameEn: String(body.nameEn || body.nameId || '').trim(),
        displayOrder: Number(body.displayOrder || store.categories.length + 1),
      };
      store.categories.push(newCategory);
      saveStore(store);
      return NextResponse.json({ success: true, category: newCategory, categories: store.categories });
    }

    if (body.entity === 'reorder_categories' && Array.isArray(body.categoryIds)) {
      body.categoryIds.forEach((id: string, idx: number) => {
        const cat = store.categories.find((c) => c.id === id);
        if (cat) cat.displayOrder = idx + 1;
      });
      saveStore(store);
      return NextResponse.json({ success: true, categories: store.categories });
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
      return NextResponse.json({ success: true, menuItem: existing, menuItems: store.menuItems });
    }

    const newItem = {
      id: createUuid(),
      categoryId: body.categoryId || store.categories[0]?.id,
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
    return NextResponse.json({ success: true, menuItem: newItem, menuItems: store.menuItems });
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
  store.menuItems = store.menuItems.filter((item) => item.id !== id);
  saveStore(store);
  return NextResponse.json({ success: true, menuItems: store.menuItems });
}

