import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getOrderForExport, generateOrderDetailExcel } from '@/lib/excel/order-detail-export'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 管理员权限校验
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
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

    // 4. 生成 Excel
    const excelData = await generateOrderDetailExcel(order)

    // 5. 返回响应
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