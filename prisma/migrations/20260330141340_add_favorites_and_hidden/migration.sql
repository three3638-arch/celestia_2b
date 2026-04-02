-- CreateTable
CREATE TABLE "product_favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_hidden" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_hidden_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_favorites_user_id_idx" ON "product_favorites"("user_id");

-- CreateIndex
CREATE INDEX "product_favorites_product_id_idx" ON "product_favorites"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_favorites_user_id_product_id_key" ON "product_favorites"("user_id", "product_id");

-- CreateIndex
CREATE INDEX "product_hidden_user_id_idx" ON "product_hidden"("user_id");

-- CreateIndex
CREATE INDEX "product_hidden_product_id_idx" ON "product_hidden"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_hidden_user_id_product_id_key" ON "product_hidden"("user_id", "product_id");

-- AddForeignKey
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_favorites" ADD CONSTRAINT "product_favorites_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_hidden" ADD CONSTRAINT "product_hidden_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_hidden" ADD CONSTRAINT "product_hidden_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
