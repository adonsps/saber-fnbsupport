'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlass,
  MapPin,
  Minus,
  Plus,
} from '@phosphor-icons/react';
import {
  Branch,
  Category,
  MenuItem,
  Merchant,
  OrderType,
  PaymentType,
} from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';
import { useDialogLightDismiss } from '@/lib/client-helpers';
import {
  APPLE_SPRINGS,
  projectMomentum,
  rubberband,
  triggerCausalHaptic,
} from '@/lib/apple-motion';

interface CartEntry {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

interface PointerSample {
  y: number;
  t: number;
}

export function CustomerStorefrontClient({
  slug,
  initialTable,
}: {
  slug: string;
  initialTable?: string;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<'ID' | 'EN'>('ID');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [orderType, setOrderType] = useState<OrderType>(OrderType.WALK_IN_TABLE);
  const [tableNumber, setTableNumber] = useState(initialTable || '');
  const [isTableLocked, setIsTableLocked] = useState(Boolean(initialTable));
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [cart, setCart] = useState<Record<string, CartEntry>>({});

  // Checkout Modal State (Native <dialog>) + Apple 1:1 Direct Manipulation & Rubber-Banding (§2, §6, §9)
  const checkoutDialogRef = useRef<HTMLDialogElement>(null);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartYRef = useRef(0);
  const pointerHistoryRef = useRef<PointerSample[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.BANK_TRANSFER_QRIS);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const cartStorageKey = `saber_fnb_cart_${slug}`;

  useEffect(() => {
    if (initialTable) {
      setOrderType(OrderType.WALK_IN_TABLE);
      setTableNumber(initialTable);
      setIsTableLocked(true);
    }
  }, [initialTable]);

  // Load Storefront Data
  useEffect(() => {
    fetch('/api/v1/menu-items', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setMerchant(data.merchant);
        setBranch(data.branch);
        setCategories(data.categories || []);
        setMenuItems(data.menuItems || []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const resetSheetDragState = () => {
    setIsDraggingSheet(false);
    setSheetDragY(0);
    pointerHistoryRef.current = [];
  };

  useDialogLightDismiss(checkoutDialogRef, resetSheetDragState);

  const closeCheckoutDialog = () => {
    resetSheetDragState();
    checkoutDialogRef.current?.close();
  };

  // Hydrate Cart from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(cartStorageKey);
      if (saved) {
        setCart(JSON.parse(saved));
      }
    } catch {
      // ignore storage errors
    }
  }, [cartStorageKey]);

  // Persist Cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartStorageKey]);

  const updateCartQty = (menuItemId: string, delta: number) => {
    triggerCausalHaptic(8);
    setCart((prev) => {
      const current = prev[menuItemId]?.quantity || 0;
      const nextQty = current + delta;
      if (nextQty <= 0) {
        const clone = { ...prev };
        delete clone[menuItemId];
        return clone;
      }
      return {
        ...prev,
        [menuItemId]: {
          menuItemId,
          quantity: nextQty,
        },
      };
    });
  };

  const cartSummary = useMemo(() => {
    const entries = Object.values(cart);
    let totalItems = 0;
    let subtotalIdr = 0;

    const detailed = entries
      .map((entry) => {
        const item = menuItems.find((m) => m.id === entry.menuItemId);
        if (!item || item.isSoldOut) return null;
        totalItems += entry.quantity;
        const lineTotal = Number(item.priceIdr) * entry.quantity;
        subtotalIdr += lineTotal;
        return {
          ...entry,
          item,
          lineTotal,
        };
      })
      .filter(Boolean) as Array<{
      menuItemId: string;
      quantity: number;
      item: MenuItem;
      lineTotal: number;
    }>;

    const deliveryFeeIdr =
      orderType === OrderType.SELF_DELIVERY && branch?.isSelfDeliveryEnabled
        ? Number(branch.deliveryFeeIdr || 0)
        : 0;

    return {
      totalItems,
      subtotalIdr,
      deliveryFeeIdr,
      totalAmountIdr: subtotalIdr + deliveryFeeIdr,
      detailed,
    };
  }, [cart, menuItems, orderType, branch]);

  const filteredMenuByCategory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categories
      .filter((c) => activeCategoryId === 'ALL' || c.id === activeCategoryId)
      .map((cat) => {
        const items = menuItems.filter((item) => {
          if (item.categoryId !== cat.id) return false;
          if (!q) return true;
          return (
            item.titleId.toLowerCase().includes(q) ||
            (item.titleEn || '').toLowerCase().includes(q) ||
            (item.descriptionId || '').toLowerCase().includes(q)
          );
        });
        return { category: cat, items };
      })
      .filter((group) => group.items.length > 0);
  }, [categories, menuItems, activeCategoryId, searchQuery]);

  const handleOpenCheckout = () => {
    triggerCausalHaptic(10);
    setCheckoutError(null);
    setSheetDragY(0);
    if (!merchant?.isStoreOpen) {
      alert(
        lang === 'ID'
          ? 'Maaf, toko sedang menjeda pesanan masuk sementara.'
          : 'Sorry, the store has temporarily paused incoming orders.'
      );
      return;
    }
    if (orderType === OrderType.PRE_ORDER_PICKUP && !scheduledPickupTime) {
      setCheckoutError(
        lang === 'ID'
          ? 'Pilih estimasi waktu ambil (Pick-Up) terlebih dahulu.'
          : 'Please select an estimated pick-up date and time.'
      );
    }
    if (orderType === OrderType.SELF_DELIVERY && !deliveryAddress.trim()) {
      setCheckoutError(
        lang === 'ID'
          ? 'Masukkan alamat pengantaran lengkap di halaman utama.'
          : 'Please enter your full delivery address.'
      );
    }
    checkoutDialogRef.current?.showModal();
  };

  // Apple Design §2, §5, §6, §9: 1:1 Pointer Tracking + Rubber-Banding + Momentum Projection on Sheet Handle
  const handleSheetPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Allow interactive controls (e.g. Batal/Cancel button) inside the sheet header to handle clicks normally
    if ((e.target as HTMLElement | null)?.closest('button, a, input, select, textarea, label')) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingSheet(true);
    dragStartYRef.current = e.clientY - sheetDragY;
    pointerHistoryRef.current = [{ y: e.clientY, t: performance.now() }];
  };

