'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  Combine,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquareText,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Trash2,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  TableSession,
  WhatsAppWebhookLog,
} from '@/types/schema';
import { cn, formatIdr } from '@/lib/utils';

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
  dotColor: string;
  statuses: OrderStatus[];
}> = [
  {
    id: 'PENDING_STOCK',
    title: '1. Pending Stock',
    subtitle: 'Verifikasi ketersediaan dapur',
    dotColor: 'bg-amber-500',
    statuses: [OrderStatus.PENDING_STOCK_CONFIRMATION],
  },
  {
    id: 'AWAITING_PAYMENT',
    title: '2. Awaiting Payment',
    subtitle: 'Menunggu transfer & audit bukti',
    dotColor: 'bg-apple-blue',
    statuses: [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_PENDING_APPROVAL],
  },
  {
    id: 'IN_KITCHEN',
    title: '3. In Kitchen',
    subtitle: 'Sedang dimasak / disiapkan',
    dotColor: 'bg-purple-500',
    statuses: [OrderStatus.IN_KITCHEN],
  },
  {
    id: 'READY_DELIVERY',
    title: '4. Ready / Delivery',
    subtitle: 'Siap antar ke meja / kurir',
    dotColor: 'bg-emerald-500',
    statuses: [OrderStatus.READY_FOR_DELIVERY],
  },
  {
    id: 'COMPLETED',
    title: '5. Completed',
    subtitle: 'Selesai & Auto Reset Meja',
    dotColor: 'bg-zinc-400',
    statuses: [OrderStatus.COMPLETED],
  },
];

