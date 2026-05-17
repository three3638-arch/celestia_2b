-- AlterTable
ALTER TABLE "products" ADD COLUMN     "ali1688_product_id" TEXT,
ADD COLUMN     "ali1688_supplier_id" TEXT;

ALTER TABLE "product_skus" ADD COLUMN     "ali1688_sku_id" TEXT;