  const handleSheetPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSheet) return;
    const rawDelta = e.clientY - dragStartYRef.current;
    const now = performance.now();
    pointerHistoryRef.current = [
      ...pointerHistoryRef.current.slice(-4),
      { y: e.clientY, t: now },
    ];

    const dialogHeight = checkoutDialogRef.current?.offsetHeight || 560;
    if (rawDelta < 0) {
      // Dragging upward past top bound -> progressive rubber-banding resistance (§9)
      setSheetDragY(rubberband(rawDelta, dialogHeight, 0.55));
    } else {
      // 1:1 downward tracking (§2)
      setSheetDragY(rawDelta);
    }
  };

  const handleSheetPointerUp = () => {
    if (!isDraggingSheet) return;
    setIsDraggingSheet(false);

    const samples = pointerHistoryRef.current;
    let releaseVelocityPxPerSec = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dtMs = Math.max(1, last.t - first.t);
      releaseVelocityPxPerSec = ((last.y - first.y) / dtMs) * 1000;
    }

    // §6 Momentum Projection: project landing position from finger velocity
    const projectedEndpoint = sheetDragY + projectMomentum(releaseVelocityPxPerSec, 0.992);
    if (projectedEndpoint > 140 || releaseVelocityPxPerSec > 680) {
      triggerCausalHaptic(8);
      setSheetDragY(0);
      checkoutDialogRef.current?.close();
    } else {
      setSheetDragY(0);
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);

    if (!customerName.trim() || !customerWhatsapp.trim()) {
      setCheckoutError(
        lang === 'ID'
          ? 'Nama dan Nomor WhatsApp wajib diisi untuk menerima notifikasi status.'
          : 'Name and WhatsApp number are required for live order alerts.'
      );
      return;
    }

    if (orderType === OrderType.SELF_DELIVERY && !deliveryAddress.trim()) {
      setCheckoutError(
        lang === 'ID' ? 'Alamat pengantaran wajib diisi.' : 'Delivery address is required.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/orders/guest-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerWhatsapp,
          orderType,
          tableNumber: orderType === OrderType.WALK_IN_TABLE ? tableNumber || 'WALK-IN' : undefined,
          deliveryAddress: orderType === OrderType.SELF_DELIVERY ? deliveryAddress : undefined,
          scheduledPickupTime:
            orderType === OrderType.PRE_ORDER_PICKUP ? scheduledPickupTime : undefined,
          specialNotes,
          paymentType,
          items: cartSummary.detailed.map((d) => ({
            menuItemId: d.menuItemId,
            quantity: d.quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim pesanan');
      }

      triggerCausalHaptic([10, 40, 12]);
      // Clear local cart after successful submission
      setCart({});
      localStorage.removeItem(cartStorageKey);
      checkoutDialogRef.current?.close();
      router.push(`/order/${data.order.id}`);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Gagal membuat pesanan');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="font-mono text-xs font-medium text-[#515154]">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-32">
      {/* Store Banner & Hero Header */}
      <div className="relative overflow-hidden bg-zinc-950 sm:mt-4 sm:rounded-t-[28px] shadow-apple-md">
        <div className="h-44 w-full overflow-hidden sm:h-52">
          <img
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80"
            alt={merchant?.name || 'Store Banner'}
            className="h-full w-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>

        {/* Floating Dual-Language Pill Toggle (ID | EN) using Clear Liquid Glass + 35% Dimming Layer (liquid-glass.md › Which variant) + Emil Spring (§3, §4) */}
        <div className="liquid-glass-clear absolute right-4 top-4 z-10 flex items-center rounded-full p-1">
          {(['ID', 'EN'] as const).map((code) => {
            const isSelected = lang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  triggerCausalHaptic(6);
                  setLang(code);
                }}
                className={cn(
                  'relative min-h-[36px] min-w-[44px] rounded-full px-3.5 py-1 text-xs font-bold transition-colors',
                  isSelected ? 'text-[#1D1D1F]' : 'text-white hover:text-white/90'
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId="storefront-lang-pill"
                    transition={APPLE_SPRINGS.default}
                    className="absolute inset-0 -z-10 rounded-full bg-white shadow-sm"
                  />
                )}
                {code}
              </button>
            );
          })}
        </div>

        {/* Store Identity Overlay */}
        <div className="relative z-10 -mt-14 px-5 pb-6 text-white">
          <div className="flex items-end gap-4">
            <img
              src={
                branch?.logoUrl ||
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80'
              }
              alt={merchant?.name || 'Logo'}
              className="h-20 w-20 shrink-0 rounded-[20px] border-2 border-white/85 bg-white object-cover shadow-apple-md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                    merchant?.isStoreOpen
                      ? 'bg-[#1D7D32] text-white'
                      : 'bg-[#D70015] text-white'
                  )}
                >
                  {merchant?.isStoreOpen
                    ? lang === 'ID'
                      ? 'Buka • Terima Pesanan'
                      : 'Open • Accepting Orders'
                    : lang === 'ID'
                    ? 'Tutup Sementara — Pesanan Dijeda'
                    : 'Paused — Orders Closed'}
                </span>
                {isTableLocked && tableNumber && (
                  <span className="inline-flex items-center rounded-full bg-apple-blue px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                    {tableNumber}
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 truncate font-serif text-xl font-bold tracking-tight sm:text-2xl">
                {merchant?.name}
              </h1>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-200">
                <MapPin aria-hidden="true" weight="fill" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{branch?.address}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Store Paused Alert Banner */}
      {!merchant?.isStoreOpen && (
        <div
          role="status"
          className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-[#D70015] sm:mx-0"
        >
          <p className="font-bold">
            {lang === 'ID'
              ? 'Toko Sedang Menjeda Pesanan Masuk'
              : 'Store Temporarily Paused'}
          </p>
          <p className="mt-0.5">
            {lang === 'ID'
              ? 'Dapur sedang penuh atau toko tutup sementara. Anda tetap dapat melihat menu.'
              : 'Kitchen is currently paused. You can browse the menu and check back shortly.'}
          </p>
        </div>
      )}

      {/* Order Type Selector Tabs with Critically Damped Spring Pill (§3, §4) */}
      <div className="mx-4 mt-4 rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-apple-sm sm:mx-0">
        <div
          role="tablist"
          aria-label="Order Channel"
          className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#F5F5F7] p-1"
        >
          {[
            {
              type: OrderType.WALK_IN_TABLE,
              labelId: 'Dine-In Meja',
              labelEn: 'Walk-In Table',
            },
            {
              type: OrderType.PRE_ORDER_PICKUP,
              labelId: 'Pre-Order Ambil',
              labelEn: 'Pre-Order Pick Up',
            },
            {
              type: OrderType.SELF_DELIVERY,
              labelId: 'Antar Kurir Toko',
              labelEn: 'Self-Delivery',
            },
          ].map((tab) => {
            const active = orderType === tab.type;
            return (
              <button
                key={tab.type}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  triggerCausalHaptic(6);
                  setOrderType(tab.type);
                }}
                className={cn(
                  'relative z-10 flex min-h-[44px] items-center justify-center rounded-xl px-2 py-2 text-[11px] font-bold transition-colors sm:text-xs',
                  active ? 'text-zinc-950' : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="storefront-channel-pill"
                    transition={APPLE_SPRINGS.default}
                    className="absolute inset-0 -z-10 rounded-xl bg-white shadow-sm"
                  />
                )}
                <span>{lang === 'ID' ? tab.labelId : tab.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Channel Fields */}
        <div className="mt-3.5">
          {orderType === OrderType.WALK_IN_TABLE && (
            <div className="flex items-center justify-between rounded-2xl bg-[#F5F5F7]/70 px-4 py-3 text-xs">
              <span className="font-medium text-zinc-600">
                {lang === 'ID' ? 'Nomor Meja Anda' : 'Table Number'}
              </span>
              {isTableLocked ? (
                <span className="inline-flex items-center rounded-full bg-apple-blue/10 px-3 py-1 font-mono font-bold text-apple-blue">
                  {tableNumber}
                </span>
              ) : (
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value.toUpperCase())}
                  placeholder="Contoh: TABLE 04"
                  className="w-40 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-right font-mono text-xs font-bold uppercase"
                />
              )}
            </div>
          )}

          {orderType === OrderType.PRE_ORDER_PICKUP && (
            <div className="flex flex-col gap-2 rounded-2xl bg-[#F5F5F7]/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="pickupTime" className="text-xs font-semibold text-zinc-700">
                {lang === 'ID' ? 'Estimasi Waktu Ambil (Pick Up):' : 'Estimated Pick-Up Time:'}
              </label>
              <input
                id="pickupTime"
                type="datetime-local"
                value={scheduledPickupTime}
                onChange={(e) => setScheduledPickupTime(e.target.value)}
                className="min-h-[40px] rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium"
              />
            </div>
          )}

          {orderType === OrderType.SELF_DELIVERY && (
            <div className="space-y-2 rounded-2xl bg-[#F5F5F7]/70 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-800">
                  {lang === 'ID' ? 'Alamat Pengantaran Lengkap' : 'Delivery Address'}
                </span>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                  Maks {branch?.maxDeliveryRadiusKm} km • Ongkir{' '}
                  {formatIdr(Number(branch?.deliveryFeeIdr || 0))}
                </span>
              </div>
              <textarea
                rows={2}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={
                  lang === 'ID'
                    ? 'Jl. Nama Jalan, No. Rumah, Patokan...'
                    : 'Street address, unit number, landmark...'
                }
                className="w-full rounded-xl border border-zinc-200 bg-white p-2.5 text-xs outline-none focus:border-apple-blue"
              />
            </div>
          )}
        </div>
      </div>

      {/* Sticky Category Navigation & Search Bar (Regular Liquid Glass Functional Layer per liquid-glass.md + Snap Scroller) */}
      <div className="liquid-glass-regular sticky top-[60px] z-30 mt-4 px-4 py-3 sm:rounded-2xl sm:border sm:border-black/[0.08]">
        <search className="relative mb-2.5 block">
          <MagnifyingGlass
            aria-hidden="true"
            weight="regular"
            className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#515154]"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ID' ? 'Cari nasi goreng, kopi, matcha...' : 'Search menu items...'}
            className="min-h-[44px] w-full rounded-full border border-black/[0.1] bg-white pl-10 pr-4 text-xs text-[#1D1D1F] outline-none focus:border-apple-blue"
          />
        </search>

        <div className="no-scrollbar apple-snap-scroller items-center gap-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => {
              triggerCausalHaptic(6);
              setActiveCategoryId('ALL');
            }}
            className={cn(
              'relative z-10 min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
              activeCategoryId === 'ALL'
                ? 'text-white'
                : 'bg-white text-[#515154] hover:bg-black/[0.05] hover:text-[#1D1D1F]'
            )}
          >
            {activeCategoryId === 'ALL' && (
              <motion.span
                layoutId="storefront-category-pill"
                transition={APPLE_SPRINGS.default}
                className="absolute inset-0 -z-10 rounded-full bg-[#1D1D1F] shadow-sm"
              />
            )}
            {lang === 'ID' ? 'Semua Menu' : 'All Items'}
          </button>
          {categories.map((cat) => {
            const isSelected = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  triggerCausalHaptic(6);
                  setActiveCategoryId(cat.id);
                }}
                className={cn(
                  'relative z-10 min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                  isSelected
                    ? 'text-white'
                    : 'bg-white text-[#515154] hover:bg-black/[0.05] hover:text-[#1D1D1F]'
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId="storefront-category-pill"
                    transition={APPLE_SPRINGS.default}
                    className="absolute inset-0 -z-10 rounded-full bg-[#1D1D1F] shadow-sm"
                  />
                )}
                {lang === 'ID' ? cat.nameId : cat.nameEn || cat.nameId}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Cards Feed (Opaque Grouped Content Layer per liquid-glass.md) */}
      <div className="mt-5 space-y-8 px-4 sm:px-0">
        {filteredMenuByCategory.map(({ category, items }) => (
          <section key={category.id} className="space-y-3">
            <h2 className="font-serif text-lg font-bold tracking-tight text-[#1D1D1F]">
              {lang === 'ID' ? category.nameId : category.nameEn || category.nameId}
            </h2>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {items.map((item) => {
                const qty = cart[item.id]?.quantity || 0;
                const title = lang === 'ID' ? item.titleId : item.titleEn || item.titleId;
                const desc =
                  lang === 'ID'
                    ? item.descriptionId
                    : item.descriptionEn || item.descriptionId;

                return (
                  <article
                    key={item.id}
                    className={cn(
                      'flex gap-3.5 rounded-[20px] border bg-white p-3.5 shadow-apple-sm transition-all',
                      item.isSoldOut
                        ? 'border-zinc-200 opacity-65'
                        : 'border-black/[0.08] hover:shadow-apple-md'
                    )}
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[16px] bg-zinc-100 ring-1 ring-black/5">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={title}
                          className={cn(
                            'h-full w-full object-cover',
                            item.isSoldOut && 'grayscale'
                          )}
                        />
                      )}
                      {item.isSoldOut && (
                        <span className="absolute inset-x-1 bottom-1 rounded-full bg-[#D70015] py-0.5 text-center text-[10px] font-bold uppercase text-white">
                          {lang === 'ID' ? 'Habis' : 'Sold Out'}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold leading-snug text-[#1D1D1F]">{title}</h3>
                        {desc && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#515154]">
                            {desc}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold tabular-nums text-[#1D1D1F]">
                          {formatIdr(item.priceIdr)}
                        </span>

                        {item.isSoldOut ? (
                          <span className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-[#515154]">
                            {lang === 'ID' ? 'Stok Habis' : 'Sold Out'}
                          </span>
                        ) : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, 1)}
                            className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-4 py-2 text-xs font-bold text-white hover:bg-apple-blueHover"
                          >
                            {lang === 'ID' ? '+ Tambah' : '+ Add'}
                          </button>
                        ) : (
                          <div className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-apple-blue/10 px-1.5 py-1 ring-1 ring-apple-blue/30">
                            <button
                              type="button"
                              aria-label={`Kurangi ${title}`}
                              onClick={() => updateCartQty(item.id, -1)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-sm"
                            >
                              <Minus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[22px] text-center font-mono text-xs font-bold tabular-nums text-apple-blue">
                              {qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah ${title}`}
                              onClick={() => updateCartQty(item.id, 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-apple-blue text-white shadow-sm"
                            >
                              <Plus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Sticky Bottom Floating Cart Bar (Materialize Glass Layer §12 + Sheet Spring §4) */}
      <AnimatePresence>
        {cartSummary.totalItems > 0 && (
          <motion.div
            initial={{ y: 76, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 76, opacity: 0, scale: 0.94 }}
            transition={APPLE_SPRINGS.sheet}
            className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-2xl px-4"
          >
            <button
              type="button"
              onClick={handleOpenCheckout}
              className="apple-material-dark apple-interactive flex w-full items-center justify-between rounded-full px-5 py-3.5 text-white hover:brightness-110"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-apple-blue font-mono text-xs font-bold tabular-nums text-white shadow-sm">
                  {cartSummary.totalItems}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold tracking-tight">
                    {lang === 'ID' ? 'Lihat Keranjang & Pesan' : 'View Order Basket'}
                  </p>
                  <p className="apple-caption text-[11px] text-zinc-300">
                    {orderType === OrderType.WALK_IN_TABLE
                      ? tableNumber || 'Dine-In'
                      : orderType === OrderType.SELF_DELIVERY
                      ? 'Self-Delivery'
                      : 'Pre-Order Pick Up'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatIdr(cartSummary.totalAmountIdr)}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  {lang === 'ID' ? 'Checkout →' : 'Checkout →'}
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 5: Frictionless Guest Checkout Native <dialog> Modal with 1:1 Drag & Rubber-Banding */}
      <dialog
        ref={checkoutDialogRef}
        closedby="any"
        aria-labelledby="checkout-modal-title"
        style={{
          transform: sheetDragY !== 0 ? `translateY(${sheetDragY}px)` : undefined,
          transition: isDraggingSheet ? 'none' : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="w-full max-w-lg rounded-[28px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        {/* Apple HIG Sheet Navigation Header (sheets.md › Platform considerations) + Emil 1:1 Drag & Rubber-Banding (§2, §6, §9) */}
        <div
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerUp}
          className="liquid-glass-regular sticky top-0 z-10 cursor-grab touch-none select-none px-5 pb-3 pt-2 active:cursor-grabbing"
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-black/20"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={closeCheckoutDialog}
              className="apple-interactive relative z-20 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-apple-blue hover:underline"
            >
              {lang === 'ID' ? 'Batal' : 'Cancel'}
            </button>
            <div className="text-center">
              <h2 id="checkout-modal-title" className="text-sm font-bold text-[#1D1D1F]">
                {lang === 'ID' ? 'Konfirmasi Pesanan' : 'Confirm Order'}
              </h2>
              <p className="hig-caption text-[11px] font-medium text-[#515154]">
                {lang === 'ID' ? 'Tanpa Login • Geser untuk Tutup' : 'Zero-Login • Swipe Down to Close'}
              </p>
            </div>
            <span className="inline-flex min-w-[44px] justify-end font-mono text-xs font-bold tabular-nums text-[#515154]">
              {cartSummary.totalItems}×
            </span>
          </div>
        </div>

        <form onSubmit={handlePlaceOrder} className="max-h-[80vh] space-y-5 overflow-y-auto p-6">
          {checkoutError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#D70015]"
            >
              {checkoutError}
            </div>
          )}

          {/* Guest Details: ONLY Name & WhatsApp Number */}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="custName" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Nama Anda' : 'Customer Name'} <span className="text-red-500">*</span>
              </label>
              <input
                id="custName"
                type="text"
                required
                autoFocus
                autoComplete="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="mt-1 min-h-[46px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 px-4 text-sm outline-none focus:border-apple-blue focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="custWa" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Nomor WhatsApp Aktif' : 'WhatsApp Number'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                id="custWa"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                value={customerWhatsapp}
                onChange={(e) => setCustomerWhatsapp(e.target.value)}
                placeholder="0812xxxxxxxx"
                className="mt-1 min-h-[46px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 px-4 font-mono text-sm outline-none focus:border-apple-blue focus:bg-white"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                {lang === 'ID'
                  ? 'Nota, status konfirmasi stok, & notifikasi makanan siap dikirim via WhatsApp.'
                  : 'Stock confirmation & payment invoice links are sent via WhatsApp.'}
              </p>
            </div>

            {orderType === OrderType.WALK_IN_TABLE && (
              <div>
                <label htmlFor="chkTable" className="block text-xs font-semibold text-zinc-800">
                  {lang === 'ID' ? 'Nomor Meja' : 'Table Identifier'}
                </label>
                <input
                  id="chkTable"
                  type="text"
                  readOnly={isTableLocked}
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value.toUpperCase())}
                  placeholder="TABLE 04"
                  className={cn(
                    'mt-1 min-h-[44px] w-full rounded-2xl border px-3.5 font-mono text-xs font-bold uppercase',
                    isTableLocked
                      ? 'border-apple-blue/30 bg-apple-blue/5 text-apple-blue'
                      : 'border-zinc-200 bg-[#F5F5F7]/60 text-zinc-950'
                  )}
                />
              </div>
            )}

            <div>
              <label htmlFor="specialNotes" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Catatan Khusus Dapur (Opsional)' : 'Special Cooking Notes'}
              </label>
              <textarea
                id="specialNotes"
                rows={2}
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                placeholder={
                  lang === 'ID'
                    ? 'Contoh: Sambal dipisah, es sedikit...'
                    : 'e.g. Less ice, spicy on the side...'
                }
                className="mt-1 w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 p-3 text-xs outline-none focus:border-apple-blue focus:bg-white"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-zinc-800">
              {lang === 'ID' ? 'Metode Pembayaran' : 'Payment Method'}
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all',
                  paymentType === PaymentType.BANK_TRANSFER_QRIS
                    ? 'border-apple-blue bg-apple-blue/5 ring-2 ring-apple-blue/15'
                    : 'border-zinc-200 bg-white'
                )}
              >
                <input
                  type="radio"
                  name="paymentType"
                  checked={paymentType === PaymentType.BANK_TRANSFER_QRIS}
                  onChange={() => setPaymentType(PaymentType.BANK_TRANSFER_QRIS)}
                  className="accent-apple-blue"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-950">Bank Transfer / QRIS</p>
                  <p className="text-[10px] text-zinc-500">Upload bukti setelah stok ok</p>
                </div>
              </label>

              <label
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all',
                  paymentType === PaymentType.CASH
                    ? 'border-apple-blue bg-apple-blue/5 ring-2 ring-apple-blue/15'
                    : 'border-zinc-200 bg-white'
                )}
              >
                <input
                  type="radio"
                  name="paymentType"
                  checked={paymentType === PaymentType.CASH}
                  onChange={() => setPaymentType(PaymentType.CASH)}
                  className="accent-apple-blue"
                />
                <div>
                  <p className="text-xs font-bold text-zinc-950">Bayar di Kasir (Cash)</p>
                  <p className="text-[10px] text-zinc-500">Bayar tunai langsung di kasir</p>
                </div>
              </label>
            </div>
          </fieldset>

          {/* Order Summary Breakdown */}
          <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4 text-xs">
            <p className="mb-2 font-bold text-zinc-950">Ringkasan Pesanan</p>
            <div className="space-y-1.5">
              {cartSummary.detailed.map((d) => (
                <div key={d.menuItemId} className="flex justify-between gap-2 text-zinc-700">
                  <span>
                    <strong className="font-mono">{d.quantity}×</strong>{' '}
                    {lang === 'ID' ? d.item.titleId : d.item.titleEn || d.item.titleId}
                  </span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatIdr(d.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 border-t border-black/[0.08] pt-2.5">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">{formatIdr(cartSummary.subtotalIdr)}</span>
              </div>
              {cartSummary.deliveryFeeIdr > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Ongkos Kirim Toko</span>
                  <span className="font-mono tabular-nums">
                    {formatIdr(cartSummary.deliveryFeeIdr)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-bold text-zinc-950">
                <span>Total Tagihan</span>
                <span className="font-mono tabular-nums text-apple-blue">
                  {formatIdr(cartSummary.totalAmountIdr)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="apple-interactive flex min-h-[48px] w-full items-center justify-center rounded-full bg-apple-blue px-6 py-3 text-sm font-bold text-white shadow-apple-sm hover:bg-apple-blueHover disabled:opacity-60"
          >
            {submitting ? 'Mengirim Pesanan...' : 'Place Order & Request Confirmation'}
          </button>
        </form>
      </dialog>
    </div>
  );
}
