// 订单状态配置（中文标签用于管理端，英文用于客户端）
export const ORDER_STATUS_CONFIG = {
  PENDING_QUOTE: { label_zh: '待报价', label_en: 'Pending Quote', color: 'yellow' },
  QUOTED: { label_zh: '已报价', label_en: 'Quoted', color: 'blue' },
  NEGOTIATING: { label_zh: '协商中', label_en: 'Negotiating', color: 'orange' },
  CONFIRMED: { label_zh: '已确认', label_en: 'Confirmed', color: 'green' },
  PARTIALLY_PAID: { label_zh: '部分付款', label_en: 'Partially Paid', color: 'cyan' },
  FULLY_PAID: { label_zh: '已付清', label_en: 'Fully Paid', color: 'emerald' },
  SHIPPED: { label_zh: '已发货', label_en: 'Shipped', color: 'purple' },
  SETTLING: { label_zh: '结算中', label_en: 'Settling', color: 'amber' },
  COMPLETED: { label_zh: '已完成', label_en: 'Completed', color: 'green' },
  CANCELLED: { label_zh: '已取消', label_en: 'Cancelled', color: 'red' },
} as const

export const ORDER_ITEM_STATUS_CONFIG = {
  PENDING_QUOTE: { label_zh: '待报价', label_en: 'Pending Quote' },
  QUOTED: { label_zh: '已报价', label_en: 'Quoted' },
  OUT_OF_STOCK: { label_zh: '缺货', label_en: 'Out of Stock' },
  CUSTOMER_REMOVED: { label_zh: '客户移除', label_en: 'Removed' },
  CONFIRMED: { label_zh: '已确认', label_en: 'Confirmed' },
  RETURNED: { label_zh: '退货', label_en: 'Returned' },
  QTY_ADJUSTED: { label_zh: '数量调整', label_en: 'Qty Adjusted' },
} as const

// 币种
export const CURRENCIES = {
  CNY: { symbol: '¥', name: '人民币' },
  SAR: { symbol: 'SAR', name: 'Saudi Riyal' },
} as const

// 分页
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

// 默认加价比例
export const DEFAULT_MARKUP_RATIO = 1.15

// 默认汇率（CNY → SAR）
export const DEFAULT_EXCHANGE_RATE = 0.52

// 支持的语言
export const SUPPORTED_LOCALES = ['en', 'ar', 'zh'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

// RTL 语言
export const RTL_LOCALES = ['ar'] as const
