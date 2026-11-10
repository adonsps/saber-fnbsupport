'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit3,
  GripVertical,
  ImagePlus,
  Languages,
  Loader2,
  Plus,
  Power,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { Category, MenuItem, Merchant } from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';

export default function AdminMenuPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCatId, setActiveCatId] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Native <dialog> refs following Modern Web Guidance
  const catDialogRef = useRef<HTMLDialogElement>(null);
  const itemDialogRef = useRef<HTMLDialogElement>(null);

  // Category modal state
  const [catNameId, setCatNameId] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catDisplayOrder, setCatDisplayOrder] = useState(1);

  // Menu Item modal state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [titleId, setTitleId] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descriptionId, setDescriptionId] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [priceIdr, setPriceIdr] = useState(35000);
  const [imageUrl, setImageUrl] = useState('');

  const loadData = async () => {
    try {
      const res = await fetch('/api/v1/menu-items');
      const data = await res.json();
      setMerchant(data.merchant);
      setCategories(data.categories || []);
      setMenuItems(data.menuItems || []);
      if (data.categories?.length && !itemCategoryId) {
        setItemCategoryId(data.categories[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optimistic Master Store Switch
  const handleToggleStoreOpen = async () => {
    if (!merchant) return;
    const nextState = !merchant.isStoreOpen;
    setMerchant({ ...merchant, isStoreOpen: nextState });

    await fetch('/api/v1/merchants/onboard', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isStoreOpen: nextState }),
    });
  };

  // Optimistic 1-Click Sold Out Toggle
  const handleToggleSoldOut = async (item: MenuItem) => {
    const nextSoldOut = !item.isSoldOut;
    setMenuItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, isSoldOut: nextSoldOut } : m))
    );

    const res = await fetch(`/api/v1/menu-items/${item.id}/toggle-stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSoldOut: nextSoldOut }),
    });

    if (!res.ok) {
      // Rollback on failure
      setMenuItems((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, isSoldOut: item.isSoldOut } : m))
      );
    }
  };

  const handleMoveCategory = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= categories.length) return;
    const next = [...categories];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    const reindexed = next.map((c, idx) => ({ ...c, displayOrder: idx + 1 }));
    setCategories(reindexed);

    await fetch('/api/v1/menu-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity: 'reorder_categories',
        categoryIds: reindexed.map((c) => c.id),
      }),
    });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameId.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: 'category',
          nameId: catNameId,
          nameEn: catNameEn,
          displayOrder: catDisplayOrder,
        }),
      });
      const data = await res.json();
      if (data.categories) {
        setCategories([...data.categories].sort((a, b) => a.displayOrder - b.displayOrder));
      }
      setCatNameId('');
      setCatNameEn('');
      catDialogRef.current?.close();
    } finally {
      setSaving(false);
    }
  };

  const openNewItemModal = () => {
    setEditingItemId(null);
    setItemCategoryId(activeCatId !== 'ALL' ? activeCatId : categories[0]?.id || '');
    setTitleId('');
    setTitleEn('');
    setDescriptionId('');
    setDescriptionEn('');
    setPriceIdr(35000);
    setImageUrl('');
    itemDialogRef.current?.showModal();
  };

  const openEditItemModal = (item: MenuItem) => {
    setEditingItemId(item.id);
    setItemCategoryId(item.categoryId);
    setTitleId(item.titleId);
    setTitleEn(item.titleEn || '');
    setDescriptionId(item.descriptionId || '');
    setDescriptionEn(item.descriptionEn || '');
    setPriceIdr(item.priceIdr);
    setImageUrl(item.imageUrl || '');
    itemDialogRef.current?.showModal();
  };

  const handleImageWebpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file maksimal 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImageUrl(canvas.toDataURL('image/webp', 0.86));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleId.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/v1/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItemId,
          categoryId: itemCategoryId,
          titleId,
          titleEn,
          descriptionId,
          descriptionEn,
          priceIdr: Number(priceIdr),
          imageUrl: imageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.menuItems) setMenuItems(data.menuItems);
      itemDialogRef.current?.close();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    const res = await fetch(`/api/v1/menu-items?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.menuItems) setMenuItems(data.menuItems);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
      </div>
    );
  }

  const visibleCategories =
    activeCatId === 'ALL' ? categories : categories.filter((c) => c.id === activeCatId);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      {/* Top Header Control: Master Store Switch */}
      <div
        className={cn(
          'mb-6 flex flex-col justify-between gap-4 rounded-[24px] border p-5 shadow-apple-sm transition-colors sm:flex-row sm:items-center',
          merchant?.isStoreOpen
            ? 'border-emerald-500/25 bg-white'
            : 'border-red-300 bg-red-50/90'
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
              merchant?.isStoreOpen
                ? 'bg-emerald-500/15 text-emerald-700'
                : 'bg-red-500/15 text-red-600'
            )}
          >
            {merchant?.isStoreOpen ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-zinc-950">
                Store Status:{' '}
                <span className={merchant?.isStoreOpen ? 'text-emerald-700' : 'text-red-600'}>
                  {merchant?.isStoreOpen ? 'OPEN' : 'PAUSED'}
                </span>
              </h1>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
                {merchant?.name}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-600">
              {merchant?.isStoreOpen
                ? 'Pelanggan dapat memindai QR Meja, Pre-Order, dan Checkout secara real-time.'
                : 'DARURAT AKTIF: Checkout tamu pada mini-site dikunci sementara dengan banner penjelas.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleToggleStoreOpen}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold shadow-sm transition-all active:scale-[0.98]',
              merchant?.isStoreOpen
                ? 'bg-zinc-950 text-white hover:bg-red-600'
                : 'bg-apple-green text-white hover:bg-emerald-600'
            )}
          >
            <Power className="h-4 w-4" />
            <span>
              {merchant?.isStoreOpen ? 'Pause Store Orders' : 'Resume Store Orders (OPEN)'}
            </span>
          </button>

          <button
            type="button"
            onClick={openNewItemModal}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-apple-blue px-5 py-2.5 text-xs font-bold text-white shadow-apple-sm transition-all hover:bg-apple-blueHover active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Menu Baru</span>
          </button>
        </div>
      </div>

      {/* Dual-Pane Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sticky Sidebar: Category Management */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="sticky top-20 rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-zinc-950">Kategori Menu</h2>
                <p className="text-[11px] text-zinc-500">Dual-Language (ID | EN)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCatDisplayOrder(categories.length + 1);
                  catDialogRef.current?.showModal();
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-apple-blue transition-colors hover:bg-apple-blue hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Category</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveCatId('ALL')}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all',
                  activeCatId === 'ALL'
                    ? 'bg-zinc-950 text-white shadow-sm'
                    : 'text-zinc-700 hover:bg-[#F5F5F7]'
                )}
              >
                <span>Semua Kategori</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] tabular-nums">
                  {menuItems.length}
                </span>
              </button>

              {categories.map((cat, idx) => {
                const count = menuItems.filter((m) => m.categoryId === cat.id).length;
                const isSelected = activeCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-2xl p-2 transition-all',
                      isSelected ? 'bg-apple-blue/10 ring-1 ring-apple-blue/30' : 'hover:bg-[#F5F5F7]'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCatId(cat.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-zinc-400" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-950">{cat.nameId}</p>
                        {cat.nameEn && (
                          <p className="truncate text-[10px] text-zinc-500">{cat.nameEn}</p>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="mr-1 rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-zinc-700">
                        {count}
                      </span>
                      <button
                        type="button"
                        aria-label={`Geser ${cat.nameId} ke atas`}
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, -1)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Geser ${cat.nameId} ke bawah`}
                        disabled={idx === categories.length - 1}
                        onClick={() => handleMoveCategory(idx, 1)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Pane: Menu Item Cards Grouped by Category */}
        <section className="space-y-8 lg:col-span-8 xl:col-span-9">
          {visibleCategories.map((category) => {
            const catItems = menuItems.filter((m) => m.categoryId === category.id);

            return (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center justify-between border-b border-black/[0.06] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <UtensilsCrossed className="h-4 w-4 text-apple-blue" />
                    <h3 className="text-base font-bold tracking-tight text-zinc-950">
                      {category.nameId}
                    </h3>
                    {category.nameEn && (
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-500 shadow-sm">
                        EN: {category.nameEn}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-zinc-500 tabular-nums">
                    {catItems.length} item
                  </span>
                </div>

                {catItems.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-zinc-300 bg-white/60 p-8 text-center text-xs text-zinc-500">
                    Belum ada menu pada kategori ini. Klik &ldquo;Tambah Menu Baru&rdquo;.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {catItems.map((item) => (
                      <article
                        key={item.id}
                        className={cn(
                          'flex flex-col justify-between rounded-[22px] border bg-white p-4 shadow-apple-sm transition-all',
                          item.isSoldOut
                            ? 'border-red-200 bg-zinc-50/80'
                            : 'border-black/[0.06] hover:shadow-apple-md'
                        )}
                      >
                        <div className="flex gap-4">
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[16px] bg-zinc-100 ring-1 ring-black/5">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.titleId}
                                className={cn(
                                  'h-full w-full object-cover transition-all',
                                  item.isSoldOut && 'grayscale opacity-60'
                                )}
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-zinc-400">
                                <UtensilsCrossed className="h-6 w-6" />
                              </div>
                            )}
                            {item.isSoldOut && (
                              <span className="absolute inset-x-1 bottom-1 rounded-full bg-red-600/95 py-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                                Sold Out
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-bold leading-snug text-zinc-950">
                                  {item.titleId}
                                </h4>
                                {item.titleEn && (
                                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-apple-blue">
                                    <Languages className="h-3 w-3" />
                                    {item.titleEn}
                                  </p>
                                )}
                              </div>
                            </div>

                            <p className="mt-1.5 line-clamp-2 text-xs text-zinc-600">
                              {item.descriptionId}
                            </p>

                            <p className="mt-2 font-mono text-sm font-bold tabular-nums text-zinc-950">
                              {formatIdr(item.priceIdr)}
                            </p>
                          </div>
                        </div>

                        {/* Card Controls: Instant 1-Click Sold Out Switch + Edit/Delete */}
                        <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-3">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!item.isSoldOut}
                              onClick={() => handleToggleSoldOut(item)}
                              className={cn(
                                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                                item.isSoldOut ? 'bg-red-500' : 'bg-apple-green'
                              )}
                            >
                              <span
                                className={cn(
                                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                                  item.isSoldOut ? 'translate-x-1' : 'translate-x-6'
                                )}
                              />
                            </button>
                            <span
                              className={cn(
                                'text-xs font-bold',
                                item.isSoldOut ? 'text-red-600' : 'text-emerald-700'
                              )}
                            >
                              {item.isSoldOut ? 'Sold Out (Habis)' : 'In Stock (Tersedia)'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditItemModal(item)}
                              className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus ${item.titleId}`}
                              onClick={() => handleDeleteMenuItem(item.id)}
                              className="rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>

      {/* Native <dialog> Category Modal */}
      <dialog
        ref={catDialogRef}
        aria-labelledby="cat-modal-title"
        className="w-full max-w-md rounded-[26px] border border-black/10 bg-white p-6 shadow-apple-lg"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <h2 id="cat-modal-title" className="text-lg font-bold text-zinc-950">
            Tambah Kategori Bilingual
          </h2>
          <button
            type="button"
            onClick={() => catDialogRef.current?.close()}
            aria-label="Tutup modal kategori"
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
          <div>
            <label htmlFor="catNameId" className="block text-xs font-semibold text-zinc-800">
              Nama Kategori (Bahasa Indonesia) <span className="text-red-500">*</span>
            </label>
            <input
              id="catNameId"
              type="text"
              required
              autoFocus
              value={catNameId}
              onChange={(e) => setCatNameId(e.target.value)}
              placeholder="Contoh: Minuman Segar"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-apple-blue"
            />
          </div>

          <div>
            <label htmlFor="catNameEn" className="block text-xs font-semibold text-zinc-800">
              Category Name (English — Opsional)
            </label>
            <input
              id="catNameEn"
              type="text"
              value={catNameEn}
              onChange={(e) => setCatNameEn(e.target.value)}
              placeholder="e.g. Refreshing Drinks"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-apple-blue"
            />
          </div>

          <div>
            <label htmlFor="catOrder" className="block text-xs font-semibold text-zinc-800">
              Urutan Tampil (Display Order)
            </label>
            <input
              id="catOrder"
              type="number"
              min={1}
              value={catDisplayOrder}
              onChange={(e) => setCatDisplayOrder(Number(e.target.value))}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 font-mono text-sm outline-none focus:border-apple-blue"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => catDialogRef.current?.close()}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-apple-blue px-5 py-2 text-xs font-semibold text-white hover:bg-apple-blueHover"
            >
              Simpan Kategori
            </button>
          </div>
        </form>
      </dialog>

      {/* Native <dialog> Menu Item Modal */}
      <dialog
        ref={itemDialogRef}
        aria-labelledby="item-modal-title"
        className="w-full max-w-2xl rounded-[28px] border border-black/10 bg-white p-6 shadow-apple-lg"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <h2 id="item-modal-title" className="text-lg font-bold text-zinc-950">
            {editingItemId ? 'Edit Menu Item (ID | EN)' : 'Tambah Menu Item Baru (ID | EN)'}
          </h2>
          <button
            type="button"
            onClick={() => itemDialogRef.current?.close()}
            aria-label="Tutup modal menu"
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveMenuItem} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="itemCat" className="block text-xs font-semibold text-zinc-800">
                Kategori
              </label>
              <select
                id="itemCat"
                value={itemCategoryId}
                onChange={(e) => setItemCategoryId(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="itemPrice" className="block text-xs font-semibold text-zinc-800">
                Harga (IDR) — {formatIdr(priceIdr)}
              </label>
              <input
                id="itemPrice"
                type="number"
                required
                min={500}
                step={500}
                value={priceIdr}
                onChange={(e) => setPriceIdr(Number(e.target.value))}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="titleId" className="block text-xs font-semibold text-zinc-800">
                Nama Menu (ID) <span className="text-red-500">*</span>
              </label>
              <input
                id="titleId"
                type="text"
                required
                value={titleId}
                onChange={(e) => setTitleId(e.target.value)}
                placeholder="Nasi Goreng Spesial"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="titleEn" className="block text-xs font-semibold text-zinc-800">
                Menu Title (EN)
              </label>
              <input
                id="titleEn"
                type="text"
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                placeholder="Signature Fried Rice"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="descId" className="block text-xs font-semibold text-zinc-800">
                Deskripsi (ID)
              </label>
              <textarea
                id="descId"
                rows={2}
                value={descriptionId}
                onChange={(e) => setDescriptionId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 p-3 text-xs"
              />
            </div>

            <div>
              <label htmlFor="descEn" className="block text-xs font-semibold text-zinc-800">
                Description (EN)
              </label>
              <textarea
                id="descEn"
                rows={2}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 p-3 text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-3.5">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Preview"
                className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/10"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-zinc-400">
                <ImagePlus className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs font-bold text-zinc-900">Foto Produk (Optimized WebP, max 2MB)</p>
              <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-apple-blue shadow-sm hover:bg-zinc-50">
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Pilih & Kompres Otomatis ke WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageWebpUpload}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-black/[0.06] pt-4">
            <button
              type="button"
              onClick={() => itemDialogRef.current?.close()}
              className="rounded-full border border-zinc-300 px-5 py-2 text-xs font-semibold text-zinc-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-apple-blue px-6 py-2 text-xs font-semibold text-white hover:bg-apple-blueHover"
            >
              {saving ? 'Menyimpan...' : 'Simpan Menu'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

