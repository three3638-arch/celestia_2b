# Celestia Jewelry - B2B 外贸电商平台技术设计文档

> 版本: v1.0 | 最后更新: 2026-03-28 | 状态: **已确认**
> 
> 关联文档：[业务蓝图 v1.2](./business-blueprint.md)

---

## 一、技术选型总览

### 1.1 核心技术栈

| 分类 | 选型 | 版本 | 选型理由 |
|------|------|------|---------|
| **框架** | Next.js (App Router) | 15.x | 全栈单应用，SSR + Server Actions + Route Handlers，减少前后端分离带来的维护成本 |
| **语言** | TypeScript | 5.x | 全栈类型安全，配合 Prisma 生成类型 |
| **ORM** | Prisma | 6.x | Schema-first，自动迁移，生成 TypeScript 类型，AI Agent 友好 |
| **数据库** | PostgreSQL | 16 | 成熟稳定，支持数组类型（gem_types）、Decimal精度、全文搜索 |
| **UI 组件** | shadcn/ui + Tailwind CSS | 4.x | 组件代码本地化可改，天然支持 RTL（基于 Radix），黑金主题定制方便 |
| **认证** | jose + bcryptjs | - | 轻量级 JWT 方案，仅手机号+密码登录，无需 NextAuth 的 OAuth 复杂度 |
| **国际化** | next-intl | 4.x | URL 前缀路由，RSC 支持，RTL 检测 |

### 1.2 工具库

| 用途 | 选型 | 说明 |
|------|------|------|
| Excel 解析 | ExcelJS | 支持嵌入图片（drawings）提取，xlsx 读写 |
| 精度计算 | decimal.js | 价格计算避免浮点误差，支持向上取整到 1 位小数 |
| 图片处理 | sharp | webp 转换、压缩、缩略图生成 |
| 对象存储 | @aws-sdk/client-s3 | 连接 Cloudflare R2（S3 兼容 API） |
| AI 翻译 | @alicloud/alimt20181012 | 阿里云机器翻译，zh→en / zh→ar |
| 状态管理 | zustand | 购物车等客户端状态，轻量无 boilerplate |

### 1.3 基础设施

| 组件 | 选型 | 说明 |
|------|------|------|
| 服务器 | 阿里云 ECS | 4C8G，杭州地域 |
| 对象存储 | Cloudflare R2 | S3 兼容，无出口流量费 |
| CDN / DNS | Cloudflare | DNS 托管 + CDN + SSL |
| 容器化 | Docker + Docker Compose | 一键编排 app + db + nginx |

---

## 二、项目结构

