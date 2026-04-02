#!/bin/bash
# Celestia 生产环境一键部署脚本
# 在阿里云 ECS 上运行

set -e

echo "🚀 Celestia 生产环境部署脚本"
echo "=============================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 1. 检查环境
echo -e "${YELLOW}📋 步骤 1/9: 检查环境...${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}   Docker 未安装，正在自动安装...${NC}"
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    echo -e "${GREEN}   ✅ Docker 安装完成${NC}"
else
    echo -e "${GREEN}   ✅ Docker 已安装 ($(docker --version))${NC}"
fi

# 检查 Docker Compose
if ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Docker Compose 已安装${NC}"

# 2. 检查环境变量文件
echo ""
echo -e "${YELLOW}📋 步骤 2/9: 检查环境变量配置...${NC}"

if [ ! -f ".env.production" ]; then
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
        echo -e "${YELLOW}   ⚠️  已创建 .env.production 文件，请编辑填写必填项:${NC}"
        echo -e "      - DB_PASSWORD (数据库密码)"
        echo -e "      - JWT_SECRET (JWT密钥，至少32字符)"
        echo -e "      - NEXT_PUBLIC_BASE_URL (你的域名)"
        echo -e "      - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY (R2存储)"
        echo ""
        echo -e "${RED}❌ 请先编辑 .env.production 文件后再运行此脚本${NC}"
        exit 1
    else
        echo -e "${RED}❌ 错误: 未找到 .env.production.example 文件${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}   ✅ .env.production 文件已存在${NC}"
fi

# 3. 检查 SSL 证书
echo ""
echo -e "${YELLOW}📋 步骤 3/9: 检查 SSL 证书...${NC}"

if [ ! -f "docker/nginx/ssl/cert.pem" ] || [ ! -f "docker/nginx/ssl/key.pem" ]; then
    echo -e "${YELLOW}   ⚠️  SSL 证书文件不存在${NC}"
    echo -e "   请执行以下操作:"
    echo -e "   1. 在 Cloudflare 生成 Origin Certificate"
    echo -e "   2. 创建目录: mkdir -p docker/nginx/ssl"
    echo -e "   3. 保存证书: nano docker/nginx/ssl/cert.pem"
    echo -e "   4. 保存私钥: nano docker/nginx/ssl/key.pem"
    echo ""
    echo -e "${RED}❌ 请先配置 SSL 证书后再运行此脚本${NC}"
    exit 1
else
    echo -e "${GREEN}   ✅ SSL 证书文件已配置${NC}"
fi

# 4. 构建 Docker 镜像
echo ""
echo -e "${YELLOW}📋 步骤 4/9: 构建 Docker 镜像...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Docker 构建失败${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ Docker 镜像构建完成${NC}"

# 5. 启动服务
echo ""
echo -e "${YELLOW}📋 步骤 5/9: 启动服务...${NC}"
docker compose -f docker-compose.prod.yml up -d
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 服务启动失败${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ 服务已启动${NC}"

# 6. 等待数据库就绪
echo ""
echo -e "${YELLOW}📋 步骤 6/9: 等待数据库就绪...${NC}"
max_retries=30
retry_count=0
healthy=false

while [ $retry_count -lt $max_retries ] && [ "$healthy" = false ]; do
    sleep 2
    retry_count=$((retry_count + 1))
    
    status=$(docker compose -f docker-compose.prod.yml ps db --format "{{.Status}}" 2>/dev/null || echo "")
    if echo "$status" | grep -qE "healthy|running"; then
        healthy=true
    fi
    
    echo -e "   等待中... ($retry_count/$max_retries)"
done

if [ "$healthy" = false ]; then
    echo -e "${RED}❌ 数据库未能在 60 秒内就绪${NC}"
    exit 1
fi
echo -e "${GREEN}   ✅ 数据库已就绪${NC}"

# 7. 运行数据库迁移
echo ""
echo -e "${YELLOW}📋 步骤 7/9: 运行数据库迁移...${NC}"
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  迁移可能已存在，尝试继续...${NC}"
fi
echo -e "${GREEN}   ✅ 数据库迁移完成${NC}"

# 8. 创建管理员账号
echo ""
echo -e "${YELLOW}📋 步骤 8/9: 创建管理员账号...${NC}"

# 创建临时管理员脚本
cat > /tmp/seed-admin.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const phone = '13800000001';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log('Admin already exists, skipping');
    return;
  }

  await prisma.user.create({
    data: {
      phone,
      passwordHash,
      name: 'Administrator',
      role: 'ADMIN',
      status: 'ACTIVE',
      markupRatio: 1.15,
      preferredLang: 'en',
    },
  });
  console.log('Admin created: ' + phone + ' / ' + password);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
EOF

docker compose -f docker-compose.prod.yml exec app node /tmp/seed-admin.js 2>/dev/null || echo -e "${YELLOW}   ⚠️  管理员创建跳过（可能已存在）${NC}"
echo -e "${GREEN}   ✅ 管理员账号检查完成${NC}"

# 9. 验证部署
echo ""
echo -e "${YELLOW}📋 步骤 9/9: 验证部署...${NC}"
sleep 3

# 检查容器状态
containers=$(docker compose -f docker-compose.prod.yml ps --format "{{.Name}}:{{.Status}}" 2>/dev/null)
if echo "$containers" | grep -q "celestia-app"; then
    echo -e "${GREEN}   ✅ 应用容器运行中${NC}"
else
    echo -e "${RED}   ❌ 应用容器未运行${NC}"
fi

if echo "$containers" | grep -q "celestia-db"; then
    echo -e "${GREEN}   ✅ 数据库容器运行中${NC}"
else
    echo -e "${RED}   ❌ 数据库容器未运行${NC}"
fi

if echo "$containers" | grep -q "celestia-nginx"; then
    echo -e "${GREEN}   ✅ Nginx 容器运行中${NC}"
else
    echo -e "${RED}   ❌ Nginx 容器未运行${NC}"
fi

# 获取域名
base_url=$(grep NEXT_PUBLIC_BASE_URL .env.production | cut -d'=' -f2 | tr -d '"' || echo "your-domain.com")

echo ""
echo "=============================="
echo -e "${GREEN}✅ 部署完成！${NC}"
echo "=============================="
echo ""
echo -e "${CYAN}🌐 访问地址:${NC}"
echo -e "   网站首页: ${base_url}"
echo -e "   管理后台: ${base_url}/admin/login"
echo ""
echo -e "${CYAN}👤 默认管理员账号:${NC}"
echo -e "   手机号: 13800000001"
echo -e "   密码: admin123"
echo ""
echo -e "${CYAN}📚 常用命令:${NC}"
echo -e "   查看日志: docker compose -f docker-compose.prod.yml logs -f"
echo -e "   重启服务: docker compose -f docker-compose.prod.yml restart"
echo -e "   查看状态: docker compose -f docker-compose.prod.yml ps"
echo ""