export default function CashierKanbanPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<TableSession[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppWebhookLog[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  // Subtle Apple-like Web Audio API Chime
  const playChime = () => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      const res = await fetch(`/api/v1/orders${query}`);
      const data = await res.json();

      const fetchedOrders: Order[] = data.orders || [];
      const pendingCount = fetchedOrders.filter(
        (o) => o.orderStatus === OrderStatus.PENDING_STOCK_CONFIRMATION
      ).length;

      if (prevPendingCountRef.current !== -1 && pendingCount > prevPendingCountRef.current) {
        playChime();
      }
      prevPendingCountRef.current = pendingCount;

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
    setActiveOrder(order);
    setEditableItems(order.items.map((item) => ({ ...item })));
    stockDialogRef.current?.showModal();
  };

  const openReceiptModal = (order: Order) => {
    setActiveOrder(order);
    setRejectionReason('');
    receiptDialogRef.current?.showModal();
  };

  const openTableControlsModal = (order: Order) => {
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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-apple-blue" />
      </div>
    );
  }

  const vacantTables = tables.filter((t) => !t.isOccupied);
  const editableSubtotal = editableItems.reduce((acc, i) => acc + i.totalPriceIdr, 0);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 sm:px-6">
      {/* Top Control Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-[26px] border border-black/[0.06] bg-white p-5 shadow-apple-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-apple-blue/10 px-3 py-0.5 text-[11px] font-bold text-apple-blue">
              <span className="h-2 w-2 rounded-full bg-apple-blue animate-pulse" />
              Sprint 3 • Live Cashier Kanban & WA Gateway
            </span>
            {highlightedId && (
              <span className="rounded-full bg-amber-500/15 px-3 py-0.5 text-[11px] font-bold text-amber-800">
                Magic Link Order Highlighted
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950">
            Dashboard Antrean Kasir & Dapur
          </h1>
          <p className="text-xs text-zinc-500">
            Audit stok sebelum penagihan, verifikasi bukti QRIS, gabung/pindah meja, dan reset sesi
            otomatis saat pesanan selesai.
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
              'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-xs font-bold transition-all',
              soundEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 bg-zinc-100 text-zinc-500'
            )}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            <span>{soundEnabled ? 'Audio Ping Aktif' : 'Audio Muted'}</span>
          </button>

          <button
            type="button"
            onClick={loadBoard}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white hover:bg-apple-blue"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Board</span>
          </button>
        </div>
      </div>

      {/* 5-Column Kanban Board */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {KANBAN_COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => col.statuses.includes(o.orderStatus));

          return (
            <div
              key={col.id}
              className="flex min-h-[520px] flex-col rounded-[24px] border border-black/[0.06] bg-white/75 p-3.5 shadow-apple-sm"
            >
              <div className="mb-3 flex items-center justify-between border-b border-black/[0.05] pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', col.dotColor)} />
                    <h2 className="text-xs font-bold tracking-tight text-zinc-950">{col.title}</h2>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-500">{col.subtitle}</p>
                </div>
                <span className="rounded-full bg-[#F5F5F7] px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums text-zinc-800">
                  {colOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-3">
                {colOrders.length === 0 ? (
                  <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-200 text-[11px] text-zinc-400">
                    Tidak ada antrean
                  </div>
                ) : (
                  colOrders.map((order) => {
                    const isHighlighted = highlightedId === order.id;
                    const hasProof =
                      order.paymentStatus === PaymentStatus.PROOF_UPLOADED ||
                      order.receipts.length > 0;

                    return (
                      <article
                        key={order.id}
                        className={cn(
                          'rounded-[20px] border bg-white p-3.5 shadow-apple-sm transition-all',
                          isHighlighted
                            ? 'border-apple-blue ring-2 ring-apple-blue/25'
                            : 'border-black/[0.07]'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-zinc-950">
                              #{order.orderNumber}
                            </span>
                            <p className="text-xs font-bold text-zinc-900">{order.customerName}</p>
                          </div>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-700">
                            {order.tableNumber || order.orderType.replace('_PICKUP', '')}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 border-y border-black/[0.05] py-2 text-[11px] text-zinc-700">
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
                          <p className="mt-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-800">
                            Catatan: {order.specialNotes}
                          </p>
                        )}

                        <div className="mt-2.5 flex items-center justify-between text-xs">
                          <span className="text-[10px] font-semibold text-zinc-500">
                            {order.paymentType === PaymentType.CASH ? 'Cash' : 'QRIS / Transfer'}
                          </span>
                          <span className="font-mono font-bold tabular-nums text-zinc-950">
                            {formatIdr(order.totalAmountIdr)}
                          </span>
                        </div>

                        {/* Column-Specific Action Triggers */}
                        <div className="mt-3 space-y-1.5">
                          {col.id === 'PENDING_STOCK' && (
                            <button
                              type="button"
                              onClick={() => openStockAuditModal(order)}
                              className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Audit Stok & Tagih</span>
                            </button>
                          )}

                          {col.id === 'AWAITING_PAYMENT' && (
                            <>
                              {hasProof ? (
                                <button
                                  type="button"
                                  onClick={() => openReceiptModal(order)}
                                  className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-apple-blue px-3 text-xs font-bold text-white hover:bg-apple-blueHover"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Inspeksi Bukti Bayar</span>
                                </button>
                              ) : order.paymentType === PaymentType.CASH ? (
                                <button
                                  type="button"
                                  disabled={busyId === order.id}
                                  onClick={() => handleAdvanceStatus(order.id, OrderStatus.IN_KITCHEN)}
                                  className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Terima Tunai → Dapur</span>
                                </button>
                              ) : (
                                <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-[10px] font-semibold text-apple-blue">
                                  Menunggu tamu upload bukti QRIS...
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
                              className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-3 text-xs font-bold text-white hover:bg-purple-700"
                            >
                              <BellRing className="h-3.5 w-3.5" />
                              <span>Siap Saji / Kirim</span>
                            </button>
                          )}

                          {col.id === 'READY_DELIVERY' && (
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() => handleAdvanceStatus(order.id, OrderStatus.COMPLETED)}
                              className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              <span>Complete & Reset Meja</span>
                            </button>
                          )}

                          <div className="flex items-center justify-between gap-1 pt-1">
                            {col.id !== 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => openTableControlsModal(order)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#F5F5F7] px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-zinc-200"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                <span>Move / Merge</span>
                              </button>
                            )}
                            <Link
                              href={`/order/${order.id}`}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-apple-blue hover:bg-apple-blue/10"
                            >
                              <span>Track</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Saber Central Automated WhatsApp Gateway Bot Outbound Telemetry Feed */}
      <section className="mt-8 rounded-[26px] border border-black/[0.06] bg-white p-6 shadow-apple-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-950">
                Saber Central Automated WhatsApp Gateway Bot Log
              </h2>
              <p className="text-[11px] text-zinc-500">
                Webhook <code className="font-mono">/api/v1/webhooks/whatsapp</code> • Zero Merchant
                API Configuration
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Gateway Connected
          </span>
        </div>

        <div className="divide-y divide-black/[0.05] text-xs">
          {whatsappLogs.slice(0, 6).map((log) => (
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
                </div>
                <p className="text-xs text-zinc-800">{log.messageBody}</p>
              </div>
              {log.magicLinkUrl && (
                <Link
                  href={log.magicLinkUrl}
                  className="shrink-0 rounded-full border border-zinc-200 bg-[#F5F5F7] px-3 py-1.5 text-[11px] font-bold text-apple-blue hover:bg-apple-blue hover:text-white transition-colors"
                >
                  Open Link
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Modal 1: Partial Stock Confirmation & Line-Item Editing */}
      <dialog
        ref={stockDialogRef}
        aria-labelledby="stock-modal-title"
        className="w-full max-w-lg rounded-[28px] border border-black/10 bg-white p-6 shadow-apple-lg"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Step 2 • Partial Stock Audit
            </span>
            <h3 id="stock-modal-title" className="text-lg font-bold text-zinc-950">
              Konfirmasi Stok #{activeOrder?.orderNumber}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Tutup audit stok"
            onClick={() => stockDialogRef.current?.close()}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <p className="text-xs text-zinc-600">
            Kurangi jumlah atau hapus item jika bahan dapur habis. Total tagihan dihitung ulang
            otomatis sebelum bot mengirim tagihan ke WhatsApp pelanggan.
          </p>

          <div className="divide-y divide-black/[0.06] rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/60 px-4">
            {editableItems.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-zinc-950">{item.itemTitleSnapshot}</p>
                  <p className="font-mono text-[11px] text-zinc-500">
                    {formatIdr(item.unitPriceIdr)} / porsi
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Kurangi porsi"
                    onClick={() => updateEditableItemQty(idx, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono text-xs font-bold tabular-nums">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Tambah porsi"
                    onClick={() => updateEditableItemQty(idx, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-zinc-900 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Hapus item"
                    onClick={() => updateEditableItemQty(idx, -item.quantity)}
                    className="ml-1 rounded-full p-1 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-zinc-950 px-4 py-3 text-white">
            <span className="text-xs font-medium text-zinc-300">Total Tagihan Baru (+Ongkir)</span>
            <span className="font-mono text-base font-bold tabular-nums">
              {formatIdr(editableSubtotal + Number(activeOrder?.deliveryFeeIdr || 0))}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => stockDialogRef.current?.close()}
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={editableItems.length === 0 || busyId === activeOrder?.id}
              onClick={handleConfirmStockAudit}
              className="inline-flex items-center gap-1.5 rounded-full bg-apple-blue px-5 py-2 text-xs font-bold text-white hover:bg-apple-blueHover disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Konfirmasi Stok & Kirim Invoice WA</span>
            </button>
          </div>
        </div>
      </dialog>

      {/* Modal 2: Payment Proof Verification Modal */}
      <dialog
        ref={receiptDialogRef}
        aria-labelledby="receipt-modal-title"
        className="w-full max-w-lg rounded-[28px] border border-black/10 bg-white p-6 shadow-apple-lg"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-apple-blue">
              Step 4 • Payment Proof Audit
            </span>
            <h3 id="receipt-modal-title" className="text-lg font-bold text-zinc-950">
              Verifikasi Bukti #{activeOrder?.orderNumber}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Tutup modal bukti bayar"
            onClick={() => receiptDialogRef.current?.close()}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-[#F5F5F7] px-4 py-3 text-xs">
            <span className="font-semibold text-zinc-600">Expected Order Total</span>
            <span className="font-mono text-base font-bold text-apple-blue">
              {activeOrder ? formatIdr(activeOrder.totalAmountIdr) : '-'}
            </span>
          </div>

          {activeOrder?.receipts[0]?.receiptImageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-zinc-50 p-2">
              <img
                src={activeOrder.receipts[0].receiptImageUrl}
                alt="Uploaded Payment Receipt"
                className="mx-auto max-h-72 rounded-xl object-contain"
              />
            </div>
          ) : (
            <p className="text-center text-xs text-zinc-500">Tidak ada gambar bukti transfer.</p>
          )}

          <div>
            <label htmlFor="rejectReason" className="block text-xs font-semibold text-zinc-700">
              Alasan Penolakan (Jika Reject)
            </label>
            <input
              id="rejectReason"
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Nominal transfer kurang Rp 10.000 / Foto terpotong"
              className="mt-1 min-h-[42px] w-full rounded-xl border border-zinc-200 px-3 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleVerifyReceipt(false)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100"
            >
              <XCircle className="h-4 w-4" />
              <span>Reject Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => handleVerifyReceipt(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-apple-green px-4 text-xs font-bold text-white hover:bg-emerald-600"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Approve Payment → Kitchen</span>
            </button>
          </div>
        </div>
      </dialog>

      {/* Modal 3: Table Management Controls (Move Table & Merge Tables) */}
      <dialog
        ref={tableDialogRef}
        aria-labelledby="table-ctrl-title"
        className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-6 shadow-apple-lg"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
          <h3 id="table-ctrl-title" className="text-base font-bold text-zinc-950">
            Kelola Meja #{activeOrder?.orderNumber}
          </h3>
          <button
            type="button"
            aria-label="Tutup kelola meja"
            onClick={() => tableDialogRef.current?.close()}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {/* Move Table */}
          <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-950">
              <ArrowRightLeft className="h-3.5 w-3.5 text-apple-blue" />
              <span>Move Table (Pindah ke Meja Kosong)</span>
            </p>
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
              className="w-full rounded-full bg-zinc-950 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Pindahkan Meja
            </button>
          </div>

          {/* Merge Tables */}
          <div className="rounded-2xl border border-black/[0.06] bg-[#F5F5F7]/70 p-4 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-zinc-950">
              <Combine className="h-3.5 w-3.5 text-purple-600" />
              <span>Merge Tables (Gabung Tagihan)</span>
            </p>
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
              className="w-full rounded-full bg-purple-600 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Gabung ke Pesanan Tujuan
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