```
celestia/
├── docker/                            # Docker 部署配置
│   ├── nginx/
│   │   ├── nginx.conf                 # Nginx 反向代理 + gzip + 缓存
│   │   └── certs/                     # Cloudflare Origin Certificate
│   │       ├── origin.pem
│   │       └── origin-key.pem
│   └── db/
│       └── backup.sh                  # PostgreSQL 定时备份脚本
│
├── prisma/
│   ├── schema.prisma                  # 数据模型定义
│   ├── migrations/                    # 迁移文件（自动生成）
│   └── seed.ts                        # 种子数据（品类 + 管理员账号）
│
├── src/
│   ├── app/
│   │   ├── [locale]/                  # next-intl 语言路由 (en / ar / zh)
│   │   │   ├── (storefront)/          # 客户端路由组（Mobile-first）
│   │   │   │   ├── products/          # 商品列表 / 商品详情
│   │   │   │   │   ├── page.tsx           # 商品列表页（无限滚动）
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx       # 商品详情页（SKU选择器）
│   │   │   │   ├── cart/
│   │   │   │   │   └── page.tsx           # 购物车
│   │   │   │   ├── orders/
│   │   │   │   │   ├── page.tsx           # 订单列表（状态Tab）
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx       # 订单详情 + 结算对比
│   │   │   │   ├── profile/
│   │   │   │   │   └── page.tsx           # 个人中心
│   │   │   │   └── layout.tsx             # 客户端布局（底部Tab导航）
│   │   │   ├── (auth)/                # 认证路由组
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── pending/
│   │   │   │       └── page.tsx           # 等待审核页
│   │   │   └── layout.tsx                 # 语言根布局（locale provider + dir）
│   │   │
│   │   ├── admin/                     # 管理后台（固定中文，不走 locale）
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx               # 仪表盘
│   │   │   ├── products/
│   │   │   │   ├── page.tsx               # 商品列表
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx           # 商品编辑
│   │   │   │   └── import/
│   │   │   │       └── page.tsx           # Excel 导入（上传→预览→确认）
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx               # 订单列表（含毛利列）
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx           # 订单详情（报价/付款/物流/结算）
│   │   │   │   └── [id]/
│   │   │   │       ├── quote/
│   │   │   │       │   └── page.tsx       # 报价页面
│   │   │   │       └── settlement/
│   │   │   │           └── page.tsx       # 结算页面
│   │   │   ├── customers/
│   │   │   │   └── page.tsx               # 客户管理（审核 + 加价比例）
│   │   │   └── layout.tsx                 # 管理端布局（侧边栏导航）
│   │   │
│   │   ├── api/                       # Route Handlers
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── register/route.ts
│   │   │   │   └── logout/route.ts
│   │   │   └── upload/
│   │   │       ├── image/route.ts         # 单图上传到 R2
│   │   │       └── excel/route.ts         # Excel 文件上传
│   │   │
│   │   ├── layout.tsx                 # 根布局
│   │   └── not-found.tsx
│   │
│   ├── actions/                       # Server Actions
│   │   ├── auth.ts                        # 认证相关 action
│   │   ├── products.ts                    # 商品 CRUD
│   │   ├── orders.ts                      # 订单生命周期
│   │   ├── cart.ts                        # 购物车操作
│   │   ├── customers.ts                   # 客户管理
│   │   ├── payments.ts                    # 付款记录
│   │   ├── shipping.ts                    # 物流信息
│   │   ├── import.ts                      # Excel 导入流水线
│   │   └── settlement.ts                  # 结算操作
│   │
│   ├── lib/                           # 核心工具库
│   │   ├── db.ts                          # Prisma Client 单例
│   │   ├── auth.ts                        # JWT 签发 / 验证 / 中间件
│   │   ├── r2.ts                          # R2 上传 / URL 生成
│   │   ├── translate.ts                   # 阿里云翻译封装
│   │   ├── pricing.ts                     # 三层定价引擎（decimal.js）
│   │   ├── excel-parser.ts                # Excel 解析 + 图片提取
│   │   ├── order-machine.ts               # 订单状态机
│   │   └── constants.ts                   # 枚举 / 常量定义
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui 组件（本地化）
│   │   ├── storefront/                # 客户端业务组件
│   │   │   ├── product-card.tsx
│   │   │   ├── product-grid.tsx
│   │   │   ├── sku-selector.tsx
│   │   │   ├── cart-item.tsx
│   │   │   ├── order-card.tsx
│   │   │   ├── order-status-badge.tsx
│   │   │   ├── price-display.tsx          # 参考价展示（区间/面议）
│   │   │   ├── bottom-nav.tsx
│   │   │   └── language-switcher.tsx
│   │   └── admin/                     # 管理端业务组件
│   │       ├── sidebar.tsx
│   │       ├── data-table.tsx
│   │       ├── quote-form.tsx             # 报价表单
│   │       ├── settlement-panel.tsx       # 结算面板
│   │       ├── profit-card.tsx            # 毛利卡片
│   │       ├── import-preview.tsx         # 导入预览
│   │       └── customer-approve-dialog.tsx # 审核弹窗(含加价比例)
│   │
│   ├── hooks/
│   │   ├── use-infinite-scroll.ts
│   │   └── use-auth.ts
│   │
│   ├── stores/                        # Zustand 状态
│   │   └── cart.ts                        # 购物车 store
│   │
│   ├── i18n/
│   │   ├── request.ts                     # next-intl 请求配置
│   │   ├── routing.ts                     # 路由配置
│   │   └── messages/
│   │       ├── en.json                    # 英文
│   │       ├── ar.json                    # 阿拉伯文
│   │       └── zh.json                    # 中文
│   │
│   ├── middleware.ts                  # 认证 + 语言 + 权限中间件
│   └── types/                         # 全局类型定义
│       └── index.ts
│
├── public/
│   └── assets/                        # Logo 等静态资源
│
├── Dockerfile                         # 多阶段构建
├── docker-compose.yml                 # 生产编排：app + db + nginx
├── docker-compose.dev.yml             # 开发覆盖：热更新 + 本地 DB
├── .env.example                       # 环境变量模板
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 三、数据库 Schema

### 3.1 完整 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// 枚举定义
// ============================================================

enum UserRole {
  ADMIN
  CUSTOMER
}

enum UserStatus {
  PENDING   // 待审核
  ACTIVE    // 已激活
}

enum ProductStatus {
  ACTIVE    // 上架
  INACTIVE  // 下架
}

enum StockStatus {
  IN_STOCK      // 有货
  OUT_OF_STOCK  // 缺货
  PRE_ORDER     // 预订
}

enum GemType {
  MOISSANITE  // 莫桑石
  ZIRCON      // 锆石
}

enum MetalColor {
  SILVER     // 银色
  GOLD       // 金色
  ROSE_GOLD  // 玫瑰金
  OTHER      // 其他
}

enum CategorySlug {
  RING       // 戒指
  NECKLACE   // 项链
  BRACELET   // 手链/手镯
  EARRING    // 耳钉/耳环
  OTHER      // 其他
}

enum OrderStatus {
  PENDING_QUOTE    // 待报价
  QUOTED           // 已报价
  NEGOTIATING      // 协商中
  CONFIRMED        // 已确认
  PARTIALLY_PAID   // 部分付款
  FULLY_PAID       // 已付清
  SHIPPED          // 已发货
  SETTLING         // 结算中
  COMPLETED        // 已完成
  CANCELLED        // 已取消
}

enum OrderItemStatus {
  PENDING_QUOTE    // 待报价
  QUOTED           // 已报价
  OUT_OF_STOCK     // 缺货
  CUSTOMER_REMOVED // 客户移除
  CONFIRMED        // 已确认
  RETURNED         // 退货
  QTY_ADJUSTED     // 数量调整
}

enum PaymentMethod {
  BANK_TRANSFER    // 银行转账
  WESTERN_UNION    // Western Union
  CASH             // 现金
  OTHER            // 其他
}

enum ShippingMethod {
  SEA_FREIGHT      // 海运
  AIR_FREIGHT      // 空运
  EXPRESS          // 快递
}

// ============================================================
// 数据模型
// ============================================================

/// 用户（管理员 / 客户）
model User {
  id            String     @id @default(cuid())
  name          String
  phone         String     @unique
  passwordHash  String     @map("password_hash")
  role          UserRole   @default(CUSTOMER)
  status        UserStatus @default(PENDING)
  markupRatio   Decimal    @default(1.15) @map("markup_ratio") @db.Decimal(4, 2)
  createdAt     DateTime   @default(now()) @map("created_at")
  updatedAt     DateTime   @updatedAt @map("updated_at")

  orders        Order[]

  @@map("users")
}

/// 品类
model Category {
  id       String       @id @default(cuid())
  slug     CategorySlug @unique
  nameZh   String       @map("name_zh")
  nameEn   String       @map("name_en")
  nameAr   String       @map("name_ar")
  sortOrder Int         @default(0) @map("sort_order")

  products Product[]

  @@map("categories")
}

/// 商品（SPU - 款式）
model Product {
  id              String        @id @default(cuid())
  spuCode         String        @unique @map("spu_code")
  nameZh          String?       @map("name_zh")
  nameEn          String?       @map("name_en")
  nameAr          String?       @map("name_ar")
  categoryId      String        @map("category_id")
  descZh          String?       @map("desc_zh") @db.Text
  descEn          String?       @map("desc_en") @db.Text
  descAr          String?       @map("desc_ar") @db.Text
  refPriceMinSar  Decimal?      @map("ref_price_min_sar") @db.Decimal(10, 2)
  refPriceMaxSar  Decimal?      @map("ref_price_max_sar") @db.Decimal(10, 2)
  gemTypes        GemType[]     @map("gem_types")
  status          ProductStatus @default(ACTIVE)
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  category        Category       @relation(fields: [categoryId], references: [id])
  skus            ProductSku[]
  images          ProductImage[]

  @@index([categoryId])
  @@index([status])
  @@map("products")
}

/// 商品 SKU（规格）
model ProductSku {
  id              String      @id @default(cuid())
  productId       String      @map("product_id")
  skuCode         String      @unique @map("sku_code")
  gemType         GemType     @map("gem_type")
  metalColor      MetalColor  @map("metal_color")
  size            String?                               // 戒指尺码
  length          String?                               // 链长度(cm)
  refPriceMinSar  Decimal?    @map("ref_price_min_sar") @db.Decimal(10, 2)
  refPriceMaxSar  Decimal?    @map("ref_price_max_sar") @db.Decimal(10, 2)
  stockStatus     StockStatus @default(IN_STOCK) @map("stock_status")
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")

  product         Product     @relation(fields: [productId], references: [id], onDelete: Cascade)
  orderItems      OrderItem[]

  @@index([productId])
  @@map("product_skus")
}

/// 商品图片
model ProductImage {
  id         String  @id @default(cuid())
  productId  String  @map("product_id")
  url        String
  isPrimary  Boolean @default(false) @map("is_primary")
  sortOrder  Int     @default(0) @map("sort_order")

  product    Product @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("product_images")
}

/// 订单
model Order {
  id                  String      @id @default(cuid())
  orderNo             String      @unique @map("order_no")
  customerId          String      @map("customer_id")
  status              OrderStatus @default(PENDING_QUOTE)
  exchangeRate        Decimal?    @map("exchange_rate") @db.Decimal(8, 4)    // CNY → SAR
  markupRatio         Decimal?    @map("markup_ratio") @db.Decimal(4, 2)     // 本次加价比例
  quotedAt            DateTime?   @map("quoted_at")
  totalCny            Decimal?    @map("total_cny") @db.Decimal(12, 2)       // 成本总价
  totalSar            Decimal?    @map("total_sar") @db.Decimal(12, 2)       // 客户总价
  overrideTotalSar    Decimal?    @map("override_total_sar") @db.Decimal(12, 2)  // 手动覆盖
  shippingCostCny     Decimal?    @map("shipping_cost_cny") @db.Decimal(10, 2)   // 运费(CNY)
  settlementTotalCny  Decimal?    @map("settlement_total_cny") @db.Decimal(12, 2)
  settlementTotalSar  Decimal?    @map("settlement_total_sar") @db.Decimal(12, 2)
  settlementNote      String?     @map("settlement_note") @db.Text
  notes               String?     @db.Text
  createdAt           DateTime    @default(now()) @map("created_at")
  updatedAt           DateTime    @updatedAt @map("updated_at")

  customer            User        @relation(fields: [customerId], references: [id])
  items               OrderItem[]
  payments            Payment[]
  shipping            Shipping?

  @@index([customerId])
  @@index([status])
  @@index([createdAt])
  @@map("orders")
}

/// 订单项
model OrderItem {
  id                  String          @id @default(cuid())
  orderId             String          @map("order_id")
  skuId               String          @map("sku_id")
  quantity            Int
  unitPriceCny        Decimal?        @map("unit_price_cny") @db.Decimal(10, 2)   // 成本价
  unitPriceSar        Decimal?        @map("unit_price_sar") @db.Decimal(10, 2)   // 客户价
  itemStatus          OrderItemStatus @default(PENDING_QUOTE) @map("item_status")
  settlementQty       Int?            @map("settlement_qty")                       // 结算数量
  settlementPriceCny  Decimal?        @map("settlement_price_cny") @db.Decimal(10, 2) // 结算单价

  order               Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  sku                 ProductSku      @relation(fields: [skuId], references: [id])

  @@index([orderId])
  @@map("order_items")
}

/// 付款记录
model Payment {
  id           String        @id @default(cuid())
  orderId      String        @map("order_id")
  amountSar    Decimal       @map("amount_sar") @db.Decimal(12, 2)
  method       PaymentMethod
  proofUrl     String?       @map("proof_url")
  note         String?       @db.Text
  confirmedAt  DateTime      @default(now()) @map("confirmed_at")

  order        Order         @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
  @@map("payments")
}

/// 物流信息（1:1 关联订单）
model Shipping {
  id           String         @id @default(cuid())
  orderId      String         @unique @map("order_id")
  trackingNo   String?        @map("tracking_no")
  trackingUrl  String?        @map("tracking_url")
  method       ShippingMethod?
  note         String?        @db.Text
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  order        Order          @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("shippings")
}
```

