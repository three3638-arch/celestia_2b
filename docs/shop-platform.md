# 2C 商城与多站点实现说明

> 与初版 B2B 技术方案的对照文档，供审计与验收使用。  
> 角色权限详见 [shop-roles.md](./shop-roles.md)。

## API 路由

| 路径 | 鉴权 | 说明 |
|------|------|------|
| `GET /api/shop/products` | 无（公开） | 商品目录，支持 `page`/`pageSize` 分页；每 IP 60 次/分钟限流 |
| `GET /api/shop/products/[slug]` | 无（公开） | 商品详情；每 IP 60 次/分钟限流 |
| `POST /api/shop-auth/login` | 无 | 2C 后台登录 |
| `POST /api/shop-auth/logout` | Cookie | 2C 登出 |
| `POST /api/shop-admin/upload/image` | `celestia-shop-token` | 2C 商品图片上传（middleware 校验） |

> **注意**：管理写操作走 **Server Actions**（`src/lib/actions/shop-*.ts`），不走 `/api/shop-admin/*` REST。公开读接口统一在 `/api/shop/*`。

## 数据模型（2C 增量）

| 模型 | 说明 |
|------|------|
| `ShopProduct` / `ShopProductVariant` / `ShopProductImage` | 2C 商品与定价 |
| `ShopCategory` | 品类 |
| `ShopInquiry` | 询价 |
| `ContactSubmission` | 官网联系表单 |
| `ShopUser` | 2C 后台账号（`SHOP_ADMIN` / `SHOP_EDITOR`） |

## 后台页面

| 路径 | 说明 |
|------|------|
| `/shop-admin/products` | 商品列表（ADMIN 可新建/上下架/删除） |
| `/shop-admin/products/[id]/edit` | 编辑商品；EDITOR 仅图片管理 |
| `/shop-admin/categories` | 品类 CRUD（删除仅 ADMIN） |
| `/shop-admin/inquiries` | 询价管理 |
| `/shop-admin/contacts` | 官网留言（`ContactSubmission`） |

## 初审计缺口与当前状态（2026-07-18）

| 类别 | 状态 |
|------|------|
| 商品详情页、多 SKU、图片上传 | ✅ |
| 生产短路径 + Docker `NEXT_PUBLIC_*` 构建注入 | ✅ |
| 独立 `SHOP_JWT_SECRET`、表单限流、角色分层 | ✅（panel layout + 登录 API 双重断言） |
| 公开 `/api/shop/*`、分 host sitemap | ✅ |
| 品类写操作仅 ADMIN | ✅ |
| 表单蜜罐（询价/联系） | ✅ `website` 字段；v2 可加 Turnstile |
| 2B 独立 sitemap | ✅ `sitemap/b2b.xml` |
| 联系表单 + `/shop-admin/contacts` | ✅（方案外扩展，见下文） |
| 内存限流单实例 | ⚠️ 已文档化，多副本需 Redis |
| 2C 商品硬删除 + R2 清理 | ✅（无询价记录时） |
| robots.txt 按 Host 分流 | ✅ |
| 商品目录分页（SSR + API） | ✅ |
| Playwright E2E 冒烟 | ✅ `npm run test:e2e` + CI |
| SKU 三语名称后台表单 | ✅ |
| 询价 adminNote | ✅ |
| 商品列表快捷上下架 | ✅ `ProductStatusButton` |
| Middleware Host 分流集成测试 | ✅ `middleware-host-routing.test.ts` |
| 公开 API 轻量限流 | ✅ 内存限流，v2 换 Redis |

## 方案外扩展：ContactSubmission

初版 B2B 技术方案未列出官网联系表单，当前实现为合理扩展：

- 数据表 `ContactSubmission`（姓名、邮箱、留言等）
- 公开页 `/[locale]/contact` + Server Action 提交
- 管理端 `/shop-admin/contacts`（`SHOP_ADMIN` 只读列表）

**审计口径**：在验收文档中将其列为「官网增量能力」，与 2C 商城模型并列记录，避免与初版方案逐条对照时出现「未列项」争议。

## R2 对象路径

2C 商品图片上传使用前缀 **`shop/products/`**（`generateShopImageKey`）。历史 B2B 图片仍为 **`b2b/products/`**，读取兼容、不批量迁移。

| 场景 | 策略 |
|------|------|
| 新上传 2C 图 | `shop/products/{timestamp}-{rand}.webp` |
| 历史 B2B 路径 | 只读兼容 |
| 删除商品/图片 | `deleteR2ObjectByUrl` 解析 URL 后调用 `deleteFromR2`（无询价记录时硬删商品） |

## v2 路线图（安全与运维）

### 限流（Redis 已接入）

| 模块 | 入口 | 说明 |
|------|------|------|
| 表单 | `enforceRateLimit()` in `rate-limit.ts` | 询价/联系 15min 5次/IP |
| 公开 API | `enforceApiRateLimit()` 同上文件 | 60次/min/IP |
| 存储 | `rate-limit-store.ts` + `rate-limit-redis.ts` | 设置 `REDIS_URL` 自动切换；未配置时用内存 Map |

生产推荐 [Upstash Redis](https://upstash.com/)：复制 `rediss://...` 到 `REDIS_URL`。本地强制内存：`RATE_LIMIT_STORE=memory`。

### Turnstile（已接入）

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 客户端 widget（**须参与 Docker build**） |
| `TURNSTILE_SECRET_KEY` | 服务端 `siteverify` |

未配置时跳过验证（开发友好）。询价与联系表单均已接入，蜜罐仍保留。

### 生产 E2E / 冒烟

| 方式 | 命令 |
|------|------|
| Playwright（公网 HTTPS） | `E2E_PRODUCTION=1 npm run test:e2e:production` |
| 部署后 curl | `bash scripts/smoke-production.sh .env.production`（`deploy-remote.ps1` 已集成） |

| 项 | 现状 |
|----|------|
| 表单限流 | ✅ Redis（`REDIS_URL`）或内存回退 |
| 公开表单 CAPTCHA | ✅ Turnstile（可选配置）+ 蜜罐 |
| `/api/shop/*` 限流 | ✅ 与表单共用 Redis store |
| E2E | ✅ 本地 Host 头 + 生产 HTTPS 套件 |
| CI | ✅ `.github/workflows/ci.yml` |
