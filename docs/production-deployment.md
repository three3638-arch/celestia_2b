# Celestia 生产环境部署指南（阿里云 ECS）

本文档指导您在阿里云 ECS 服务器上部署 Celestia 电商平台。

---

## 1. 前置准备

### 1.1 服务器要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2核 | 4核 |
| 内存 | 4GB | 8GB |
| 磁盘 | 40GB SSD | 80GB SSD |
| 系统 | Alibaba Cloud Linux 3.2104 LTS 64位 | 同上 |
| 带宽 | 3Mbps | 5Mbps+ |

**购买步骤：**
1. 登录阿里云控制台 → 云服务器 ECS → 创建实例
2. 选择 **Alibaba Cloud Linux 3.2104 LTS 64位**（CentOS/RHEL 系）
3. 选择推荐配置（4核8G）
4. 设置 root 密码并保存

### 1.2 安全组配置

进入 ECS 实例详情 → 安全组 → 配置规则，添加以下入方向规则：

| 端口 | 用途 | 授权对象 |
|------|------|----------|
| 22 | SSH 远程连接 | 0.0.0.0/0（或您的IP） |
| 80 | HTTP 网站访问 | 0.0.0.0/0 |
| 443 | HTTPS 网站访问 | 0.0.0.0/0 |

### 1.3 域名与 SSL 证书准备

**域名准备：**
1. 在阿里云或其他域名服务商购买域名
2. 进入域名解析控制台，添加 A 记录指向 ECS 公网 IP

**SSL 证书获取（推荐阿里云免费证书）：**
1. 登录阿里云 → SSL 证书 → 免费证书
2. 创建证书 → 证书申请 → 填写域名
3. 验证域名所有权（自动DNS验证）
4. 下载证书（Nginx 格式），解压后得到：
   - `your-domain.pem`（证书文件）
   - `your-domain.key`（私钥文件）

### 1.4 R2 存储配置（可选，用于图片存储）

1. 登录 Cloudflare 控制台 → R2 对象存储
2. 创建存储桶，名称如 `celestia`
3. 管理 R2 API 令牌 → 创建 API 令牌
4. 记录以下信息：
   - Account ID
   - Access Key ID
   - Secret Access Key

### 1.5 阿里云翻译配置（可选，用于多语言）

1. 登录阿里云控制台 → 机器翻译
2. 开通服务并创建 AccessKey
3. 记录 AccessKey ID 和 Secret

---

## 2. 连接服务器

### 2.1 Windows PowerShell 连接

```powershell
# 在本地 Windows PowerShell 中执行
ssh root@你的服务器公网IP
```

首次连接会提示确认指纹，输入 `yes` 回车，然后输入 root 密码。

### 2.2 Mac/Linux 终端连接

```bash
# 在本地终端执行
ssh root@你的服务器公网IP
```

### 2.3 阿里云 Web Terminal（备用）

1. 登录阿里云控制台 → ECS 实例列表
2. 找到目标实例 → 点击「远程连接」
3. 选择「Workbench 远程连接」或「VNC 远程连接」

---

## 3. 环境安装

### 3.1 系统更新

**执行位置：服务器上**

```bash
# 更新系统软件包
yum update -y

# 安装常用工具
yum install -y git vim wget curl
```

### 3.2 安装 Docker

**执行位置：服务器上**

```bash
# 安装 yum-utils（用于添加仓库）
yum install -y yum-utils

# 添加 Docker 阿里云镜像仓库
yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo

# 安装 Docker CE 及相关组件
yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动 Docker 服务
systemctl start docker

# 设置开机自启
systemctl enable docker

# 验证安装
docker --version
docker compose version
```

### 3.3 配置 Docker 镜像加速器（推荐）

**执行位置：服务器上**

```bash
# 创建 Docker 配置目录
mkdir -p /etc/docker

# 写入阿里云镜像加速器配置
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://mirror.aliyuncs.com",
    "https://hub-mirror.c.163.com"
  ]
}
EOF

# 重启 Docker 生效
systemctl restart docker
```

---

## 4. 拉取代码

**执行位置：服务器上**

```bash
# 进入 /opt 目录
cd /opt

# 克隆代码仓库（请替换为实际仓库地址）
git clone https://github.com/yourusername/celestia.git

# 进入项目目录
cd celestia

# 查看目录结构确认
ls -la
```

---

## 5. 配置环境变量

**执行位置：服务器上**

```bash
# 复制示例配置文件
cp .env.production.example .env.production

# 编辑配置文件
vim .env.production
```

**按 `i` 进入编辑模式，逐项填写以下配置：**

### 5.1 数据库配置

```bash
# 数据库密码（必填）
# 建议：16位以上，包含大小写字母、数字、特殊字符
DB_PASSWORD=YourStrongPassword123!
```

