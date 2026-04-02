#!/bin/bash
# Celestia 生产环境更新脚本
# 用于代码更新后重新部署

set -e

echo "🚀 正在更新 Celestia..."
echo "======================="
echo ""

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull

# 重新构建并启动
echo "🔨 重新构建镜像..."
docker compose -f docker-compose.prod.yml build --no-cache

echo "🚀 启动服务..."
docker compose -f docker-compose.prod.yml up -d

# 等待数据库就绪
echo "⏳ 等待数据库就绪..."
sleep 5

# 运行数据库迁移
echo "🗄️  运行数据库迁移..."
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo ""
echo "======================="
echo "✅ 更新完成！"
echo "======================="
echo ""
echo "📊 查看状态: docker compose -f docker-compose.prod.yml ps"
echo "📜 查看日志: docker compose -f docker-compose.prod.yml logs -f"
echo ""