### 3.2 种子数据

```typescript
// prisma/seed.ts — 初始化品类 + 默认管理员账号

const categories = [
  { slug: 'RING',     nameZh: '戒指',       nameEn: 'Ring',      nameAr: 'خاتم',    sortOrder: 1 },
  { slug: 'NECKLACE', nameZh: '项链',       nameEn: 'Necklace',  nameAr: 'قلادة',    sortOrder: 2 },
  { slug: 'BRACELET', nameZh: '手链/手镯',  nameEn: 'Bracelet',  nameAr: 'سوار',     sortOrder: 3 },
  { slug: 'EARRING',  nameZh: '耳钉/耳环',  nameEn: 'Earring',   nameAr: 'قرط',      sortOrder: 4 },
  { slug: 'OTHER',    nameZh: '其他',       nameEn: 'Other',     nameAr: 'أخرى',     sortOrder: 5 },
];

const adminUser = {
  name: 'Admin',
  phone: '管理员手机号',  // 部署时替换
  passwordHash: '...',    // bcrypt hash
  role: 'ADMIN',
  status: 'ACTIVE',
  markupRatio: 1.00,
};
```

### 3.3 索引策略

| 模型 | 索引 | 类型 | 用途 |
|------|------|------|------|
| User | phone | unique | 登录查询 |
| Product | spu_code | unique | SPU 编号查询 |
| Product | category_id | index | 品类筛选 |
| Product | status | index | 上下架筛选 |
| ProductSku | sku_code | unique | SKU 编号查询 |
| ProductSku | product_id | index | SPU 下的 SKU 列表 |
| ProductImage | product_id | index | SPU 下的图片列表 |
| Order | order_no | unique | 订单号查询 |
| Order | customer_id | index | 客户的订单列表 |
| Order | status | index | 按状态筛选 |
| Order | created_at | index | 按时间排序 |
| OrderItem | order_id | index | 订单下的商品列表 |
| Payment | order_id | index | 订单的付款记录 |

