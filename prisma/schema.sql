-- Database Schema Definition for PostgreSQL / Neon / Supabase / Saber VPS Postgres

CREATE TYPE order_type_enum AS ENUM ('WALK_IN_TABLE', 'PRE_ORDER_PICKUP', 'SELF_DELIVERY');
CREATE TYPE order_status_enum AS ENUM ('PENDING_STOCK_CONFIRMATION', 'AWAITING_PAYMENT', 'PAYMENT_PENDING_APPROVAL', 'IN_KITCHEN', 'READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED');
CREATE TYPE payment_type_enum AS ENUM ('CASH', 'BANK_TRANSFER_QRIS');
CREATE TYPE payment_status_enum AS ENUM ('UNPAID', 'PROOF_UPLOADED', 'VERIFIED', 'REJECTED');

CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    owner_whatsapp VARCHAR(50) NOT NULL,
    is_store_open BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    logo_url TEXT,
    operational_hours JSONB NOT NULL DEFAULT '{}',
    is_self_delivery_enabled BOOLEAN DEFAULT FALSE,
    max_delivery_radius_km NUMERIC(5,2) DEFAULT 0.00,
    delivery_fee_idr NUMERIC(12,2) DEFAULT 0.00,
    qris_image_url TEXT,
    bank_name VARCHAR(100),
    bank_account_number VARCHAR(100),
    bank_account_holder VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    table_number VARCHAR(50) NOT NULL,
    qr_code_url TEXT NOT NULL,
    is_occupied BOOLEAN DEFAULT FALSE,
    active_order_id UUID,
    UNIQUE(branch_id, table_number)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name_id VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    display_order INT DEFAULT 0
);

CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    title_id VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    description_id TEXT,
    description_en TEXT,
    price_idr NUMERIC(12,2) NOT NULL,
    image_url TEXT,
    is_sold_out BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL,
    order_type order_type_enum NOT NULL,
    order_status order_status_enum NOT NULL DEFAULT 'PENDING_STOCK_CONFIRMATION',
    customer_name VARCHAR(255) NOT NULL,
    customer_whatsapp VARCHAR(50) NOT NULL,
    table_number VARCHAR(50),
    delivery_address TEXT,
    scheduled_pickup_time TIMESTAMP WITH TIME ZONE,
    subtotal_idr NUMERIC(12,2) NOT NULL,
    delivery_fee_idr NUMERIC(12,2) DEFAULT 0.00,
    total_amount_idr NUMERIC(12,2) NOT NULL,
    special_notes TEXT,
    payment_type payment_type_enum NOT NULL,
    payment_status payment_status_enum NOT NULL DEFAULT 'UNPAID',
    magic_token VARCHAR(128) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES menu_items(id),
    item_title_snapshot VARCHAR(255) NOT NULL,
    unit_price_idr NUMERIC(12,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price_idr NUMERIC(12,2) NOT NULL,
    notes TEXT
);

CREATE TABLE payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    receipt_image_url TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by_staff_id VARCHAR(255),
    rejection_reason TEXT
);

-- Indexes for performance optimization
CREATE INDEX idx_merchants_slug ON merchants(slug);
CREATE INDEX idx_orders_branch_status ON orders(branch_id, order_status);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);

