// API 响应格式
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 分页请求参数
export interface PaginationParams {
  page?: number
  pageSize?: number
  cursor?: string  // 游标分页
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  hasMore: boolean
  nextCursor?: string
}

// 商品筛选参数
export interface ProductFilterParams extends PaginationParams {
  categoryId?: string
  gemType?: string
  metalColor?: string
  keyword?: string
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'popular'
  status?: string  // 管理端用
}

// 订单筛选参数
export interface OrderFilterParams extends PaginationParams {
  status?: string
  userId?: string  // 管理端按客户筛选
  keyword?: string  // 按订单号搜索
}

// JWT Payload
export interface JwtPayload {
  userId: string
  role: 'ADMIN' | 'CUSTOMER'
  status: 'PENDING' | 'ACTIVE'
  iat: number
  exp: number
}

// 当前用户会话
export interface SessionUser {
  id: string
  phone: string
  name: string
  company: string | null
  role: 'ADMIN' | 'CUSTOMER'
  status: 'PENDING' | 'ACTIVE'
  markupRatio: string  // Decimal as string
  preferredLang: string
}