### 5.2 认证配置

```bash
# JWT 密钥（必填）
# 生成命令：openssl rand -base64 32
JWT_SECRET=your-random-32-char-secret-key-here

# Token 过期时间（默认7天）
JWT_EXPIRES_IN=7d
```

### 5.3 应用配置

```bash
# 你的域名（必填，必须带 https://）
NEXT_PUBLIC_BASE_URL=https://your-domain.com

# 默认语言：en（英文）、ar（阿拉伯文）、zh（中文）
NEXT_PUBLIC_DEFAULT_LOCALE=en

# 默认货币：SAR（沙特里亚尔）、USD（美元）、CNY（人民币）
NEXT_PUBLIC_CURRENCY=SAR
```

### 5.4 Cloudflare R2 存储配置（可选）

```bash
# R2 Account ID
R2_ACCOUNT_ID=your_account_id_here

# R2 Access Key
R2_ACCESS_KEY_ID=your_access_key_here

# R2 Secret Key
R2_SECRET_ACCESS_KEY=your_secret_key_here

# 存储桶名称
R2_BUCKET_NAME=celestia

# R2 自定义域名（必须带 https://）
R2_PUBLIC_URL=https://cdn.your-domain.com
```

### 5.5 阿里云翻译配置（可选）

```bash
# 阿里云 AccessKey ID
ALIMT_ACCESS_KEY_ID=your_alimt_key_here

# 阿里云 AccessKey Secret
ALIMT_ACCESS_KEY_SECRET=your_alimt_secret_here

# 服务区域（默认杭州）
ALIMT_REGION=cn-hangzhou
```

**编辑完成后：**
- 按 `Esc` 键
- 输入 `:wq` 回车保存退出

---

## 6. SSL 证书配置

**执行位置：服务器上**

### 6.1 创建证书目录

```bash
# 创建 SSL 证书目录
mkdir -p /opt/celestia/docker/nginx/ssl
```

### 6.2 上传证书文件

**方式一：本地 PowerShell 使用 scp 上传**

```powershell
# 在本地 Windows PowerShell 执行
# 上传证书文件
scp C:\Users\你的用户名\Downloads\your-domain.pem root@你的服务器IP:/opt/celestia/docker/nginx/ssl/cert.pem

# 上传私钥文件
scp C:\Users\你的用户名\Downloads\your-domain.key root@你的服务器IP:/opt/celestia/docker/nginx/ssl/key.pem
```

**方式二：直接在服务器上使用 vim 创建**

```bash
# 创建证书文件
vim /opt/celestia/docker/nginx/ssl/cert.pem
# 按 i 粘贴证书内容，Esc，:wq 保存

# 创建私钥文件
vim /opt/celestia/docker/nginx/ssl/key.pem
# 按 i 粘贴私钥内容，Esc，:wq 保存
```

### 6.3 设置证书权限

```bash
# 设置权限（仅 root 可读）
chmod 600 /opt/celestia/docker/nginx/ssl/key.pem
chmod 644 /opt/celestia/docker/nginx/ssl/cert.pem

# 验证文件
ls -la /opt/celestia/docker/nginx/ssl/
```

---

## 7. 一键部署

**执行位置：服务器上（/opt/celestia 目录）**

```bash
# 确保在项目目录
cd /opt/celestia

# 执行部署脚本
bash scripts/setup-server.sh
```

### 7.1 脚本执行过程说明

脚本会自动执行以下 9 个步骤：

| 步骤 | 内容 | 预计时间 |
|------|------|----------|
| 1/9 | 检查 Docker 环境 | 10秒 |
| 2/9 | 检查环境变量配置 | 5秒 |
| 3/9 | 检查 SSL 证书 | 5秒 |
| 4/9 | 构建 Docker 镜像 | 5-10分钟 |
| 5/9 | 启动服务 | 30秒 |
| 6/9 | 等待数据库就绪 | 30秒 |
| 7/9 | 运行数据库迁移 | 10秒 |
| 8/9 | 创建管理员账号 | 5秒 |
| 9/9 | 验证部署 | 5秒 |

### 7.2 预期输出

部署成功后会显示：

```
==============================
✅ 部署完成！
==============================

🌐 访问地址:
   网站首页: https://your-domain.com
   管理后台: https://your-domain.com/admin/login

👤 默认管理员账号:
   手机号: 13800000001
   密码: admin123

📚 常用命令:
   查看日志: docker compose -f docker-compose.prod.yml logs -f
   重启服务: docker compose -f docker-compose.prod.yml restart
   查看状态: docker compose -f docker-compose.prod.yml ps
```

---

## 8. 验证部署

### 8.1 检查容器状态

**执行位置：服务器上**

