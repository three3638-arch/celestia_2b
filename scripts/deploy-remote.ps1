# Celestia 一键远程发布脚本
# 将本地代码直接同步到云服务器并重新构建部署（无需 Git）

$SERVER_IP = "47.114.83.193"
$SERVER_USER = "root"
$DEPLOY_PATH = "/opt/celestia"
$DISK_THRESHOLD = 60

$ErrorActionPreference = "Stop"

function Write-Success($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Warn($msg) { Write-Host $msg -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host $msg -ForegroundColor Red }

Write-Host "========================================"
Write-Host "  Celestia 一键发布（直接同步）"
Write-Host "========================================"
Write-Host ""

# [1/5] SSH 连接验证
Write-Host "[1/5] 验证 SSH 连接...         " -NoNewline
$sshTest = ssh -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_USER@$SERVER_IP" "echo OK" 2>&1
if ($LASTEXITCODE -ne 0 -or $sshTest -ne "OK") {
    Write-Err "✗"
    Write-Err "SSH 连接失败，请确认已配置 SSH 密钥免密登录。"
    exit 1
}
Write-Success "✓"

Write-Host "      检查生产环境变量...      " -NoNewline
$envCheck = ssh "$SERVER_USER@$SERVER_IP" "grep -q '^SHOP_JWT_SECRET=.\+' $DEPLOY_PATH/.env.production 2>/dev/null && grep -q '^SHOP_ADMIN_PASSWORD=.\+' $DEPLOY_PATH/.env.production 2>/dev/null && echo OK || echo MISSING"
if ($envCheck -ne "OK") {
    Write-Warn "⚠"
    Write-Warn "远程 .env.production 缺少 SHOP_JWT_SECRET 或 SHOP_ADMIN_PASSWORD，部署后 2C 后台可能无法登录。"
} else {
    Write-Success "✓"
}

# [2/5] 磁盘空间检查 + 条件性清理
Write-Host "[2/5] 检查磁盘空间...          " -NoNewline
$diskUsageRaw = ssh "$SERVER_USER@$SERVER_IP" "df / --output=pcent | tail -1" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "✗"
    Write-Err "无法获取远程磁盘空间信息：$diskUsageRaw"
    exit 1
}
$diskUsage = [int]($diskUsageRaw -replace "[^0-9]", "")
if ($diskUsage -gt $DISK_THRESHOLD) {
    Write-Warn "$diskUsage% (超过阈值 ${DISK_THRESHOLD}%)"
    Write-Host "      清理未使用 Docker 镜像..." -NoNewline
    ssh "$SERVER_USER@$SERVER_IP" "docker image prune -af --filter 'until=24h'" 2>&1 | Out-Null
    Write-Success " 已清理"
} else {
    Write-Success "$diskUsage% (正常)"
}

# [3/5] 同步本地代码到服务器
Write-Host "[3/5] 同步代码到服务器..."
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $projectRoot

# 打包项目文件（排除不需要的目录）
$tarFile = Join-Path $env:TEMP "celestia-deploy.tar.gz"
Write-Host "      打包本地项目..." -NoNewline

# 使用 tar 排除不需要同步的文件
tar -czf $tarFile --exclude=node_modules --exclude=.next --exclude=.git --exclude=.env --exclude=.env.production --exclude="public/uploads/products/*" --exclude="public/uploads/temp/*" --exclude="products" --exclude=".qoder" .
if ($LASTEXITCODE -ne 0) {
    Write-Err " 打包失败"
    Pop-Location
    exit 1
}
$tarSize = [math]::Round((Get-Item $tarFile).Length / 1MB, 1)
Write-Success " ✓ (${tarSize}MB)"

# 上传到服务器
Write-Host "      上传到服务器..." -NoNewline
scp -q $tarFile "${SERVER_USER}@${SERVER_IP}:/tmp/celestia-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Write-Err " 上传失败"
    Remove-Item $tarFile -ErrorAction SilentlyContinue
    Pop-Location
    exit 1
}
Write-Success " ✓"

# 清理本地临时文件
Remove-Item $tarFile -ErrorAction SilentlyContinue
Pop-Location

