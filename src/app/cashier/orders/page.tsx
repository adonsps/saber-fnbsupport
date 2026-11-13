'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  Minus,
  Plus,
  SpeakerHigh,
  SpeakerSlash,
  Trash,
  WhatsappLogo,
} from '@phosphor-icons/react';
import {
  Merchant,
  Order,
  OrderItem,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentType,
  TableSession,
  WhatsAppWebhookLog,
} from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';
import { useDialogLightDismiss } from '@/lib/client-helpers';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { getOrderTypeLabel } from '@/lib/order-labels';
import { buildGoogleMapsUrl } from '@/lib/geo';
import { formatScheduledWib } from '@/lib/store-hours';

type KanbanColumnId =
  | 'PENDING_STOCK'
  | 'AWAITING_PAYMENT'
  | 'IN_KITCHEN'
  | 'READY_DELIVERY'
  | 'COMPLETED';

const KANBAN_COLUMNS: Array<{
  id: KanbanColumnId;
  title: string;
  subtitle: string;
  accentBar: string;
  statuses: OrderStatus[];
}> = [
  {
    id: 'PENDING_STOCK',
    title: 'Cek Stok Dapur',
    subtitle: 'Pastikan bahan tersedia',
    accentBar: 'border-t-2 border-t-[#B25000]',
    statuses: [OrderStatus.PENDING_STOCK_CONFIRMATION],
  },
  {
    id: 'AWAITING_PAYMENT',
    title: 'Menunggu Pembayaran',
    subtitle: 'Verifikasi QRIS atau tunai',
    accentBar: 'border-t-2 border-t-apple-blue',
    statuses: [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_PENDING_APPROVAL],
  },
  {
    id: 'IN_KITCHEN',
    title: 'Sedang Dimasak',
    subtitle: 'Proses dapur & penyajian',
    accentBar: 'border-t-2 border-t-purple-700',
    statuses: [OrderStatus.IN_KITCHEN],
  },
  {
    id: 'READY_DELIVERY',
    title: 'Siap Disajikan',
    subtitle: 'Siap ke meja atau kurir',
    accentBar: 'border-t-2 border-t-[#1D7D32]',
    statuses: [OrderStatus.READY_FOR_DELIVERY],
  },
  {
    id: 'COMPLETED',
    title: 'Selesai',
    subtitle: 'Lunas & meja dikosongkan',
    accentBar: 'border-t-2 border-t-[#515154]',
    statuses: [OrderStatus.COMPLETED],
  },
];

