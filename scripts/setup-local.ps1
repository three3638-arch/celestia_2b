# Celestia 本地开发环境一键启动脚本
# 使用方法: 在项目根目录运行 .\scripts\setup-local.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Celestia 本地开发环境初始化" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查环境
Write-Host "📋 步骤 1/9: 检查环境..." -ForegroundColor Yellow

# 检查 Node.js
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Host "❌ 错误: 未检测到 Node.js" -ForegroundColor Red
    Write-Host "   请访问 https://nodejs.org/ 下载并安装 Node.js 20+" -ForegroundColor Red
    exit 1
}

$majorVersion = [int]($nodeVersion -replace 'v', '').Split('.')[0]
if ($majorVersion -lt 20) {
    Write-Host "❌ 错误: Node.js 版本过低 ($nodeVersion)，需要 20+" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green

# 检查 Docker Desktop
$dockerVersion = $null
try {
    $dockerVersion = docker --version 2>$null
} catch {}

if (-not $dockerVersion) {
    Write-Host "❌ 错误: 未检测到 Docker" -ForegroundColor Red
    Write-Host "   请访问 https://www.docker.com/products/docker-desktop/ 下载安装" -ForegroundColor Red
    exit 1
}

# 检查 Docker 是否运行
try {
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
} catch {
    Write-Host "❌ 错误: Docker Desktop 未运行" -ForegroundColor Red
    Write-Host "   请启动 Docker Desktop 后重试" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Docker Desktop 运行中" -ForegroundColor Green

# 2. 检查/创建 .env 文件
Write-Host ""
Write-Host "📋 步骤 2/9: 配置环境变量..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        
        # 生成随机 JWT_SECRET (32字符)
        $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
        $envContent = Get-Content ".env" -Raw
        $envContent = $envContent -replace 'JWT_SECRET=your-jwt-secret-change-in-production', "JWT_SECRET=$jwtSecret"
        Set-Content ".env" $envContent -NoNewline
        
        Write-Host "   ✅ 已创建 .env 文件并生成 JWT_SECRET" -ForegroundColor Green
    } else {
        Write-Host "❌ 错误: 未找到 .env.example 文件" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ .env 文件已存在" -ForegroundColor Green
}

# 3. 安装依赖
Write-Host ""
Write-Host "📋 步骤 3/9: 安装 npm 依赖..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm install 失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 依赖安装完成" -ForegroundColor Green

# 4. 启动 Docker 数据库
Write-Host ""
Write-Host "📋 步骤 4/9: 启动 PostgreSQL 数据库..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker 启动失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 数据库容器已启动" -ForegroundColor Green

# 5. 等待数据库就绪
Write-Host ""
Write-Host "📋 步骤 5/9: 等待数据库就绪..." -ForegroundColor Yellow
$maxRetries = 30
$retryCount = 0
$healthy = $false

while ($retryCount -lt $maxRetries -and -not $healthy) {
    Start-Sleep -Seconds 2
    $retryCount++
    
    try {
        $status = docker compose ps db --format "{{.Status}}" 2>$null
        if ($status -match "healthy|running") {
            $healthy = $true
        }
    } catch {}
    
    Write-Host "   等待中... ($retryCount/$maxRetries)" -ForegroundColor Gray
}

if (-not $healthy) {
    Write-Host "❌ 数据库未能在 60 秒内就绪" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 数据库已就绪" -ForegroundColor Green

# 6. 生成 Prisma Client
Write-Host ""
Write-Host "📋 步骤 6/9: 生成 Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Prisma generate 失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Prisma Client 生成完成" -ForegroundColor Green

# 7. 运行数据库迁移
Write-Host ""
Write-Host "📋 步骤 7/9: 初始化数据库表结构..." -ForegroundColor Yellow

# 检查是否已有迁移记录
$migrationExists = $false
try {
    $migrationOutput = npx prisma migrate status 2>&1
    if ($migrationOutput -match "Database schema is up to date") {
        $migrationExists = $true
    }
} catch {}

if ($migrationExists) {
    Write-Host "   检测到已有迁移，使用 db push 同步..." -ForegroundColor Gray
    npx prisma db push --accept-data-loss
} else {
    Write-Host "   首次运行，创建迁移..." -ForegroundColor Gray
    npx prisma migrate dev --name init --skip-generate
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 数据库迁移失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ 数据库表结构初始化完成" -ForegroundColor Green

# 8. 创建管理员账号
Write-Host ""
Write-Host "📋 步骤 8/9: 创建管理员账号..." -ForegroundColor Yellow
npx tsx scripts/seed-admin.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  管理员账号创建失败（可能已存在）" -ForegroundColor Yellow
}

# 9. 完成
Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ 环境准备完成！" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "📝 下一步操作:" -ForegroundColor Cyan
Write-Host "   运行: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🔗 访问地址:" -ForegroundColor Cyan
Write-Host "   管理后台: http://localhost:3000/admin/login" -ForegroundColor White
Write-Host "   客户端(英文): http://localhost:3000/en/storefront" -ForegroundColor White
Write-Host "   客户端(阿拉伯文): http://localhost:3000/ar/storefront" -ForegroundColor White
Write-Host "   客户端(中文): http://localhost:3000/zh/storefront" -ForegroundColor White
Write-Host ""
Write-Host "👤 默认管理员账号:" -ForegroundColor Cyan
Write-Host "   手机号: 13800000001" -ForegroundColor White
Write-Host "   密码: admin123" -ForegroundColor White
Write-Host ""