```bash
cd /opt/celestia
docker compose -f docker-compose.prod.yml ps
```

预期输出（Status 列显示 `running` 或 `healthy`）：

```
NAME            IMAGE           STATUS
celestia-app    celestia-app    Up 2 minutes (healthy)
celestia-db     postgres:16     Up 2 minutes (healthy)
celestia-nginx  nginx:alpine    Up 2 minutes
```

### 8.2 查看日志

```bash
# 查看所有服务日志
docker compose -f docker-compose.prod.yml logs -f

# 仅查看应用日志
docker compose -f docker-compose.prod.yml logs -f app

# 仅查看数据库日志
docker compose -f docker-compose.prod.yml logs -f db

# 仅查看 Nginx 日志
docker compose -f docker-compose.prod.yml logs -f nginx
```

**按 `Ctrl+C` 退出日志查看。**

### 8.3 访问网站

在浏览器中访问：

- **网站首页**：`https://your-domain.com`
- **管理后台**：`https://your-domain.com/admin/login`

### 8.4 登录管理后台

使用默认管理员账号登录：

- **手机号**：`13800000001`
- **密码**：`admin123`

**⚠️ 重要：首次登录后请立即修改默认密码！**

---

## 9. 日常维护

### 9.1 更新部署

当代码有更新时执行：

**执行位置：服务器上**

```bash
cd /opt/celestia

# 拉取最新代码
git pull

# 执行更新脚本
bash scripts/deploy.sh
```

更新脚本会自动：
1. 拉取最新代码
2. 重新构建 Docker 镜像
3. 启动服务
4. 运行数据库迁移
5. 清理旧镜像

### 9.2 查看日志

```bash
cd /opt/celestia

# 实时查看日志
docker compose -f docker-compose.prod.yml logs -f

# 查看最近100行日志
docker compose -f docker-compose.prod.yml logs --tail=100

# 查看特定时间段的日志
docker compose -f docker-compose.prod.yml logs --since="2024-01-01 00:00:00"
```

### 9.3 重启服务

```bash
cd /opt/celestia

# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 仅重启应用
docker compose -f docker-compose.prod.yml restart app

# 停止所有服务
docker compose -f docker-compose.prod.yml stop

# 启动所有服务
docker compose -f docker-compose.prod.yml start
```

### 9.4 数据库备份

**手动备份：**

```bash
cd /opt/celestia

# 创建备份目录
mkdir -p /opt/backups

# 执行备份
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U celestia -d celestia -F c > /opt/backups/celestia_$(date +%Y%m%d_%H%M%S).dump

# 查看备份文件
ls -lh /opt/backups/
```

**自动备份（Cron 定时任务）：**

```bash
# 编辑 crontab
crontab -e

# 添加以下内容（每天凌晨3点自动备份）
0 3 * * * cd /opt/celestia && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U celestia -d celestia -F c > /opt/backups/celestia_$(date +\%Y\%m\%d).dump

# 保存退出
```

**恢复备份：**

```bash
cd /opt/celestia

# 恢复指定备份文件
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U celestia -d celestia -c < /opt/backups/celestia_20240101.dump
```

### 9.5 磁盘监控

```bash
# 查看磁盘使用情况
df -h

# 查看 Docker 占用空间
docker system df

# 清理未使用的 Docker 资源
docker system prune -f

# 清理所有未使用的卷（谨慎使用）
docker volume prune -f
```

---

## 10. 常见问题

### 10.1 连接被拒绝（Connection Refused）

**现象**：浏览器访问网站显示「无法访问此网站」

**排查步骤：**

```bash
# 1. 检查安全组是否开放 80/443 端口
# 登录阿里云控制台 → ECS → 安全组 → 检查入方向规则

# 2. 检查容器是否运行
cd /opt/celestia
docker compose -f docker-compose.prod.yml ps

# 3. 检查 Nginx 日志
docker compose -f docker-compose.prod.yml logs nginx

# 4. 检查防火墙
cat /etc/os-release  # 确认系统类型
systemctl status firewalld  # 查看防火墙状态
```

**解决方案：**
- 安全组添加 80/443 端口规则
- 重启服务：`docker compose -f docker-compose.prod.yml restart`

### 10.2 证书不信任/安全警告

**现象**：浏览器显示「您的连接不是私密连接」

**原因：**
- 证书过期
- 证书与域名不匹配
- 使用了自签名证书

**解决方案：**
1. 检查证书有效期：`openssl x509 -in docker/nginx/ssl/cert.pem -noout -dates`
2. 重新申请阿里云免费证书
3. 确保证书与域名完全匹配（包括 www 和非 www）

### 10.3 数据库连接错误

**现象**：应用无法连接数据库，日志显示 connection refused

