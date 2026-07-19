import Decimal from 'decimal.js'

export interface ShopPriceInput {
  listPrice: string | number | Decimal
  salePrice?: string | number | Decimal | null
  saleStartAt?: Date | string | null
  saleEndAt?: Date | string | null
}

export interface ResolvedShopPrice {
  listPrice: string
  currentPrice: string
  isOnSale: boolean
  saleEndsAt: Date | null
  discountPercent: number | null
}

export function resolveShopPrice(
  variant: ShopPriceInput,
  now: Date = new Date()
): ResolvedShopPrice {
  const list = new Decimal(variant.listPrice.toString())
  const sale = variant.salePrice != null ? new Decimal(variant.salePrice.toString()) : null
  const start = variant.saleStartAt ? new Date(variant.saleStartAt) : null
  const end = variant.saleEndAt ? new Date(variant.saleEndAt) : null

  const onSale =
    sale !== null &&
    start !== null &&
    end !== null &&
    start <= now &&
    now < end &&
    sale.lessThan(list)

  const current = onSale ? sale! : list
  let discountPercent: number | null = null
  if (onSale && !list.isZero()) {
    discountPercent = list.minus(current).div(list).mul(100).toDecimalPlaces(0).toNumber()
  }

  return {
    listPrice: list.toFixed(2),
    currentPrice: current.toFixed(2),
    isOnSale: onSale,
    saleEndsAt: onSale ? end : null,
    discountPercent,
  }
}

export function aggregateProductPriceRange(
  variants: Array<ShopPriceInput & { stockStatus?: string }>,
  now: Date = new Date()
): { minPrice: string; maxPrice: string; hasOnSale: boolean } {
  const active = variants.filter((v) => v.stockStatus !== 'OUT_OF_STOCK')
  if (active.length === 0) {
    return { minPrice: '0', maxPrice: '0', hasOnSale: false }
  }

  const prices = active.map((v) => resolveShopPrice(v, now))
  const currents = prices.map((p) => new Decimal(p.currentPrice))
  const min = Decimal.min(...currents)
  const max = Decimal.max(...currents)

  return {
    minPrice: min.toFixed(2),
    maxPrice: max.toFixed(2),
    hasOnSale: prices.some((p) => p.isOnSale),
  }
}
