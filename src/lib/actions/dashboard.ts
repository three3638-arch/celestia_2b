'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { UserRole, UserStatus, ProductStatus, OrderStatus } from '@prisma/client'

// 仪表盘统计数据类型
export interface DashboardStats {
  totalOrders: number
  totalCustomers: number
  totalProducts: number
  monthOrders: number
  monthRevenueSar: number
  pendingQuoteCount: number
  pendingApprovalCount: number
  pendingSettlementCount: number
}

// 最近订单类型
export interface RecentOrder {
  id: string
  orderNo: string
  customerName: string
  status: OrderStatus
  totalSar: number | null
  createdAt: Date
}

// 月度销售数据类型
export interface MonthlyRevenue {
  month: string
  revenue: number
  orderCount: number
}

/**
 * 获取仪表盘统计数据
 * 仅 ADMIN 可访问
 */
export async function getDashboardStats(): Promise<DashboardStats | null> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return null
    }

    // 计算本月开始时间
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 并行查询所有统计数据
    const [
      totalOrders,
      totalCustomers,
      totalProducts,
      monthOrders,
      monthRevenueResult,
      pendingQuoteCount,
      pendingApprovalCount,
      pendingSettlementCount,
    ] = await Promise.all([
      // 总订单数
      prisma.order.count(),
      // 已激活客户数
      prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
      }),
      // 上架商品数
      prisma.product.count({
        where: {
          status: ProductStatus.ACTIVE,
        },
      }),
      // 本月订单数
      prisma.order.count({
        where: {
          createdAt: {
            gte: monthStart,
          },
        },
      }),
      // 本月销售额（非取消订单）
      prisma.order.aggregate({
        where: {
          createdAt: {
            gte: monthStart,
          },
          status: {
            not: OrderStatus.CANCELLED,
          },
          totalSar: {
            not: null,
          },
        },
        _sum: {
          totalSar: true,
        },
      }),
      // 待报价订单数
      prisma.order.count({
        where: {
          status: OrderStatus.PENDING_QUOTE,
        },
      }),
      // 待审核客户数
      prisma.user.count({
        where: {
          role: UserRole.CUSTOMER,
          status: UserStatus.PENDING,
        },
      }),
      // 待结算订单数（SHIPPED + SETTLING）
      prisma.order.count({
        where: {
          status: {
            in: [OrderStatus.SHIPPED, OrderStatus.SETTLING],
          },
        },
      }),
    ])

    return {
      totalOrders,
      totalCustomers,
      totalProducts,
      monthOrders,
      monthRevenueSar: monthRevenueResult._sum.totalSar
        ? Number(monthRevenueResult._sum.totalSar)
        : 0,
      pendingQuoteCount,
      pendingApprovalCount,
      pendingSettlementCount,
    }
  } catch (error) {
    console.error('获取仪表盘统计失败:', error)
    return null
  }
}

/**
 * 获取最近订单
 * 返回最近 N 条订单
 */
export async function getRecentOrders(limit = 10): Promise<RecentOrder[]> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return []
    }

    const orders = await prisma.order.findMany({
      take: Math.min(limit, 50),
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        orderNo: true,
        status: true,
        totalSar: true,
        createdAt: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    return orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      customerName: order.user.name,
      status: order.status,
      totalSar: order.totalSar ? Number(order.totalSar) : null,
      createdAt: order.createdAt,
    }))
  } catch (error) {
    console.error('获取最近订单失败:', error)
    return []
  }
}

/**
 * 获取月度销售趋势
 * 返回最近 N 个月的月度数据
 */
export async function getMonthlyRevenue(months = 6): Promise<MonthlyRevenue[]> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return []
    }

    const result: MonthlyRevenue[] = []
    const now = new Date()

    // 计算每个月的数据
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)

      // 查询该月的订单
      const orders = await prisma.order.findMany({
        where: {
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
          status: {
            not: OrderStatus.CANCELLED,
          },
        },
        select: {
          totalSar: true,
        },
      })

      const revenue = orders.reduce((sum, order) => {
        return sum + (order.totalSar ? Number(order.totalSar) : 0)
      }, 0)

      const monthStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

      result.push({
        month: monthStr,
        revenue,
        orderCount: orders.length,
      })
    }

    return result
  } catch (error) {
    console.error('获取月度销售趋势失败:', error)
    return []
  }
}