---

## 四、API / Server Actions 设计

### 4.1 设计原则

- **Server Actions**：用于绝大多数表单提交和数据变更操作（Next.js RSC 直接调用，无需手写 API）
- **Route Handlers**：仅用于需要精细控制 HTTP 响应的场景（认证 cookie、文件上传 stream）
- **认证**：所有接口通过 `middleware.ts` 拦截，JWT 存于 httpOnly cookie
- **权限**：在 Server Action / Route Handler 内部校验 `user.role` 和 `user.status`

### 4.2 认证模块（Route Handlers）

```
POST /api/auth/register
  Body: { name, phone, password }
  Response: { success: true }
  → 创建 User (status=PENDING)

POST /api/auth/login
  Body: { phone, password }
  Response: Set-Cookie (JWT httpOnly) + { user: { id, name, role, status } }
  → 校验密码 → 签发 JWT → 写入 cookie

POST /api/auth/logout
  Response: Clear-Cookie
```

### 4.3 商品模块（Server Actions）

```typescript
// --- 客户端 ---

getProducts(params: {
  categorySlug?: CategorySlug;
  gemType?: GemType;
  metalColor?: MetalColor;
  search?: string;
  cursor?: string;        // 游标分页
  limit?: number;         // 默认 20
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
}): Promise<{ products: ProductWithImage[]; nextCursor?: string }>

getProductDetail(params: {
  productId: string;
  locale: 'en' | 'ar' | 'zh';
}): Promise<ProductDetail>  // 含 SKU 列表 + 图片 + 参考价(已乘加价比例)

// --- 管理端 ---

createProduct(data: ProductCreateInput): Promise<Product>
updateProduct(id: string, data: ProductUpdateInput): Promise<Product>
toggleProductStatus(id: string): Promise<Product>    // 上架 ↔ 下架
deleteProduct(id: string): Promise<void>
```

### 4.4 Excel 导入模块

```
POST /api/upload/excel                       (Route Handler)
  Body: FormData { file: .xlsx }
  Response: { taskId: string }
  → 保存文件到临时目录，返回 taskId

parseExcelTask(taskId: string)               (Server Action)
  → 三阶段流水线（见第五章 5.1 节）
  → 解析 → 提取图片 → 上传 R2 → AI翻译 → 笛卡尔积展开
  → 结果写入临时 JSON 文件

getImportPreview(taskId: string)             (Server Action)
  → 返回抽样预览（前 5~10 个 SPU）+ 统计摘要

confirmImport(taskId: string)                (Server Action)
  → Prisma 事务: createMany Products + ProductSkus + ProductImages
  → 清理临时文件
```

### 4.5 订单模块（Server Actions）

```typescript
// --- 客户操作 ---

createOrder(params: {
  items: { skuId: string; quantity: number }[];
  notes?: string;
}): Promise<Order>
// → 生成 order_no (格式: CJ-{YYYYMMDD}-{4位序号})
// → 状态: PENDING_QUOTE

customerUpdateOrder(orderId: string, changes: {
  addItems?: { skuId: string; quantity: number }[];
  removeItemIds?: string[];
  updateItems?: { itemId: string; quantity: number }[];
}): Promise<Order>
// → 状态校验: 必须在 QUOTED 状态
// → 操作后状态变为 NEGOTIATING

confirmOrder(orderId: string): Promise<Order>
// → 客户确认报价, 状态 → CONFIRMED

cancelOrder(orderId: string): Promise<Order>
// → 权限校验: 有付款记录时仅管理员可操作

// --- 管理员操作 ---

submitQuote(orderId: string, data: {
  items: { itemId: string; unitPriceCny: Decimal; itemStatus: 'QUOTED' | 'OUT_OF_STOCK' }[];
  exchangeRate: Decimal;
  markupRatio: Decimal;
}): Promise<Order>
// → 自动计算每项 SAR 价格 (CNY × markupRatio × exchangeRate, 向上取整1位)
// → 计算总价, 状态 → QUOTED

adjustOrderBeforePayment(orderId: string, data: {
  exchangeRate?: Decimal;
  markupRatio?: Decimal;
  overrideTotalSar?: Decimal;
}): Promise<Order>
// → 付款前管理员可调整汇率/加价/总金额

updateOrderStatus(orderId: string, targetStatus: OrderStatus): Promise<Order>
// → 状态机校验合法性
```

### 4.6 结算模块（Server Actions）

```typescript
getSettlementDetail(orderId: string): Promise<SettlementDetail>
// → 返回订单项列表 + 原报价信息 + 当前结算编辑数据

updateSettlement(orderId: string, data: {
  items: {
    itemId: string;
    action: 'keep' | 'return' | 'adjust_qty';
    settlementQty?: number;
    settlementPriceCny?: Decimal;
  }[];
  settlementNote?: string;
}): Promise<Order>
// → 更新各项结算数据, 自动计算 settlementTotalCny / settlementTotalSar

confirmSettlement(orderId: string): Promise<Order>
// → 状态 → COMPLETED, 锁定结算数据
```

### 4.7 付款 / 物流模块（Server Actions）

