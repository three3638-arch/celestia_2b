#!/usr/bin/env bash
# 生产环境 HTTPS + 子域重定向冒烟（部署后于服务器或 CI 执行）
# 用法: ./scripts/smoke-production.sh [path-to-.env.production]

set -euo pipefail

ENV_FILE="${1:-.env.production}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

MARKETING="${NEXT_PUBLIC_MARKETING_URL:-https://celestia.com}"
SHOP="${NEXT_PUBLIC_SHOP_URL:-https://shop.celestia.com}"
B2B="${NEXT_PUBLIC_B2B_URL:-https://products.celestia.com}"

warn=0

probe_https() {
  local url="$1"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)
  if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
    echo "  OK   $url -> HTTP $code"
  else
    echo "  WARN $url -> HTTP $code (expected 2xx/3xx)"
    warn=1
  fi
}

probe_redirect() {
  local from="$1" expect_host="$2"
  local code location
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -L --max-redirs 0 "$from" || echo 000)
  location=$(curl -sI --max-time 20 "$from" | tr -d '\r' | awk -F': ' 'tolower($1)=="location"{print $2; exit}')
  if [[ "$code" =~ ^(301|302|307|308)$ ]] && [[ "$location" == *"$expect_host"* ]]; then
    echo "  OK   $from -> $code $location"
  else
    echo "  WARN $from -> HTTP $code location=$location (expected redirect to *$expect_host*)"
    warn=1
  fi
}

echo "生产 HTTPS 冒烟探测"
echo "  官网: $MARKETING"
echo "  商城: $SHOP"
echo "  2B:   $B2B"
echo ""

echo "页面可达:"
probe_https "$MARKETING/en"
probe_https "$SHOP/en"
probe_https "$SHOP/shop-admin/login"
probe_https "$B2B/en/storefront"
probe_https "$B2B/admin/login"
probe_https "$SHOP/api/shop/products?locale=en"

echo ""
echo "跨子域重定向:"
probe_redirect "$MARKETING/admin/login" "products."
probe_redirect "$MARKETING/shop-admin/login" "shop."

echo ""
if [[ "$warn" -ne 0 ]]; then
  echo "⚠️  部分探测未通过，请人工复核"
  exit 1
fi
echo "✅ 生产冒烟全部通过"
