import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/password'
import { signShopToken, setShopAuthCookie } from '@/lib/shop-auth'
import { assertShopJwtConfigured } from '@/lib/shop-jwt-config'
import { shopLoginSchema } from '@/lib/validations/shop'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    assertShopJwtConfigured()
    const body = await request.json()
    const result = shopLoginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues.map((i) => i.message).join('；') },
        { status: 400 }
      )
    }

    const { phone, password } = result.data
    const user = await prisma.shopUser.findUnique({ where: { phone } })
    if (!user) {
      return NextResponse.json({ success: false, error: '手机号或密码错误' }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ success: false, error: '手机号或密码错误' }, { status: 401 })
    }

    const token = await signShopToken({ shopUserId: user.id, role: user.role })
    await setShopAuthCookie(token)

    return NextResponse.json({
      success: true,
      data: { id: user.id, phone: user.phone, name: user.name, role: user.role },
      message: '登录成功',
    })
  } catch (error) {
    console.error('Shop login error:', error)
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 })
  }
}