```typescript
addPayment(orderId: string, data: {
  amountSar: Decimal;
  method: PaymentMethod;
  proofUrl?: string;
  note?: string;
}): Promise<Payment>
// → 自动判断: 累计付款 >= totalSar ? FULLY_PAID : PARTIALLY_PAID

addShipping(orderId: string, data: {
  trackingNo?: string;
  trackingUrl?: string;
  method?: ShippingMethod;
  shippingCostCny?: Decimal;
  note?: string;
}): Promise<Shipping>
// → 状态 → SHIPPED
// → 若同时满足 SHIPPED + FULLY_PAID，允许进入 SETTLING
```

### 4.8 客户管理模块（Server Actions）

```typescript
getCustomers(params: {
  status?: UserStatus;
  search?: string;
  page?: number;
}): Promise<{ customers: User[]; total: number }>

approveCustomer(userId: string, markupRatio: Decimal): Promise<User>
// → status → ACTIVE, 设置加价比例（必填，默认 1.15）

updateMarkupRatio(userId: string, markupRatio: Decimal): Promise<User>
// → 修改客户加价比例
```

### 4.9 图片上传（Route Handler）

```
POST /api/upload/image
  Body: FormData { file: image/* }
  Response: { url: string, thumbnailUrl: string }
  → sharp 压缩转 webp + 生成缩略图
  → 上传到 R2
  → 返回公开 URL
```

---

## 五、关键技术方案

### 5.1 Excel 导入流水线

整个导入分三个阶段，对大数据量（数千 SPU）进行渐进处理：

```
[阶段一：上传与解析]
  │
  │  ExcelJS 读取 workbook
  │  遍历 worksheet.drawings → 按 row/col 位置匹配到对应 SPU
  │  区分 B 列（首图，is_primary=true）和 L+ 列（其他图片）
  │  解析文本列（A~K）
  │
  ↓
[阶段二：处理]
  │
  │  图片处理（并行）:
  │    每张图 → sharp 转 webp + 压缩(质量80) + 缩略图(400px宽)
  │    → @aws-sdk PutObject 上传到 R2
  │    → 存储路径: products/{spuCode}/{index}.webp
  │
  │  AI 翻译（批量）:
  │    收集所有非空的 name_zh + desc_zh
  │    按 5000 字符上限合并，用 \n---\n 分隔
  │    调用阿里云 alimt: TranslateGeneral(zh→en), TranslateGeneral(zh→ar)
  │    按分隔符拆分回对应 SPU
  │
  │  SKU 展开:
  │    对每行 SPU: 解析逗号分隔的 gem_types, metal_colors, sizes, lengths
  │    笛卡尔积组合生成 SKU 列表
  │    按规则生成 sku_code: {spuCode}-{GEM}-{METAL}-{SIZE/LEN}
  │
  ↓
[阶段三：预览与确认]
  │
  │  抽样展示前 5~10 个 SPU 的完整信息
  │  显示统计摘要: X 个 SPU, Y 个 SKU, Z 张图片
  │  用户确认后:
  │    Prisma 事务内 createMany → Product + ProductSku + ProductImage
  │    清理临时文件
```

**ExcelJS 图片匹配逻辑：**

```typescript
// ExcelJS 的 drawings 通过 tl (top-left anchor) 定位图片在哪个单元格
// tl.nativeRow → 行号, tl.nativeCol → 列号
// B列 (col=1) → 首图, L列及之后 (col>=11) → 其他图片

for (const image of worksheet.getImages()) {
  const drawing = workbook.model.media[image.imageId];
  const row = image.range.tl.nativeRow;  // 0-based
  const col = image.range.tl.nativeCol;  // 0-based, B=1
  const isPrimary = col === 1;
  // buffer: drawing.buffer, type: drawing.type
}
```

### 5.2 Cloudflare R2 图片存储

```typescript
// src/lib/r2.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function uploadImage(
  buffer: Buffer,
  key: string,          // e.g. "products/CJ-NK-001/0.webp"
  contentType = 'image/webp'
): Promise<string> {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
```

**图片处理流程：**

```
原图 (JPEG/PNG, 嵌入Excel)
  → sharp: resize(maxWidth=1600) + webp(quality=80)  → 上传为 {key}.webp
  → sharp: resize(width=400) + webp(quality=70)       → 上传为 {key}_thumb.webp
```

### 5.3 阿里云机器翻译

```typescript
// src/lib/translate.ts

import Alimt20181012 from '@alicloud/alimt20181012';
import * as OpenApi from '@alicloud/openapi-client';

const client = new Alimt20181012(new OpenApi.Config({
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  endpoint: 'mt.aliyuncs.com',
}));

const SEPARATOR = '\n---\n';
const MAX_CHARS = 5000;

/**
 * 批量翻译：合并多条文本，减少 API 调用次数
 * 输入: ['星辰吊坠项链', '永恒之环戒指', ...]
 * 输出: { en: ['Starlight Pendant Necklace', ...], ar: ['...', ...] }
 */
async function batchTranslate(texts: string[]): Promise<{ en: string[]; ar: string[] }> {
  const batches = splitIntoBatches(texts, MAX_CHARS, SEPARATOR);
  const results = { en: [] as string[], ar: [] as string[] };

  for (const batch of batches) {
    const merged = batch.join(SEPARATOR);
    const [enResult, arResult] = await Promise.all([
      client.translateGeneral({ sourceLanguage: 'zh', targetLanguage: 'en', sourceText: merged, formatType: 'text' }),
      client.translateGeneral({ sourceLanguage: 'zh', targetLanguage: 'ar', sourceText: merged, formatType: 'text' }),
    ]);
    results.en.push(...enResult.body.data.translated.split(SEPARATOR));
    results.ar.push(...arResult.body.data.translated.split(SEPARATOR));
  }

  return results;
}
```

### 5.4 国际化 + RTL

**路由结构：**

```
/en/products          → 英文客户端
/ar/products          → 阿拉伯文客户端 (RTL)
/zh/products          → 中文客户端
/admin/dashboard      → 管理后台（固定中文，不走 locale 路由）
```

**RTL 实现：**

```tsx
// src/app/[locale]/layout.tsx

import { getLocale } from 'next-intl/server';

export default async function LocaleLayout({ children }) {
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

**Tailwind CSS 逻辑属性：**

```css
/* 用 ms-/me-/ps-/pe- 代替 ml-/mr-/pl-/pr- */
/* Tailwind CSS 4 原生支持 */

