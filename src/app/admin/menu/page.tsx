'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BowlFood,
  CaretDown,
  CaretUp,
  Image as ImageIcon,
  PencilSimple,
  Power,
  Trash,
} from '@phosphor-icons/react';
import { Category, MenuItem, Merchant } from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';
import { useDialogLightDismiss } from '@/lib/client-helpers';
import { motion } from 'framer-motion';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';
import { DemoModeBanner } from '@/components/DemoModeBanner';

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
  useDialogLightDismiss(catDialogRef);
  useDialogLightDismiss(itemDialogRef);

  // Category modal state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameId, setCatNameId] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catDisplayOrder, setCatDisplayOrder] = useState(1);
  const [catError, setCatError] = useState<string | null>(null);

  // Menu Item modal state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [titleId, setTitleId] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descriptionId, setDescriptionId] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [priceIdr, setPriceIdr] = useState(35000);
  const [imageUrl, setImageUrl] = useState('');
  const [itemFormError, setItemFormError] = useState<string | null>(null);

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
    if (!catNameId.trim()) {
      setCatError('Nama kategori wajib diisi.');
      return;
    }
    setCatError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/v1/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity: editingCatId ? 'update_category' : 'category',
          id: editingCatId || undefined,
          nameId: catNameId,
          nameEn: catNameEn,
          displayOrder: catDisplayOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCatError(data.error || 'Gagal menyimpan kategori.');
        return;
      }
      if (data.categories) {
        setCategories([...data.categories].sort((a, b) => a.displayOrder - b.displayOrder));
      }
      setEditingCatId(null);
      setCatNameId('');
      setCatNameEn('');
      catDialogRef.current?.close();
    } finally {
      setSaving(false);
    }
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCatId(cat.id);
    setCatNameId(cat.nameId);
    setCatNameEn(cat.nameEn || '');
    setCatDisplayOrder(cat.displayOrder);
    setCatError(null);
    catDialogRef.current?.showModal();
  };

  const handleDeleteCategory = async (cat: Category) => {
    const itemCount = menuItems.filter((m) => m.categoryId === cat.id).length;
    if (
      itemCount > 0 &&
      !window.confirm(
        `Hapus kategori "${cat.nameId}" beserta ${itemCount} item menu di dalamnya?`
      )
    ) {
      return;
    }
    const res = await fetch(
      `/api/v1/menu-items?entity=category&id=${encodeURIComponent(cat.id)}`,
      { method: 'DELETE' }
    );
    const data = await res.json();
    if (data.categories) setCategories(data.categories);
    if (data.menuItems) setMenuItems(data.menuItems);
    if (activeCatId === cat.id) setActiveCatId('ALL');
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
    setItemFormError(null);
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
    setItemFormError(null);
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
    setItemFormError(null);
    if (!titleId.trim()) {
      setItemFormError('Nama menu (ID) wajib diisi.');
      return;
    }
    const parsedPrice = Number(priceIdr);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setItemFormError('Harga menu harus lebih besar dari Rp 0.');
      return;
    }
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
          priceIdr: parsedPrice,
          imageUrl: imageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemFormError(data.error || 'Gagal menyimpan item menu.');
        return;
      }
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
        <p className="font-mono text-xs font-medium text-[#515154]">Loading menu engine...</p>
      </div>
    );
  }

  const visibleCategories =
    activeCatId === 'ALL' ? categories : categories.filter((c) => c.id === activeCatId);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <DemoModeBanner merchant={merchant} />

      {/* Top Header Control: Master Store Switch */}
      <div
        className={cn(
          'mb-6 flex flex-col justify-between gap-4 rounded-[24px] border p-5 shadow-apple-sm transition-colors sm:flex-row sm:items-center',
          merchant?.isStoreOpen
            ? 'border-black/[0.08] bg-white'
            : 'border-red-300 bg-red-50/90'
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
              merchant?.isStoreOpen
                ? 'bg-emerald-500/12 text-[#1D7D32]'
                : 'bg-red-500/15 text-[#D70015]'
            )}
          >
            <Power aria-hidden="true" weight="bold" className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-zinc-950">
                Status Toko:{' '}
                <span className={merchant?.isStoreOpen ? 'text-[#1D7D32]' : 'text-[#D70015]'}>
                  {merchant?.isStoreOpen ? 'BUKA' : 'DIJEDA'}
                </span>
              </h1>
              <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 text-[11px] font-semibold text-[#515154]">
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
          {/* HIG Button Hierarchy (buttons.md › Style): Secondary bordered destructive/resume toggle + 1 prominent primary CTA */}
          <button
            type="button"
            onClick={handleToggleStoreOpen}
            className={cn(
              'apple-interactive inline-flex min-h-[44px] items-center rounded-full border px-5 py-2.5 text-xs font-bold transition-all',
              merchant?.isStoreOpen
                ? 'border-[#D70015]/30 bg-red-50 text-[#D70015] hover:bg-red-100'
                : 'border-[#1D7D32]/30 bg-emerald-50 text-[#1D7D32] hover:bg-emerald-100'
            )}
          >
            {merchant?.isStoreOpen ? 'Jeda Pesanan Masuk' : 'Buka Kembali Toko'}
          </button>

          <button
            type="button"
            onClick={openNewItemModal}
            className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-5 py-2.5 text-xs font-bold text-white shadow-apple-sm hover:bg-apple-blueHover"
          >
            + Tambah Menu
          </button>
        </div>
      </div>

      {/* Dual-Pane Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sticky Sidebar: Category Management */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="sticky top-20 rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-apple-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-zinc-950">Kategori Menu</h2>
                <p className="text-[11px] text-zinc-500">Dwibahasa (ID | EN)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingCatId(null);
                  setCatNameId('');
                  setCatNameEn('');
                  setCatError(null);
                  setCatDisplayOrder(categories.length + 1);
                  catDialogRef.current?.showModal();
                }}
                className="apple-interactive inline-flex min-h-[40px] items-center rounded-full bg-[#F5F5F7] px-3.5 py-1.5 text-xs font-semibold text-apple-blue hover:bg-apple-blue hover:text-white"
              >
                + Kategori
              </button>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveCatId('ALL')}
                className={cn(
                  'flex min-h-[44px] w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all',
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
                      'flex items-center justify-between gap-1.5 rounded-2xl p-2 transition-all',
                      isSelected ? 'bg-apple-blue/10 ring-1 ring-apple-blue/30' : 'hover:bg-[#F5F5F7]'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCatId(cat.id)}
                      className="flex min-h-[40px] min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="font-mono text-[11px] font-semibold tabular-nums text-[#515154]">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-950">{cat.nameId}</p>
                        {cat.nameEn && (
                          <p className="truncate text-[10px] text-zinc-500">{cat.nameEn}</p>
                        )}
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <span className="mr-0.5 rounded-full bg-zinc-200/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-zinc-700">
                        {count}
                      </span>
                      <button
                        type="button"
                        aria-label={`Ubah ${cat.nameId}`}
                        onClick={() => openEditCategoryModal(cat)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-white hover:text-apple-blue"
                      >
                        <PencilSimple aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Hapus ${cat.nameId}`}
                        onClick={() => handleDeleteCategory(cat)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-[#D70015]"
                      >
                        <Trash aria-hidden="true" weight="regular" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Geser ${cat.nameId} ke atas`}
                        disabled={idx === 0}
                        onClick={() => handleMoveCategory(idx, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-30"
                      >
                        <CaretUp aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Geser ${cat.nameId} ke bawah`}
                        disabled={idx === categories.length - 1}
                        onClick={() => handleMoveCategory(idx, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white hover:text-zinc-900 disabled:opacity-30"
                      >
                        <CaretDown aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
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
                    <h3 className="font-serif text-lg font-bold tracking-tight text-zinc-950">
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
                  <div className="rounded-[22px] border border-dashed border-zinc-300 bg-white p-8 text-center">
                    <p className="text-xs font-medium text-[#515154]">
                      Belum ada menu di kategori ini.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCatId(category.id);
                        openNewItemModal();
                      }}
                      className="apple-interactive mt-3 inline-flex min-h-[44px] items-center rounded-full bg-apple-blue/10 px-4 py-2 text-xs font-bold text-apple-blue hover:bg-apple-blue hover:text-white"
                    >
                      + Tambah Menu ke {category.nameId}
                    </button>
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
                                <BowlFood aria-hidden="true" weight="duotone" className="h-6 w-6" />
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
                                  <p className="mt-0.5 text-[11px] font-medium text-apple-blue">
                                    EN · {item.titleEn}
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
                              onClick={() => {
                                triggerCausalHaptic(8);
                                handleToggleSoldOut(item);
                              }}
                              className={cn(
                                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors',
                                item.isSoldOut ? 'justify-start bg-red-500' : 'justify-end bg-apple-green'
                              )}
                            >
                              <motion.span
                                layout
                                transition={APPLE_SPRINGS.default}
                                className="inline-block h-4 w-4 rounded-full bg-white shadow"
                              />
                            </button>
                            <span
                              className={cn(
                                'text-xs font-bold',
                                item.isSoldOut ? 'text-red-600' : 'text-emerald-700'
                              )}
                            >
                              {item.isSoldOut ? 'Stok Habis' : 'Tersedia'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditItemModal(item)}
                              className="apple-interactive inline-flex min-h-[40px] items-center rounded-full bg-[#F5F5F7] px-3.5 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200"
                            >
                              Ubah
                            </button>
                            <button
                              type="button"
                              aria-label={`Hapus ${item.titleId}`}
                              onClick={() => handleDeleteMenuItem(item.id)}
                              className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash aria-hidden="true" weight="regular" className="h-4 w-4" />
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

      {/* Native <dialog> Category Modal (HIG Sheet Anatomy per sheets.md) */}
      <dialog
        ref={catDialogRef}
        closedby="any"
        aria-labelledby="cat-modal-title"
        className="w-full max-w-md rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => catDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Batal
          </button>
          <h2 id="cat-modal-title" className="text-sm font-bold text-[#1D1D1F]">
            {editingCatId ? 'Ubah Kategori Menu' : 'Tambah Kategori Menu'}
          </h2>
          <span className="min-w-[44px]" />
        </div>

        <form onSubmit={handleSaveCategory} className="space-y-4 p-6">
          {catError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-[#D70015]"
            >
              {catError}
            </div>
          )}

          <div>
            <label htmlFor="catNameId" className="block text-xs font-semibold text-[#1D1D1F]">
              Nama Kategori (Bahasa Indonesia) <span className="text-[#D70015]">*</span>
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
            <label htmlFor="catNameEn" className="block text-xs font-semibold text-[#1D1D1F]">
              Nama Kategori (English — Opsional)
            </label>
            <input
              id="catNameEn"
              type="text"
              value={catNameEn}
              onChange={(e) => setCatNameEn(e.target.value)}
              placeholder="Contoh: Refreshing Drinks"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 text-sm outline-none focus:border-apple-blue"
            />
          </div>

          <div>
            <label htmlFor="catOrder" className="block text-xs font-semibold text-[#1D1D1F]">
              Urutan Tampil
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

          <button
            type="submit"
            disabled={saving}
            className="apple-interactive flex min-h-[44px] w-full items-center justify-center rounded-full bg-apple-blue px-5 py-2.5 text-xs font-bold text-white hover:bg-apple-blueHover"
          >
            {editingCatId ? 'Simpan Perubahan' : 'Simpan Kategori'}
          </button>
        </form>
      </dialog>

      {/* Native <dialog> Menu Item Modal (HIG Sheet Anatomy per sheets.md) */}
      <dialog
        ref={itemDialogRef}
        closedby="any"
        aria-labelledby="item-modal-title"
        className="w-full max-w-2xl rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => itemDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Batal
          </button>
          <h2 id="item-modal-title" className="text-sm font-bold text-[#1D1D1F]">
            {editingItemId ? 'Ubah Item Menu (ID | EN)' : 'Tambah Item Menu (ID | EN)'}
          </h2>
          <span className="min-w-[44px]" />
        </div>

        <form onSubmit={handleSaveMenuItem} noValidate className="space-y-4 p-6">
          {itemFormError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-[#D70015]"
            >
              {itemFormError}
            </div>
          )}

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
                Harga (IDR) — {formatIdr(Math.max(0, Number(priceIdr) || 0))}
              </label>
              <input
                id="itemPrice"
                type="number"
                required
                min={1}
                step={500}
                aria-invalid={Number(priceIdr) <= 0}
                value={priceIdr}
                onChange={(e) => {
                  setPriceIdr(Number(e.target.value));
                  if (itemFormError) setItemFormError(null);
                }}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3.5 font-mono text-sm aria-[invalid=true]:border-[#D70015]"
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
                <ImageIcon aria-hidden="true" weight="duotone" className="h-5 w-5" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-xs font-bold text-zinc-900">Foto Produk (Optimized WebP, max 2MB)</p>
              <label className="apple-interactive mt-1.5 inline-flex cursor-pointer items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-apple-blue shadow-sm hover:bg-zinc-50">
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

