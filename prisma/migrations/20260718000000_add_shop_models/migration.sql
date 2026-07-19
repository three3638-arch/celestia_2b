-- CreateEnum
CREATE TYPE "ShopUserRole" AS ENUM ('SHOP_ADMIN', 'SHOP_EDITOR');

-- CreateEnum
CREATE TYPE "ShopCategoryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ShopProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

-- CreateEnum
CREATE TYPE "ShopStockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER');

-- CreateEnum
CREATE TYPE "ShopInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ShopCustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShopPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ShopShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED');

-- CreateTable
CREATE TABLE "shop_users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "ShopUserRole" NOT NULL DEFAULT 'SHOP_EDITOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ShopCategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_products" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "description_zh" TEXT,
    "description_en" TEXT,
    "description_ar" TEXT,
    "category_id" TEXT NOT NULL,
    "status" "ShopProductStatus" NOT NULL DEFAULT 'DRAFT',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_code" TEXT NOT NULL,
    "name_zh" TEXT,
    "name_en" TEXT,
    "name_ar" TEXT,
    "stock_status" "ShopStockStatus" NOT NULL DEFAULT 'IN_STOCK',
    "list_price" DECIMAL(10,2) NOT NULL,
    "sale_price" DECIMAL(10,2),
    "sale_start_at" TIMESTAMP(3),
    "sale_end_at" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_inquiries" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "list_price_snapshot" DECIMAL(10,2) NOT NULL,
    "current_price_snapshot" DECIMAL(10,2) NOT NULL,
    "status" "ShopInquiryStatus" NOT NULL DEFAULT 'NEW',
    "admin_note" TEXT,
    "converted_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_customers" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "name" TEXT,
    "status" "ShopCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_carts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "session_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_orders" (
    "id" TEXT NOT NULL,
    "order_no" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "shipping_address_json" JSONB,
    "note" TEXT,
    "paid_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "product_title_snapshot" TEXT NOT NULL,
    "variant_desc_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "list_price_snapshot" DECIMAL(10,2) NOT NULL,
    "sale_price_snapshot" DECIMAL(10,2),
    "unit_price_snapshot" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "provider_ref" TEXT,
    "status" "ShopPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_shipments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tracking_no" TEXT,
    "carrier" TEXT,
    "status" "ShopShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shop_users_phone_key" ON "shop_users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "shop_categories_slug_key" ON "shop_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "shop_products_slug_key" ON "shop_products"("slug");

-- CreateIndex
CREATE INDEX "shop_products_category_id_idx" ON "shop_products"("category_id");

-- CreateIndex
CREATE INDEX "shop_products_status_idx" ON "shop_products"("status");

-- CreateIndex
CREATE INDEX "shop_product_images_product_id_idx" ON "shop_product_images"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_product_variants_variant_code_key" ON "shop_product_variants"("variant_code");

-- CreateIndex
CREATE INDEX "shop_product_variants_product_id_idx" ON "shop_product_variants"("product_id");

-- CreateIndex
CREATE INDEX "shop_inquiries_product_id_idx" ON "shop_inquiries"("product_id");

-- CreateIndex
CREATE INDEX "shop_inquiries_status_idx" ON "shop_inquiries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shop_customers_phone_key" ON "shop_customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "shop_customers_email_key" ON "shop_customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "shop_cart_items_cart_id_variant_id_key" ON "shop_cart_items"("cart_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_orders_order_no_key" ON "shop_orders"("order_no");

-- CreateIndex
CREATE INDEX "shop_orders_customer_id_idx" ON "shop_orders"("customer_id");

-- CreateIndex
CREATE INDEX "shop_orders_status_idx" ON "shop_orders"("status");

-- CreateIndex
CREATE INDEX "shop_order_items_order_id_idx" ON "shop_order_items"("order_id");

-- CreateIndex
CREATE INDEX "shop_payments_order_id_idx" ON "shop_payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_shipments_order_id_key" ON "shop_shipments"("order_id");

-- AddForeignKey
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "shop_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_product_images" ADD CONSTRAINT "shop_product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_product_variants" ADD CONSTRAINT "shop_product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_inquiries" ADD CONSTRAINT "shop_inquiries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "shop_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_inquiries" ADD CONSTRAINT "shop_inquiries_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "shop_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_carts" ADD CONSTRAINT "shop_carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shop_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_cart_items" ADD CONSTRAINT "shop_cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "shop_carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_cart_items" ADD CONSTRAINT "shop_cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "shop_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "shop_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "shop_product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_payments" ADD CONSTRAINT "shop_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_shipments" ADD CONSTRAINT "shop_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