.nav-item {
  @apply ms-4 ps-2;  /* margin-inline-start / padding-inline-start */
}
```

### 5.5 三层定价引擎

```typescript
// src/lib/pricing.ts

import Decimal from 'decimal.js';

/**
 * 计算客户价格（SAR）
 * 公式: costCny × markupRatio × exchangeRate
 * 结果: 保留1位小数，向上取整 (如 45.123 → 45.2)
 */
export function calcCustomerPrice(
  costCny: Decimal.Value,
  markupRatio: Decimal.Value,
  exchangeRate: Decimal.Value
): Decimal {
  return new Decimal(costCny)
    .mul(markupRatio)
    .mul(exchangeRate)
    .toDecimalPlaces(1, Decimal.ROUND_CEIL);
}

/**
 * 计算参考价展示值（客户浏览商品时）
 * = SPU 参考价 × 客户加价比例
 */
export function calcDisplayRefPrice(
  refPrice: Decimal.Value | null,
  markupRatio: Decimal.Value
): Decimal | null {
  if (refPrice === null) return null;
  return new Decimal(refPrice)
    .mul(markupRatio)
    .toDecimalPlaces(1, Decimal.ROUND_CEIL);
}

/**
 * 参考价展示格式
 */
export function formatRefPrice(min: Decimal | null, max: Decimal | null): string {
  if (min && max) return `SAR ${min}~${max}`;
  if (min) return `SAR ${min} 起`;        // From SAR X
  if (max) return `最高 SAR ${max}`;      // Up to SAR X
  return '价格面议';                       // Price on Request
}

/**
 * 计算订单总价
 */
export function calcOrderTotals(
  items: { unitPriceCny: Decimal; quantity: number }[],
  markupRatio: Decimal.Value,
  exchangeRate: Decimal.Value
): { totalCny: Decimal; totalSar: Decimal } {
  let totalCny = new Decimal(0);
  let totalSar = new Decimal(0);

  for (const item of items) {
    const lineCny = new Decimal(item.unitPriceCny).mul(item.quantity);
    const lineSar = calcCustomerPrice(item.unitPriceCny, markupRatio, exchangeRate)
      .mul(item.quantity);
    totalCny = totalCny.add(lineCny);
    totalSar = totalSar.add(lineSar);
  }

  return { totalCny, totalSar };
}

/**
 * 预估毛利 = 成本总价(CNY) × (加价比例 - 1) - 运费(CNY)
 */
export function calcEstimatedProfit(
  totalCny: Decimal.Value,
  markupRatio: Decimal.Value,
  shippingCostCny: Decimal.Value = 0
): Decimal {
  return new Decimal(totalCny)
    .mul(new Decimal(markupRatio).sub(1))
    .sub(shippingCostCny);
}

/**
 * 实际毛利 = 结算总额(CNY等价) - 成本总价(CNY) - 运费(CNY)
 */
export function calcActualProfit(
  settlementTotalCny: Decimal.Value,
  costTotalCny: Decimal.Value,
  shippingCostCny: Decimal.Value = 0
): Decimal {
  return new Decimal(settlementTotalCny)
    .sub(costTotalCny)
    .sub(shippingCostCny);
}
```

### 5.6 订单状态机

```typescript
// src/lib/order-machine.ts

import { OrderStatus, UserRole } from '@prisma/client';

/**
 * 合法状态转换表
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_QUOTE:  ['QUOTED', 'CANCELLED'],
  QUOTED:         ['NEGOTIATING', 'CONFIRMED', 'CANCELLED'],
  NEGOTIATING:    ['QUOTED', 'CANCELLED'],
  CONFIRMED:      ['PARTIALLY_PAID', 'FULLY_PAID', 'CANCELLED'],
  PARTIALLY_PAID: ['FULLY_PAID', 'SHIPPED', 'CANCELLED'],
  FULLY_PAID:     ['SHIPPED', 'CANCELLED'],
  SHIPPED:        ['SETTLING'],
  SETTLING:       ['COMPLETED'],
  COMPLETED:      [],
  CANCELLED:      [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 进入结算的前提条件检查
 * 订单必须同时满足：已发货 + 已付清
 */
export function canEnterSettlement(order: {
  status: OrderStatus;
  payments: { amountSar: number }[];
  totalSar: number;
  shipping: { id: string } | null;
}): boolean {
  const totalPaid = order.payments.reduce((sum, p) => sum + p.amountSar, 0);
  const isFullyPaid = totalPaid >= order.totalSar;
  const isShipped = order.shipping !== null;
  return isFullyPaid && isShipped;
}

/**
 * 取消权限校验
 * - 无付款记录: 客户或管理员均可取消
 * - 有付款记录: 仅管理员可取消
 */
export function canCancel(
  order: { payments: { id: string }[] },
  userRole: UserRole
): boolean {
  if (order.payments.length === 0) return true;
  return userRole === 'ADMIN';
}
```

### 5.7 认证中间件

```typescript
// src/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

// 公开路径（无需登录）
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register'];
const AUTH_PAGES = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API 路由: 校验 JWT
  if (pathname.startsWith('/api/')) {
    if (PUBLIC_PATHS.some(p => pathname.endsWith(p))) {
      return NextResponse.next();
    }
    const token = request.cookies.get('token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    // 将用户信息注入 header，供 Server Action 读取
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId);
    response.headers.set('x-user-role', payload.role);
    return response;
  }

  // 管理后台: 校验 ADMIN 角色
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('token')?.value;
    const payload = token ? await verifyJWT(token) : null;
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/en/login', request.url));
    }
    return NextResponse.next();
  }

  // 客户端页面: next-intl 国际化中间件
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|assets|favicon.ico).*)'],
};
```

---

## 六、部署架构（Docker Compose 全容器化）

### 6.1 架构总览

```
                  ┌─── Cloudflare (DNS + CDN + SSL) ───┐
                  │                                     │
                  │        用户域名 (HTTPS)              │
                  │              │                       │
                  └──────────────┼───────────────────────┘
                                 │
                          ┌──────┴──────┐
                   ┌──────┤   ECS 主机  ├──────┐
                   │      └─────────────┘      │
                   │                           │
            ┌──────┴───────┐                   │
            │    Nginx     │ :80, :443         │
            │   (容器)     │                   │
            └──────┬───────┘                   │
                   │ proxy_pass :3000           │
            ┌──────┴───────┐            ┌──────┴───────┐
            │   Next.js    │            │  PostgreSQL   │
            │    App       │──────────→ │   (容器)      │
            │   (容器)     │  :5432     │  数据: /data  │
            └──────────────┘            └──────────────┘
                   │
                   │ S3 API
            ┌──────┴───────┐
            │ Cloudflare   │
            │     R2       │
            └──────────────┘
