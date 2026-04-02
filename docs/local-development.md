# 本地开发环境部署

## 前提条件
- 已安装 [Node.js 20+](https://nodejs.org/)（LTS版本）
- 已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 并确保正在运行

## 一键启动

打开 PowerShell，进入项目目录，运行：

```powershell
.\scripts\setup-local.ps1
```

脚本会自动完成：环境检查 → 安装依赖 → 启动数据库 → 初始化表结构 → 创建管理员账号

完成后运行：
```powershell
npm run dev
```

## 访问地址

| 页面 | 地址 |
|------|------|
| 管理后台 | http://localhost:3000/admin/login |
| 客户端（英文） | http://localhost:3000/en/storefront |
| 客户端（阿拉伯文） | http://localhost:3000/ar/storefront |
| 客户端（中文） | http://localhost:3000/zh/storefront |

## 默认管理员账号
- 手机号：13800000001
- 密码：admin123

## 测试流程

### 管理员操作流程
1. 登录管理后台 `/admin/login`
2. 进入"客户管理"审核新注册客户
3. 进入"商品管理"添加商品和 SKU
4. 进入"订单管理"为订单报价
5. 记录付款、填写物流信息

### 客户操作流程
1. 访问 `/en/register` 注册账号（需等待审核）
2. 浏览商品，加入购物车
3. 提交订单，等待报价
4. 查看报价后确认订单
5. 跟踪付款和物流状态

## 开发模式说明

| 功能 | 开发环境行为 |
|------|-------------|
| 图片上传 | 自动保存到本地 `public/uploads/`（无需配置 R2） |
| AI 翻译 | 使用占位翻译（无需配置阿里云 API） |
| 数据库 | Docker 容器中的 PostgreSQL |
| 日志 | 终端显示详细 SQL 查询 |

## 常见问题

**端口被占用？**
```powershell
# 更换端口启动
npm run dev -- -p 3001
```

**重置数据库？**
```powershell
docker compose down -v
docker compose up -d
npx prisma migrate dev --name init
npx tsx scripts/seed-admin.ts
```
