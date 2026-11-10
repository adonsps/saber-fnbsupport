'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  User,
  Utensils,
  X,
} from 'lucide-react';
import {
  Branch,
  Category,
  MenuItem,
  Merchant,
  OrderType,
  PaymentType,
} from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';

interface CartEntry {
  menuItemId: string;
  quantity: number;
  notes?: string;
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

  // Checkout Modal State (Native <dialog>)
  const checkoutDialogRef = useRef<HTMLDialogElement>(null);
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
    fetch('/api/v1/menu-items')
      .then((res) => res.json())
      .then((data) => {
        setMerchant(data.merchant);
        setBranch(data.branch);
        setCategories(data.categories || []);
        setMenuItems(data.menuItems || []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

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
    setCheckoutError(null);
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
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-32">
      {/* Store Banner & Hero Header */}
      <div className="relative overflow-hidden bg-zinc-950 sm:mt-4 sm:rounded-t-[28px]">
        <div className="h-44 w-full overflow-hidden sm:h-52">
          <img
            src="https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80"
            alt={merchant?.name || 'Store Banner'}
            className="h-full w-full object-cover opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        </div>

        {/* Floating Dual-Language Pill Toggle (ID | EN) */}
        <div className="absolute right-4 top-4 z-10 flex items-center rounded-full border border-white/25 bg-black/50 p-1 backdrop-blur-xl">
          {(['ID', 'EN'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-bold transition-all',
                lang === code ? 'bg-white text-zinc-950 shadow-sm' : 'text-white/80 hover:text-white'
              )}
            >
              {code}
            </button>
          ))}
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
              className="h-20 w-20 shrink-0 rounded-[20px] border-2 border-white/80 bg-white object-cover shadow-apple-md"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                    merchant?.isStoreOpen
                      ? 'bg-emerald-500/90 text-white'
                      : 'bg-red-600/95 text-white'
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  {merchant?.isStoreOpen
                    ? lang === 'ID'
                      ? 'Buka • Terima Pesanan'
                      : 'Open • Accepting Orders'
                    : lang === 'ID'
                    ? 'Tutup Sementara — Pesanan Dijeda'
                    : 'Paused — Orders Closed'}
                </span>
                {isTableLocked && tableNumber && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-apple-blue px-2.5 py-0.5 text-[11px] font-bold text-white">
                    <Lock className="h-3 w-3" />
                    {tableNumber}
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 truncate text-xl font-bold tracking-tight sm:text-2xl">
                {merchant?.name}
              </h1>
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-300">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{branch?.address}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Store Paused Alert Banner */}
      {!merchant?.isStoreOpen && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 sm:mx-0">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="text-xs">
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
        </div>
      )}

      {/* Order Type Selector Tabs */}
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
              icon: Utensils,
            },
            {
              type: OrderType.PRE_ORDER_PICKUP,
              labelId: 'Pre-Order Ambil',
              labelEn: 'Pre-Order Pick Up',
              icon: CalendarClock,
            },
            {
              type: OrderType.SELF_DELIVERY,
              labelId: 'Antar Kurir Toko',
              labelEn: 'Self-Delivery',
              icon: Truck,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = orderType === tab.type;
            return (
              <button
                key={tab.type}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setOrderType(tab.type)}
                className={cn(
                  'flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-bold transition-all sm:flex-row sm:text-xs',
                  active
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-apple-blue/10 px-3 py-1 font-bold text-apple-blue">
                  <Lock className="h-3 w-3" />
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

      {/* Sticky Category Navigation & Search Bar */}
      <div className="sticky top-[56px] z-30 mt-4 border-y border-black/[0.06] bg-[#F5F5F7]/90 px-4 py-3 backdrop-blur-xl sm:rounded-2xl sm:border">
        <search className="relative mb-2.5 block">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ID' ? 'Cari nasi goreng, kopi, matcha...' : 'Search menu items...'}
            className="min-h-[42px] w-full rounded-full border border-black/[0.08] bg-white pl-10 pr-4 text-xs text-zinc-950 outline-none focus:border-apple-blue"
          />
        </search>

        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveCategoryId('ALL')}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeCategoryId === 'ALL'
                ? 'bg-zinc-950 text-white shadow-sm'
                : 'bg-white text-zinc-700 hover:bg-zinc-200/70'
            )}
          >
            {lang === 'ID' ? 'Semua Menu' : 'All Items'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategoryId(cat.id)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                activeCategoryId === cat.id
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'bg-white text-zinc-700 hover:bg-zinc-200/70'
              )}
            >
              {lang === 'ID' ? cat.nameId : cat.nameEn || cat.nameId}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Cards Feed */}
      <div className="mt-5 space-y-8 px-4 sm:px-0">
        {filteredMenuByCategory.map(({ category, items }) => (
          <section key={category.id} className="space-y-3">
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
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
                      'flex gap-3.5 rounded-[22px] border bg-white p-3.5 shadow-apple-sm transition-all',
                      item.isSoldOut
                        ? 'border-zinc-200 opacity-65'
                        : 'border-black/[0.06] hover:shadow-apple-md'
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
                        <span className="absolute inset-x-1 bottom-1 rounded-full bg-red-600/95 py-0.5 text-center text-[10px] font-bold uppercase text-white">
                          {lang === 'ID' ? 'Habis' : 'Sold Out'}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-bold leading-snug text-zinc-950">{title}</h3>
                        {desc && (
                          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                            {desc}
                          </p>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-bold tabular-nums text-zinc-950">
                          {formatIdr(item.priceIdr)}
                        </span>

                        {item.isSoldOut ? (
                          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-semibold text-zinc-500">
                            Sold Out
                          </span>
                        ) : qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateCartQty(item.id, 1)}
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-zinc-950 px-4 py-1.5 text-xs font-bold text-white transition-transform hover:bg-apple-blue active:scale-95"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{lang === 'ID' ? 'Tambah' : 'Add'}</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2 rounded-full bg-apple-blue/10 p-1 ring-1 ring-apple-blue/30">
                            <button
                              type="button"
                              aria-label={`Kurangi ${title}`}
                              onClick={() => updateCartQty(item.id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-zinc-950 shadow-sm active:scale-90"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[18px] text-center font-mono text-xs font-bold tabular-nums text-apple-blue">
                              {qty}
                            </span>
                            <button
                              type="button"
                              aria-label={`Tambah ${title}`}
                              onClick={() => updateCartQty(item.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-full bg-apple-blue text-white shadow-sm active:scale-90"
                            >
                              <Plus className="h-3.5 w-3.5" />
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

      {/* Sticky Bottom Floating Cart Bar */}
      <AnimatePresence>
        {cartSummary.totalItems > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="fixed inset-x-0 bottom-4 z-40 mx-auto max-w-2xl px-4"
          >
            <button
              type="button"
              onClick={handleOpenCheckout}
              className="flex w-full items-center justify-between rounded-full bg-zinc-950/95 px-5 py-3.5 text-white shadow-apple-float backdrop-blur-xl transition-transform hover:bg-zinc-900 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-apple-blue font-mono text-xs font-bold tabular-nums text-white">
                  {cartSummary.totalItems}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold">
                    {lang === 'ID' ? 'Lihat Keranjang & Pesan' : 'View Order Basket'}
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    {orderType === OrderType.WALK_IN_TABLE
                      ? tableNumber || 'Dine-In'
                      : orderType === OrderType.SELF_DELIVERY
                      ? 'Self-Delivery'
                      : 'Pre-Order Pick Up'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatIdr(cartSummary.totalAmountIdr)}
                </span>
                <ShoppingBag className="h-4 w-4 text-apple-green" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen 5: Frictionless Guest Checkout Native <dialog> Modal */}
      <dialog
        ref={checkoutDialogRef}
        aria-labelledby="checkout-modal-title"
        className="w-full max-w-lg rounded-[28px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-apple-blue">
              100% Zero-Login Checkout
            </span>
            <h2 id="checkout-modal-title" className="text-lg font-bold text-zinc-950">
              {lang === 'ID' ? 'Konfirmasi Pesanan Anda' : 'Confirm Your Order'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Tutup checkout"
            onClick={() => checkoutDialogRef.current?.close()}
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handlePlaceOrder} className="max-h-[82vh] overflow-y-auto p-6 space-y-5">
          {checkoutError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          {/* Guest Details: ONLY Name & WhatsApp Number */}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="custName" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Nama Anda' : 'Customer Name'} <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                <input
                  id="custName"
                  type="text"
                  required
                  autoFocus
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="min-h-[46px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 pl-10 pr-4 text-sm outline-none focus:border-apple-blue focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="custWa" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Nomor WhatsApp Aktif' : 'WhatsApp Number'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <Phone className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-zinc-400" />
                <input
                  id="custWa"
                  type="tel"
                  inputMode="tel"
                  required
                  autoComplete="tel"
                  value={customerWhatsapp}
                  onChange={(e) => setCustomerWhatsapp(e.target.value)}
                  placeholder="0812xxxxxxxx"
                  className="min-h-[46px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 pl-10 pr-4 font-mono text-sm outline-none focus:border-apple-blue focus:bg-white"
                />
              </div>
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
                  <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-950">
                    <CreditCard className="h-3.5 w-3.5 text-apple-blue" />
                    Bank Transfer / QRIS
                  </p>
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
                  <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-950">
                    <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                    Bayar di Kasir (Cash)
                  </p>
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
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-apple-blue px-6 py-3 text-sm font-bold text-white shadow-apple-sm transition-all hover:bg-apple-blueHover active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <span>
              {lang === 'ID'
                ? 'Place Order & Request Confirmation'
                : 'Place Order & Request Confirmation'}
            </span>
          </button>
        </form>
      </dialog>
    </div>
  );
}