```

### 6.2 服务器选购建议

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| 机型 | ecs.c7.xlarge | 4 vCPU + 8GB 内存 |
| 地域 | 杭州 | 国内开发调试方便 |
| 系统 | Ubuntu 22.04 LTS | 稳定，Docker 支持好 |
| 系统盘 | 40GB ESSD | 系统 + Docker 镜像 |
| 数据盘 | 100GB ESSD | 挂载到 `/data`，存放 PostgreSQL 数据 + 备份 |
| 带宽 | 5Mbps 固定 或 按量付费 | 按业务量选择 |
| 安全组 | 开放 80, 443, 22 | 22 端口建议限制 IP |

> **服务器上仅需安装 Docker + Docker Compose**，不需要手动安装 Node.js / PostgreSQL / Nginx。

### 6.3 Dockerfile（多阶段构建）

```dockerfile
# Dockerfile

# Stage 1: 安装依赖
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

# Stage 2: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: 生产运行
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 6.4 docker-compose.yml（生产环境）

```yaml
# docker-compose.yml

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: celestia
      POSTGRES_USER: celestia
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - /data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U celestia"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: always
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://celestia:${DB_PASSWORD}@db:5432/celestia
      JWT_SECRET: ${JWT_SECRET}
      R2_ENDPOINT: ${R2_ENDPOINT}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME}
      R2_PUBLIC_URL: ${R2_PUBLIC_URL}
      ALIBABA_CLOUD_ACCESS_KEY_ID: ${ALIBABA_CLOUD_ACCESS_KEY_ID}
      ALIBABA_CLOUD_ACCESS_KEY_SECRET: ${ALIBABA_CLOUD_ACCESS_KEY_SECRET}
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    restart: always
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/certs:/etc/nginx/certs:ro
```

### 6.5 docker-compose.dev.yml（开发环境覆盖）

```yaml
# docker-compose.dev.yml
# 用法: docker compose -f docker-compose.yml -f docker-compose.dev.yml up

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: deps           # 只用第一阶段（安装依赖）
    command: npm run dev
    volumes:
      - .:/app               # 源码挂载，支持热更新
      - /app/node_modules    # 排除 node_modules
    ports:
      - "3000:3000"          # 直接暴露，无需 nginx
    environment:
      DATABASE_URL: postgresql://celestia:devpass@db:5432/celestia

  db:
    environment:
      POSTGRES_PASSWORD: devpass

  nginx:
    profiles: ["production"] # 开发环境不启动 nginx
```

### 6.6 Nginx 配置

```nginx
# docker/nginx/nginx.conf

events {
  worker_connections 1024;
}

http {
  upstream nextjs {
    server app:3000;
  }

  # HTTP → HTTPS 重定向
  server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl http2;
    server_name _;

    # Cloudflare Origin Certificate
    ssl_certificate     /etc/nginx/certs/origin.pem;
    ssl_certificate_key /etc/nginx/certs/origin-key.pem;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1024;

    # Next.js 静态资源缓存
    location /_next/static/ {
      proxy_pass http://nextjs;
      expires 365d;
      add_header Cache-Control "public, immutable";
    }

    # 其他请求代理到 Next.js
    location / {
      proxy_pass http://nextjs;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection 'upgrade';
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_cache_bypass $http_upgrade;
    }

    # 上传文件大小限制 (Excel + 图片)
    client_max_body_size 50M;
  }
}
```

### 6.7 数据库备份脚本

```bash
#!/bin/bash
# docker/db/backup.sh
# 用法: crontab 注册 → 0 3 * * * /opt/celestia/docker/db/backup.sh

BACKUP_DIR="/data/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=7

mkdir -p $BACKUP_DIR

# 通过 docker compose exec 执行 pg_dump
docker compose -f /opt/celestia/docker-compose.yml exec -T db \
  pg_dump -U celestia celestia | gzip > "$BACKUP_DIR/celestia_$TIMESTAMP.sql.gz"

# 清理过期备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +$KEEP_DAYS -delete

echo "[$(date)] Backup completed: celestia_$TIMESTAMP.sql.gz"
```

### 6.8 Agent 一键部署命令序列

**首次部署：**

```bash
# 1. 安装 Docker (Ubuntu 22.04)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker $USER

# 2. 挂载数据盘 (假设数据盘为 /dev/vdb)
sudo mkfs.ext4 /dev/vdb
sudo mkdir -p /data
sudo mount /dev/vdb /data
echo '/dev/vdb /data ext4 defaults 0 2' | sudo tee -a /etc/fstab

# 3. 部署应用
git clone <repo_url> /opt/celestia
cd /opt/celestia
cp .env.example .env
# Agent 编辑 .env 填入实际密钥

# 4. 启动
docker compose up -d --build

# 5. 数据库迁移 + 种子数据
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed

# 6. 注册备份 crontab
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/celestia/docker/db/backup.sh >> /data/backups/cron.log 2>&1") | crontab -
```

**后续更新：**

```bash
cd /opt/celestia
git pull
docker compose up -d --build
docker compose exec app npx prisma migrate deploy  # 如有新迁移
```

> 全部命令幂等，可安全重复执行。

