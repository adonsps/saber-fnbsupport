'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair,
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
  persistClientLang,
  resolveClientLang,
  UiLang,
} from '@/lib/order-labels';
import {
  evaluateStoreHours,
  getNowLocalInputWib,
  validateScheduledDateTime,
} from '@/lib/store-hours';
import { buildOsmEmbedUrl, haversineDistanceKm, parseLatLng } from '@/lib/geo';
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
  const [lang, setLang] = useState<UiLang>('ID');
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeNotFound, setStoreNotFound] = useState(false);

  const [orderType, setOrderType] = useState<OrderType>(OrderType.WALK_IN_TABLE);
  const [tableNumber, setTableNumber] = useState(initialTable || '');
  const [isTableLocked, setIsTableLocked] = useState(Boolean(initialTable));
  const [scheduledPickupTime, setScheduledPickupTime] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLatInput, setDeliveryLatInput] = useState('');
  const [deliveryLngInput, setDeliveryLngInput] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [deliveryTimingMode, setDeliveryTimingMode] = useState<'ASAP' | 'SCHEDULED'>('ASAP');
  const [scheduledDeliveryTime, setScheduledDeliveryTime] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [storeNotice, setStoreNotice] = useState<string | null>(null);

  // Checkout Modal State (Native <dialog>) + Apple 1:1 Direct Manipulation & Rubber-Banding (§2, §6, §9)
  const checkoutDialogRef = useRef<HTMLDialogElement>(null);
  const [sheetDragY, setSheetDragY] = useState(false ? 0 : 0);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartYRef = useRef(0);
  const pointerHistoryRef = useRef<PointerSample[]>([]);

  const [customerName, setCustomerName] = useState('');
  const [customerWhatsapp, setCustomerWhatsapp] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.BANK_TRANSFER_QRIS);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    customerName?: string;
    customerWhatsapp?: string;
    scheduledPickupTime?: string;
    scheduledDeliveryTime?: string;
    deliveryAddress?: string;
  }>({});

  const custNameInputRef = useRef<HTMLInputElement>(null);
  const custWaInputRef = useRef<HTMLInputElement>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const deliveryTimeInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLTextAreaElement>(null);

  const cartStorageKey = `saber_fnb_cart_${slug}`;
  const cartReconciledRef = useRef(false);

  useEffect(() => {
    const initial = resolveClientLang(
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    );
    setLang(initial);
  }, []);

  useEffect(() => {
    if (initialTable) {
      setOrderType(OrderType.WALK_IN_TABLE);
      setTableNumber(initialTable);
      setIsTableLocked(true);
    }
  }, [initialTable]);

  // Load Storefront Data scoped strictly to requested restaurant slug
  useEffect(() => {
    setLoading(true);
    setStoreNotFound(false);
    fetch(`/api/v1/menu-items?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          setStoreNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
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

  const hoursEval = useMemo(
    () => evaluateStoreHours(branch?.operationalHours),
    [branch?.operationalHours]
  );

  const isStoreOpenNow = Boolean(merchant?.isStoreOpen) && hoursEval.isWithinHours;

  const parsedDeliveryCoords = useMemo(
    () => parseLatLng(deliveryLatInput, deliveryLngInput),
    [deliveryLatInput, deliveryLngInput]
  );

  const liveDeliveryDistanceKm = useMemo(() => {
    if (
      !parsedDeliveryCoords ||
      typeof branch?.branchLat !== 'number' ||
      typeof branch?.branchLng !== 'number'
    ) {
      return null;
    }
    return haversineDistanceKm(
      { lat: branch.branchLat, lng: branch.branchLng },
      parsedDeliveryCoords
    );
  }, [parsedDeliveryCoords, branch?.branchLat, branch?.branchLng]);

  const isOutOfDeliveryRadius =
    liveDeliveryDistanceKm !== null &&
    (branch?.maxDeliveryRadiusKm || 0) > 0 &&
    liveDeliveryDistanceKm > (branch?.maxDeliveryRadiusKm || 0);

  const handleDetectLocation = () => {
    setGeoNotice(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoNotice(
        lang === 'ID'
          ? 'Browser Anda tidak mendukung GPS otomatis. Masukkan koordinat secara manual.'
          : 'Your browser does not support GPS geolocation. Please enter coordinates manually.'
      );
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeliveryLatInput(String(Math.round(pos.coords.latitude * 1_000_000) / 1_000_000));
        setDeliveryLngInput(String(Math.round(pos.coords.longitude * 1_000_000) / 1_000_000));
        setGeoLoading(false);
        setGeoNotice(
          lang === 'ID'
            ? 'Titik lokasi GPS berhasil dikunci.'
            : 'GPS location pinpoint locked.'
        );
      },
      () => {
        setGeoLoading(false);
        setGeoNotice(
          lang === 'ID'
            ? 'Izin lokasi ditolak/tidak tersedia. Anda dapat mengisi Latitude & Longitude manual.'
            : 'Location permission denied/unavailable. You may enter Latitude & Longitude manually.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Reset SELF_DELIVERY tab if merchant disables delivery
  useEffect(() => {
    if (branch && !branch.isSelfDeliveryEnabled && orderType === OrderType.SELF_DELIVERY) {
      setOrderType(OrderType.WALK_IN_TABLE);
    }
  }, [branch, orderType]);

  // Hydrate & reconcile saved Cart against active menu items (drop sold-out or removed items with notice)
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

  useEffect(() => {
    if (menuItems.length === 0 || cartReconciledRef.current) return;
    cartReconciledRef.current = true;
    setCart((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      const next: Record<string, CartEntry> = {};
      const dropped: string[] = [];
      for (const id of keys) {
        const found = menuItems.find((m) => m.id === id);
        if (!found) {
          dropped.push(id.slice(0, 6));
          continue;
        }
        if (found.isSoldOut) {
          dropped.push(lang === 'ID' ? found.titleId : found.titleEn || found.titleId);
          continue;
        }
        next[id] = prev[id];
      }
      if (dropped.length > 0) {
        setStoreNotice(
          lang === 'ID'
            ? `Item berikut dari keranjang sebelumnya habis/tidak tersedia dan telah dihapus: ${dropped.join(', ')}.`
            : `Unavailable or sold-out items from your previous basket were removed: ${dropped.join(', ')}.`
        );
      }
      return dropped.length > 0 ? next : prev;
    });
  }, [menuItems, lang]);

  // Persist Cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart, cartStorageKey]);

  const updateCartQty = (menuItemId: string, delta: number) => {
    if (delta > 0 && !isStoreOpenNow) {
      setStoreNotice(
        !merchant?.isStoreOpen
          ? lang === 'ID'
            ? 'Maaf, toko sedang menjeda pesanan masuk sementara.'
            : 'Sorry, the store has temporarily paused incoming orders.'
          : lang === 'ID'
            ? `Maaf, toko sedang tutup di luar jam operasional (${hoursEval.statusLabelId}).`
            : `Sorry, the store is currently closed (${hoursEval.statusLabelEn}).`
      );
      return;
    }
    setStoreNotice(null);
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
    setFieldErrors({});
    setSheetDragY(0);
    if (!isStoreOpenNow) {
      setStoreNotice(
        !merchant?.isStoreOpen
          ? lang === 'ID'
            ? 'Maaf, toko sedang menjeda pesanan masuk sementara.'
            : 'Sorry, the store has temporarily paused incoming orders.'
          : lang === 'ID'
            ? `Maaf, toko sedang tutup di luar jam operasional (${hoursEval.statusLabelId}).`
            : `Sorry, the store is currently closed (${hoursEval.statusLabelEn}).`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
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
    const nextErrors: {
      customerName?: string;
      customerWhatsapp?: string;
      scheduledPickupTime?: string;
      scheduledDeliveryTime?: string;
      deliveryAddress?: string;
    } = {};

    if (!customerName.trim()) {
      nextErrors.customerName =
        lang === 'ID' ? 'Nama pelanggan wajib diisi.' : 'Customer name is required.';
    }
    if (!customerWhatsapp.trim()) {
      nextErrors.customerWhatsapp =
        lang === 'ID' ? 'Nomor WhatsApp aktif wajib diisi.' : 'Active WhatsApp number is required.';
    }
    if (orderType === OrderType.PRE_ORDER_PICKUP) {
      const check = validateScheduledDateTime(scheduledPickupTime, branch?.operationalHours);
      if (!check.valid) {
        nextErrors.scheduledPickupTime = lang === 'ID' ? check.errorId : check.errorEn;
      }
    }
    if (orderType === OrderType.SELF_DELIVERY) {
      if (!deliveryAddress.trim()) {
        nextErrors.deliveryAddress =
          lang === 'ID' ? 'Alamat pengantaran wajib diisi.' : 'Delivery address is required.';
      } else if (isOutOfDeliveryRadius && liveDeliveryDistanceKm !== null) {
        nextErrors.deliveryAddress =
          lang === 'ID'
            ? `Lokasi Anda (${liveDeliveryDistanceKm.toFixed(1)} km) di luar jangkauan kurir toko (maks ${branch?.maxDeliveryRadiusKm} km).`
            : `Your location (${liveDeliveryDistanceKm.toFixed(1)} km) exceeds the store delivery radius (max ${branch?.maxDeliveryRadiusKm} km).`;
      }
      if (deliveryTimingMode === 'SCHEDULED') {
        const check = validateScheduledDateTime(scheduledDeliveryTime, branch?.operationalHours);
        if (!check.valid) {
          nextErrors.scheduledDeliveryTime = lang === 'ID' ? check.errorId : check.errorEn;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setCheckoutError(
        Object.values(nextErrors)[0] ||
          (lang === 'ID'
            ? 'Lengkapi kolom wajib sebelum melanjutkan.'
            : 'Please complete all required fields.')
      );
      if (nextErrors.customerName) custNameInputRef.current?.focus();
      else if (nextErrors.customerWhatsapp) custWaInputRef.current?.focus();
      else if (nextErrors.scheduledPickupTime) pickupInputRef.current?.focus();
      else if (nextErrors.deliveryAddress) addressInputRef.current?.focus();
      else if (nextErrors.scheduledDeliveryTime) deliveryTimeInputRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/orders/guest-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          customerName,
          customerWhatsapp,
          orderType,
          tableNumber: orderType === OrderType.WALK_IN_TABLE ? tableNumber || 'WALK-IN' : undefined,
          deliveryAddress: orderType === OrderType.SELF_DELIVERY ? deliveryAddress : undefined,
          deliveryLat:
            orderType === OrderType.SELF_DELIVERY ? parsedDeliveryCoords?.lat : undefined,
          deliveryLng:
            orderType === OrderType.SELF_DELIVERY ? parsedDeliveryCoords?.lng : undefined,
          scheduledPickupTime:
            orderType === OrderType.PRE_ORDER_PICKUP ? scheduledPickupTime : undefined,
          scheduledDeliveryTime:
            orderType === OrderType.SELF_DELIVERY && deliveryTimingMode === 'SCHEDULED'
              ? scheduledDeliveryTime
              : undefined,
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
        throw new Error(
          data.error ||
            (lang === 'ID' ? 'Gagal mengirim pesanan' : 'Failed to submit your order')
        );
      }

      triggerCausalHaptic([10, 40, 12]);
      // Clear local cart after successful submission
      setCart({});
      localStorage.removeItem(cartStorageKey);
      persistClientLang(lang);
      checkoutDialogRef.current?.close();
      router.push(`/order/${data.order.id}?lang=${lang}`);
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? err.message
          : lang === 'ID'
            ? 'Gagal membuat pesanan'
            : 'Failed to place order'
      );
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

  if (storeNotFound || !merchant) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="rounded-[24px] border border-black/[0.08] bg-white p-8 shadow-apple-sm">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-[#515154]">
            /{slug}
          </p>
          <h1 className="mt-2 font-serif text-xl font-bold text-[#1D1D1F]">
            Menu Restoran Tidak Ditemukan
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#515154]">
            Pastikan Anda memindai ulang QR Code resmi pada meja restoran, atau hubungi kasir
            setempat untuk bantuan pemesanan.
          </p>
        </div>
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
                  persistClientLang(code);
                }}
                className={cn(
                  'relative min-h-[44px] min-w-[44px] rounded-full px-3.5 py-1 text-xs font-bold transition-colors',
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
                    isStoreOpenNow ? 'bg-[#1D7D32] text-white' : 'bg-[#D70015] text-white'
                  )}
                >
                  {isStoreOpenNow
                    ? lang === 'ID'
                      ? 'Buka • Terima Pesanan'
                      : 'Open • Accepting Orders'
                    : !merchant?.isStoreOpen
                      ? lang === 'ID'
                        ? 'Tutup Sementara — Pesanan Dijeda'
                        : 'Paused — Orders Closed'
                      : lang === 'ID'
                        ? 'Tutup • Di Luar Jam Operasional'
                        : 'Closed • Outside Opening Hours'}
                </span>
                {hoursEval.hasSchedule && (
                  <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                    {lang === 'ID' ? hoursEval.statusLabelId : hoursEval.statusLabelEn}
                  </span>
                )}
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

      {/* Opening Hours Weekly Schedule Disclosure */}
      {hoursEval.schedule.length > 0 && (
        <details className="mx-4 mt-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-2.5 text-xs shadow-apple-sm sm:mx-0">
          <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between font-semibold text-[#1D1D1F]">
            <span>
              {lang === 'ID' ? 'Jam Operasional Toko' : 'Store Opening Hours'} •{' '}
              <span className="font-normal text-[#515154]">
                {lang === 'ID' ? hoursEval.statusLabelId : hoursEval.statusLabelEn}
              </span>
            </span>
            <span className="text-[11px] font-semibold text-apple-blue">
              {lang === 'ID' ? 'Lihat Jadwal ▾' : 'View Schedule ▾'}
            </span>
          </summary>
          <div className="mt-2.5 grid grid-cols-1 gap-1.5 border-t border-black/[0.06] pt-2.5 sm:grid-cols-2">
            {hoursEval.schedule.map((s) => (
              <div
                key={s.dayIndex}
                className="flex items-center justify-between rounded-xl bg-[#F5F5F7] px-3 py-1.5 text-[11px]"
              >
                <span className="font-semibold text-[#1D1D1F]">
                  {lang === 'ID' ? s.dayLabelId : s.dayLabelEn}
                </span>
                <span
                  className={cn(
                    'font-mono font-medium',
                    s.isOpen ? 'text-[#1D7D32]' : 'text-[#D70015]'
                  )}
                >
                  {s.isOpen
                    ? `${s.openTime} – ${s.closeTime} WIB`
                    : lang === 'ID'
                      ? 'Tutup'
                      : 'Closed'}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Store Closed / Hours Closed Alert Banner */}
      {!isStoreOpenNow && (
        <div
          role="status"
          className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-[#D70015] sm:mx-0"
        >
          <p className="font-bold">
            {!merchant?.isStoreOpen
              ? lang === 'ID'
                ? 'Toko Sedang Menjeda Pesanan Masuk'
                : 'Store Temporarily Paused'
              : lang === 'ID'
                ? 'Toko Sedang Tutup (Di Luar Jam Operasional)'
                : 'Store Currently Closed'}
          </p>
          <p className="mt-0.5">
            {!merchant?.isStoreOpen
              ? lang === 'ID'
                ? 'Dapur sedang penuh atau toko tutup sementara. Anda tetap dapat melihat menu.'
                : 'Kitchen is currently paused. You can browse the menu and check back shortly.'
              : lang === 'ID'
                ? `${hoursEval.statusLabelId}. Pemesanan dibuka kembali sesuai jadwal operasional.`
                : `${hoursEval.statusLabelEn}. Ordering will reopen during scheduled hours.`}
          </p>
        </div>
      )}

      {/* Inline Store Notice (reconciled cart items, out-of-hours clicks, etc.) */}
      {storeNotice && (
        <div
          role="status"
          className="mx-4 mt-4 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-medium text-amber-950 sm:mx-0"
        >
          <span>{storeNotice}</span>
          <button
            type="button"
            onClick={() => setStoreNotice(null)}
            className="shrink-0 font-bold text-amber-800 hover:underline"
          >
            {lang === 'ID' ? 'Tutup' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Order Type Selector Tabs with Critically Damped Spring Pill (§3, §4) */}
      <div className="mx-4 mt-4 rounded-[24px] border border-black/[0.06] bg-white p-4 shadow-apple-sm sm:mx-0">
        <div
          role="tablist"
          aria-label={lang === 'ID' ? 'Saluran Pemesanan' : 'Order Channel'}
          className={cn(
            'grid gap-1.5 rounded-2xl bg-[#F5F5F7] p-1',
            branch?.isSelfDeliveryEnabled ? 'grid-cols-3' : 'grid-cols-2'
          )}
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
            ...(branch?.isSelfDeliveryEnabled
              ? [
                  {
                    type: OrderType.SELF_DELIVERY,
                    labelId: 'Antar Kurir Toko',
                    labelEn: 'Self-Delivery',
                  },
                ]
              : []),
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
      <div className="liquid-glass-regular sticky top-2 z-30 mt-4 px-4 py-3 sm:top-3 sm:rounded-2xl sm:border sm:border-black/[0.08]">
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
                        ) : !isStoreOpenNow ? (
                          <span className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-[#515154]">
                            {lang === 'ID' ? 'Toko Tutup' : 'Closed'}
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
                          <div className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-apple-blue/10 px-1 py-1 ring-1 ring-apple-blue/30">
                            <button
                              type="button"
                              aria-label={lang === 'ID' ? `Kurangi ${title}` : `Decrease ${title}`}
                              onClick={() => updateCartQty(item.id, -1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-sm"
                            >
                              <Minus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[22px] text-center font-mono text-xs font-bold tabular-nums text-apple-blue">
                              {qty}
                            </span>
                            <button
                              type="button"
                              aria-label={lang === 'ID' ? `Tambah ${title}` : `Increase ${title}`}
                              onClick={() => updateCartQty(item.id, 1)}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-apple-blue text-white shadow-sm"
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
            className="pb-safe fixed inset-x-0 bottom-4 z-40 mx-auto max-w-2xl px-4"
          >
            <button
              type="button"
              onClick={handleOpenCheckout}
              className="apple-material-dark apple-interactive flex min-h-[54px] w-full items-center justify-between rounded-full px-5 py-3 text-white hover:brightness-110"
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
                      ? tableNumber || (lang === 'ID' ? 'Makan di Meja' : 'Dine-In')
                      : orderType === OrderType.SELF_DELIVERY
                        ? lang === 'ID'
                          ? 'Antar Kurir Toko'
                          : 'Self-Delivery'
                        : lang === 'ID'
                          ? 'Pre-Order Ambil'
                          : 'Pre-Order Pick Up'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatIdr(cartSummary.totalAmountIdr)}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  {lang === 'ID' ? 'Pesan →' : 'Checkout →'}
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
        className="w-full max-w-lg rounded-[28px] border border-black/10 bg-white p-0 shadow-apple-lg backdrop:bg-black/55 backdrop:backdrop-blur-xs"
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

        <form
          onSubmit={handlePlaceOrder}
          noValidate
          className="max-h-[80vh] space-y-5 overflow-y-auto p-6"
        >
          {checkoutError && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#D70015]"
            >
              {checkoutError}
            </div>
          )}

          {/* In-Modal Channel Switcher (accessible even after scrolling straight to Checkout) */}
          {!isTableLocked && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Pilih Layanan Pesanan' : 'Order Service Channel'}
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  {
                    type: OrderType.WALK_IN_TABLE,
                    label: lang === 'ID' ? 'Makan di Tempat' : 'Dine-In',
                  },
                  {
                    type: OrderType.PRE_ORDER_PICKUP,
                    label: lang === 'ID' ? 'Ambil Nanti' : 'Pick-Up Later',
                  },
                  ...(branch?.isSelfDeliveryEnabled
                    ? [
                        {
                          type: OrderType.SELF_DELIVERY,
                          label: lang === 'ID' ? 'Antar Kurir' : 'Store Delivery',
                        },
                      ]
                    : []),
                ].map((opt) => {
                  const active = orderType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => {
                        triggerCausalHaptic(6);
                        setOrderType(opt.type);
                        setCheckoutError(null);
                      }}
                      className={cn(
                        'min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-bold transition-all',
                        active
                          ? 'border-apple-blue bg-apple-blue/10 text-apple-blue ring-2 ring-apple-blue/15'
                          : 'border-zinc-200 bg-[#F5F5F7]/70 text-zinc-700 hover:bg-zinc-100'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Guest Details: ONLY Name & WhatsApp Number */}
          <div className="space-y-3.5">
            <div>
              <label htmlFor="custName" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Nama Anda' : 'Customer Name'} <span className="text-red-500">*</span>
              </label>
              <input
                ref={custNameInputRef}
                id="custName"
                type="text"
                required
                autoFocus
                autoComplete="name"
                aria-invalid={Boolean(fieldErrors.customerName)}
                aria-describedby={fieldErrors.customerName ? 'err-custName' : undefined}
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  if (fieldErrors.customerName) {
                    setFieldErrors((prev) => ({ ...prev, customerName: undefined }));
                  }
                }}
                placeholder={lang === 'ID' ? 'Contoh: Budi Santoso' : 'e.g. Alex Johnson'}
                className="mt-1 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 px-4 text-sm outline-none focus:border-apple-blue focus:bg-white aria-[invalid=true]:border-[#D70015]"
              />
              {fieldErrors.customerName && (
                <p id="err-custName" className="mt-1 text-[11px] font-semibold text-[#D70015]">
                  {fieldErrors.customerName}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="custWa" className="block text-xs font-semibold text-zinc-800">
                {lang === 'ID' ? 'Nomor WhatsApp Aktif' : 'WhatsApp Number'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                ref={custWaInputRef}
                id="custWa"
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                aria-invalid={Boolean(fieldErrors.customerWhatsapp)}
                aria-describedby={fieldErrors.customerWhatsapp ? 'err-custWa' : 'hint-custWa'}
                value={customerWhatsapp}
                onChange={(e) => {
                  setCustomerWhatsapp(e.target.value);
                  if (fieldErrors.customerWhatsapp) {
                    setFieldErrors((prev) => ({ ...prev, customerWhatsapp: undefined }));
                  }
                }}
                placeholder="0812xxxxxxxx"
                className="mt-1 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 px-4 font-mono text-sm outline-none focus:border-apple-blue focus:bg-white aria-[invalid=true]:border-[#D70015]"
              />
              {fieldErrors.customerWhatsapp ? (
                <p id="err-custWa" className="mt-1 text-[11px] font-semibold text-[#D70015]">
                  {fieldErrors.customerWhatsapp}
                </p>
              ) : (
                <p id="hint-custWa" className="mt-1 text-[11px] text-zinc-500">
                  {lang === 'ID'
                    ? 'Nota, status konfirmasi stok, & notifikasi makanan siap dikirim via WhatsApp.'
                    : 'Stock confirmation & payment invoice links are sent via WhatsApp.'}
                </p>
              )}
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
                    'mt-1 min-h-[48px] w-full rounded-2xl border px-3.5 font-mono text-xs font-bold uppercase',
                    isTableLocked
                      ? 'border-apple-blue/30 bg-apple-blue/5 text-apple-blue'
                      : 'border-zinc-200 bg-[#F5F5F7]/60 text-zinc-950'
                  )}
                />
              </div>
            )}

            {orderType === OrderType.PRE_ORDER_PICKUP && (
              <div>
                <label htmlFor="modalPickupTime" className="block text-xs font-semibold text-zinc-800">
                  {lang === 'ID' ? 'Tanggal & Jam Pengambilan (WIB)' : 'Pick-Up Date & Time (WIB)'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  ref={pickupInputRef}
                  id="modalPickupTime"
                  type="datetime-local"
                  min={getNowLocalInputWib()}
                  required
                  aria-invalid={Boolean(fieldErrors.scheduledPickupTime)}
                  aria-describedby={fieldErrors.scheduledPickupTime ? 'err-pickupTime' : 'hint-pickupTime'}
                  value={scheduledPickupTime}
                  onChange={(e) => {
                    setScheduledPickupTime(e.target.value);
                    if (fieldErrors.scheduledPickupTime) {
                      setFieldErrors((prev) => ({ ...prev, scheduledPickupTime: undefined }));
                    }
                  }}
                  className="mt-1 min-h-[48px] w-full rounded-2xl border border-zinc-200 bg-[#F5F5F7]/60 px-4 text-xs font-medium outline-none focus:border-apple-blue focus:bg-white aria-[invalid=true]:border-[#D70015]"
                />
                {fieldErrors.scheduledPickupTime ? (
                  <p id="err-pickupTime" className="mt-1 text-[11px] font-semibold text-[#D70015]">
                    {fieldErrors.scheduledPickupTime}
                  </p>
                ) : (
                  <p id="hint-pickupTime" className="mt-1 text-[11px] text-zinc-500">
                    {lang === 'ID'
                      ? 'Pilih tanggal & jam sesuai jam operasional toko.'
                      : 'Choose a future date & time within store operating hours.'}
                  </p>
                )}
              </div>
            )}

            {orderType === OrderType.SELF_DELIVERY && (
              <div className="space-y-3 rounded-2xl border border-zinc-200/80 bg-[#F5F5F7]/50 p-3.5">
                <div>
                  <label
                    htmlFor="modalDeliveryAddress"
                    className="block text-xs font-semibold text-zinc-800"
                  >
                    {lang === 'ID' ? 'Alamat Pengantaran Lengkap' : 'Full Delivery Address'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    ref={addressInputRef}
                    id="modalDeliveryAddress"
                    rows={2}
                    required
                    autoComplete="street-address"
                    aria-invalid={Boolean(fieldErrors.deliveryAddress)}
                    aria-describedby={fieldErrors.deliveryAddress ? 'err-deliveryAddr' : undefined}
                    value={deliveryAddress}
                    onChange={(e) => {
                      setDeliveryAddress(e.target.value);
                      if (fieldErrors.deliveryAddress) {
                        setFieldErrors((prev) => ({ ...prev, deliveryAddress: undefined }));
                      }
                    }}
                    placeholder={
                      lang === 'ID'
                        ? 'Jl. Nama Jalan, No. Rumah, Patokan...'
                        : 'Street address, unit number, landmark...'
                    }
                    className="mt-1 w-full rounded-2xl border border-zinc-200 bg-white p-3 text-xs outline-none focus:border-apple-blue aria-[invalid=true]:border-[#D70015]"
                  />
                  {fieldErrors.deliveryAddress && (
                    <p id="err-deliveryAddr" className="mt-1 text-[11px] font-semibold text-[#D70015]">
                      {fieldErrors.deliveryAddress}
                    </p>
                  )}
                </div>

                {/* Maps Pinpoint / Geolocation */}
                <div className="space-y-2 border-t border-zinc-200/80 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-zinc-700">
                      {lang === 'ID' ? 'Pin Lokasi Peta (Opsional / Akurasi Kurir)' : 'Map Pinpoint (GPS)'}
                    </span>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={geoLoading}
                      className="apple-interactive inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-apple-blue/30 bg-white px-3.5 py-1.5 text-xs font-bold text-apple-blue hover:bg-apple-blue/5 disabled:opacity-60"
                    >
                      <Crosshair aria-hidden="true" weight="bold" className="h-4 w-4" />
                      {geoLoading
                        ? lang === 'ID'
                          ? 'Mendeteksi...'
                          : 'Detecting...'
                        : lang === 'ID'
                          ? 'Gunakan Lokasi Saya (GPS)'
                          : 'Use My GPS Location'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="deliveryLat" className="block text-[10px] font-medium text-zinc-500">
                        Latitude
                      </label>
                      <input
                        id="deliveryLat"
                        type="text"
                        inputMode="decimal"
                        value={deliveryLatInput}
                        onChange={(e) => setDeliveryLatInput(e.target.value)}
                        placeholder="-6.200000"
                        className="mt-0.5 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-xs outline-none focus:border-apple-blue"
                      />
                    </div>
                    <div>
                      <label htmlFor="deliveryLng" className="block text-[10px] font-medium text-zinc-500">
                        Longitude
                      </label>
                      <input
                        id="deliveryLng"
                        type="text"
                        inputMode="decimal"
                        value={deliveryLngInput}
                        onChange={(e) => setDeliveryLngInput(e.target.value)}
                        placeholder="106.816666"
                        className="mt-0.5 min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-xs outline-none focus:border-apple-blue"
                      />
                    </div>
                  </div>

                  {geoNotice && (
                    <p className="text-[11px] font-medium text-zinc-600">{geoNotice}</p>
                  )}

                  {liveDeliveryDistanceKm !== null && (
                    <div
                      className={cn(
                        'rounded-xl px-3 py-2 text-[11px] font-semibold',
                        isOutOfDeliveryRadius
                          ? 'border border-red-200 bg-red-50 text-[#D70015]'
                          : 'border border-emerald-200 bg-emerald-50 text-[#1D7D32]'
                      )}
                    >
                      {lang === 'ID'
                        ? `Jarak ke restoran: ${liveDeliveryDistanceKm.toFixed(1)} km (maks ${branch?.maxDeliveryRadiusKm || 0} km)`
                        : `Distance from store: ${liveDeliveryDistanceKm.toFixed(1)} km (max ${branch?.maxDeliveryRadiusKm || 0} km)`}
                    </div>
                  )}

                  {parsedDeliveryCoords && (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <iframe
                        title={lang === 'ID' ? 'Pratinjau Pin Lokasi Antar' : 'Delivery Pin Preview'}
                        src={buildOsmEmbedUrl(parsedDeliveryCoords.lat, parsedDeliveryCoords.lng)}
                        className="h-36 w-full border-0"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {/* Delivery Timing Mode: ASAP vs Scheduled */}
                <div className="space-y-2 border-t border-zinc-200/80 pt-3">
                  <span className="block text-xs font-semibold text-zinc-800">
                    {lang === 'ID' ? 'Waktu Pengantaran' : 'Delivery Timing'}
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'ASAP' as const, label: lang === 'ID' ? 'Antar Sekarang (ASAP)' : 'Deliver Now (ASAP)' },
                      { id: 'SCHEDULED' as const, label: lang === 'ID' ? 'Jadwalkan Jam Antar' : 'Schedule Delivery' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDeliveryTimingMode(opt.id);
                          setFieldErrors((prev) => ({ ...prev, scheduledDeliveryTime: undefined }));
                        }}
                        className={cn(
                          'min-h-[44px] rounded-xl border px-3 py-2 text-[11px] font-bold transition-all',
                          deliveryTimingMode === opt.id
                            ? 'border-apple-blue bg-white text-apple-blue ring-2 ring-apple-blue/15'
                            : 'border-zinc-200 bg-zinc-100/70 text-zinc-600'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {deliveryTimingMode === 'SCHEDULED' && (
                    <div>
                      <label htmlFor="modalDeliveryTime" className="block text-[11px] font-semibold text-zinc-700">
                        {lang === 'ID' ? 'Tanggal & Jam Antar (WIB)' : 'Scheduled Delivery Date & Time (WIB)'}{' '}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        ref={deliveryTimeInputRef}
                        id="modalDeliveryTime"
                        type="datetime-local"
                        min={getNowLocalInputWib()}
                        required
                        aria-invalid={Boolean(fieldErrors.scheduledDeliveryTime)}
                        aria-describedby={
                          fieldErrors.scheduledDeliveryTime ? 'err-deliveryTime' : undefined
                        }
                        value={scheduledDeliveryTime}
                        onChange={(e) => {
                          setScheduledDeliveryTime(e.target.value);
                          if (fieldErrors.scheduledDeliveryTime) {
                            setFieldErrors((prev) => ({
                              ...prev,
                              scheduledDeliveryTime: undefined,
                            }));
                          }
                        }}
                        className="mt-1 min-h-[48px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium outline-none focus:border-apple-blue aria-[invalid=true]:border-[#D70015]"
                      />
                      {fieldErrors.scheduledDeliveryTime && (
                        <p id="err-deliveryTime" className="mt-1 text-[11px] font-semibold text-[#D70015]">
                          {fieldErrors.scheduledDeliveryTime}
                        </p>
                      )}
                    </div>
                  )}
                </div>
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
                  'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all',
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
                  <p className="text-xs font-bold text-zinc-950">
                    {lang === 'ID' ? 'Transfer Bank / QRIS' : 'Bank Transfer / QRIS'}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {lang === 'ID'
                      ? 'Unggah bukti setelah stok dikonfirmasi'
                      : 'Upload proof after stock confirmation'}
                  </p>
                </div>
              </label>

              <label
                className={cn(
                  'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-all',
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
                  <p className="text-xs font-bold text-zinc-950">
                    {orderType === OrderType.SELF_DELIVERY
                      ? lang === 'ID'
                        ? 'Bayar Tunai saat Kurir Tiba (COD)'
                        : 'Cash on Delivery (COD)'
                      : lang === 'ID'
                        ? 'Bayar di Kasir (Tunai)'
                        : 'Cash at Cashier'}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {orderType === OrderType.SELF_DELIVERY
                      ? lang === 'ID'
                        ? 'Siapkan uang pas untuk kurir toko'
                        : 'Pay cash directly to the store courier'
                      : lang === 'ID'
                        ? 'Bayar tunai langsung di kasir'
                        : 'Pay directly in cash at cashier'}
                  </p>
                </div>
              </label>
            </div>
          </fieldset>

          {/* Order Summary Breakdown */}
          <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7] p-4 text-xs">
            <p className="mb-2 font-bold text-zinc-950">
              {lang === 'ID' ? 'Ringkasan Pesanan' : 'Order Summary'}
            </p>
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
                  <span>{lang === 'ID' ? 'Ongkos Kirim Toko' : 'Store Delivery Fee'}</span>
                  <span className="font-mono tabular-nums">
                    {formatIdr(cartSummary.deliveryFeeIdr)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-sm font-bold text-zinc-950">
                <span>{lang === 'ID' ? 'Total Tagihan' : 'Total Due'}</span>
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
            {submitting
              ? lang === 'ID'
                ? 'Mengirim Pesanan...'
                : 'Sending Order...'
              : lang === 'ID'
                ? 'Kirim Pesanan & Minta Konfirmasi'
                : 'Place Order & Request Confirmation'}
          </button>
        </form>
      </dialog>
    </div>
  );
}
