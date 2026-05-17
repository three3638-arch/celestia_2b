-- 创建商品分组表
CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

-- 创建用户分组访问权限表
CREATE TABLE "user_group_access" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_access_pkey" PRIMARY KEY ("id")
);

-- 添加唯一约束
CREATE UNIQUE INDEX "product_groups_name_key" ON "product_groups"("name");
CREATE UNIQUE INDEX "user_group_access_user_id_group_id_key" ON "user_group_access"("user_id", "group_id");

-- 为 products 表添加 group_id 列
ALTER TABLE "products" ADD COLUMN "group_id" TEXT;

-- 添加外键约束
ALTER TABLE "products" ADD CONSTRAINT "products_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_group_access" ADD CONSTRAINT "user_group_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "product_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_group_access" ADD CONSTRAINT "user_group_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
