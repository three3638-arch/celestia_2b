# 本地开发环境部署

## 前提条件
- 已安装 [Node.js 20+](https://nodejs.org/)（LTS版本）
- 已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 并确保正在运行

## 一键启动

打开 PowerShell，进入项目目录，运行：

```powershell
.\scripts\setup-local.ps1
```

脚本会自动完成：环境检查 → 安装依赖 → 启动数据库 → 初始化表结构 → 创建 2B/2C 管理员账号

完成后运行：
```powershell
npm run dev
```

## 访问地址

| 模块 | 地址 |
|------|------|
| 官网首页 | http://localhost:3000/en |
| 2C 商品目录 | http://localhost:3000/en/shop |
| 2C 管理后台 | http://localhost:3000/shop-admin/login |
| 2B 管理后台 | http://localhost:3000/admin/login |
| 2B 客户端（英文） | http://localhost:3000/en/storefront |
| 2B 客户端（阿拉伯文） | http://localhost:3000/ar/storefront |
| 2B 客户端（中文） | http://localhost:3000/zh/storefront |

## 默认账号

**2B 管理员**：见 `scripts/seed-admin.ts` 中配置的手机号，密码 `admin123`

**2C 管理员**（首次 `seed-shop-admin.ts` 创建）：

- **手机号**：`.env` 中 `SHOP_ADMIN_PHONE`（未设置时默认 `13900000001`）
- **密码**：`.env` 中 `SHOP_ADMIN_PASSWORD`；若均未设置，脚本会**随机生成**并在终端打印一次（请立即保存）

> 生产环境必须在 `.env.production` 中显式设置 `SHOP_ADMIN_PHONE` 与 `SHOP_ADMIN_PASSWORD`，脚本不会使用弱默认密码。

## 安全说明

- **2C JWT**：生产须配置独立 `SHOP_JWT_SECRET`（与 `JWT_SECRET` 不同），`setup-server.sh` 会校验
- **表单限流**：询价/联系表单每 IP 15 分钟最多 5 次（`src/lib/rate-limit.ts`，单实例内存实现；多实例扩展需 Redis）
- **角色权限**：见 [shop-roles.md](./shop-roles.md)
- **2C 实现与 API 对照**：见 [shop-platform.md](./shop-platform.md)

## 2C 测试流程（E2E 冒烟）

1. 登录 `/shop-admin/login`（账号见上方「2C 管理员」）
2. **品类**：创建品类（如 `rings`）
3. **商品**：新建商品 → 填写多 SKU 与定价 → 保存为 **ACTIVE**
4. **图片**：进入商品编辑页上传至少一张图片
5. **前台目录**：访问 `/en/shop`，确认商品卡片可见
6. **商品详情**：点击商品进入 `/en/shop/products/{slug}`，切换 variant、查看价格
7. **询价**：点击「Request Quote」→ 填写表单提交
8. **询价管理**：在 `/shop-admin/inquiries` 确认新询价记录

> 若详情页 404：检查商品状态是否为 ACTIVE，且至少有一个 variant。

## 官网冒烟

1. 访问 `/en` → 点击「Browse Collection」应进入 `/en/shop`
2. 访问 `/en/contact` → 填写联系表单并提交成功

## 2B 测试流程

### 管理员操作流程
1. 登录管理后台 `/admin/login`
2. 进入"客户管理"审核新注册客户
3. 进入"商品管理"添加商品和 SKU
4. 进入"订单管理"为订单报价

### 客户操作流程
1. 访问 `/en/storefront/register` 注册账号（需等待审核）
2. 浏览商品，加入购物车，提交订单

## 开发模式说明

| 功能 | 开发环境行为 |
|------|-------------|
| 图片上传 | 自动保存到本地 `public/uploads/`（无需配置 R2） |
| 数据库 | Docker 容器中的 PostgreSQL |
| 多站点 | 同一 `localhost:3000`，通过路径区分各模块 |

## 常见问题

**端口被占用？**
```powershell
npm run dev -- -p 3001
```

**重置数据库？**
```powershell
docker compose down -v
docker compose up -d
npx prisma migrate deploy
npx tsx scripts/seed-admin.ts
npx tsx scripts/seed-shop-admin.ts
```