# 远程解压（保留服务器上的 .env.production、SSL证书、uploads）
Write-Host "      远程解压覆盖..." -NoNewline
ssh "$SERVER_USER@$SERVER_IP" "cd $DEPLOY_PATH && tar -xzf /tmp/celestia-deploy.tar.gz && rm -f /tmp/celestia-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) {
    Write-Err " 解压失败"
    exit 1
}
Write-Success " ✓"

# [4/5] 远程构建部署
Write-Host "[4/5] 开始远程构建部署..."
Write-Host ""

ssh "$SERVER_USER@$SERVER_IP" @'
cd /opt/celestia
set -e
echo '🔨 重新构建镜像...'
docker compose --env-file .env.production -f docker-compose.prod.yml build --no-cache
echo '🚀 启动服务...'
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
echo '⏳ 等待数据库就绪...'
sleep 5
echo '🗄️  运行数据库迁移...'
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app prisma migrate deploy
echo '🌱 种子数据...'
set +e
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app npx tsx scripts/seed-shop-admin.ts
seed_exit=$?
set -e
if [ "$seed_exit" -ne 0 ]; then echo '⚠️  seed 跳过或失败（若管理员已存在可忽略）'; fi
echo '🧹 清理旧镜像...'
docker image prune -f
'@
$deployExitCode = $LASTEXITCODE

# [5/5] 部署验证
Write-Host ""
Write-Host "[5/5] 部署验证...              " -NoNewline
if ($deployExitCode -eq 0) {
    Write-Success "✓"
    Write-Host ""
    ssh "$SERVER_USER@$SERVER_IP" "cd $DEPLOY_PATH && docker compose --env-file .env.production -f docker-compose.prod.yml ps"
    Write-Host ""
    Write-Host "HTTP 探测（本机 127.0.0.1:3000 + Host 头）:" -ForegroundColor Cyan
    ssh "$SERVER_USER@$SERVER_IP" @'
warn=0
probe() {
  local host="$1" path="$2"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -H "Host: $host" "http://127.0.0.1:3000$path" || echo 000)
  if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
    echo "  OK   $host$path -> HTTP $code"
  else
    echo -e "  \033[1;33mWARN\033[0m $host$path -> HTTP $code (expected 2xx/3xx)"
    warn=1
  fi
}
probe celestia.com /en
probe shop.celestia.com /en
probe shop.celestia.com /shop-admin/login
probe products.celestia.com /en/storefront
probe products.celestia.com /admin/login
echo ""
echo "HTTPS 公网探测（验证证书与反代，失败仅警告）:"
probe_https() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)
  if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
    echo "  OK   $url -> HTTP $code"
  else
    echo -e "  \033[1;33mWARN\033[0m $url -> HTTP $code (expected 2xx/3xx)"
    warn=1
  fi
}
probe_https https://celestia.com/en
probe_https https://shop.celestia.com/en
probe_https https://products.celestia.com/en/storefront
if [ "$warn" -ne 0 ]; then
  echo -e "\033[1;33m⚠️  部分探测未返回 2xx/3xx，请人工复核\033[0m"
fi
echo ""
echo "生产冒烟脚本（HTTPS + 跨子域重定向）:"
cd /opt/celestia && bash scripts/smoke-production.sh .env.production || echo -e "\033[1;33m⚠️  smoke-production.sh 有失败项\033[0m"
'@
    Write-Host ""
    Write-Host "生产访问地址:" -ForegroundColor Cyan
    Write-Host "  官网:       https://celestia.com/en" -ForegroundColor White
    Write-Host "  2C 商城:    https://shop.celestia.com/en" -ForegroundColor White
    Write-Host "  2C 后台:    https://shop.celestia.com/shop-admin/login" -ForegroundColor White
    Write-Host "  2B 后台:    https://products.celestia.com/admin/login" -ForegroundColor White
    Write-Host "  2B 客户端:  https://products.celestia.com/en/storefront" -ForegroundColor White
} else {
    Write-Err "✗"
}

Write-Host ""
Write-Host "========================================"
if ($deployExitCode -eq 0) {
    Write-Success "  ✅ 发布完成！"
} else {
    Write-Err "  ❌ 发布失败，请检查上方输出。"
    exit 1
}
Write-Host "========================================"
