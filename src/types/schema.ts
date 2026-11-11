export enum OrderType {
  WALK_IN_TABLE = 'WALK_IN_TABLE',
  PRE_ORDER_PICKUP = 'PRE_ORDER_PICKUP',
  SELF_DELIVERY = 'SELF_DELIVERY',
}

export enum OrderStatus {
  PENDING_STOCK_CONFIRMATION = 'PENDING_STOCK_CONFIRMATION',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAYMENT_PENDING_APPROVAL = 'PAYMENT_PENDING_APPROVAL',
  IN_KITCHEN = 'IN_KITCHEN',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentType {
  CASH = 'CASH',
  BANK_TRANSFER_QRIS = 'BANK_TRANSFER_QRIS',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PROOF_UPLOADED = 'PROOF_UPLOADED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export interface DaySchedule {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface Merchant {
  id: string;
  name: string;
  slug: string;
  email?: string;
  passwordHash?: string;
  passwordSalt?: string;
  ownerName: string;
  ownerWhatsapp: string;
  isStoreOpen: boolean;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicMerchant = Omit<Merchant, 'passwordHash' | 'passwordSalt'>;

export interface PasswordResetRecord {
  merchantId: string;
  otpHash: string;
  expiresAt: string;
}

export interface Branch {
  id: string;
  merchantId: string;
  address: string;
  logoUrl?: string;
  operationalHours: string; // JSON Stringified DaySchedule[]
  isSelfDeliveryEnabled: boolean;
  maxDeliveryRadiusKm: number;
  deliveryFeeIdr: number;
  qrisImageUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountHolder?: string;
}

export interface TableSession {
  id: string;
  branchId: string;
  tableNumber: string;
  qrCodeUrl: string;
  isOccupied: boolean;
  activeOrderId?: string;
  wifiName?: string;
  wifiPassword?: string;
}

export interface Category {
  id: string;
  branchId: string;
  nameId: string;
  nameEn?: string;
  displayOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  titleId: string;
  titleEn?: string;
  descriptionId?: string;
  descriptionEn?: string;
  priceIdr: number;
  imageUrl?: string;
  isSoldOut: boolean;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemTitleSnapshot: string;
  unitPriceIdr: number;
  quantity: number;
  totalPriceIdr: number;
  notes?: string;
}

export interface PaymentReceipt {
  id: string;
  orderId: string;
  receiptImageUrl: string;
  uploadedAt: string;
  verifiedAt?: string;
  verifiedByStaffId?: string;
  rejectionReason?: string;
}

export interface Order {
  id: string;
  branchId: string;
  orderNumber: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  customerName: string;
  customerWhatsapp: string;
  tableNumber?: string;
  deliveryAddress?: string;
  scheduledPickupTime?: string;
  subtotalIdr: number;
  deliveryFeeIdr: number;
  totalAmountIdr: number;
  specialNotes?: string;
  paymentType: PaymentType;
  paymentStatus: PaymentStatus;
  magicToken?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  receipts: PaymentReceipt[];
}

export interface WhatsAppWebhookLog {
  id: string;
  timestamp: string;
  merchantId?: string;
  recipientPhone: string;
  recipientRole: 'MERCHANT' | 'CUSTOMER';
  eventType:
    | 'NEW_ORDER_MAGIC_LINK'
    | 'STOCK_CONFIRMED_INVOICE'
    | 'RECEIPT_UPLOADED'
    | 'PAYMENT_APPROVED_KITCHEN'
    | 'ORDER_READY_SERVED'
    | 'RECEIPT_REJECTED';
  orderNumber: string;
  messageBody: string;
  magicLinkUrl?: string;
  deliveryStatus: 'DISPATCHED' | 'DELIVERED' | 'FAILED';
  providerMessage?: string;
  providerId?: string;
}