export default function CashierKanbanPage() {
  const router = useRouter();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableSession[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppWebhookLog[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testWaPhone, setTestWaPhone] = useState('');
  const [sendingTestWa, setSendingTestWa] = useState(false);
  const [testWaFeedback, setTestWaFeedback] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [mobileStage, setMobileStage] = useState<KanbanColumnId>('PENDING_STOCK');

  const prevPendingCountRef = useRef<number>(-1);

  // Modals (<dialog>)
  const stockDialogRef = useRef<HTMLDialogElement>(null);
  const receiptDialogRef = useRef<HTMLDialogElement>(null);
  const tableDialogRef = useRef<HTMLDialogElement>(null);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [moveTargetTable, setMoveTargetTable] = useState('');
  const [mergeTargetOrderId, setMergeTargetOrderId] = useState('');

  useDialogLightDismiss(stockDialogRef);
  useDialogLightDismiss(receiptDialogRef);
  useDialogLightDismiss(tableDialogRef);
  useDialogLightDismiss(cancelDialogRef);

  const currentActiveOrder = activeOrder
    ? orders.find((o) => o.id === activeOrder.id) || activeOrder
    : null;

  // Apple Design §13 Multimodal Feedback: Web Audio API Chime + Haptic Harmony on the same frame
  const playChime = () => {
    triggerCausalHaptic([10, 30, 12]);
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.08, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.46);
      });
    } catch {
      // Ignore autoplay restrictions
    }
  };

  const loadBoard = async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const magicToken = params.get('magicToken');
      const query = magicToken ? `?magicToken=${encodeURIComponent(magicToken)}` : '';
      const res = await fetch(`/api/v1/orders${query}`, { cache: 'no-store' });
      const data = await res.json();

      if ((res.status === 401 || res.status === 403) && data.requiresAuth) {
        const nextUrl = `${window.location.pathname}${window.location.search}`;
        router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      const fetchedOrders: Order[] = data.orders || [];
      const pendingCount = fetchedOrders.filter(
        (o) => o.orderStatus === OrderStatus.PENDING_STOCK_CONFIRMATION
      ).length;

      if (prevPendingCountRef.current !== -1 && pendingCount > prevPendingCountRef.current) {
        playChime();
      }
      prevPendingCountRef.current = pendingCount;

      if (data.merchant) setMerchant(data.merchant);
      setOrders(fetchedOrders);
      setTables(data.tables || []);
      setWhatsappLogs(data.whatsappLogs || []);
      if (data.highlightedOrderId) {
        setHighlightedId(data.highlightedOrderId);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
    const timer = setInterval(loadBoard, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openStockAuditModal = (order: Order) => {
    triggerCausalHaptic(8);
    setActiveOrder(order);
    setEditableItems(order.items.map((item) => ({ ...item })));
    stockDialogRef.current?.showModal();
  };

  const openReceiptModal = (order: Order) => {
    triggerCausalHaptic(8);
    setActiveOrder(order);
    setRejectionReason('');
    receiptDialogRef.current?.showModal();
  };

  const openTableControlsModal = (order: Order) => {
    triggerCausalHaptic(8);
    setActiveOrder(order);
    const vacant = tables.find((t) => !t.isOccupied);
    setMoveTargetTable(vacant?.tableNumber || '');
    const otherActive = orders.find(
      (o) =>
        o.id !== order.id &&
        o.orderType === OrderType.WALK_IN_TABLE &&
        o.orderStatus !== OrderStatus.COMPLETED &&
        o.orderStatus !== OrderStatus.CANCELLED
    );
    setMergeTargetOrderId(otherActive?.id || '');
    tableDialogRef.current?.showModal();
  };

  const updateEditableItemQty = (idx: number, delta: number) => {
    triggerCausalHaptic(6);
    setEditableItems((prev) =>
      prev
        .map((item, i) => {
          if (i !== idx) return item;
          const nextQty = item.quantity + delta;
          return {
            ...item,
            quantity: nextQty,
            totalPriceIdr: Math.max(nextQty, 0) * item.unitPriceIdr,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleConfirmStockAudit = async () => {
    if (!activeOrder || editableItems.length === 0) return;
    triggerCausalHaptic(10);
    setBusyId(activeOrder.id);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder.id,
          action: 'confirm_stock',
          updatedItems: editableItems,
        }),
      });
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
      if (data.whatsappLogs) setWhatsappLogs(data.whatsappLogs);
      stockDialogRef.current?.close();
    } finally {
      setBusyId(null);
    }
  };

  const handleVerifyReceipt = async (approved: boolean) => {
    if (!activeOrder) return;
    triggerCausalHaptic(10);
    setBusyId(activeOrder.id);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder.id,
          action: 'verify_receipt',
          approved,
          rejectionReason: approved ? undefined : rejectionReason || 'Bukti kurang jelas',
        }),
      });
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
      if (data.whatsappLogs) setWhatsappLogs(data.whatsappLogs);
      receiptDialogRef.current?.close();
    } finally {
      setBusyId(null);
    }
  };

  const handleAdvanceStatus = async (
    orderId: string,
    nextStatus: OrderStatus,
    reason?: string
  ) => {
    triggerCausalHaptic(10);
    setBusyId(orderId);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderStatus: nextStatus,
          cancelReason: reason,
        }),
      });
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
      if (data.tables) setTables(data.tables);
      if (data.whatsappLogs) setWhatsappLogs(data.whatsappLogs);
    } finally {
      setBusyId(null);
    }
  };

  const openCancelOrderModal = (order: Order) => {
    triggerCausalHaptic(8);
    setActiveOrder(order);
    setCancelReason('');
    cancelDialogRef.current?.showModal();
  };

  const handleConfirmCancelOrder = async () => {
    if (!activeOrder) return;
    await handleAdvanceStatus(activeOrder.id, OrderStatus.CANCELLED, cancelReason.trim());
    stockDialogRef.current?.close();
    cancelDialogRef.current?.close();
  };

  const handleMoveTable = async () => {
    if (!activeOrder || !moveTargetTable) return;
    triggerCausalHaptic(10);
    setBusyId(activeOrder.id);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: activeOrder.id,
          action: 'move_table',
          newTableNumber: moveTargetTable,
        }),
      });
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
      if (data.tables) setTables(data.tables);
      tableDialogRef.current?.close();
    } finally {
      setBusyId(null);
    }
  };

  const handleMergeTables = async () => {
    if (!activeOrder || !mergeTargetOrderId) return;
    triggerCausalHaptic(10);
    setBusyId(activeOrder.id);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_tables',
          sourceOrderId: activeOrder.id,
          targetOrderId: mergeTargetOrderId,
        }),
      });
      const data = await res.json();
      if (data.orders) setOrders(data.orders);
      if (data.tables) setTables(data.tables);
      tableDialogRef.current?.close();
    } finally {
      setBusyId(null);
    }
  };

  const handleSendTestWhatsapp = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = (testWaPhone || merchant?.ownerWhatsapp || '').trim();
    if (!target) return;
    setSendingTestWa(true);
    setTestWaFeedback(null);
    try {
      const res = await fetch('/api/v1/webhooks/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: target,
          recipientRole: 'MERCHANT',
          orderNumber: 'TEST-WA',
          messageBody: `🔔 *[${merchant?.name || 'Saber Culinary'}]* Uji koneksi notifikasi WhatsApp berhasil! Kasir siap menerima pesanan real-time.`,
          magicLinkUrl: '/cashier/orders',
        }),
      });
      const data = await res.json();
      if (data.dispatched) {
        setWhatsappLogs((prev) => [data.dispatched, ...prev].slice(0, 25));
        setTestWaFeedback(
          data.dispatched.deliveryStatus === 'DELIVERED'
            ? `Pesan WhatsApp terkirim ke ${data.dispatched.recipientPhone} (${data.dispatched.providerMessage || 'Delivered'}).`
            : `Gagal kirim ke ${data.dispatched.recipientPhone}: ${data.dispatched.providerMessage || 'Periksa nomor tujuan.'}`
        );
      }
    } finally {
      setSendingTestWa(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="font-mono text-xs font-medium text-[#515154]">Loading kitchen board...</p>
      </div>
    );
  }

  const vacantTables = tables.filter((t) => !t.isOccupied);
  const editableSubtotal = editableItems.reduce((acc, i) => acc + i.totalPriceIdr, 0);
  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      (o.tableNumber || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6">
      <DemoModeBanner merchant={merchant} />

      {/* Top Control Header — Opaque Grouped Card (liquid-glass.md) */}
      <div className="mb-5 flex flex-col justify-between gap-4 rounded-[22px] border border-black/[0.08] bg-white p-5 shadow-apple-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hig-caption text-[11px] font-semibold uppercase tracking-[0.06em] text-[#515154]">
              Pusat Operasi Kasir &amp; Dapur
            </span>
            {merchant && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold',
                  merchant.isDemo || merchant.slug === 'warungmakan'
                    ? 'bg-[#0090FF]/12 text-[#0066CC]'
                    : 'bg-emerald-500/12 text-[#1D7D32]'
                )}
              >
                {merchant.isDemo || merchant.slug === 'warungmakan' ? 'DEMO:' : 'RESTO:'}{' '}
                {merchant.name}
              </span>
            )}
            {highlightedId && (
              <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-[11px] font-bold text-[#B25000]">
                Pesanan dari Tautan WhatsApp Disorot
              </span>
            )}
          </div>
          <h1 className="hig-title-2 mt-1 text-[#1D1D1F]">Papan Pesanan Kasir &amp; Dapur</h1>
          <p className="text-xs text-[#515154]">
            Konfirmasi ketersediaan stok, periksa bukti bayar QRIS, kelola pindah/gabung meja, atau
            batalkan pesanan untuk melepas meja secara otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            placeholder="Cari #ORD, nama, meja..."
            aria-label="Cari pesanan"
            className="min-h-[44px] w-full rounded-full border border-black/[0.1] bg-[#F5F5F7] px-4 text-xs font-medium outline-none focus:border-apple-blue focus:bg-white sm:w-56"
          />
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playChime();
            }}
            className={cn(
              'apple-interactive inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-xs font-bold',
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-[#1D7D32]'
                : 'border-zinc-200 bg-[#F5F5F7] text-[#515154]'
            )}
          >
            {soundEnabled ? (
              <SpeakerHigh aria-hidden="true" weight="duotone" className="h-4 w-4" />
            ) : (
              <SpeakerSlash aria-hidden="true" weight="duotone" className="h-4 w-4" />
            )}
            <span>{soundEnabled ? 'Bel Aktif' : 'Senyap'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerCausalHaptic(6);
              loadBoard();
            }}
            className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-4 text-xs font-bold text-white hover:bg-apple-blueHover"
          >
            Segarkan Papan
          </button>
        </div>
      </div>

      {/* Mobile Compact Stage Switcher (< md) */}
      <div className="no-scrollbar apple-snap-scroller mb-4 gap-1.5 pb-1 md:hidden">
        {KANBAN_COLUMNS.map((col) => {
          const count = filteredOrders.filter((o) => col.statuses.includes(o.orderStatus)).length;
          const active = mobileStage === col.id;
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setMobileStage(col.id)}
              className={cn(
                'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-bold transition-colors',
                active
                  ? 'bg-[#1D1D1F] text-white shadow-sm'
                  : 'border border-black/[0.08] bg-white text-[#515154]'
              )}
            >
              <span>{col.title}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 font-mono text-[10px] font-bold',
                  active ? 'bg-white/20 text-white' : 'bg-[#F5F5F7] text-[#1D1D1F]'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 5-Column Kanban Board — Opaque Grouped Tertiary Columns (NO backdrop-blur in content layer per liquid-glass.md) + Emil Reposition Springs (§3, §4) */}
      <LayoutGroup>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = filteredOrders.filter((o) => col.statuses.includes(o.orderStatus));

            return (
              <div
                key={col.id}
                className={cn(
                  'flex flex-col rounded-[22px] border border-black/[0.08] bg-[#EFEFF4]/75 p-3.5 md:min-h-[520px]',
                  mobileStage !== col.id && 'hidden md:flex',
                  col.accentBar
                )}
              >
                <div className="mb-3 flex items-center justify-between border-b border-black/[0.08] pb-2.5">
                  <div>
                    <h2 className="text-xs font-bold tracking-tight text-[#1D1D1F]">
                      {col.title}
                    </h2>
                    <p className="hig-caption mt-0.5 text-[11px] text-[#515154]">{col.subtitle}</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums text-[#1D1D1F] shadow-sm">
                    {colOrders.length}
                  </span>
                </div>

                <div className="flex-1 space-y-3">
                  <AnimatePresence mode="popLayout">
                    {colOrders.length === 0 ? (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={APPLE_SPRINGS.default}
                        className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-black/15 bg-white/60 text-xs font-medium text-[#515154]"
                      >
                        Belum ada pesanan di tahap ini
                      </motion.div>
                    ) : (
                      colOrders.map((order) => {
                        const isHighlighted = highlightedId === order.id;
                        const hasProofPending = order.paymentStatus === PaymentStatus.PROOF_UPLOADED;
                        const isProofRejected = order.paymentStatus === PaymentStatus.REJECTED;

                        return (
                          <motion.article
                            layout
                            layoutId={order.id}
                            key={order.id}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={APPLE_SPRINGS.reposition}
                            className={cn(
                              'saber-ticket-pass rounded-[18px] p-3.5',
                              isHighlighted
                                ? 'border-apple-blue ring-2 ring-apple-blue/25'
                                : 'border-black/[0.09]'
                            )}
                          >
                            <div className="saber-ticket-divider flex items-start justify-between gap-2 pb-2.5">
                              <div>
                                <span className="font-mono text-xs font-bold text-[#1D1D1F]">
                                  #{order.orderNumber}
                                </span>
                                <p className="text-xs font-bold text-[#1D1D1F]">
                                  {order.customerName}
                                </p>
                              </div>
                              <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#1D1D1F]">
                                {order.tableNumber || getOrderTypeLabel(order.orderType, 'ID')}
                              </span>
                            </div>

                            <div className="mt-2.5 space-y-1 border-b border-black/[0.06] pb-2.5 text-xs text-[#1D1D1F]">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex justify-between gap-2">
                                  <span className="truncate">
                                    <strong className="font-mono text-apple-blue">
                                      {item.quantity}×
                                    </strong>{' '}
                                    {item.itemTitleSnapshot}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {order.deliveryAddress && (
                              <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 text-[11px] text-[#1D1D1F]">
                                <p className="font-semibold text-apple-blue">Alamat Antar:</p>
                                <p className="mt-0.5 leading-snug">{order.deliveryAddress}</p>
                                {typeof order.deliveryLat === 'number' &&
                                  typeof order.deliveryLng === 'number' && (
                                    <a
                                      href={buildGoogleMapsUrl(order.deliveryLat, order.deliveryLng)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="mt-1 inline-flex items-center font-bold text-apple-blue hover:underline"
                                    >
                                      Buka Pin Maps
                                      {typeof order.deliveryDistanceKm === 'number'
                                        ? ` (${order.deliveryDistanceKm.toFixed(1)} km)`
                                        : ''}{' '}
                                      ↗
                                    </a>
                                  )}
                              </div>
                            )}

                            {(order.scheduledPickupTime || order.scheduledDeliveryTime) && (
                              <p className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-2.5 py-1.5 font-mono text-[11px] font-bold text-indigo-900">
                                {order.scheduledPickupTime
                                  ? `Ambil: ${formatScheduledWib(order.scheduledPickupTime, 'id')}`
                                  : `Antar: ${formatScheduledWib(order.scheduledDeliveryTime, 'id')}`}
                              </p>
                            )}

                            {order.specialNotes && (
                              <p className="mt-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-[#B25000]">
                                Catatan: {order.specialNotes}
                              </p>
                            )}

                            <div className="mt-2.5 flex items-center justify-between text-xs">
                              <span className="text-[11px] font-semibold text-[#515154]">
                                {order.paymentType === PaymentType.CASH
                                  ? order.orderType === OrderType.SELF_DELIVERY
                                    ? 'Tunai (COD Kurir)'
                                    : 'Tunai di Kasir'
                                  : 'QRIS / Transfer'}
                              </span>
                              <span className="font-mono font-bold tabular-nums text-[#1D1D1F]">
                                {formatIdr(order.totalAmountIdr)}
                              </span>
                            </div>

                            {/* Column-Specific Action Triggers (44px accessible target height) */}
                            <div className="mt-3 space-y-1.5">
                              {col.id === 'PENDING_STOCK' && (
                                <button
                                  type="button"
                                  onClick={() => openStockAuditModal(order)}
                                  className="apple-interactive flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#B25000] px-3 text-xs font-bold text-white hover:brightness-110"
                                >
                                  Cek Stok &amp; Kirim Tagihan
                                </button>
                              )}

                              {col.id === 'AWAITING_PAYMENT' && (
                                <>
                                  {hasProofPending ? (
                                    <div className="space-y-1.5">
                                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-2.5 py-1.5 text-center text-[11px] font-bold text-[#1D7D32]">
                                        Bukti Transfer Diterima • Siap Diperiksa
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openReceiptModal(order)}
                                        className="apple-interactive flex min-h-[44px] w-full items-center justify-center rounded-xl bg-apple-blue px-3 text-xs font-bold text-white hover:bg-apple-blueHover"
                                      >
                                        Periksa Bukti Bayar
                                      </button>
                                    </div>
                                  ) : isProofRejected ? (
                                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-[11px] font-bold text-[#D70015]">
                                      Bukti Ditolak • Menunggu Unggah Ulang Pelanggan
                                    </div>
                                  ) : order.paymentType === PaymentType.CASH ? (
                                    <button
                                      type="button"
                                      disabled={busyId === order.id}
                                      onClick={() =>
                                        handleAdvanceStatus(order.id, OrderStatus.IN_KITCHEN)
                                      }
                                      className="apple-interactive flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1D7D32] px-3 text-xs font-bold text-white hover:brightness-110"
                                    >
                                      {order.orderType === OrderType.SELF_DELIVERY
                                        ? 'Proses Masak (COD Kurir)'
                                        : 'Terima Tunai → Masak'}
                                    </button>
                                  ) : (
                                    <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-[11px] font-semibold text-apple-blue">
                                      Menunggu pelanggan unggah bukti QRIS...
                                    </div>
                                  )}
                                </>
                              )}

                              {col.id === 'IN_KITCHEN' && (
                                <button
                                  type="button"
                                  disabled={busyId === order.id}
                                  onClick={() =>
                                    handleAdvanceStatus(order.id, OrderStatus.READY_FOR_DELIVERY)
                                  }
                                  className="apple-interactive flex min-h-[44px] w-full items-center justify-center rounded-xl bg-purple-700 px-3 text-xs font-bold text-white hover:bg-purple-800"
                                >
                                  {order.orderType === OrderType.SELF_DELIVERY
                                    ? 'Tandai Siap Diantar Kurir'
                                    : order.orderType === OrderType.PRE_ORDER_PICKUP
                                      ? 'Tandai Siap Diambil Pelanggan'
                                      : 'Tandai Siap Disajikan'}
                                </button>
                              )}

                              {col.id === 'READY_DELIVERY' && (
                                <button
                                  type="button"
                                  disabled={busyId === order.id}
                                  onClick={() =>
                                    handleAdvanceStatus(order.id, OrderStatus.COMPLETED)
                                  }
                                  className="apple-interactive flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#1D7D32] px-3 text-xs font-bold text-white hover:brightness-110"
                                >
                                  {order.orderType === OrderType.SELF_DELIVERY
                                    ? 'Selesaikan Pengantaran'
                                    : order.orderType === OrderType.PRE_ORDER_PICKUP
                                      ? 'Selesaikan Pengambilan'
                                      : 'Selesaikan & Kosongkan Meja'}
                                </button>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                                {col.id !== 'COMPLETED' && (
                                  <div className="flex items-center gap-1">
                                    {order.orderType === OrderType.WALK_IN_TABLE && (
                                      <button
                                        type="button"
                                        onClick={() => openTableControlsModal(order)}
                                        className="apple-interactive inline-flex min-h-[44px] items-center rounded-lg bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-semibold text-[#1D1D1F] hover:bg-zinc-200"
                                      >
                                        Pindah / Gabung
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openCancelOrderModal(order)}
                                      className="apple-interactive inline-flex min-h-[44px] items-center rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-[#D70015] hover:bg-red-100"
                                    >
                                      Batalkan
                                    </button>
                                  </div>
                                )}
                                <Link
                                  href={`/order/${order.id}`}
                                  className="inline-flex min-h-[44px] items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold text-apple-blue hover:bg-apple-blue/10"
                                >
                                  Pass →
                                </Link>
                              </div>
                            </div>
                          </motion.article>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </LayoutGroup>

      {/* Saber Central Automated WhatsApp Gateway Bot Outbound Telemetry Feed */}
      <section className="mt-8 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/12 text-[#1D7D32]">
              <WhatsappLogo aria-hidden="true" weight="duotone" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">
                Log Bot WhatsApp Terpusat Saber
              </h2>
              <p className="text-[11px] text-zinc-500">
                Notifikasi real-time otomatis ke WhatsApp Pemilik &amp; Pelanggan
              </p>
            </div>
          </div>

          <form onSubmit={handleSendTestWhatsapp} className="flex flex-wrap items-center gap-2">
            <input
              type="tel"
              value={testWaPhone}
              onChange={(e) => setTestWaPhone(e.target.value)}
              placeholder={merchant?.ownerWhatsapp || '0812xxxxxxxx'}
              aria-label="Nomor WhatsApp uji coba"
              className="min-h-[44px] w-44 rounded-full border border-zinc-200 bg-[#F5F5F7] px-3.5 font-mono text-xs outline-none focus:border-apple-blue focus:bg-white"
            />
            <button
              type="submit"
              disabled={sendingTestWa}
              className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-[#1D7D32] px-4 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {sendingTestWa ? 'Mengirim...' : 'Tes Kirim WhatsApp'}
            </button>
          </form>
        </div>

        {testWaFeedback && (
          <div
            role="status"
            className="mb-4 rounded-xl border border-black/[0.08] bg-[#F5F5F7] px-3.5 py-2 text-xs font-medium text-[#1D1D1F]"
          >
            {testWaFeedback}
          </div>
        )}

        <div className="divide-y divide-black/[0.05] text-xs">
          {whatsappLogs.slice(0, 8).map((log) => (
            <div
              key={log.id}
              className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      log.recipientRole === 'MERCHANT'
                        ? 'bg-amber-500/15 text-amber-800'
                        : 'bg-apple-blue/10 text-apple-blue'
                    )}
                  >
                    TO {log.recipientRole}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-zinc-700">
                    {log.recipientPhone}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600">
                    {log.eventType}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-[10px] font-bold',
                      log.deliveryStatus === 'FAILED'
                        ? 'bg-red-50 text-[#D70015]'
                        : 'bg-emerald-50 text-[#1D7D32]'
                    )}
                  >
                    {log.deliveryStatus}
                  </span>
                </div>
                <p className="whitespace-pre-line text-xs text-zinc-800">{log.messageBody}</p>
                {log.providerMessage && (
                  <p className="text-[11px] text-[#515154]">{log.providerMessage}</p>
                )}
              </div>
              {log.magicLinkUrl && (
                <Link
                  href={log.magicLinkUrl}
                  className="shrink-0 rounded-full border border-zinc-200 bg-[#F5F5F7] px-3 py-1.5 text-[11px] font-bold text-apple-blue transition-colors hover:bg-apple-blue hover:text-white"
                >
                  Open Link
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Modal 1: Partial Stock Confirmation & Line-Item Editing (HIG Sheet Anatomy per sheets.md) */}
      <dialog
        ref={stockDialogRef}
        closedby="any"
        aria-labelledby="stock-modal-title"
        className="w-full max-w-lg rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => stockDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Batal
          </button>
          <div className="text-center">
            <h3 id="stock-modal-title" className="text-sm font-bold text-[#1D1D1F]">
              Cek Stok #{currentActiveOrder?.orderNumber}
            </h3>
            <p className="hig-caption text-[11px] font-medium text-[#515154]">
              Tahap 2 • Audit Stok Dapur
            </p>
          </div>
          <span className="min-w-[44px] text-right font-mono text-xs font-bold text-[#515154]">
            {editableItems.length} item
          </span>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-xs text-[#515154]">
            Sesuaikan jumlah porsi atau hapus menu yang habis. Total tagihan diperbarui otomatis
            sebelum instruksi pembayaran dikirim ke pelanggan via WhatsApp.
          </p>

          <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.08] bg-[#F5F5F7] px-4">
            {editableItems.map((item, idx) => (
              <div key={item.id} className="flex min-h-[54px] items-center justify-between gap-3 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#1D1D1F]">{item.itemTitleSnapshot}</p>
                  <p className="font-mono text-[11px] text-[#515154]">
                    {formatIdr(item.unitPriceIdr)} / porsi
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Kurangi porsi"
                    onClick={() => updateEditableItemQty(idx, -1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-sm"
                  >
                    <Minus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah porsi"
                    onClick={() => updateEditableItemQty(idx, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-sm"
                  >
                    <Plus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Hapus item"
                    onClick={() => updateEditableItemQty(idx, -item.quantity)}
                    className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[#D70015] hover:bg-red-50"
                  >
                    <Trash aria-hidden="true" weight="regular" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {editableItems.length === 0 && (
              <p className="py-5 text-center text-xs font-semibold text-[#D70015]">
                Semua item habis. Gunakan tombol Batalkan Pesanan di bawah.
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[#1D1D1F] px-4 py-3.5 text-white">
            <span className="text-xs font-medium text-zinc-300">Total Tagihan (+Ongkir)</span>
            <span className="font-mono text-base font-bold tabular-nums">
              {formatIdr(editableSubtotal + Number(activeOrder?.deliveryFeeIdr || 0))}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busyId === activeOrder?.id}
              onClick={() => currentActiveOrder && openCancelOrderModal(currentActiveOrder)}
              className="apple-interactive inline-flex min-h-[46px] items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-[#D70015] hover:bg-red-100"
            >
              Batalkan Pesanan
            </button>
            <button
              type="button"
              disabled={editableItems.length === 0 || busyId === activeOrder?.id}
              onClick={handleConfirmStockAudit}
              className="apple-interactive flex min-h-[46px] flex-1 items-center justify-center rounded-full bg-apple-blue px-5 py-2.5 text-xs font-bold text-white hover:bg-apple-blueHover disabled:opacity-50"
            >
              Konfirmasi Stok &amp; Kirim Tagihan WA
            </button>
          </div>
        </div>
      </dialog>

      {/* Modal 2: Payment Proof Verification Modal (HIG Sheet Anatomy per sheets.md) */}
      <dialog
        ref={receiptDialogRef}
        closedby="any"
        aria-labelledby="receipt-modal-title"
        className="w-full max-w-lg rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => receiptDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Batal
          </button>
          <div className="text-center">
            <h3 id="receipt-modal-title" className="text-sm font-bold text-[#1D1D1F]">
              Periksa Bukti #{currentActiveOrder?.orderNumber}
            </h3>
            <p className="hig-caption text-[11px] font-medium text-[#515154]">
              Tahap 4 • Verifikasi Pembayaran
            </p>
          </div>
          <span className="min-w-[44px]" />
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-2xl bg-[#F5F5F7] px-4 py-3 text-xs">
            <span className="font-semibold text-[#515154]">Total Tagihan Diharapkan</span>
            <span className="font-mono text-base font-bold text-apple-blue">
              {currentActiveOrder ? formatIdr(currentActiveOrder.totalAmountIdr) : '-'}
            </span>
          </div>

          {currentActiveOrder?.receipts[0]?.receiptImageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 p-2">
              <img
                src={currentActiveOrder.receipts[0].receiptImageUrl}
                alt="Bukti Transfer Pelanggan"
                className="mx-auto max-h-72 rounded-xl object-contain"
              />
            </div>
          ) : (
            <p className="text-center text-xs text-[#515154]">Belum ada foto bukti transfer.</p>
          )}

          <div>
            <label htmlFor="rejectReason" className="block text-xs font-semibold text-[#1D1D1F]">
              Catatan Penolakan (Jika Ditolak)
            </label>
            <input
              id="rejectReason"
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Nominal kurang Rp 10.000 atau foto buram"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleVerifyReceipt(false)}
              className="apple-interactive inline-flex min-h-[46px] items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-xs font-bold text-[#D70015] hover:bg-red-100"
            >
              Tolak Bukti
            </button>
            <button
              type="button"
              onClick={() => handleVerifyReceipt(true)}
              className="apple-interactive inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#1D7D32] px-4 text-xs font-bold text-white hover:brightness-110"
            >
              Setujui → Masak
            </button>
          </div>
        </div>
      </dialog>

      {/* Modal 3: Table Management Controls (Move Table & Merge Tables) */}
      <dialog
        ref={tableDialogRef}
        closedby="any"
        aria-labelledby="table-ctrl-title"
        className="w-full max-w-md rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => tableDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Batal
          </button>
          <h3 id="table-ctrl-title" className="text-sm font-bold text-[#1D1D1F]">
            Kelola Meja #{currentActiveOrder?.orderNumber}
          </h3>
          <span className="min-w-[44px]" />
        </div>

        <div className="space-y-5 p-6">
          {/* Move Table */}
          <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4">
            <p className="text-xs font-bold text-zinc-950">Pindah ke Meja Kosong</p>
            <select
              value={moveTargetTable}
              onChange={(e) => setMoveTargetTable(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold"
            >
              {vacantTables.length === 0 ? (
                <option value="">Tidak ada meja kosong</option>
              ) : (
                vacantTables.map((t) => (
                  <option key={t.id} value={t.tableNumber}>
                    {t.tableNumber} (Kosong)
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={!moveTargetTable}
              onClick={handleMoveTable}
              className="apple-interactive min-h-[44px] w-full rounded-full bg-zinc-950 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Pindahkan Meja
            </button>
          </div>

          {/* Merge Tables */}
          <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4">
            <p className="text-xs font-bold text-zinc-950">Gabung Tagihan (Merge Tables)</p>
            <select
              value={mergeTargetOrderId}
              onChange={(e) => setMergeTargetOrderId(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold"
            >
              {orders
                .filter(
                  (o) =>
                    o.id !== activeOrder?.id &&
                    o.orderType === OrderType.WALK_IN_TABLE &&
                    o.orderStatus !== OrderStatus.COMPLETED &&
                    o.orderStatus !== OrderStatus.CANCELLED
                )
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} — {o.tableNumber || o.orderType} ({o.customerName})
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!mergeTargetOrderId}
              onClick={handleMergeTables}
              className="apple-interactive min-h-[44px] w-full rounded-full bg-purple-600 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Gabung ke Pesanan Tujuan
            </button>
          </div>
        </div>
      </dialog>

      {/* Modal 4: Cancel Order Confirmation (<dialog>) */}
      <dialog
        ref={cancelDialogRef}
        closedby="any"
        aria-labelledby="cancel-order-title"
        className="w-full max-w-md rounded-[26px] border border-black/10 bg-white p-0 shadow-apple-lg"
      >
        <div className="liquid-glass-regular flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => cancelDialogRef.current?.close()}
            className="apple-interactive inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-apple-blue hover:underline"
          >
            Kembali
          </button>
          <h3 id="cancel-order-title" className="text-sm font-bold text-[#D70015]">
            Batalkan #{currentActiveOrder?.orderNumber}
          </h3>
          <span className="min-w-[44px]" />
        </div>

        <div className="space-y-4 p-6">
          <p className="text-xs leading-relaxed text-[#515154]">
            Pesanan akan ditandai <strong className="text-[#D70015]">Dibatalkan</strong>, meja yang
            dipakai akan langsung dikosongkan, dan pelanggan menerima notifikasi WhatsApp otomatis.
          </p>
          <div>
            <label htmlFor="cancelReason" className="block text-xs font-semibold text-[#1D1D1F]">
              Alasan Pembatalan (Opsional)
            </label>
            <input
              id="cancelReason"
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Contoh: Stok bahan habis atau permintaan pelanggan"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-xs outline-none focus:border-apple-blue"
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => cancelDialogRef.current?.close()}
              className="apple-interactive inline-flex min-h-[46px] flex-1 items-center justify-center rounded-full border border-zinc-200 bg-[#F5F5F7] text-xs font-bold text-[#1D1D1F]"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={busyId === currentActiveOrder?.id}
              onClick={handleConfirmCancelOrder}
              className="apple-interactive inline-flex min-h-[46px] flex-1 items-center justify-center rounded-full bg-[#D70015] text-xs font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              Ya, Batalkan Pesanan
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
