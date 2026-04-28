import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAdminOrderDetail } from '@/lib/actions/order'
import ExcelJS from 'exceljs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 权限校验
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // 2. 获取 orderId
    const { id: orderId } = await params

    // 3. 获取订单数据
    const result = await getAdminOrderDetail(orderId)
    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Order not found' },
        { status: 404 }
      )
    }

    const order = result.data

    // 4. 过滤掉 CUSTOMER_REMOVED 状态的商品
    const items = order.items.filter(item => item.itemStatus !== 'CUSTOMER_REMOVED')

    // 5. 创建 Excel
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(`采购清单-${order.orderNo}`)

    // 第1行：标题
    worksheet.mergeCells('A1:I1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = '采购清单'
    titleCell.font = { bold: true, size: 16 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

    // 第2行：订单号
    worksheet.mergeCells('A2:I2')
    const orderNoCell = worksheet.getCell('A2')
    orderNoCell.value = `订单号：${order.orderNo}`
    orderNoCell.alignment = { horizontal: 'center', vertical: 'middle' }

    // 第3行：空行

    // 第4行：表头
    const headers = ['序号', 'SPU编号', '商品名称', 'SKU描述', '供应商', '供应商链接', '数量', '成本单价(¥)', '成本小计(¥)']
    const headerRow = worksheet.getRow(4)
    headers.forEach((header, index) => {
      const cell = headerRow.getCell(index + 1)
      cell.value = header
      cell.font = { bold: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // 设置列宽
    worksheet.getColumn(1).width = 8
    worksheet.getColumn(2).width = 16
    worksheet.getColumn(3).width = 30
    worksheet.getColumn(4).width = 20
    worksheet.getColumn(5).width = 18
    worksheet.getColumn(6).width = 30
    worksheet.getColumn(7).width = 10
    worksheet.getColumn(8).width = 14
    worksheet.getColumn(9).width = 14

    // 数据行
    let totalQty = 0
    let totalCost = 0

    items.forEach((item, index) => {
      const row = worksheet.getRow(5 + index)
      const qty = item.settlementQty !== null && item.settlementQty !== undefined
        ? item.settlementQty
        : item.quantity
      const unitPrice = item.unitPriceCny ? parseFloat(item.unitPriceCny) : 0
      const subtotal = unitPrice * qty

      totalQty += qty
      totalCost += subtotal

      row.getCell(1).value = index + 1
      row.getCell(2).value = item.spuCode || ''
      row.getCell(3).value = item.productNameSnapshot
      row.getCell(4).value = item.skuDescSnapshot
      row.getCell(5).value = item.supplier || ''
      row.getCell(6).value = item.supplierLink || ''
      row.getCell(7).value = qty
      row.getCell(8).value = unitPrice
      row.getCell(9).value = subtotal

      // 格式化数字列
      row.getCell(8).numFmt = '¥#,##0.00'
      row.getCell(9).numFmt = '¥#,##0.00'

      // 居中对齐序号、数量
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // 合计行
    const totalRowIndex = 5 + items.length
    const totalRow = worksheet.getRow(totalRowIndex)
    totalRow.getCell(6).value = '合计'
    totalRow.getCell(6).font = { bold: true }
    totalRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
    totalRow.getCell(7).value = totalQty
    totalRow.getCell(7).font = { bold: true }
    totalRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
    totalRow.getCell(9).value = totalCost
    totalRow.getCell(9).font = { bold: true }
    totalRow.getCell(9).numFmt = '¥#,##0.00'

    // 6. 生成 buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // 7. 返回响应
    const responseHeaders = new Headers()
    responseHeaders.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    responseHeaders.set('Content-Disposition', `attachment; filename=purchase-list-${order.orderNo}.xlsx`)

    return new NextResponse(buffer, { headers: responseHeaders })
  } catch (error) {
    console.error('Export purchase list error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to export purchase list' },
      { status: 500 }
    )
  }
}
