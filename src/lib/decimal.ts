import Decimal from 'decimal.js'

// 配置 Decimal.js
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * 计算客户价格（SAR）
 * 公式：CNY成本价 × 加价比例 × 汇率，向上取整到小数点后1位
 */
export function calculateCustomerPrice(
  costCny: number | string,
  markupRatio: number | string,
  exchangeRate: number | string
): string {
  const cost = new Decimal(costCny)
  const markup = new Decimal(markupRatio)
  const rate = new Decimal(exchangeRate)
  
  const result = cost.mul(markup).mul(rate)
  // 向上取整到1位小数
  return result.toDecimalPlaces(1, Decimal.ROUND_UP).toString()
}

/**
 * 计算订单总金额
 */
export function calculateTotal(
  items: Array<{ price: number | string; quantity: number }>
): string {
  return items
    .reduce((sum, item) => {
      return sum.add(new Decimal(item.price).mul(item.quantity))
    }, new Decimal(0))
    .toDecimalPlaces(2)
    .toString()
}

/**
 * 计算预估毛利（CNY）
 * 公式：成本总价 × (加价比例 - 1) - 运费
 */
export function calculateEstimatedProfit(
  totalCny: number | string,
  markupRatio: number | string,
  shippingCostCny: number | string = 0
): string {
  const total = new Decimal(totalCny)
  const markup = new Decimal(markupRatio)
  const shipping = new Decimal(shippingCostCny)
  
  return total.mul(markup.sub(1)).sub(shipping).toDecimalPlaces(2).toString()
}

/**
 * 计算实际毛利（CNY）
 * 公式：结算总额等价CNY - 成本总价 - 运费
 */
export function calculateActualProfit(
  settlementCny: number | string,
  costCny: number | string,
  shippingCostCny: number | string = 0
): string {
  const settlement = new Decimal(settlementCny)
  const cost = new Decimal(costCny)
  const shipping = new Decimal(shippingCostCny)
  
  return settlement.sub(cost).sub(shipping).toDecimalPlaces(2).toString()
}

/**
 * 安全的 Decimal 加法
 */
export function decimalAdd(a: number | string, b: number | string): string {
  return new Decimal(a).add(new Decimal(b)).toDecimalPlaces(2).toString()
}

/**
 * 安全的 Decimal 乘法
 */
export function decimalMul(a: number | string, b: number | string): string {
  return new Decimal(a).mul(new Decimal(b)).toDecimalPlaces(2).toString()
}

/**
 * 参考价展示计算（SAR）
 * 用于商品列表展示：SPU参考价 × 客户加价比例
 */
export function calculateDisplayPrice(
  referencePriceSar: number | string,
  markupRatio: number | string
): string {
  const price = new Decimal(referencePriceSar)
  const markup = new Decimal(markupRatio)
  return price.mul(markup).toDecimalPlaces(1, Decimal.ROUND_UP).toString()
}
