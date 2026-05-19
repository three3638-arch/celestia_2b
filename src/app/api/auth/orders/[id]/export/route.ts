import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrderForExport, generateOrderDetailExcel } from '@/lib/excel/order-detail-export'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 客户认证
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. 获取 orderId
    const { id: orderId } = await params

    // 3. 查询订单数据
    const order = await getOrderForExport(orderId)
    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      )
    }

    // 4. 验证订单归属：当前用户必须是订单拥有者
    if (order.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      )
    }

    // 5. 生成 Excel
    const excelData = await generateOrderDetailExcel(order)

    // 6. 返回响应
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    responseHeaders.set('Content-Disposition', `attachment; filename=order-detail-${order.orderNo}.xlsx`)

    return new NextResponse(excelData as any, { headers: responseHeaders })
  } catch (error) {
    console.error('Export order detail error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export order detail' },
      { status: 500 }
    )
  }
}