### 6.9 域名与 HTTPS

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | Cloudflare 添加域名 | 托管 DNS |
| 2 | 添加 A 记录 | 指向 ECS 公网 IP |
| 3 | SSL/TLS 模式 | 设为 **Full (Strict)** |
| 4 | 生成 Origin Certificate | Cloudflare 仪表盘 → SSL → Origin Server → Create Certificate |
| 5 | 部署证书到服务器 | 放入 `docker/nginx/certs/origin.pem` + `origin-key.pem` |
| 6 | Nginx 配置 SSL | 已在 nginx.conf 中配置 |

> Cloudflare Origin Certificate 有效期 15 年，无需自动续签。

### 6.10 Cloudflare R2 配置

| 步骤 | 操作 |
|------|------|
| 1 | Cloudflare 仪表盘 → R2 → Create bucket（名称如 `celestia-images`） |
| 2 | 启用公开访问（Settings → Public access → Allow Access） |
| 3 | 可选：绑定自定义域（如 `images.yourdomain.com`） |
| 4 | API Tokens → Create Token → Object Read & Write → 限定此 bucket |
| 5 | 将 Endpoint / Access Key / Secret Key 填入 `.env` |

---

## 七、环境变量清单

```bash
# .env.example

# ============ 数据库 ============
DB_PASSWORD=your_strong_password_here
DATABASE_URL=postgresql://celestia:${DB_PASSWORD}@db:5432/celestia

# ============ 认证 ============
JWT_SECRET=your_jwt_secret_at_least_32_chars

# ============ Cloudflare R2 ============
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=celestia-images
R2_PUBLIC_URL=https://images.yourdomain.com

# ============ 阿里云翻译 ============
ALIBABA_CLOUD_ACCESS_KEY_ID=your_alibaba_ak
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_alibaba_sk

# ============ 应用配置 ============
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

---

## 八、实施路线

### 阶段一：项目初始化

- Next.js 15 脚手架（App Router + TypeScript + Tailwind CSS 4）
- Prisma 6 初始化 + 完整 Schema + 种子数据
- shadcn/ui 安装 + 黑金主题配置
- next-intl 配置（en / ar / zh 三语 + RTL）
- Dockerfile + docker-compose.yml + docker-compose.dev.yml
- 项目结构骨架搭建

### 阶段二：认证与客户管理

- 注册 / 登录 / 登出（JWT + httpOnly cookie）
- middleware.ts 认证 + 权限拦截
- 客户准入流程（注册 → 待审核 → 管理员审核 + 设加价比例 → 激活）
- 管理端客户列表 + 审核弹窗 + 修改加价比例

### 阶段三：商品模块

- Excel 导入流水线（上传 → 解析/图片提取/翻译 → 预览 → 确认）
- R2 图片上传（sharp 压缩 + webp + 缩略图）
- 阿里云翻译接入（批量 zh→en/ar）
- 商品 CRUD（管理端）
- 商品列表（客户端，游标分页 + 无限滚动 + 筛选 + 搜索）
- 商品详情（图片轮播 + SKU 选择器 + 参考价展示）
- 多语言 + RTL 布局验证

### 阶段四：订单核心

- 购物车（zustand store + 服务端同步）
- 下单流程（客户提交订单）
- 管理员报价（逐项填 CNY + 汇率 + 加价 → 自动算 SAR）
- 协商循环（客户修改 → 管理员重新报价，可多轮）
- 定价引擎集成（decimal.js 向上取整）
- 付款记录（分期，自动判断部分/全额）
- 物流信息（单号 + 链接 + 运输方式 + 运费）
- 订单状态机（全部状态转换 + 取消规则）

### 阶段五：结算与毛利

- 结算流程（到货后调整：退货/数量/单价/折扣）
- 结算对比明细（报价 vs 结算 vs 差异）
- 毛利计算（预估/实际，仅管理员可见）
- 管理端仪表盘（统计卡片 + 待办事项）

### 阶段六：部署上线

- Agent SSH 到 ECS → 安装 Docker → 挂载数据盘
- `docker compose up -d --build` → 数据库迁移 → 种子数据
- Cloudflare DNS + Origin Certificate → HTTPS
- R2 bucket 创建 + API Token
- 备份 crontab 注册
- 冒烟测试（注册→登录→浏览→下单→报价→完整流程验证）

---

## 附录 A：与业务蓝图字段对照

| 业务蓝图模型 | Prisma 模型 | 特殊字段 | 对照 |
|-------------|-------------|---------|------|
| User.markup_ratio | User.markupRatio | Decimal(4,2) default 1.15 | ✓ |
| Product.ref_price_min/max_sar | Product.refPriceMinSar/MaxSar | Decimal(10,2)? | ✓ |
| ProductSku.ref_price_min/max_sar | ProductSku.refPriceMinSar/MaxSar | Decimal(10,2)? | ✓ |
| ProductImage.is_primary | ProductImage.isPrimary | Boolean | ✓ |
| Order.exchange_rate | Order.exchangeRate | Decimal(8,4) | ✓ |
| Order.markup_ratio | Order.markupRatio | Decimal(4,2) | ✓ |
| Order.override_total_sar | Order.overrideTotalSar | Decimal(12,2)? | ✓ |
| Order.shipping_cost_cny | Order.shippingCostCny | Decimal(10,2)? | ✓ |
| Order.settlement_total_cny/sar | Order.settlementTotalCny/Sar | Decimal(12,2)? | ✓ |
| Order.settlement_note | Order.settlementNote | Text? | ✓ |
| OrderItem.settlement_qty | OrderItem.settlementQty | Int? | ✓ |
| OrderItem.settlement_price_cny | OrderItem.settlementPriceCny | Decimal(10,2)? | ✓ |
| Payment.method 含"现金" | PaymentMethod.CASH | 枚举值 | ✓ |
| Order 状态含"结算中" | OrderStatus.SETTLING | 枚举值 | ✓ |
| OrderItem 含"退货/数量调整" | RETURNED / QTY_ADJUSTED | 枚举值 | ✓ |

> 全部 10 个业务蓝图模型 + 所有新增字段均已对照覆盖。