**排查步骤：**

```bash
# 1. 检查数据库容器状态
docker compose -f docker-compose.prod.yml ps db

# 2. 查看数据库日志
docker compose -f docker-compose.prod.yml logs db

# 3. 检查环境变量中的密码
cat .env.production | grep DB_PASSWORD
```

**解决方案：**
- 重启数据库容器：`docker compose -f docker-compose.prod.yml restart db`
- 检查密码是否正确（无特殊字符问题）
- 等待数据库完全启动（首次启动需要 30-60 秒）

### 10.4 内存不足

**现象**：服务启动失败，日志显示 OOM (Out of Memory)

**排查：**

```bash
# 查看内存使用
free -h

# 查看容器内存限制
docker stats
```

**解决方案：**
1. 升级服务器配置（推荐 4核8G）
2. 添加 Swap 分区：

```bash
# 创建 4GB Swap 文件
dd if=/dev/zero of=/swapfile bs=1G count=4
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# 永久生效
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 10.5 部署脚本失败

**现象**：`setup-server.sh` 执行中途报错退出

**排查步骤：**

```bash
# 1. 检查环境变量是否填写完整
cat .env.production

# 2. 检查 SSL 证书是否存在
ls -la docker/nginx/ssl/

# 3. 手动执行构建查看详细错误
docker compose -f docker-compose.prod.yml build --no-cache
```

### 10.6 忘记管理员密码

**执行位置：服务器上**

```bash
cd /opt/celestia

# 进入数据库容器执行 SQL
docker compose -f docker-compose.prod.yml exec db psql -U celestia -d celestia -c "UPDATE \"User\" SET \"passwordHash\" = '\$2a\$10\$YourNewHashedPassword' WHERE phone = '13800000001';"
```

或者重置为默认密码：

```bash
# 创建重置脚本
cat > /tmp/reset-password.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.update({
    where: { phone: '13800000001' },
    data: { passwordHash }
  });
  console.log('Password reset to: admin123');
}
main().finally(() => prisma.$disconnect());
EOF

# 执行重置
docker compose -f docker-compose.prod.yml exec app node /tmp/reset-password.js
```

### 10.7 图片上传失败

**现象**：上传图片时提示失败或图片无法显示

**排查步骤：**

```bash
# 1. 检查 R2 配置是否正确
cat .env.production | grep R2_

# 2. 检查应用日志
docker compose -f docker-compose.prod.yml logs app | grep -i error

# 3. 测试 R2 连通性
docker compose -f docker-compose.prod.yml exec app curl -I https://你的R2域名
```

**解决方案：**
- 确认 R2 环境变量填写正确
- 确认 R2_PUBLIC_URL 可访问
- 如不使用 R2，可配置为本地存储（需修改代码）

### 10.8 部署后页面显示 404

**排查：**

```bash
# 检查 Nginx 配置
cat docker/nginx/nginx.conf

# 检查应用是否正常响应
docker compose -f docker-compose.prod.yml exec nginx wget -qO- http://app:3000
```

---

## 附录

### A. 服务架构说明

部署完成后，服务器上运行以下容器：

| 容器名 | 服务 | 端口映射 | 说明 |
|--------|------|----------|------|
| celestia-app | Next.js 应用 | 3000 | 主应用程序 |
| celestia-db | PostgreSQL | 5432（内部） | 数据库 |
| celestia-nginx | Nginx | 80, 443 | 反向代理、SSL |

### B. 目录结构

```
/opt/celestia/
├── docker/
│   └── nginx/
│       ├── nginx.conf      # Nginx 配置
│       └── ssl/            # SSL 证书目录
│           ├── cert.pem    # 证书文件
│           └── key.pem     # 私钥文件
├── scripts/
│   ├── setup-server.sh     # 首次部署脚本
│   └── deploy.sh           # 更新部署脚本
├── docker-compose.prod.yml # 生产环境编排
├── .env.production         # 环境变量（需手动配置）
└── ...                     # 其他项目文件
```

### C. 常用命令速查

```bash
# 进入项目目录
cd /opt/celestia

# 查看状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 重启服务
docker compose -f docker-compose.prod.yml restart

# 停止服务
docker compose -f docker-compose.prod.yml stop

# 启动服务
docker compose -f docker-compose.prod.yml start

# 进入应用容器
docker compose -f docker-compose.prod.yml exec app sh

# 进入数据库容器
docker compose -f docker-compose.prod.yml exec db sh

# 数据库备份
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U celestia -d celestia -F c > backup.dump

# 数据库恢复
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U celestia -d celestia -c < backup.dump
```

---

**文档版本**：v1.0  
**适用系统**：Alibaba Cloud Linux 3.2104 LTS 64位  
**最后更新**：2026-04-02
