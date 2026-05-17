'use server'

import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { DEFAULT_MARKUP_RATIO } from '@/lib/constants'
import { approveCustomerSchema, updateMarkupRatioSchema, resetPasswordSchema } from '@/lib/validations/customer'
import { formatZodErrors } from '@/lib/validations/error-formatter'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { UserRole, UserStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import type { z } from 'zod'

import { hashPassword } from '@/lib/password'

// 验证用户是否为 ADMIN
async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }
  return user
}

// 字段名映射
const customerFieldNameMap: Record<string, string> = {
  userId: '用户ID',
  markupRatio: '加价比例',
  newPassword: '新密码',
  groupIds: '分组权限',
}

// 客户列表项类型
export interface CustomerListItem {
  id: string
  phone: string
  name: string
  company: string | null
  role: 'ADMIN' | 'CUSTOMER'
  status: 'PENDING' | 'ACTIVE'
  markupRatio: string
  preferredLang: string
  createdAt: Date
  orderCount: number
  groups: { id: string; name: string }[]
}

// 获取客户列表（分页 + 搜索 + 状态筛选）
export async function getCustomers(params: {
  page?: number
  pageSize?: number
  search?: string
  status?: 'PENDING' | 'ACTIVE' | 'all'
}): Promise<PaginatedResponse<CustomerListItem>> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return {
        items: [],
        total: 0,
        hasMore: false,
      }
    }

    const page = Math.max(1, params.page || 1)
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
    const skip = (page - 1) * pageSize

    // 构建查询条件
    const where: {
      role: UserRole
      status?: UserStatus
      OR?: Array<{
        phone?: { contains: string; mode: 'insensitive' }
        name?: { contains: string; mode: 'insensitive' }
      }>
    } = {
      role: UserRole.CUSTOMER,
    }

    // 状态筛选
    if (params.status && params.status !== 'all') {
      where.status = params.status as UserStatus
    }

    // 搜索条件（手机号或姓名）
    if (params.search?.trim()) {
      const searchTerm = params.search.trim()
      where.OR = [
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ]
    }

    // 查询总数
    const total = await prisma.user.count({ where })

    // 查询客户列表
    const users = await prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        groupAccess: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    })

    // 转换数据
    const items: CustomerListItem[] = users.map((user) => ({
      id: user.id,
      phone: user.phone,
      name: user.name,
      company: user.company,
      role: user.role,
      status: user.status,
      markupRatio: user.markupRatio.toString(),
      preferredLang: user.preferredLang,
      createdAt: user.createdAt,
      orderCount: user._count.orders,
      groups: user.groupAccess.map((ga) => ({
        id: ga.group.id,
        name: ga.group.name,
      })),
    }))

    return {
      items,
      total,
      hasMore: skip + items.length < total,
    }
  } catch (error) {
    console.error('获取客户列表失败:', error)
    return {
      items: [],
      total: 0,
      hasMore: false,
    }
  }
}

// 审核通过客户
export async function approveCustomer(params: {
  userId: string
  markupRatio: number
  groupIds: string[]
}): Promise<ApiResponse> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: '无权限执行此操作',
      }
    }

    // 使用 Zod 验证参数，返回具体字段错误
    const validation = approveCustomerSchema.safeParse(params)
    if (!validation.success) {
      return {
        success: false,
        error: formatZodErrors(validation.error.issues, customerFieldNameMap),
      }
    }

    const { userId, markupRatio, groupIds } = validation.data

    // 在事务中更新用户状态并创建分组权限
    await prisma.$transaction(async (tx) => {
      // 更新用户状态
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.ACTIVE,
          markupRatio,
        },
      })

      // 批量创建分组权限
      if (groupIds.length > 0) {
        await tx.userGroupAccess.createMany({
          data: groupIds.map((groupId) => ({
            userId,
            groupId,
          })),
          skipDuplicates: true,
        })
      }
    })

    // 刷新缓存
    revalidatePath('/admin/customers')

    return {
      success: true,
      message: '客户审核通过',
    }
  } catch (error) {
    console.error('审核客户失败:', error)
    return {
      success: false,
      error: '审核客户失败，请稍后重试',
    }
  }
}

// 更新客户分组权限
export async function updateCustomerGroups(
  userId: string,
  groupIds: string[]
): Promise<ApiResponse> {
  try {
    await requireAdmin()

    // 在事务中先删除旧权限，再创建新权限
    await prisma.$transaction(async (tx) => {
      // 删除该用户所有现有分组权限
      await tx.userGroupAccess.deleteMany({
        where: { userId },
      })

      // 批量创建新的分组权限
      if (groupIds.length > 0) {
        await tx.userGroupAccess.createMany({
          data: groupIds.map((groupId) => ({
            userId,
            groupId,
          })),
          skipDuplicates: true,
        })
      }
    })

    // 刷新缓存
    revalidatePath('/admin/customers')

    return {
      success: true,
      message: '客户分组权限已更新',
    }
  } catch (error) {
    console.error('更新客户分组权限失败:', error)
    return {
      success: false,
      error: '更新客户分组权限失败，请稍后重试',
    }
  }
}

// 更新客户加价比例
export async function updateMarkupRatio(params: {
  userId: string
  markupRatio: number
}): Promise<ApiResponse> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: '无权限执行此操作',
      }
    }

    // 使用 Zod 验证参数，返回具体字段错误
    const validation = updateMarkupRatioSchema.safeParse(params)
    if (!validation.success) {
      return {
        success: false,
        error: formatZodErrors(validation.error.issues, customerFieldNameMap),
      }
    }

    const { userId, markupRatio } = validation.data

    // 更新加价比例
    await prisma.user.update({
      where: { id: userId },
      data: {
        markupRatio,
      },
    })

    // 刷新缓存
    revalidatePath('/admin/customers')

    return {
      success: true,
      message: '加价比例更新成功',
    }
  } catch (error) {
    console.error('更新加价比例失败:', error)
    return {
      success: false,
      error: '更新加价比例失败，请稍后重试',
    }
  }
}

// 重置客户密码
export async function resetCustomerPassword(params: {
  userId: string
  newPassword: string
}): Promise<ApiResponse> {
  try {
    // 验证当前用户身份
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      return {
        success: false,
        error: '无权限执行此操作',
      }
    }

    // 使用 Zod 验证参数，返回具体字段错误
    const validation = resetPasswordSchema.safeParse(params)
    if (!validation.success) {
      return {
        success: false,
        error: formatZodErrors(validation.error.issues, customerFieldNameMap),
      }
    }

    const { userId, newPassword } = validation.data

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!target || target.role !== UserRole.CUSTOMER) {
      return {
        success: false,
        error: '只能修改客户账号的登录密码',
      }
    }

    // 加密新密码
    const passwordHash = await hashPassword(newPassword)

    // 更新密码
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    // 刷新缓存
    revalidatePath('/admin/customers')

    return {
      success: true,
      message: '密码已更新',
    }
  } catch (error) {
    console.error('重置密码失败:', error)
    return {
      success: false,
      error: '重置密码失败，请稍后重试',
    }
  }
}
