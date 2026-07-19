# 多站点 DNS 与 SSL 配置

生产环境三子域均指向同一 ECS 公网 IP（如 `47.114.83.193`），由 Next.js Middleware 按 Host 分流。

## DNS 记录（Cloudflare / 阿里云）

| 主机记录 | 类型 | 值 |
|----------|------|-----|
| `@` (celestia.com) | A | ECS 公网 IP |
| `www` | CNAME 或 A | celestia.com / ECS IP |
| `shop` | A | ECS 公网 IP |
| `products` | A | ECS 公网 IP |

## SSL 证书

Cloudflare Origin Certificate 需覆盖：
- `celestia.com`
- `*.celestia.com`

证书文件放置于 `docker/nginx/ssl/cert.pem` 与 `key.pem`。

## 环境变量（`.env.production`）

```bash
COOKIE_DOMAIN=.celestia.com
NEXT_PUBLIC_MARKETING_URL=https://celestia.com
NEXT_PUBLIC_SHOP_URL=https://shop.celestia.com
NEXT_PUBLIC_B2B_URL=https://products.celestia.com
```

## 发布后验证

- https://celestia.com/en — 官网
- https://shop.celestia.com/en — 2C 商城
- https://shop.celestia.com/shop-admin/login — 2C 后台
- https://products.celestia.com/admin/login — 2B 后台
- https://products.celestia.com/en/storefront — 2B 客户端

日常发布：`.\scripts\deploy-remote.ps1`
