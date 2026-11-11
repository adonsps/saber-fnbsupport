'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
  PaymentStatus,
  PaymentType,
  TableSession,
  WhatsAppWebhookLog,
} from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';
import { useDialogLightDismiss } from '@/lib/client-helpers';
import { APPLE_SPRINGS, triggerCausalHaptic } from '@/lib/apple-motion';

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
    title: 'Pending Stock',
    subtitle: 'Verify kitchen availability',
    accentBar: 'border-t-2 border-t-[#B25000]',
    statuses: [OrderStatus.PENDING_STOCK_CONFIRMATION],
  },
  {
    id: 'AWAITING_PAYMENT',
    title: 'Awaiting Payment',
    subtitle: 'Pending QRIS or cash audit',
    accentBar: 'border-t-2 border-t-apple-blue',
    statuses: [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_PENDING_APPROVAL],
  },
  {
    id: 'IN_KITCHEN',
    title: 'In Kitchen',
    subtitle: 'Active cooking & prep',
    accentBar: 'border-t-2 border-t-purple-700',
    statuses: [OrderStatus.IN_KITCHEN],
  },
  {
    id: 'READY_DELIVERY',
    title: 'Ready for Service',
    subtitle: 'Ready for table or courier',
    accentBar: 'border-t-2 border-t-[#1D7D32]',
    statuses: [OrderStatus.READY_FOR_DELIVERY],
  },
  {
    id: 'COMPLETED',
    title: 'Completed',
    subtitle: 'Settled & table session reset',
    accentBar: 'border-t-2 border-t-[#515154]',
    statuses: [OrderStatus.COMPLETED],
  },
];

