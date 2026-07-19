-- DropIndex
DROP INDEX IF EXISTS "shop_product_variants_variant_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "shop_product_variants_product_id_variant_code_key" ON "shop_product_variants"("product_id", "variant_code");