export default function CashierKanbanPage() {
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

  const prevPendingCountRef = useRef<number>(-1);

  // Modals (<dialog>)
  const stockDialogRef = useRef<HTMLDialogElement>(null);
  const receiptDialogRef = useRef<HTMLDialogElement>(null);
  const tableDialogRef = useRef<HTMLDialogElement>(null);

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [editableItems, setEditableItems] = useState<OrderItem[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [moveTargetTable, setMoveTargetTable] = useState('');
  const [mergeTargetOrderId, setMergeTargetOrderId] = useState('');

  useDialogLightDismiss(stockDialogRef);
  useDialogLightDismiss(receiptDialogRef);
  useDialogLightDismiss(tableDialogRef);

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

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    triggerCausalHaptic(10);
    setBusyId(orderId);
    try {
      const res = await fetch('/api/v1/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderStatus: nextStatus,
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

  const handleSendTestFonnte = async (e: React.FormEvent) => {
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
          orderNumber: 'TEST-FONNTE',
          messageBody: `🔔 *[${merchant?.name || 'Saber Culinary'}]* Uji koneksi notifikasi WhatsApp via Fonnte API berhasil! Kasir siap menerima pesanan real-time.`,
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

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6">
      {/* Top Control Header — Opaque Grouped Card (liquid-glass.md) */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-[22px] border border-black/[0.08] bg-white p-5 shadow-apple-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hig-caption text-[11px] font-semibold uppercase tracking-[0.06em] text-[#515154]">
              Kitchen &amp; Cashier Dispatch
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
                Magic Link Order Highlighted
              </span>
            )}
          </div>
          <h1 className="hig-title-2 mt-1 text-[#1D1D1F]">
            Cashier & Kitchen Order Board
          </h1>
          <p className="text-xs text-[#515154]">
            Verify stock before billing, inspect QRIS proofs, move or merge tables, and automatically
            release table sessions when orders complete.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            <span>{soundEnabled ? 'Chime On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerCausalHaptic(6);
              loadBoard();
            }}
            className="apple-interactive inline-flex min-h-[44px] items-center rounded-full bg-apple-blue px-4 text-xs font-bold text-white hover:bg-apple-blueHover"
          >
            Refresh Board
          </button>
        </div>
      </div>

      {/* 5-Column Kanban Board — Opaque Grouped Tertiary Columns (NO backdrop-blur in content layer per liquid-glass.md) + Emil Reposition Springs (§3, §4) */}
      <LayoutGroup>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {KANBAN_COLUMNS.map((col) => {
            const colOrders = orders.filter((o) => col.statuses.includes(o.orderStatus));

            return (
              <div
                key={col.id}
                className={cn(
                  'flex min-h-[520px] flex-col rounded-[22px] border border-black/[0.08] bg-[#EFEFF4]/75 p-3.5',
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
                        No tickets in stage
                      </motion.div>
                    ) : (
                      colOrders.map((order) => {
                        const isHighlighted = highlightedId === order.id;
                        const hasProof =
                          order.paymentStatus === PaymentStatus.PROOF_UPLOADED ||
                          order.receipts.length > 0;

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
                                {order.tableNumber || order.orderType.replace('_PICKUP', '')}
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

                            {order.specialNotes && (
                              <p className="mt-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-[#B25000]">
                                Note: {order.specialNotes}
                              </p>
                            )}

                            <div className="mt-2.5 flex items-center justify-between text-xs">
                              <span className="text-[11px] font-semibold text-[#515154]">
                                {order.paymentType === PaymentType.CASH
                                  ? 'Cash at Counter'
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
                                  className="apple-interactive flex min-h-[42px] w-full items-center justify-center rounded-xl bg-[#B25000] px-3 text-xs font-bold text-white hover:brightness-110"
                                >
                                  Verify Stock & Send Bill
                                </button>
                              )}

                              {col.id === 'AWAITING_PAYMENT' && (
                                <>
                                  {hasProof ? (
                                    <div className="space-y-1.5">
                                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-2.5 py-1.5 text-center text-[11px] font-bold text-[#1D7D32]">
                                        Bukti Transfer Diterima • Siap Diperiksa
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openReceiptModal(order)}
                                        className="apple-interactive flex min-h-[42px] w-full items-center justify-center rounded-xl bg-apple-blue px-3 text-xs font-bold text-white hover:bg-apple-blueHover"
                                      >
                                        Inspect Payment Proof
                                      </button>
                                    </div>
                                  ) : order.paymentType === PaymentType.CASH ? (
                                    <button
                                      type="button"
                                      disabled={busyId === order.id}
                                      onClick={() =>
                                        handleAdvanceStatus(order.id, OrderStatus.IN_KITCHEN)
                                      }
                                      className="apple-interactive flex min-h-[42px] w-full items-center justify-center rounded-xl bg-[#1D7D32] px-3 text-xs font-bold text-white hover:brightness-110"
                                    >
                                      Accept Cash → Kitchen
                                    </button>
                                  ) : (
                                    <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-[11px] font-semibold text-apple-blue">
                                      Awaiting customer QRIS upload...
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
                                  className="apple-interactive flex min-h-[42px] w-full items-center justify-center rounded-xl bg-purple-700 px-3 text-xs font-bold text-white hover:bg-purple-800"
                                >
                                  Mark Ready for Service
                                </button>
                              )}

                              {col.id === 'READY_DELIVERY' && (
                                <button
                                  type="button"
                                  disabled={busyId === order.id}
                                  onClick={() =>
                                    handleAdvanceStatus(order.id, OrderStatus.COMPLETED)
                                  }
                                  className="apple-interactive flex min-h-[42px] w-full items-center justify-center rounded-xl bg-[#1D7D32] px-3 text-xs font-bold text-white hover:brightness-110"
                                >
                                  Complete & Reset Table
                                </button>
                              )}

                              <div className="flex items-center justify-between gap-1 pt-1">
                                {col.id !== 'COMPLETED' && (
                                  <button
                                    type="button"
                                    onClick={() => openTableControlsModal(order)}
                                    className="apple-interactive inline-flex min-h-[36px] items-center rounded-lg bg-[#F5F5F7] px-2.5 py-1 text-[11px] font-semibold text-[#1D1D1F] hover:bg-zinc-200"
                                  >
                                    Move / Merge
                                  </button>
                                )}
                                <Link
                                  href={`/order/${order.id}`}
                                  className="inline-flex min-h-[36px] items-center rounded-lg px-2 py-1 text-[11px] font-semibold text-apple-blue hover:bg-apple-blue/10"
                                >
                                  Order Pass →
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

      {/* Saber Central Automated WhatsApp Gateway Bot Outbound Telemetry Feed (Fonnte) */}
      <section className="mt-8 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/12 text-[#1D7D32]">
              <WhatsappLogo aria-hidden="true" weight="duotone" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">
                Saber x Fonnte Automated WhatsApp Bot Log
              </h2>
              <p className="text-[11px] text-zinc-500">
                Real-time notification via <code className="font-mono">api.fonnte.com</code> •{' '}
                Otomatis ke Pemilik &amp; Pelanggan
              </p>
            </div>
          </div>

          <form onSubmit={handleSendTestFonnte} className="flex flex-wrap items-center gap-2">
            <input
              type="tel"
              value={testWaPhone}
              onChange={(e) => setTestWaPhone(e.target.value)}
              placeholder={merchant?.ownerWhatsapp || '0812xxxxxxxx'}
              aria-label="Nomor WhatsApp uji coba Fonnte"
              className="min-h-[38px] w-44 rounded-full border border-zinc-200 bg-[#F5F5F7] px-3.5 font-mono text-xs outline-none focus:border-apple-blue focus:bg-white"
            />
            <button
              type="submit"
              disabled={sendingTestWa}
              className="apple-interactive inline-flex min-h-[38px] items-center rounded-full bg-[#1D7D32] px-4 text-xs font-bold text-white hover:brightness-110 disabled:opacity-60"
            >
              {sendingTestWa ? 'Mengirim...' : 'Tes WA Fonnte'}
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
            Cancel
          </button>
          <div className="text-center">
            <h3 id="stock-modal-title" className="text-sm font-bold text-[#1D1D1F]">
              Verify Stock #{currentActiveOrder?.orderNumber}
            </h3>
            <p className="hig-caption text-[11px] font-medium text-[#515154]">
              Step 2 • Partial Stock Audit
            </p>
          </div>
          <span className="min-w-[44px] text-right font-mono text-xs font-bold text-[#515154]">
            {editableItems.length} items
          </span>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-xs text-[#515154]">
            Adjust quantities or remove unavailable items. The invoice total updates automatically
            before Saber WhatsApp Bot sends payment instructions to the customer.
          </p>

          <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.08] bg-[#F5F5F7] px-4">
            {editableItems.map((item, idx) => (
              <div key={item.id} className="flex min-h-[54px] items-center justify-between gap-3 py-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-[#1D1D1F]">{item.itemTitleSnapshot}</p>
                  <p className="font-mono text-[11px] text-[#515154]">
                    {formatIdr(item.unitPriceIdr)} / portion
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Decrease portion"
                    onClick={() => updateEditableItemQty(idx, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-sm"
                  >
                    <Minus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center font-mono text-xs font-bold tabular-nums text-[#1D1D1F]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase portion"
                    onClick={() => updateEditableItemQty(idx, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-sm"
                  >
                    <Plus aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => updateEditableItemQty(idx, -item.quantity)}
                    className="ml-1 flex h-9 w-9 items-center justify-center rounded-full text-[#D70015] hover:bg-red-50"
                  >
                    <Trash aria-hidden="true" weight="regular" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-[#1D1D1F] px-4 py-3.5 text-white">
            <span className="text-xs font-medium text-zinc-300">Recalculated Total (+Delivery)</span>
            <span className="font-mono text-base font-bold tabular-nums">
              {formatIdr(editableSubtotal + Number(activeOrder?.deliveryFeeIdr || 0))}
            </span>
          </div>

          <button
            type="button"
            disabled={editableItems.length === 0 || busyId === activeOrder?.id}
            onClick={handleConfirmStockAudit}
            className="apple-interactive flex min-h-[46px] w-full items-center justify-center rounded-full bg-apple-blue px-5 py-2.5 text-xs font-bold text-white hover:bg-apple-blueHover disabled:opacity-50"
          >
            Confirm Stock & Send WhatsApp Invoice
          </button>
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
            Cancel
          </button>
          <div className="text-center">
            <h3 id="receipt-modal-title" className="text-sm font-bold text-[#1D1D1F]">
              Verify Receipt #{currentActiveOrder?.orderNumber}
            </h3>
            <p className="hig-caption text-[11px] font-medium text-[#515154]">
              Step 4 • Payment Proof Audit
            </p>
          </div>
          <span className="min-w-[44px]" />
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between rounded-2xl bg-[#F5F5F7] px-4 py-3 text-xs">
            <span className="font-semibold text-[#515154]">Expected Order Total</span>
            <span className="font-mono text-base font-bold text-apple-blue">
              {currentActiveOrder ? formatIdr(currentActiveOrder.totalAmountIdr) : '-'}
            </span>
          </div>

          {currentActiveOrder?.receipts[0]?.receiptImageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 p-2">
              <img
                src={currentActiveOrder.receipts[0].receiptImageUrl}
                alt="Uploaded Payment Receipt"
                className="mx-auto max-h-72 rounded-xl object-contain"
              />
            </div>
          ) : (
            <p className="text-center text-xs text-[#515154]">No transfer receipt image uploaded.</p>
          )}

          <div>
            <label htmlFor="rejectReason" className="block text-xs font-semibold text-[#1D1D1F]">
              Rejection Note (If Rejecting)
            </label>
            <input
              id="rejectReason"
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Transfer amount short by Rp 10.000 or blurry screenshot"
              className="mt-1 min-h-[44px] w-full rounded-xl border border-zinc-200 px-3 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleVerifyReceipt(false)}
              className="apple-interactive inline-flex min-h-[46px] items-center justify-center rounded-full border border-red-200 bg-red-50 px-4 text-xs font-bold text-[#D70015] hover:bg-red-100"
            >
              Reject Receipt
            </button>
            <button
              type="button"
              onClick={() => handleVerifyReceipt(true)}
              className="apple-interactive inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#1D7D32] px-4 text-xs font-bold text-white hover:brightness-110"
            >
              Approve → Kitchen
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
            Cancel
          </button>
          <h3 id="table-ctrl-title" className="text-sm font-bold text-[#1D1D1F]">
            Manage Table #{currentActiveOrder?.orderNumber}
          </h3>
          <span className="min-w-[44px]" />
        </div>

        <div className="space-y-5 p-6">
          {/* Move Table */}
          <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4">
            <p className="text-xs font-bold text-zinc-950">Move Table (Pindah ke Meja Kosong)</p>
            <select
              value={moveTargetTable}
              onChange={(e) => setMoveTargetTable(e.target.value)}
              className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold"
            >
              {vacantTables.length === 0 ? (
                <option value="">Tidak ada meja kosong</option>
              ) : (
                vacantTables.map((t) => (
                  <option key={t.id} value={t.tableNumber}>
                    {t.tableNumber} (Vacant)
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              disabled={!moveTargetTable}
              onClick={handleMoveTable}
              className="apple-interactive w-full rounded-full bg-zinc-950 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Pindahkan Meja
            </button>
          </div>

          {/* Merge Tables */}
          <div className="space-y-2.5 rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4">
            <p className="text-xs font-bold text-zinc-950">Merge Tables (Gabung Tagihan)</p>
            <select
              value={mergeTargetOrderId}
              onChange={(e) => setMergeTargetOrderId(e.target.value)}
              className="min-h-[42px] w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold"
            >
              {orders
                .filter(
                  (o) =>
                    o.id !== activeOrder?.id &&
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
              className="apple-interactive w-full rounded-full bg-purple-600 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Gabung ke Pesanan Tujuan
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
